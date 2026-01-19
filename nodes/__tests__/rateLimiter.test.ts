import { RateLimiter } from '../utils/rateLimiter';

describe('RateLimiter', () => {
	describe('constructor', () => {
		test('should initialize with default capacity', () => {
			const limiter = new RateLimiter(10);
			expect(limiter.getAvailableTokens()).toBe(10);
		});

		test('should initialize with custom capacity', () => {
			const limiter = new RateLimiter(10, 20);
			expect(limiter.getAvailableTokens()).toBe(20);
		});
	});

	describe('acquire', () => {
		test('should acquire token when available', async () => {
			const limiter = new RateLimiter(10, 5);
			await limiter.acquire();
			expect(limiter.getAvailableTokens()).toBe(4);
		});

		test('should wait when no tokens available', async () => {
			const limiter = new RateLimiter(10, 1);
			await limiter.acquire();
			expect(limiter.getAvailableTokens()).toBe(0);

			const startTime = Date.now();
			const acquirePromise = limiter.acquire();
			await acquirePromise;
			const elapsed = Date.now() - startTime;

			expect(elapsed).toBeGreaterThanOrEqual(100);
			expect(elapsed).toBeLessThan(200);
		});

		test('should refill tokens over time', async () => {
			const limiter = new RateLimiter(100, 10);
			await limiter.acquire();
			await limiter.acquire();
			expect(limiter.getAvailableTokens()).toBe(8);

			await new Promise(resolve => setTimeout(resolve, 100));
			const availableTokens = limiter.getAvailableTokens();
			expect(availableTokens).toBeGreaterThan(8);
			expect(availableTokens).toBeLessThanOrEqual(10);
		});

		test('should not exceed capacity', async () => {
			const limiter = new RateLimiter(10, 5);
			await new Promise(resolve => setTimeout(resolve, 1000));
			expect(limiter.getAvailableTokens()).toBeLessThanOrEqual(5);
		});

		test('should handle multiple concurrent requests', async () => {
			const limiter = new RateLimiter(10, 2);
			const startTime = Date.now();

			const promises = [
				limiter.acquire(),
				limiter.acquire(),
				limiter.acquire(),
				limiter.acquire(),
			];

			await Promise.all(promises);
			const elapsed = Date.now() - startTime;

			expect(elapsed).toBeGreaterThan(100);
			expect(elapsed).toBeLessThan(300);
		});
	});

	describe('getAvailableTokens', () => {
		test('should return correct token count', () => {
			const limiter = new RateLimiter(10, 5);
			expect(limiter.getAvailableTokens()).toBe(5);
		});

		test('should update after acquire', async () => {
			const limiter = new RateLimiter(10, 5);
			await limiter.acquire();
			expect(limiter.getAvailableTokens()).toBe(4);
		});
	});

	describe('reset', () => {
		test('should reset tokens to capacity', async () => {
			const limiter = new RateLimiter(10, 5);
			await limiter.acquire();
			await limiter.acquire();
			expect(limiter.getAvailableTokens()).toBe(3);

			limiter.reset();
			expect(limiter.getAvailableTokens()).toBe(5);
		});

		test('should reset lastRefill time', async () => {
			const limiter = new RateLimiter(10, 5);
			await new Promise(resolve => setTimeout(resolve, 100));

			limiter.reset();
			await limiter.acquire();
			await new Promise(resolve => setTimeout(resolve, 100));

			const availableTokens = limiter.getAvailableTokens();
			expect(availableTokens).toBeGreaterThan(3);
		});
	});

	describe('rate calculation', () => {
		test('should refill at correct rate', async () => {
			const limiter = new RateLimiter(10, 10);
			await limiter.acquire();
			await limiter.acquire();
			await limiter.acquire();
			expect(limiter.getAvailableTokens()).toBe(7);

			await new Promise(resolve => setTimeout(resolve, 200));
			const availableTokens = limiter.getAvailableTokens();

			expect(availableTokens).toBeGreaterThan(7);
			expect(availableTokens).toBeLessThanOrEqual(10);
		});

		test('should handle high rate', async () => {
			const limiter = new RateLimiter(100, 10);
			await limiter.acquire();
			await new Promise(resolve => setTimeout(resolve, 100));

			const availableTokens = limiter.getAvailableTokens();
			expect(availableTokens).toBeGreaterThan(9);
			expect(availableTokens).toBeLessThanOrEqual(10);
		});

		test('should handle low rate', async () => {
			const limiter = new RateLimiter(1, 10);
			await limiter.acquire();
			await new Promise(resolve => setTimeout(resolve, 1000));

			const availableTokens = limiter.getAvailableTokens();
			expect(availableTokens).toBeGreaterThan(9);
			expect(availableTokens).toBeLessThanOrEqual(10);
		});
	});
});
