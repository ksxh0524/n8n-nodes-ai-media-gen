/**
 * Retry Helper
 * Handles retry logic with exponential backoff
 */

import { IRetryConfig } from '../../types/core.types';
import { MediaGenError } from '../../errors/MediaGenError';

/**
 * Helper class for retrying operations
 */
export class RetryHelper {
  /**
   * Execute a function with retry logic
   * @param fn - Function to execute
   * @param config - Retry configuration
   * @returns Result of the function
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    config: IRetryConfig = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelayMs = 1000,
      maxDelayMs = 30000,
      backoffMultiplier = 2,
      retryableStatuses = [429, 500, 502, 503, 504],
      retryableErrors = ['timeout_error', 'server_error'],
    } = config;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Check if this is the last attempt or error is not retryable
        if (attempt === maxRetries || !this.isRetryable(error, retryableStatuses, retryableErrors)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelayMs * Math.pow(backoffMultiplier, attempt),
          maxDelayMs
        );

        // Add jitter to avoid thundering herd
        const jitter = delay * 0.1 * Math.random();
        const finalDelay = delay + jitter;

        console.warn(
          `Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${Math.round(finalDelay)}ms:`,
          error.message
        );

        await this.sleep(finalDelay);
      }
    }

    throw lastError || new MediaGenError('Retry failed', 'retry_error');
  }

  /**
   * Check if an error is retryable
   */
  private static isRetryable(
    error: any,
    retryableStatuses: number[],
    retryableErrors: string[]
  ): boolean {
    // Check if it's a MediaGenError with a retryable code
    if (error instanceof MediaGenError) {
      if (retryableErrors.includes(error.code)) {
        return true;
      }

      // Check if error has a status code that is retryable
      if (error.metadata?.status && retryableStatuses.includes(error.metadata.status)) {
        return true;
      }

      // Rate limit errors are always retryable
      if (error.code === 'rate_limit_error') {
        return true;
      }
    }

    // Check for network errors
    if (error.name === 'AbortError' || error.code === 'ECONNRESET') {
      return true;
    }

    return false;
  }

  /**
   * Sleep for a specified duration
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a retryable function wrapper
   * @param fn - Function to wrap
   * @param config - Retry configuration
   * @returns Wrapped function with retry logic
   */
  static wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    config: IRetryConfig = {}
  ): T {
    return (async (...args: Parameters<T>) => {
      return this.withRetry(() => fn(...args), config);
    }) as T;
  }
}
