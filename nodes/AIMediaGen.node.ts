import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
} from 'n8n-workflow';
import { MediaGenError, withRetry, validateGenerationParams } from './utils/errors';
import { detectMediaType, getDefaultBaseUrl, getEndpoint, getHeaders, buildRequestBody } from './utils/helpers';
import { CacheManager, CacheKeyGenerator } from './utils/cache';
import { PerformanceMonitor } from './utils/monitoring';
import { ImageProcessor } from './utils/imageProcessor';
import type { ApiFormat, MediaType } from './utils/types';

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

export class AIMediaGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI Media Generation',
		name: 'aiMediaGen',
		icon: 'file:ai-media-gen.svg',
		description: 'Generate images, videos, and audio using multiple AI providers',
		version: 1.0,
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
				description: 'Select the API provider to use',
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
					rows: 5,
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
					rows: 8,
				},
				default: '{}',
				description: 'Additional parameters as JSON object (e.g., {"size": "1024x1024", "n": 1})',
				displayOptions: {
					show: {
						operation: ['generate'],
					},
				},
			},
			// Image processing options
			{
				displayName: 'Resize Width',
				name: 'resizeWidth',
				type: 'number',
				typeOptions: {
					minValue: 0,
					maxValue: 65535,
				},
				default: 0,
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
					minValue: 0,
					maxValue: 65535,
				},
				default: 0,
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
					minValue: 1,
					maxValue: 100,
				},
				default: 85,
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
							minValue: 0,
							maxValue: 10,
						},
						default: 3,
						description: 'Maximum number of retry attempts for failed requests',
					},
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 1000,
							maxValue: 600000,
						},
						default: 60000,
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
							minValue: 60,
							maxValue: 86400,
						},
						default: 3600,
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		// Check if we need credentials (only for generation operation)
		const needsCredentials = items.some((_, i) => {
			const operation = this.getNodeParameter('operation', i) as string;
			return operation === 'generate';
		});

		let credentials;
		if (needsCredentials) {
			credentials = await this.getCredentials('aiMediaApi');
		}

		// Initialize cache and monitoring
		const enableCache = this.getNodeParameter('options.enableCache', 0) as boolean;
		const cacheManager = new CacheManager();

		for (let i = 0; i < items.length; i++) {
			try {
				// Get parameters
				const resource = this.getNodeParameter('resource', i) as MediaType;
				const operation = this.getNodeParameter('operation', i) as string;
				const apiFormat = this.getNodeParameter('apiFormat', i) as ApiFormat;

				// Handle image processing operation
				if (operation === 'process' && resource === 'image') {
					// Process the image inline
					const item = items[i];

					// Check if item has binary data
					if (!item.binary || Object.keys(item.binary).length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'No binary data found in input. Please provide an image in the binary data.',
							{ itemIndex: i }
						);
					}

					// Get processing parameters
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					const resizeWidth = this.getNodeParameter('resizeWidth', i) as number;
					const resizeHeight = this.getNodeParameter('resizeHeight', i) as number;
					const resizeFit = this.getNodeParameter('resizeFit', i) as string;
					const convertFormat = this.getNodeParameter('convertFormat', i) as string;
					const outputQuality = this.getNodeParameter('outputQuality', i) as number;

					// Get binary data key (first binary key if not specified)
					const binaryKey = binaryPropertyName || Object.keys(item.binary)[0];

					if (!item.binary[binaryKey]) {
						throw new NodeOperationError(
							this.getNode(),
							`Binary property '${binaryKey}' not found in input`,
							{ itemIndex: i }
						);
					}

					// Start performance monitoring
					const timerId = PerformanceMonitor.startTimer('imageProcess');

					// Create processor outside try block to ensure cleanup
					const processor = new ImageProcessor();

					try {
						// Get binary data buffer
						const binaryData = this.helpers.assertBinaryData(i, binaryKey);
						const buffer = await this.helpers.getBinaryDataBuffer(i, binaryKey) as Buffer;

						// Load image into processor
						await processor.loadImage({
							type: 'binary',
							data: buffer,
							fileName: binaryData.fileName,
						});

						// Get original metadata
						const originalMetadata = await processor.getMetadata();

						// Apply resize if dimensions are specified
						if (resizeWidth > 0 || resizeHeight > 0) {
							await processor.resize({
								width: resizeWidth > 0 ? resizeWidth : originalMetadata.width,
								height: resizeHeight > 0 ? resizeHeight : originalMetadata.height,
								fit: resizeFit as any,
							});
						}

						// Convert format and apply quality
						await processor.convert({
							format: convertFormat as any,
							compressOptions: { quality: outputQuality },
						});

						// Get output buffer for correct metadata
						const outputBuffer = await processor.toBuffer();

						// Get final metadata from output buffer
						const finalMetadata = await ImageProcessor.getMetadataFromBuffer(outputBuffer);

						// Output as n8n binary format
						const outputBinary = await processor.toN8nBinary(
							binaryData.fileName || `processed_image.${convertFormat}`
						);

						// Record performance
						const elapsed = PerformanceMonitor.endTimer(timerId);

						// Record metrics
						PerformanceMonitor.recordMetric({
							timestamp: Date.now(),
							provider: 'imageProcessor',
							model: convertFormat,
							mediaType: 'image' as MediaType,
							duration: elapsed,
							success: true,
							fromCache: false,
						} as any);

						// Return result with processed binary data
						results.push({
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
								data: outputBinary as any,
							},
						});

						this.logger?.info('Image processed successfully', {
							originalSize: `${originalMetadata.width}x${originalMetadata.height}`,
							finalSize: `${finalMetadata.width}x${finalMetadata.height}`,
							format: convertFormat,
							duration: elapsed,
						});
					} catch (error) {
						const elapsed = PerformanceMonitor.endTimer(timerId);

						// Record error metrics
						PerformanceMonitor.recordMetric({
							timestamp: Date.now(),
							provider: 'imageProcessor',
							model: convertFormat,
							mediaType: 'image' as MediaType,
							duration: elapsed,
							success: false,
							fromCache: false,
						} as any);

						if (error instanceof MediaGenError) {
							this.logger?.error('Image processing failed', {
								errorCode: error.code,
								message: error.message,
							});
						}

						results.push({
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
						});

						if (this.continueOnFail()) {
							continue;
						}
						throw error;
					} finally {
						// Always clean up resources
						processor.destroy();
					}

					continue;
				}

				// Original generation operation
				const model = this.getNodeParameter('model', i) as string;
				const prompt = this.getNodeParameter('prompt', i) as string;
				const additionalParamsJson = this.getNodeParameter('additionalParams', i) as string;

				// Get options
				const maxRetries = this.getNodeParameter('options.maxRetries', i) as number;
				const timeout = this.getNodeParameter('options.timeout', i) as number;
				const cacheTtl = this.getNodeParameter('options.cacheTtl', i) as number;
				const customBaseUrl = this.getNodeParameter('options.baseUrl', i) as string;

				// Parse additional parameters
				let additionalParams: Record<string, unknown> = {} as Record<string, unknown>;
				if (additionalParamsJson && additionalParamsJson.trim() !== '{}') {
					try {
						additionalParams = JSON.parse(additionalParamsJson) as Record<string, unknown>;
					} catch (error) {
						throw new NodeOperationError(
							this.getNode(),
							'Additional parameters must be valid JSON',
							{ itemIndex: i }
						);
					}
				}

				// Validate parameters
				const validation = validateGenerationParams({
					model,
					prompt,
					additionalParams: additionalParamsJson,
				});
				if (!validation.valid) {
					throw new NodeOperationError(
						this.getNode(),
						validation.errors.join(', '),
						{ itemIndex: i }
					);
				}

				// Detect media type if not explicitly set
				const mediaType = resource || detectMediaType(model);
				this.logger?.info('Media type detection', {
					model,
					detectedType: mediaType,
				});

				// Start performance monitoring
				const timerId = PerformanceMonitor.startTimer('generation');

				// Check cache
				let responseData: Record<string, unknown> = {} as Record<string, unknown>;
				let fromCache = false;

				if (enableCache) {
					const cacheKey = CacheKeyGenerator.forGeneration(
						apiFormat,
						model,
						prompt,
						additionalParams
					);
					const cached = await cacheManager.get(cacheKey);

					if (cached) {
						responseData = cached as Record<string, unknown>;
						fromCache = true;
						this.logger?.info('Cache hit', { cacheKey });
					} else {
						this.logger?.info('Cache miss', { cacheKey });
					}
				}

				// Make API request if not from cache
				if (!fromCache) {
					const baseUrl = customBaseUrl || getDefaultBaseUrl(apiFormat);
					const endpoint = getEndpoint(apiFormat, mediaType, model);

					responseData = await withRetry(
						async () => {
							return await this.helpers.httpRequest({
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
									...getHeaders(apiFormat, credentials!.apiKey as string),
									...(apiFormat === 'gemini' ? {} : {}),
								},
								timeout,
								json: true,
							});
						},
						{ maxRetries }
					) as Record<string, unknown>;

					// Store in cache
					if (enableCache) {
						const cacheKey = CacheKeyGenerator.forGeneration(
							apiFormat,
							model,
							prompt,
							additionalParams
						);
						await cacheManager.set(cacheKey, responseData, cacheTtl);
					}
				}

				// Record performance
				const elapsed = PerformanceMonitor.endTimer(timerId);
				PerformanceMonitor.recordMetric({
					timestamp: Date.now(),
					provider: apiFormat,
					model,
					mediaType,
					duration: elapsed,
					success: true,
					fromCache,
				} as any);

				// Return result with metadata
				results.push({
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
				});

				this.logger?.info('Generation successful', {
					model,
					mediaType,
					duration: elapsed,
					cached: fromCache,
				});
			} catch (error) {
				// Handle errors
				if (error instanceof MediaGenError) {
					this.logger?.error('Media generation failed', {
						errorCode: error.code,
						message: error.message,
						details: error.details,
					});
				}

				// Return error response
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

				// Re-throw if n8n should handle it
				if (this.continueOnFail()) {
					continue;
				}
				throw error;
			}
		}

		return [this.helpers.constructExecutionMetaData(results, { itemData: { item: 0 } })];
	}
}
