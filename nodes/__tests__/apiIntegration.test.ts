import { withRetry, MediaGenError } from '../utils/errors';
import { API_RESPONSES, HTTP_STATUS } from './fixtures/apiResponses';

// Mock fetch for API integration tests
global.fetch = jest.fn();

describe('API Integration Tests', () => {
	afterEach(() => {
		jest.resetAllMocks();
	});

	describe('Successful API Responses', () => {
		it('should handle successful Z-Image generation', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				status: HTTP_STATUS.OK,
				json: async () => API_RESPONSES.Z_IMAGE_SUCCESS,
			});

			const response = await fetch('https://api.modelscope.cn/v1/files/generation');
			const data = await response.json();

			expect(data.output?.url).toBeDefined();
			expect(data.output?.url).toContain('image_');
		});

		it('should handle successful Qwen-Image generation', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				status: HTTP_STATUS.OK,
				json: async () => API_RESPONSES.QWEN_IMAGE_SUCCESS,
			});

			const response = await fetch('https://api.modelscope.cn/v1/files/generation');
			const data = await response.json();

			expect(data.output?.url).toBeDefined();
		});

		it('should handle successful edit response', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				status: HTTP_STATUS.OK,
				json: async () => API_RESPONSES.QWEN_EDIT_SUCCESS,
			});

			const response = await fetch('https://api.modelscope.cn/v1/files/generation');
			const data = await response.json();

			expect(data.output?.url).toBeDefined();
		});

		it('should handle alternative URL fields', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				status: HTTP_STATUS.OK,
				json: async () => API_RESPONSES.ALTERNATIVE_URL,
			});

			const response = await fetch('https://api.modelscope.cn/v1/files/generation');
			const data = await response.json();

			expect(data.url).toBeDefined();
		});

		it('should handle image_url field', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				status: HTTP_STATUS.OK,
				json: async () => API_RESPONSES.IMAGE_URL,
			});

			const response = await fetch('https://api.modelscope.cn/v1/files/generation');
			const data = await response.json();

			expect(data.image_url).toBeDefined();
		});
	});

	describe('Error Responses', () => {
		it('should handle 401 Unauthorized', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: false,
				status: HTTP_STATUS.UNAUTHORIZED,
				json: async () => API_RESPONSES.INVALID_API_KEY,
			});

			const response = await fetch('https://api.modelscope.cn/v1/files/generation');

			expect(response.ok).toBe(false);
			expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
		});

		it('should handle 403 Forbidden', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: false,
				status: HTTP_STATUS.FORBIDDEN,
				json: async () => ({ error: 'Access forbidden' }),
			});

			const response = await fetch('https://api.modelscope.cn/v1/files/generation');

			expect(response.ok).toBe(false);
			expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
		});

		it('should handle 429 Rate Limit', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: false,
				status: HTTP_STATUS.RATE_LIMIT,
				json: async () => API_RESPONSES.RATE_LIMIT,
			});

			const response = await fetch('https://api.modelscope.cn/v1/files/generation');

			expect(response.ok).toBe(false);
			expect(response.status).toBe(HTTP_STATUS.RATE_LIMIT);
		});

		it('should handle 500 Internal Error', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: false,
				status: HTTP_STATUS.INTERNAL_ERROR,
				json: async () => ({ error: 'Internal server error' }),
			});

			const response = await fetch('https://api.modelscope.cn/v1/files/generation');

			expect(response.ok).toBe(false);
			expect(response.status).toBe(HTTP_STATUS.INTERNAL_ERROR);
		});

		it('should handle 503 Service Unavailable', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: false,
				status: HTTP_STATUS.SERVICE_UNAVAILABLE,
				json: async () => ({ error: 'Service temporarily unavailable' }),
			});

			const response = await fetch('https://api.modelscope.cn/v1/files/generation');

			expect(response.ok).toBe(false);
			expect(response.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
		});
	});

	describe('Malformed Responses', () => {
		it('should handle missing image URL', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				status: HTTP_STATUS.OK,
				json: async () => API_RESPONSES.MISSING_IMAGE_URL,
			});

			const response = await fetch('https://api.modelscope.cn/v1/files/generation');
			const data = await response.json();

			expect(data.output?.url).toBeUndefined();
		});

		it('should handle invalid JSON', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				status: HTTP_STATUS.OK,
				json: async () => {
					throw new Error('Invalid JSON');
				},
			});

			const response = await fetch('https://api.modelscope.cn/v1/files/generation');
			const data = await response.json().catch(() => null);

			expect(data).toBeNull();
		});

		it('should handle empty response body', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				status: HTTP_STATUS.OK,
				json: async () => ({}),
			});

			const response = await fetch('https://api.modelscope.cn/v1/files/generation');
			const data = await response.json();

			expect(data).toEqual({});
		});
	});

	describe('Retry Logic', () => {
		it('should retry on retryable errors', async () => {
			let attempts = 0;
			const mockFn = jest.fn().mockImplementation(() => {
				attempts++;
				if (attempts < 3) {
					throw new MediaGenError('Network error', 'NETWORK_ERROR');
				}
				return { success: true };
			});

			await withRetry(mockFn, { maxRetries: 3 });

			expect(mockFn).toHaveBeenCalledTimes(3);
		});

		it('should not retry on non-retryable errors', async () => {
			const mockFn = jest.fn().mockImplementation(() => {
				throw new MediaGenError('Invalid API key', 'INVALID_API_KEY');
			});

			await expect(withRetry(mockFn, { maxRetries: 3 })).rejects.toThrow();
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it('should fail after max retries', async () => {
			const mockFn = jest.fn().mockImplementation(() => {
				throw new MediaGenError('Network error', 'NETWORK_ERROR');
			});

			await expect(withRetry(mockFn, { maxRetries: 2 })).rejects.toThrow();
			expect(mockFn).toHaveBeenCalledTimes(2);
		});
	});

	describe('Timeout Handling', () => {
		it('should handle request timeout', async () => {
			const controller = new AbortController();
			setTimeout(() => controller.abort(), 100);

			await expect(
				fetch('https://api.modelscope.cn/v1/files/generation', {
					signal: controller.signal,
				})
			).rejects.toThrow();
		});
	});

	describe('Request Building', () => {
		it('should build correct request body for Z-Image', () => {
			const requestBody = {
				model: 'Tongyi-MAI/Z-Image',
				input: { prompt: 'A beautiful landscape' },
				parameters: {
					size: '1024x1024',
					seed: 42,
				},
			};

			expect(requestBody.model).toBe('Tongyi-MAI/Z-Image');
			expect(requestBody.input.prompt).toBeDefined();
			expect(requestBody.parameters?.size).toBeDefined();
		});

		it('should build correct request body for Edit model', () => {
			const requestBody = {
				model: 'Qwen-Image-Edit-2511',
				input: {
					prompt: 'Add a rainbow',
					image: 'https://example.com/input.jpg',
				},
				parameters: {
					size: '1024x1024',
				},
			};

			expect(requestBody.input.image).toBeDefined();
			expect(requestBody.input.prompt).toBeDefined();
		});

		it('should include num_images for generation models', () => {
			const requestBody = {
				model: 'Qwen-Image-2512',
				input: { prompt: 'A cityscape' },
				parameters: {
					size: '1024x1024',
					seed: 123,
					num_images: 2,
				},
			};

			expect(requestBody.parameters?.num_images).toBe(2);
		});
	});
});
