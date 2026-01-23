import type { IMonitoringFilter, IMonitoringStats } from './types';

export interface PerformanceMetrics {
	provider: string;
	model: string;
	mediaType: 'image' | 'audio' | 'video';
	duration: number;
	success: boolean;
	timestamp: string;
	fromCache: boolean;
	error?: string;
}

export class PerformanceMonitor {
	private metrics: PerformanceMetrics[] = [];
	private maxMetrics: number;

	constructor(maxMetrics: number = 100) {
		this.maxMetrics = maxMetrics;
	}

	startTimer(_operation: string): number {
		return Date.now();
	}

	endTimer(startTime: number): number {
		return Date.now() - startTime;
	}

	recordMetric(metric: PerformanceMetrics): void {
		this.metrics.push(metric);

		if (this.metrics.length > this.maxMetrics) {
			this.metrics.shift();
		}
	}

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

	clear(): void {
		this.metrics = [];
	}

	getSlowRequests(threshold: number = 10000): PerformanceMetrics[] {
		return this.metrics.filter(m => m.duration > threshold);
	}

	getFailedRequests(): PerformanceMetrics[] {
		return this.metrics.filter(m => !m.success);
	}
}
