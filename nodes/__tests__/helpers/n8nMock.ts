import type {
	IExecuteFunctions,
	INode,
	INodeExecutionData,
} from 'n8n-workflow';

export interface MockNodeParameterOptions {
	model?: string;
	prompt?: string;
	inputImage?: string;
	size?: string;
	seed?: number;
	numImages?: number;
	enableCache?: boolean;
	timeout?: number;
	maxRetries?: number;
	cacheTtl?: number;
}

export interface MockCredentials {
	apiKey: string;
	baseUrl?: string;
}

/**
 * Creates a mock IExecuteFunctions object for testing
 */
export function createMockExecuteFunctions(
	parameters: MockNodeParameterOptions,
	credentials?: MockCredentials,
	inputData: INodeExecutionData[] = [{ json: {} }]
): Partial<IExecuteFunctions> {
	const mockContext: Partial<IExecuteFunctions> = {
		getInputData: jest.fn().mockReturnValue(inputData),
		getNodeParameter: jest.fn().mockImplementation((name: string, _itemIndex = 0) => {
			switch (name) {
				case 'model':
					return parameters.model ?? 'Tongyi-MAI/Z-Image';
				case 'prompt':
					return parameters.prompt ?? 'A beautiful landscape';
				case 'inputImage':
					return parameters.inputImage ?? '';
				case 'size':
					return parameters.size ?? '1024x1024';
				case 'seed':
					return parameters.seed ?? 0;
				case 'numImages':
					return parameters.numImages ?? 1;
				case 'options.enableCache':
					return parameters.enableCache ?? true;
				case 'options.timeout':
					return parameters.timeout ?? 60000;
				case 'options.maxRetries':
					return parameters.maxRetries ?? 3;
				case 'options.cacheTtl':
					return parameters.cacheTtl ?? 3600;
				default:
					return undefined;
			}
		}),
		getCredentials: jest.fn().mockResolvedValue(credentials),
		getNode: jest.fn().mockReturnValue({} as INode),
		logger: {
			info: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
		},
		continueOnFail: jest.fn().mockReturnValue(false),
	};

	return mockContext;
}

/**
 * Creates valid mock credentials
 */
export function createMockCredentials(apiKey: string = 'test-api-key-12345'): MockCredentials {
	return {
		apiKey,
		baseUrl: 'https://api.modelscope.cn/v1',
	};
}

/**
 * Creates mock API response data
 */
export function createMockApiSuccessResponse(imageUrl: string = 'https://example.com/image.jpg') {
	return {
		output: {
			url: imageUrl,
		},
	};
}

/**
 * Creates mock API error response
 */
export function createMockApiErrorResponse(statusCode: number, errorMessage: string) {
	return {
		statusCode,
		error: errorMessage,
	};
}

/**
 * Creates a mock fetch response
 */
export function createMockFetchResponse(
	data: unknown,
	status: number = 200,
	ok: boolean = true
): Response {
	return {
		ok,
		status,
		json: async () => data,
	} as unknown as Response;
}
