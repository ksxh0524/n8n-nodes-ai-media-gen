/**
 * Test data fixtures for testing
 */

export const TEST_DATA = {
	/**
	 * Valid input data for testing
	 */
	VALID_INPUTS: {
		Z_IMAGE: {
			model: 'Tongyi-MAI/Z-Image',
			prompt: 'A serene mountain landscape at sunset',
			size: '1024x1024',
			seed: 42,
			numImages: 1,
		},
		QWEN_IMAGE: {
			model: 'Qwen-Image-2512',
			prompt: 'A futuristic cityscape',
			size: '1024x1024',
			seed: 123,
			numImages: 2,
		},
		QWEN_EDIT: {
			model: 'Qwen-Image-Edit-2511',
			prompt: 'Add a rainbow to the sky',
			inputImage: 'https://example.com/input.jpg',
			size: '1024x1024',
		},
	},

	/**
	 * Invalid input data for negative testing
	 */
	INVALID_INPUTS: {
		EMPTY_PROMPT: {
			model: 'Tongyi-MAI/Z-Image',
			prompt: '',
			size: '1024x1024',
		},
		INVALID_SIZE: {
			model: 'Tongyi-MAI/Z-Image',
			prompt: 'A beautiful landscape',
			size: '9999x9999',
		},
		NUM_IMAGES_TOO_LOW: {
			model: 'Tongyi-MAI/Z-Image',
			prompt: 'A beautiful landscape',
			numImages: 0,
		},
		NUM_IMAGES_TOO_HIGH: {
			model: 'Tongyi-MAI/Z-Image',
			prompt: 'A beautiful landscape',
			numImages: 10,
		},
		INVALID_IMAGE_URL: {
			model: 'Qwen-Image-Edit-2511',
			prompt: 'Edit the image',
			inputImage: 'not-a-url-or-base64',
			size: '1024x1024',
		},
		EMPTY_INPUT_IMAGE: {
			model: 'Qwen-Image-Edit-2511',
			prompt: 'Edit the image',
			inputImage: '',
			size: '1024x1024',
		},
	},

	/**
	 * Valid base64 image data for testing
	 */
	BASE64_IMAGE: {
		VALID_JPEG: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCE',
		VALID_PNG: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		INVALID: 'not-base64-data',
	},

	/**
	 * Model-specific constraints for testing
	 */
	MODEL_CONSTRAINTS: {
		'Tongyi-MAI/Z-Image': {
			supportedSizes: ['512x512', '768x768', '1024x1024'],
			supportsNumImages: true,
			supportsSeed: true,
		},
		'Qwen-Image-2512': {
			supportedSizes: ['1024x1024', '1152x896', '896x1152', '1216x832', '832x1216', '1344x768', '768x1344', '1536x640', '640x1536'],
			supportsNumImages: true,
			supportsSeed: true,
		},
		'Qwen-Image-Edit-2511': {
			supportedSizes: ['1024x1024', '1152x896', '896x1152', '1216x832', '832x1216', '1344x768', '768x1344'],
			supportsNumImages: false,
			supportsSeed: false,
		},
	},
} as const;

/**
 * Helper function to create multi-item test data
 */
export function createMultiItemTestData(count: number, baseData: Record<string, unknown> = {}) {
	return Array.from({ length: count }, (_, i) => ({
		json: {
			...baseData,
			itemIndex: i,
			prompt: `Test prompt ${i + 1}`,
		},
	}));
}

/**
 * Helper function to create credentials with different scenarios
 */
export const CREDENTIALS = {
	VALID: {
		apiKey: 'sk-test-valid-key-12345',
		baseUrl: 'https://api.modelscope.cn/v1',
	},
	MISSING_API_KEY: {
		apiKey: '',
		baseUrl: 'https://api.modelscope.cn/v1',
	},
	INVALID_API_KEY: {
		apiKey: 'invalid-key',
		baseUrl: 'https://api.modelscope.cn/v1',
	},
} as const;
