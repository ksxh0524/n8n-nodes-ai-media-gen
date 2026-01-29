import { createHash } from 'crypto';
import type { ICacheOptions } from './types';
import * as CONSTANTS from './constants';

/**
 * Cache interface for pluggable cache implementations
 */
export interface ICache {
	/** Get a value from cache */
	get(key: string): Promise<unknown | null>;
	/** Set a value in cache with optional TTL */
	set(key: string, value: unknown, ttl?: number): Promise<void>;
	/** Delete a value from cache */
	delete(key: string): Promise<void>;
	/** Clear all cache entries */
	clear(): Promise<void>;
}

/**
 * Cache manager for storing API responses
 *
 * Provides a simple interface for caching API responses to reduce
 * redundant API calls. Supports pluggable cache implementations.
 */
export class CacheManager {
	private cache: ICache;

	constructor(cache?: ICache) {
		this.cache = cache || new MemoryCache();
	}

	async get(key: string): Promise<unknown | null> {
		return await this.cache.get(key);
	}

	async set(key: string, value: unknown, ttl: number = CONSTANTS.DEFAULTS.CACHE_TTL_SECONDS): Promise<void> {
		await this.cache.set(key, value, ttl);
	}

	async delete(key: string): Promise<void> {
		await this.cache.delete(key);
	}

	async clear(): Promise<void> {
		await this.cache.clear();
	}
}

/**
 * In-memory cache entry with TTL support
 */
export class MemoryCacheEntry {
	/** The cached value */
	value: unknown;
	/** Expiration timestamp in milliseconds */
	expiry: number;
	/** Last access timestamp in milliseconds */
	lastAccessed: number;

	/**
	 * Creates a new cache entry
	 * @param value - The value to cache
	 * @param ttl - Time to live in seconds
	 */
	constructor(value: unknown, ttl: number) {
		this.value = value;
		this.expiry = Date.now() + ttl * 1000;
		this.lastAccessed = Date.now();
	}

	/**
	 * Checks if the entry has expired
	 * @returns true if expired
	 */
	isExpired(): boolean {
		return Date.now() > this.expiry;
	}

	/**
	 * Updates the last accessed time
	 */
	access(): void {
		this.lastAccessed = Date.now();
	}
}

/**
 * In-memory cache implementation with LRU eviction
 */
export class MemoryCache implements ICache {
	private cache = new Map<string, MemoryCacheEntry>();
	private maxSize: number;
	private ttl: number;

	constructor(options?: ICacheOptions) {
		this.maxSize = options?.maxSize ?? CONSTANTS.CACHE.DEFAULT_MAX_SIZE;
		this.ttl = options?.defaultTtl ?? CONSTANTS.DEFAULTS.CACHE_TTL_SECONDS;
	}

	async get(key: string): Promise<unknown | null> {
		const entry = this.cache.get(key);
		if (!entry || entry.isExpired()) {
			if (entry && entry.isExpired()) {
				this.cache.delete(key);
			}
			return null;
		}
		entry.access();
		return entry.value;
	}

	async set(key: string, value: unknown, ttl?: number): Promise<void> {
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
			entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

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

/**
 * Utility class for generating cache keys
 */
export class CacheKeyGenerator {
	/**
	 * Generates a cache key for generation requests
	 * @param apiFormat - API format/provider
	 * @param model - Model name
	 * @param prompt - Generation prompt
	 * @param params - Additional parameters
	 * @returns A consistent cache key
	 */
	static forGeneration(apiFormat: string, model: string, prompt: string, params: Record<string, unknown>): string {
		const sortedParams = this.sortObjectKeys(params || {});
		const paramsStr = JSON.stringify(sortedParams);
		return `gen:${apiFormat}:${model}:${this.hash(prompt)}:${this.hash(paramsStr)}`;
	}

	/**
	 * Generates a cache key for API requests
	 * @param apiFormat - API format/provider
	 * @param endpoint - API endpoint
	 * @param body - Request body
	 * @returns A consistent cache key
	 */
	static forApiRequest(apiFormat: string, endpoint: string, body: Record<string, unknown>): string {
		const sortedBody = this.sortObjectKeys(body || {});
		const bodyStr = JSON.stringify(sortedBody);
		return `api:${apiFormat}:${endpoint}:${this.hash(bodyStr)}`;
	}

	/**
	 * Recursively sorts object keys for consistent serialization
	 * @param obj - Object to sort
	 * @returns New object with sorted keys
	 */
	private static sortObjectKeys(obj: unknown): unknown {
		if (typeof obj !== 'object' || obj === null) {
			return obj;
		}

		if (Array.isArray(obj)) {
			return obj.map(item => this.sortObjectKeys(item));
		}

		const record = obj as Record<string, unknown>;
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(record).sort()) {
			const value = record[key];
			sorted[key] = this.sortObjectKeys(value);
		}
		return sorted;
	}

	/**
	 * Creates a hash of a string
	 * @param str - String to hash
	 * @returns First 32 characters of SHA256 hash
	 */
	private static hash(str: string): string {
		return createHash('sha256').update(str).digest('hex').substring(0, CONSTANTS.HASH.LENGTH);
	}
}
