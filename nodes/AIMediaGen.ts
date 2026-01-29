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
 * ModelScope async task submission response
 */
interface ModelScopeAsyncSubmitResponse {
	task_id: string;
}

/**
 * ModelScope async task status response
 */
interface ModelScopeAsyncTaskResponse {
	task_status: 'PENDING' | 'RUNNING' | 'SUCCEED' | 'FAILED';
	output_images?: Array<{ url: string }>;
	message?: string;
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
				{
					name: 'Gemini 3 Pro Image Preview',
					value: 'gemini-3-pro-image-preview',
					description: 'Google high quality Pro model',
				},
			],
			default: 'nano-banana',
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
		// Nano Banana - Aspect Ratio (for Pro models)
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
			description: 'Select aspect ratio (for Pro models)',
			displayOptions: {
				show: {
					operation: ['nanoBanana'],
					nbModel: ['nano-banana-2', 'gemini-3-pro-image-preview'],
				},
			},
		},
		// Nano Banana - Resolution (for Pro models)
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
			description: 'Select resolution (for Pro models)',
			displayOptions: {
				show: {
					operation: ['nanoBanana'],
					nbModel: ['nano-banana-2', 'gemini-3-pro-image-preview'],
				},
			},
		},
		// Nano Banana - Size (for standard models)
		{
			displayName: 'Aspect Ratio',
			name: 'nbSize',
			type: 'options',
			default: '1024x1024',
			options: [
				{ name: '1:1 (1024x1024)', value: '1024x1024' },
				{ name: '2:3 (832x1248)', value: '832x1248' },
				{ name: '3:2 (1248x832)', value: '1248x832' },
				{ name: '3:4 (864x1184)', value: '864x1184' },
				{ name: '4:3 (1184x864)', value: '1184x864' },
				{ name: '4:5 (896x1152)', value: '896x1152' },
				{ name: '5:4 (1152x896)', value: '1152x896' },
				{ name: '9:16 (768x1344)', value: '768x1344' },
				{ name: '16:9 (1344x768)', value: '1344x768' },
				{ name: '21:9 (1536x672)', value: '1536x672' },
			],
			description: 'Image aspect ratio (1K resolution)',
			displayOptions: {
				show: {
					operation: ['nanoBanana'],
					nbModel: ['nano-banana'],
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
			name: 'size',
			type: 'options',
			default: '2048x2048',
			options: [
				{ name: '1:1 (2048x2048)', value: '2048x2048' },
				{ name: '16:9 (2048x1152)', value: '2048x1152' },
				{ name: '9:16 (1152x2048)', value: '1152x2048' },
				{ name: '4:3 (2048x1536)', value: '2048x1536' },
				{ name: '3:4 (1536x2048)', value: '1536x2048' },
				{ name: '1:2 (1024x2048)', value: '1024x2048' },
			],
			description: 'Image size (max 2K, various aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4, 1:2)',
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
			name: 'size',
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

				if (operation === 'nanoBanana') {
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
					result = await AIMediaGen.executeNanoBananaRequest(this, i, credentials);
					const elapsed = performanceMonitor.endTimer(timerId);

					performanceMonitor.recordMetric({
						timestamp: Date.now().toString(),
						provider: 'nanoBanana',
						model: this.getNodeParameter('nbModel', i) as string,
						mediaType: 'image',
						duration: elapsed,
						success: result.json.success as boolean,
						fromCache: (result.json._metadata as ResultMetadata)?.cached || false,
					});

					this.logger?.info('Execution completed', {
						model: this.getNodeParameter('nbModel', i),
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
							size = this.getNodeParameter('size', i) as string;
						} catch (error) {
							size = isZImage ? '2048x2048' : '1328x1328';
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
							inputImage = this.getNodeParameter('inputImage', i) as string || '';
						} catch (error) {
							this.logger?.warn('[AI Media Gen] Could not get inputImage for Edit model', { index: i, error });
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

				this.logger?.error('Execution failed', {
					operation,
					model: operation === 'nanoBanana' ? this.getNodeParameter('nbModel', i) : this.getNodeParameter('model', i),
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
				size = context.getNodeParameter('size', itemIndex) as string;
				context.logger?.info('[AI Media Gen] Size retrieved', { size, itemIndex });
			} catch (error) {
				// Use default size if parameter not set
				size = isZImage ? '2048x2048' : '1328x1328';
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
			const inputImageType = context.getNodeParameter('inputImageType', itemIndex) as string;
			if (inputImageType === 'binary') {
				// Get binary file from input
				const binaryPropertyName = context.getNodeParameter('inputImageBinary', itemIndex) as string;
				const items = context.getInputData();
				const item = items[itemIndex];
				const binaryData = item.binary;

				if (!binaryData || !binaryData[binaryPropertyName]) {
					throw new NodeOperationError(
						context.getNode(),
						`Binary property '${binaryPropertyName}' not found. Make sure to include a binary file in your input.`,
						{ itemIndex }
					);
				}

				const binary = binaryData[binaryPropertyName] as { data: string; mimeType: string };
				// Convert buffer to base64 if needed
				if (binary.data) {
					inputImage = `data:${binary.mimeType || 'image/jpeg'};base64,${binary.data}`;
				}
			} else {
				// Get URL or base64 string
				inputImage = context.getNodeParameter('inputImage', itemIndex) as string || '';
			}
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
					size: size || '1024x1024',
					seed: seed || 0,
					steps: steps || 30,
					num_images: numImages || 1,
					input_image: inputImage,
				},
				timeout
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
		timeout: number
	): Promise<string> {
		const startTime = Date.now();
		const pollUrl = `${baseUrl}/${CONSTANTS.API_ENDPOINTS.MODELSCOPE.TASK_STATUS}/${taskId}`;

		console.log('[AI Media Gen] Starting async task polling', { taskId, timeout });

		let pollCount = 0;
		while (Date.now() - startTime < timeout) {
			pollCount++;
			const elapsed = Date.now() - startTime;

			// Wait before polling (except first time)
			if (pollCount > 1) {
				await new Promise(resolve => setTimeout(resolve, CONSTANTS.ASYNC.POLL_INTERVAL_MS));
			}

			console.log('[AI Media Gen] Polling task status', { pollCount, elapsed, taskId });

			const response = await fetch(pollUrl, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'X-ModelScope-Task-Type': 'image_generation',
				},
			});

			const data = await response.json().catch(() => null) as ModelScopeAsyncTaskResponse | null;

			console.log('[AI Media Gen] Task status response', {
				statusCode: response.status,
				taskStatus: data?.task_status,
				hasOutputImages: !!data?.output_images?.length,
			});

			if (!response.ok) {
				console.error('[AI Media Gen] Task status check failed', {
					statusCode: response.status,
					statusText: response.statusText,
					data,
				});
				throw new MediaGenError(
					`Failed to check task status: ${response.status} ${response.statusText}`,
					'API_ERROR'
				);
			}

			if (!data || !data.task_status) {
				console.error('[AI Media Gen] Invalid task status response', { data });
				throw new MediaGenError('Invalid task status response', 'API_ERROR');
			}

			switch (data.task_status) {
				case 'SUCCEED':
					console.log('[AI Media Gen] Task succeeded', { taskId, pollCount, elapsed });
					if (data.output_images && data.output_images.length > 0) {
						return data.output_images[0].url;
					}
					throw new MediaGenError('Task succeeded but no image URL returned', 'API_ERROR');
				case 'FAILED':
					console.error('[AI Media Gen] Task failed', { taskId, message: data.message });
					throw new MediaGenError(data.message || 'Task failed', 'API_ERROR');
				case 'PENDING':
				case 'RUNNING':
					console.log('[AI Media Gen] Task still processing', { taskStatus: data.task_status, pollCount, elapsed });
					// Continue polling
					continue;
				default:
					console.error('[AI Media Gen] Unknown task status', { taskStatus: data.task_status });
					throw new MediaGenError(`Unknown task status: ${data.task_status}`, 'API_ERROR');
			}
		}

		console.error('[AI Media Gen] Task polling timeout', { taskId, pollCount, timeout });
		throw new MediaGenError('Task polling timeout', 'TIMEOUT');
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
		timeout: number
	): Promise<INodeExecutionData> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

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

			console.log('[AI Media Gen] Submitting async task', {
				url,
				model,
				promptLength: input.prompt?.length,
				hasAsyncHeader: true,
			});

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
					'X-ModelScope-Async-Mode': 'true',  // Enable async mode
				},
				body: JSON.stringify(requestBody),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			console.log('[AI Media Gen] Task submission response', {
				statusCode: response.status,
				statusText: response.statusText,
				ok: response.ok,
			});

			if (!response.ok) {
				let errorMessage = 'Failed to generate image';
				let errorCode = 'API_ERROR';

				// Log detailed error information for debugging
				console.error('[AI Media Gen] API Request Failed', {
					statusCode: response.status,
					statusText: response.statusText,
					requestUrl: url,
					requestBody: {
						model,
						prompt: input.prompt?.substring(0, 50) + '...',
						size: parameters.size,
					},
				});

				if (response.status === 401) {
					errorMessage = 'Authentication failed. Please check your API Key.';
					errorCode = 'INVALID_API_KEY';
				} else if (response.status === 429) {
					errorMessage = 'Rate limit exceeded. Please try again later.';
					errorCode = 'RATE_LIMIT';
				} else if (response.status === 408) {
					errorMessage = 'Request timeout.';
					errorCode = 'TIMEOUT';
				} else if (response.status === 503) {
					errorMessage = 'Service temporarily unavailable. Please try again later.';
					errorCode = 'SERVICE_UNAVAILABLE';
				}

				throw new MediaGenError(errorMessage, errorCode, { statusCode: response.status });
			}

			// Parse task submission response
			const submitData = await response.json().catch(() => null) as ModelScopeAsyncSubmitResponse | null;

			console.log('[AI Media Gen] Task submission data', {
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
				CONSTANTS.ASYNC.POLL_TIMEOUT_MS
			);

			console.log('[AI Media Gen] Image generation completed', {
				imageUrl,
				model,
			});

			// Validate URL format
			if (!CONSTANTS.VALIDATION.URL_PATTERN.test(imageUrl)) {
				throw new MediaGenError(`Invalid image URL format: ${imageUrl}`, 'API_ERROR');
			}

			return {
				json: {
					success: true,
					imageUrl,
					model,
					_metadata: {
						timestamp: new Date().toISOString(),
					},
				},
			};
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof Error && error.name === 'AbortError') {
				throw new MediaGenError('Request timeout', 'TIMEOUT');
			}

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

		// Resolution map for Nano Banana Pro (aspect ratio -> resolution)
		const PRO_RESOLUTION_MAP: Record<string, Record<string, string>> = {
			'1:1': { '1K': '1024x1024', '2K': '2048x2048', '4K': '4096x4096' },
			'2:3': { '1K': '848x1264', '2K': '1696x2528', '4K': '3392x5056' },
			'3:2': { '1K': '1264x848', '2K': '2528x1696', '4K': '5056x3392' },
			'3:4': { '1K': '896x1200', '2K': '1792x2400', '4K': '3584x4800' },
			'4:3': { '1K': '1200x896', '2K': '2400x1792', '4K': '4800x3584' },
			'4:5': { '1K': '928x1152', '2K': '1856x2304', '4K': '3712x4608' },
			'5:4': { '1K': '1152x928', '2K': '2304x1856', '4K': '4608x3712' },
			'9:16': { '1K': '768x1376', '2K': '1536x2752', '4K': '3072x5504' },
			'16:9': { '1K': '1376x768', '2K': '2752x1536', '4K': '5504x3072' },
			'21:9': { '1K': '1584x672', '2K': '3168x1344', '4K': '6336x2688' },
		};

		// Get parameters
		const mode = context.getNodeParameter('nbMode', itemIndex) as string;
		const model = context.getNodeParameter('nbModel', itemIndex) as string;
		const prompt = context.getNodeParameter('nbPrompt', itemIndex) as string;

		// Determine size based on model type
		let size = '1024x1024';
		const proModels = ['nano-banana-2', 'gemini-3-pro-image-preview'];
		const standardModels = ['nano-banana'];

		if (proModels.includes(model)) {
			// For Pro models, get aspect ratio and resolution
			const aspectRatio = context.getNodeParameter('nbAspectRatio', itemIndex) as string || '1:1';
			const resolution = context.getNodeParameter('nbResolution', itemIndex) as string || '1K';

			if (PRO_RESOLUTION_MAP[aspectRatio] && PRO_RESOLUTION_MAP[aspectRatio][resolution]) {
				size = PRO_RESOLUTION_MAP[aspectRatio][resolution];
			} else {
				size = '1024x1024';
			}

			context.logger?.info('[Pro Model] Using calculated size', {
				model,
				aspectRatio,
				resolution,
				size,
			});
		} else if (standardModels.includes(model)) {
			// For standard models, get size directly
			size = context.getNodeParameter('nbSize', itemIndex) as string || '1024x1024';
		} else {
			// Unknown model, use default
			size = '1024x1024';
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

		// Collect input images from fixedCollection
		const referenceImages: string[] = [];
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
			const proModels = ['nano-banana-2', 'gemini-3-pro-image-preview'];
			const maxImages = proModels.includes(model) ? 14 : 4;
			if (referenceImages.length > maxImages) {
				throw new NodeOperationError(
					context.getNode(),
					`Maximum ${maxImages} reference images allowed for ${model}. You provided ${referenceImages.length}.`,
					{ itemIndex }
				);
			}

			if (referenceImages.length > 0) {
				console.log(`[${model}] Reference images loaded`, {
					count: referenceImages.length,
					maxAllowed: maxImages,
				});
			}
		} catch (error) {
			// No reference images or error accessing them
			console.log(`[${model}] No reference images or error loading them`, {
				error: error instanceof Error ? error.message : String(error),
			});
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			let imageUrl: string = '';

			// All Gemini models use Gemini native format
			const isProModel = ['nano-banana-2', 'gemini-3-pro-image-preview'].includes(model);

			if (isProModel) {
				// Pro models: use aspectRatio and imageSize
				const aspectRatio = context.getNodeParameter('nbAspectRatio', itemIndex) as string || '1:1';
				const resolution = context.getNodeParameter('nbResolution', itemIndex) as string || '1K';

				// Build parts array: images first, then text
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
						console.warn(`[${model}] URL images not supported in native format, skipping`);
					}
				}

				// Add text prompt at the end
				parts.push({ text: prompt.trim() });

				const requestBody = {
					contents: [
						{
							parts,
							role: 'user',
						},
					],
					generationConfig: {
						responseModalities: ['IMAGE'],
						imageConfig: {
							aspectRatio,
							imageSize: resolution,
						},
					},
				};

				console.log(`[${model}] Sending generation request`, {
					requestBody: {
						contents: [{ parts: [{ text: prompt.substring(0, 50) + '...' }], role: 'user' }],
						generationConfig: {
							responseModalities: ['IMAGE'],
							imageConfig: {
								aspectRatio,
								imageSize: resolution,
							},
						},
					},
					baseUrl,
					fullUrl: `${baseUrl}/v1beta/models/${model}:generateContent`,
					model,
				});

				const response = await fetch(`${baseUrl}/v1beta/models/${model}:generateContent`, {
					method: 'POST',
					headers: {
						'x-goog-api-key': credentials.apiKey,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(requestBody),
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorText = await response.text();
					console.error(`[${model}] API error`, {
						status: response.status,
						statusText: response.statusText,
						body: errorText,
					});

					// Try to parse error response for more details
					let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
					try {
						const errorData = JSON.parse(errorText);
						if (errorData.error?.message) {
							errorMessage = errorData.error.message;
						}
					} catch {
						// Use default error message
					}

					throw new MediaGenError(errorMessage, 'API_ERROR', {
						statusCode: response.status,
						statusText: response.statusText,
						body: errorText,
					});
				}

				const data = await response.json() as any;

				// Parse standard Gemini API response format
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
								const markdownImageMatch = part.text.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
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

				console.log(`[${model}] Generation completed`, {
					imageUrl: imageUrl.substring(0, 50) + '...',
				});
			} else {
				// Standard models (nano-banana): convert size to aspect ratio
				// Build parts array: images first, then text
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
						console.warn(`[${model}] URL images not supported in native format, skipping`);
					}
				}

				// Add text prompt at the end
				parts.push({ text: prompt.trim() });

				// Convert size resolution to aspect ratio string
				const sizeToAspectRatio: Record<string, string> = {
					'1024x1024': '1:1',
					'832x1248': '2:3',
					'1248x832': '3:2',
					'864x1184': '3:4',
					'1184x864': '4:3',
					'896x1152': '4:5',
					'1152x896': '5:4',
					'768x1344': '9:16',
					'1344x768': '16:9',
					'1536x672': '21:9',
				};

				// Build request body - all models use aspect ratio
				const requestBody: Record<string, unknown> = {
					contents: [
						{
							parts,
							role: 'user',
						},
					],
					generationConfig: {
						responseModalities: ['IMAGE'],
						imageConfig: {
							aspectRatio: sizeToAspectRatio[size] || '1:1',
						},
					},
				};

				console.log(`[${model}] Sending generation request`, {
					requestBody: {
						contents: [{ parts: [{ text: prompt.substring(0, 50) + '...' }], role: 'user' }],
						generationConfig: {
							responseModalities: ['IMAGE'],
							imageConfig: {
								aspectRatio: sizeToAspectRatio[size],
							},
						},
					},
					baseUrl,
					fullUrl: `${baseUrl}/v1beta/models/${model}:generateContent`,
					model,
				});

				const response = await fetch(`${baseUrl}/v1beta/models/${model}:generateContent`, {
					method: 'POST',
					headers: {
						'x-goog-api-key': credentials.apiKey,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(requestBody),
					signal: controller.signal,
				});

				console.log(`[${model}] Request body`, JSON.stringify(requestBody, null, 2));

				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorText = await response.text();
					console.error(`[${model}] API error`, {
						status: response.status,
						statusText: response.statusText,
						body: errorText,
					});

					// Try to parse error response for more details
					let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
					try {
						const errorData = JSON.parse(errorText);
						if (errorData.error?.message) {
							errorMessage = errorData.error.message;
						}
					} catch {
						// Use default error message
					}

					throw new MediaGenError(errorMessage, 'API_ERROR', {
						statusCode: response.status,
						statusText: response.statusText,
						body: errorText,
					});
				}

				const data = await response.json() as any;

				// Parse standard Gemini API response format
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
								const markdownImageMatch = part.text.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
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

				console.log(`[${model}] Generation completed`, {
					imageUrl: imageUrl.substring(0, 50) + '...',
				});
			}

			// Download image binary data
			let binaryData: { data: string; mimeType: string } | undefined;
			if (imageUrl && !imageUrl.startsWith('data:')) {
				try {
					const imageResponse = await fetch(imageUrl);
					if (imageResponse.ok) {
						const buffer = await imageResponse.arrayBuffer();
						const base64 = Buffer.from(buffer).toString('base64');

						// Determine mime type from URL or response
						let mimeType = 'image/png';
						const contentType = imageResponse.headers.get('content-type');
						if (contentType) {
							mimeType = contentType;
						} else if (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.jpeg')) {
							mimeType = 'image/jpeg';
						} else if (imageUrl.endsWith('.webp')) {
							mimeType = 'image/webp';
						} else if (imageUrl.endsWith('.gif')) {
							mimeType = 'image/gif';
						}

						binaryData = { data: base64, mimeType };

						const bufferObj = Buffer.from(buffer);
						const dimensions = getImageDimensions(bufferObj);
						console.log(`[${model}] Image downloaded`, {
							mimeType,
							fileSize: buffer.byteLength,
							dimensions: dimensions ? `${dimensions.width}x${dimensions.height}` : 'unknown',
							fileName: imageUrl.split('/').pop()?.split('?')[0],
						});
					}
				} catch (error) {
					console.warn(`[${model}] Failed to download image`, { error: error instanceof Error ? error.message : String(error) });
				}
			} else if (imageUrl && imageUrl.startsWith('data:')) {
				// Already base64, extract data
				const match = imageUrl.match(/data:([^;]+);base64,(.+)/);
				if (match) {
					binaryData = { data: match[2], mimeType: match[1] };
				}
			}

			const result: INodeExecutionData = {
				json: {
					success: true,
					imageUrl,
					model,
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
						fileName: `generated-${model}-${Date.now()}.${binaryData.mimeType.split('/')[1] || 'png'}`,
					},
				};
			}

			return result;
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof Error && error.name === 'AbortError') {
				throw new MediaGenError('Request timeout', 'TIMEOUT');
			}

			if (error instanceof MediaGenError) {
				throw error;
			}

			throw new MediaGenError(
				error instanceof Error ? error.message : String(error),
				'NETWORK_ERROR'
			);
		}
	}
}
