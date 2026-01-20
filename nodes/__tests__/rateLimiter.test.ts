import { RateLimiter } from '../utils/rateLimiter';

describe('RateLimiter', () => {
	afterEach(() => {
		RateLimiter.clearAllInstances();
	});

	describe('getInstance', () => {
		test('should return same instance for same key', () => {
			const limiter1 = RateLimiter.getInstance({ rate: 10, capacity: 5, key: 'test' });
			const limiter2 = RateLimiter.getInstance({ rate: 10, capacity: 5, key: 'test' });
			expect(limiter1).toBe(limiter2);
		});

		test('should return different instance for different key', () => {
			const limiter1 = RateLimiter.getInstance({ rate: 10, capacity: 5, key: 'test1' });
			const limiter2 = RateLimiter.getInstance({ rate: 10, capacity: 5, key: 'test2' });
			expect(limiter1).not.toBe(limiter2);
		});

		test('should return different instance for different rate', () => {
			const limiter1 = RateLimiter.getInstance({ rate: 10, capacity: 5, key: 'test' });
			const limiter2 = RateLimiter.getInstance({ rate: 20, capacity: 5, key: 'test' });
			expect(limiter1).not.toBe(limiter2);
		});

		test('should return different instance for different capacity', () => {
			const limiter1 = RateLimiter.getInstance({ rate: 10, capacity: 5, key: 'test' });
			const limiter2 = RateLimiter.getInstance({ rate: 10, capacity: 10, key: 'test' });
			expect(limiter1).not.toBe(limiter2);
		});
	});

	describe('clearInstance', () => {
		test('should clear instance for specific key', () => {
			RateLimiter.getInstance({ rate: 10, capacity: 5, key: 'test1' });
			RateLimiter.getInstance({ rate: 10, capacity: 5, key: 'test2' });
			RateLimiter.clearInstance('test1');

			const limiter1 = RateLimiter.getInstance({ rate: 10, capacity: 5, key: 'test1' });
			const limiter2 = RateLimiter.getInstance({ rate: 10, capacity: 5, key: 'test2' });
			
			expect(limiter1.getAvailableTokens()).toBe(5);
			expect(limiter2.getAvailableTokens()).toBe(5);
		});
	});

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
			const limiter = RateLimiter.getInstance({ rate: 10, capacity: 5 });
			await limiter.acquire();
			expect(limiter.getAvailableTokens()).toBe(4);
		});

		test('should wait when no tokens available', async () => {
			const limiter = RateLimiter.getInstance({ rate: 10, capacity: 1 });
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
			const limiter = RateLimiter.getInstance({ rate: 100, capacity: 10 });
			await limiter.acquire();
			await limiter.acquire();
			expect(limiter.getAvailableTokens()).toBe(8);

			await new Promise(resolve => setTimeout(resolve, 100));
			const availableTokens = limiter.getAvailableTokens();
			expect(availableTokens).toBeGreaterThan(8);
			expect(availableTokens).toBeLessThanOrEqual(10);
		});

		test('should not exceed capacity', async () => {
			const limiter = RateLimiter.getInstance({ rate: 10, capacity: 5 });
			await new Promise(resolve => setTimeout(resolve, 1000));
			expect(limiter.getAvailableTokens()).toBeLessThanOrEqual(5);
		});

		test('should handle multiple concurrent requests', async () => {
			const limiter = RateLimiter.getInstance({ rate: 10, capacity: 2 });
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
			const limiter = RateLimiter.getInstance({ rate: 10, capacity: 5 });
			expect(limiter.getAvailableTokens()).toBe(5);
		});

		test('should update after acquire', async () => {
			const limiter = RateLimiter.getInstance({ rate: 10, capacity: 5 });
			await limiter.acquire();
			expect(limiter.getAvailableTokens()).toBe(4);
		});
	});

	describe('reset', () => {
		test('should reset tokens to capacity', async () => {
			const limiter = RateLimiter.getInstance({ rate: 10, capacity: 5 });
			await limiter.acquire();
			await limiter.acquire();
			expect(limiter.getAvailableTokens()).toBe(3);

			limiter.reset();
			expect(limiter.getAvailableTokens()).toBe(5);
		});

		test('should reset lastRefill time', async () => {
			const limiter = RateLimiter.getInstance({ rate: 10, capacity: 5 });
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
			const limiter = RateLimiter.getInstance({ rate: 10, capacity: 10 });
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
			const limiter = RateLimiter.getInstance({ rate: 100, capacity: 10 });
			await limiter.acquire();
			await new Promise(resolve => setTimeout(resolve, 100));

			const availableTokens = limiter.getAvailableTokens();
			expect(availableTokens).toBeGreaterThan(9);
			expect(availableTokens).toBeLessThanOrEqual(10);
		});

		test('should handle low rate', async () => {
			const limiter = RateLimiter.getInstance({ rate: 1, capacity: 10 });
			await limiter.acquire();
			await new Promise(resolve => setTimeout(resolve, 1000));

			const availableTokens = limiter.getAvailableTokens();
			expect(availableTokens).toBeGreaterThan(9);
			expect(availableTokens).toBeLessThanOrEqual(10);
		});
	});
});
