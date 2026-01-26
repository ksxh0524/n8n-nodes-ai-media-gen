import type { ApiFormat, IGenerationParams, IRetryOptions } from './types';

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

	isRetryable(): boolean {
		const retryableCodes = [
			'NETWORK_ERROR',
			'TIMEOUT',
			'RATE_LIMIT',
			'SERVICE_UNAVAILABLE',
		];
		return retryableCodes.includes(this.code);
	}

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
} as const;

export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

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

export function validateCredentials(credentials: unknown): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!credentials || typeof credentials !== 'object') {
		errors.push('Credentials are required');
		return { valid: false, errors };
	}

	const creds = credentials as Record<string, unknown>;

	if (!creds.apiKey || typeof creds.apiKey !== 'string' || creds.apiKey.trim() === '') {
		errors.push('API key is required and must be a non-empty string');
	}

	if (!creds.apiFormat || typeof creds.apiFormat !== 'string') {
		errors.push('API format is required');
	}

	const validFormats: ApiFormat[] = ['openai', 'gemini', 'bailian', 'replicate', 'huggingface'];
	if (creds.apiFormat && !validFormats.includes(creds.apiFormat as ApiFormat)) {
		errors.push(`API format must be one of: ${validFormats.join(', ')}`);
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

export function validateGenerationParams(params: IGenerationParams): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!params.model || typeof params.model !== 'string' || params.model.trim() === '') {
		errors.push('Model is required and must be a non-empty string');
	}

	if (!params.prompt || typeof params.prompt !== 'string' || params.prompt.trim() === '') {
		errors.push('Prompt is required and must be a non-empty string');
	}

	if (params.additionalParams !== undefined) {
		try {
			if (params.additionalParams && params.additionalParams.trim() !== '') {
				JSON.parse(params.additionalParams);
			}
		} catch (error) {
			errors.push('Additional parameters must be valid JSON');
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
