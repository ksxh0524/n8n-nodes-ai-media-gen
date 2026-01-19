export interface ICache {
	get(key: string): Promise<any | null>;
	set(key: string, value: any, ttl?: number): Promise<void>;
	delete(key: string): Promise<void>;
	clear(): Promise<void>;
}

export class CacheManager {
	private static instance: CacheManager;
	private cache: ICache;

	private constructor(cache: ICache) {
		this.cache = cache;
	}

	static getInstance(cache?: ICache): CacheManager {
		if (!CacheManager.instance) {
			const cacheInstance = cache || new MemoryCache();
			CacheManager.instance = new CacheManager(cacheInstance);
		}
		return CacheManager.instance;
	}

	async get(key: string): Promise<any | null> {
		return await this.cache.get(key);
	}

	async set(key: string, value: any, ttl: number = 3600): Promise<void> {
		await this.cache.set(key, value, ttl);
	}

	async delete(key: string): Promise<void> {
		await this.cache.delete(key);
	}

	async clear(): Promise<void> {
		await this.cache.clear();
	}
}

class MemoryCacheEntry {
	value: any;
	expiry: number;

	constructor(value: any, ttl: number) {
		this.value = value;
		this.expiry = Date.now() + ttl * 1000;
	}

	isExpired(): boolean {
		return Date.now() > this.expiry;
	}
}

export class MemoryCache implements ICache {
	private cache = new Map<string, MemoryCacheEntry>();
	private maxSize = 100;
	private ttl = 3600;

	constructor(options?: { maxSize?: number; defaultTtl?: number }) {
		if (options?.maxSize) {
			this.maxSize = options.maxSize;
		}
		if (options?.defaultTtl) {
			this.ttl = options.defaultTtl;
		}
	}

	async get(key: string): Promise<any | null> {
		const entry = this.cache.get(key);
		if (!entry || entry.isExpired()) {
			if (entry && entry.isExpired()) {
				this.cache.delete(key);
			}
			return null;
		}
		return entry.value;
	}

	async set(key: string, value: any, ttl?: number): Promise<void> {
		const actualTtl = ttl ?? this.ttl;
		const entry = new MemoryCacheEntry(value, actualTtl);

		this.cache.set(key, entry);

		this.evictIfNeeded();
	}

	async delete(key: string): Promise<void> {
		this.cache.delete(key);
	}

	async clear(): Promise<void> {
		this.cache.clear();
	}

	private evictIfNeeded(): void {
		if (this.cache.size > this.maxSize) {
			const entries = Array.from(this.cache.entries());
			entries.sort((a, b) => a[1].expiry - b[1].expiry);

			const toRemove = entries.slice(0, this.cache.size - this.maxSize);
			for (const [key] of toRemove) {
				this.cache.delete(key);
			}
		}
	}

	getSize(): number {
		return this.cache.size;
	}
}

export class CacheKeyGenerator {
	static forGeneration(apiFormat: string, model: string, prompt: string, params: any): string {
		const paramsStr = JSON.stringify(params || {});
		return `gen:${apiFormat}:${model}:${this.hash(prompt)}:${this.hash(paramsStr)}`;
	}

	static forApiRequest(apiFormat: string, endpoint: string, body: any): string {
		const bodyStr = JSON.stringify(body || {});
		return `api:${apiFormat}:${endpoint}:${this.hash(bodyStr)}`;
	}

	private static hash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return hash.toString(36);
	}
}
