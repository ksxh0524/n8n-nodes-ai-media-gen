/**
 * Types for AI Media Generation Node
 *
 * This file contains type definitions used throughout the node.
 */

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
	mediaType?: 'image' | 'audio' | 'video';
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
