import { AIMediaGen } from '../AIMediaGen';
import { MediaGenError } from '../utils/errors';
import { CacheManager } from '../utils/cache';
import { PerformanceMonitor } from '../utils/monitoring';
import { createMockExecuteFunctions, createMockCredentials, createMockFetchResponse } from './helpers/n8nMock';
import { API_RESPONSES, HTTP_STATUS } from './fixtures/apiResponses';
import { TEST_DATA } from './fixtures/testData';
import * as CONSTANTS from '../utils/constants';

// Mock fetch globally
global.fetch = jest.fn();

// Mock utility classes
jest.mock('../utils/cache');
jest.mock('../utils/monitoring');

describe('AIMediaGen', () => {
	let node: AIMediaGen;
	let mockContext: Partial<IExecuteFunctions>;

	beforeEach(() => {
		node = new AIMediaGen();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	describe('Node Description', () => {
		it('should have correct node properties', () => {
			expect(node.description.displayName).toBe('AI Media Generation');
			expect(node.description.name).toBe('aiMediaGen');
			expect(node.description.group).toContain('transform');
			expect(node.description.version).toBe(CONSTANTS.NODE_VERSION);
		});

		it('should have correct credentials configuration', () => {
			expect(node.description.credentials).toEqual([
				{
					name: 'modelScopeApi',
					required: true,
				},
			]);
		});

		it('should have three model options', () => {
			const modelProp = node.description.properties.find(p => p.name === 'model');
			expect(modelProp?.options).toHaveLength(3);
			expect(modelProp?.options?.[0].value).toBe('Tongyi-MAI/Z-Image');
			expect(modelProp?.options?.[1].value).toBe('Qwen-Image-2512');
			expect(modelProp?.options?.[2].value).toBe('Qwen-Image-Edit-2511');
		});
	});

	describe('execute', () => {
		const validCredentials = createMockCredentials();

		beforeEach(() => {
			mockContext = createMockExecuteFunctions(
				{
					model: 'Tongyi-MAI/Z-Image',
					prompt: 'A beautiful landscape',
					size: '1024x1024',
					seed: 42,
					numImages: 1,
					enableCache: false,
				},
				validCredentials
			);

			// Mock successful API response
			(global.fetch as jest.Mock).mockResolvedValue(
				createMockFetchResponse(API_RESPONSES.Z_IMAGE_SUCCESS, HTTP_STATUS.OK, true)
			);
		});

		it('should execute successfully with valid parameters', async () => {
			const result = await node.execute.call(mockContext as IExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json.success).toBe(true);
			expect(result[0][0].json.imageUrl).toBeDefined();
		});

		it('should handle multiple items with different configurations', async () => {
			const multiItemData = [
				{ json: { prompt: 'First image' } },
				{ json: { prompt: 'Second image' } },
				{ json: { prompt: 'Third image' } },
			];

			mockContext.getInputData = jest.fn().mockReturnValue(multiItemData);
			mockContext.getNodeParameter = jest.fn().mockImplementation((name: string, itemIndex: number) => {
				const configs = [
					{ model: 'Tongyi-MAI/Z-Image', prompt: 'First image', size: '512x512', timeout: 30000 },
					{ model: 'Tongyi-MAI/Z-Image', prompt: 'Second image', size: '1024x1024', timeout: 60000 },
					{ model: 'Qwen-Image-2512', prompt: 'Third image', size: '1152x896', timeout: 90000 },
				];
				return configs[itemIndex]?.[name as keyof typeof configs[0]] ?? 'default';
			});

			const result = await node.execute.call(mockContext as IExecuteFunctions);

			expect(result[0]).toHaveLength(3);
			expect(result[0][0].json.success).toBe(true);
			expect(result[0][1].json.success).toBe(true);
			expect(result[0][2].json.success).toBe(true);
		});

		it('should use correct item index for each parameter', async () => {
			const multiItemData = [
				{ json: { prompt: 'Image 1' } },
				{ json: { prompt: 'Image 2' } },
			];

			const getParamMock = jest.fn()
				.mockImplementation((name: string, itemIndex: number) => {
					if (name === 'options.timeout') {
						// Each item should have different timeout
						return itemIndex === 0 ? 30000 : 60000;
					}
					return 'Tongyi-MAI/Z-Image';
				});

			mockContext.getInputData = jest.fn().mockReturnValue(multiItemData);
			mockContext.getNodeParameter = getParamMock;

			await node.execute.call(mockContext as IExecuteFunctions);

			// Verify timeout was called with correct indices
			expect(getParamMock).toHaveBeenCalledWith('options.timeout', 0);
			expect(getParamMock).toHaveBeenCalledWith('options.timeout', 1);
		});
	});

	describe('error handling', () => {
		beforeEach(() => {
			mockContext = createMockExecuteFunctions(
				{
					model: 'Tongyi-MAI/Z-Image',
					prompt: 'Test',
				},
				createMockCredentials()
			);
		});

		it('should preserve error codes from MediaGenError', async () => {
			(global.fetch as jest.Mock).mockRejectedValue(
				new MediaGenError('Invalid API key', 'INVALID_API_KEY')
			);

			const result = await node.execute.call(mockContext as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(false);
			expect(result[0][0].json.errorCode).toBe('INVALID_API_KEY');
		});

		it('should use UNKNOWN error code for generic errors', async () => {
			(global.fetch as jest.Mock).mockRejectedValue(new Error('Generic error'));

			const result = await node.execute.call(mockContext as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(false);
			expect(result[0][0].json.errorCode).toBe('UNKNOWN');
		});

		it('should handle 401 authentication errors', async () => {
			(global.fetch as jest.Mock).mockResolvedValue(
				createMockFetchResponse(API_RESPONSES.INVALID_API_KEY, HTTP_STATUS.UNAUTHORIZED, false)
			);

			const result = await node.execute.call(mockContext as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(false);
			expect(result[0][0].json.errorCode).toBe('INVALID_API_KEY');
		});

		it('should handle 429 rate limit errors', async () => {
			(global.fetch as jest.Mock).mockResolvedValue(
				createMockFetchResponse(API_RESPONSES.RATE_LIMIT, HTTP_STATUS.RATE_LIMIT, false)
			);

			const result = await node.execute.call(mockContext as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(false);
			expect(result[0][0].json.errorCode).toBe('RATE_LIMIT');
		});

		it('should handle timeout errors', async () => {
			(global.fetch as jest.Mock).mockImplementation(() =>
				new Promise(() => {
					// Never resolves - simulates timeout
				})
			);

			// Set short timeout for testing
			mockContext.getNodeParameter = jest.fn().mockReturnValue({
				model: 'Tongyi-MAI/Z-Image',
				prompt: 'Test',
				timeout: 100, // 100ms timeout
			});

			const result = await node.execute.call(mockContext as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(false);
			expect(result[0][0].json.errorCode).toBe('TIMEOUT');
		});
	});

	describe('validation', () => {
		beforeEach(() => {
			mockContext = createMockExecuteFunctions(
				{},
				createMockCredentials()
			);

			(global.fetch as jest.Mock).mockResolvedValue(
				createMockFetchResponse(API_RESPONSES.Z_IMAGE_SUCCESS, HTTP_STATUS.OK, true)
			);
		});

		it('should validate numImages is within range', async () => {
			mockContext.getNodeParameter = jest.fn().mockImplementation((name: string) => {
				if (name === 'numImages') return 10; // Too high
				return 'Tongyi-MAI/Z-Image';
			});

			const result = await node.execute.call(mockContext as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(false);
			expect(result[0][0].json.error).toContain('between 1 and 4');
		});

		it('should validate size matches model', async () => {
			mockContext.getNodeParameter = jest.fn().mockImplementation((name: string) => {
				if (name === 'size') return '9999x9999'; // Invalid size
				if (name === 'model') return 'Tongyi-MAI/Z-Image';
				return 'default';
			});

			const result = await node.execute.call(mockContext as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(false);
			expect(result[0][0].json.error).toContain('not supported');
		});

		it('should validate input image for edit model', async () => {
			mockContext.getNodeParameter = jest.fn().mockImplementation((name: string) => {
				if (name === 'model') return 'Qwen-Image-Edit-2511';
				if (name === 'inputImage') return 'invalid-image-input';
				return 'default';
			});

			const result = await node.execute.call(mockContext as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(false);
			expect(result[0][0].json.errorCode).toBe('INVALID_IMAGE_INPUT');
		});

		it('should accept valid URL for input image', async () => {
			mockContext.getNodeParameter = jest.fn().mockImplementation((name: string) => {
				if (name === 'model') return 'Qwen-Image-Edit-2511';
				if (name === 'inputImage') return 'https://example.com/image.jpg';
				if (name === 'prompt') return 'Edit this image';
				return 'default';
			});

			(global.fetch as jest.Mock).mockResolvedValue(
				createMockFetchResponse(API_RESPONSES.QWEN_EDIT_SUCCESS, HTTP_STATUS.OK, true)
			);

			const result = await node.execute.call(mockContext as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(true);
		});

		it('should accept valid base64 for input image', async () => {
			mockContext.getNodeParameter = jest.fn().mockImplementation((name: string) => {
				if (name === 'model') return 'Qwen-Image-Edit-2511';
				if (name === 'inputImage') return TEST_DATA.BASE64_IMAGE.VALID_JPEG;
				if (name === 'prompt') return 'Edit this image';
				return 'default';
			});

			(global.fetch as jest.Mock).mockResolvedValue(
				createMockFetchResponse(API_RESPONSES.QWEN_EDIT_SUCCESS, HTTP_STATUS.OK, true)
			);

			const result = await node.execute.call(mockContext as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(true);
		});
	});

	describe('caching', () => {
		beforeEach(() => {
			mockContext = createMockExecuteFunctions(
				{
					model: 'Tongyi-MAI/Z-Image',
					prompt: 'A beautiful landscape',
					enableCache: true,
				},
				createMockCredentials()
			);

			(global.fetch as jest.Mock).mockResolvedValue(
				createMockFetchResponse(API_RESPONSES.Z_IMAGE_SUCCESS, HTTP_STATUS.OK, true)
			);
		});

		it('should use cached result when available', async () => {
			const mockCacheManager = {
				get: jest.fn().mockResolvedValue({
					imageUrl: 'https://cached.example.com/image.jpg',
				}),
				set: jest.fn(),
			};

			(CacheManager as jest.Mock).mockImplementation(() => mockCacheManager);

			const result = await node.execute.call(mockContext as IExecuteFunctions);

			expect(mockCacheManager.get).toHaveBeenCalled();
			expect(result[0][0].json._metadata.cached).toBe(true);
			expect(result[0][0].json.imageUrl).toBe('https://cached.example.com/image.jpg');
		});

		it('should cache successful API responses', async () => {
			const mockCacheManager = {
				get: jest.fn().mockResolvedValue(null), // Cache miss
				set: jest.fn(),
			};

			(CacheManager as jest.Mock).mockImplementation(() => mockCacheManager);

			await node.execute.call(mockContext as IExecuteFunctions);

			expect(mockCacheManager.set).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ imageUrl: expect.any(String) }),
				3600
			);
		});

		it('should not cache failed requests', async () => {
			const mockCacheManager = {
				get: jest.fn().mockResolvedValue(null),
				set: jest.fn(),
			};

			(CacheManager as jest.Mock).mockImplementation(() => mockCacheManager);

			(global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

			await node.execute.call(mockContext as IExecuteFunctions);

			expect(mockCacheManager.set).not.toHaveBeenCalled();
		});
	});

	describe('monitoring', () => {
		beforeEach(() => {
			mockContext = createMockExecuteFunctions(
				{
					model: 'Tongyi-MAI/Z-Image',
					prompt: 'Test',
				},
				createMockCredentials()
			);

			(global.fetch as jest.Mock).mockResolvedValue(
				createMockFetchResponse(API_RESPONSES.Z_IMAGE_SUCCESS, HTTP_STATUS.OK, true)
			);

			const mockMonitor = {
				startTimer: jest.fn().mockReturnValue('timer-123'),
				endTimer: jest.fn().mockReturnValue(1500),
				recordMetric: jest.fn(),
			};

			(PerformanceMonitor as jest.Mock).mockImplementation(() => mockMonitor);
		});

		it('should record performance metrics', async () => {
			await node.execute.call(mockContext as IExecuteFunctions);

			const mockMonitor = new PerformanceMonitor();
			expect(mockMonitor.recordMetric).toHaveBeenCalledWith(
				expect.objectContaining({
					provider: 'modelScope',
					model: 'Tongyi-MAI/Z-Image',
					mediaType: 'image',
					success: true,
				})
			);
		});
	});
});
