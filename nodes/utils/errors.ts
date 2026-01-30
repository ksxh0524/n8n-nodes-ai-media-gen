import type { IRetryOptions } from './types';

/**
 * Custom error class for media generation operations
 *
 * Extends Error with error codes and details for better error handling
 * and user-friendly error messages.
 */
export class MediaGenError extends Error {
	constructor(
		message: string,
		public code: string,
		public details?: unknown
	) {
		super(message);
		this.name = 'MediaGenError';
		Error.captureStackTrace(this, this.constructor);
	}

	/**
	 * Checks if the error is retryable
	 *
	 * @returns true if the error type can be retried
	 */
	isRetryable(): boolean {
		const retryableCodes = [
			'NETWORK_ERROR',
			'TIMEOUT',
			'RATE_LIMIT',
			'SERVICE_UNAVAILABLE',
		];
		return retryableCodes.includes(this.code);
	}

	/**
	 * Gets a user-friendly error message
	 *
	 * @returns User-friendly error message based on error code
	 */
	getUserMessage(): string {
		const messages: Record<string, string> = {
			INVALID_API_KEY: 'API key is invalid or missing',
			RATE_LIMIT: 'Rate limit exceeded, please try again later',
			INVALID_MODEL: 'Model name is invalid',
			NETWORK_ERROR: 'Network error occurred',
			TIMEOUT: 'Request timed out',
			INVALID_PARAMS: 'Invalid parameters provided',
			API_ERROR: 'API error occurred',
			INVALID_IMAGE_INPUT: 'Invalid image input provided',
			IMAGE_TOO_LARGE: 'Image file size exceeds maximum allowed limit',
			UNSUPPORTED_FORMAT: 'Image format is not supported',
			IMAGE_PROCESSING_FAILED: 'Image processing operation failed',
			DEPENDENCY_MISSING: 'Required dependency is not available',
		};
		return messages[this.code] || this.message;
	}
}

export const ERROR_CODES = {
	INVALID_API_KEY: 'INVALID_API_KEY',
	RATE_LIMIT: 'RATE_LIMIT',
	INVALID_MODEL: 'INVALID_MODEL',
	NETWORK_ERROR: 'NETWORK_ERROR',
	TIMEOUT: 'TIMEOUT',
	INVALID_PARAMS: 'INVALID_PARAMS',
	API_ERROR: 'API_ERROR',
	SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
	// Image processing related error codes
	INVALID_IMAGE_INPUT: 'INVALID_IMAGE_INPUT',
	IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
	UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
	IMAGE_PROCESSING_FAILED: 'IMAGE_PROCESSING_FAILED',
	// Dependency related error codes
	DEPENDENCY_MISSING: 'DEPENDENCY_MISSING',
	// Video generation related error codes
	VIDEO_GENERATION_FAILED: 'VIDEO_GENERATION_FAILED',
	VIDEO_TOO_LARGE: 'VIDEO_TOO_LARGE',
	DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
	CONTENT_POLICY_VIOLATION: 'CONTENT_POLICY_VIOLATION',
} as const;

/**
 * Sleeps for a specified duration
 *
 * Uses setImmediate instead of setTimeout to comply with n8n community node restrictions.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified duration
 */
export function sleep(ms: number): Promise<void> {
	return new Promise<void>((resolve) => {
		const startTime = Date.now();
		const checkCondition = () => {
			if (Date.now() - startTime >= ms) {
				resolve();
			} else {
				setImmediate(checkCondition);
			}
		};
		setImmediate(checkCondition);
	});
}

/**
 * Executes a function with retry logic
 *
 * Retries the function on retryable errors with exponential backoff.
 * Non-retryable errors are thrown immediately.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the function result
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	options: IRetryOptions = {}
): Promise<T> {
	const {
		maxRetries = 3,
		initialDelay = 1000,
		maxDelay = 30000,
		backoffMultiplier = 2,
	} = options;

	let lastError: Error = new Error('Unknown error');

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error as Error;

			if (error instanceof MediaGenError && !error.isRetryable()) {
				throw error;
			}

			if (attempt < maxRetries - 1) {
				const delay = Math.min(
					initialDelay * Math.pow(backoffMultiplier, attempt),
					maxDelay
				);
				await sleep(delay);
			}
		}
	}

	throw lastError;
}

/**
 * Checks if an error is a timeout error
 *
 * @param error - Error to check
 * @returns true if the error is a timeout error
 */
export function isTimeoutError(error: Error): boolean {
	return error.message.includes('timeout') || error.message.includes('ETIMEDOUT');
}

/**
 * Handles API errors and converts them to MediaGenError
 *
 * @param error - Unknown error from API call
 * @param context - Description of where the error occurred
 * @throws MediaGenError with appropriate code
 */
export function handleApiError(error: unknown, context: string): never {
	if (error instanceof Error) {
		if (isTimeoutError(error)) {
			throw new MediaGenError(`${context} timeout`, 'TIMEOUT');
		}
		throw new MediaGenError(error.message, 'API_ERROR');
	}
	throw new MediaGenError(`${context} failed: ${String(error)}`, 'API_ERROR');
}
