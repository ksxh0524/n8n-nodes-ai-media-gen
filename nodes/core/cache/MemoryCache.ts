/**
 * In-memory cache implementation
 * LRU (Least Recently Used) eviction policy
 */

import { ICache, ICacheEntry, ICacheOptions, ICacheStats } from './ICache';

/**
 * In-memory cache with LRU eviction
 */
export class MemoryCache implements ICache {
  private cache: Map<string, ICacheEntry<any>> = new Map();
  private defaultTTL: number = 3600; // 1 hour in seconds
  private maxSize: number = 1000;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(defaultTTL?: number, maxSize?: number) {
    if (defaultTTL !== undefined) {
      this.defaultTTL = defaultTTL;
    }
    if (maxSize !== undefined) {
      this.maxSize = maxSize;
    }

    // Start cleanup interval (every 5 minutes)
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access info for LRU
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, options?: ICacheOptions): Promise<void> {
    const now = Date.now();
    const ttl = options?.ttl || this.defaultTTL;

    const entry: ICacheEntry<T> = {
      value,
      expiresAt: now + ttl * 1000,
      createdAt: now,
      accessCount: 0,
      lastAccessedAt: now,
    };

    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, entry as ICacheEntry<any>);
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<ICacheStats> {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      evictions: this.stats.evictions,
    };
  }

  /**
   * Get cache size
   */
  async size(): Promise<number> {
    return this.cache.size;
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Get or set pattern
   */
  async getOrSet<T>(
    key: string,
    factory: () => T | Promise<T>,
    options?: ICacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Get multiple keys
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * Set multiple keys
   */
  async setMany<T>(entries: Map<string, T>, options?: ICacheOptions): Promise<void> {
    for (const [key, value] of entries.entries()) {
      await this.set(key, value, options);
    }
  }

  /**
   * Delete multiple keys
   */
  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.cache.delete(key);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | undefined;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestAccess) {
        oldestAccess = entry.lastAccessedAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }
}
