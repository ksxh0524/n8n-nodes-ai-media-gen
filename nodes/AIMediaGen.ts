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
 * ModelScope API response structure
 */
interface ModelScopeApiResponse {
	/** Output data containing the image URL */
	output?: { url?: string };
	/** Alternative URL field */
	url?: string;
	/** Alternative image URL field */
	image_url?: string;
	/** Error message if the request failed */
	error?: string;
}

/**
 * AI Media Generation Node
 *
 * Generates and edits images using ModelScope AI models including:
 * - Z-Image: High-quality text-to-image generation
 * - Qwen-Image-2512: Advanced text-to-image generation
 * - Qwen-Image-Edit-2511: Image editing model
 */
export class AIMediaGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI Media Generation',
		name: 'aiMediaGen',
		icon: 'file:ai-media-gen.svg',
		description: 'Generate and edit images using ModelScope AI models',
		version: CONSTANTS.NODE_VERSION,
		group: ['transform'],
		subtitle: '={{$parameter.model}}',
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
					name: 'modelscope',
					value: 'modelscope',
					description: 'Generate and edit images using ModelScope AI models',
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
					value: 'Qwen-Image-2512',
					description: 'Advanced text-to-image generation model',
				},
				{
					name: 'Qwen-Image-Edit-2511',
					value: 'Qwen-Image-Edit-2511',
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
					model: ['Qwen-Image-Edit-2511'],
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
					model: ['Qwen-Image-Edit-2511'],
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
					model: ['Qwen-Image-Edit-2511'],
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
					model: ['Qwen-Image-2512'],
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
					model: ['Tongyi-MAI/Z-Image', 'Qwen-Image-2512'],
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
					model: ['Tongyi-MAI/Z-Image', 'Qwen-Image-2512'],
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
	 * Processes input items and generates/edits images using ModelScope AI models.
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
		const enableCache = this.getNodeParameter('options.enableCache', CONSTANTS.INDICES.FIRST_ITEM) as boolean;
		const cacheManager = new CacheManager();
		const performanceMonitor = new PerformanceMonitor();

		for (let i = 0; i < items.length; i++) {
			try {
				const credentials = await this.getCredentials<ModelScopeApiCredentials>('modelScopeApi');
				if (!credentials || !credentials.apiKey) {
					throw new NodeOperationError(
						this.getNode(),
						'API Key is required. Please configure your ModelScope API credentials.',
						{ itemIndex: i }
					);
				}

				const timerId = performanceMonitor.startTimer('aiMediaGen');
				let result: INodeExecutionData;

				const model = this.getNodeParameter('model', i) as string;
				const size = this.getNodeParameter('size', i) as string;
				const seed = this.getNodeParameter('seed', i) as number;
				const numImages = this.getNodeParameter('numImages', i) as number;
				const inputImage = this.getNodeParameter('inputImage', i) as string || '';
				const timeout = this.getNodeParameter('options.timeout', i) as number;

				if (enableCache) {
					const prompt = this.getNodeParameter('prompt', i) as string || '';
					const cacheKey = CacheKeyGenerator.forGeneration(
						'modelscope',
						model,
						prompt,
						{
							size: size || '1024x1024',
							seed: seed || 0,
							num_images: numImages || 1,
							input_image: inputImage,
						}
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

						if (result.json.success) {
							await cacheManager.set(cacheKey, result.json, this.getNodeParameter('options.cacheTtl', i) as number);
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
			} catch (error) {
				this.logger?.error('Execution failed', {
					model: this.getNodeParameter('model', i),
					error: error instanceof Error ? error.message : String(error),
				});

				const errorCode = error instanceof MediaGenError ? error.code : 'UNKNOWN';
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
		const model = context.getNodeParameter('model', itemIndex) as string;
		const prompt = context.getNodeParameter('prompt', itemIndex) as string;
		const size = context.getNodeParameter('size', itemIndex) as string;
		const seed = context.getNodeParameter('seed', itemIndex) as number;
		const numImages = context.getNodeParameter('numImages', itemIndex) as number;
		const maxRetries = context.getNodeParameter('options.maxRetries', itemIndex) as number;

		// Get input image based on type
		let inputImage = '';
		const isEditModel = model === 'Qwen-Image-Edit-2511';

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
					num_images: numImages || 1,
					input_image: inputImage,
				},
				timeout
			),
			{ maxRetries }
		);
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
		parameters: { size?: string; seed: number; num_images?: number; input_image?: string },
		timeout: number
	): Promise<INodeExecutionData> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const requestBody: Record<string, unknown> = {
				model,
				input,
			};

			// Edit model (Qwen-Image-Edit-2511) doesn't use size parameter
			const isEditModel = model === 'Qwen-Image-Edit-2511';

			// Generate random seed when seed is 0
			const actualSeed = parameters.seed === 0 ? Math.floor(Math.random() * 2147483647) : parameters.seed;

			if (parameters.size && !isEditModel) {
				requestBody.parameters = {
					size: parameters.size,
					seed: actualSeed,
				};
			}

			// Only include num_images for models that support it and when it's set
			if (parameters.num_images && parameters.num_images > 1 && !isEditModel) {
				(requestBody.parameters as Record<string, unknown>).num_images = parameters.num_images;
			}

			if (parameters.input_image) {
				(input as Record<string, unknown>).image = parameters.input_image;
			}

			const response = await fetch(`${baseUrl}${CONSTANTS.API_ENDPOINTS.MODELSCOPE.FILES_GENERATION}`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestBody),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			const data = await response.json().catch(() => null) as ModelScopeApiResponse | null;

			if (!response.ok) {
				let errorMessage = 'Failed to generate image';
				let errorCode = 'API_ERROR';

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
				} else if (data?.error) {
					errorMessage = data.error;
				}

				throw new MediaGenError(errorMessage, errorCode, { statusCode: response.status });
			}

			const imageUrl = data?.output?.url || data?.url || data?.image_url;

			if (!imageUrl) {
				throw new MediaGenError('No image URL returned from API', 'API_ERROR');
			}

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
}
