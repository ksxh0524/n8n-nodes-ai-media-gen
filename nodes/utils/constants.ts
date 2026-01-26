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

/**
 * Action types
 */
export const ACTIONS = {
	SORA: 'sora' as const,
	NANO_BANANA: 'nanoBanana' as const,
	MODEL_SCOPE: 'modelScope' as const,
	PROCESSING: 'processing' as const,
} as const;

/**
 * Action display information
 */
export const ACTION_DISPLAY_INFO = {
	[ACTIONS.SORA]: {
		displayName: 'Sora Video Generation',
		description: 'Generate videos using Sora AI models (sora-2, sora-2-pro, veo-3.1)',
		mediaType: 'video' as const,
		credentialType: 'openAiApi' as const,
	},
	[ACTIONS.NANO_BANANA]: {
		displayName: 'Nano Banana Image Generation',
		description: 'Generate images using Nano Banana models (nano-banana, nano-banana-pro, z-image-turbo)',
		mediaType: 'image' as const,
		credentialType: 'googlePalmApi' as const,
	},
	[ACTIONS.MODEL_SCOPE]: {
		displayName: 'ModelScope Multi-Model Platform',
		description: 'Generate and edit media using ModelScope platform (qwen-image, qwen-image-edit, z-image-turbo)',
		mediaType: 'image' as const,
		credentialType: 'modelScopeApi' as const,
	},
	[ACTIONS.PROCESSING]: {
		displayName: 'Local Media Processing',
		description: 'Process images and videos locally (resize, crop, convert, filter, watermark, etc.)',
		mediaType: 'image' as const,
		credentialType: undefined,
	},
} as const;

/**
 * Model definitions
 */
export const MODELS = {
	SORA_2: 'sora-2',
	SORA_2_PRO: 'sora-2-pro',
	VEO_3_1: 'veo-3.1',
	NANO_BANANA: 'nano-banana',
	NANO_BANANA_PRO: 'nano-banana-pro',
	Z_IMAGE_TURBO: 'z-image-turbo',
	QWEN_IMAGE: 'qwen-image',
	QWEN_IMAGE_EDIT: 'qwen-image-edit',
} as const;

/**
 * Model display information
 */
export const MODEL_DISPLAY_INFO = {
	[MODELS.SORA_2]: {
		displayName: 'Sora 2',
		description: 'Standard Sora video generation model',
		capabilities: { videoGeneration: true, maxDuration: 60, maxResolution: '1920x1080' },
	},
	[MODELS.SORA_2_PRO]: {
		displayName: 'Sora 2 Pro',
		description: 'Professional Sora video generation model with enhanced quality',
		capabilities: { videoGeneration: true, maxDuration: 120, maxResolution: '3840x2160' },
	},
	[MODELS.VEO_3_1]: {
		displayName: 'Veo 3.1',
		description: 'Google Veo video generation model',
		capabilities: { videoGeneration: true, maxDuration: 60, maxResolution: '1920x1080' },
	},
	[MODELS.NANO_BANANA]: {
		displayName: 'Nano Banana',
		description: 'Standard Nano Banana image generation model',
		capabilities: { imageGeneration: true, maxResolution: '1024x1024' },
	},
	[MODELS.NANO_BANANA_PRO]: {
		displayName: 'Nano Banana Pro',
		description: 'Professional Nano Banana image generation model',
		capabilities: { imageGeneration: true, maxResolution: '2048x2048' },
	},
	[MODELS.Z_IMAGE_TURBO]: {
		displayName: 'Z-Image Turbo',
		description: 'Fast image generation model',
		capabilities: { imageGeneration: true, maxResolution: '1024x1024' },
	},
	[MODELS.QWEN_IMAGE]: {
		displayName: 'Qwen Image',
		description: 'Qwen image generation model',
		capabilities: { imageGeneration: true, maxResolution: '1024x1024' },
	},
	[MODELS.QWEN_IMAGE_EDIT]: {
		displayName: 'Qwen Image Edit',
		description: 'Qwen image editing model',
		capabilities: { imageEditing: true, maxResolution: '1024x1024' },
	},
} as const;

/**
 * Operation types
 */
export const OPERATIONS = {
	RESIZE: 'resize',
	CROP: 'crop',
	CONVERT: 'convert',
	FILTER: 'filter',
	WATERMARK: 'watermark',
	COMPRESS: 'compress',
	ROTATE: 'rotate',
	FLIP: 'flip',
	ADJUST: 'adjust',
	BLUR: 'blur',
	SHARPEN: 'sharpen',
	TRANSCODE: 'transcode',
	TRIM: 'trim',
	MERGE: 'merge',
	EXTRACT_FRAMES: 'extractFrames',
	ADD_AUDIO: 'addAudio',
	EXTRACT_AUDIO: 'extractAudio',
	RESIZE_VIDEO: 'resizeVideo',
} as const;

/**
 * Image formats
 */
export const IMAGE_FORMATS = {
	JPEG: 'jpeg',
	PNG: 'png',
	WEBP: 'webp',
	GIF: 'gif',
	TIFF: 'tiff',
	AVIF: 'avif',
} as const;

/**
 * Video formats
 */
export const VIDEO_FORMATS = {
	MP4: 'mp4',
	WEBM: 'webm',
	MOV: 'mov',
	AVI: 'avi',
	MKV: 'mkv',
	FLV: 'flv',
} as const;

/**
 * Filter types
 */
export const FILTER_TYPES = {
	BLUR: 'blur',
	SHARPEN: 'sharpen',
	EMBOSS: 'emboss',
	EDGE_DETECT: 'edgeDetect',
} as const;

/**
 * Aspect ratios
 */
export const ASPECT_RATIOS = {
	SQUARE: '1:1',
	PORTRAIT: '9:16',
	LANDSCAPE: '16:9',
	CUSTOM: 'custom',
} as const;

/**
 * Video durations (in seconds)
 */
export const VIDEO_DURATIONS = {
	SHORT: 5,
	MEDIUM: 10,
	LONG: 15,
	EXTENDED: 30,
} as const;
