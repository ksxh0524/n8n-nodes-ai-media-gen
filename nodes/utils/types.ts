export interface ICredentials {
	apiKey: string;
	apiFormat: ApiFormat;
	baseUrl?: string;
	enableCache?: boolean;
	cacheTtl?: number;
}

export type ApiFormat = 'openai' | 'gemini' | 'bailian' | 'replicate' | 'huggingface';

export type MediaType = 'image' | 'audio' | 'video';

export type ActionType = 'sora' | 'nanoBanana' | 'modelScope' | 'processing';

export type CredentialType = 'openAiApi' | 'googlePalmApi' | 'modelScopeApi' | 'aiMediaApi';

export type OperationType =
	| 'resize'
	| 'crop'
	| 'convert'
	| 'filter'
	| 'watermark'
	| 'compress'
	| 'rotate'
	| 'flip'
	| 'adjust'
	| 'blur'
	| 'sharpen'
	| 'transcode'
	| 'trim'
	| 'merge'
	| 'extractFrames'
	| 'addAudio'
	| 'extractAudio'
	| 'resizeVideo';

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'tiff' | 'avif';

export type VideoFormat = 'mp4' | 'webm' | 'mov' | 'avi' | 'mkv' | 'flv';

export interface IGenerationParams {
	model?: string;
	prompt?: string;
	additionalParams?: string;
}

export interface IAdditionalParams {
	[key: string]: unknown;
}

export interface IApiRequest {
	url: string;
	method: string;
	headers: Record<string, string>;
	body: unknown;
}

export interface IApiResponse {
	data?: unknown[];
	output?: {
		url?: string;
		audio_url?: string;
		video_url?: string;
	};
	image?: string | { url?: string };
	url?: string;
	[key: string]: unknown;
}

export interface ICacheOptions {
	maxSize?: number;
	defaultTtl?: number;
}

export interface IRateLimiterOptions {
	rate: number;
	capacity?: number;
	key?: string;
}

export interface IRetryOptions {
	maxRetries?: number;
	initialDelay?: number;
	maxDelay?: number;
	backoffMultiplier?: number;
}

export interface IMonitoringFilter {
	provider?: string;
	model?: string;
	mediaType?: MediaType;
}

export interface IMonitoringStats {
	avgDuration: number;
	minDuration: number;
	maxDuration: number;
	successRate: number;
	totalRequests: number;
	errorCount: number;
}

export interface IActionConfig {
	name: string;
	displayName: string;
	description: string;
	mediaType: MediaType;
	credentialType?: CredentialType;
	requiresCredential: boolean;
	models: IModelDefinition[];
}

export interface IModelDefinition {
	id: string;
	name: string;
	displayName: string;
	description: string;
	capabilities: IModelCapabilities;
	parameters: IParameterDefinition[];
}

export interface IModelCapabilities {
	imageGeneration?: boolean;
	imageEditing?: boolean;
	videoGeneration?: boolean;
	videoEditing?: boolean;
	audioGeneration?: boolean;
	maxResolution?: string;
	maxDuration?: number;
}

export interface IParameterDefinition {
	name: string;
	displayName: string;
	type: 'string' | 'number' | 'boolean' | 'select' | 'multiline' | 'binary';
	required: boolean;
	default?: unknown;
	options?: Array<{ name: string; value: unknown }>;
	description?: string;
	displayOptions?: {
		showWhen?: Record<string, unknown>;
		hideWhen?: Record<string, unknown>;
	};
}

export interface IActionParameters {
	[key: string]: unknown;
}

export interface IActionResult {
	success: boolean;
	data?: unknown;
	error?: string;
	metadata?: {
		model?: string;
		mediaType?: MediaType;
		operation?: OperationType;
		duration?: number;
		cached?: boolean;
	};
}

export interface ICacheEntry {
	data: unknown;
	timestamp: number;
	ttl: number;
}

export interface IMediaMetadata {
	width?: number;
	height?: number;
	duration?: number;
	format?: string;
	size?: number;
	fps?: number;
	bitrate?: number;
	codec?: string;
}
