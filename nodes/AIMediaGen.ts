import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
} from 'n8n-workflow';
import { CacheManager, CacheKeyGenerator } from './utils/cache';
import { PerformanceMonitor } from './utils/monitoring';
import { withRetry, MediaGenError } from './utils/errors';
import * as CONSTANTS from './utils/constants';
import { validateModelRequest } from './utils/validators';

/**
 * Metadata for execution results
 */
interface ResultMetadata {
	/** Whether the result was retrieved from cache */
	cached?: boolean;
	/** Additional metadata properties */
	[key: string]: unknown;
}

/**
 * ModelScope API credentials
 */
interface ModelScopeApiCredentials {
	/** API key for authentication */
	apiKey: string;
	/** Optional custom base URL */
	baseUrl?: string;
}

/**
 * Google Palm API credentials (for Nano Banana)
 */
interface GooglePalmApiCredentials {
	/** API key for authentication */
	apiKey: string;
	/** Optional custom host (e.g., ai.comfly.chat) */
	host?: string;
}

/**
 * Doubao API credentials
 */
interface DoubaoApiCredentials {
	/** API key for authentication */
	apiKey: string;
	/** Optional custom base URL */
	baseUrl?: string;
}

/**
 * OpenAI API credentials for Sora
 *
 * Uses n8n's built-in openaiApi credential type which includes:
 * - apiKey: API key
 * - organizationId: Optional organization ID
 * - baseUrl: Optional custom base URL
 */
interface OpenAiApiCredentials {
	/** API key for authentication */
	apiKey: string;
	/** Optional organization ID */
	organizationId?: string;
	/** Optional custom base URL (e.g., for proxy or compatible API) */
	baseUrl?: string;
}

/**
 * ModelScope async task submission response
 */
interface ModelScopeAsyncSubmitResponse {
	task_id: string;
}

/**
 * ModelScope async task status response
 */
interface ModelScopeAsyncTaskResponse {
	task_status: 'PENDING' | 'RUNNING' | 'PROCESSING' | 'SUCCEED' | 'FAILED';
	output_images?: Array<string | { url: string }>;
	output_url?: string;
	message?: string;
}

/**
 * Seedream image generation response
 */
interface SeedreamResponse {
	data?: Array<{
		url?: string;
		b64_json?: string;
		revised_prompt?: string;
	}>;
	request_id?: string;
	output_url?: string;
	b64_json?: string;
	status?: string;
}

/**
 * Sora API request body
 */
interface SoraRequest {
	model: 'sora-2' | 'sora-2-pro';
	prompt: string;
	aspect_ratio: '16:9' | '3:2' | '1:1' | '9:16' | '2:3';
	duration: '5' | '10' | '15' | '20' | '25';
	hd?: boolean;
	images?: string[];
}

/**
 * Sora submit response
 */
interface SoraSubmitResponse {
	task_id: string;
}

/**
 * Sora task status response
 */
interface SoraTaskResponse {
	task_id: string;
	platform: string;
	action: string;
	status: 'NOT_START' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';
	fail_reason: string;
	submit_time: number;
	start_time: number;
	finish_time: number;
	progress: string;
	data: {
		output?: string;
	} | null;
	search_item: string;
}

/**
 * Veo submit response
 */
interface VeoSubmitResponse {
	task_id: string;
}

/**
 * Veo task status response
 */
interface VeoTaskResponse {
	task_id: string;
	platform: string;
	action: string;
	status: 'NOT_START' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';
	fail_reason: string;
	submit_time: number;
	start_time: number;
	finish_time: number;
	progress: string;
	data: {
		output?: string;
	} | null;
	search_item: string;
}

/**
 * Veo API request body
 */
interface VeoRequest {
	prompt: string;
	model: 'veo3.1-fast' | 'veo3.1-pro' | 'veo3.1' | 'veo3.1-components';
	enhance_prompt?: boolean;
	enable_upsample?: boolean;
	aspect_ratio?: '16:9' | '9:16';
	images?: string[];
}

/**
 * Parse image dimensions from buffer
 */
function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
	// Check for PNG
	if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
		// PNG dimensions are at bytes 16-23 (big-endian)
		const width = buffer.readUInt32BE(16);
		const height = buffer.readUInt32BE(20);
		return { width, height };
	}

	// Check for JPEG
	if (buffer[0] === 0xff && buffer[1] === 0xd8) {
		let i = 2;
		while (i < buffer.length) {
			// Find SOF markers (SOF0, SOF1, SOF2, etc.)
			if (buffer[i] === 0xff && buffer[i + 1] >= 0xc0 && buffer[i + 1] <= 0xcf && buffer[i + 1] !== 0xc4 && buffer[i + 1] !== 0xc8) {
				const height = buffer.readUInt16BE(i + 5);
				const width = buffer.readUInt16BE(i + 7);
				return { width, height };
			}
			// Skip to next marker
			i += 2;
			const length = buffer.readUInt16BE(i);
			i += length;
		}
	}

	return null;
}

/**
 * AI Media Generation Node
 *
 * Generates and edits images using multiple AI platforms:
 * - ModelScope: Z-Image, Qwen-Image-2512, Qwen-Image-Edit-2511
 * - Nano Banana: Google's Gemini 2.5 Flash Image model
 */
export class AIMediaGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI Media Generation',
		name: 'aiMediaGen',
		icon: 'file:ai-media-gen.svg',
		description: 'Generate and edit images using AI models (ModelScope, Nano Banana)',
		version: CONSTANTS.NODE_VERSION,
		group: ['transform'],
		subtitle: '={{$parameter.operation}}',
		defaults: {
			name: 'AI Media Generation',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'modelScopeApi',
				required: true,
				displayOptions: {
					show: {
						operation: ['modelscope'],
					},
				},
			},
			{
				name: 'googlePalmApi',
				required: true,
				displayOptions: {
					show: {
						operation: ['nanoBanana'],
					},
				},
			},
			{
				name: 'doubaoApi',
				required: true,
				displayOptions: {
					show: {
						operation: ['doubao'],
					},
				},
			},
			{
				name: 'openAiApi',
				required: true,
				displayOptions: {
					show: {
						operation: ['sora'],
					},
				},
			},
			{
				name: 'googlePalmApi',
				required: true,
				displayOptions: {
					show: {
						operation: ['veo'],
					},
				},
			},
		],
		properties: [
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			required: true,
			options: [
				{
					name: 'ModelScope',
					value: 'modelscope',
					description: 'Generate and edit images using ModelScope AI models',
				},
				{
					name: 'Nano Banana',
					value: 'nanoBanana',
					description: 'Generate and edit images using Google Nano Banana (Gemini 2.5 Flash)',
				},
				{
					name: 'Doubao',
					value: 'doubao',
					description: 'Generate and edit images using Doubao Seedream AI model',
				},
				{
					name: 'Sora',
					value: 'sora',
					description: 'OpenAI Sora - Text/Image to Video Generation',
				},
				{
					name: 'Veo',
					value: 'veo',
					description: 'Google Veo - Text/Image to Video Generation',
				},
			],
			default: 'modelscope',
			description: 'Select operation to perform',
		},
		{
			displayName: 'Model',
			name: 'model',
			type: 'options',
			required: true,
			options: [
				{
					name: 'Z-Image',
					value: 'Tongyi-MAI/Z-Image',
					description: 'High-quality text-to-image generation model',
				},
				{
					name: 'Qwen-Image-2512',
					value: 'Qwen/Qwen-Image-2512',
					description: 'Advanced text-to-image generation model',
				},
				{
					name: 'Qwen-Image-Edit-2511',
					value: 'Qwen/Qwen-Image-Edit-2511',
					description: 'Image editing model',
				},
			],
			default: 'Tongyi-MAI/Z-Image',
			description: 'Select the AI model to use',
			displayOptions: {
				show: {
					operation: ['modelscope'],
				},
			},
		},
		// Nano Banana - Mode
		{
			displayName: 'Mode',
			name: 'nbMode',
			type: 'options',
			required: true,
			options: [
				{
					name: 'Text to Image',
					value: 'text-to-image',
					description: 'Generate images from text description',
				},
				{
					name: 'Image to Image',
					value: 'image-to-image',
					description: 'Edit images with text instructions',
				},
			],
			default: 'text-to-image',
			description: 'Select generation mode',
			displayOptions: {
				show: {
					operation: ['nanoBanana'],
				},
			},
		},
		// Nano Banana - Model
		{
			displayName: 'Model',
			name: 'nbModel',
			type: 'options',
			required: true,
			options: [
				{
					name: 'Nano Banana',
					value: 'nano-banana',
					description: 'Third-party standard quality model',
				},
				{
					name: 'Nano Banana 2',
					value: 'nano-banana-2',
					description: 'Third-party second generation model',
				},
			],
			default: 'nano-banana-2',
			description: 'Select model to use',
			displayOptions: {
				show: {
					operation: ['nanoBanana'],
				},
			},
		},
		// Nano Banana - Prompt
		{
			displayName: 'Prompt',
			name: 'nbPrompt',
			type: 'string',
			typeOptions: {
				rows: 5,
			},
			default: '',
			required: true,
			description: 'Text description for generation or editing',
			displayOptions: {
				show: {
					operation: ['nanoBanana'],
				},
			},
		},
		// Nano Banana - Reference Images
		{
			displayName: 'Reference Images',
			name: 'nbInputImages',
			type: 'fixedCollection',
			typeOptions: {
				multipleValues: true,
			},
			default: {},
			displayOptions: {
				show: {
					operation: ['nanoBanana'],
					nbMode: ['image-to-image'],
				},
			},
			description: 'Reference images to guide generation (optional, max: 4 for standard models, 14 for Pro models). Supports: URL, base64, or binary property name.',
			options: [
				{
					displayName: 'Image',
					name: 'image',
					values: [
						{
							displayName: 'Image',
							name: 'url',
							type: 'string',
							default: '',
							placeholder: 'https://... or data:image/... or binary property name',
							description: 'Image URL, base64 data, or binary property name',
							typeOptions: {
								rows: 2,
							},
						},
					],
				},
			],
		},
		// Nano Banana - Aspect Ratio
		{
			displayName: 'Aspect Ratio',
			name: 'nbAspectRatio',
			type: 'options',
			default: '1:1',
			options: [
				{ name: '1:1', value: '1:1' },
				{ name: '2:3', value: '2:3' },
				{ name: '3:2', value: '3:2' },
				{ name: '3:4', value: '3:4' },
				{ name: '4:3', value: '4:3' },
				{ name: '4:5', value: '4:5' },
				{ name: '5:4', value: '5:4' },
				{ name: '9:16', value: '9:16' },
				{ name: '16:9', value: '16:9' },
				{ name: '21:9', value: '21:9' },
			],
			description: 'Select aspect ratio',
			displayOptions: {
				show: {
					operation: ['nanoBanana'],
				},
			},
		},
		// Nano Banana - Resolution (for Nano Banana 2)
		{
			displayName: 'Resolution',
			name: 'nbResolution',
			type: 'options',
			default: '1K',
			options: [
				{ name: '1K', value: '1K' },
				{ name: '2K', value: '2K' },
				{ name: '4K', value: '4K' },
			],
			description: 'Select resolution (determines the model to use: 1K=nano-banana-2, 2K=nano-banana-2-2k, 4K=nano-banana-2-4k)',
			displayOptions: {
				show: {
					operation: ['nanoBanana'],
					nbModel: ['nano-banana-2'],
				},
			},
		},
		// Doubao - Mode
		{
			displayName: 'Mode',
			name: 'doubaoMode',
			type: 'options',
			required: true,
			options: [
				{
					name: 'Text to Image',
					value: 'text-to-image',
					description: 'Generate images from text description',
				},
				{
					name: 'Image to Image',
					value: 'image-to-image',
					description: 'Edit images with text instructions',
				},
			],
			default: 'text-to-image',
			description: 'Select generation mode',
			displayOptions: {
				show: {
					operation: ['doubao'],
				},
			},
		},
		// Doubao - Model
		{
			displayName: 'Model',
			name: 'doubaoModel',
			type: 'options',
			required: true,
			options: [
				{
					name: 'Doubao Seedream 4.5',
					value: 'doubao-seedream-4-5-251128',
					description: 'Latest high-quality image generation model (2025-01-28)',
				},
				{
					name: 'Doubao Seedream 4.0',
					value: 'doubao-seedream-4-0-250828',
					description: 'Previous generation model (2024-08-28)',
				},
			],
			default: 'doubao-seedream-4-5-251128',
			description: 'Select Doubao model to use',
			displayOptions: {
				show: {
					operation: ['doubao'],
				},
			},
		},
		// Doubao - Prompt
		{
			displayName: 'Prompt',
			name: 'doubaoPrompt',
			type: 'string',
			typeOptions: {
				rows: 5,
			},
			default: '',
			required: true,
			description: 'Text description for generation or editing',
			displayOptions: {
				show: {
					operation: ['doubao'],
				},
			},
		},
		// Doubao - Reference Images
		{
			displayName: 'Reference Images',
			name: 'doubaoInputImages',
			type: 'fixedCollection',
			typeOptions: {
				multipleValues: true,
			},
			default: {},
			displayOptions: {
				show: {
					operation: ['doubao'],
					doubaoMode: ['image-to-image'],
				},
			},
			description: 'Reference images to guide generation (max: 14 images). Supports: URL, base64, or binary property name.',
			options: [
				{
					displayName: 'Image',
					name: 'image',
					values: [
						{
							displayName: 'Image',
							name: 'url',
							type: 'string',
							default: '',
							placeholder: 'https://... or data:image/... or binary property name',
							description: 'Image URL, base64 data, or binary property name',
							typeOptions: {
								rows: 2,
							},
						},
					],
				},
			],
		},
		// Doubao - Resolution Level
		{
			displayName: 'Resolution Level',
			name: 'doubaoResolutionLevel',
			type: 'options',
			default: '2K',
			options: [
				{ name: '2K', value: '2K' },
				{ name: '4K', value: '4K' },
			],
			description: 'Select resolution level',
			displayOptions: {
				show: {
					operation: ['doubao'],
				},
			},
		},
		// Doubao - Size (2K)
		{
			displayName: 'Size',
			name: 'doubaoSize2K',
			type: 'options',
			default: '2048x2048',
			options: [
				{ name: '1:1 (2048x2048)', value: '2048x2048' },
				{ name: '4:3 (2304x1728)', value: '2304x1728' },
				{ name: '3:4 (1728x2304)', value: '1728x2304' },
				{ name: '16:9 (2560x1440)', value: '2560x1440' },
				{ name: '9:16 (1440x2560)', value: '1440x2560' },
				{ name: '3:2 (2496x1664)', value: '2496x1664' },
				{ name: '2:3 (1664x2496)', value: '1664x2496' },
				{ name: '21:9 (3024x1296)', value: '3024x1296' },
			],
			description: 'Image size and aspect ratio (2K)',
			displayOptions: {
				show: {
					operation: ['doubao'],
					doubaoResolutionLevel: ['2K'],
				},
			},
		},
		// Doubao - Size (4K)
		{
			displayName: 'Size',
			name: 'doubaoSize4K',
			type: 'options',
			default: '4096x4096',
			options: [
				{ name: '1:1 (4096x4096)', value: '4096x4096' },
				{ name: '4:3 (4608x3456)', value: '4608x3456' },
				{ name: '3:4 (3456x4608)', value: '3456x4608' },
				{ name: '16:9 (5120x2880)', value: '5120x2880' },
				{ name: '9:16 (2880x5120)', value: '2880x5120' },
				{ name: '3:2 (4992x3328)', value: '4992x3328' },
				{ name: '2:3 (3328x4992)', value: '3328x4992' },
				{ name: '21:9 (6048x2592)', value: '6048x2592' },
			],
			description: 'Image size and aspect ratio (4K)',
			displayOptions: {
				show: {
					operation: ['doubao'],
					doubaoResolutionLevel: ['4K'],
				},
			},
		},
		// Doubao - Seed
		{
			displayName: 'Seed',
			name: 'doubaoSeed',
			type: 'number',
			default: -1,
			typeOptions: {
				minValue: -1,
				maxValue: 4294967295,
			},
			description: 'Random seed for generation (-1 for random)',
			displayOptions: {
				show: {
					operation: ['doubao'],
				},
			},
		},
		// Sora - Model
		{
			displayName: 'Sora Model',
			name: 'soraModel',
			type: 'options',
			displayOptions: {
				show: {
					operation: ['sora'],
				},
			},
			options: [
				{
					name: 'Sora 2',
					value: 'sora-2',
					description: 'Standard quality (faster, 1-3 min for 10s video)',
				},
				{
					name: 'Sora 2 Pro',
					value: 'sora-2-pro',
					description: 'High quality (slower, better details)',
				},
			],
			default: 'sora-2',
		},
		// Sora - Prompt
		{
			displayName: 'Prompt',
			name: 'soraPrompt',
			type: 'string',
			typeOptions: {
				rows: 5,
			},
			displayOptions: {
				show: {
					operation: ['sora'],
				},
			},
			default: '',
			required: true,
			description: 'Describe the video you want to generate (e.g., "A drone shot of a coastal cliff at sunrise, camera slowly ascending")',
		},
		// Sora - Aspect Ratio
		{
			displayName: 'Aspect Ratio',
			name: 'soraAspectRatio',
			type: 'options',
			displayOptions: {
				show: {
					operation: ['sora'],
				},
			},
			options: [
				{ name: '16:9', value: '16:9' },
				{ name: '3:2', value: '3:2' },
				{ name: '1:1', value: '1:1' },
				{ name: '9:16', value: '9:16' },
				{ name: '2:3', value: '2:3' },
			],
			default: '16:9',
			description: 'Video aspect ratio',
		},
		// Sora - Duration (Sora 2)
		{
			displayName: 'Duration',
			name: 'soraDuration',
			type: 'options',
			displayOptions: {
				show: {
					operation: ['sora'],
					soraModel: ['sora-2'],
				},
			},
			options: [
				{ name: '5 seconds', value: '5' },
				{ name: '10 seconds', value: '10' },
				{ name: '15 seconds', value: '15' },
				{ name: '20 seconds', value: '20' },
			],
			default: '5',
			description: 'Video duration in seconds (Sora 2 supports up to 20s)',
		},
		// Sora - Duration (Sora 2 Pro)
		{
			displayName: 'Duration',
			name: 'soraDurationPro',
			type: 'options',
			displayOptions: {
				show: {
					operation: ['sora'],
					soraModel: ['sora-2-pro'],
				},
			},
			options: [
				{ name: '5 seconds', value: '5' },
				{ name: '10 seconds', value: '10' },
				{ name: '15 seconds', value: '15' },
				{ name: '20 seconds', value: '20' },
				{ name: '25 seconds', value: '25' },
			],
			default: '5',
			description: 'Video duration in seconds (Sora 2 Pro supports up to 25s)',
		},
		// Sora - HD
		{
			displayName: 'High Definition (HD)',
			name: 'soraHd',
			type: 'boolean',
			default: false,
			displayOptions: {
				show: {
					operation: ['sora'],
					soraModel: ['sora-2-pro'],
				},
			},
			description: 'Generate in HD quality (Sora 2 Pro only)',
		},
		// Sora - Input Image
		{
			displayName: 'Input Image',
			name: 'soraInputImage',
			type: 'string',
			displayOptions: {
				show: {
					operation: ['sora'],
				},
			},
			default: '',
			description: 'Reference image for image-to-video. Supports: URL, base64, or binary property name',
		},
		// Sora - Output Mode
		{
			displayName: 'Output Mode',
			name: 'soraOutputMode',
			type: 'options',
			displayOptions: {
				show: {
					operation: ['sora'],
				},
			},
			options: [
				{
					name: 'URL Only',
					value: 'url',
					description: 'Return download URL only (link expires in 1 hour, recommended for large videos)',
				},
				{
					name: 'Binary Data',
					value: 'binary',
					description: 'Download and include video file (may cause memory issues for large videos)',
				},
			],
			default: 'url',
			required: true,
			description: 'Choose how to receive the generated video',
		},
		// Veo - Mode
		{
			displayName: 'Mode',
			name: 'veoMode',
			type: 'options',
			options: [
				{ name: 'Text to Video', value: 'text-to-video' },
				{ name: 'Image to Video', value: 'image-to-video' },
			],
			default: 'text-to-video',
			displayOptions: {
				show: {
					operation: ['veo'],
				},
			},
			description: 'Select generation mode',
		},
		// Veo - Model
		{
			displayName: 'Model',
			name: 'veoModel',
			type: 'options',
			options: [
				{
					name: 'Veo 3.1 Fast',
					value: 'veo3.1-fast',
					description: 'Fast mode, cost-effective',
				},
				{
					name: 'Veo 3.1 Pro',
					value: 'veo3.1-pro',
					description: 'High quality mode',
				},
				{
					name: 'Veo 3.1',
					value: 'veo3.1',
					description: 'Standard mode',
				},
				{
					name: 'Veo 3.1 Components',
					value: 'veo3.1-components',
					description: 'Multi-image reference (1-3 images)',
				},
			],
			default: 'veo3.1-fast',
			displayOptions: {
				show: {
					operation: ['veo'],
				},
			},
			description: 'Select Veo model',
		},
		// Veo - Prompt
		{
			displayName: 'Prompt',
			name: 'veoPrompt',
			type: 'string',
			typeOptions: {
				rows: 5,
			},
			displayOptions: {
				show: {
					operation: ['veo'],
				},
			},
			default: '',
			required: true,
			description: 'Describe the video you want to generate (e.g., "A cinematic drone shot of a mountain range at sunset")',
		},
		// Veo - Input Images
		{
			displayName: 'Input Images',
			name: 'veoInputImages',
			type: 'fixedCollection',
			typeOptions: {
				multipleValues: true,
			},
			displayOptions: {
				show: {
					operation: ['veo'],
					veoMode: ['image-to-video'],
				},
			},
			default: {},
			description: 'Reference images for image-to-video (1-3 images)',
			options: [
				{
					displayName: 'Image',
					name: 'image',
					values: [
						{
							displayName: 'Image',
							name: 'url',
							type: 'string',
							default: '',
						},
					],
				},
			],
		},
		// Veo - Aspect Ratio
		{
			displayName: 'Aspect Ratio',
			name: 'veoAspectRatio',
			type: 'options',
			displayOptions: {
				show: {
					operation: ['veo'],
				},
			},
			options: [
				{ name: '16:9', value: '16:9' },
				{ name: '9:16', value: '9:16' },
			],
			default: '16:9',
			description: 'Video aspect ratio (auto-detected from image if not specified)',
		},
		// Veo - Enhance Prompt
		{
			displayName: 'Enhance Prompt',
			name: 'veoEnhancePrompt',
			type: 'boolean',
			default: false,
			displayOptions: {
				show: {
					operation: ['veo'],
				},
			},
			description: 'Let AI enhance your prompt for better results',
		},
		// Veo - Enable Upsample (4K)
		{
			displayName: 'Enable 4K (Upsample)',
			name: 'veoEnableUpsample',
			type: 'boolean',
			default: false,
			displayOptions: {
				show: {
					operation: ['veo'],
					veoModel: ['veo3.1-pro', 'veo3.1-components', 'veo3.1'],
				},
			},
			description: 'Enable 4K resolution upscaling (not available for veo3.1-fast)',
		},
		// Veo - Output Mode
		{
			displayName: 'Output Mode',
			name: 'veoOutputMode',
			type: 'options',
			displayOptions: {
				show: {
					operation: ['veo'],
				},
			},
			options: [
				{
					name: 'URL Only',
					value: 'url',
					description: 'Return download URL only (recommended for large videos)',
				},
				{
					name: 'Binary Data',
					value: 'binary',
					description: 'Download and include video file (may cause memory issues for large videos)',
				},
			],
			default: 'url',
			required: true,
			description: 'Choose how to receive the generated video',
		},
		// Prompt - shown for all models
		{
			displayName: 'Prompt',
			name: 'prompt',
			type: 'string',
			typeOptions: {
				rows: CONSTANTS.UI.TEXT_AREA_ROWS.PROMPT,
			},
			default: '',
			required: true,
			description: 'Text description for generation or editing',
			displayOptions: {
				show: {
					operation: ['modelscope'],
				},
			},
		},
		// Input Image Type - only for Edit model
		{
			displayName: 'Input Image Type',
			name: 'inputImageType',
			type: 'options',
			default: 'url',
			options: [
				{ name: 'URL / Base64', value: 'url' },
				{ name: 'Binary File', value: 'binary' },
			],
			description: 'Choose how to provide the input image',
			displayOptions: {
				show: {
					operation: ['modelscope'],
					model: ['Qwen/Qwen-Image-Edit-2511'],
				},
			},
		},
		// Input Image URL/Base64 - only for Edit model
		{
			displayName: 'Input Image',
			name: 'inputImage',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					operation: ['modelscope'],
					model: ['Qwen/Qwen-Image-Edit-2511'],
					inputImageType: ['url'],
				},
			},
			description: 'URL or base64 of the image to edit',
			placeholder: 'https://example.com/image.jpg or data:image/jpeg;base64,...',
		},
		// Input Image Binary File - only for Edit model
		{
			displayName: 'Input Image File',
			name: 'inputImageBinary',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					operation: ['modelscope'],
					model: ['Qwen/Qwen-Image-Edit-2511'],
					inputImageType: ['binary'],
				},
			},
			description: 'Binary property containing the image file to edit',
			placeholder: 'Enter a property name containing the binary data, e.g., data',
		},
		// Size for Z-Image (max 2k, various aspect ratios - high resolution only)
		{
			displayName: 'Size',
			name: 'sizeZImage',
			type: 'options',
			default: '1440x1440',
			options: [
				{ name: '16:9 (1920x1080)', value: '1920x1080' },
				{ name: '4:3 (1440x1080)', value: '1440x1080' },
				{ name: '1:1 (1440x1440)', value: '1440x1440' },
				{ name: '3:4 (1080x1440)', value: '1080x1440' },
				{ name: '9:16 (1080x1920)', value: '1080x1920' },
			],
			description: 'Image size (1080p, various aspect ratios: 16:9, 4:3, 1:1, 3:4, 9:16)',
			displayOptions: {
				show: {
					operation: ['modelscope'],
					model: ['Tongyi-MAI/Z-Image'],
				},
			},
		},
		// Size for Qwen-Image-2512 (aspect ratio based sizes)
		{
			displayName: 'Size',
			name: 'sizeQwen',
			type: 'options',
			default: '1328x1328',
			options: [
				{ name: '1:1 (1328x1328)', value: '1328x1328' },
				{ name: '16:9 (1664x928)', value: '1664x928' },
				{ name: '9:16 (928x1664)', value: '928x1664' },
				{ name: '4:3 (1472x1104)', value: '1472x1104' },
				{ name: '3:4 (1104x1472)', value: '1104x1472' },
				{ name: '3:2 (1584x1056)', value: '1584x1056' },
				{ name: '2:3 (1056x1584)', value: '1056x1584' },
			],
			description: 'Image size with various aspect ratios',
			displayOptions: {
				show: {
					operation: ['modelscope'],
					model: ['Qwen/Qwen-Image-2512'],
				},
			},
		},
		{
			displayName: 'Seed',
			name: 'seed',
			type: 'number',
			default: 0,
			description: 'Random seed for reproducibility (0 = random)',
			displayOptions: {
				show: {
					operation: ['modelscope'],
					model: ['Tongyi-MAI/Z-Image', 'Qwen/Qwen-Image-2512', 'Qwen/Qwen-Image-Edit-2511'],
				},
			},
		},
		{
			displayName: 'Steps',
			name: 'steps',
			type: 'number',
			default: 30,
			typeOptions: {
				minValue: 1,
				maxValue: 100,
			},
			description: 'Number of sampling steps for generation (1-100, default: 30)',
			displayOptions: {
				show: {
					operation: ['modelscope'],
					model: ['Tongyi-MAI/Z-Image', 'Qwen/Qwen-Image-2512', 'Qwen/Qwen-Image-Edit-2511'],
				},
			},
		},
		{
			displayName: 'Number of Images',
			name: 'numImages',
			type: 'number',
			default: 1,
			typeOptions: {
				minValue: 1,
				maxValue: 4,
			},
			description: 'Number of images to generate (1-4)',
			displayOptions: {
				show: {
					operation: ['modelscope'],
					model: ['Tongyi-MAI/Z-Image', 'Qwen/Qwen-Image-2512'],
				},
			},
		},
			// Options
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						type: 'number',
						typeOptions: {
							minValue: CONSTANTS.RETRY.MIN,
							maxValue: CONSTANTS.RETRY.MAX,
						},
						default: CONSTANTS.DEFAULTS.MAX_RETRIES,
						description: 'Maximum number of retry attempts for failed requests',
					},
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: CONSTANTS.TIMEOUT.MIN_MS,
							maxValue: CONSTANTS.TIMEOUT.MAX_MS,
						},
						default: CONSTANTS.DEFAULTS.TIMEOUT_MS,
						description: 'Request timeout in milliseconds',
					},
					{
						displayName: 'Enable Caching',
						name: 'enableCache',
						type: 'boolean',
						default: true,
						description: 'Enable result caching to reduce API calls',
					},
					{
						displayName: 'Cache TTL (seconds)',
						name: 'cacheTtl',
						type: 'number',
						typeOptions: {
							minValue: CONSTANTS.CACHE.MIN_TTL_SECONDS,
							maxValue: CONSTANTS.CACHE.MAX_TTL_SECONDS,
						},
						default: CONSTANTS.DEFAULTS.CACHE_TTL_SECONDS,
						description: 'Cache time-to-live in seconds',
						displayOptions: {
							show: {
								enableCache: [true],
							},
						},
					},
				],
			},
		],
	};

	/**
	 * Executes the AI media generation node
	 *
	 * Processes input items and generates/edits images using ModelScope AI models or Nano Banana.
	 * Each item can have different parameters (model, size, etc.).
	 * Supports caching to reduce API calls for identical requests.
	 *
	 * @param this - n8n execution context
	 * @returns Promise resolving to array of execution data
	 * @throws NodeOperationError when execution fails and continueOnFail is false
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		// Safely get enableCache with try-catch
		let enableCache = true;
		try {
			enableCache = this.getNodeParameter('options.enableCache', CONSTANTS.INDICES.FIRST_ITEM) as boolean;
		} catch (error) {
			// If options doesn't exist, use default
			this.logger?.debug('Options not set, using default enableCache=true');
			enableCache = true;
		}

		const cacheManager = new CacheManager();
		const performanceMonitor = new PerformanceMonitor();

		this.logger?.info('Starting AI Media Generation execution', {
			itemCount: items.length,
			enableCache,
		});

		for (let i = 0; i < items.length; i++) {
			try {
				this.logger?.debug('Processing item', { index: i });

				// Get operation first
				const operation = this.getNodeParameter('operation', i) as string;

				let result: INodeExecutionData;

				if (operation === 'doubao') {
					// Handle Doubao operation
					const credentials = await this.getCredentials<DoubaoApiCredentials>('doubaoApi');
					if (!credentials || !credentials.apiKey) {
						throw new NodeOperationError(
							this.getNode(),
							'API Key is required. Please configure your Doubao API credentials.',
							{ itemIndex: i }
						);
					}

					const timerId = performanceMonitor.startTimer('doubao');

					// Check cache if enabled
					if (enableCache) {
						const model = this.getNodeParameter('doubaoModel', i) as string;
						const mode = this.getNodeParameter('doubaoMode', i) as string;
						const prompt = this.getNodeParameter('doubaoPrompt', i) as string;

						// Build cache parameters
						const cacheParams: Record<string, unknown> = {
							mode,
							model,
						};

						// Add resolution level and size
						try {
							const resolutionLevel = this.getNodeParameter('doubaoResolutionLevel', i) as string || '2K';
							cacheParams.resolutionLevel = resolutionLevel;

							if (resolutionLevel === '2K') {
								cacheParams.size = this.getNodeParameter('doubaoSize2K', i) || '2048x2048';
							} else {
								cacheParams.size = this.getNodeParameter('doubaoSize4K', i) || '4096x4096';
							}
						} catch (error) {
							cacheParams.resolutionLevel = '2K';
							cacheParams.size = '2048x2048';
						}

						// Add seed
						try {
							cacheParams.seed = this.getNodeParameter('doubaoSeed', i);
						} catch (error) {
							cacheParams.seed = -1;
						}

						// Add input images for image-to-image mode
						if (mode === 'image-to-image') {
							try {
								const imagesData = this.getNodeParameter('doubaoInputImages', i) as {
									image?: Array<{ url: string }>;
								};
								if (imagesData.image && imagesData.image.length > 0) {
									// Validate max images for cache
									const maxImages = 14;
									if (imagesData.image.length > maxImages) {
										this.logger?.warn('[Doubao] Image count exceeds maximum for cache', {
											count: imagesData.image.length,
											max: maxImages,
										});
									}
									// Create hash of all image URLs for cache key
									cacheParams.images = imagesData.image.map(img => img.url).join('|');
									cacheParams.imageCount = imagesData.image.length;
								}
							} catch (error) {
								// No reference images
								this.logger?.debug('[Doubao] No reference images for cache', {
									error: error instanceof Error ? error.message : String(error),
								});
							}
						}

						const cacheKey = CacheKeyGenerator.forGeneration(
							'doubao',
							model,
							prompt,
							cacheParams
						);
						const cached = await cacheManager.get(cacheKey);

						if (cached) {
							this.logger?.info('Cache hit', { model, cacheKey });
							result = {
								json: {
									success: true,
									...cached as Record<string, unknown>,
									_metadata: {
										model,
										cached: true,
										timestamp: new Date().toISOString(),
									},
								},
							};
						} else {
							this.logger?.info('Cache miss', { model, cacheKey });
							result = await AIMediaGen.executeDoubaoRequest(this, i, credentials);

							// Safely get cacheTtl
							let cacheTtl: number = CONSTANTS.DEFAULTS.CACHE_TTL_SECONDS;
							try {
								cacheTtl = this.getNodeParameter('options.cacheTtl', i) as number;
							} catch (error) {
								this.logger?.debug('Options cacheTtl not set, using default', {
									index: i,
									defaultValue: CONSTANTS.DEFAULTS.CACHE_TTL_SECONDS
								});
								cacheTtl = CONSTANTS.DEFAULTS.CACHE_TTL_SECONDS;
							}

							if (result.json.success) {
								await cacheManager.set(cacheKey, result.json, cacheTtl);
							}
						}
					} else {
						result = await AIMediaGen.executeDoubaoRequest(this, i, credentials);
					}

					const elapsed = performanceMonitor.endTimer(timerId);

					performanceMonitor.recordMetric({
						timestamp: Date.now().toString(),
						provider: 'doubao',
						model: result.json.model as string,
						mediaType: 'image',
						duration: elapsed,
						success: result.json.success as boolean,
						fromCache: (result.json._metadata as ResultMetadata)?.cached || false,
					});

					this.logger?.info('Execution completed', {
						model: result.json.model,
						duration: elapsed,
						success: result.json.success,
					});

					results.push(result);
				} else if (operation === 'nanoBanana') {
					// Handle Nano Banana operation
					const credentials = await this.getCredentials<GooglePalmApiCredentials>('googlePalmApi');
					if (!credentials || !credentials.apiKey) {
						throw new NodeOperationError(
							this.getNode(),
							'API Key is required. Please configure your Google Gemini (PaLM) API credentials.',
							{ itemIndex: i }
						);
					}

					const timerId = performanceMonitor.startTimer('nanoBanana');

					// Check cache if enabled
					if (enableCache) {
						const model = this.getNodeParameter('nbModel', i) as string;
						const mode = this.getNodeParameter('nbMode', i) as string;
						const prompt = this.getNodeParameter('nbPrompt', i) as string;

						// Build cache parameters
						const cacheParams: Record<string, unknown> = {
							mode,
							model,
						};

						// Add parameters based on model type
						if (model === 'nano-banana-2') {
							cacheParams.aspectRatio = this.getNodeParameter('nbAspectRatio', i);
							cacheParams.resolution = this.getNodeParameter('nbResolution', i);
						} else {
							cacheParams.aspectRatio = this.getNodeParameter('nbAspectRatio', i);
						}

						// Add reference images (if any)
						if (mode === 'image-to-image') {
							const imagesData = this.getNodeParameter('nbInputImages', i) as {
								image?: Array<{ url: string }>;
							};
							if (imagesData.image && imagesData.image.length > 0) {
								cacheParams.images = imagesData.image.map(img => img.url).join('|');
							}
						}

						const cacheKey = CacheKeyGenerator.forGeneration(
							'nanoBanana',
							model,
							prompt,
							cacheParams
						);
						const cached = await cacheManager.get(cacheKey);

						if (cached) {
							this.logger?.info('Cache hit', { model, cacheKey });
							result = {
								json: {
									success: true,
									...cached as Record<string, unknown>,
									_metadata: {
										model,
										cached: true,
										timestamp: new Date().toISOString(),
									},
								},
							};
						} else {
							this.logger?.info('Cache miss', { model, cacheKey });
							result = await AIMediaGen.executeNanoBananaRequest(this, i, credentials);

							// Safely get cacheTtl
							let cacheTtl: number = CONSTANTS.DEFAULTS.CACHE_TTL_SECONDS;
							try {
								cacheTtl = this.getNodeParameter('options.cacheTtl', i) as number;
							} catch (error) {
								this.logger?.debug('Options cacheTtl not set, using default', {
									index: i,
									defaultValue: CONSTANTS.DEFAULTS.CACHE_TTL_SECONDS
								});
								cacheTtl = CONSTANTS.DEFAULTS.CACHE_TTL_SECONDS;
							}

							if (result.json.success) {
								await cacheManager.set(cacheKey, result.json, cacheTtl);
							}
						}
					} else {
						result = await AIMediaGen.executeNanoBananaRequest(this, i, credentials);
					}

					const elapsed = performanceMonitor.endTimer(timerId);

					performanceMonitor.recordMetric({
						timestamp: Date.now().toString(),
						provider: 'nanoBanana',
						model: result.json.model as string,
						mediaType: 'image',
						duration: elapsed,
						success: result.json.success as boolean,
						fromCache: (result.json._metadata as ResultMetadata)?.cached || false,
					});

					this.logger?.info('Execution completed', {
						model: result.json.model,
						duration: elapsed,
						success: result.json.success,
					});

					results.push(result);
				} else if (operation === 'sora') {
					// Handle Sora operation
					const credentials = await this.getCredentials<OpenAiApiCredentials>('openAiApi');
					if (!credentials || !credentials.apiKey) {
						throw new NodeOperationError(
							this.getNode(),
							'API Key is required. Please configure your OpenAI API credentials.',
							{ itemIndex: i }
						);
					}

					const timerId = performanceMonitor.startTimer('sora');

					// Sora doesn't support caching due to async generation
					result = await AIMediaGen.executeSoraRequest(this, i, credentials);

					const elapsed = performanceMonitor.endTimer(timerId);

					performanceMonitor.recordMetric({
						timestamp: Date.now().toString(),
						provider: 'sora',
						model: result.json.model as string,
						mediaType: 'video',
						duration: elapsed,
						success: result.json.success as boolean,
						fromCache: false,
					});

					this.logger?.info('Execution completed', {
						model: result.json.model,
						duration: elapsed,
						success: result.json.success,
					});

					results.push(result);
				} else if (operation === 'veo') {
					// Handle Veo operation
					const credentials = await this.getCredentials<GooglePalmApiCredentials>('googlePalmApi');
					if (!credentials || !credentials.apiKey) {
						throw new NodeOperationError(
							this.getNode(),
							'API Key is required. Please configure your Google Gemini (PaLM) API credentials.',
							{ itemIndex: i }
						);
					}

					const timerId = performanceMonitor.startTimer('veo');
					result = await AIMediaGen.executeVeoRequest(this, i, credentials);

					const elapsed = performanceMonitor.endTimer(timerId);

					performanceMonitor.recordMetric({
						timestamp: Date.now().toString(),
						provider: 'veo',
						model: result.json.model as string,
						mediaType: 'video',
						duration: elapsed,
						success: result.json.success as boolean,
						fromCache: false,
					});

					this.logger?.info('Execution completed', {
						model: result.json.model,
						duration: elapsed,
						success: result.json.success,
					});

					results.push(result);
				} else {
					// Handle ModelScope operation
					const credentials = await this.getCredentials<ModelScopeApiCredentials>('modelScopeApi');
					if (!credentials || !credentials.apiKey) {
						throw new NodeOperationError(
							this.getNode(),
							'API Key is required. Please configure your ModelScope API credentials.',
							{ itemIndex: i }
						);
					}

					const timerId = performanceMonitor.startTimer('aiMediaGen');

					// Get model first to determine which parameters to access
					const model = this.getNodeParameter('model', i) as string;
					this.logger?.info('[AI Media Gen] Processing item', { index: i, model });

					// Determine model type
					const isEditModel = model === 'Qwen/Qwen-Image-Edit-2511';
					const isZImage = model === 'Tongyi-MAI/Z-Image';
					const isQwenImage = model === 'Qwen/Qwen-Image-2512';

					// Get parameters based on model type with safe defaults
					let size = '1024x1024';
					let seed = 0;
					let steps = 30;
					let numImages = 1;
					let inputImage = '';

					// Get size for generation models only (Edit model doesn't use size)
					if (!isEditModel) {
						try {
							// Use different parameter names for different models to avoid conflicts
							if (isZImage) {
								size = this.getNodeParameter('sizeZImage', i) as string;
							} else if (isQwenImage) {
								size = this.getNodeParameter('sizeQwen', i) as string;
							} else {
								size = this.getNodeParameter('size', i) as string;
							}
						} catch (error) {
							size = isZImage ? '1440x1440' : '1328x1328';
							this.logger?.debug('[AI Media Gen] Using default size', { index: i, size });
						}
					}

					// Get seed for all models (Z-Image, Qwen-2512, Edit-2511)
					try {
						seed = this.getNodeParameter('seed', i) as number;
					} catch (error) {
						this.logger?.debug('[AI Media Gen] Using default seed', { index: i, seed });
					}

					// Get steps for all models (Z-Image, Qwen-2512, Edit-2511)
					try {
						steps = this.getNodeParameter('steps', i) as number;
					} catch (error) {
						this.logger?.debug('[AI Media Gen] Using default steps', { index: i, steps });
					}

					// Get numImages only for Z-Image and Qwen-2512
					if (isZImage || isQwenImage) {
						try {
							numImages = this.getNodeParameter('numImages', i) as number;
						} catch (error) {
							this.logger?.debug('[AI Media Gen] Using default numImages', { index: i, numImages });
						}
					}

					// Get inputImage only for Edit model
					if (isEditModel) {
						try {
							const inputImageType = this.getNodeParameter('inputImageType', i) as string;
							if (inputImageType === 'binary') {
								// Get from binary data
								const binaryPropertyName = this.getNodeParameter('inputImageBinary', i) as string;
								const items = this.getInputData();
								const item = items[i];
								const binaryData = item.binary;

								if (binaryData && binaryData[binaryPropertyName]) {
									const binary = binaryData[binaryPropertyName] as { data: string; mimeType: string };
									inputImage = `data:${binary.mimeType || 'image/jpeg'};base64,${binary.data}`;
								} else {
									this.logger?.warn('[AI Media Gen] Binary data not found', { binaryPropertyName, availableKeys: Object.keys(binaryData || {}) });
								}
							} else {
								// Get from URL/Base64
								inputImage = this.getNodeParameter('inputImage', i) as string || '';
							}

							if (!inputImage) {
								this.logger?.warn('[AI Media Gen] Input image not found for Edit model', { inputImageType });
							}
						} catch (error) {
							this.logger?.warn('[AI Media Gen] Failed to get inputImage for Edit model', { index: i, error });
						}
					}

					// Safely get timeout with try-catch
					let timeout: number = CONSTANTS.DEFAULTS.TIMEOUT_MS;
					try {
						timeout = this.getNodeParameter('options.timeout', i) as number;
					} catch (error) {
						this.logger?.debug('Options timeout not set, using default', {
							index: i,
							defaultValue: CONSTANTS.DEFAULTS.TIMEOUT_MS
						});
						timeout = CONSTANTS.DEFAULTS.TIMEOUT_MS;
					}

					if (enableCache) {
						const prompt = this.getNodeParameter('prompt', i) as string || '';

						// Build cache parameters based on model type
						const cacheParams: Record<string, unknown> = {
							size: size || '1024x1024',
							seed: seed || 0,
						};

						// Only include num_images for models that support it
						if (isZImage || isQwenImage) {
							cacheParams.num_images = numImages || 1;
						}

						// Only include input_image for Edit model
						if (isEditModel) {
							cacheParams.input_image = inputImage;
						}

						const cacheKey = CacheKeyGenerator.forGeneration(
							'modelscope',
							model,
							prompt,
							cacheParams
						);
						const cached = await cacheManager.get(cacheKey);

						if (cached) {
							this.logger?.info('Cache hit', { model, cacheKey });
							result = {
								json: {
									success: true,
									...cached as Record<string, unknown>,
									_metadata: {
										model,
										cached: true,
										timestamp: new Date().toISOString(),
									},
								},
							};
						} else {
							this.logger?.info('Cache miss', { model, cacheKey });
							result = await AIMediaGen.executeModelRequest(this, i, credentials, timeout);

							// Safely get cacheTtl
							let cacheTtl: number = CONSTANTS.DEFAULTS.CACHE_TTL_SECONDS;
							try {
								cacheTtl = this.getNodeParameter('options.cacheTtl', i) as number;
							} catch (error) {
								this.logger?.debug('Options cacheTtl not set, using default', {
									index: i,
									defaultValue: CONSTANTS.DEFAULTS.CACHE_TTL_SECONDS
								});
								cacheTtl = CONSTANTS.DEFAULTS.CACHE_TTL_SECONDS;
							}

							if (result.json.success) {
								await cacheManager.set(cacheKey, result.json, cacheTtl);
							}
						}
					} else {
						result = await AIMediaGen.executeModelRequest(this, i, credentials, timeout);
					}

					const elapsed = performanceMonitor.endTimer(timerId);

					performanceMonitor.recordMetric({
						timestamp: Date.now().toString(),
						provider: 'modelScope',
						model,
						mediaType: 'image',
						duration: elapsed,
						success: result.json.success as boolean,
						fromCache: (result.json._metadata as ResultMetadata)?.cached || false,
					});

					this.logger?.info('Execution completed', {
						model,
						duration: elapsed,
						success: result.json.success,
					});

					results.push(result);
				}
			} catch (error) {
				const errorCode = error instanceof MediaGenError ? error.code : 'UNKNOWN';
				const errorDetails = error instanceof MediaGenError ? error.details : undefined;

				// Get operation for error logging
				const operation = this.getNodeParameter('operation', i) as string;

				let model: string;
				if (operation === 'nanoBanana') {
					model = this.getNodeParameter('nbModel', i) as string;
				} else if (operation === 'doubao') {
					model = this.getNodeParameter('doubaoModel', i) as string;
				} else if (operation === 'sora') {
					model = this.getNodeParameter('soraModel', i) as string;
				} else if (operation === 'veo') {
					model = this.getNodeParameter('veoModel', i) as string;
				} else {
					model = this.getNodeParameter('model', i) as string;
				}

				this.logger?.error('Execution failed', {
					operation,
					model,
					error: error instanceof Error ? error.message : String(error),
					errorCode,
					errorDetails,
				});

				results.push({
					json: {
						success: false,
						error: error instanceof Error ? error.message : String(error),
						errorCode,
						_metadata: {
							timestamp: new Date().toISOString(),
						},
					},
				});

				if (this.continueOnFail()) {
					continue;
				}
				throw error;
			}
		}

		return [this.helpers.constructExecutionMetaData(results, { itemData: { item: 0 } })];
	}

	/**
	 * Executes a model request for a single item
	 *
	 * Validates parameters, builds the request, and calls the ModelScope API.
	 * Implements retry logic for transient failures.
	 *
	 * @param context - n8n execution context
	 * @param itemIndex - Index of the item being processed
	 * @param credentials - API credentials
	 * @param timeout - Request timeout in milliseconds
	 * @returns Promise resolving to execution data with generated image URL
	 * @throws NodeOperationError for validation errors
	 * @throws MediaGenError for API errors
	 */
	private static async executeModelRequest(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials: ModelScopeApiCredentials,
		timeout: number
	): Promise<INodeExecutionData> {
		context.logger?.info('[AI Media Gen] Starting model request', { itemIndex });

		const model = context.getNodeParameter('model', itemIndex) as string;
		context.logger?.info('[AI Media Gen] Model selected', { model, itemIndex });

		const prompt = context.getNodeParameter('prompt', itemIndex) as string;
		context.logger?.info('[AI Media Gen] Prompt retrieved', { promptLength: prompt?.length, itemIndex });

		// Safely get maxRetries
		let maxRetries: number = CONSTANTS.DEFAULTS.MAX_RETRIES;
		try {
			maxRetries = context.getNodeParameter('options.maxRetries', itemIndex) as number;
		} catch (error) {
			context.logger?.warn('[AI Media Gen] Could not get maxRetries, using default', {
				itemIndex,
				defaultValue: CONSTANTS.DEFAULTS.MAX_RETRIES
			});
		}

		// Get steps for all models that support it
		const isEditModel = model === 'Qwen/Qwen-Image-Edit-2511';
		const isZImage = model === 'Tongyi-MAI/Z-Image';
		const isQwenImage = model === 'Qwen/Qwen-Image-2512';

		// Get parameters based on model type with safe defaults
		let size = '1024x1024';
		let seed = 0;
		let steps = 30;
		let numImages = 1;
		let inputImage = '';

		// Get size for generation models only (Edit model doesn't use size)
		if (!isEditModel) {
			try {
				// Use different parameter names for different models to avoid conflicts
				if (isZImage) {
					size = context.getNodeParameter('sizeZImage', itemIndex) as string;
				} else if (isQwenImage) {
					size = context.getNodeParameter('sizeQwen', itemIndex) as string;
				} else {
					size = context.getNodeParameter('size', itemIndex) as string;
				}
				context.logger?.info('[AI Media Gen] Size retrieved', { size, itemIndex });
			} catch (error) {
				// Use default size if parameter not set
				size = isZImage ? '1440x1440' : '1328x1328';
				context.logger?.warn('[AI Media Gen] Could not get size, using default', { size, itemIndex });
			}
		}

		// Get seed for all models (Z-Image, Qwen-2512, Edit-2511)
		try {
			seed = context.getNodeParameter('seed', itemIndex) as number;
			context.logger?.info('[AI Media Gen] Seed retrieved', { seed, itemIndex });
		} catch (error) {
			seed = 0;
			context.logger?.warn('[AI Media Gen] Could not get seed, using default', { seed, itemIndex });
		}

		// Get steps for all models (Z-Image, Qwen-2512, Edit-2511)
		try {
			steps = context.getNodeParameter('steps', itemIndex) as number;
			context.logger?.info('[AI Media Gen] Steps retrieved', { steps, itemIndex });
		} catch (error) {
			steps = 30;
			context.logger?.warn('[AI Media Gen] Could not get steps, using default', { steps, itemIndex });
		}

		// Get numImages for models that support it
		if (isZImage || isQwenImage) {
			try {
				numImages = context.getNodeParameter('numImages', itemIndex) as number;
				context.logger?.info('[AI Media Gen] NumImages retrieved', { numImages, itemIndex });
			} catch (error) {
				numImages = 1;
				context.logger?.warn('[AI Media Gen] Could not get numImages, using default', { numImages, itemIndex });
			}
		}

		// Get input image based on type
		if (isEditModel) {
			context.logger?.info('[AI Media Gen] Getting input image for edit model', { itemIndex });

			const inputImageType = context.getNodeParameter('inputImageType', itemIndex) as string;
			context.logger?.info('[AI Media Gen] Input image type', { inputImageType, itemIndex });

			if (inputImageType === 'binary') {
				// Get binary file from input
				const binaryPropertyName = context.getNodeParameter('inputImageBinary', itemIndex) as string;
				context.logger?.info('[AI Media Gen] Binary property name', { binaryPropertyName, itemIndex });

				const items = context.getInputData();
				const item = items[itemIndex];
				const binaryData = item.binary;

				context.logger?.info('[AI Media Gen] Binary data available', {
					hasBinary: !!binaryData,
					binaryKeys: binaryData ? Object.keys(binaryData) : [],
					itemIndex
				});

				if (!binaryData || !binaryData[binaryPropertyName]) {
					throw new NodeOperationError(
						context.getNode(),
						`Binary property '${binaryPropertyName}' not found. Make sure to include a binary file in your input. Available properties: ${binaryData ? Object.keys(binaryData).join(', ') : 'none'}`,
						{ itemIndex }
					);
				}

				const binary = binaryData[binaryPropertyName] as { data: string; mimeType: string };
				// Convert buffer to base64 if needed
				if (binary.data) {
					inputImage = `data:${binary.mimeType || 'image/jpeg'};base64,${binary.data}`;
					context.logger?.info('[AI Media Gen] Input image loaded from binary', { mimeType: binary.mimeType, itemIndex });
				}
			} else {
				// Get URL or base64 string
				inputImage = context.getNodeParameter('inputImage', itemIndex) as string || '';
				context.logger?.info('[AI Media Gen] Input image from URL/Base64', {
					hasInputImage: !!inputImage,
					length: inputImage?.length,
					itemIndex
				});
			}

			context.logger?.info('[AI Media Gen] Final input image', {
				hasInputImage: !!inputImage,
				length: inputImage?.length,
				itemIndex
			});
		}

		if (!prompt || prompt.trim() === '') {
			throw new NodeOperationError(
				context.getNode(),
				'Prompt is required',
				{ itemIndex }
			);
		}

		// Use centralized validation
		validateModelRequest(model, size, numImages, inputImage);

		const baseUrl = credentials.baseUrl || CONSTANTS.API_ENDPOINTS.MODELSCOPE.BASE_URL;

		return await withRetry(
			() => AIMediaGen.makeModelScopeRequest(
				baseUrl,
				credentials.apiKey,
				model,
				{ prompt: prompt.trim() },
				{
					size: isEditModel ? undefined : (size || '1024x1024'),
					seed: seed || 0,
					steps: steps || 30,
					num_images: numImages || 1,
					input_image: inputImage,
				},
				timeout,
				context,
				context.logger
			),
			{ maxRetries }
		);
	}

	/**
	 * Polls the status of an async task until completion
	 *
	 * Continuously checks the task status until it succeeds, fails, or times out.
	 * Implements proper delay between polls to avoid overwhelming the API.
	 *
	 * @param baseUrl - API base URL
	 * @param apiKey - API key for authentication
	 * @param taskId - Task ID to poll
	 * @param timeout - Maximum polling time in milliseconds
	 * @returns Promise resolving to image URL when task succeeds
	 * @throws MediaGenError for API errors, task failures, or timeout
	 */
	private static async pollTaskStatus(
		baseUrl: string,
		apiKey: string,
		taskId: string,
		timeout: number,
		context?: IExecuteFunctions,
		logger?: IExecuteFunctions['logger']
	): Promise<string> {
		const startTime = Date.now();
		const pollUrl = `${baseUrl}/${CONSTANTS.API_ENDPOINTS.MODELSCOPE.TASK_STATUS}/${taskId}`;

		logger?.debug('[AI Media Gen] Starting async task polling', { taskId, timeout });

		let pollCount = 0;
		while (Date.now() - startTime < timeout) {
			pollCount++;
			const elapsed = Date.now() - startTime;

			logger?.debug('[AI Media Gen] Polling task status', { pollCount, elapsed, taskId });

			let data: ModelScopeAsyncTaskResponse;
			try {
				if (!context) {
					throw new MediaGenError('Execution context is required for polling', 'API_ERROR');
				}
				data = await context.helpers.httpRequest({
					method: 'GET',
					url: pollUrl,
					headers: {
						'Authorization': `Bearer ${apiKey}`,
						'X-ModelScope-Task-Type': 'image_generation',
					},
					json: true,
					timeout: 10000, // 10 second timeout for individual poll requests
				}) as ModelScopeAsyncTaskResponse;
			} catch (error) {
				if (error instanceof Error) {
					if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
						throw new MediaGenError('Poll request timeout', 'TIMEOUT');
					}
					throw new MediaGenError(
						`Failed to check task status: ${error.message}`,
						'API_ERROR'
					);
				}
				throw new MediaGenError(
					`Failed to check task status: ${String(error)}`,
					'API_ERROR'
				);
			}

			logger?.debug('[AI Media Gen] Task status response', {
				taskStatus: data?.task_status,
				hasOutputImages: !!data?.output_images?.length,
				outputImagesCount: data?.output_images?.length,
				responseData: JSON.stringify(data),
			});

			if (!data || !data.task_status) {
				throw new MediaGenError('Invalid task status response', 'API_ERROR', { data });
			}

			switch (data.task_status) {
				case 'SUCCEED': {
					logger?.info('[AI Media Gen] Task succeeded', { taskId, pollCount, elapsed });

					// Log full response for debugging
					const responseStr = JSON.stringify(data, null, 2);
					logger?.info('[AI Media Gen] Full API response', {
						taskId,
						response: responseStr,
					});

					// Try multiple response formats
					// Format 1: output_images array (direct string array)
					if (data.output_images && Array.isArray(data.output_images) && data.output_images.length > 0) {
						const firstItem = data.output_images[0];
						logger?.info('[AI Media Gen] Found output_images array', {
							count: data.output_images.length,
							firstItem,
						});
						// Check if first element is a direct URL string
						if (typeof firstItem === 'string' && firstItem.startsWith('http')) {
							logger?.info('[AI Media Gen] Returning direct URL from output_images[0]', { url: firstItem });
							return firstItem;
						}
						// Check if first element is an object with url property
						if (firstItem && typeof firstItem === 'object' && 'url' in firstItem) {
							const url = (firstItem as { url: string }).url;
							if (typeof url === 'string') {
								return url;
							}
						}
					}

					// Format 2: output_url directly in response
					if (data.output_url) {
						logger?.info('[AI Media Gen] Found output_url field', { url: data.output_url });
						return data.output_url;
					}

					// Format 3: Try to find any field with 'url' in the name
					const dataRecord = data as unknown as Record<string, unknown>;
					for (const key in dataRecord) {
						if (key.includes('url') || key.includes('Url') || key.includes('URL')) {
							const value = dataRecord[key];
							if (typeof value === 'string' && value.startsWith('http')) {
								logger?.info('[AI Media Gen] Found URL in field', { key, value });
								return value;
							}
						}
					}

					// Format 4: Check nested result object
					if (dataRecord.result) {
						const result = dataRecord.result as Record<string, unknown>;
						logger?.info('[AI Media Gen] Found result object', { result });
						if (typeof result.url === 'string') {
							return result.url;
						}
						if (typeof result.image_url === 'string') {
							return result.image_url;
						}
					}

					// If we get here, no URL was found
					logger?.error('[AI Media Gen] No image URL found in any expected format', {
						taskId,
						response: responseStr,
					});

					throw new MediaGenError(
						`Task succeeded but no image URL returned. API Response: ${responseStr}`,
						'API_ERROR',
						{ taskId, response: data }
					);
				}
				case 'FAILED':
					throw new MediaGenError(data.message || 'Task failed', 'API_ERROR', { taskId, message: data.message });
				case 'PENDING':
				case 'RUNNING':
				case 'PROCESSING':
					logger?.debug('[AI Media Gen] Task still processing', { taskStatus: data.task_status, pollCount, elapsed });
					// Continue polling
					continue;
				default:
					throw new MediaGenError(`Unknown task status: ${data.task_status}`, 'API_ERROR', { taskStatus: data.task_status });
			}
		}

		throw new MediaGenError('Task polling timeout', 'TIMEOUT', { taskId, pollCount, timeout });
	}

	/**
	 * Makes a request to the ModelScope API
	 *
	 * Builds and sends an HTTP request to the ModelScope generation endpoint.
	 * Handles timeout, parses response, and converts errors to MediaGenError.
	 *
	 * @param baseUrl - API base URL
	 * @param apiKey - API key for authentication
	 * @param model - Model name to use
	 * @param input - Input parameters containing the prompt
	 * @param parameters - Additional parameters (size, seed, num_images, input_image)
	 * @param timeout - Request timeout in milliseconds
	 * @returns Promise resolving to execution data with image URL
	 * @throws MediaGenError for API or network errors
	 */
	private static async makeModelScopeRequest(
		baseUrl: string,
		apiKey: string,
		model: string,
		input: { prompt: string },
		parameters: { size?: string; seed: number; steps: number; num_images?: number; input_image?: string },
		timeout: number,
		context?: IExecuteFunctions,
		logger?: IExecuteFunctions['logger']
	): Promise<INodeExecutionData> {
		try {
			// Build OpenAI-compatible request body
			const requestBody: Record<string, unknown> = {
				model,
				prompt: input.prompt,
			};

			// Edit model (Qwen-Image-Edit-2511) doesn't use size parameter
			const isEditModel = model === 'Qwen/Qwen-Image-Edit-2511';

			// Add size for generation models
			if (parameters.size && !isEditModel) {
				requestBody.size = parameters.size;
			}

			// Add n (number of images) for models that support it
			if ((model === 'Tongyi-MAI/Z-Image' || model === 'Qwen/Qwen-Image-2512') && parameters.num_images && parameters.num_images > 1) {
				requestBody.n = parameters.num_images;
			}

			// Add image for edit models
			if (parameters.input_image) {
				requestBody.image = parameters.input_image;
			}

			// Build URL, avoiding double slashes
			const baseUrlWithoutTrailingSlash = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
			const url = `${baseUrlWithoutTrailingSlash}/${CONSTANTS.API_ENDPOINTS.MODELSCOPE.IMAGES_GENERATIONS}`;

			logger?.info('[AI Media Gen] Submitting async task', {
				url,
				model,
				promptLength: input.prompt?.length,
				hasAsyncHeader: true,
				requestBody: JSON.stringify(requestBody, null, 2),
			});

			if (!context) {
				throw new MediaGenError('Execution context is required', 'API_ERROR');
			}

			let submitData: ModelScopeAsyncSubmitResponse;
			try {
				submitData = await context.helpers.httpRequest({
					method: 'POST',
					url: url,
					headers: {
						'Authorization': `Bearer ${apiKey}`,
						'Content-Type': 'application/json',
						'X-ModelScope-Async-Mode': 'true',  // Enable async mode
					},
					body: JSON.stringify(requestBody),
					json: true,
					timeout: timeout,
				}) as ModelScopeAsyncSubmitResponse;
	} catch (error) {
				// Log detailed error for debugging
				logger?.error('[AI Media Gen] API request failed', {
					error: error instanceof Error ? error.message : String(error),
					errorString: String(error),
					requestBody: JSON.stringify(requestBody),
					url: url,
				});

				if (error instanceof Error) {
					if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
						throw new MediaGenError('Request timeout', 'TIMEOUT');
					}
					if (error.message.includes('401')) {
						throw new MediaGenError('Authentication failed. Please check your API Key.', 'INVALID_API_KEY');
					}
					if (error.message.includes('400')) {
						// Try to get more error details from response
						let detailedError = error.message;
						try {
							const errorObj = error as any;
							if (errorObj.response && typeof errorObj.response === 'object') {
								detailedError = JSON.stringify(errorObj.response, null, 2);
							}
						} catch (e) {
							// Keep original error
						}
						throw new MediaGenError(
							`API Error (400): ${detailedError}`,
							'API_ERROR'
						);
					}
					if (error.message.includes('429')) {
						throw new MediaGenError('Rate limit exceeded. Please try again later.', 'RATE_LIMIT');
					}
					if (error.message.includes('503')) {
						throw new MediaGenError('Service temporarily unavailable. Please try again later.', 'SERVICE_UNAVAILABLE');
					}
					throw new MediaGenError(
						error.message,
						'API_ERROR'
					);
				}
				throw new MediaGenError(
					`Failed to submit task: ${String(error)}`,
					'API_ERROR'
				);
			}

			logger?.debug('[AI Media Gen] Task submission data', {
				hasData: !!submitData,
				hasTaskId: !!submitData?.task_id,
				taskId: submitData?.task_id,
			});

			if (!submitData || !submitData.task_id) {
				throw new MediaGenError('No task ID returned from API', 'API_ERROR');
			}

			// Poll for task completion
			const imageUrl = await AIMediaGen.pollTaskStatus(
				baseUrlWithoutTrailingSlash,
				apiKey,
				submitData.task_id,
				CONSTANTS.ASYNC.POLL_TIMEOUT_MS,
				context,
				logger
			);

			logger?.info('[AI Media Gen] Image generation completed', {
				imageUrl,
				model,
			});

			// Validate URL format
			if (!CONSTANTS.VALIDATION.URL_PATTERN.test(imageUrl)) {
				throw new MediaGenError(`Invalid image URL format: ${imageUrl}`, 'API_ERROR');
			}

			// Download image binary data
			let binaryData: { data: string; mimeType: string } | undefined;
			try {
				const imageBuffer = await context.helpers.httpRequest({
					method: 'GET',
					url: imageUrl,
					encoding: 'arraybuffer',
					timeout: 30000, // 30 second timeout for downloads
				}) as Buffer;
				const base64 = imageBuffer.toString('base64');

				// Determine mime type from URL
				let mimeType = 'image/png';
				if (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.jpeg')) {
					mimeType = 'image/jpeg';
				} else if (imageUrl.endsWith('.webp')) {
					mimeType = 'image/webp';
				} else if (imageUrl.endsWith('.gif')) {
					mimeType = 'image/gif';
				}

				binaryData = { data: base64, mimeType };

				logger?.info('[AI Media Gen] Image downloaded', {
					mimeType,
					fileSize: imageBuffer.byteLength,
					fileName: imageUrl.split('/').pop()?.split('?')[0],
				});
			} catch (error) {
				logger?.warn('[AI Media Gen] Failed to download image', { error: error instanceof Error ? error.message : String(error) });
			}

			const result: INodeExecutionData = {
				json: {
					success: true,
					imageUrl,
					model,
					_metadata: {
						timestamp: new Date().toISOString(),
					},
				},
			};

			// Add binary data if successfully downloaded
			if (binaryData) {
				result.binary = {
					data: {
						data: binaryData.data,
						mimeType: binaryData.mimeType,
						fileName: `generated-${model.replace(/\//g, '-')}-${Date.now()}.${binaryData.mimeType.split('/')[1] || 'png'}`,
					},
				};
			}

			return result;
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}

			throw new MediaGenError(
				error instanceof Error ? error.message : String(error),
				'NETWORK_ERROR'
			);
		}
	}

	/**
	 * Builds and executes a Gemini API request for image generation
	 *
	 * @param baseUrl - API base URL
	 * @param credentials - API credentials
	 * @param model - Model name
	 * @param prompt - Text prompt for generation
	 * @param referenceImages - Array of reference images (base64 or URLs)
	 * @param aspectRatio - Aspect ratio for generation
	 * @param resolution - Resolution (for Pro models) or null (for standard models)
	 * @param timeout - Request timeout in milliseconds
	 * @param signal - AbortSignal for cancellation
	 * @param logger - Optional logger for debugging
	 * @returns Promise resolving to image URL (base64 data URL or HTTP URL)
	 * @throws MediaGenError for API errors
	 */
	private static async executeGeminiRequest(
		baseUrl: string,
		credentials: GooglePalmApiCredentials,
		model: string,
		prompt: string,
		referenceImages: string[],
		aspectRatio: string,
		resolution: string | null,
		timeout: number,
		context: IExecuteFunctions,
		logger?: IExecuteFunctions['logger']
	): Promise<string> {
		// Build parts array
		const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

		// Add reference images first
		for (const refImage of referenceImages) {
			if (refImage.startsWith('data:')) {
				// Base64 image
				const [mimeType, base64Data] = refImage.split(';base64,');
				parts.push({
					inlineData: {
						mimeType: mimeType.replace('data:', '') || 'image/jpeg',
						data: base64Data,
					},
				});
			} else {
				// URL - skip for now
				logger?.warn(`[${model}] URL images not supported in native format, skipping`);
			}
		}

		// Add text prompt at the end
		parts.push({ text: prompt.trim() });

		// Build generation config based on model type
		const generationConfig: Record<string, unknown> = {
			imageConfig: {
				aspectRatio,
			},
		};

		// Add imageSize for Pro models only
		if (resolution) {
			(generationConfig.imageConfig as Record<string, string>).imageSize = resolution;
		}

		const requestBody = {
			contents: [{ parts, role: 'user' }],
			generationConfig,
		};

		logger?.info(`[${model}] Sending generation request`, {
			requestBody: {
				contents: referenceImages.length > 0 ? '[with images]' : prompt.substring(0, 50) + '...',
				generationConfig,
			},
			baseUrl,
			fullUrl: `${baseUrl}/v1beta/models/${model}:generateContent`,
			model,
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let data: any;
		try {
			data = await context.helpers.httpRequest({
				method: 'POST',
				url: `${baseUrl}/v1beta/models/${model}:generateContent`,
				headers: {
					'x-goog-api-key': credentials.apiKey,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestBody),
				json: true,
				timeout: timeout,
			});
		} catch (error) {
			if (error instanceof Error) {
				if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
					throw new MediaGenError('Request timeout', 'TIMEOUT');
				}
				// Try to parse error from response
				let errorMessage = error.message;
				try {
					const errorData = JSON.parse(error.message);
					if (errorData.error?.message) {
						errorMessage = errorData.error.message;
					}
				} catch {
					// Use default error message
				}
				throw new MediaGenError(errorMessage, 'API_ERROR');
			}
			throw new MediaGenError(
				`API request failed: ${String(error)}`,
				'API_ERROR'
			);
		}

		// Parse standard Gemini API response format
		let imageUrl = '';
		if (data.candidates && data.candidates.length > 0) {
			const candidate = data.candidates[0];
			if (candidate.content && candidate.content.parts) {
				for (const part of candidate.content.parts) {
					// Method 1: Inline base64 image data
					if (part.inlineData && part.inlineData.data) {
						const mimeType = part.inlineData.mimeType || 'image/png';
						imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
						break;
					}
					// Method 2: Extract image URL from Markdown text
					if (part.text) {
						// Match Markdown image syntax: ![alt](url)
						const markdownImageMatch = part.text.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
						if (markdownImageMatch && markdownImageMatch[1]) {
							imageUrl = markdownImageMatch[1];
							break;
						}
						// Match plain URL (ends with image extensions)
						const urlMatch = part.text.match(/(https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp))/i);
						if (urlMatch && urlMatch[1]) {
							imageUrl = urlMatch[1];
							break;
						}
					}
				}
			}
		}

		if (!imageUrl) {
			throw new MediaGenError('No image returned from API', 'API_ERROR');
		}

		logger?.info(`[${model}] Generation completed`, {
			imageUrl: imageUrl.substring(0, 50) + '...',
		});

		return imageUrl;
	}

	/**
	 * Executes Nano Banana API request using OpenAI DALL-E format
	 *
	 * @param context - n8n execution context
	 * @param itemIndex - Index of the item being processed
	 * @param credentials - Google Palm API credentials
	 * @returns Promise resolving to execution data
	 */
	private static async executeNanoBananaRequest(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials: GooglePalmApiCredentials
	): Promise<INodeExecutionData> {
		// Determine baseUrl from host field or use default
		const defaultBaseUrl = 'https://generativelanguage.googleapis.com';
		const baseUrl = credentials.host
			? (credentials.host.startsWith('http') ? credentials.host : `https://${credentials.host}`)
			: defaultBaseUrl;

		context.logger?.info('[Nano Banana] Using config', {
			host: credentials.host || '(using default Google API)',
			baseUrl,
		});

		// Get parameters
		const mode = context.getNodeParameter('nbMode', itemIndex) as string;
		const model = context.getNodeParameter('nbModel', itemIndex) as string;
		const prompt = context.getNodeParameter('nbPrompt', itemIndex) as string;

		// Determine aspect ratio and model based on selection
		let aspectRatio = '1:1';
		let actualModel = model;
		let resolution: string | null = null;

		if (model === 'nano-banana-2') {
			// Nano Banana 2: map resolution to actual model name
			try {
				aspectRatio = context.getNodeParameter('nbAspectRatio', itemIndex) as string;
				const selectedResolution = context.getNodeParameter('nbResolution', itemIndex) as string;
				context.logger?.info(`[Nano Banana 2] Resolution selected`, { aspectRatio, resolution: selectedResolution });

				// Map resolution to actual model
				const resolutionModelMap: Record<string, string> = {
					'1K': 'nano-banana-2',
					'2K': 'nano-banana-2-2k',
					'4K': 'nano-banana-2-4k',
				};
				actualModel = resolutionModelMap[selectedResolution] || 'nano-banana-2';
				resolution = selectedResolution;

				context.logger?.info('[Nano Banana 2] Using model', {
					selectedResolution,
					actualModel,
					aspectRatio,
				});
			} catch (error) {
				context.logger?.error(`[Nano Banana 2] Failed to read parameters`, { error: error instanceof Error ? error.message : String(error) });
				actualModel = 'nano-banana-2';
				aspectRatio = '1:1';
				resolution = '1K';
			}
		} else {
			// Nano Banana (standard): use aspect ratio directly
			try {
				aspectRatio = context.getNodeParameter('nbAspectRatio', itemIndex) as string;
				context.logger?.info(`[Nano Banana] Using aspect ratio`, { aspectRatio });
			} catch (error) {
				context.logger?.error(`[Nano Banana] Failed to read aspect ratio`, { error: error instanceof Error ? error.message : String(error) });
				aspectRatio = '1:1';
			}
		}

		// Get timeout
		let timeout = 60000;
		try {
			timeout = context.getNodeParameter('options.timeout', itemIndex) as number;
		} catch (error) {
			// Use default
		}

		// Validate prompt
		if (!prompt || prompt.trim() === '') {
			throw new NodeOperationError(
				context.getNode(),
				'Prompt is required',
				{ itemIndex }
			);
		}

		// Collect input images from fixedCollection (only for image-to-image mode)
		const referenceImages: string[] = [];
		if (mode === 'image-to-image') {
			try {
				const imagesData = context.getNodeParameter('nbInputImages', itemIndex) as {
					image?: Array<{ url: string }>;
				};

				if (imagesData.image && imagesData.image.length > 0) {
					const items = context.getInputData();
					const binaryData = items[itemIndex].binary;

					for (const img of imagesData.image) {
						if (!img.url || !img.url.trim()) {
							continue;
						}

						let imageData = img.url.trim();

						// Check if it's a binary property name (not a URL or base64)
						if (!imageData.startsWith('http') && !imageData.startsWith('data:')) {
							// Treat as binary property name
							if (binaryData && binaryData[imageData]) {
								const binary = binaryData[imageData] as { data: string; mimeType: string };
								if (binary && binary.data) {
									imageData = `data:${binary.mimeType || 'image/jpeg'};base64,${binary.data}`;
								}
							}
						}

						referenceImages.push(imageData);
					}
				}

				// Validate max images based on model
				// All Nano Banana 2 variants (including 2k and 4k) support up to 14 images
				const proModels = ['nano-banana-2', 'nano-banana-2-2k', 'nano-banana-2-4k'];
				const maxImages = proModels.includes(actualModel) ? 14 : 4;
				if (referenceImages.length > maxImages) {
					throw new NodeOperationError(
						context.getNode(),
						`Maximum ${maxImages} reference images allowed for ${actualModel}. You provided ${referenceImages.length}.`,
						{ itemIndex }
					);
				}

				if (referenceImages.length > 0) {
					context.logger?.info(`[${actualModel}] Reference images loaded`, {
						count: referenceImages.length,
						maxAllowed: maxImages,
					});
				}
			} catch (error) {
				// No reference images or error accessing them
				context.logger?.info(`[${actualModel}] No reference images or error loading them`, {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		try {
			// Call the common Gemini request function
			const imageUrl = await AIMediaGen.executeGeminiRequest(
				baseUrl,
				credentials,
				actualModel,
				prompt,
				referenceImages,
				aspectRatio,
				resolution,
				timeout,
				context,
				context.logger
			);

			// Download image binary data
			let binaryData: { data: string; mimeType: string } | undefined;
			if (imageUrl && !imageUrl.startsWith('data:')) {
				try {
					const imageBuffer = await context.helpers.httpRequest({
						method: 'GET',
						url: imageUrl,
						encoding: 'arraybuffer',
						timeout: 30000, // 30 second timeout for downloads
					}) as Buffer;
					const base64 = imageBuffer.toString('base64');

					// Determine mime type from URL or response
					let mimeType = 'image/png';
					if (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.jpeg')) {
						mimeType = 'image/jpeg';
					} else if (imageUrl.endsWith('.webp')) {
						mimeType = 'image/webp';
					} else if (imageUrl.endsWith('.gif')) {
						mimeType = 'image/gif';
					}

					binaryData = { data: base64, mimeType };

					const dimensions = getImageDimensions(imageBuffer);
					context.logger?.info(`[${actualModel}] Image downloaded`, {
							mimeType,
							fileSize: imageBuffer.byteLength,
							dimensions: dimensions ? `${dimensions.width}x${dimensions.height}` : 'unknown',
							fileName: imageUrl.split('/').pop()?.split('?')[0],
						});
				} catch (error) {
					context.logger?.warn(`[${actualModel}] Failed to download image`, { error: error instanceof Error ? error.message : String(error) });
				}
			} else if (imageUrl && imageUrl.startsWith('data:')) {
				// Already base64, extract data
				const match = imageUrl.match(/data:([^;]+);base64,(.+)/s);
				if (match) {
					binaryData = { data: match[2], mimeType: match[1] };
				}
			}

			const result: INodeExecutionData = {
				json: {
					success: true,
					imageUrl,
					model: actualModel,
					mode,
					_metadata: {
						timestamp: new Date().toISOString(),
					},
				},
			};

			// Add binary data if successfully downloaded
			if (binaryData) {
				result.binary = {
					data: {
						data: binaryData.data,
						mimeType: binaryData.mimeType,
						fileName: `generated-${actualModel}-${Date.now()}.${binaryData.mimeType.split('/')[1] || 'png'}`,
					},
				};
			}

			return result;
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}

			throw new MediaGenError(
				error instanceof Error ? error.message : String(error),
				'NETWORK_ERROR'
			);
		}
	}

	/**
	 * Executes Doubao API request
	 *
	 * @param context - n8n execution context
	 * @param itemIndex - Index of the item being processed
	 * @param credentials - Doubao API credentials
	 * @returns Promise resolving to execution data
	 */
	private static async executeDoubaoRequest(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials: DoubaoApiCredentials
	): Promise<INodeExecutionData> {
		const baseUrl = credentials.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';

		context.logger?.info('[Doubao] Starting generation', {
			itemIndex,
			baseUrl,
		});

		const mode = context.getNodeParameter('doubaoMode', itemIndex) as string;
		const model = context.getNodeParameter('doubaoModel', itemIndex) as string;
		const prompt = context.getNodeParameter('doubaoPrompt', itemIndex) as string;
		const resolutionLevel = context.getNodeParameter('doubaoResolutionLevel', itemIndex) as string || '2K';

		// Get size based on resolution level
		let size: string;
		if (resolutionLevel === '2K') {
			size = context.getNodeParameter('doubaoSize2K', itemIndex) as string || '2048x2048';
		} else {
			size = context.getNodeParameter('doubaoSize4K', itemIndex) as string || '4096x4096';
		}

		const seed = context.getNodeParameter('doubaoSeed', itemIndex) as number || -1;

		let timeout = 60000;
		try {
			timeout = context.getNodeParameter('options.timeout', itemIndex) as number;
		} catch (error) {
			// Use default
		}

		// Validate prompt
		if (!prompt || prompt.trim() === '') {
			throw new NodeOperationError(
				context.getNode(),
				'Prompt is required',
				{ itemIndex }
			);
		}

		// Get input image(s) for image-to-image mode
		const inputImages: string[] = [];
		if (mode === 'image-to-image') {
			try {
				const imagesData = context.getNodeParameter('doubaoInputImages', itemIndex) as {
					image?: Array<{ url: string }>;
				};

				if (imagesData.image && imagesData.image.length > 0) {
					const items = context.getInputData();
					const binaryData = items[itemIndex].binary;

					// Validate max images (Doubao supports up to 14 reference images)
					const maxImages = 14;
					if (imagesData.image.length > maxImages) {
						throw new NodeOperationError(
							context.getNode(),
							`Maximum ${maxImages} reference images allowed for ${model}. You provided ${imagesData.image.length}.`,
							{ itemIndex }
						);
					}

					// Process all images
					for (const img of imagesData.image) {
						if (!img.url || !img.url.trim()) {
							continue;
						}

						let imageData = img.url.trim();

						// Check if it's a binary property name (not a URL or base64)
						if (!imageData.startsWith('http') && !imageData.startsWith('data:')) {
							// Treat as binary property name
							if (binaryData && binaryData[imageData]) {
								const binary = binaryData[imageData] as { data: string; mimeType: string };
								if (binary && binary.data) {
									imageData = `data:${binary.mimeType || 'image/jpeg'};base64,${binary.data}`;
								}
							}
						}

						inputImages.push(imageData);
					}

					context.logger?.info('[Doubao] Reference images loaded', {
						count: inputImages.length,
						maxAllowed: maxImages,
					});
				}
			} catch (error) {
				// No reference images or error accessing them
				context.logger?.info('[Doubao] No reference images or error loading them', {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Validate input images for image-to-image mode
		if (mode === 'image-to-image' && inputImages.length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				'At least one input image is required for image-to-image mode',
				{ itemIndex }
			);
		}

		try {
			let imageUrl: string;

			if (mode === 'text-to-image') {
				// Text to Image
				const requestBody = {
					model: model,
					prompt: prompt.trim(),
					size,
					stream: false,
					watermark: false,
				};

				context.logger?.info('[Doubao] Sending text-to-image request', {
					model,
					prompt: prompt.substring(0, 50) + '...',
					size,
				});

				let data: SeedreamResponse;
				try {
					data = await context.helpers.httpRequest({
						method: 'POST',
						url: `${baseUrl}/images/generations`,
						headers: {
							'Authorization': `Bearer ${credentials.apiKey}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify(requestBody),
						json: true,
						timeout: timeout,
					}) as SeedreamResponse;
				} catch (error) {
					if (error instanceof Error) {
						if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
							throw new MediaGenError('Request timeout', 'TIMEOUT');
						}
						throw new MediaGenError(error.message, 'API_ERROR');
					}
					throw new MediaGenError(`API request failed: ${String(error)}`, 'API_ERROR');
				}

				// Parse response - support both OpenAI format and legacy format
				if (data.data && data.data.length > 0 && data.data[0].url) {
					// OpenAI-compatible format: { data: [{ url: "..." }] }
					imageUrl = data.data[0].url;
				} else if (data.output_url) {
					// Legacy format: { output_url: "..." }
					imageUrl = data.output_url;
				} else {
					context.logger?.error('[Doubao] Unexpected response format', { data });
					throw new MediaGenError('No image URL returned from API', 'API_ERROR');
				}

				context.logger?.info('[Doubao] Generation completed', {
					requestId: data.request_id,
					imageUrl: imageUrl.substring(0, 50) + '...',
				});
			} else {
				// Image to Image
				const formData = new FormData();
				formData.append('model', model);
				formData.append('prompt', prompt);
				formData.append('size', size);
				formData.append('stream', 'false');
				formData.append('watermark', 'false');
				if (seed > 0) {
					formData.append('seed', seed.toString());
				}

				// Add all input images
				let imageIndex = 0;
				for (const img of inputImages) {
					if (img.startsWith('data:')) {
						// Base64 image
						const base64Data = img.split(',')[1];
						const byteCharacters = atob(base64Data);
						const byteNumbers = new Array<number>(byteCharacters.length);
						for (let i = 0; i < byteCharacters.length; i++) {
							byteNumbers[i] = byteCharacters.charCodeAt(i);
						}
						const byteArray = new Uint8Array(byteNumbers);
						const blob = new Blob([byteArray], { type: 'image/jpeg' });
						formData.append('image', blob, `image_${imageIndex}.jpg`);
					} else {
						// URL - append as-is
						formData.append('image_url', img);
					}
					imageIndex++;
				}

				context.logger?.info('[Doubao] Sending image-to-image request', {
					model,
					prompt: prompt.substring(0, 50) + '...',
					size,
					imageCount: inputImages.length,
				});

				let data: SeedreamResponse;
				try {
					data = await context.helpers.httpRequest({
						method: 'POST',
						url: `${baseUrl}/images/edits`,
						headers: {
							'Authorization': `Bearer ${credentials.apiKey}`,
						},
						body: formData,
						json: true,
						timeout: timeout,
					}) as SeedreamResponse;
				} catch (error) {
					if (error instanceof Error) {
						if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
							throw new MediaGenError('Request timeout', 'TIMEOUT');
						}
						throw new MediaGenError(error.message, 'API_ERROR');
					}
					throw new MediaGenError(`API request failed: ${String(error)}`, 'API_ERROR');
				}

				// Parse response - support both OpenAI format and legacy format
				if (data.data && data.data.length > 0 && data.data[0].url) {
					// OpenAI-compatible format: { data: [{ url: "..." }] }
					imageUrl = data.data[0].url;
				} else if (data.output_url) {
					// Legacy format: { output_url: "..." }
					imageUrl = data.output_url;
				} else {
					context.logger?.error('[Doubao] Unexpected response format', { data });
					throw new MediaGenError('No image URL returned from API', 'API_ERROR');
				}

				context.logger?.info('[Doubao] Edit completed', {
					requestId: data.request_id,
					imageUrl: imageUrl.substring(0, 50) + '...',
				});
			}

			// Prepare response data
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const jsonData: any = {
				success: true,
				imageUrl,
				model,
				mode,
				_metadata: {
					timestamp: new Date().toISOString(),
				},
			};

			// Add image count for image-to-image mode
			if (mode === 'image-to-image') {
				jsonData._metadata.inputImageCount = inputImages.length;
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const binaryData: any = {};

			// Download image if URL returned (not base64)
			if (imageUrl && !imageUrl.startsWith('data:')) {
				try {
					context.logger?.info('[Doubao] Downloading image from URL');
					const imageBuffer = await context.helpers.httpRequest({
						method: 'GET',
						url: imageUrl,
						encoding: 'arraybuffer',
						timeout: 30000, // 30 second timeout for downloads
					}) as Buffer;
					const base64 = imageBuffer.toString('base64');
					let mimeType = 'image/png';
					if (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.jpeg')) {
						mimeType = 'image/jpeg';
					} else if (imageUrl.endsWith('.webp')) {
						mimeType = 'image/webp';
					} else if (imageUrl.endsWith('.gif')) {
						mimeType = 'image/gif';
					}

					binaryData.data = {
						data: base64,
						mimeType,
						fileName: `doubao-${Date.now()}.png`,
					};

					context.logger?.info('[Doubao] Image downloaded successfully');
				} catch (error) {
					context.logger?.warn('[Doubao] Failed to download image', {
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			return {
				json: jsonData,
				binary: Object.keys(binaryData).length > 0 ? binaryData : undefined,
			};
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}

			throw new MediaGenError(
				error instanceof Error ? error.message : String(error),
				'NETWORK_ERROR'
			);
		}
	}

	/**
	 * Executes Sora video generation
	 *
	 * @param context - n8n execution context
	 * @param itemIndex - Index of the item being processed
	 * @param credentials - OpenAI API credentials
	 * @returns Promise resolving to execution data
	 */
	private static async executeSoraRequest(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials: OpenAiApiCredentials
	): Promise<INodeExecutionData> {
		const model = context.getNodeParameter('soraModel', itemIndex) as string;
		const prompt = context.getNodeParameter('soraPrompt', itemIndex) as string;
		const aspectRatio = context.getNodeParameter('soraAspectRatio', itemIndex) as string;

		// Get duration based on model type
		let duration: string;
		if (model === 'sora-2-pro') {
			duration = context.getNodeParameter('soraDurationPro', itemIndex) as string;
		} else {
			duration = context.getNodeParameter('soraDuration', itemIndex) as string;
		}
		const outputMode = context.getNodeParameter('soraOutputMode', itemIndex) as string;

		let hd = false;
		try {
			hd = context.getNodeParameter('soraHd', itemIndex) as boolean;
		} catch {
			// HD only for sora-2-pro
		}

		// Get input image (image-to-video)
		let inputImage: string | undefined;
		let originalInputImageUrl: string | undefined;
		let inputImageBinary: { data: string; mimeType: string } | undefined;

		try {
			let imageData = context.getNodeParameter('soraInputImage', itemIndex) as string;

			if (imageData && imageData.trim()) {
				imageData = imageData.trim();
				originalInputImageUrl = imageData;

				// Check if it's a binary property name (not a URL or base64)
				if (!imageData.startsWith('http') && !imageData.startsWith('data:')) {
					const items = context.getInputData();
					const binaryData = items[itemIndex].binary;

					if (binaryData && binaryData[imageData]) {
						const binary = binaryData[imageData] as { data: string; mimeType: string };
						if (binary && binary.data) {
							inputImageBinary = {
								data: binary.data,
								mimeType: binary.mimeType || 'image/jpeg',
							};
							imageData = `data:${inputImageBinary.mimeType};base64,${binary.data}`;
						}
					}
				}

				inputImage = imageData;
			}
		} catch (error) {
			// No input image (text-to-video)
		}

		// Validate prompt
		if (!prompt || prompt.trim() === '') {
			throw new NodeOperationError(
				context.getNode(),
				'Prompt is required',
				{ itemIndex }
			);
		}

		// Get timeout and retry options
		let timeout = 30000;
		try {
			timeout = context.getNodeParameter('options.timeout', itemIndex) as number;
		} catch {
			// Use default
		}

		let maxRetries = 3;
		try {
			maxRetries = context.getNodeParameter('options.maxRetries', itemIndex) as number;
		} catch {
			// Use default
		}

		// Submit generation request
		const requestBody: SoraRequest = {
			model: model as 'sora-2' | 'sora-2-pro',
			prompt: prompt.trim(),
			aspect_ratio: aspectRatio as '16:9' | '3:2' | '1:1' | '9:16' | '2:3',
			duration: duration as '5' | '10' | '15' | '20' | '25',
			hd: hd && model === 'sora-2-pro' ? true : undefined,
			images: inputImage ? [inputImage] : undefined,
		};

		const baseUrl = credentials.baseUrl || 'https://api.openai.com';

		// Submit request
		const taskId = await withRetry(
			async () => {
				const response = await context.helpers.httpRequest({
					method: 'POST',
					url: `${baseUrl}/v1/videos`,
					headers: {
						'Authorization': `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(requestBody),
					json: true,
					timeout: timeout,
				}) as SoraSubmitResponse;

				if (!response.task_id) {
					throw new MediaGenError('No task_id returned from API', 'API_ERROR');
				}

				return response.task_id;
			},
			{ maxRetries }
		);

		context.logger?.info('[Sora] Generation submitted', { taskId, model, duration });

		// Poll for completion
		const status = await AIMediaGen.pollSoraStatus(
			context,
			credentials,
			taskId,
			duration,
			context.logger
		);

		context.logger?.info('[Sora] Generation completed', { taskId, progress: status.progress });

		// Get video URL from response
		const videoUrl = status.data?.output;
		if (!videoUrl) {
			throw new MediaGenError('No video URL returned from API', 'API_ERROR');
		}

		// Prepare response data with input image
		const responseData: {
			success: boolean;
			videoUrl: string;
			taskId: string;
			model: string;
			inputImageUrl?: string;
			_metadata: Record<string, unknown>;
		} = {
			success: true,
			videoUrl,
			taskId,
			model,
			_metadata: {
				timestamp: new Date().toISOString(),
			},
		};

		// Add input image data if present
		if (originalInputImageUrl) {
			responseData.inputImageUrl = originalInputImageUrl;
		}

		// Return based on output mode
		if (outputMode === 'binary') {
			// Download video
			try {
				const videoBuffer = await context.helpers.httpRequest({
					method: 'GET',
					url: videoUrl,
					encoding: 'arraybuffer',
					timeout: 120000,
				}) as Buffer;

				const fileSizeMB = videoBuffer.byteLength / (1024 * 1024);
				const base64 = videoBuffer.toString('base64');

				context.logger?.info('[Sora] Video downloaded', {
					fileSize: `${fileSizeMB.toFixed(2)}MB`,
					bytes: videoBuffer.byteLength,
				});

				responseData._metadata.fileSize = `${fileSizeMB.toFixed(2)}MB`;

				const binaryData: Record<string, { data: string; mimeType: string; fileName: string }> = {
					data: {
						data: base64,
						mimeType: 'video/mp4',
						fileName: `sora-${taskId}-${Date.now()}.mp4`,
					},
				};

				// Add input image binary if present
				if (inputImageBinary) {
					binaryData.inputImage = {
						data: inputImageBinary.data,
						mimeType: inputImageBinary.mimeType,
						fileName: `input-image-${Date.now()}.${inputImageBinary.mimeType.split('/')[1] || 'jpg'}`,
					};
				}

				return {
					json: responseData,
					binary: binaryData,
				};
			} catch (error) {
				context.logger?.warn('[Sora] Download failed, returning URL only', {
					error: error instanceof Error ? error.message : String(error),
				});

				// Fall back to URL mode
				responseData._metadata.downloadFailed = true;
				return {
					json: responseData,
				};
			}
		} else {
			// URL mode
			return {
				json: responseData,
			};
		}
	}

	/**
	 * Polls Sora video generation status
	 *
	 * @param context - n8n execution context
	 * @param credentials - OpenAI API credentials
	 * @param taskId - Task ID to poll
	 * @param duration - Video duration (for timeout calculation)
	 * @param logger - Optional logger
	 * @returns Promise resolving to final status
	 */
	private static async pollSoraStatus(
		context: IExecuteFunctions,
		credentials: OpenAiApiCredentials,
		taskId: string,
		duration: string,
		logger?: IExecuteFunctions['logger']
	): Promise<SoraTaskResponse> {
		// Calculate timeout based on video duration
		const timeouts: Record<string, number> = {
			'5': 180000,   // 3 minutes
			'10': 300000,  // 5 minutes
			'15': 420000,  // 7 minutes
			'20': 600000,  // 10 minutes
			'25': 780000,  // 13 minutes
		};

		const timeoutMs = timeouts[duration] || 180000;
		const startTime = Date.now();

		let pollCount = 0;
		const maxPolls = 120;

		while (Date.now() - startTime < timeoutMs && pollCount < maxPolls) {
			pollCount++;
			const elapsed = Date.now() - startTime;

			// Query status
			const baseUrl = credentials.baseUrl || 'https://api.openai.com';
			const status = await context.helpers.httpRequest({
				method: 'GET',
				url: `${baseUrl}/v2/videos/generations/${taskId}`,
				headers: {
					'Authorization': `Bearer ${credentials.apiKey}`,
				},
				json: true,
				timeout: 10000,
			}) as SoraTaskResponse;

			// Log progress
			logger?.info(`[Sora] Progress: ${status.progress} (${status.status})`, {
				taskId,
				elapsed: `${Math.floor(elapsed / 1000)}s`,
				pollCount,
			});

			// Handle status
			switch (status.status) {
				case 'SUCCESS':
					return status;

				case 'FAILURE':
					throw new MediaGenError(
						status.fail_reason || 'Video generation failed',
						'VIDEO_GENERATION_FAILED',
						{ taskId, progress: status.progress }
					);

				case 'IN_PROGRESS':
				case 'NOT_START':
					continue;

				default:
					throw new MediaGenError(`Unknown status: ${status.status}`, 'API_ERROR');
			}
		}

		throw new MediaGenError(
			`Video generation timeout after ${Math.floor((Date.now() - startTime) / 1000)}s`,
			'TIMEOUT',
			{ taskId, pollCount }
		);
	}

	/**
	 * Executes Veo video generation request
	 *
	 * @param context - n8n execution context
	 * @param itemIndex - Index of the current item
	 * @param credentials - Google PaLM API credentials
	 * @returns Promise resolving to execution result
	 */
	private static async executeVeoRequest(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials: GooglePalmApiCredentials
	): Promise<INodeExecutionData> {
		// Get parameters
		const mode = context.getNodeParameter('veoMode', itemIndex) as string;
		const model = context.getNodeParameter('veoModel', itemIndex) as string;
		const prompt = context.getNodeParameter('veoPrompt', itemIndex) as string;
		const enhancePrompt = context.getNodeParameter('veoEnhancePrompt', itemIndex) as boolean ?? false;
		const outputMode = context.getNodeParameter('veoOutputMode', itemIndex) as string;

		// Get optional parameters
		let aspectRatio: string | undefined;
		let enableUpsample = false;

		try {
			aspectRatio = context.getNodeParameter('veoAspectRatio', itemIndex) as string;
		} catch {
			// Parameter not available, use default
		}

		try {
			enableUpsample = context.getNodeParameter('veoEnableUpsample', itemIndex) as boolean;
		} catch {
			// Parameter not available, use default
		}

		// Handle input images for image-to-video mode
		let images: string[] | undefined;
		if (mode === 'image-to-video') {
			try {
				const imagesData = context.getNodeParameter('veoInputImages', itemIndex) as {
					image?: Array<{ url: string }>;
				};

				if (imagesData.image && imagesData.image.length > 0) {
					const items = context.getInputData();
					const binaryData = items[itemIndex].binary;

					images = [];
					for (const img of imagesData.image) {
						if (!img.url || !img.url.trim()) continue;

						let imageData = img.url.trim();

						// Handle binary property references
						if (!imageData.startsWith('http') && !imageData.startsWith('data:')) {
							if (binaryData && binaryData[imageData]) {
								const binary = binaryData[imageData] as { data: string; mimeType: string };
								if (binary && binary.data) {
									imageData = `data:${binary.mimeType || 'image/jpeg'};base64,${binary.data}`;
								}
							}
						}

						images.push(imageData);
					}
				}
			} catch (error) {
				throw new NodeOperationError(
					context.getNode(),
					'Input images are required for image-to-video mode',
					{ itemIndex }
				);
			}
		}

		// Validate prompt
		if (!prompt || prompt.trim() === '') {
			throw new NodeOperationError(
				context.getNode(),
				'Prompt is required',
				{ itemIndex }
			);
		}

		// Get timeout settings
		let timeout = 300000; // 5 minutes default
		try {
			timeout = context.getNodeParameter('options.timeout', itemIndex) as number;
		} catch {
			// Use default timeout
		}

		let maxRetries = 3;
		try {
			maxRetries = context.getNodeParameter('options.maxRetries', itemIndex) as number;
		} catch {
			// Use default max retries
		}

		// Build request
		const requestBody: VeoRequest = {
			prompt: prompt.trim(),
			model: model as 'veo3.1-fast' | 'veo3.1-pro' | 'veo3.1' | 'veo3.1-components',
			enhance_prompt: enhancePrompt || undefined,
			enable_upsample: enableUpsample || undefined,
			aspect_ratio: aspectRatio as '16:9' | '9:16' | undefined,
			images: images && images.length > 0 ? images : undefined,
		};

		// Remove undefined values
		Object.keys(requestBody).forEach(key => {
			if (requestBody[key as keyof VeoRequest] === undefined) {
				delete requestBody[key as keyof VeoRequest];
			}
		});

		const baseUrl = credentials.host
			? (credentials.host.startsWith('http') ? credentials.host : `https://${credentials.host}`)
			: 'https://api.openai.com';

		// Submit request
		const taskId = await withRetry(
			async () => {
				const response = await context.helpers.httpRequest({
					method: 'POST',
					url: `${baseUrl}/v2/videos/generations`,
					headers: {
						'Authorization': `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(requestBody),
					json: true,
					timeout: timeout,
				}) as VeoSubmitResponse;

				if (!response.task_id) {
					throw new MediaGenError('No task_id returned from API', 'API_ERROR');
				}

				return response.task_id;
			},
			{ maxRetries }
		);

		context.logger?.info('[Veo] Generation submitted', { taskId, model, mode });

		// Poll for completion
		const status = await AIMediaGen.pollVeoStatus(
			context,
			credentials,
			taskId,
			context.logger
		);

		context.logger?.info('[Veo] Generation completed', { taskId, progress: status.progress });

		// Get video URL
		const videoUrl = status.data?.output;
		if (!videoUrl) {
			throw new MediaGenError('No video URL returned from API', 'API_ERROR');
		}

		// Return based on output mode
		if (outputMode === 'binary') {
			// Download and return binary
			const videoBuffer = await context.helpers.httpRequest({
				method: 'GET',
				url: videoUrl,
				encoding: 'arraybuffer',
				timeout: 60000,
			}) as Buffer;

			// Detect MIME type from URL or default to mp4
			let mimeType = 'video/mp4';
			if (videoUrl.includes('.mov')) {
				mimeType = 'video/quicktime';
			}

			return {
				json: {
					success: true,
					videoUrl,
					taskId,
					model,
					_metadata: {
						timestamp: new Date().toISOString(),
					},
				},
				binary: {
					data: {
						data: videoBuffer.toString('base64'),
						mimeType,
						fileName: `veo_${taskId}.${mimeType === 'video/quicktime' ? 'mov' : 'mp4'}`,
					},
				},
			};
		} else {
			// Return URL only
			return {
				json: {
					success: true,
					videoUrl,
					taskId,
					model,
					_metadata: {
						timestamp: new Date().toISOString(),
					},
				},
			};
		}
	}

	/**
	 * Polls Veo video generation status
	 *
	 * @param context - n8n execution context
	 * @param credentials - Google PaLM API credentials
	 * @param taskId - Task ID to poll
	 * @param logger - Optional logger
	 * @returns Promise resolving to final status
	 */
	private static async pollVeoStatus(
		context: IExecuteFunctions,
		credentials: GooglePalmApiCredentials,
		taskId: string,
		logger?: IExecuteFunctions['logger']
	): Promise<VeoTaskResponse> {
		const baseUrl = credentials.host
			? (credentials.host.startsWith('http') ? credentials.host : `https://${credentials.host}`)
			: 'https://api.openai.com';

		const timeoutMs = 600000; // 10 minutes max
		const startTime = Date.now();

		let pollCount = 0;
		const maxPolls = 120;

		while (Date.now() - startTime < timeoutMs && pollCount < maxPolls) {
			pollCount++;
			const elapsed = Date.now() - startTime;

			const status = await context.helpers.httpRequest({
				method: 'GET',
				url: `${baseUrl}/v2/videos/generations/${taskId}`,
				headers: {
					'Authorization': `Bearer ${credentials.apiKey}`,
				},
				json: true,
				timeout: 10000,
			}) as VeoTaskResponse;

			logger?.info(`[Veo] Progress: ${status.progress} (${status.status})`, {
				taskId,
				elapsed: `${Math.floor(elapsed / 1000)}s`,
				pollCount,
			});

			switch (status.status) {
				case 'SUCCESS':
					return status;
				case 'FAILURE':
					throw new MediaGenError(
						status.fail_reason || 'Video generation failed',
						'VIDEO_GENERATION_FAILED',
						{ taskId, progress: status.progress }
					);
				case 'IN_PROGRESS':
				case 'NOT_START':
					continue;
				default:
					throw new MediaGenError(`Unknown status: ${status.status}`, 'API_ERROR');
			}
		}

		throw new MediaGenError(
			`Video generation timeout after ${Math.floor((Date.now() - startTime) / 1000)}s`,
			'TIMEOUT',
			{ taskId, pollCount }
		);
	}
}
