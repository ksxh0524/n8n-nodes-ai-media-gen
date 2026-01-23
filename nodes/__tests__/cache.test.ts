import { CacheManager, MemoryCache, CacheKeyGenerator } from '../utils/cache';

describe('CacheManager', () => {
	let cacheManager: CacheManager;
	let memoryCache: MemoryCache;

	beforeEach(() => {
		memoryCache = new MemoryCache({ maxSize: 10, defaultTtl: 60 });
		cacheManager = new CacheManager(memoryCache);
	});

	afterEach(async () => {
		await cacheManager.clear();
	});

	test('should store and retrieve values', async () => {
		await cacheManager.set('key1', { value: 'test' });
		const result = await cacheManager.get('key1');
		expect(result).toEqual({ value: 'test' });
	});

	test('should return null for non-existent keys', async () => {
		const result = await cacheManager.get('non-existent');
		expect(result).toBeNull();
	});

	test('should delete values', async () => {
		await cacheManager.set('key1', { value: 'test' });
		await cacheManager.delete('key1');
		const result = await cacheManager.get('key1');
		expect(result).toBeNull();
	});

	test('should clear all values', async () => {
		await cacheManager.set('key1', { value: 'test1' });
		await cacheManager.set('key2', { value: 'test2' });
		await cacheManager.clear();
		expect(await cacheManager.get('key1')).toBeNull();
		expect(await cacheManager.get('key2')).toBeNull();
	});

	test('should respect TTL', async () => {
		await cacheManager.set('key1', { value: 'test' }, 0.001);
		await new Promise(resolve => setTimeout(resolve, 10));
		const result = await cacheManager.get('key1');
		expect(result).toBeNull();
	});
});

describe('MemoryCache', () => {
	let cache: MemoryCache;

	beforeEach(() => {
		cache = new MemoryCache({ maxSize: 5, defaultTtl: 60 });
	});

	afterEach(async () => {
		await cache.clear();
	});

	test('should store and retrieve values', async () => {
		await cache.set('key1', { value: 'test' });
		const result = await cache.get('key1');
		expect(result).toEqual({ value: 'test' });
	});

	test('should expire entries', async () => {
		await cache.set('key1', { value: 'test' }, 1);
		await new Promise(resolve => setTimeout(resolve, 1100));
		const result = await cache.get('key1');
		expect(result).toBeNull();
	});

	test('should evict oldest entries when maxSize is reached', async () => {
		await cache.set('key1', { value: 'test1' }, 100);
		await cache.set('key2', { value: 'test2' }, 200);
		await cache.set('key3', { value: 'test3' }, 300);
		await cache.set('key4', { value: 'test4' }, 400);
		await cache.set('key5', { value: 'test5' }, 500);
		await cache.set('key6', { value: 'test6' }, 600);

		expect(await cache.get('key1')).toBeNull();
		expect(await cache.get('key6')).toEqual({ value: 'test6' });
	});

	test('should return correct size', async () => {
		expect(cache.getSize()).toBe(0);
		await cache.set('key1', { value: 'test1' });
		await cache.set('key2', { value: 'test2' });
		expect(cache.getSize()).toBe(2);
	});
});

describe('CacheKeyGenerator', () => {
	test('should generate unique keys for different inputs', () => {
		const key1 = CacheKeyGenerator.forGeneration('openai', 'dall-e-3', 'A sunset', { size: '1024x1024' });
		const key2 = CacheKeyGenerator.forGeneration('openai', 'dall-e-3', 'A sunrise', { size: '1024x1024' });
		expect(key1).not.toBe(key2);
	});

	test('should generate same key for identical inputs', () => {
		const key1 = CacheKeyGenerator.forGeneration('openai', 'dall-e-3', 'A sunset', { size: '1024x1024' });
		const key2 = CacheKeyGenerator.forGeneration('openai', 'dall-e-3', 'A sunset', { size: '1024x1024' });
		expect(key1).toBe(key2);
	});

	test('should generate different keys for different providers', () => {
		const key1 = CacheKeyGenerator.forGeneration('openai', 'dall-e-3', 'A sunset', {});
		const key2 = CacheKeyGenerator.forGeneration('gemini', 'imagen-2.0', 'A sunset', {});
		expect(key1).not.toBe(key2);
	});

	test('should generate API request keys', () => {
		const key = CacheKeyGenerator.forApiRequest('openai', '/images/generations', { model: 'dall-e-3' });
		expect(key).toContain('api:openai:/images/generations:');
	});

	test('should generate hash using SHA256', () => {
		const key = CacheKeyGenerator.forGeneration('openai', 'dall-e-3', 'test prompt', {});
		expect(key).toMatch(/^gen:openai:dall-e-3:[a-f0-9]{32}:[a-f0-9]{32}$/);
	});
});
