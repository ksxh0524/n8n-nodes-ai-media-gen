/**
 * Polling strategy for async tasks
 */

import { IPollingConfig, TaskStatus } from '../../types/core.types';

/**
 * Polling strategy options
 */
export interface IPollingOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  onProgress?: (attempt: number, delay: number) => void;
}

/**
 * Polling result
 */
export interface IPollingResult<T> {
  success: boolean;
  data?: T;
  attempts: number;
  totalDuration: number;
  error?: string;
}

/**
 * Polling strategy for async operations
 */
export class PollingStrategy {
  private config: Required<IPollingConfig>;

  constructor(config: IPollingConfig = {}) {
    this.config = {
      maxAttempts: config.maxAttempts || 60, // Default: 60 attempts
      initialDelayMs: config.initialDelayMs || 1000, // Default: 1 second
      maxDelayMs: config.maxDelayMs || 30000, // Default: 30 seconds
      backoffMultiplier: config.backoffMultiplier || 1.5,
      jitter: config.jitter !== undefined ? config.jitter : true,
    };
  }

  /**
   * Poll a function until it returns a completed status
   * @param pollFn - Function to poll (should return current status)
   * @param isCompleteFn - Function to check if operation is complete
   * @param getResultFn - Function to extract result when complete
   * @returns Polling result with data or error
   */
  async poll<T>(
    pollFn: () => Promise<TaskStatus>,
    isCompleteFn: (status: TaskStatus) => boolean,
    getResultFn: () => Promise<T>
  ): Promise<IPollingResult<T>> {
    const startTime = Date.now();
    let currentDelay = this.config.initialDelayMs;

    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      // Call progress callback
      this.config.onProgress?.(attempt, currentDelay);

      // Check status
      const status = await pollFn();

      // If complete, get and return result
      if (isCompleteFn(status)) {
        try {
          const data = await getResultFn();
          return {
            success: true,
            data,
            attempts: attempt + 1,
            totalDuration: Date.now() - startTime,
          };
        } catch (error: any) {
          return {
            success: false,
            attempts: attempt + 1,
            totalDuration: Date.now() - startTime,
            error: error.message,
          };
        }
      }

      // If failed, stop polling
      if (status === 'failed' || status === 'cancelled') {
        return {
          success: false,
          attempts: attempt + 1,
          totalDuration: Date.now() - startTime,
          error: `Task ended with status: ${status}`,
        };
      }

      // Wait before next attempt
      await this.sleep(currentDelay);

      // Calculate next delay with exponential backoff
      currentDelay = Math.min(
        currentDelay * this.config.backoffMultiplier,
        this.config.maxDelayMs
      );

      // Add jitter to avoid thundering herd
      if (this.config.jitter) {
        currentDelay = currentDelay * (0.9 + Math.random() * 0.2);
      }
    }

    // Max attempts reached
    return {
      success: false,
      attempts: this.config.maxAttempts,
      totalDuration: Date.now() - startTime,
      error: `Max polling attempts (${this.config.maxAttempts}) reached`,
    };
  }

  /**
   * Poll with custom condition function
   * @param conditionFn - Function that returns true when condition is met
   * @param options - Polling options
   * @returns True if condition was met, false if max attempts reached
   */
  async pollCondition(
    conditionFn: () => Promise<boolean>,
    options?: Partial<IPollingConfig>
  ): Promise<boolean> {
    const config = { ...this.config, ...options };

    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
      if (await conditionFn()) {
        return true;
      }

      const delay = this.calculateDelay(attempt, config);
      await this.sleep(delay);
    }

    return false;
  }

  /**
   * Poll and return intermediate results
   * @param pollFn - Function to poll
   * @param options - Polling options
   * @returns Async generator yielding intermediate results
   */
  async *pollWithProgress<T>(
    pollFn: () => Promise<T>,
    options?: Partial<IPollingConfig>
  ): AsyncGenerator<T, void, unknown> {
    const config = { ...this.config, ...options };

    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
      const result = await pollFn();
      yield result;

      const delay = this.calculateDelay(attempt, config);
      await this.sleep(delay);
    }
  }

  /**
   * Calculate delay for a given attempt
   */
  private calculateDelay(attempt: number, config: Required<IPollingConfig>): number {
    let delay = Math.min(
      config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
      config.maxDelayMs
    );

    // Add jitter
    if (config.jitter) {
      delay = delay * (0.9 + Math.random() * 0.2);
    }

    return delay;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a poller for a specific use case with predefined config
   */
  static create(config: IPollingConfig = {}): PollingStrategy {
    return new PollingStrategy(config);
  }

  /**
   * Quick poll for fast operations (e.g., status checks)
   */
  static quickPoll<T>(
    pollFn: () => Promise<TaskStatus>,
    isCompleteFn: (status: TaskStatus) => boolean,
    getResultFn: () => Promise<T>
  ): Promise<IPollingResult<T>> {
    const strategy = new PollingStrategy({
      maxAttempts: 20,
      initialDelayMs: 500,
      maxDelayMs: 5000,
      backoffMultiplier: 1.2,
    });

    return strategy.poll(pollFn, isCompleteFn, getResultFn);
  }

  /**
   * Long poll for slow operations (e.g., video generation)
   */
  static longPoll<T>(
    pollFn: () => Promise<TaskStatus>,
    isCompleteFn: (status: TaskStatus) => boolean,
    getResultFn: () => Promise<T>
  ): Promise<IPollingResult<T>> {
    const strategy = new PollingStrategy({
      maxAttempts: 120, // 2+ minutes with 1s initial delay
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 1.3,
    });

    return strategy.poll(pollFn, isCompleteFn, getResultFn);
  }
}
