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
	TIMEOUT_MS: 300000, // 5 minutes
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
			'1920x1080', // 16:9 - Full HD landscape
			'1440x1080', // 4:3 - landscape
			'1440x1440', // 1:1 - square
			'1080x1440', // 3:4 - portrait
			'1080x1920', // 9:16 - Full HD portrait
		],
		supportsNumImages: true,
		supportsSeed: true,
	},
	'Qwen/Qwen-Image-2512': {
		supportedSizes: [
			'1328x1328', // 1:1
			'1664x928', // 16:9
			'928x1664', // 9:16
			'1472x1104', // 4:3
			'1104x1472', // 3:4
			'1584x1056', // 3:2
			'1056x1584', // 2:3
		],
		supportsNumImages: true,
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

/**
 * Image size options for 2K resolution
 * Used by Doubao and other high-resolution image generation nodes
 */
export const SIZE_OPTIONS_2K = [
	{ name: '1:1 (2048x2048)', value: '2048x2048' },
	{ name: '4:3 (2304x1728)', value: '2304x1728' },
	{ name: '3:4 (1728x2304)', value: '1728x2304' },
	{ name: '16:9 (2560x1440)', value: '2560x1440' },
	{ name: '9:16 (1440x2560)', value: '1440x2560' },
	{ name: '3:2 (2496x1664)', value: '2496x1664' },
	{ name: '2:3 (1664x2496)', value: '1664x2496' },
	{ name: '21:9 (3024x1296)', value: '3024x1296' },
];

/**
 * Image size options for 4K resolution
 * Used by Doubao and other ultra-high-resolution image generation nodes
 */
export const SIZE_OPTIONS_4K = [
	{ name: '1:1 (4096x4096)', value: '4096x4096' },
	{ name: '4:3 (4608x3456)', value: '4608x3456' },
	{ name: '3:4 (3456x4608)', value: '3456x4608' },
	{ name: '16:9 (5120x2880)', value: '5120x2880' },
	{ name: '9:16 (2880x5120)', value: '2880x5120' },
	{ name: '3:2 (4992x3328)', value: '4992x3328' },
	{ name: '2:3 (3328x4992)', value: '3328x4992' },
	{ name: '21:9 (6048x2592)', value: '6048x2592' },
];

/**
 * Video aspect ratios
 * Common aspect ratios for video generation
 */
export const VIDEO_ASPECT_RATIOS = [
	{ name: '16:9 (Landscape)', value: '16:9' },
	{ name: '9:16 (Portrait)', value: '9:16' },
	{ name: '1:1 (Square)', value: '1:1' },
	{ name: '4:3', value: '4:3' },
	{ name: '3:4', value: '3:4' },
	{ name: '21:9 (Ultrawide)', value: '21:9' },
	{ name: 'Adaptive (Auto)', value: 'adaptive' },
];

/**
 * Video resolutions
 * Standard video resolutions for video generation
 */
export const VIDEO_RESOLUTIONS = [
	{ name: '480p', value: '480p' },
	{ name: '720p', value: '720p' },
	{ name: '1080p', value: '1080p' },
];

/**
 * Seed range constants
 * Range: -1 (random) to 2^32 - 1
 */
export const SEED = {
	MIN: -1,          // Minimum seed (random)
	MAX: 4294967295, // Maximum seed (2^32 - 1)
	DEFAULT: -1,    // Default seed (random)
};

/**
 * Default timeouts (in milliseconds)
 * Standard timeout values for different operations
 */
export const DEFAULT_TIMEOUTS = {
	IMAGE_GENERATION: 60000,      // 1 minute
	VIDEO_GENERATION: 600000,     // 10 minutes
	POLL_REQUEST: 10000,          // 10 seconds
	IMAGE_DOWNLOAD: 30000,        // 30 seconds
	VIDEO_DOWNLOAD: 120000,       // 2 minutes
	AUDIO_DOWNLOAD: 60000,        // 1 minute
} as const;

/**
 * Suno music generation constants
 */
export const SUNO = {
	// Model information
	MODEL_VERSION: 'chirp-crow',
	MODEL_DISPLAY_NAME: 'v5',
	MODEL_NAME: 'suno-v5',

	// API endpoints
	GENERATE_ENDPOINT: '/suno/generate',
	FETCH_ENDPOINT: '/suno/fetch',

	// Default base URL
	DEFAULT_BASE_URL: 'https://api.sunoservice.org',

	// Polling configuration (in milliseconds)
	POLL_INTERVAL_MS: 10000,      // Check every 10 seconds

	// Status values
	STATUS: {
		IN_PROGRESS: 'IN_PROGRESS',
		SUCCESS: 'SUCCESS',
		FAILED: 'FAILED',
	} as const,

	// Output modes
	OUTPUT_MODE: {
		URL: 'url',
		BINARY: 'binary',
	} as const,

	// Song count
	SONGS_PER_GENERATION: 2,
} as const;
