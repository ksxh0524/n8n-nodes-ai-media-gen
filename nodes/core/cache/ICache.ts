/**
 * Cache interface
 * Defines the contract for cache implementations
 */

/**
 * Cache entry metadata
 */
export interface ICacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

/**
 * Cache statistics
 */
export interface ICacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

/**
 * Cache options
 */
export interface ICacheOptions {
  ttl?: number; // Time to live in seconds
  maxSize?: number; // Maximum number of entries
}

/**
 * Generic cache interface
 */
export interface ICache {
  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Cache options (TTL, etc.)
   */
  set<T>(key: string, value: T, options?: ICacheOptions): Promise<void>;

  /**
   * Check if a key exists in cache
   * @param key - Cache key
   * @returns True if key exists and not expired
   */
  has(key: string): Promise<boolean>;

  /**
   * Delete a key from cache
   * @param key - Cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all entries from cache
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getStats(): Promise<ICacheStats>;

  /**
   * Get cache size
   * @returns Number of entries in cache
   */
  size(): Promise<number>;

  /**
   * Clean up expired entries
   */
  cleanup(): Promise<void>;

  /**
   * Get or set pattern - get if exists, otherwise set and return
   * @param key - Cache key
   * @param factory - Function to generate value if not in cache
   * @param options - Cache options
   * @returns Cached or newly generated value
   */
  getOrSet<T>(
    key: string,
    factory: () => T | Promise<T>,
    options?: ICacheOptions
  ): Promise<T>;

  /**
   * Get multiple keys
   * @param keys - Array of cache keys
   * @returns Map of key to value (only for found keys)
   */
  getMany<T>(keys: string[]): Promise<Map<string, T>>;

  /**
   * Set multiple keys
   * @param entries - Map of key to value
   * @param options - Cache options
   */
  setMany<T>(entries: Map<string, T>, options?: ICacheOptions): Promise<void>;

  /**
   * Delete multiple keys
   * @param keys - Array of cache keys
   */
  deleteMany(keys: string[]): Promise<void>;
}
