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
	QUALITY: 85,
	MAX_RETRIES: 3,
	TIMEOUT_MS: 60000,
	CACHE_TTL_SECONDS: 3600,
	KEEP_ORIGINAL_SIZE: 0,
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
 * Image processing constraints
 */
export const IMAGE_PROCESSING = {
	MIN_WIDTH: 0,
	MAX_WIDTH: 65535,
	MIN_HEIGHT: 0,
	MAX_HEIGHT: 65535,
} as const;

/**
 * Quality constraints
 */
export const QUALITY = {
	MIN: 1,
	MAX: 100,
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
