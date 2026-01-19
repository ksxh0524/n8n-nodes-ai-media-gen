/**
 * Concurrency Control
 * Limits concurrent operations
 */

/**
 * Semaphore for limiting concurrent operations
 */
export class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    if (permits <= 0) {
      throw new Error('Permits must be greater than 0');
    }
    this.permits = permits;
  }

  /**
   * Acquire a permit
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    // Wait for a permit to become available
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  /**
   * Release a permit
   */
  release(): void {
    if (this.waiting.length > 0) {
      // Wake up the next waiting operation
      const resolve = this.waiting.shift();
      resolve?.();
    } else {
      this.permits++;
    }
  }

  /**
   * Execute a function with a permit
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Get available permits
   */
  availablePermits(): number {
    return this.permits;
  }

  /**
   * Get number of waiting operations
   */
  waitingCount(): number {
    return this.waiting.length;
  }
}

/**
 * Throttle controls rate of operations
 */
export class Throttle {
  private minDelayMs: number;
  private lastExecution: number = 0;

  constructor(minDelayMs: number) {
    if (minDelayMs < 0) {
      throw new Error('Minimum delay must be non-negative');
    }
    this.minDelayMs = minDelayMs;
  }

  /**
   * Execute a function with throttling
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastExecution = now - this.lastExecution;

    if (timeSinceLastExecution < this.minDelayMs) {
      const delay = this.minDelayMs - timeSinceLastExecution;
      await this.sleep(delay);
    }

    try {
      return await fn();
    } finally {
      this.lastExecution = Date.now();
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Token bucket for rate limiting
 */
export class TokenBucket {
  private capacity: number;
  private tokens: number;
  private refillRate: number; // tokens per millisecond
  private lastRefill: number;

  constructor(capacity: number, refillRate: number) {
    // refillRate: tokens per second
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate / 1000; // Convert to per millisecond
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume tokens
   */
  async consume(tokens: number = 1): Promise<boolean> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Consume tokens, wait if necessary
   */
  async consumeOrWait(tokens: number = 1): Promise<void> {
    while (!(await this.consume(tokens))) {
      const waitTime = Math.ceil((tokens - this.tokens) / this.refillRate);
      await this.sleep(waitTime);
      this.refill();
    }
  }

  /**
   * Refill tokens based on time passed
   */
  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get available tokens
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}
