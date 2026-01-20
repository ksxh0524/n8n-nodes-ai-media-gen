export interface ICredentials {
	apiKey: string;
	apiFormat: ApiFormat;
	baseUrl?: string;
	enableCache?: boolean;
	cacheTtl?: number;
}

export type ApiFormat = 'openai' | 'gemini' | 'bailian' | 'replicate' | 'huggingface';

export type MediaType = 'image' | 'audio' | 'video';

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
