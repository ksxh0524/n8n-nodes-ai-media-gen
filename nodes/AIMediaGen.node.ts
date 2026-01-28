import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
} from 'n8n-workflow';
import { CacheManager } from './utils/cache';
import { PerformanceMonitor } from './utils/monitoring';
import * as CONSTANTS from './utils/constants';

interface ResultMetadata {
	cached?: boolean;
	[key: string]: unknown;
}

interface ModelScopeApiCredentials {
	apiKey: string;
	baseUrl?: string;
}

interface ModelScopeApiResponse {
	output?: { url?: string };
	url?: string;
	image_url?: string;
	error?: string;
}

export class AIMediaGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI Media Generation',
		name: 'aiMediaGen',
		icon: 'file:ai-media-gen.svg',
		description: 'Generate and process media using AI models',
		version: CONSTANTS.NODE_VERSION,
		group: ['transform'],
		subtitle: '={{$parameter.resource}}: {{$parameter.action}}',
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
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'ModelScope', value: 'modelScope' },
				],
				default: 'modelScope',
				required: true,
				description: 'AI resource to use',
			},
			{
				displayName: 'Action',
				name: 'action',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Generate Image', value: 'generateImage', description: 'Generate an image from text prompt' },
				],
				default: 'generateImage',
				required: true,
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				default: 'Tongyi-MAI/Z-Image',
				required: true,
				options: [
					{ name: 'Z-Image', value: 'Tongyi-MAI/Z-Image' },
					{ name: 'Qwen-Image-2512', value: 'Qwen-Image-2512' },
				],
				description: 'Select the model',
				displayOptions: {
					show: {
						resource: ['modelScope'],
						action: ['generateImage'],
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
				description: 'Text description of the image to generate',
				displayOptions: {
					show: {
						resource: ['modelScope'],
						action: ['generateImage'],
					},
				},
			},
			{
				displayName: 'Size',
				name: 'size',
				type: 'options',
				default: '1024x1024',
				options: [
					{ name: '512x512', value: '512x512' },
					{ name: '768x768', value: '768x768' },
					{ name: '1024x1024', value: '1024x1024' },
					{ name: '2048x2048', value: '2048x2048' },
					{ name: '512x1024', value: '512x1024' },
					{ name: '1024x512', value: '1024x512' },
				],
				description: 'Image size',
				displayOptions: {
					show: {
						resource: ['modelScope'],
						action: ['generateImage'],
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
						resource: ['modelScope'],
						action: ['generateImage'],
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
						resource: ['modelScope'],
						action: ['generateImage'],
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		const enableCache = this.getNodeParameter('options.enableCache', CONSTANTS.INDICES.FIRST_ITEM) as boolean;
		const cacheManager = new CacheManager();
		const performanceMonitor = new PerformanceMonitor();

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const action = this.getNodeParameter('action', i) as string;

				// Get credentials
				const credentials = await this.getCredentials<ModelScopeApiCredentials>('modelScopeApi');
				if (!credentials || !credentials.apiKey) {
					throw new NodeOperationError(
						this.getNode(),
						'API Key is required. Please configure your ModelScope API credentials.',
						{ itemIndex: i }
					);
				}

				const timerId = performanceMonitor.startTimer(action);
				let result: INodeExecutionData;

				if (resource === 'modelScope') {
					const timeout = this.getNodeParameter('options.timeout', CONSTANTS.INDICES.FIRST_ITEM) as number;

					if (enableCache) {
						const prompt = this.getNodeParameter('prompt', i) as string || '';
						const promptHash = AIMediaGen.hashString(prompt);
						const cacheKey = `${action}:${promptHash}`;
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

							if (action === 'generateImage') {
								result = await AIMediaGen.executeGenerateImage(this, i, credentials, timeout);
							} else {
								throw new NodeOperationError(this.getNode(), `Unknown action: ${action}`, { itemIndex: i });
							}

							if (result.json.success) {
								await cacheManager.set(cacheKey, result.json, this.getNodeParameter('options.cacheTtl', i) as number);
							}
						}
					} else {
						if (action === 'generateImage') {
							result = await AIMediaGen.executeGenerateImage(this, i, credentials, timeout);
						} else {
							throw new NodeOperationError(this.getNode(), `Unknown action: ${action}`, { itemIndex: i });
						}
					}
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`Unknown resource: ${resource}`,
						{ itemIndex: i }
					);
				}

				const elapsed = performanceMonitor.endTimer(timerId);

				performanceMonitor.recordMetric({
					timestamp: Date.now().toString(),
					provider: resource,
					model: this.getNodeParameter('model', i) as string,
					mediaType: 'image',
					duration: elapsed,
					success: result.json.success as boolean,
					fromCache: (result.json._metadata as ResultMetadata)?.cached || false,
				});

				this.logger?.info('Action executed', {
					resource,
					action,
					duration: elapsed,
					success: result.json.success,
				});

				results.push(result);
			} catch (error) {
				this.logger?.error('Action failed', {
					resource: this.getNodeParameter('resource', i),
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

	private static async executeGenerateImage(
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

		if (!prompt || prompt.trim() === '') {
			return {
				json: {
					success: false,
					error: 'Prompt is required',
					errorCode: 'VALIDATION_ERROR',
				},
			};
		}

		const baseUrl = credentials.baseUrl || 'https://api.modelscope.cn/v1';

		return await AIMediaGen.makeModelScopeRequest(
			baseUrl,
			credentials.apiKey,
			model,
			{ prompt: prompt.trim() },
			{
				size: size || '1024x1024',
				seed: seed || 0,
				num_images: numImages || 1,
			},
			timeout
		);
	}

	private static async makeModelScopeRequest(
		baseUrl: string,
		apiKey: string,
		model: string,
		input: { prompt: string },
		parameters: { size?: string; seed: number; num_images?: number },
		timeout: number
	): Promise<INodeExecutionData> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(`${baseUrl}/files/generation`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model,
					input,
					parameters,
				}),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			const data = await response.json().catch(() => null) as ModelScopeApiResponse | null;

			if (!response.ok) {
				let errorMessage = 'Failed to generate image';
				if (response.status === 401) errorMessage = 'Authentication failed. Please check your API Key.';
				else if (response.status === 429) errorMessage = 'Rate limit exceeded. Please try again later.';
				else if (response.status === 408) errorMessage = 'Request timeout.';
				else if (data?.error) errorMessage = data.error;

				return {
					json: {
						success: false,
						error: errorMessage,
						errorCode: 'API_ERROR',
						_metadata: {
							statusCode: response.status,
						},
					},
				};
			}

			const imageUrl = data?.output?.url || data?.url || data?.image_url;

			if (!imageUrl) {
				return {
					json: {
						success: false,
						error: 'No image URL returned from API',
						errorCode: 'API_ERROR',
					},
				};
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
				return {
					json: {
						success: false,
						error: 'Request timeout',
						errorCode: 'TIMEOUT_ERROR',
					},
				};
			}

			return {
				json: {
					success: false,
					error: error instanceof Error ? error.message : String(error),
					errorCode: 'UNKNOWN',
				},
			};
		}
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
