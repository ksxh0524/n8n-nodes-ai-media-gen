/**
 * Constants for AI Media Generation Node
 *
 * This file contains all magic numbers and configuration constants
 * used throughout the node to improve maintainability and readability.
 */

/**
 * Node version
 */
export const NODE_VERSION = 1.0;

/**
 * Default values
 */
export const DEFAULTS = {
	MAX_RETRIES: 3,
	TIMEOUT_MS: 60000,
	CACHE_TTL_SECONDS: 3600,
} as const;

/**
 * UI configuration
 */
export const UI = {
	TEXT_AREA_ROWS: {
		PROMPT: 5,
		ADDITIONAL_PARAMS: 8,
	},
} as const;

/**
 * Retry configuration
 */
export const RETRY = {
	MIN: 0,
	MAX: 10,
} as const;

/**
 * Timeout configuration (in milliseconds)
 */
export const TIMEOUT = {
	MIN_MS: 1000,
	MAX_MS: 600000,
} as const;

/**
 * Cache configuration (in seconds)
 */
export const CACHE = {
	MIN_TTL_SECONDS: 60,
	MAX_TTL_SECONDS: 86400,
	DEFAULT_MAX_SIZE: 200,
} as const;

/**
 * Array indices
 */
export const INDICES = {
	FIRST_ITEM: 0,
} as const;

/**
 * Hash configuration
 */
export const HASH = {
	LENGTH: 32,
} as const;

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
	MODELSCOPE: {
		BASE_URL: 'https://api.modelscope.cn/v1',
		FILES_GENERATION: '/files/generation',
	},
} as const;

/**
 * Model constraints
 */
export const MODEL_CONSTRAINTS = {
	'Tongyi-MAI/Z-Image': {
		supportedSizes: [
			'2048x2048', // 1:1
			'2048x1152', // 16:9
			'1152x2048', // 9:16
			'2048x1536', // 4:3
			'1536x2048', // 3:4
			'1024x2048', // 1:2
		],
		supportsNumImages: true,
		supportsSeed: true,
	},
	'Qwen-Image-2512': {
		supportedSizes: ['1328x1328', '1664x928', '928x1664', '1472x1104', '1104x1472', '1584x1056', '1056x1584'],
		supportsNumImages: true,
		supportsSeed: true,
	},
	'Qwen-Image-Edit-2511': {
		supportedSizes: [], // Edit model doesn't use size parameter
		supportsNumImages: false,
		supportsSeed: false,
	},
} as const;

/**
 * Validation constants
 */
export const VALIDATION = {
	NUM_IMAGES: {
		MIN: 1,
		MAX: 4,
	},
	URL_PATTERN: /^https?:\/\/.+/i,
	BASE64_PATTERN: /^data:image\/[a-z]+;base64,/i,
} as const;
