/**
 * Unit tests for ActionHandler and implementations
 */

import { ActionRegistry } from '../utils/actionRegistry';
import { BaseActionHandler } from '../utils/actionHandler';
import type { IActionHandler, ActionParameters, ActionResult } from '../utils/actionHandler';
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

describe('ActionRegistry', () => {
	let registry: ActionRegistry;

	beforeEach(() => {
		registry = ActionRegistry.getInstance();
	});

	describe('getInstance', () => {
		it('should return singleton instance', () => {
			const instance1 = ActionRegistry.getInstance();
			const instance2 = ActionRegistry.getInstance();

			expect(instance1).toBe(instance2);
		});
	});

	describe('registerHandler', () => {
		it('should register a handler', () => {
			const mockHandler = {
				actionName: 'test' as const,
				credentialType: 'testApi',
				mediaType: 'image' as const,
				requiresCredential: true,
				execute: jest.fn(),
			} as unknown as IActionHandler;

			registry.registerHandler(mockHandler);

			expect(registry.getHandler('test')).toBe(mockHandler);
		});

		it('should throw error if handler already registered', () => {
			const mockHandler = {
				actionName: 'test' as const,
				credentialType: 'testApi',
				mediaType: 'image' as const,
				requiresCredential: true,
				execute: jest.fn(),
			} as unknown as IActionHandler;

			registry.registerHandler(mockHandler);

			expect(() => registry.registerHandler(mockHandler)).toThrow();
		});
	});

	describe('getHandler', () => {
		it('should return registered handler', () => {
			const handler = registry.getHandler('sora');

			expect(handler).toBeDefined();
			expect(handler.actionName).toBe('sora');
		});

		it('should throw error for unknown action', () => {
			expect(() => registry.getHandler('unknown' as any)).toThrow();
		});
	});

	describe('getActionNames', () => {
		it('should return all action names', () => {
			const names = registry.getActionNames();

			expect(names).toContain('sora');
			expect(names).toContain('nanoBanana');
			expect(names).toContain('modelScope');
			expect(names).toContain('processing');
		});
	});

	describe('getActionDisplayInfo', () => {
		it('should return display info for action', () => {
			const info = registry.getActionDisplayInfo('sora');

			expect(info).toBeDefined();
			expect(info.displayName).toBe('Sora Video Generation');
		});

		it('should throw error for unknown action', () => {
			expect(() => registry.getActionDisplayInfo('unknown' as any)).toThrow();
		});
	});
});

describe('BaseActionHandler', () => {
	class TestActionHandler extends BaseActionHandler {
		readonly actionName = 'test' as const;
		readonly credentialType = 'testApi';
		readonly mediaType = 'image' as const;
		readonly requiresCredential = true;

		async execute(
			context: IExecuteFunctions,
			itemIndex: number,
			credentials?: Record<string, unknown>
		): Promise<INodeExecutionData> {
			return this.buildSuccessResponse({ test: 'data' }, { model: 'test-model', mediaType: 'image' });
		}
	}

	let handler: TestActionHandler;

	beforeEach(() => {
		handler = new TestActionHandler();
	});

	describe('getParameter', () => {
		it('should return parameter value', () => {
			const context = {
				getNodeParameter: jest.fn().mockReturnValue('test-value'),
			} as unknown as IExecuteFunctions;

			const value = handler.getParameter(context, 'testParam', 0);

			expect(value).toBe('test-value');
			expect(context.getNodeParameter).toHaveBeenCalledWith('testParam', 0);
		});

		it('should return default value if parameter not found', () => {
			const context = {
				getNodeParameter: jest.fn().mockImplementation((param: string) => {
					if (param === 'testParam') throw new Error('Not found');
					return 'default';
				}),
			} as unknown as IExecuteFunctions;

			const value = handler.getParameter(context, 'testParam', 0, 'default');

			expect(value).toBe('default');
		});
	});

	describe('validateRequiredParameters', () => {
		it('should pass if all required parameters present', () => {
			const params: ActionParameters = {
				model: 'test-model',
				prompt: 'test prompt',
			};

			expect(() => handler.validateRequiredParameters(params, ['model', 'prompt'])).not.toThrow();
		});

		it('should throw error if required parameter missing', () => {
			const params: ActionParameters = {
				model: 'test-model',
			};

			expect(() => handler.validateRequiredParameters(params, ['model', 'prompt'])).toThrow();
		});
	});

	describe('buildSuccessResponse', () => {
		it('should build success response', () => {
			const response = handler.buildSuccessResponse(
				{ url: 'https://example.com/image.jpg' },
				{ model: 'test-model', mediaType: 'image' }
			);

			expect(response.json.success).toBe(true);
			expect(response.json.data).toEqual({ url: 'https://example.com/image.jpg' });
			expect(response.json._metadata).toEqual({ model: 'test-model', mediaType: 'image' });
		});
	});

	describe('buildErrorResponse', () => {
		it('should build error response', () => {
			const response = handler.buildErrorResponse('Test error message');

			expect(response.json.success).toBe(false);
			expect(response.json.error).toBe('Test error message');
		});

		it('should include error code if provided', () => {
			const response = handler.buildErrorResponse('Test error', 'TEST_ERROR');

			expect(response.json.success).toBe(false);
			expect(response.json.error).toBe('Test error');
			expect(response.json.errorCode).toBe('TEST_ERROR');
		});
	});

	describe('makeRequest', () => {
		it('should make HTTP request', async () => {
			const mockFetch = jest.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ data: 'test' }),
			});

			global.fetch = mockFetch;

			const response = await handler.makeRequest({
				url: 'https://api.example.com/test',
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { test: 'data' },
			});

			expect(response).toEqual({ data: 'test' });
			expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ test: 'data' }),
			});
		});

		it('should throw error on failed request', async () => {
			const mockFetch = jest.fn().mockResolvedValue({
				ok: false,
				status: 400,
				statusText: 'Bad Request',
			});

			global.fetch = mockFetch;

			await expect(
				handler.makeRequest({
					url: 'https://api.example.com/test',
					method: 'POST',
					headers: {},
					body: {},
				})
			).rejects.toThrow();
		});
	});
});

describe('SoraActionHandler', () => {
	let handler: IActionHandler;

	beforeEach(() => {
		const registry = ActionRegistry.getInstance();
		handler = registry.getHandler('sora');
	});

	it('should be registered', () => {
		expect(handler).toBeDefined();
		expect(handler.actionName).toBe('sora');
		expect(handler.credentialType).toBe('openAiApi');
		expect(handler.mediaType).toBe('video');
		expect(handler.requiresCredential).toBe(true);
	});

	it('should have correct display info', () => {
		const registry = ActionRegistry.getInstance();
		const info = registry.getActionDisplayInfo('sora');

		expect(info.displayName).toBe('Sora Video Generation');
		expect(info.description).toContain('Sora AI models');
	});
});

describe('NanoBananaActionHandler', () => {
	let handler: IActionHandler;

	beforeEach(() => {
		const registry = ActionRegistry.getInstance();
		handler = registry.getHandler('nanoBanana');
	});

	it('should be registered', () => {
		expect(handler).toBeDefined();
		expect(handler.actionName).toBe('nanoBanana');
		expect(handler.credentialType).toBe('nanoBananaApi');
		expect(handler.mediaType).toBe('image');
		expect(handler.requiresCredential).toBe(true);
	});

	it('should have correct display info', () => {
		const registry = ActionRegistry.getInstance();
		const info = registry.getActionDisplayInfo('nanoBanana');

		expect(info.displayName).toBe('Nano Banana Image Generation');
		expect(info.description).toContain('Nano Banana models');
	});
});

describe('ModelScopeActionHandler', () => {
	let handler: IActionHandler;

	beforeEach(() => {
		const registry = ActionRegistry.getInstance();
		handler = registry.getHandler('modelScope');
	});

	it('should be registered', () => {
		expect(handler).toBeDefined();
		expect(handler.actionName).toBe('modelScope');
		expect(handler.credentialType).toBe('modelScopeApi');
		expect(handler.mediaType).toBe('image');
		expect(handler.requiresCredential).toBe(true);
	});

	it('should have correct display info', () => {
		const registry = ActionRegistry.getInstance();
		const info = registry.getActionDisplayInfo('modelScope');

		expect(info.displayName).toBe('ModelScope Multi-Model Platform');
		expect(info.description).toContain('ModelScope platform');
	});
});

describe('MediaProcessingActionHandler', () => {
	let handler: IActionHandler;

	beforeEach(() => {
		const registry = ActionRegistry.getInstance();
		handler = registry.getHandler('processing');
	});

	it('should be registered', () => {
		expect(handler).toBeDefined();
		expect(handler.actionName).toBe('processing');
		expect(handler.mediaType).toBe('image');
		expect(handler.requiresCredential).toBe(false);
	});

	it('should have correct display info', () => {
		const registry = ActionRegistry.getInstance();
		const info = registry.getActionDisplayInfo('processing');

		expect(info.displayName).toBe('Local Media Processing');
		expect(info.description).toContain('local processing');
	});
});
