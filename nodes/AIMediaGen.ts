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
import { validateNumImages, validateSizeForModel, validateInputImage } from './utils/validators';

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
				displayName: 'Model',
				name: 'model',
				type: 'options',
				required: true,
				options: [
					{
						name: 'Z-Image (Generation)',
						value: 'Tongyi-MAI/Z-Image',
						description: 'High-quality text-to-image generation model',
					},
					{
						name: 'Qwen-Image-2512 (Generation)',
						value: 'Qwen-Image-2512',
						description: 'Advanced text-to-image generation model',
					},
					{
						name: 'Qwen-Image-Edit-2511 (Editing)',
						value: 'Qwen-Image-Edit-2511',
						description: 'Image editing model - requires input image',
					},
				],
				default: 'Tongyi-MAI/Z-Image',
				description: 'Select the AI model to use',
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
						model: ['Tongyi-MAI/Z-Image', 'Qwen-Image-2512', 'Qwen-Image-Edit-2511'],
					},
				},
			},
			// Input Image - only for Edit model
			{
				displayName: 'Input Image',
				name: 'inputImage',
				type: 'string',
				default: '',
				description: 'URL or base64 of the image to edit (required for Edit model)',
				displayOptions: {
					show: {
						model: ['Qwen-Image-Edit-2511'],
					},
				},
				placeholder: 'https://example.com/image.jpg or data:image/jpeg;base64,...',
			},
			// Size for Z-Image
			{
				displayName: 'Size',
				name: 'size',
				type: 'options',
				default: '1024x1024',
				options: [
					{ name: '512x512', value: '512x512' },
					{ name: '768x768', value: '768x768' },
					{ name: '1024x1024', value: '1024x1024' },
				],
				description: 'Image size (Z-Image supports up to 1024x1024)',
				displayOptions: {
					show: {
						model: ['Tongyi-MAI/Z-Image'],
					},
				},
			},
			// Size for Qwen-Image-2512
			{
				displayName: 'Size',
				name: 'size',
				type: 'options',
				default: '1024x1024',
				options: [
					{ name: '1024x1024', value: '1024x1024' },
					{ name: '1152x896', value: '1152x896' },
					{ name: '896x1152', value: '896x1152' },
					{ name: '1216x832', value: '1216x832' },
					{ name: '832x1216', value: '832x1216' },
					{ name: '1344x768', value: '1344x768' },
					{ name: '768x1344', value: '768x1344' },
					{ name: '1536x640', value: '1536x640' },
					{ name: '640x1536', value: '640x1536' },
				],
				description: 'Image size (Qwen-Image-2512 supports various aspect ratios)',
				displayOptions: {
					show: {
						model: ['Qwen-Image-2512'],
					},
				},
			},
			// Size for Qwen-Image-Edit-2511
			{
				displayName: 'Size',
				name: 'size',
				type: 'options',
				default: '1024x1024',
				options: [
					{ name: '1024x1024', value: '1024x1024' },
					{ name: '1152x896', value: '1152x896' },
					{ name: '896x1152', value: '896x1152' },
					{ name: '1216x832', value: '1216x832' },
					{ name: '832x1216', value: '832x1216' },
					{ name: '1344x768', value: '1344x768' },
					{ name: '768x1344', value: '768x1344' },
				],
				description: 'Output image size for editing',
				displayOptions: {
					show: {
						model: ['Qwen-Image-Edit-2511'],
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
				// Get credentials
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
				const inputImage = model === 'Qwen-Image-Edit-2511' ? this.getNodeParameter('inputImage', i) as string : '';
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
		const maxRetries = context.getNodeParameter('options.maxRetries', CONSTANTS.INDICES.FIRST_ITEM) as number;

		if (!prompt || prompt.trim() === '') {
			throw new NodeOperationError(
				context.getNode(),
				'Prompt is required',
				{ itemIndex }
			);
		}

		// Validate numImages range (for models that support it)
		const isEditModel = model === 'Qwen-Image-Edit-2511';
		if (!isEditModel) {
			validateNumImages(numImages);
		}

		// Validate size matches model
		validateSizeForModel(model, size);

		const baseUrl = credentials.baseUrl || CONSTANTS.API_ENDPOINTS.MODELSCOPE.BASE_URL;

		let inputImage = '';
		if (isEditModel) {
			inputImage = context.getNodeParameter('inputImage', itemIndex) as string || '';
			// Validate input image format
			validateInputImage(inputImage);
		}

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

			if (parameters.size) {
				requestBody.parameters = {
					size: parameters.size,
					seed: parameters.seed,
				};
			}

			if (parameters.num_images && parameters.input_image === undefined) {
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
				} else if (data?.error) {
					errorMessage = data.error;
				}

				throw new MediaGenError(errorMessage, errorCode, { statusCode: response.status });
			}

			const imageUrl = data?.output?.url || data?.url || data?.image_url;

			if (!imageUrl) {
				throw new MediaGenError('No image URL returned from API', 'API_ERROR');
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
