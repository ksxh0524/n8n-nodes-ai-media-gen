/**
 * Utilities Index
 *
 * Central export point for all utility modules in the AI Media Gen nodes.
 * This file provides a convenient way to import utilities from a single location.
 */

// Error handling
export {
	MediaGenError,
	ERROR_CODES,
	sleep,
	withRetry,
	isTimeoutError,
	handleApiError,
} from './errors';

// HTTP requests
export {
	makeHttpRequest,
	makePollRequest,
	type HttpRequestOptions,
} from './httpRequest';

// Polling
export {
	pollTask,
	pollModelScopeTask,
	pollSoraTask,
	pollReplicateTask,
	type PollingOptions,
	type TaskStatusResponse,
} from './polling';

// Parameter validation
export {
	validatePrompt,
	validateSeed,
	validateImageUrl,
	validateModel,
	validateTimeout,
	getTimeoutOrDefault,
} from './paramValidation';

// Binary data handling
export {
	createBinaryData,
	generateFileName,
	detectMimeTypeFromUrl,
	getFileExtension,
	createBinaryDataFromUrl,
	isValidBase64,
	extractBase64FromDataUrl,
	type BinaryDataOptions,
} from './binaryData';

// Constants
export {
	NODE_VERSION,
	DEFAULTS,
	UI,
	RETRY,
	TIMEOUT,
	CACHE,
	INDICES,
	HASH,
	API_ENDPOINTS,
	ASYNC,
	MODEL_CONSTRAINTS,
	VALIDATION,
	SORA,
	SIZE_OPTIONS_2K,
	SIZE_OPTIONS_4K,
	VIDEO_ASPECT_RATIOS,
	VIDEO_RESOLUTIONS,
	SEED,
	DEFAULT_TIMEOUTS,
} from './constants';

// Model validators
export {
	validateNumImages,
	validateSizeForModel,
	validateInputImage,
	validateModelRequest,
} from './validators';

// Cache
export {
	CacheManager,
	MemoryCache,
	MemoryCacheEntry,
	CacheKeyGenerator,
	type ICache,
} from './cache';

// Monitoring
export {
	PerformanceMonitor,
	type PerformanceMetrics,
} from './monitoring';

// Helpers
export {
	sanitizeForLogging,
	detectDangerousContent,
	validateAndSanitizeInput,
	validateCredentials,
	validateGenerationParams,
} from './helpers';

// Types
export type {
	IRetryOptions,
	ICacheOptions,
	IMonitoringFilter,
	IMonitoringStats,
	IApiResponse,
} from './types';
