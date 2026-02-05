import type { IExecuteFunctions, INodeExecutionData, IHttpRequestMethods } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CacheManager, CacheKeyGenerator } from './cache';
import { PerformanceMonitor } from './monitoring';
import { ErrorHandler, ResponseHandler } from './index';
import { MediaGenError } from './errors';
import { DEFAULTS } from './constants';

import type { ParsedMediaResponse, Credentials } from '../types/platforms';

/**
 * Execution result metadata
 */
export interface ExecutionMetadata {
	model: string;
	cached?: boolean;
	timestamp: string;
	provider: string;
	mediaType: 'image' | 'video' | 'audio';
	duration?: number;
}

/**
 * Execution context
 */
export interface ExecutionContext {
	operation: string;
	itemIndex: number;
	enableCache: boolean;
	cacheTtl: number;
	timeout: number;
	maxRetries: number;
}

/**
 * Platform execution configuration
 */
export interface PlatformConfig {
	operation: string;
	credentialType: string;
	provider: string;
	mediaType: 'image' | 'video' | 'audio';
}

/**
 * Platform-specific execution strategy
 */
interface PlatformStrategy {
	/**
	 * Get platform configuration
	 */
	getConfig(): PlatformConfig;

	/**
	 * Extract parameters from n8n context
	 */
	extractParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown>;

	/**
	 * Build cache parameters
	 */
	buildCacheParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown>;

	/**
	 * Execute the platform request
	 */
	executeRequest(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials: Credentials,
		params: Record<string, unknown>,
		timeout: number
	): Promise<INodeExecutionData>;
}

/**
 * Media generation execution coordinator
 *
 * Coordinates execution across all AI platforms, providing:
 * - Unified caching strategy
 * - Performance monitoring integration
 * - Error handling and logging
 * - Platform-specific request/response handling
 */
export class MediaGenExecutor {
	private readonly cacheManager: CacheManager;
	private readonly performanceMonitor: PerformanceMonitor;
	private readonly context: IExecuteFunctions;
	private readonly enableCache: boolean;

	constructor(context: IExecuteFunctions, enableCache = true) {
		this.context = context;
		this.enableCache = enableCache;
		this.cacheManager = new CacheManager();
		this.performanceMonitor = new PerformanceMonitor();
	}

	/**
	 * Executes media generation for a single item
	 *
	 * @param itemIndex - Index of the item being processed
	 * @returns Promise resolving to execution data
	 * @throws NodeOperationError for validation errors
	 * @throws MediaGenError for API errors
	 */
	async executeItem(itemIndex: number): Promise<INodeExecutionData> {
		this.context.logger?.debug('[MediaGenExecutor] Processing item', { itemIndex });

		// Get operation
		const operation = this.context.getNodeParameter('operation', itemIndex) as string;
		this.context.logger?.debug('[MediaGenExecutor] Operation', { operation, itemIndex });

		// Get execution options
		const execContext = this.getExecutionContext(itemIndex);

		// Get platform strategy
		const strategy = this.getPlatformStrategy(operation);
		const config = strategy.getConfig();

		// Get and validate credentials
		const credentials = await this.getCredentials(config.credentialType, itemIndex);

		// Start performance timer
		const timerId = this.performanceMonitor.startTimer(config.provider);

		try {
			let result: INodeExecutionData;

			// Check cache if enabled
			if (this.enableCache) {
				result = await this.executeWithCache(strategy, itemIndex, execContext, credentials);
			} else {
				result = await this.executeWithoutCache(strategy, itemIndex, credentials, execContext.timeout);
			}

			// Record performance metrics
			const elapsed = this.performanceMonitor.endTimer(timerId);
			this.performanceMonitor.recordMetric({
				timestamp: Date.now().toString(),
				provider: config.provider,
				model: result.json.model as string,
				mediaType: config.mediaType,
				duration: elapsed,
				success: result.json.success as boolean,
				fromCache: (result.json._metadata as ExecutionMetadata)?.cached || false,
			});

			this.context.logger?.info('[MediaGenExecutor] Execution completed', {
				model: result.json.model,
				duration: elapsed,
				success: result.json.success,
			});

			return result;
		} catch (error) {
			this.performanceMonitor.endTimer(timerId);
			throw error;
		}
	}

	/**
	 * Executes request with caching
	 */
	private async executeWithCache(
		strategy: PlatformStrategy,
		itemIndex: number,
		execContext: ExecutionContext,
		credentials: Credentials
	): Promise<INodeExecutionData> {
		const config = strategy.getConfig();

		// Extract parameters for cache key
		const params = strategy.extractParams(this.context, itemIndex);
		const cacheParams = strategy.buildCacheParams(this.context, itemIndex);

		const model = params.model as string;
		const prompt = params.prompt as string;

		// Build cache key
		const cacheKey = CacheKeyGenerator.forGeneration(
			config.operation,
			model,
			prompt,
			cacheParams
		);

		// Check cache
		const cached = await this.cacheManager.get(cacheKey);

		if (cached) {
			this.context.logger?.info('[MediaGenExecutor] Cache hit', { model, cacheKey });
			return {
				json: {
					success: true,
					...cached as Record<string, unknown>,
					_metadata: {
						model,
						cached: true,
						timestamp: new Date().toISOString(),
						provider: config.provider,
						mediaType: config.mediaType,
					} as ExecutionMetadata,
				},
			};
		}

		// Cache miss - execute request
		this.context.logger?.info('[MediaGenExecutor] Cache miss', { model, cacheKey });
		const result = await strategy.executeRequest(
			this.context,
			itemIndex,
			credentials,
			params,
			execContext.timeout
		);

		// Store in cache if successful
		if (result.json.success) {
			await this.cacheManager.set(cacheKey, result.json, execContext.cacheTtl);
		}

		return result;
	}

	/**
	 * Executes request without caching
	 */
	private async executeWithoutCache(
		strategy: PlatformStrategy,
		itemIndex: number,
		credentials: Credentials,
		timeout: number
	): Promise<INodeExecutionData> {
		const params = strategy.extractParams(this.context, itemIndex);
		return await strategy.executeRequest(this.context, itemIndex, credentials, params, timeout);
	}

	/**
	 * Gets execution context from n8n node parameters
	 */
	private getExecutionContext(itemIndex: number): ExecutionContext {
		const operation = this.context.getNodeParameter('operation', itemIndex) as string;

		// Get enableCache
		let enableCache = true;
		try {
			enableCache = this.context.getNodeParameter('options.enableCache', 0) as boolean;
		} catch (error) {
			this.context.logger?.debug('[MediaGenExecutor] Options not set, using default enableCache=true');
		}

		// Get cacheTtl
		let cacheTtl: number = DEFAULTS.CACHE_TTL_SECONDS;
		try {
			cacheTtl = this.context.getNodeParameter('options.cacheTtl', itemIndex) as number;
		} catch (error) {
			this.context.logger?.debug('[MediaGenExecutor] Options cacheTtl not set, using default', {
				defaultValue: DEFAULTS.CACHE_TTL_SECONDS,
			});
		}

		// Get timeout
		let timeout: number = DEFAULTS.TIMEOUT_MS;
		try {
			timeout = this.context.getNodeParameter('options.timeout', itemIndex) as number;
		} catch (error) {
			this.context.logger?.debug('[MediaGenExecutor] Options timeout not set, using default', {
				defaultValue: DEFAULTS.TIMEOUT_MS,
			});
		}

		// Get maxRetries
		let maxRetries: number = DEFAULTS.MAX_RETRIES;
		try {
			maxRetries = this.context.getNodeParameter('options.maxRetries', itemIndex) as number;
		} catch (error) {
			this.context.logger?.debug('[MediaGenExecutor] Options maxRetries not set, using default', {
				defaultValue: DEFAULTS.MAX_RETRIES,
			});
		}

		return {
			operation,
			itemIndex,
			enableCache,
			cacheTtl,
			timeout,
			maxRetries,
		};
	}

	/**
	 * Gets and validates credentials
	 */
	private async getCredentials<T extends Credentials>(
		credentialType: string,
		itemIndex: number
	): Promise<T> {
		this.context.logger?.info('[MediaGenExecutor] Getting credentials', {
			credentialType,
			itemIndex,
		});

		try {
			const credentials = await this.context.getCredentials<T>(credentialType);

			if (!credentials || !(credentials as { apiKey?: string }).apiKey) {
				this.context.logger?.error('[MediaGenExecutor] Credentials validation failed', {
					credentialType,
					hasCredentials: !!credentials,
					hasApiKey: !!(credentials as { apiKey?: string })?.apiKey,
				});
				throw new NodeOperationError(
					this.context.getNode(),
					`API Key is required. Please configure your ${credentialType} credentials.`,
					{ itemIndex }
				);
			}

			// Log credentials info (without sensitive data)
			const credentialKeys = Object.keys(credentials as unknown as Record<string, unknown>);
			this.context.logger?.info('[MediaGenExecutor] Credentials loaded successfully', {
				credentialType,
				credentialKeys,
				hasApiKey: true,
				hasBaseUrl: !!(credentials as { baseUrl?: string })?.baseUrl,
				baseUrl: (credentials as { baseUrl?: string })?.baseUrl || 'default',
			});

			return credentials;
		} catch (error) {
			if (error instanceof NodeOperationError) {
				throw error;
			}
			throw ErrorHandler.toNodeOperationError(error, this.context, itemIndex);
		}
	}

	/**
	 * Gets platform strategy for operation
	 */
	private getPlatformStrategy(operation: string): PlatformStrategy {
		// Import StrategyRegistry dynamically to avoid circular dependency
		const { StrategyRegistry } = require('../platforms/strategies');
		return StrategyRegistry.get(operation);
	}

	/**
	 * Creates an error result
	 */
	static createErrorResult(
		error: unknown,
		operation: string,
		model: string
	): INodeExecutionData {
		const errorCode = error instanceof MediaGenError ? error.code : 'UNKNOWN';
		const errorDetails = error instanceof MediaGenError ? error.details : undefined;

		const jsonData: Record<string, unknown> = {
			success: false,
			error: error instanceof Error ? error.message : String(error),
			errorCode,
			_metadata: {
				timestamp: new Date().toISOString(),
				operation,
				model,
			},
		};

		if (errorDetails !== undefined) {
			jsonData.errorDetails = errorDetails;
		}

		return {
			json: jsonData as any, // Type assertion for n8n compatibility
		};
	}
}

/**
 * Base platform strategy implementation
 */
export abstract class BasePlatformStrategy implements PlatformStrategy {
	abstract getConfig(): PlatformConfig;
	abstract extractParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown>;
	abstract buildCacheParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown>;

	/**
	 * Default request execution implementation
	 */
	async executeRequest(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials: Credentials,
		params: Record<string, unknown>,
		timeout: number
	): Promise<INodeExecutionData> {
		const config = this.getConfig();

		// Build request
		const request = this.buildRequest(context, itemIndex, params, credentials);

		// Log request details (with sensitive data masked)
		const sanitizedBody = this.sanitizeRequestBody(request.body);

		// Use console.log for guaranteed visibility
		console.log(`[${config.provider.toUpperCase()}] Sending API Request`);
		console.log('Method:', request.method);
		console.log('URL:', request.url);
		console.log('Headers:', this.sanitizeHeaders(request.headers));
		console.log('Body:', sanitizedBody);
		console.log('Timeout:', timeout);

		context.logger?.info(`[${config.provider.toUpperCase()}] Sending API Request`, {
			method: request.method,
			url: request.url,
			headers: this.sanitizeHeaders(request.headers),
			body: sanitizedBody,
			timeout,
		});

		// Execute HTTP request
		let response: unknown;
		try {
			response = await context.helpers.httpRequest({
				method: request.method as IHttpRequestMethods,
				url: request.url,
				body: request.body as Record<string, unknown> | undefined,
				headers: request.headers,
				timeout,
			});
		} catch (error) {
			// Log error details
			console.error(`[${config.provider.toUpperCase()}] API Request Failed`);
			console.error('Error:', error instanceof Error ? error.message : String(error));
			console.error('Method:', request.method);
			console.error('URL:', request.url);
			console.error('Status:', (error as { statusCode?: number })?.statusCode);

			context.logger?.error(`[${config.provider.toUpperCase()}] API Request Failed`, {
				error: error instanceof Error ? error.message : String(error),
				method: request.method,
				url: request.url,
				body: sanitizedBody,
				status: (error as { statusCode?: number })?.statusCode,
			});
			throw error;
		}

		// Log response details
		const sanitizedResponse = this.sanitizeResponse(response);
		context.logger?.info(`[${config.provider.toUpperCase()}] API Response Received`, {
			responseType: typeof response,
			hasData: response !== null && response !== undefined,
			preview: this.getPreview(sanitizedResponse),
		});

		// Parse response
		const parsed = this.parseResponse(response);

		// Log parsed result
		context.logger?.info(`[${config.provider.toUpperCase()}] Response Parsed`, {
			hasImageUrl: !!parsed.imageUrl,
			hasVideoUrl: !!parsed.videoUrl,
			hasAudioUrl: !!parsed.audioUrl,
			hasBase64: !!parsed.base64Data,
			metadata: parsed.metadata,
		});

		// Build result
		return this.buildResult(parsed, params);
	}

	/**
	 * Sanitize request body for logging (remove sensitive data)
	 */
	private sanitizeRequestBody(body: unknown): unknown {
		if (!body) return body;
		if (typeof body === 'string') {
			// Truncate long strings
			return body.length > 500 ? body.substring(0, 500) + '...(truncated)' : body;
		}
		if (typeof body === 'object') {
			const sanitized: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
				if (typeof value === 'string' && value.length > 500) {
					sanitized[key] = value.substring(0, 500) + '...(truncated)';
				} else {
					sanitized[key] = value;
				}
			}
			return sanitized;
		}
		return body;
	}

	/**
	 * Sanitize headers for logging (remove sensitive data)
	 */
	private sanitizeHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
		if (!headers) return headers;
		const sanitized: Record<string, string> = {};
		for (const [key, value] of Object.entries(headers)) {
			if (key.toLowerCase() === 'authorization') {
				// Mask authorization header
				sanitized[key] = value.substring(0, 20) + '***MASKED***';
			} else {
				sanitized[key] = value;
			}
		}
		return sanitized;
	}

	/**
	 * Sanitize response for logging
	 */
	private sanitizeResponse(response: unknown): unknown {
		if (!response) return response;
		if (typeof response === 'string') {
			return response.length > 1000 ? response.substring(0, 1000) + '...(truncated)' : response;
		}
		if (typeof response === 'object') {
			const str = JSON.stringify(response);
			return str.length > 1000 ? str.substring(0, 1000) + '...(truncated)' : str;
		}
		return response;
	}

	/**
	 * Get preview of response for logging
	 */
	private getPreview(response: unknown): string {
		if (!response) return 'null/undefined';
		if (typeof response === 'string') {
			return response.length > 200 ? response.substring(0, 200) + '...' : response;
		}
		if (typeof response === 'object') {
			try {
				const str = JSON.stringify(response);
				return str.length > 200 ? str.substring(0, 200) + '...' : str;
			} catch {
				return '[Object]';
			}
		}
		return String(response);
	}

	/**
	 * Build HTTP request (platform-specific)
	 */
	protected abstract buildRequest(
		context: IExecuteFunctions,
		itemIndex: number,
		params: Record<string, unknown>,
		credentials: Credentials
	): { method: string; url: string; body?: unknown; headers?: Record<string, string> };

	/**
	 * Parse API response (platform-specific)
	 */
	protected abstract parseResponse(response: unknown): ParsedMediaResponse;

	/**
	 * Build execution result from parsed response
	 */
	protected buildResult(
		parsed: ParsedMediaResponse,
		params: Record<string, unknown>
	): INodeExecutionData {
		const config = this.getConfig();

		// Extract media data
		const imageData = ResponseHandler.handleImageData(parsed.imageUrl, parsed.base64Data);
		const videoData = parsed.videoUrl || null;

		return ResponseHandler.buildSuccessResponse(
			{
				model: params.model as string,
				imageUrl: imageData,
				videoUrl: videoData,
				provider: config.provider,
				mediaType: config.mediaType,
			},
			{
				provider: config.provider,
				mediaType: config.mediaType,
				...parsed.metadata,
			}
		);
	}

	/**
	 * Safely get node parameter with default
	 */
	protected getParam<T>(
		context: IExecuteFunctions,
		parameterName: string,
		itemIndex: number,
		defaultValue: T
	): T {
		try {
			return context.getNodeParameter(parameterName, itemIndex) as T;
		} catch (error) {
			context.logger?.debug(`[MediaGenExecutor] Parameter ${parameterName} not found, using default`, {
				defaultValue,
			});
			return defaultValue;
		}
	}
}
