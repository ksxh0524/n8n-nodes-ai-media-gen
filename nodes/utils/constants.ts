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
		BASE_URL: 'https://api-inference.modelscope.cn/v1',
		IMAGES_GENERATIONS: 'images/generations',
		TASK_STATUS: 'tasks',  // for polling async task status
	},
} as const;

/**
 * Async polling configuration (in milliseconds)
 */
export const ASYNC = {
	POLL_INTERVAL_MS: 2000,      // Check status every 2 seconds
	POLL_TIMEOUT_MS: 300000,     // Max 5 minutes total
	INITIAL_DELAY_MS: 1000,      // Wait 1 second before first poll
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
	'Qwen/Qwen-Image-2512': {
		supportedSizes: ['1328x1328', '1664x928', '928x1664', '1472x1104', '1104x1472', '1584x1056', '1056x1584'],
		supportsNumImages: true,
		supportsSeed: true,
	},
	'Qwen/Qwen-Image-Edit-2511': {
		supportedSizes: [], // Edit model doesn't use size parameter
		supportsNumImages: false,
		supportsSeed: true,
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

/**
 * Sora video generation constants
 */
export const SORA = {
	// Async polling configuration (in milliseconds)
	POLL_INTERVAL_SHORT_MS: 5000,
	POLL_INTERVAL_NORMAL_MS: 10000,
	POLL_INTERVAL_LONG_MS: 15000,
	TIMEOUT_5S_MS: 180000,
	TIMEOUT_10S_MS: 300000,
	TIMEOUT_15S_MS: 420000,
	TIMEOUT_20S_MS: 600000,
	TIMEOUT_25S_MS: 780000,
	MAX_POLL_ATTEMPTS: 120,

	// Video size limits (in MB)
	MAX_SIZE_BINARY_MB: 200,
	MAX_SIZE_DOWNLOAD_MB: 500,
} as const;
