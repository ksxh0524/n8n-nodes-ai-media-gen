import { PerformanceMonitor, PerformanceMetrics } from '../utils/monitoring';

describe('PerformanceMonitor', () => {
	beforeEach(() => {
		PerformanceMonitor.clear();
	});

	describe('startTimer and endTimer', () => {
		test('should measure elapsed time', () => {
			const startTime = PerformanceMonitor.startTimer('test');
			const elapsed = PerformanceMonitor.endTimer(startTime);
			expect(elapsed).toBeGreaterThanOrEqual(0);
			expect(elapsed).toBeLessThan(100);
		});
	});

	describe('recordMetric', () => {
		test('should record metrics', () => {
			const metric = {
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image' as const,
				duration: 1000,
				success: true,
				timestamp: new Date().toISOString(),
			};
			PerformanceMonitor.recordMetric(metric);
			const metrics = PerformanceMonitor.getMetrics();
			expect(metrics).toHaveLength(1);
			expect(metrics[0]).toEqual(metric);
		});

		test('should limit metrics to maxMetrics', () => {
			for (let i = 0; i < 150; i++) {
				PerformanceMonitor.recordMetric({
					provider: 'openai',
					model: 'dall-e-3',
					mediaType: 'image',
					duration: 1000,
					success: true,
					timestamp: new Date().toISOString(),
				});
			}
			const metrics = PerformanceMonitor.getMetrics();
			expect(metrics.length).toBeLessThanOrEqual(100);
		});
	});

	describe('getMetrics', () => {
		beforeEach(() => {
			PerformanceMonitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 1000,
				success: true,
				timestamp: '2024-01-01T00:00:00.000Z',
			});
			PerformanceMonitor.recordMetric({
				provider: 'gemini',
				model: 'imagen-2.0',
				mediaType: 'image',
				duration: 2000,
				success: false,
				timestamp: '2024-01-01T00:00:01.000Z',
				error: 'Test error',
			});
			PerformanceMonitor.recordMetric({
				provider: 'openai',
				model: 'tts-1',
				mediaType: 'audio',
				duration: 500,
				success: true,
				timestamp: '2024-01-01T00:00:02.000Z',
			});
		});

		test('should return all metrics without filter', () => {
			const metrics = PerformanceMonitor.getMetrics();
			expect(metrics).toHaveLength(3);
		});

		test('should filter by provider', () => {
			const metrics = PerformanceMonitor.getMetrics({ provider: 'openai' });
			expect(metrics).toHaveLength(2);
			expect(metrics.every((m: PerformanceMetrics) => m.provider === 'openai')).toBe(true);
		});

		test('should filter by model', () => {
			const metrics = PerformanceMonitor.getMetrics({ model: 'dall-e-3' });
			expect(metrics).toHaveLength(1);
			expect(metrics[0].model).toBe('dall-e-3');
		});

		test('should filter by mediaType', () => {
			const metrics = PerformanceMonitor.getMetrics({ mediaType: 'image' });
			expect(metrics).toHaveLength(2);
			expect(metrics.every((m: PerformanceMetrics) => m.mediaType === 'image')).toBe(true);
		});

		test('should filter by multiple criteria', () => {
			const metrics = PerformanceMonitor.getMetrics({ provider: 'openai', mediaType: 'image' });
			expect(metrics).toHaveLength(1);
			expect(metrics[0].provider).toBe('openai');
			expect(metrics[0].mediaType).toBe('image');
		});
	});

	describe('getStats', () => {
		beforeEach(() => {
			PerformanceMonitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 1000,
				success: true,
				timestamp: '2024-01-01T00:00:00.000Z',
			});
			PerformanceMonitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 2000,
				success: true,
				timestamp: '2024-01-01T00:00:01.000Z',
			});
			PerformanceMonitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 3000,
				success: false,
				timestamp: '2024-01-01T00:00:02.000Z',
				error: 'Test error',
			});
		});

		test('should calculate correct statistics', () => {
			const stats = PerformanceMonitor.getStats();
			expect(stats.avgDuration).toBe(2000);
			expect(stats.minDuration).toBe(1000);
			expect(stats.maxDuration).toBe(3000);
			expect(stats.successRate).toBeCloseTo(66.67, 1);
			expect(stats.totalRequests).toBe(3);
			expect(stats.errorCount).toBe(1);
		});

		test('should return zeros when no metrics', () => {
			PerformanceMonitor.clear();
			const stats = PerformanceMonitor.getStats();
			expect(stats.avgDuration).toBe(0);
			expect(stats.minDuration).toBe(0);
			expect(stats.maxDuration).toBe(0);
			expect(stats.successRate).toBe(0);
			expect(stats.totalRequests).toBe(0);
			expect(stats.errorCount).toBe(0);
		});

		test('should calculate stats for filtered metrics', () => {
			const stats = PerformanceMonitor.getStats({ provider: 'openai' });
			expect(stats.totalRequests).toBe(3);
		});
	});

	describe('getSlowRequests', () => {
		beforeEach(() => {
			PerformanceMonitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 5000,
				success: true,
				timestamp: '2024-01-01T00:00:00.000Z',
			});
			PerformanceMonitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 15000,
				success: true,
				timestamp: '2024-01-01T00:00:01.000Z',
			});
			PerformanceMonitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 20000,
				success: true,
				timestamp: '2024-01-01T00:00:02.000Z',
			});
		});

		test('should return requests slower than threshold', () => {
			const slowRequests = PerformanceMonitor.getSlowRequests(10000);
			expect(slowRequests).toHaveLength(2);
			expect(slowRequests.every((r: PerformanceMetrics) => r.duration > 10000)).toBe(true);
		});

		test('should use default threshold of 10000ms', () => {
			const slowRequests = PerformanceMonitor.getSlowRequests();
			expect(slowRequests).toHaveLength(2);
		});
	});

	describe('getFailedRequests', () => {
		beforeEach(() => {
			PerformanceMonitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 1000,
				success: true,
				timestamp: '2024-01-01T00:00:00.000Z',
			});
			PerformanceMonitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 2000,
				success: false,
				timestamp: '2024-01-01T00:00:01.000Z',
				error: 'Error 1',
			});
			PerformanceMonitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 3000,
				success: false,
				timestamp: '2024-01-01T00:00:02.000Z',
				error: 'Error 2',
			});
		});

		test('should return only failed requests', () => {
			const failedRequests = PerformanceMonitor.getFailedRequests();
			expect(failedRequests).toHaveLength(2);
			expect(failedRequests.every((r: PerformanceMetrics) => !r.success)).toBe(true);
		});
	});

	describe('clear', () => {
		test('should clear all metrics', () => {
			PerformanceMonitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 1000,
				success: true,
				timestamp: '2024-01-01T00:00:00.000Z',
			});
			expect(PerformanceMonitor.getMetrics()).toHaveLength(1);
			PerformanceMonitor.clear();
			expect(PerformanceMonitor.getMetrics()).toHaveLength(0);
		});
	});
});
