import {
	SENSITIVE_PATTERNS,
	DANGEROUS_PATTERNS,
	sanitizeForLogging,
	detectDangerousContent,
	validateAndSanitizeInput,
} from '../utils/helpers';

describe('SENSITIVE_PATTERNS', () => {
	test('should match apiKey variations', () => {
		expect(SENSITIVE_PATTERNS.some(p => p.test('apiKey'))).toBe(true);
		expect(SENSITIVE_PATTERNS.some(p => p.test('api_key'))).toBe(true);
		expect(SENSITIVE_PATTERNS.some(p => p.test('api-key'))).toBe(true);
	});

	test('should match secret', () => {
		expect(SENSITIVE_PATTERNS.some(p => p.test('secret'))).toBe(true);
		expect(SENSITIVE_PATTERNS.some(p => p.test('mySecret'))).toBe(true);
	});

	test('should match token', () => {
		expect(SENSITIVE_PATTERNS.some(p => p.test('token'))).toBe(true);
		expect(SENSITIVE_PATTERNS.some(p => p.test('authToken'))).toBe(true);
	});

	test('should match password', () => {
		expect(SENSITIVE_PATTERNS.some(p => p.test('password'))).toBe(true);
	});

	test('should match authorization', () => {
		expect(SENSITIVE_PATTERNS.some(p => p.test('authorization'))).toBe(true);
	});

	test('should match bearer', () => {
		expect(SENSITIVE_PATTERNS.some(p => p.test('bearer'))).toBe(true);
	});
});

describe('DANGEROUS_PATTERNS', () => {
	test('should detect script tags', () => {
		expect(DANGEROUS_PATTERNS.some(p => p.test('<script>alert(1)</script>'))).toBe(true);
	});

	test('should detect javascript protocol', () => {
		expect(DANGEROUS_PATTERNS.some(p => p.test('javascript:alert(1)'))).toBe(true);
	});

	test('should detect onerror attribute', () => {
		expect(DANGEROUS_PATTERNS.some(p => p.test('<img onerror=alert(1)>'))).toBe(true);
	});

	test('should detect onload attribute', () => {
		expect(DANGEROUS_PATTERNS.some(p => p.test('<body onload=alert(1)>'))).toBe(true);
	});

	test('should detect eval', () => {
		expect(DANGEROUS_PATTERNS.some(p => p.test('eval(someCode)'))).toBe(true);
	});

	test('should detect document access', () => {
		expect(DANGEROUS_PATTERNS.some(p => p.test('document.cookie'))).toBe(true);
	});

	test('should detect window access', () => {
		expect(DANGEROUS_PATTERNS.some(p => p.test('window.location'))).toBe(true);
	});
});

describe('sanitizeForLogging', () => {
	test('should return non-objects as-is', () => {
		expect(sanitizeForLogging('string')).toBe('string');
		expect(sanitizeForLogging(123)).toBe(123);
		expect(sanitizeForLogging(null)).toBe(null);
		expect(sanitizeForLogging(undefined)).toBe(undefined);
	});

	test('should redact sensitive fields', () => {
		const input = {
			apiKey: 'secret123',
			normalField: 'visible',
			password: 'mypassword',
			token: 'bearer-token',
		};
		const result = sanitizeForLogging(input) as Record<string, unknown>;

		expect(result.apiKey).toBe('[REDACTED]');
		expect(result.normalField).toBe('visible');
		expect(result.password).toBe('[REDACTED]');
		expect(result.token).toBe('[REDACTED]');
	});

	test('should handle nested objects', () => {
		const input = {
			user: {
				apiKey: 'nested-secret',
				name: 'John',
			},
		};
		// Note: Current implementation only handles top-level keys
		const result = sanitizeForLogging(input) as Record<string, unknown>;
		expect(result.user).toEqual({
			apiKey: 'nested-secret',
			name: 'John',
		});
	});
});

describe('detectDangerousContent', () => {
	test('should detect script tags', () => {
		expect(detectDangerousContent('<script>alert(1)</script>')).toBe(true);
	});

	test('should detect javascript protocol', () => {
		expect(detectDangerousContent('javascript:alert(1)')).toBe(true);
	});

	test('should return false for safe content', () => {
		expect(detectDangerousContent('This is a safe prompt')).toBe(false);
		expect(detectDangerousContent('A beautiful landscape')).toBe(false);
	});

	test('should handle empty string', () => {
		expect(detectDangerousContent('')).toBe(false);
	});
});

describe('validateAndSanitizeInput', () => {
	test('should validate valid input', () => {
		const result = validateAndSanitizeInput({
			model: 'dall-e-3',
			prompt: 'A beautiful sunset',
		});

		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.sanitized.model).toBe('dall-e-3');
		expect(result.sanitized.prompt).toBe('A beautiful sunset');
	});

	test('should trim whitespace', () => {
		const result = validateAndSanitizeInput({
			model: '  dall-e-3  ',
			prompt: '  A sunset  ',
		});

		expect(result.sanitized.model).toBe('dall-e-3');
		expect(result.sanitized.prompt).toBe('A sunset');
	});

	test('should reject empty model', () => {
		const result = validateAndSanitizeInput({
			model: '',
			prompt: 'A sunset',
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Model cannot be empty');
	});

	test('should reject whitespace-only model', () => {
		const result = validateAndSanitizeInput({
			model: '   ',
			prompt: 'A sunset',
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Model cannot be empty');
	});

	test('should reject empty prompt', () => {
		const result = validateAndSanitizeInput({
			model: 'dall-e-3',
			prompt: '',
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Prompt cannot be empty');
	});

	test('should reject model that is too long', () => {
		const result = validateAndSanitizeInput({
			model: 'a'.repeat(201),
			prompt: 'A sunset',
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Model name too long (max 200 characters)');
	});

	test('should reject prompt that is too long', () => {
		const result = validateAndSanitizeInput({
			model: 'dall-e-3',
			prompt: 'a'.repeat(10001),
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Prompt too long (max 10000 characters)');
	});

	test('should accept empty additionalParams', () => {
		const result = validateAndSanitizeInput({
			model: 'dall-e-3',
			prompt: 'A sunset',
			additionalParams: '',
		});

		expect(result.valid).toBe(true);
	});

	test('should accept valid JSON in additionalParams', () => {
		const result = validateAndSanitizeInput({
			model: 'dall-e-3',
			prompt: 'A sunset',
			additionalParams: '{"size": "1024x1024", "n": 1}',
		});

		expect(result.valid).toBe(true);
	});

	test('should reject invalid JSON in additionalParams', () => {
		const result = validateAndSanitizeInput({
			model: 'dall-e-3',
			prompt: 'A sunset',
			additionalParams: '{ invalid json }',
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Additional parameters must be valid JSON');
	});

	test('should collect multiple errors', () => {
		const result = validateAndSanitizeInput({
			model: '',
			prompt: '',
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Model cannot be empty');
		expect(result.errors).toContain('Prompt cannot be empty');
	});
});
