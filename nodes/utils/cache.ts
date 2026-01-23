import { createHash } from 'crypto';
import type { ICacheOptions } from './types';
import * as CONSTANTS from './constants';

export interface ICache {
	get(key: string): Promise<unknown | null>;
	set(key: string, value: unknown, ttl?: number): Promise<void>;
	delete(key: string): Promise<void>;
	clear(): Promise<void>;
}

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

export class MemoryCacheEntry {
	value: unknown;
	expiry: number;
	lastAccessed: number;

	constructor(value: unknown, ttl: number) {
		this.value = value;
		this.expiry = Date.now() + ttl * 1000;
		this.lastAccessed = Date.now();
	}

	isExpired(): boolean {
		return Date.now() > this.expiry;
	}

	access(): void {
		this.lastAccessed = Date.now();
	}
}

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

export class CacheKeyGenerator {
	static forGeneration(apiFormat: string, model: string, prompt: string, params: Record<string, unknown>): string {
		const paramsStr = JSON.stringify(params || {});
		return `gen:${apiFormat}:${model}:${this.hash(prompt)}:${this.hash(paramsStr)}`;
	}

	static forApiRequest(apiFormat: string, endpoint: string, body: Record<string, unknown>): string {
		const bodyStr = JSON.stringify(body || {});
		return `api:${apiFormat}:${endpoint}:${this.hash(bodyStr)}`;
	}

	private static hash(str: string): string {
		return createHash('sha256').update(str).digest('hex').substring(0, CONSTANTS.HASH.LENGTH);
	}
}
