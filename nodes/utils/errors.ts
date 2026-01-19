export class MediaGenError extends Error {
	constructor(
		message: string,
		public code: string,
		public details?: any
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
} as const;

export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
	fn: () => Promise<T>,
	options: {
		maxRetries?: number;
		initialDelay?: number;
		maxDelay?: number;
		backoffMultiplier?: number;
	} = {}
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

export function validateCredentials(credentials: any): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!credentials) {
		errors.push('Credentials are required');
		return { valid: false, errors };
	}

	if (!credentials.apiKey || typeof credentials.apiKey !== 'string' || credentials.apiKey.trim() === '') {
		errors.push('API key is required and must be a non-empty string');
	}

	if (!credentials.apiFormat || typeof credentials.apiFormat !== 'string') {
		errors.push('API format is required');
	}

	const validFormats = ['openai', 'gemini', 'bailian', 'replicate', 'huggingface'];
	if (credentials.apiFormat && !validFormats.includes(credentials.apiFormat)) {
		errors.push(`API format must be one of: ${validFormats.join(', ')}`);
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

export function validateGenerationParams(params: {
	model?: string;
	prompt?: string;
	additionalParams?: string;
}): { valid: boolean; errors: string[] } {
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
