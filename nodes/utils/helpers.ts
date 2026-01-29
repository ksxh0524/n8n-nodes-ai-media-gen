export const SENSITIVE_PATTERNS = [
	/apiKey/i,
	/api[_-]?key/i,
	/secret/i,
	/token/i,
	/password/i,
	/authorization/i,
	/bearer/i,
] as const;

export const DANGEROUS_PATTERNS = [
	/<script/i,
	/javascript:/i,
	/onerror=/i,
	/onload=/i,
	/eval\(/i,
	/document\./i,
	/window\./i,
] as const;

export function sanitizeForLogging(obj: unknown): unknown {
	if (typeof obj !== 'object' || obj === null) {
		return obj;
	}

	const sanitized = { ...obj };
	for (const key in sanitized) {
		if (typeof key === 'string' && SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
			(sanitized as Record<string, unknown>)[key] = '[REDACTED]';
		}
	}
	return sanitized;
}

export function detectDangerousContent(input: string): boolean {
	return DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
}

export function validateAndSanitizeInput(input: {
	model?: string;
	prompt?: string;
	additionalParams?: string;
}): { valid: boolean; errors: string[]; sanitized: typeof input } {
	const errors: string[] = [];
	const sanitized = { ...input };

	if (sanitized.model && typeof sanitized.model === 'string') {
		sanitized.model = sanitized.model.trim();
		if (sanitized.model.length === 0) {
			errors.push('Model cannot be empty');
		}
		if (sanitized.model.length > 200) {
			errors.push('Model name too long (max 200 characters)');
		}
	}

	if (sanitized.prompt && typeof sanitized.prompt === 'string') {
		sanitized.prompt = sanitized.prompt.trim();
		if (sanitized.prompt.length === 0) {
			errors.push('Prompt cannot be empty');
		}
		if (sanitized.prompt.length > 10000) {
			errors.push('Prompt too long (max 10000 characters)');
		}
	}

	if (sanitized.additionalParams && typeof sanitized.additionalParams === 'string') {
		sanitized.additionalParams = sanitized.additionalParams.trim();
		if (sanitized.additionalParams.length > 0) {
			try {
				JSON.parse(sanitized.additionalParams);
			} catch {
				errors.push('Additional parameters must be valid JSON');
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		sanitized,
	};
}

/**
 * Validates API credentials
 * @param credentials - Credentials object to validate
 * @returns Validation result with valid flag, errors array, and sanitized credentials
 */
export function validateCredentials(credentials: { apiKey?: string; apiFormat?: string } | null): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (!credentials) {
		errors.push('Credentials are required');
		return { valid: false, errors };
	}

	if (!credentials.apiKey || typeof credentials.apiKey !== 'string' || credentials.apiKey.trim() === '') {
		errors.push('API key is required and must be a non-empty string');
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

/**
 * Validates generation parameters
 * @param params - Parameters to validate
 * @returns Validation result with valid flag, errors array, and sanitized params
 */
export function validateGenerationParams(params: {
	model?: string;
	prompt?: string;
	additionalParams?: string;
}): {
	valid: boolean;
	errors: string[];
	sanitized: typeof params;
} {
	const errors: string[] = [];
	const sanitized = { ...params };

	if (!sanitized.model || typeof sanitized.model !== 'string' || sanitized.model.trim() === '') {
		errors.push('Model is required and must be a non-empty string');
	} else {
		sanitized.model = sanitized.model.trim();
	}

	if (!sanitized.prompt || typeof sanitized.prompt !== 'string' || sanitized.prompt.trim() === '') {
		errors.push('Prompt is required and must be a non-empty string');
	} else {
		sanitized.prompt = sanitized.prompt.trim();
	}

	if (sanitized.additionalParams && typeof sanitized.additionalParams === 'string') {
		sanitized.additionalParams = sanitized.additionalParams.trim();
		if (sanitized.additionalParams.length > 0) {
			try {
				JSON.parse(sanitized.additionalParams);
			} catch {
				errors.push('Additional parameters must be valid JSON');
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		sanitized,
	};
}
