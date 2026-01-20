import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
} from 'n8n-workflow';
import {
	MediaGenError,
	ERROR_CODES,
	withRetry,
	validateCredentials,
	validateGenerationParams,
} from './utils/errors';
import {
	detectMediaType,
	getDefaultBaseUrl,
	getEndpoint,
	getHeaders,
	buildRequestBody,
} from './utils/helpers';
import {
	CacheManager,
	CacheKeyGenerator,
	MemoryCache,
} from './utils/cache';
import {
	ResponseNormalizer,
} from './utils/response';
import {
	PerformanceMonitor,
	PerformanceMetrics,
} from './utils/monitoring';
import { RateLimiter } from './utils/rateLimiter';

export class AIMediaGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI Media Generation',
		name: 'aiMediaGen',
		icon: 'file:ai-media-gen.svg',
		group: ['transform'],
		version: 1,
		description: 'Generate images, videos, and audio using AI APIs',
		defaults: {
			name: 'AI Media Gen',
		},
		usableAsTool: true,
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
				displayName: 'Model',
				name: 'model',
				type: 'string',
				required: true,
				description: 'Model name (e.g., dall-e-3, imagen-2.0, wanx-v1, flux-schnell, tts-1, sora)',
				placeholder: 'dall-e-3',
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				required: true,
				description: 'Text prompt for generation',
			},
			{
				displayName: 'Additional Parameters (JSON)',
				name: 'additionalParams',
				type: 'string',
				typeOptions: { rows: 8 },
				default: '{}',
				description: 'Additional parameters as JSON object (e.g., {"size": "1024x1024", "n": 1})',
			},
			{
				displayName: 'Max Retries',
				name: 'maxRetries',
				type: 'number',
				default: 3,
				description: 'Maximum number of retry attempts for failed requests',
			},
			{
				displayName: 'Timeout (ms)',
				name: 'timeout',
				type: 'number',
				default: 60000,
				description: 'Request timeout in milliseconds',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('aiMediaApi');
		const enableCache = credentials.enableCache as boolean ?? true;
		const cacheTtl = credentials.cacheTtl as number ?? 3600;

		let cacheManager: CacheManager | undefined;
		if (enableCache) {
			cacheManager = new CacheManager(new MemoryCache({ maxSize: 200, defaultTtl: cacheTtl }));
		}

		for (let i = 0; i < items.length; i++) {
			try {
				const result = await executeGeneration(this, cacheManager, enableCache, cacheTtl);
				results.push(result);
			} catch (error) {
				this.logger?.error('Media generation failed', {
					error: error instanceof Error ? error.message : String(error),
					model: this.getNodeParameter('model', 0) as string,
				});

				const apiFormat = credentials?.apiFormat as string || 'unknown';
				const model = this.getNodeParameter('model', 0) as string;
				const mediaType = detectMediaType(model);

				const errorResponse = ResponseNormalizer.normalizeError(
					error as Error,
					apiFormat,
					model,
					mediaType
				);

				results.push({
					json: errorResponse,
				});
			}
		}

		return [this.helpers.constructExecutionMetaData(results, { itemData: { item: 0 } })];
	}
}

async function executeGeneration(
	context: IExecuteFunctions,
	cacheManager: CacheManager | undefined,
	enableCache: boolean,
	cacheTtl: number
): Promise<INodeExecutionData> {
		const model = context.getNodeParameter('model', 0) as string;
		const prompt = context.getNodeParameter('prompt', 0) as string;
		const additionalParamsJson = context.getNodeParameter('additionalParams', 0) as string;
		const maxRetries = context.getNodeParameter('maxRetries', 0) as number;
		const timeout = context.getNodeParameter('timeout', 0) as number;

		context.logger?.debug('Starting media generation', { model, enableCache });

		const validation = validateGenerationParams({ model, prompt, additionalParams: additionalParamsJson });
		if (!validation.valid) {
			throw new MediaGenError(
				`Invalid parameters: ${validation.errors.join(', ')}`,
				ERROR_CODES.INVALID_PARAMS,
				{ errors: validation.errors }
			);
		}

		let additionalParams = {};
		try {
			additionalParams = JSON.parse(additionalParamsJson || '{}');
		} catch (e) {
			throw new MediaGenError(
				'Additional parameters must be valid JSON',
				ERROR_CODES.INVALID_PARAMS
			);
		}

		const credentials = await context.getCredentials('aiMediaApi');
		const credValidation = validateCredentials(credentials);
		if (!credValidation.valid) {
			throw new MediaGenError(
				`Invalid credentials: ${credValidation.errors.join(', ')}`,
				ERROR_CODES.INVALID_API_KEY,
				{ errors: credValidation.errors }
			);
		}

		const apiFormat = credentials.apiFormat as string;
		const apiKey = credentials.apiKey as string;
		const baseUrl = credentials.baseUrl as string || getDefaultBaseUrl(apiFormat);

		const mediaType = detectMediaType(model);
		context.logger?.debug('Detected media type', { model, mediaType });

		const endpoint = getEndpoint(apiFormat, mediaType, model, apiKey);
		const headers = getHeaders(apiFormat, apiKey);
		const body = buildRequestBody(apiFormat, mediaType, model, prompt, additionalParams);

		context.logger?.debug('Making API request', {
			endpoint,
			mediaType,
			apiFormat,
		});

		const startTime = PerformanceMonitor.startTimer('generation');

		let response: unknown;
		let success = true;
		let error: Error | undefined;

		const rateLimiter = RateLimiter.getInstance({ rate: 10, capacity: 60, key: apiFormat });

		try {
			await rateLimiter.acquire();

			if (enableCache && cacheManager) {
				const cacheKey = CacheKeyGenerator.forGeneration(apiFormat, model, prompt, additionalParams);
				const cached = await cacheManager.get(cacheKey);

				if (cached) {
					context.logger?.info('Cache hit', { cacheKey });
					response = cached;
				} else {
					response = await makeApiRequest(context, baseUrl, endpoint, headers, body, timeout, maxRetries);
					await cacheManager.set(cacheKey, response, cacheTtl);
					context.logger?.info('Cached result', { cacheKey });
				}
			} else {
				response = await makeApiRequest(context, baseUrl, endpoint, headers, body, timeout, maxRetries);
			}
		} catch (e) {
			success = false;
			error = e as Error;
			throw e;
		} finally {
			const duration = PerformanceMonitor.endTimer(startTime);

			const metric: PerformanceMetrics = {
				provider: apiFormat,
				model,
				mediaType,
				duration,
				success,
				timestamp: new Date().toISOString(),
				error: error?.message,
			};

			PerformanceMonitor.recordMetric(metric);

			context.logger?.info('Generation completed', {
				model,
				mediaType,
				duration,
				success,
			});
		}

		const normalizedResponse = ResponseNormalizer.normalize(
			response,
			mediaType,
			apiFormat,
			model,
			enableCache
		);

		return {
			json: normalizedResponse,
		};
	}

async function makeApiRequest(
	context: IExecuteFunctions,
	baseUrl: string,
	endpoint: string,
	headers: Record<string, string>,
	body: unknown,
	timeout: number,
	maxRetries: number
): Promise<unknown> {
	return await withRetry(
		async () => {
			return await context.helpers.httpRequest({
				method: 'POST',
				url: baseUrl + endpoint,
				headers,
				body,
				json: true,
				timeout,
			});
		},
		{ maxRetries, initialDelay: 1000, maxDelay: 30000 }
	);
}
