/**
 * Platform-specific type definitions for AI media generation
 *
 * Defines common and platform-specific interfaces for all supported platforms.
 */

// ============================================================================
// Common Base Types
// ============================================================================

/**
 * Base platform parameters
 */
export interface BasePlatformParams {
	prompt: string;
	seed?: number;
}

/**
 * Image generation parameters
 */
export interface ImageGenerationParams extends BasePlatformParams {
	size?: string;
	numImages?: number;
}

/**
 * Video generation parameters
 */
export interface VideoGenerationParams extends BasePlatformParams {
	aspectRatio?: string;
	duration?: number | string; // Support both number and string types
	resolution?: string;
}

// ============================================================================
// ModelScope Platform
// ============================================================================

/**
 * ModelScope platform parameters
 */
export interface ModelScopeParams extends ImageGenerationParams {
	operation: 'modelscope';
	mode: 'text-to-image' | 'image-to-image';
	model: 'Tongyi-MAI/Z-Image' | 'Qwen/Qwen-Image-2512';
	inputImages?: string[];
}

/**
 * ModelScope API response
 */
export interface ModelScopeResponse {
	output_images?: Array<string | { url: string }>;
	output_url?: string;
	task_id?: string;
	task_status?: string;
	message?: string;
}

// ============================================================================
// Doubao Platform
// ============================================================================

/**
 * Doubao platform parameters
 */
export interface DoubaoParams extends ImageGenerationParams {
	operation: 'doubao';
	mode: 'text-to-image' | 'image-to-image';
	model: 'doubao-seedream-4-5-251128' | 'doubao-seedream-4-0-250828';
	resolutionLevel?: '2K' | '4K';
	inputImages?: string[];
}

/**
 * Doubao Seedream response
 */
export interface DoubaoSeedreamResponse {
	data?: Array<{
		url?: string;
		b64_json?: string;
		revised_prompt?: string;
	}>;
	request_id?: string;
	output_url?: string;
	b64_json?: string;
	status?: string;
}

// ============================================================================
// Sora Platform
// ============================================================================

/**
 * Sora platform parameters
 */
export interface SoraParams extends VideoGenerationParams {
	operation: 'sora';
	model: 'sora-2' | 'sora-2-pro';
	aspectRatio: '16:9' | '3:2' | '1:1' | '9:16' | '2:3';
	duration: '5' | '10' | '15' | '20' | '25';
	hd?: boolean;
	inputImage?: string;
}

/**
 * Sora request body
 */
export interface SoraRequestBody {
	model: 'sora-2' | 'sora-2-pro';
	prompt: string;
	aspect_ratio: string;
	duration: string;
	hd?: boolean;
	images?: string[];
}

/**
 * Sora submit response
 */
export interface SoraSubmitResponse {
	task_id: string;
}

/**
 * Sora task status response
 */
export interface SoraTaskResponse {
	task_id: string;
	platform: string;
	action: string;
	status: 'NOT_START' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';
	fail_reason: string;
	submit_time: number;
	start_time: number;
	finish_time: number;
	progress: string;
	data: {
		output?: string;
	} | null;
	search_item: string;
}

// ============================================================================
// Veo Platform
// ============================================================================

/**
 * Veo platform parameters
 */
export interface VeoParams extends VideoGenerationParams {
	operation: 'veo';
	model: 'veo-2.0' | 'veo-2.0-generate';
	inputImage?: string;
}

/**
 * Veo request body
 */
export interface VeoRequestBody {
	model: string;
	prompt: string;
	aspect_ratio: string;
	duration: string;
	image?: string;
}

/**
 * Veo submit response
 */
export interface VeoSubmitResponse {
	task_id: string;
}

/**
 * Veo task status response
 */
export interface VeoTaskResponse {
	id: string;
	status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
	video_url?: string;
	error?: string;
}

// ============================================================================
// Nano Banana Platform
// ============================================================================

/**
 * Nano Banana platform parameters
 */
export interface NanoBananaParams extends ImageGenerationParams {
	operation: 'nanoBanana';
	mode: 'text-to-image';
	model: 'nano-banana' | 'nano-banana-2';
}

/**
 * Gemini API response
 */
export interface GeminiResponse {
	candidates?: Array<{
		content?: {
		parts?: Array<{
			inlineData?: { data: string; mimeType: string };
			text?: string;
		}>;
		};
	}>;
}

// ============================================================================
// Suno Platform
// ============================================================================

/**
 * Suno platform parameters
 */
export interface SunoParams {
	operation: 'suno';
	model: string; // Model key, validated against SUNO_MODELS
	prompt: string;
	title?: string;
	tags?: string;
	makeInstrumental?: boolean;
}

/**
 * Suno request body
 */
export interface SunoRequestBody {
	prompt: string;
	mv: string; // API model value (chirp-crow, chirp-bluejay, etc.)
	title?: string;
	tags?: string;
	make_instrumental?: boolean;
}

/**
 * Suno task response
 */
export interface SunoTaskResponse {
	task_id: string;
	status: 'queued' | 'processing' | 'succeeded' | 'failed';
	audio_url?: string;
	error?: string;
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * All supported platform parameters
 */
export type PlatformParams =
	| ModelScopeParams
	| DoubaoParams
	| SoraParams
	| VeoParams
	| NanoBananaParams
	| SunoParams;

/**
 * Platform operation names
 */
export type PlatformOperation = 'modelscope' | 'nanoBanana' | 'sora' | 'veo' | 'suno';

/**
 * API response types (union)
 */
export type ApiResponse =
	| ModelScopeResponse
	| DoubaoSeedreamResponse
	| SoraTaskResponse
	| VeoTaskResponse
	| GeminiResponse;

// ============================================================================
// Credential Types
// ============================================================================

/**
 * ModelScope API credentials
 */
export interface ModelScopeCredentials {
	apiKey: string;
	baseUrl?: string;
}

/**
 * Google PaLM API credentials (for Nano Banana)
 */
export interface GooglePalmCredentials {
	apiKey: string;
	host?: string;
}

/**
 * OpenAI API credentials (for Sora)
 */
export interface OpenAiCredentials {
	apiKey: string;
	organizationId?: string;
	baseUrl?: string;
}

/**
 * All credential types
 */
export type Credentials =
	| ModelScopeCredentials
	| GooglePalmCredentials
	| OpenAiCredentials;

// ============================================================================
// Parsed Response Types
// ============================================================================

/**
 * Parsed media response
 */
export interface ParsedMediaResponse {
	imageUrl?: string;
	videoUrl?: string;
	audioUrl?: string;
	audioUrls?: Array<{
		id: string;
		audioUrl: string;
		title?: string;
		tags?: string;
	}>;
	base64Data?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Task submission response
 */
export interface TaskSubmitResponse {
	taskId: string;
	status?: string;
}

/**
 * Task status response
 */
export interface TaskStatusResponse {
	id: string;
	status: string;
	video_url?: string;
	image_url?: string;
	error?: string;
	metadata?: Record<string, unknown>;
}
