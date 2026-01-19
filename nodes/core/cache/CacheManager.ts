/**
 * Cache Manager
 * Centralized cache management with key generation
 */

import { ICache, ICacheOptions } from './ICache';
import { MemoryCache } from './MemoryCache';

/**
 * Cache key generators for different scenarios
 */
export class CacheKeyGenerator {
  /**
   * Generate cache key for model generation
   */
  static forGeneration(modelId: string, params: Record<string, any>): string {
    // Create a deterministic key from model and params
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => ({ ...acc, [key]: params[key] }), {});

    const paramString = JSON.stringify(sortedParams);
    const hash = this.simpleHash(paramString);

    return `gen:${modelId}:${hash}`;
  }

  /**
   * Generate cache key for API response
   */
  static forApiRequest(endpoint: string, params: Record<string, any>): string {
    const paramString = JSON.stringify(params);
    const hash = this.simpleHash(paramString);
    return `api:${endpoint}:${hash}`;
  }

  /**
   * Generate cache key for async task status
   */
  static forTask(taskId: string): string {
    return `task:${taskId}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Centralized cache manager
 */
export class CacheManager {
  private static instance: CacheManager;
  private cache: ICache;
  private enabled: boolean = true;
  private defaultTTL: number = 3600; // 1 hour

  private constructor(cache?: ICache) {
    this.cache = cache || new MemoryCache();
  }

  /**
   * Get singleton instance
   */
  static getInstance(cache?: ICache): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(cache);
    }
    return CacheManager.instance;
  }

  /**
   * Set cache implementation
   */
  setCache(cache: ICache): void {
    this.cache = cache;
  }

  /**
   * Enable or disable caching
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Set default TTL
   */
  setDefaultTTL(ttl: number): void {
    this.defaultTTL = ttl;
  }

  /**
   * Get from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      return await this.cache.get<T>(key);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await this.cache.set(key, value, {
        ttl: ttl || this.defaultTTL,
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.cache.delete(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      await this.cache.clear();
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      return await this.cache.has(key);
    } catch (error) {
      console.error('Cache has error:', error);
      return false;
    }
  }

  /**
   * Get or set pattern
   */
  async getOrSet<T>(
    key: string,
    factory: () => T | Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (!this.enabled) {
      return await factory();
    }

    try {
      return await this.cache.getOrSet(key, factory, {
        ttl: ttl || this.defaultTTL,
      });
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      return await factory();
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
  }> {
    try {
      return await this.cache.getStats();
    } catch (error) {
      console.error('Cache getStats error:', error);
      return {
        size: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        evictions: 0,
      };
    }
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<void> {
    try {
      await this.cache.cleanup();
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
