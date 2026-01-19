import { MediaGenError, ERROR_CODES, validateCredentials, validateGenerationParams } from '../utils/errors';

describe('MediaGenError', () => {
	test('should create error with code and details', () => {
		const error = new MediaGenError('Test error', ERROR_CODES.INVALID_API_KEY, { key: 'value' });
		expect(error.message).toBe('Test error');
		expect(error.code).toBe('INVALID_API_KEY');
		expect(error.details).toEqual({ key: 'value' });
		expect(error.name).toBe('MediaGenError');
	});

	test('should identify retryable errors', () => {
		expect(new MediaGenError('Network error', ERROR_CODES.NETWORK_ERROR).isRetryable()).toBe(true);
		expect(new MediaGenError('Timeout', ERROR_CODES.TIMEOUT).isRetryable()).toBe(true);
		expect(new MediaGenError('Rate limit', ERROR_CODES.RATE_LIMIT).isRetryable()).toBe(true);
		expect(new MediaGenError('Invalid key', ERROR_CODES.INVALID_API_KEY).isRetryable()).toBe(false);
	});

	test('should return user-friendly messages', () => {
		expect(new MediaGenError('Error', ERROR_CODES.INVALID_API_KEY).getUserMessage()).toBe('API key is invalid or missing');
		expect(new MediaGenError('Error', ERROR_CODES.RATE_LIMIT).getUserMessage()).toBe('Rate limit exceeded, please try again later');
		expect(new MediaGenError('Error', ERROR_CODES.INVALID_MODEL).getUserMessage()).toBe('Model name is invalid');
		expect(new MediaGenError('Error', ERROR_CODES.NETWORK_ERROR).getUserMessage()).toBe('Network error occurred');
		expect(new MediaGenError('Error', ERROR_CODES.TIMEOUT).getUserMessage()).toBe('Request timed out');
		expect(new MediaGenError('Error', ERROR_CODES.INVALID_PARAMS).getUserMessage()).toBe('Invalid parameters provided');
		expect(new MediaGenError('Error', ERROR_CODES.API_ERROR).getUserMessage()).toBe('API error occurred');
	});
});

describe('validateCredentials', () => {
	test('should validate valid credentials', () => {
		const result = validateCredentials({
			apiKey: 'test-key',
			apiFormat: 'openai',
		});
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('should reject missing credentials', () => {
		const result = validateCredentials(null);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Credentials are required');
	});

	test('should reject missing API key', () => {
		const result = validateCredentials({
			apiFormat: 'openai',
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('API key is required and must be a non-empty string');
	});

	test('should reject empty API key', () => {
		const result = validateCredentials({
			apiKey: '   ',
			apiFormat: 'openai',
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('API key is required and must be a non-empty string');
	});

	test('should reject invalid API format', () => {
		const result = validateCredentials({
			apiKey: 'test-key',
			apiFormat: 'invalid',
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('API format must be one of: openai, gemini, bailian');
	});
});

describe('validateGenerationParams', () => {
	test('should validate valid parameters', () => {
		const result = validateGenerationParams({
			model: 'dall-e-3',
			prompt: 'A sunset',
			additionalParams: '{}',
		});
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('should reject missing model', () => {
		const result = validateGenerationParams({
			prompt: 'A sunset',
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Model is required and must be a non-empty string');
	});

	test('should reject empty model', () => {
		const result = validateGenerationParams({
			model: '   ',
			prompt: 'A sunset',
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Model is required and must be a non-empty string');
	});

	test('should reject missing prompt', () => {
		const result = validateGenerationParams({
			model: 'dall-e-3',
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Prompt is required and must be a non-empty string');
	});

	test('should reject invalid JSON in additional params', () => {
		const result = validateGenerationParams({
			model: 'dall-e-3',
			prompt: 'A sunset',
			additionalParams: '{ invalid json }',
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Additional parameters must be valid JSON');
	});

	test('should accept empty additional params', () => {
		const result = validateGenerationParams({
			model: 'dall-e-3',
			prompt: 'A sunset',
			additionalParams: '',
		});
		expect(result.valid).toBe(true);
	});

	test('should accept valid JSON in additional params', () => {
		const result = validateGenerationParams({
			model: 'dall-e-3',
			prompt: 'A sunset',
			additionalParams: '{"size": "1024x1024", "n": 1}',
		});
		expect(result.valid).toBe(true);
	});
});
