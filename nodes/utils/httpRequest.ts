import type { IExecuteFunctions } from 'n8n-workflow';
import type { IHttpRequestOptions } from 'n8n-workflow';
import { MediaGenError, isTimeoutError } from './errors';

/**
 * HTTP request options for making API calls
 */
export interface HttpRequestOptions {
	/** HTTP method */
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	/** Full URL for the request */
	url: string;
	/** Optional credentials with API key */
	credentials?: { apiKey: string; baseUrl?: string };
	/** Request body (will be JSON stringified) */
	body?: unknown;
	/** Additional headers */
	headers?: Record<string, string>;
	/** Request timeout in milliseconds (default: 60000) */
	timeout?: number;
	/** Whether to parse response as JSON (default: true) */
	json?: boolean;
	/** Response encoding (for binary data) */
	encoding?: 'arraybuffer' | 'json' | 'utf8';
}

/**
 * Download binary data options
 */
export interface DownloadBinaryOptions {
	/** Download timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * Makes an HTTP request with consistent error handling and authorization
 *
 * This utility centralizes HTTP request handling across all nodes, providing:
 * - Automatic Bearer token authorization
 * - Consistent timeout error detection
 * - Standardized error wrapping with MediaGenError
 *
 * @param context - n8n execution context for helpers
 * @param options - Request configuration options
 * @returns Parsed response data
 * @throws MediaGenError on request failures
 *
 * @example
 * ```typescript
 * const data = await makeHttpRequest(context, {
 *   method: 'POST',
 *   url: 'https://api.example.com/generate',
 *   credentials: { apiKey: 'sk-...' },
 *   body: { prompt: 'A beautiful sunset' },
 *   timeout: 30000,
 * });
 * ```
 */
export async function makeHttpRequest(
	context: IExecuteFunctions,
	options: HttpRequestOptions,
): Promise<any> {
	const {
		method,
		url,
		credentials,
		body,
		headers: customHeaders = {},
		timeout = 60000,
		json = true,
		encoding = 'json',
	} = options;

	// Build headers with authorization
	const headers: Record<string, string> = {
		...customHeaders,
	};

	// Add authorization header if credentials provided
	if (credentials?.apiKey) {
		headers['Authorization'] = `Bearer ${credentials.apiKey}`;
	}

	// Add content-type for JSON body
	if (body && method !== 'GET') {
		headers['Content-Type'] = 'application/json';
	}

	// Prepare request options
	const requestOptions: IHttpRequestOptions = {
		method,
		url,
		headers,
		timeout,
		json,
	};

	// Add encoding if specified
	if (encoding === 'arraybuffer') {
		requestOptions.encoding = 'arraybuffer';
		requestOptions.json = false;
	}

	// Add body for non-GET requests
	if (body && method !== 'GET') {
		requestOptions.body = JSON.stringify(body as Record<string, unknown>);
	}

	try {
		return await context.helpers.httpRequest(requestOptions);
	} catch (error) {
		// Handle timeout errors
		if (error instanceof Error && isTimeoutError(error)) {
			throw new MediaGenError('Request timeout', 'TIMEOUT');
		}

		// Handle other errors
		if (error instanceof Error) {
			throw new MediaGenError(error.message, 'API_ERROR');
		}

		throw new MediaGenError(`API request failed: ${String(error)}`, 'API_ERROR');
	}
}

/**
 * Makes an HTTP request with polling for async operations
 *
 * This is a specialized version for polling operations that returns both
 * data and error information to allow retry logic in polling loops.
 *
 * @param context - n8n execution context
 * @param options - Request configuration options
 * @returns Object with data and optional error
 */
export async function makePollRequest(
	context: IExecuteFunctions,
	options: HttpRequestOptions,
): Promise<{ data?: unknown; error?: string }> {
	try {
		const data = await makeHttpRequest(context, {
			...options,
			timeout: options.timeout || 10000,
		});
		return { data };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Downloads binary data (image, video, etc.) from URL
 *
 * @param context - n8n execution context
 * @param url - URL to download from
 * @param options - Download options
 * @returns Buffer containing binary data
 * @throws MediaGenError on download failures
 */
export async function downloadBinary(
	context: IExecuteFunctions,
	url: string,
	options: DownloadBinaryOptions = {},
): Promise<Buffer> {
	const { timeout = 30000 } = options;

	try {
		context.logger?.debug('[HttpRequest] Downloading binary', { url: url.substring(0, 50) + '...' });

		const buffer = await context.helpers.httpRequest({
			method: 'GET',
			url,
			encoding: 'arraybuffer',
			timeout,
		});

		return buffer as Buffer;
	} catch (error) {
		if (error instanceof Error && isTimeoutError(error)) {
			throw new MediaGenError('Download timeout', 'TIMEOUT');
		}

		throw new MediaGenError(
			error instanceof Error ? error.message : 'Download failed',
			'NETWORK_ERROR'
		);
	}
}

/**
 * POST JSON data to API
 *
 * Specialized method for POST requests with JSON body
 *
 * @param context - n8n execution context
 * @param url - Request URL
 * @param body - Request body object
 * @param credentials - Optional credentials
 * @param timeout - Request timeout
 * @returns Parsed JSON response
 * @throws MediaGenError on request failures
 */
export async function postJson<T = unknown>(
	context: IExecuteFunctions,
	url: string,
	body: Record<string, unknown>,
	credentials?: { apiKey: string; baseUrl?: string },
	timeout = 60000
): Promise<T> {
	return await makeHttpRequest(context, {
		method: 'POST',
		url,
		credentials,
		body,
		timeout,
		json: true,
	}) as Promise<T>;
}

/**
 * POST form data (multipart) to API
 *
 * Specialized method for POST requests with FormData
 *
 * @param context - n8n execution context
 * @param url - Request URL
 * @param formData - Form data to send
 * @param credentials - Optional credentials
 * @param timeout - Request timeout
 * @returns Parsed JSON response
 * @throws MediaGenError on request failures
 */
export async function postForm<T = unknown>(
	context: IExecuteFunctions,
	url: string,
	formData: FormData,
	credentials?: { apiKey: string; baseUrl?: string },
	timeout = 60000
): Promise<T> {
	const headers: Record<string, string> = {};

	// Add authorization header if credentials provided
	if (credentials?.apiKey) {
		headers['Authorization'] = `Bearer ${credentials.apiKey}`;
	}

	const requestOptions: IHttpRequestOptions = {
		method: 'POST',
		url,
		headers,
		body: formData as unknown as Record<string, unknown>,
		timeout,
	};

	try {
		return await context.helpers.httpRequest(requestOptions) as Promise<T>;
	} catch (error) {
		if (error instanceof Error && isTimeoutError(error)) {
			throw new MediaGenError('Request timeout', 'TIMEOUT');
		}

		throw new MediaGenError(
			error instanceof Error ? error.message : 'Form request failed',
			'API_ERROR'
		);
	}
}

/**
 * GET request with JSON response
 *
 * Specialized method for GET requests
 *
 * @param context - n8n execution context
 * @param url - Request URL
 * @param credentials - Optional credentials
 * @param timeout - Request timeout
 * @returns Parsed JSON response
 * @throws MediaGenError on request failures
 */
export async function getJson<T = unknown>(
	context: IExecuteFunctions,
	url: string,
	credentials?: { apiKey: string; baseUrl?: string },
	timeout = 60000
): Promise<T> {
	return await makeHttpRequest(context, {
		method: 'GET',
		url,
		credentials,
		timeout,
		json: true,
	}) as Promise<T>;
}
