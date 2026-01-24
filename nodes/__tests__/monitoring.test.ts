import { PerformanceMonitor, PerformanceMetrics } from '../utils/monitoring';

describe('PerformanceMonitor', () => {
	let monitor: PerformanceMonitor;

	beforeEach(() => {
		monitor = new PerformanceMonitor();
	});

	describe('startTimer and endTimer', () => {
		test('should measure elapsed time', () => {
			const startTime = monitor.startTimer('test');
			const elapsed = monitor.endTimer(startTime);
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
				fromCache: false,
			};
			monitor.recordMetric(metric);
			const metrics = monitor.getMetrics();
			expect(metrics).toHaveLength(1);
			expect(metrics[0]).toEqual(metric);
		});

		test('should limit metrics to maxMetrics', () => {
			for (let i = 0; i < 150; i++) {
				monitor.recordMetric({
					provider: 'openai',
					model: 'dall-e-3',
					mediaType: 'image',
					duration: 1000,
					success: true,
					timestamp: new Date().toISOString(),
					fromCache: false,
				});
			}
			const metrics = monitor.getMetrics();
			expect(metrics.length).toBeLessThanOrEqual(100);
		});
	});

	describe('getMetrics', () => {
		beforeEach(() => {
			monitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 1000,
				success: true,
				timestamp: '2024-01-01T00:00:00.000Z',
				fromCache: false,
			});
			monitor.recordMetric({
				provider: 'gemini',
				model: 'imagen-2.0',
				mediaType: 'image',
				duration: 2000,
				success: false,
				timestamp: '2024-01-01T00:00:01.000Z',
				error: 'Test error',
				fromCache: false,
			});
			monitor.recordMetric({
				provider: 'openai',
				model: 'tts-1',
				mediaType: 'audio',
				duration: 500,
				success: true,
				timestamp: '2024-01-01T00:00:02.000Z',
				fromCache: false,
			});
		});

		test('should return all metrics without filter', () => {
			const metrics = monitor.getMetrics();
			expect(metrics).toHaveLength(3);
		});

		test('should filter by provider', () => {
			const metrics = monitor.getMetrics({ provider: 'openai' });
			expect(metrics).toHaveLength(2);
			expect(metrics.every((m: PerformanceMetrics) => m.provider === 'openai')).toBe(true);
		});

		test('should filter by model', () => {
			const metrics = monitor.getMetrics({ model: 'dall-e-3' });
			expect(metrics).toHaveLength(1);
			expect(metrics[0].model).toBe('dall-e-3');
		});

		test('should filter by mediaType', () => {
			const metrics = monitor.getMetrics({ mediaType: 'image' });
			expect(metrics).toHaveLength(2);
			expect(metrics.every((m: PerformanceMetrics) => m.mediaType === 'image')).toBe(true);
		});

		test('should filter by multiple criteria', () => {
			const metrics = monitor.getMetrics({ provider: 'openai', mediaType: 'image' });
			expect(metrics).toHaveLength(1);
			expect(metrics[0].provider).toBe('openai');
			expect(metrics[0].mediaType).toBe('image');
		});
	});

	describe('getStats', () => {
		beforeEach(() => {
			monitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 1000,
				success: true,
				timestamp: '2024-01-01T00:00:00.000Z',
				fromCache: false,
			});
			monitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 2000,
				success: true,
				timestamp: '2024-01-01T00:00:01.000Z',
				fromCache: false,
			});
			monitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 3000,
				success: false,
				timestamp: '2024-01-01T00:00:02.000Z',
				error: 'Test error',
				fromCache: false,
			});
		});

		test('should calculate correct statistics', () => {
			const stats = monitor.getStats();
			expect(stats.avgDuration).toBe(2000);
			expect(stats.minDuration).toBe(1000);
			expect(stats.maxDuration).toBe(3000);
			expect(stats.successRate).toBeCloseTo(66.67, 1);
			expect(stats.totalRequests).toBe(3);
			expect(stats.errorCount).toBe(1);
		});

		test('should return zeros when no metrics', () => {
			monitor.clear();
			const stats = monitor.getStats();
			expect(stats.avgDuration).toBe(0);
			expect(stats.minDuration).toBe(0);
			expect(stats.maxDuration).toBe(0);
			expect(stats.successRate).toBe(0);
			expect(stats.totalRequests).toBe(0);
			expect(stats.errorCount).toBe(0);
		});

		test('should calculate stats for filtered metrics', () => {
			const stats = monitor.getStats({ provider: 'openai' });
			expect(stats.totalRequests).toBe(3);
		});
	});

	describe('getSlowRequests', () => {
		beforeEach(() => {
			monitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 5000,
				success: true,
				timestamp: '2024-01-01T00:00:00.000Z',
				fromCache: false,
			});
			monitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 15000,
				success: true,
				timestamp: '2024-01-01T00:00:01.000Z',
				fromCache: false,
			});
			monitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 20000,
				success: true,
				timestamp: '2024-01-01T00:00:02.000Z',
				fromCache: false,
			});
		});

		test('should return requests slower than threshold', () => {
			const slowRequests = monitor.getSlowRequests(10000);
			expect(slowRequests).toHaveLength(2);
			expect(slowRequests.every((r: PerformanceMetrics) => r.duration > 10000)).toBe(true);
		});

		test('should use default threshold of 10000ms', () => {
			const slowRequests = monitor.getSlowRequests();
			expect(slowRequests).toHaveLength(2);
		});
	});

	describe('getFailedRequests', () => {
		beforeEach(() => {
			monitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 1000,
				success: true,
				timestamp: '2024-01-01T00:00:00.000Z',
				fromCache: false,
			});
			monitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 2000,
				success: false,
				timestamp: '2024-01-01T00:00:01.000Z',
				error: 'Error 1',
				fromCache: false,
			});
			monitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 3000,
				success: false,
				timestamp: '2024-01-01T00:00:02.000Z',
				error: 'Error 2',
				fromCache: false,
			});
		});

		test('should return only failed requests', () => {
			const failedRequests = monitor.getFailedRequests();
			expect(failedRequests).toHaveLength(2);
			expect(failedRequests.every((r: PerformanceMetrics) => !r.success)).toBe(true);
		});
	});

	describe('clear', () => {
		test('should clear all metrics', () => {
			monitor.recordMetric({
				provider: 'openai',
				model: 'dall-e-3',
				mediaType: 'image',
				duration: 1000,
				success: true,
				timestamp: '2024-01-01T00:00:00.000Z',
				fromCache: false,
			});
			expect(monitor.getMetrics()).toHaveLength(1);
			monitor.clear();
			expect(monitor.getMetrics()).toHaveLength(0);
		});
	});
});
