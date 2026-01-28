import type { IMonitoringFilter, IMonitoringStats } from './types';

/**
 * Performance metrics for monitoring API operations
 */
export interface PerformanceMetrics {
	/** API provider name */
	provider: string;
	/** Model used */
	model: string;
	/** Type of media generated */
	mediaType: 'image' | 'audio' | 'video';
	/** Duration in milliseconds */
	duration: number;
	/** Whether the request succeeded */
	success: boolean;
	/** ISO timestamp of the request */
	timestamp: string;
	/** Whether result came from cache */
	fromCache: boolean;
	/** Error message if failed */
	error?: string;
}

/**
 * Performance monitor for tracking API operations
 *
 * Records metrics about API calls including duration, success rate,
 * and cache hit rate. Useful for debugging and optimization.
 */
export class PerformanceMonitor {
	private metrics: PerformanceMetrics[] = [];
	private maxMetrics: number;

	constructor(maxMetrics: number = 100) {
		this.maxMetrics = maxMetrics;
	}

	/**
	 * Starts a timer for an operation
	 * @param operation - Operation name (for logging)
	 * @returns Timer ID
	 */
	startTimer(_operation: string): number {
		return Date.now();
	}

	/**
	 * Ends a timer and returns the duration
	 * @param startTime - Timer ID from startTimer
	 * @returns Duration in milliseconds
	 */
	endTimer(startTime: number): number {
		return Date.now() - startTime;
	}

	/**
	 * Records a performance metric
	 * @param metric - The metric to record
	 */
	recordMetric(metric: PerformanceMetrics): void {
		this.metrics.push(metric);

		if (this.metrics.length > this.maxMetrics) {
			this.metrics.shift();
		}
	}

	/**
	 * Gets recorded metrics, optionally filtered
	 * @param filter - Optional filter for provider, model, or media type
	 * @returns Array of matching metrics
	 */
	getMetrics(filter?: IMonitoringFilter): PerformanceMetrics[] {
		let filtered = this.metrics;

		if (filter?.provider) {
			filtered = filtered.filter(m => m.provider === filter.provider);
		}
		if (filter?.model) {
			filtered = filtered.filter(m => m.model === filter.model);
		}
		if (filter?.mediaType) {
			filtered = filtered.filter(m => m.mediaType === filter.mediaType);
		}

		return filtered;
	}

	/**
	 * Gets statistics from recorded metrics
	 * @param filter - Optional filter for provider, model, or media type
	 * @returns Statistics including average duration, success rate, etc.
	 */
	getStats(filter?: IMonitoringFilter): IMonitoringStats {
		const metrics = this.getMetrics(filter);

		if (metrics.length === 0) {
			return {
				avgDuration: 0,
				minDuration: 0,
				maxDuration: 0,
				successRate: 0,
				totalRequests: 0,
				errorCount: 0,
			};
		}

		const durations = metrics.map(m => m.duration);
		const successCount = metrics.filter(m => m.success).length;
		const errorCount = metrics.filter(m => !m.success).length;

		return {
			avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
			minDuration: Math.min(...durations),
			maxDuration: Math.max(...durations),
			successRate: (successCount / metrics.length) * 100,
			totalRequests: metrics.length,
			errorCount,
		};
	}

	/**
	 * Clears all recorded metrics
	 */
	clear(): void {
		this.metrics = [];
	}

	/**
	 * Gets slow requests above a threshold
	 * @param threshold - Minimum duration in milliseconds (default: 10000)
	 * @returns Array of slow requests
	 */
	getSlowRequests(threshold: number = 10000): PerformanceMetrics[] {
		return this.metrics.filter(m => m.duration > threshold);
	}

	/**
	 * Gets failed requests
	 * @returns Array of failed requests
	 */
	getFailedRequests(): PerformanceMetrics[] {
		return this.metrics.filter(m => !m.success);
	}
}
