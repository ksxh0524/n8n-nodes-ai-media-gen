import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
} from 'n8n-workflow';
import * as CONSTANTS from './utils/constants';
import { MediaGenExecutor } from './utils/mediaGenExecutor';
import { initializeStrategies } from './platforms/strategies';

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
			{
				name: 'sunoApi',
				required: true,
				displayOptions: {
					show: {
						operation: ['suno'],
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
				{
					name: 'Suno',
					value: 'suno',
					description: 'Suno AI - Text to Music Generation',
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
		// Suno - Song Title
		{
			displayName: 'Song Title',
			name: 'sunoTitle',
			type: 'string',
			default: '',
			placeholder: 'Optional: Give your song a title',
			description: 'Optional title for the generated song',
			displayOptions: {
				show: {
					operation: ['suno'],
				},
			},
		},
		// Suno - Style Tags
		{
			displayName: 'Style Tags',
			name: 'sunoTags',
			type: 'string',
			default: '',
			placeholder: 'e.g., pop, upbeat, summer',
			description: 'Comma-separated style tags for the music (optional)',
			displayOptions: {
				show: {
					operation: ['suno'],
				},
			},
		},
		// Suno - Prompt
		{
			displayName: 'Prompt',
			name: 'sunoPrompt',
			type: 'string',
			typeOptions: {
				rows: 5,
			},
			default: '',
			required: true,
			description: 'Describe the music you want to generate (e.g., "An upbeat pop song about summer adventures")',
			displayOptions: {
				show: {
					operation: ['suno'],
				},
			},
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
					model: ['Tongyi-MAI/Z-Image', 'Qwen/Qwen-Image-2512'],
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
					model: ['Tongyi-MAI/Z-Image', 'Qwen/Qwen-Image-2512'],
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
				{
					displayName: 'Test Mode',
					name: 'testMode',
					type: 'boolean',
					default: false,
					description: 'Enable test mode to return mock data without making real API calls',
				},
				{
					displayName: 'Test Task ID',
					name: 'testId',
					type: 'string',
					default: 'test-mock-data-id',
					placeholder: 'Enter a test ID for mock data identification',
					description: 'Test ID to identify mock data responses (only used in test mode)',
					displayOptions: {
						show: {
							testMode: [true],
						},
					},
				},
			],
		},
	];
	/**
	 * Executes the AI media generation node
	 *
	 * Processes input items and generates/edits images/videos using various AI platforms.
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

		// Check if test mode is enabled
		let testMode = false;
		let testId = 'test-mock-data-id';
		try {
			testMode = this.getNodeParameter('options.testMode', CONSTANTS.INDICES.FIRST_ITEM) as boolean;
			if (testMode) {
				testId = this.getNodeParameter('options.testId', CONSTANTS.INDICES.FIRST_ITEM) as string;
			}
		} catch (error) {
			// Test mode not configured, use default
		}

		// If test mode is enabled, return mock data
		if (testMode) {
			this.logger?.info('Test mode enabled, returning mock data', { testId });
			return [await this.getMockData(testId, items.length)];
		}

		// Initialize platform strategies (once per node execution)
		initializeStrategies();

		// Safely get enableCache with try-catch
		let enableCache = true;
		try {
			enableCache = this.getNodeParameter('options.enableCache', CONSTANTS.INDICES.FIRST_ITEM) as boolean;
		} catch (error) {
			// If options doesn't exist, use default
			this.logger?.debug('Options not set, using default enableCache=true');
			enableCache = true;
		}

		this.logger?.info('Starting AI Media Generation execution', {
			itemCount: items.length,
			enableCache,
		});

		// Create media generation executor
		const executor = new MediaGenExecutor(this, enableCache);

		for (let i = 0; i < items.length; i++) {
			try {
				this.logger?.debug('Processing item', { index: i });

				// Execute item using the executor
				const result = await executor.executeItem(i);
				results.push(result);

			} catch (error) {
				// Get operation for error logging
				const operation = this.getNodeParameter('operation', i) as string;

				// Get model name based on operation
				let model: string;
				if (operation === 'nanoBanana') {
					model = this.getNodeParameter('nbModel', i) as string;
				} else if (operation === 'doubao') {
					model = this.getNodeParameter('doubaoModel', i) as string;
				} else if (operation === 'sora') {
					model = this.getNodeParameter('soraModel', i) as string;
				} else if (operation === 'veo') {
					model = this.getNodeParameter('veoModel', i) as string;
				} else if (operation === 'suno') {
					model = CONSTANTS.SUNO.MODEL_NAME;
				} else {
					model = this.getNodeParameter('model', i) as string;
				}

				this.logger?.error('Execution failed', {
					operation,
					model,
					error: error instanceof Error ? error.message : String(error),
				});

				// Create error result
				const errorResult = MediaGenExecutor.createErrorResult(error, operation, model);
				results.push(errorResult);

				// Continue on fail if configured
				if (this.continueOnFail()) {
					continue;
				}
				throw error;
			}
		}


		return [this.helpers.constructExecutionMetaData(results, { itemData: { item: 0 } })];
	}

	/**
	 * Generates mock data for test mode
	 *
	 * @param testId - Test ID to identify the mock response
	 * @param itemCount - Number of mock items to generate
	 * @returns Array of mock execution data
	 */
	private async getMockData(testId: string, itemCount: number): Promise<INodeExecutionData[]> {
		const mockResults: INodeExecutionData[] = [];

		// Generate mock data for each item
		for (let i = 0; i < itemCount; i++) {
			const mockData: INodeExecutionData = {
				json: {
					testMode: true,
					testId,
					timestamp: new Date().toISOString(),
					message: 'This is mock data from test mode - no API call was made',
				},
			};

			// Add different mock data based on testId prefix
			if (testId.includes('suno')) {
				// Suno mock data
				mockData.json = {
					...mockData.json,
					model: CONSTANTS.SUNO.MODEL_NAME,
					provider: 'suno',
					mediaType: 'audio',
					songCount: 2,
					songs: [
						{
							id: `mock-song-1-${testId}`,
							audioUrl: 'https://mock-suno-api.song1.mp3',
							videoUrl: 'https://mock-suno-api.video1.mp4',
							title: 'Mock Song 1 (Test Mode)',
							tags: 'mock, test, demo',
							duration: 180.5,
							imageUrl: 'https://mock-suno-api.cover1.jpg',
						},
						{
							id: `mock-song-2-${testId}`,
							audioUrl: 'https://mock-suno-api.song2.mp3',
							videoUrl: 'https://mock-suno-api.video2.mp4',
							title: 'Mock Song 2 (Test Mode)',
							tags: 'mock, test, demo',
							duration: 165.3,
							imageUrl: 'https://mock-suno-api.cover2.jpg',
						},
					],
				};
			} else if (testId.includes('sora')) {
				// Sora mock data
				mockData.json = {
					...mockData.json,
					model: 'sora-2',
					provider: 'sora',
					mediaType: 'video',
					videoUrl: `https://mock-sora-api/video-${testId}.mp4`,
					taskId: `mock-task-${testId}`,
					status: 'SUCCESS',
				};
			} else if (testId.includes('veo')) {
				// Veo mock data
				mockData.json = {
					...mockData.json,
					model: 'veo-2.0',
					provider: 'veo',
					mediaType: 'video',
					videoUrl: `https://mock-veo-api/video-${testId}.mp4`,
					taskId: `mock-task-${testId}`,
					status: 'COMPLETED',
				};
			} else if (testId.includes('modelscope')) {
				// ModelScope mock data
				mockData.json = {
					...mockData.json,
					model: 'Tongyi-MAI/Z-Image',
					provider: 'modelScope',
					mediaType: 'image',
					imageUrl: `https://mock-modelscope-api/image-${testId}.png`,
					taskId: `mock-task-${testId}`,
				};
			} else if (testId.includes('doubao')) {
				// Doubao mock data
				mockData.json = {
					...mockData.json,
					model: 'doubao-seedream-4-5-251128',
					provider: 'doubao',
					mediaType: 'image',
					imageUrl: `https://mock-doubao-api/image-${testId}.png`,
				};
			} else if (testId.includes('nano')) {
				// Nano Banana mock data
				mockData.json = {
					...mockData.json,
					model: 'nano-banana-2',
					provider: 'nanoBanana',
					mediaType: 'image',
					imageUrl: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`, // 1x1 transparent PNG
				};
			} else {
				// Generic mock data
				mockData.json = {
					...mockData.json,
					model: 'mock-model',
					provider: 'mock-provider',
					mediaType: 'unknown',
					data: `Mock data for test ID: ${testId}`,
				};
			}

			mockResults.push(mockData);
		}

		return mockResults;
	}
}
