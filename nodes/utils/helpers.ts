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
