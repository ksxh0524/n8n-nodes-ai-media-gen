/**
 * Types for AI Media Generation Node
 *
 * This file contains type definitions used throughout the node.
 * Designed with extensible architecture to support future media types and providers.
 */

export type ApiFormat = 'openai' | 'gemini' | 'bailian' | 'replicate' | 'huggingface';

export type MediaType = 'image' | 'audio' | 'video';

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'tiff' | 'avif';

export type VideoFormat = 'mp4' | 'webm' | 'mov' | 'avi' | 'mkv' | 'flv';

/**
 * Additional parameters for API requests
 */
export type IAdditionalParams = Record<string, unknown>;

/**
 * Generation parameters
 */
export interface IGenerationParams {
	model?: string;
	prompt?: string;
	additionalParams?: string;
}

/**
 * Retry options
 */
export interface IRetryOptions {
	maxRetries?: number;
	initialDelay?: number;
	maxDelay?: number;
	backoffMultiplier?: number;
}

/**
 * Cache configuration options
 */
export interface ICacheOptions {
	maxSize?: number;
	defaultTtl?: number;
}

/**
 * Monitoring filter for performance metrics
 */
export interface IMonitoringFilter {
	provider?: string;
	model?: string;
	mediaType?: MediaType;
}

/**
 * Monitoring statistics
 */
export interface IMonitoringStats {
	avgDuration: number;
	minDuration: number;
	maxDuration: number;
	successRate: number;
	totalRequests: number;
	errorCount: number;
}

/**
 * API response structure
 */
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
