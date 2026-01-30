import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
} from 'n8n-workflow';
import {
	MediaGenError,
	makeHttpRequest,
	pollTask,
	validatePrompt,
	getTimeoutOrDefault,
	createBinaryDataFromUrl,
	generateFileName,
	SIZE_OPTIONS_2K,
	SIZE_OPTIONS_4K,
	VIDEO_RESOLUTIONS,
	VIDEO_ASPECT_RATIOS,
	DEFAULT_TIMEOUTS,
	SEED,
} from './utils';

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
 * Seedance video task submission response
 */
interface SeedanceSubmitResponse {
	id: string;
}

/**
 * Seedance video task status response
 */
interface SeedanceTaskResponse {
	id: string;
	model: string;
	status: 'queued' | 'running' | 'cancelled' | 'succeeded' | 'failed' | 'expired';
	content?: {
		video_url?: string;
		last_frame_url?: string;
	};
	error?: {
		code: string;
		message: string;
	};
	usage?: {
		completion_tokens: number;
		total_tokens: number;
	};
	created_at: number;
	updated_at: number;
}

/**
 * Content item for video generation
 */
interface SeedanceContentItem {
	type: 'text' | 'image_url' | 'draft_task';
	text?: string;
	image_url?: {
		url: string;
	};
	role?: 'first_frame' | 'last_frame' | 'reference_image';
	draft_task?: {
		id: string;
	};
}

/**
 * Doubao Media Generation Node
 *
 * Generates images and videos using Doubao Seedream/Seedance AI models
 * through Volcengine API.
 *
 * Features:
 * - Text-to-image generation
 * - Image-to-image editing
 * - Text-to-video generation
 * - Image-to-video with first/last frames
 * - Image-to-video with reference images
 * - Multiple aspect ratios
 * - High resolution support
 * - Audio generation for videos (Seedance 1.5 Pro)
 */
export class DoubaoGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Doubao Media Generation',
		name: 'doubaoGen',
		icon: 'file:ai-media-gen.svg',
		description: 'Generate images and videos using Doubao AI models',
		version: 1.0,
		group: ['transform'],
		subtitle: '={{$parameter.mode}}',
		defaults: {
			name: 'Doubao Media Generation',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'doubaoApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Mode',
				name: 'mode',
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
					{
						name: 'Video Generation',
						value: 'video-generation',
						description: 'Generate videos using Seedance models',
					},
				],
				default: 'text-to-image',
				description: 'Select generation mode',
			},
			{
				displayName: 'Model',
				name: 'model',
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
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				default: '',
				required: true,
				description: 'Text description for generation or editing',
			},
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
						mode: ['image-to-image'],
					},
				},
			},
			{
				displayName: 'Input Image',
				name: 'inputImage',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						mode: ['image-to-image'],
						inputImageType: ['url'],
					},
				},
				description: 'URL or base64 of the image to edit',
				placeholder: 'https://example.com/image.jpg or data:image/jpeg;base64,...',
			},
			{
				displayName: 'Input Image File',
				name: 'inputImageBinary',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						mode: ['image-to-image'],
						inputImageType: ['binary'],
					},
				},
				description: 'Binary property containing the image file to edit',
				placeholder: 'Enter a property name containing the binary data, e.g., data',
			},
		{
			displayName: 'Resolution Level',
			name: 'resolutionLevel',
			type: 'options',
			default: '2K',
			options: [
				{ name: '2K', value: '2K' },
				{ name: '4K', value: '4K' },
			],
			description: 'Select resolution level',
		},
		{
			displayName: 'Size (2K)',
			name: 'size2K',
			type: 'options',
			default: '2048x2048',
			options: SIZE_OPTIONS_2K,
			description: 'Image size and aspect ratio (2K)',
			displayOptions: {
				show: {
					resolutionLevel: ['2K'],
				},
			},
		},
		{
			displayName: 'Size (4K)',
			name: 'size4K',
			type: 'options',
			default: '4096x4096',
			options: SIZE_OPTIONS_4K,
			description: 'Image size and aspect ratio (4K)',
			displayOptions: {
				show: {
					resolutionLevel: ['4K'],
				},
			},
		},
			{
				displayName: 'Seed',
				name: 'seed',
				type: 'number',
				default: SEED.DEFAULT,
				typeOptions: {
					minValue: SEED.MIN,
					maxValue: SEED.MAX,
				},
				description: 'Random seed for generation (-1 for random)',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 5000,
							maxValue: 300000,
						},
						default: 60000,
						description: 'Request timeout in milliseconds (default: 60 seconds)',
					},
				],
			},
			// ========== Video Generation Parameters ==========
			{
				displayName: 'Video Model',
				name: 'videoModel',
				type: 'options',
				displayOptions: {
					show: {
						mode: ['video-generation'],
					},
				},
				options: [
					{
						name: 'Seedance 1.5 Pro (Latest)',
						value: 'doubao-seedance-1-5-pro-251215',
						description: 'Best quality, supports audio generation',
					},
					{
						name: 'Seedance 1.0 Pro',
						value: 'doubao-seedance-1-0-pro-250528',
						description: 'High quality video generation',
					},
					{
						name: 'Seedance 1.0 Pro Fast',
						value: 'doubao-seedance-1-0-pro-fast-251015',
						description: 'Faster generation, lower cost',
					},
					{
						name: 'Seedance 1.0 Lite T2V',
						value: 'doubao-seedance-1-0-lite-t2v-250428',
						description: 'Text-to-video only, cost-effective',
					},
					{
						name: 'Seedance 1.0 Lite I2V',
						value: 'doubao-seedance-1-0-lite-i2v-250428',
						description: 'Image-to-video with reference support',
					},
				],
				default: 'doubao-seedance-1-5-pro-251215',
				description: 'Select video generation model',
				required: true,
			},
			{
				displayName: 'Video Mode',
				name: 'videoMode',
				type: 'options',
				displayOptions: {
					show: {
						mode: ['video-generation'],
					},
				},
				options: [
					{
						name: 'Text to Video',
						value: 'text-to-video',
						description: 'Generate video from text description',
					},
					{
						name: 'Image to Video - First Frame',
						value: 'i2v-first-frame',
						description: 'Generate video from first frame image',
					},
					{
						name: 'Image to Video - First & Last Frames',
						value: 'i2v-first-last',
						description: 'Generate video from first and last frames',
					},
					{
						name: 'Image to Video - Reference Images',
						value: 'i2v-reference',
						description: 'Generate video from 1-4 reference images',
					},
				],
				default: 'text-to-video',
				description: 'Select video generation mode',
			},
			{
				displayName: 'Video Prompt',
				name: 'videoPrompt',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				displayOptions: {
					show: {
						mode: ['video-generation'],
					},
				},
				default: '',
				required: true,
				description: 'Describe the video you want to generate',
			},
			{
				displayName: 'Resolution',
				name: 'videoResolution',
				type: 'options',
				displayOptions: {
					show: {
						mode: ['video-generation'],
					},
				},
				options: VIDEO_RESOLUTIONS,
				default: '720p',
				description: 'Video resolution',
			},
			{
				displayName: 'Aspect Ratio',
				name: 'videoRatio',
				type: 'options',
				displayOptions: {
					show: {
						mode: ['video-generation'],
					},
				},
				options: VIDEO_ASPECT_RATIOS,
				default: '16:9',
				description: 'Video aspect ratio',
			},
			{
				displayName: 'Duration (seconds)',
				name: 'videoDuration',
				type: 'number',
				displayOptions: {
					show: {
						mode: ['video-generation'],
					},
				},
				default: 5,
				typeOptions: {
					minValue: 2,
					maxValue: 12,
				},
				description: 'Video duration in seconds (2-12s for most models, 4-12s for 1.5 pro)',
			},
			{
				displayName: 'Generate Audio',
				name: 'videoGenerateAudio',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						mode: ['video-generation'],
						videoModel: ['doubao-seedance-1-5-pro-251215'],
					},
				},
				description: 'Generate synchronized audio (speech, sound effects, music) for the video',
			},
			{
				displayName: 'First Frame Image',
				name: 'videoFirstFrame',
				type: 'string',
				displayOptions: {
					show: {
						mode: ['video-generation'],
						videoMode: ['i2v-first-frame', 'i2v-first-last'],
					},
				},
				default: '',
				description: 'URL or base64 of the first frame',
			},
			{
				displayName: 'Last Frame Image',
				name: 'videoLastFrame',
				type: 'string',
				displayOptions: {
					show: {
						mode: ['video-generation'],
						videoMode: ['i2v-first-last'],
					},
				},
				default: '',
				description: 'URL or base64 of the last frame',
			},
			{
				displayName: 'Reference Images',
				name: 'videoReferenceImages',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						mode: ['video-generation'],
						videoMode: ['i2v-reference'],
					},
				},
				default: {},
				description: '1-4 reference images for video generation',
				options: [
					{
						displayName: 'Image',
						name: 'image',
						values: [
							{
								displayName: 'Image URL',
								name: 'url',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Seed',
				name: 'videoSeed',
				type: 'number',
				displayOptions: {
					show: {
						mode: ['video-generation'],
					},
				},
				default: SEED.DEFAULT,
				typeOptions: {
					minValue: SEED.MIN,
					maxValue: SEED.MAX,
				},
				description: 'Random seed for generation (-1 for random)',
			},
			{
				displayName: 'Add Watermark',
				name: 'videoWatermark',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						mode: ['video-generation'],
					},
				},
				description: 'Add watermark to generated video',
			},
			{
				displayName: 'Output Mode',
				name: 'videoOutputMode',
				type: 'options',
				displayOptions: {
					show: {
						mode: ['video-generation'],
					},
				},
				options: [
					{
						name: 'URL Only',
						value: 'url',
						description: 'Return video URL only (recommended)',
					},
					{
						name: 'Binary Data',
						value: 'binary',
						description: 'Download and include video file',
					},
				],
				default: 'url',
				required: true,
			},
		],
	};

	/**
	 * Executes the Doubao generation node
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		this.logger?.info('Starting Doubao generation', {
			itemCount: items.length,
		});

		for (let i = 0; i < items.length; i++) {
			try {
				const credentials = await this.getCredentials<DoubaoApiCredentials>('doubaoApi');
				if (!credentials || !credentials.apiKey) {
					throw new NodeOperationError(
						this.getNode(),
						'API Key is required. Please configure your Doubao API credentials.',
						{ itemIndex: i }
					);
				}

				this.logger?.info('[Doubao] Processing item', { index: i });

				const mode = this.getNodeParameter('mode', i) as string;

				let result: INodeExecutionData;
				if (mode === 'video-generation') {
					result = await DoubaoGen.executeVideoGeneration(this, i, credentials);
				} else {
					result = await DoubaoGen.executeGeneration(this, i, credentials);
				}

				results.push(result);
			} catch (error) {
				const errorCode = error instanceof MediaGenError ? error.code : 'UNKNOWN';

				this.logger?.error('[Doubao] Execution failed', {
					error: error instanceof Error ? error.message : String(error),
					errorCode,
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
	 * Executes Doubao API generation
	 */
	private static async executeGeneration(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials: DoubaoApiCredentials
	): Promise<INodeExecutionData> {
		const baseUrl = credentials.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';

		context.logger?.info('[Doubao] Starting generation', {
			itemIndex,
			baseUrl,
		});

		const mode = context.getNodeParameter('mode', itemIndex) as string;
		const model = context.getNodeParameter('model', itemIndex) as string;
		const prompt = context.getNodeParameter('prompt', itemIndex) as string;
		const resolutionLevel = context.getNodeParameter('resolutionLevel', itemIndex) as string || '2K';

		// Get size based on resolution level
		let size: string;
		if (resolutionLevel === '2K') {
			size = context.getNodeParameter('size2K', itemIndex) as string || '2048x2048';
		} else {
			size = context.getNodeParameter('size4K', itemIndex) as string || '4096x4096';
		}

		const seed = context.getNodeParameter('seed', itemIndex) as number || -1;

		const timeout = getTimeoutOrDefault(context, 'options.timeout', itemIndex, DEFAULT_TIMEOUTS.IMAGE_GENERATION);

		// Validate prompt
		validatePrompt(prompt, context, itemIndex);

		// Get input image for image-to-image mode
		let inputImage = '';
		if (mode === 'image-to-image') {
			const inputImageType = context.getNodeParameter('inputImageType', itemIndex) as string;
			if (inputImageType === 'binary') {
				const binaryPropertyName = context.getNodeParameter('inputImageBinary', itemIndex) as string;
				const items = context.getInputData();
				const binaryData = items[itemIndex].binary;

				if (!binaryData || !binaryData[binaryPropertyName]) {
					throw new NodeOperationError(
						context.getNode(),
						`Binary property '${binaryPropertyName}' not found.`,
						{ itemIndex }
					);
				}

				const binary = binaryData[binaryPropertyName] as { data: string; mimeType: string };
				if (binary.data) {
					inputImage = `data:${binary.mimeType || 'image/jpeg'};base64,${binary.data}`;
				}
			} else {
				inputImage = context.getNodeParameter('inputImage', itemIndex) as string || '';
			}
		}

		// Validate input image for image-to-image mode
		if (mode === 'image-to-image' && !inputImage) {
			throw new NodeOperationError(
				context.getNode(),
				'Input image is required for image-to-image mode',
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
					seed: seed >= 0 ? seed : undefined,
				};

				context.logger?.info('[Doubao] Sending text-to-image request', {
					model,
					prompt: prompt.substring(0, 50) + '...',
					size,
				});

				const data = await makeHttpRequest(context, {
					method: 'POST',
					url: `${baseUrl}/images/generations`,
					credentials,
					body: requestBody,
					timeout,
				}) as SeedreamResponse;

				// Parse response - support both OpenAI format and legacy format
				if (data.data && data.data.length > 0 && data.data[0].url) {
					// OpenAI-compatible format: { data: [{ url: "..." }] }
					imageUrl = data.data[0].url;
				} else if (data.data && data.data.length > 0 && data.data[0].b64_json) {
					// OpenAI-compatible format with base64
					imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
				} else if (data.output_url) {
					// Legacy format: { output_url: "..." }
					imageUrl = data.output_url;
				} else {
					context.logger?.error('[Doubao] Unexpected response format', { data });
					throw new MediaGenError('No image data returned from API', 'API_ERROR');
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

				// Add input image
				if (inputImage.startsWith('data:')) {
					// Base64 image
					const base64Data = inputImage.split(',')[1];
					const byteCharacters = atob(base64Data);
					const byteNumbers = new Array(byteCharacters.length);
					for (let i = 0; i < byteCharacters.length; i++) {
						byteNumbers[i] = byteCharacters.charCodeAt(i);
					}
					const byteArray = new Uint8Array(byteNumbers);
					const blob = new Blob([byteArray], { type: 'image/jpeg' });
					formData.append('image', blob, 'image.jpg');
				} else {
					// URL - append as-is
					formData.append('image_url', inputImage);
				}

				context.logger?.info('[Doubao] Sending image-to-image request', {
					model,
					prompt: prompt.substring(0, 50) + '...',
					size,

				});

				const data = await makeHttpRequest(context, {
					method: 'POST',
					url: `${baseUrl}/images/edits`,
					credentials,
					body: formData,
					timeout,
				}) as SeedreamResponse;

				// Parse response - support both OpenAI format and legacy format
				if (data.data && data.data.length > 0 && data.data[0].url) {
					// OpenAI-compatible format: { data: [{ url: "..." }] }
					imageUrl = data.data[0].url;
				} else if (data.data && data.data.length > 0 && data.data[0].b64_json) {
					// OpenAI-compatible format with base64
					imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
				} else if (data.output_url) {
					// Legacy format: { output_url: "..." }
					imageUrl = data.output_url;
				} else {
					context.logger?.error('[Doubao] Unexpected response format', { data });
					throw new MediaGenError('No image data returned from API', 'API_ERROR');
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

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const binaryData: any = {};

			// Download image if URL returned (not base64)
			if (imageUrl && !imageUrl.startsWith('data:')) {
				try {
					context.logger?.info('[Doubao] Downloading image from URL');
					const imageBuffer = await makeHttpRequest(context, {
						method: 'GET',
						url: imageUrl,
						timeout: DEFAULT_TIMEOUTS.IMAGE_DOWNLOAD,
						encoding: 'arraybuffer',
					}) as Buffer;

					binaryData.data = createBinaryDataFromUrl(imageBuffer, imageUrl, 'doubao');

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
	 * Executes Seedance video generation
	 */
	private static async executeVideoGeneration(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials: DoubaoApiCredentials
	): Promise<INodeExecutionData> {
		// Get parameters
		const model = context.getNodeParameter('videoModel', itemIndex) as string;
		const videoMode = context.getNodeParameter('videoMode', itemIndex) as string;
		const prompt = context.getNodeParameter('videoPrompt', itemIndex) as string;
		const resolution = context.getNodeParameter('videoResolution', itemIndex) as string || '720p';
		const ratio = context.getNodeParameter('videoRatio', itemIndex) as string || '16:9';
		const duration = context.getNodeParameter('videoDuration', itemIndex) as number || 5;
		const seed = context.getNodeParameter('videoSeed', itemIndex) as number ?? -1;
		const watermark = context.getNodeParameter('videoWatermark', itemIndex) as boolean || false;
		const outputMode = context.getNodeParameter('videoOutputMode', itemIndex) as string;

		context.logger?.info('[Doubao Video] Starting video generation', {
			model,
			videoMode,
			resolution,
			ratio,
			duration,
		});

		// Build content array
		const content: SeedanceContentItem[] = [];

		// Add text prompt
		if (prompt && prompt.trim()) {
			content.push({
				type: 'text',
				text: prompt.trim(),
			});
		}

		// Add images based on mode
		if (videoMode === 'i2v-first-frame' || videoMode === 'i2v-first-last') {
			const firstFrame = context.getNodeParameter('videoFirstFrame', itemIndex) as string;
			if (!firstFrame || !firstFrame.trim()) {
				throw new NodeOperationError(
					context.getNode(),
					'First frame image is required for this mode',
					{ itemIndex }
				);
			}
			content.push({
				type: 'image_url',
				image_url: { url: firstFrame.trim() },
				role: 'first_frame',
			});

			if (videoMode === 'i2v-first-last') {
				const lastFrame = context.getNodeParameter('videoLastFrame', itemIndex) as string;
				if (!lastFrame || !lastFrame.trim()) {
					throw new NodeOperationError(
						context.getNode(),
						'Last frame image is required for this mode',
						{ itemIndex }
					);
				}
				content.push({
					type: 'image_url',
					image_url: { url: lastFrame.trim() },
					role: 'last_frame',
				});
			}
		}

		if (videoMode === 'i2v-reference') {
			const refImagesData = context.getNodeParameter('videoReferenceImages', itemIndex) as {
				image?: Array<{ url: string }>;
			};

			if (!refImagesData.image || refImagesData.image.length === 0) {
				throw new NodeOperationError(
					context.getNode(),
					'At least 1 reference image is required',
					{ itemIndex }
				);
			}

			if (refImagesData.image.length > 4) {
				throw new NodeOperationError(
					context.getNode(),
					'Maximum 4 reference images allowed',
					{ itemIndex }
				);
			}

			for (const img of refImagesData.image) {
				if (img.url && img.url.trim()) {
					content.push({
						type: 'image_url',
						image_url: { url: img.url.trim() },
						role: 'reference_image',
					});
				}
			}
		}

		// Build request body
		const requestBody: Record<string, any> = {
			model,
			content,
			resolution,
			ratio,
			duration,
			seed,
			watermark,
		};

		// Add generate_audio for Seedance 1.5 pro
		if (model === 'doubao-seedance-1-5-pro-251215') {
			try {
				const generateAudio = context.getNodeParameter('videoGenerateAudio', itemIndex) as boolean;
				requestBody.generate_audio = generateAudio;
			} catch (error) {
				// Parameter not available, skip
			}
		}

		const baseUrl = credentials.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';

		// Submit task
		const submitResponse = await makeHttpRequest(context, {
			method: 'POST',
			url: `${baseUrl}/contents/generations/tasks`,
			credentials,
			body: requestBody,
			timeout: 30000,
		}) as SeedanceSubmitResponse;

		if (!submitResponse.id) {
			throw new MediaGenError('No task ID returned from API', 'API_ERROR');
		}

		context.logger?.info('[Doubao Video] Task submitted', { taskId: submitResponse.id, model });

		// Poll for completion
		const status = await DoubaoGen.pollVideoTask(
			context,
			credentials,
			submitResponse.id
		);

		if (status.status === 'failed') {
			throw new MediaGenError(
				status.error?.message || 'Video generation failed',
				'VIDEO_GENERATION_FAILED'
			);
		}

		if (!status.content?.video_url) {
			throw new MediaGenError('No video URL in response', 'API_ERROR');
		}

		context.logger?.info('[Doubao Video] Generation completed', {
			taskId: submitResponse.id,
			videoUrl: status.content.video_url.substring(0, 50) + '...',
		});

		// Return based on output mode
		if (outputMode === 'binary') {
			// Download video
			const videoBuffer = await makeHttpRequest(context, {
				method: 'GET',
				url: status.content.video_url,
				timeout: DEFAULT_TIMEOUTS.VIDEO_DOWNLOAD,
				encoding: 'arraybuffer',
			}) as Buffer;

			return {
				json: {
					success: true,
					videoUrl: status.content.video_url,
					lastFrameUrl: status.content.last_frame_url,
					taskId: submitResponse.id,
					model,
					videoMode,
					_metadata: {
						timestamp: new Date().toISOString(),
						tokens: status.usage?.total_tokens,
					},
				},
				binary: {
					data: {
						data: videoBuffer.toString('base64'),
						mimeType: 'video/mp4',
						fileName: generateFileName(`doubao_video_${submitResponse.id}`, 'mp4'),
					},
				},
			};
		} else {
			return {
				json: {
					success: true,
					videoUrl: status.content.video_url,
					lastFrameUrl: status.content.last_frame_url,
					taskId: submitResponse.id,
					model,
					videoMode,
					_metadata: {
						timestamp: new Date().toISOString(),
						tokens: status.usage?.total_tokens,
					},
				},
			};
		}
	}

	/**
	 * Polls Seedance video generation task status
	 */
	private static async pollVideoTask(
		context: IExecuteFunctions,
		credentials: DoubaoApiCredentials,
		taskId: string
	): Promise<SeedanceTaskResponse> {
		return await pollTask({
			context,
			credentials,
			taskId,
			statusEndpoint: '/contents/generations/tasks',
			timeoutMs: DEFAULT_TIMEOUTS.VIDEO_GENERATION,
			onSuccessStatus: ['succeeded'],
			failureStatuses: ['failed', 'cancelled', 'expired'],
			logPrefix: 'Doubao Video',
		}) as SeedanceTaskResponse;
	}
}
