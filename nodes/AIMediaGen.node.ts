import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
} from 'n8n-workflow';
import { ActionRegistry } from './utils/actionRegistry';
import type { ActionType } from './utils/actionHandler';
import { CacheManager } from './utils/cache';
import { PerformanceMonitor } from './utils/monitoring';
import * as CONSTANTS from './utils/constants';

const ACTIONS: Array<{ name: string; value: ActionType }> = [
	{ name: 'Sora (Video Generation)', value: 'sora' },
	{ name: 'Nano Banana (Image Generation)', value: 'nanoBanana' },
	{ name: 'ModelScope (Multi-Model)', value: 'modelScope' },
	{ name: 'Media Processing', value: 'processing' },
];

export class AIMediaGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI Media Generation',
		name: 'aiMediaGen',
		icon: 'file:ai-media-gen.svg',
		description: 'Generate and process media using AI models and local processing',
		version: CONSTANTS.NODE_VERSION,
		group: ['transform'],
		subtitle: '={{$parameter.action}}',
		defaults: {
			name: 'AI Media Generation',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'openAiApi',
				required: false,
			},
			{
				name: 'nanoBananaApi',
				required: false,
			},
			{
				name: 'modelScopeApi',
				required: false,
			},
		],
		properties: [
			{
				displayName: 'Action',
				name: 'action',
				type: 'options',
				noDataExpression: true,
				options: ACTIONS,
				default: 'sora',
				required: true,
				description: 'Select the action to perform',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'e.g., sora-2, nano-banana, qwen-image',
				description: 'Model name',
				displayOptions: {
					show: {
						action: ['sora', 'nanoBanana', 'modelScope'],
					},
				},
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					rows: CONSTANTS.UI.TEXT_AREA_ROWS.PROMPT,
				},
				default: '',
				required: true,
				description: 'Text prompt for generation',
				displayOptions: {
					show: {
						action: ['sora', 'nanoBanana', 'modelScope'],
					},
				},
			},
			{
				displayName: 'Edit Image',
				name: 'editImage',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/image.jpg or base64...',
				description: 'URL or base64 of image to edit (for edit models)',
				displayOptions: {
					show: {
						action: ['modelScope'],
						model: ['qwen-image-edit'],
					},
				},
			},
			{
				displayName: 'Size',
				name: 'size',
				type: 'options',
				default: '1024x1024',
				options: [
					{ name: '256x256', value: '256x256' },
					{ name: '512x512', value: '512x512' },
					{ name: '1024x1024', value: '1024x1024' },
					{ name: '2048x2048', value: '2048x2048' },
				],
				description: 'Image size',
				displayOptions: {
					show: {
						action: ['nanoBanana', 'modelScope'],
					},
				},
			},
			{
				displayName: 'Duration (seconds)',
				name: 'duration',
				type: 'number',
				default: 10,
				description: 'Video duration in seconds',
				displayOptions: {
					show: {
						action: ['sora'],
					},
				},
			},
			{
				displayName: 'Aspect Ratio',
				name: 'aspectRatio',
				type: 'options',
				default: '16:9',
				options: [
					{ name: '16:9 (Landscape)', value: '16:9' },
					{ name: '9:16 (Portrait)', value: '9:16' },
					{ name: '1:1 (Square)', value: '1:1' },
					{ name: '4:3 (Landscape)', value: '4:3' },
					{ name: '3:4 (Portrait)', value: '3:4' },
				],
				description: 'Video aspect ratio',
				displayOptions: {
					show: {
						action: ['sora'],
					},
				},
			},
			{
				displayName: 'Quality',
				name: 'quality',
				type: 'number',
				default: 85,
				description: 'Output quality (1-100)',
				displayOptions: {
					show: {
						action: ['nanoBanana', 'modelScope'],
					},
				},
			},
			{
				displayName: 'Number of Images',
				name: 'numImages',
				type: 'number',
				default: 1,
				description: 'Number of images to generate',
				displayOptions: {
					show: {
						action: ['nanoBanana', 'modelScope'],
					},
				},
			},
			{
				displayName: 'Seed',
				name: 'seed',
				type: 'number',
				default: 0,
				description: 'Random seed for reproducibility',
				displayOptions: {
					show: {
						action: ['nanoBanana', 'modelScope'],
					},
				},
			},
			{
				displayName: 'Media Type',
				name: 'mediaType',
				type: 'options',
				default: 'image',
				options: [
					{ name: 'Image', value: 'image' },
					{ name: 'Video', value: 'video' },
				],
				description: 'Type of media to process',
				displayOptions: {
					show: {
						action: ['processing'],
					},
				},
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'resize',
				options: [
					{ name: 'Resize', value: 'resize' },
					{ name: 'Crop', value: 'crop' },
					{ name: 'Convert Format', value: 'convert' },
					{ name: 'Filter', value: 'filter' },
					{ name: 'Watermark', value: 'watermark' },
					{ name: 'Compress', value: 'compress' },
					{ name: 'Rotate', value: 'rotate' },
					{ name: 'Flip', value: 'flip' },
					{ name: 'Adjust', value: 'adjust' },
					{ name: 'Blur', value: 'blur' },
					{ name: 'Sharpen', value: 'sharpen' },
					{ name: 'Transcode', value: 'transcode' },
					{ name: 'Trim', value: 'trim' },
					{ name: 'Extract Frames', value: 'extractFrames' },
					{ name: 'Add Audio', value: 'addAudio' },
					{ name: 'Extract Audio', value: 'extractAudio' },
					{ name: 'Resize Video', value: 'resizeVideo' },
				],
				description: 'Processing operation to perform',
				displayOptions: {
					show: {
						action: ['processing'],
					},
				},
			},
			{
				displayName: 'Binary Property Name',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				description: 'Name of the binary property to process from the input',
				displayOptions: {
					show: {
						action: ['processing'],
					},
				},
			},
			{
				displayName: 'Width',
				name: 'width',
				type: 'number',
				default: 0,
				description: 'Target width (0 to keep original)',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['resize'],
					},
				},
			},
			{
				displayName: 'Height',
				name: 'height',
				type: 'number',
				default: 0,
				description: 'Target height (0 to keep original)',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['resize'],
					},
				},
			},
			{
				displayName: 'Fit',
				name: 'fit',
				type: 'options',
				default: 'cover',
				options: [
					{ name: 'Cover', value: 'cover' },
					{ name: 'Contain', value: 'contain' },
					{ name: 'Fill', value: 'fill' },
					{ name: 'Inside', value: 'inside' },
					{ name: 'Outside', value: 'outside' },
				],
				description: 'How to fit the image when resizing',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['resize'],
					},
				},
			},
			{
				displayName: 'Format',
				name: 'format',
				type: 'options',
				default: 'jpeg',
				options: [
					{ name: 'JPEG', value: 'jpeg' },
					{ name: 'PNG', value: 'png' },
					{ name: 'WebP', value: 'webp' },
					{ name: 'GIF', value: 'gif' },
					{ name: 'TIFF', value: 'tiff' },
					{ name: 'AVIF', value: 'avif' },
					{ name: 'MP4', value: 'mp4' },
					{ name: 'WebM', value: 'webm' },
				],
				description: 'Target format for conversion',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['convert', 'transcode'],
					},
				},
			},
			{
				displayName: 'Filter Type',
				name: 'filterType',
				type: 'options',
				default: 'blur',
				options: [
					{ name: 'Blur', value: 'blur' },
					{ name: 'Sharpen', value: 'sharpen' },
					{ name: 'Brightness', value: 'brightness' },
					{ name: 'Contrast', value: 'contrast' },
					{ name: 'Saturation', value: 'saturation' },
					{ name: 'Grayscale', value: 'grayscale' },
					{ name: 'Sepia', value: 'sepia' },
					{ name: 'Invert', value: 'invert' },
					{ name: 'Normalize', value: 'normalize' },
					{ name: 'Modulate', value: 'modulate' },
				],
				description: 'Filter type to apply',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['filter', 'adjust'],
					},
				},
			},
			{
				displayName: 'Filter Value',
				name: 'filterValue',
				type: 'number',
				default: 1,
				description: 'Filter value (intensity)',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['filter'],
					},
				},
			},
			{
				displayName: 'Watermark Image',
				name: 'watermarkImage',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/watermark.png',
				description: 'URL or base64 of watermark image',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['watermark'],
					},
				},
			},
			{
				displayName: 'Watermark Position',
				name: 'watermarkPosition',
				type: 'options',
				default: 'bottom-right',
				options: [
					{ name: 'Top Left', value: 'top-left' },
					{ name: 'Top Right', value: 'top-right' },
					{ name: 'Bottom Left', value: 'bottom-left' },
					{ name: 'Bottom Right', value: 'bottom-right' },
					{ name: 'Center', value: 'center' },
				],
				description: 'Watermark position',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['watermark'],
					},
				},
			},
			{
				displayName: 'Angle',
				name: 'angle',
				type: 'number',
				default: 0,
				description: 'Rotation angle in degrees',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['rotate'],
					},
				},
			},
			{
				displayName: 'Flip Horizontal',
				name: 'flipHorizontal',
				type: 'boolean',
				default: false,
				description: 'Flip horizontally',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['flip'],
					},
				},
			},
			{
				displayName: 'Flip Vertical',
				name: 'flipVertical',
				type: 'boolean',
				default: false,
				description: 'Flip vertically',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['flip'],
					},
				},
			},
			{
				displayName: 'Start Time',
				name: 'startTime',
				type: 'number',
				default: 0,
				description: 'Start time in seconds',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['trim'],
					},
				},
			},
			{
				displayName: 'End Time',
				name: 'endTime',
				type: 'number',
				default: 0,
				description: 'End time in seconds',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['trim'],
					},
				},
			},
			{
				displayName: 'Frame Rate',
				name: 'frameRate',
				type: 'number',
				default: 1,
				description: 'Frame rate for extraction',
				displayOptions: {
					show: {
						action: ['processing'],
						operation: ['extractFrames'],
					},
				},
			},
			{
				displayName: 'Additional Parameters (JSON)',
				name: 'additionalParams',
				type: 'string',
				typeOptions: {
					rows: CONSTANTS.UI.TEXT_AREA_ROWS.ADDITIONAL_PARAMS,
				},
				default: '{}',
				description: 'Additional parameters as JSON object',
			},
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		const actionRegistry = ActionRegistry.getInstance();
		const enableCache = this.getNodeParameter('options.enableCache', CONSTANTS.INDICES.FIRST_ITEM) as boolean;
		const cacheManager = new CacheManager();
		const performanceMonitor = new PerformanceMonitor();

		for (let i = 0; i < items.length; i++) {
			try {
				const action = this.getNodeParameter('action', i) as ActionType;
				const handler = actionRegistry.getHandler(action);

				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unknown action: ${action}`,
						{ itemIndex: i }
					);
				}

				let credentials;
				if (handler.requiresCredential) {
					const credentialType = handler.credentialType;
					credentials = await this.getCredentials(credentialType);

					if (!credentials) {
						throw new NodeOperationError(
							this.getNode(),
							`Credentials required for action: ${action}`,
							{ itemIndex: i }
						);
					}
				}

				const timerId = performanceMonitor.startTimer(action);

				let result: INodeExecutionData;

				if (enableCache && action !== 'processing') {
					const model = this.getNodeParameter('model', i) as string || '';
					const prompt = this.getNodeParameter('prompt', i) as string || '';
					const additionalParams = this.getNodeParameter('additionalParams', i) as string || '{}';
					const paramsStr = JSON.stringify(additionalParams || {});
					const promptHash = AIMediaGen.hashString(prompt);
					const paramsHash = AIMediaGen.hashString(paramsStr);
					const cacheKey = `${action}:${model}:${promptHash}:${paramsHash}`;
					const cached = await cacheManager.get(cacheKey);

					if (cached) {
						this.logger?.info('Cache hit', { action, cacheKey });
						result = {
							json: {
								success: true,
								...cached as Record<string, unknown>,
								_metadata: {
									action,
									cached: true,
									timestamp: new Date().toISOString(),
								},
							},
						};
					} else {
						this.logger?.info('Cache miss', { action, cacheKey });
						result = await handler.execute(this, i, credentials);

						if (result.json.success) {
							await cacheManager.set(cacheKey, result.json, this.getNodeParameter('options.cacheTtl', i) as number);
						}
					}
				} else {
					result = await handler.execute(this, i, credentials);
				}

				const elapsed = performanceMonitor.endTimer(timerId);

				performanceMonitor.recordMetric({
					timestamp: Date.now().toString(),
					provider: action,
					model: this.getNodeParameter('model', i) as string || 'processing',
					mediaType: handler.mediaType,
					duration: elapsed,
					success: result.json.success as boolean,
					fromCache: (result.json._metadata as any)?.cached || false,
				});

				this.logger?.info('Action executed', {
					action,
					duration: elapsed,
					success: result.json.success,
				});

				results.push(result);
			} catch (error) {
				this.logger?.error('Action failed', {
					action: this.getNodeParameter('action', i),
					error: error instanceof Error ? error.message : String(error),
				});

				results.push({
					json: {
						success: false,
						error: error instanceof Error ? error.message : String(error),
						errorCode: 'UNKNOWN',
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

	private static hashString(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(36);
	}
}
