export interface PerformanceMetrics {
	provider: string;
	model: string;
	mediaType: 'image' | 'audio' | 'video';
	duration: number;
	success: boolean;
	timestamp: string;
	error?: string;
}

export class PerformanceMonitor {
	private static metrics: PerformanceMetrics[] = [];
	private static maxMetrics = 100;

	static startTimer(operation: string): () => number {
		return Date.now();
	}

	static endTimer(startTime: number): number {
		return Date.now() - startTime;
	}

	static recordMetric(metric: PerformanceMetrics): void {
		PerformanceMonitor.metrics.push(metric);

		if (PerformanceMonitor.metrics.length > PerformanceMonitor.maxMetrics) {
			PerformanceMonitor.metrics.shift();
		}
	}

	static getMetrics(filter?: {
		provider?: string;
		model?: string;
		mediaType?: 'image' | 'audio' | 'video';
	}): PerformanceMetrics[] {
		let filtered = PerformanceMonitor.metrics;

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

	static getStats(filter?: {
		provider?: string;
		model?: string;
		mediaType?: 'image' | 'audio' | 'video';
	}): {
		avgDuration: number;
		minDuration: number;
		maxDuration: number;
		successRate: number;
		totalRequests: number;
		errorCount: number;
	} {
		const metrics = PerformanceMonitor.getMetrics(filter);

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

	static clear(): void {
		PerformanceMonitor.metrics = [];
	}

	static getSlowRequests(threshold: number = 10000): PerformanceMetrics[] {
		return PerformanceMonitor.metrics.filter(m => m.duration > threshold);
	}

	static getFailedRequests(): PerformanceMetrics[] {
		return PerformanceMonitor.metrics.filter(m => !m.success);
	}
}
