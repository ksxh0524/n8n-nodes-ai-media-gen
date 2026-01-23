import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
} from 'n8n-workflow';
import { MediaGenError, withRetry, validateGenerationParams, validateCredentials } from './utils/errors';
import { detectMediaType, getDefaultBaseUrl, getEndpoint, getHeaders, buildRequestBody } from './utils/helpers';
import { CacheManager, CacheKeyGenerator } from './utils/cache';
import { PerformanceMonitor } from './utils/monitoring';
import { ImageProcessor } from './utils/imageProcessor';
import type { ApiFormat, MediaType } from './utils/types';
import * as CONSTANTS from './utils/constants';

const API_FORMATS: Array<{ name: string; value: ApiFormat }> = [
	{ name: 'OpenAI', value: 'openai' },
	{ name: 'Google Gemini', value: 'gemini' },
	{ name: 'Alibaba Bailian', value: 'bailian' },
	{ name: 'Replicate', value: 'replicate' },
	{ name: 'Hugging Face', value: 'huggingface' },
];

const RESOURCES = [
	{ name: 'Image', value: 'image' },
	{ name: 'Video', value: 'video' },
	{ name: 'Audio', value: 'audio' },
];

/**
 * AI Media Generation Node for n8n
 * 
 * This node provides functionality to generate and process media (images, videos, audio)
 * using multiple AI providers including OpenAI, Google Gemini, Alibaba Bailian, Replicate, and Hugging Face.
 * 
 * Features:
 * - Generate images, videos, and audio using AI models
 * - Process images (resize, format conversion, quality adjustment)
 * - Built-in caching to reduce API calls
 * - Performance monitoring and metrics
 * - Comprehensive error handling
 */
export class AIMediaGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI Media Generation',
		name: 'aiMediaGen',
		icon: 'file:ai-media-gen.svg',
		description: 'Generate images, videos, and audio using multiple AI providers',
		version: CONSTANTS.NODE_VERSION,
		group: ['ai' as any],
		defaults: {
			name: 'AI Media Generation',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'aiMediaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: RESOURCES,
				default: 'image',
				required: true,
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: RESOURCES.map(r => r.value),
					},
				},
				options: [
					{ name: 'Generate', value: 'generate' },
					{ name: 'Process', value: 'process' },
				],
				default: 'generate',
				required: true,
			},
			{
				displayName: 'API Format',
				name: 'apiFormat',
				type: 'options',
				options: API_FORMATS,
				default: 'openai',
				required: true,
				description: 'Select API provider to use',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'e.g., dall-e-3, imagen-2.0, wanx-v1, tts-1, sora',
				description: 'Model name (supports automatic media type detection)',
				displayOptions: {
					show: {
						operation: ['generate'],
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
						operation: ['generate'],
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
				description: 'Additional parameters as JSON object (e.g., {"size": "1024x1024", "n": 1})',
				displayOptions: {
					show: {
						operation: ['generate'],
					},
				},
			},
			{
				displayName: 'Resize Width',
				name: 'resizeWidth',
				type: 'number',
				typeOptions: {
					minValue: CONSTANTS.IMAGE_PROCESSING.MIN_WIDTH,
					maxValue: CONSTANTS.IMAGE_PROCESSING.MAX_WIDTH,
				},
				default: CONSTANTS.DEFAULTS.KEEP_ORIGINAL_SIZE,
				description: 'Width to resize image to (0 to keep original)',
				displayOptions: {
					show: {
						operation: ['process'],
						resource: ['image'],
					},
				},
			},
			{
				displayName: 'Resize Height',
				name: 'resizeHeight',
				type: 'number',
				typeOptions: {
					minValue: CONSTANTS.IMAGE_PROCESSING.MIN_HEIGHT,
					maxValue: CONSTANTS.IMAGE_PROCESSING.MAX_HEIGHT,
				},
				default: CONSTANTS.DEFAULTS.KEEP_ORIGINAL_SIZE,
				description: 'Height to resize image to (0 to keep original)',
				displayOptions: {
					show: {
						operation: ['process'],
						resource: ['image'],
					},
				},
			},
			{
				displayName: 'Resize Fit',
				name: 'resizeFit',
				type: 'options',
				options: [
					{ name: 'Cover', value: 'cover' },
					{ name: 'Contain', value: 'contain' },
					{ name: 'Fill', value: 'fill' },
					{ name: 'Inside', value: 'inside' },
					{ name: 'Outside', value: 'outside' },
				],
				default: 'cover',
				description: 'How to fit the image when resizing',
				displayOptions: {
					show: {
						operation: ['process'],
						resource: ['image'],
					},
				},
			},
			{
				displayName: 'Convert Format',
				name: 'convertFormat',
				type: 'options',
				options: [
					{ name: 'JPEG', value: 'jpeg' },
					{ name: 'PNG', value: 'png' },
					{ name: 'WebP', value: 'webp' },
					{ name: 'GIF', value: 'gif' },
					{ name: 'TIFF', value: 'tiff' },
					{ name: 'AVIF', value: 'avif' },
				],
				default: 'jpeg',
				description: 'Target image format for conversion',
				displayOptions: {
					show: {
						operation: ['process'],
						resource: ['image'],
					},
				},
			},
			{
				displayName: 'Output Quality',
				name: 'outputQuality',
				type: 'number',
				typeOptions: {
					minValue: CONSTANTS.QUALITY.MIN,
					maxValue: CONSTANTS.QUALITY.MAX,
				},
				default: CONSTANTS.DEFAULTS.QUALITY,
				description: 'Output image quality (1-100)',
				displayOptions: {
					show: {
						operation: ['process'],
						resource: ['image'],
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
						operation: ['process'],
						resource: ['image'],
					},
				},
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
					{
						displayName: 'Base URL',
						name: 'baseUrl',
						type: 'string',
						default: '',
						description: 'Custom base URL (optional, uses provider default if empty)',
					},
				],
			},
		],
	};

	/**
	 * Records performance metrics for media generation/processing operations
	 * 
	 * @param performanceMonitor - The performance monitor instance
	 * @param provider - The provider name (e.g., 'openai', 'imageProcessor')
	 * @param model - The model name or format
	 * @param mediaType - The media type ('image', 'audio', 'video')
	 * @param duration - The operation duration in milliseconds
	 * @param success - Whether the operation was successful
	 * @param fromCache - Whether the result came from cache
	 */
	private static recordPerformanceMetric(
		performanceMonitor: PerformanceMonitor,
		provider: string,
		model: string,
		mediaType: MediaType,
		duration: number,
		success: boolean,
		fromCache: boolean
	): void {
		performanceMonitor.recordMetric({
			timestamp: Date.now().toString(),
			provider,
			model,
			mediaType,
			duration,
			success,
			fromCache,
		});
	}

	/**
	 * Processes an image by resizing and converting it to the specified format
	 * 
	 * @param context - The n8n execution context
	 * @param item - The input item containing binary image data
	 * @param itemIndex - The index of the current item
	 * @param performanceMonitor - The performance monitor instance
	 * @returns The processed image result with binary data
	 */
	private static async processImage(
		context: IExecuteFunctions,
		item: INodeExecutionData,
		itemIndex: number,
		performanceMonitor: PerformanceMonitor
	): Promise<INodeExecutionData> {
		const binaryPropertyName = context.getNodeParameter('binaryPropertyName', itemIndex) as string;
		const resizeWidth = context.getNodeParameter('resizeWidth', itemIndex) as number;
		const resizeHeight = context.getNodeParameter('resizeHeight', itemIndex) as number;
		const resizeFit = context.getNodeParameter('resizeFit', itemIndex) as string;
		const convertFormat = context.getNodeParameter('convertFormat', itemIndex) as string;
		const outputQuality = context.getNodeParameter('outputQuality', itemIndex) as number;

		if (!item.binary || Object.keys(item.binary).length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				'No binary data found in input. Please provide an image in binary data.',
				{ itemIndex }
			);
		}

		const binaryKey = binaryPropertyName || Object.keys(item.binary)[CONSTANTS.INDICES.FIRST_ITEM];

		if (!item.binary[binaryKey]) {
			throw new NodeOperationError(
				context.getNode(),
				`Binary property '${binaryKey}' not found in input`,
				{ itemIndex }
			);
		}

		const timerId = performanceMonitor.startTimer('imageProcess');
		const processor = new ImageProcessor();

		try {
			const binaryData = context.helpers.assertBinaryData(itemIndex, binaryKey);
			const buffer = await context.helpers.getBinaryDataBuffer(itemIndex, binaryKey) as Buffer;

			await processor.loadImage({
				type: 'binary',
				data: buffer,
				fileName: binaryData.fileName,
			});

			const originalMetadata = await processor.getMetadata();

			if (resizeWidth > 0 || resizeHeight > 0) {
				await processor.resize({
					width: resizeWidth > 0 ? resizeWidth : originalMetadata.width,
					height: resizeHeight > 0 ? resizeHeight : originalMetadata.height,
					fit: resizeFit as any,
				});
			}

			await processor.convert({
				format: convertFormat as any,
				compressOptions: { quality: outputQuality },
			});

			const outputBuffer = await processor.toBuffer();
			const finalMetadata = await ImageProcessor.getMetadataFromBuffer(outputBuffer);

			const outputBinary = await processor.toN8nBinary(
				binaryData.fileName || `processed_image.${convertFormat}`
			);

			const elapsed = performanceMonitor.endTimer(timerId);

			AIMediaGen.recordPerformanceMetric(
				performanceMonitor,
				'imageProcessor',
				convertFormat,
				'image' as MediaType,
				elapsed,
				true,
				false
			);

			context.logger?.info('Image processed successfully', {
				originalSize: `${originalMetadata.width}x${originalMetadata.height}`,
				finalSize: `${finalMetadata.width}x${finalMetadata.height}`,
				format: convertFormat,
				duration: elapsed,
			});

			return {
				json: {
					success: true,
					_metadata: {
						operation: 'process',
						resource: 'image',
						timestamp: new Date().toISOString(),
						duration: elapsed,
						originalMetadata,
						finalMetadata,
					},
				},
				binary: {
					data: outputBinary,
				},
			};
		} catch (error) {
			const elapsed = performanceMonitor.endTimer(timerId);

			AIMediaGen.recordPerformanceMetric(
				performanceMonitor,
				'imageProcessor',
				convertFormat,
				'image' as MediaType,
				elapsed,
				false,
				false
			);

			if (error instanceof MediaGenError) {
				context.logger?.error('Image processing failed', {
					errorCode: error.code,
					message: error.message,
				});
			}

			return {
				json: {
					success: false,
					error: error instanceof Error ? error.message : String(error),
					errorCode: error instanceof MediaGenError ? error.code : 'UNKNOWN',
					_metadata: {
						operation: 'process',
						resource: 'image',
						timestamp: new Date().toISOString(),
						duration: elapsed,
					},
				},
			};
		} finally {
			processor.destroy();
		}
	}

	/**
	 * Generates media content using AI providers with caching support
	 * 
	 * @param context - The n8n execution context
	 * @param itemIndex - The index of current item
	 * @param apiFormat - The API format/provider to use
	 * @param mediaType - The type of media to generate
	 * @param resource - The resource type (image, video, audio)
	 * @param operation - The operation type (generate, process)
	 * @param credentials - API credentials with apiKey
	 * @param cacheManager - The cache manager instance
	 * @param performanceMonitor - The performance monitor instance
	 * @param enableCache - Whether caching is enabled
	 * @returns The generated media result
	 */
	private static async generateMedia(
		context: IExecuteFunctions,
		itemIndex: number,
		apiFormat: ApiFormat,
		mediaType: MediaType,
		resource: MediaType,
		operation: string,
		credentials: { apiKey: string },
		cacheManager: CacheManager,
		performanceMonitor: PerformanceMonitor,
		enableCache: boolean
	): Promise<INodeExecutionData> {
		const model = context.getNodeParameter('model', itemIndex) as string;
		const prompt = context.getNodeParameter('prompt', itemIndex) as string;
		const additionalParamsJson = context.getNodeParameter('additionalParams', itemIndex) as string;

		const maxRetries = context.getNodeParameter('options.maxRetries', itemIndex) as number;
		const timeout = context.getNodeParameter('options.timeout', itemIndex) as number;
		const cacheTtl = context.getNodeParameter('options.cacheTtl', itemIndex) as number;
		const customBaseUrl = context.getNodeParameter('options.baseUrl', itemIndex) as string;

		let additionalParams: Record<string, unknown> = {} as Record<string, unknown>;
		if (additionalParamsJson && additionalParamsJson.trim() !== '{}') {
			try {
				additionalParams = JSON.parse(additionalParamsJson) as Record<string, unknown>;
			} catch (error) {
				throw new NodeOperationError(
					context.getNode(),
					'Additional parameters must be valid JSON',
					{ itemIndex }
				);
			}
		}

		const validation = validateGenerationParams({
			model,
			prompt,
			additionalParams: additionalParamsJson,
		});
		if (!validation.valid) {
			throw new NodeOperationError(
				context.getNode(),
				validation.errors.join(', '),
				{ itemIndex }
			);
		}

		context.logger?.info('Media type detection', {
			model,
			detectedType: mediaType,
		});

		const timerId = performanceMonitor.startTimer('generation');

		let responseData: Record<string, unknown> = {} as Record<string, unknown>;
		let fromCache = false;
		let cacheKey: string | undefined;

		if (enableCache) {
			cacheKey = CacheKeyGenerator.forGeneration(
				apiFormat,
				model,
				prompt,
				additionalParams
			);
			const cached = await cacheManager.get(cacheKey);

			if (cached) {
				responseData = cached as Record<string, unknown>;
				fromCache = true;
				context.logger?.info('Cache hit', { cacheKey });
			} else {
				context.logger?.info('Cache miss', { cacheKey });
			}
		}

		if (!fromCache) {
			const baseUrl = customBaseUrl || getDefaultBaseUrl(apiFormat);
			const endpoint = getEndpoint(apiFormat, mediaType, model);

			responseData = await withRetry(
				async () => {
					return await context.helpers.httpRequest({
						method: 'POST',
						url: `${baseUrl}${endpoint}`,
						body: buildRequestBody(
							apiFormat,
							mediaType,
							model,
							prompt,
							additionalParams
						) as Record<string, unknown>,
						headers: {
							...getHeaders(apiFormat, credentials.apiKey as string),
							...(apiFormat === 'gemini' ? {} : {}),
						},
						timeout,
						json: true,
					});
				},
				{ maxRetries }
			) as Record<string, unknown>;

			if (enableCache && cacheKey) {
				await cacheManager.set(cacheKey, responseData, cacheTtl);
			}
		}

		const elapsed = performanceMonitor.endTimer(timerId);

		AIMediaGen.recordPerformanceMetric(
			performanceMonitor,
			apiFormat,
			model,
			mediaType,
			elapsed,
			true,
			fromCache
		);

		context.logger?.info('Generation successful', {
			model,
			mediaType,
			duration: elapsed,
			cached: fromCache,
		});

		return {
			json: {
				...(responseData as Record<string, unknown>),
				_metadata: {
					provider: apiFormat,
					model,
					mediaType,
					resource,
					operation,
					timestamp: new Date().toISOString(),
					cached: fromCache,
					duration: elapsed,
				},
			},
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		const needsCredentials = items.some((_, i) => {
			const operation = this.getNodeParameter('operation', i) as string;
			return operation === 'generate';
		});

		let credentials;
		if (needsCredentials) {
			credentials = await this.getCredentials('aiMediaApi');

			const validation = validateCredentials(credentials);
			if (!validation.valid) {
				throw new NodeOperationError(
					this.getNode(),
					`Invalid credentials: ${validation.errors.join(', ')}`,
					{ itemIndex: CONSTANTS.INDICES.FIRST_ITEM }
				);
			}
		}

		const enableCache = this.getNodeParameter('options.enableCache', CONSTANTS.INDICES.FIRST_ITEM) as boolean;
		const cacheManager = new CacheManager();
		const performanceMonitor = new PerformanceMonitor();

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as MediaType;
				const operation = this.getNodeParameter('operation', i) as string;
				const apiFormat = this.getNodeParameter('apiFormat', i) as ApiFormat;

				if (operation === 'process' && resource === 'image') {
					const result = await AIMediaGen.processImage(this, items[i], i, performanceMonitor);
					results.push(result);
					continue;
				}

				const mediaType = resource || detectMediaType(this.getNodeParameter('model', i) as string);

				const result = await AIMediaGen.generateMedia(
					this,
					i,
					apiFormat,
					mediaType,
					resource,
					operation,
					credentials as { apiKey: string },
					cacheManager,
					performanceMonitor,
					enableCache
				);

				results.push(result);
			} catch (error) {
				if (error instanceof MediaGenError) {
					this.logger?.error('Media generation failed', {
						errorCode: error.code,
						message: error.message,
						details: error.details,
					});
				}

				results.push({
					json: {
						success: false,
						error: error instanceof Error ? error.message : String(error),
						errorCode: error instanceof MediaGenError ? error.code : 'UNKNOWN',
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
}
