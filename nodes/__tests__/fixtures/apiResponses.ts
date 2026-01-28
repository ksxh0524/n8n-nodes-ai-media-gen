/**
 * API response fixtures for testing
 */

export const API_RESPONSES = {
	/**
	 * Successful Z-Image generation response
	 */
	Z_IMAGE_SUCCESS: {
		output: {
			url: 'https://modelscope.cn/api/v1/studio/temp/image_12345.jpg',
		},
	},

	/**
	 * Successful Qwen-Image-2512 generation response
	 */
	QWEN_IMAGE_SUCCESS: {
		output: {
			url: 'https://modelscope.cn/api/v1/studio/temp/qwen_image_67890.jpg',
		},
	},

	/**
	 * Successful Qwen-Image-Edit response
	 */
	QWEN_EDIT_SUCCESS: {
		output: {
			url: 'https://modelscope.cn/api/v1/studio/temp/edited_image_abcde.jpg',
		},
	},

	/**
	 * Error response for invalid API key
	 */
	INVALID_API_KEY: {
		error: 'Authentication failed: Invalid API key',
	},

	/**
	 * Error response for rate limit
	 */
	RATE_LIMIT: {
		error: 'Rate limit exceeded. Please try again later.',
	},

	/**
	 * Error response for timeout
	 */
	TIMEOUT: {
		error: 'Request timeout',
	},

	/**
	 * Error response for invalid parameters
	 */
	INVALID_PARAMS: {
		error: 'Invalid parameters: size not supported',
	},

	/**
	 * Error response for missing image URL
	 */
	MISSING_IMAGE_URL: {
		output: {},
	},

	/**
	 * Response with alternative URL field
	 */
	ALTERNATIVE_URL: {
		url: 'https://example.com/alternative.jpg',
	},

	/**
	 * Response with image_url field
	 */
	IMAGE_URL: {
		image_url: 'https://example.com/image_url.jpg',
	},
} as const;

/**
 * HTTP status codes for testing
 */
export const HTTP_STATUS = {
	OK: 200,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	RATE_LIMIT: 429,
	TIMEOUT: 408,
	INTERNAL_ERROR: 500,
	SERVICE_UNAVAILABLE: 503,
} as const;
