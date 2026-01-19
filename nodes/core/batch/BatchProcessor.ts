/**
 * Batch Processor
 * Processes items in batches with concurrency control
 */

import { IBatchOptions, IBatchResult } from '../../types/core.types';
import { Semaphore, Throttle } from './ConcurrencyControl';
import { RetryHelper } from '../utils/RetryHelper';

/**
 * Batch processor options
 */
export interface IBatchProcessorOptions extends IBatchOptions {
  onProgress?: (completed: number, total: number) => void;
  onItemClick?: (item: any, index: number) => void;
  onItemComplete?: (item: any, result: any, index: number) => void;
  onItemError?: (item: any, error: Error, index: number) => void;
}

/**
 * Batch processor result
 */
export interface IBatchProcessorResult<T> extends IBatchResult<T> {
  duration: number;
}

/**
 * Batch Processor
 */
export class BatchProcessor {
  private defaultOptions: IBatchProcessorOptions = {
    concurrency: 3,
    delayMs: 0,
    maxRetries: 0,
    continueOnError: true,
  };

  constructor(defaultOptions?: Partial<IBatchProcessorOptions>) {
    if (defaultOptions) {
      this.defaultOptions = { ...this.defaultOptions, ...defaultOptions };
    }
  }

  /**
   * Process items in batch
   */
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options?: Partial<IBatchProcessorOptions>
  ): Promise<IBatchProcessorResult<R>> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    // Create semaphore for concurrency control
    const semaphore = new Semaphore(opts.concurrency || 3);
    const throttle = opts.delayMs && opts.delayMs > 0 ? new Throttle(opts.delayMs) : null;

    const results: R[] = [];
    const errors: Array<{ item: T; error: string }> = [];
    let completedCount = 0;

    // Process items with concurrency control
    const promises = items.map(async (item, index) => {
      return semaphore.execute(async () => {
        try {
          opts.onItemClick?.(item, index);

          // Apply throttling if configured
          const result = throttle
            ? await throttle.execute(() => this.processItem(item, processor, opts))
            : await this.processItem(item, processor, opts);

          completedCount++;
          opts.onProgress?.(completedCount, items.length);
          opts.onItemComplete?.(item, result, index);

          return { success: true, result, index };
        } catch (error: any) {
          completedCount++;
          opts.onProgress?.(completedCount, items.length);

          const errorMessage = error.message || String(error);
          errors.push({ item, error: errorMessage });
          opts.onItemError?.(item, error, index);

          if (opts.continueOnError) {
            return { success: false, error: errorMessage, index };
          }

          throw error;
        }
      });
    });

    // Wait for all processing to complete
    const settledResults = await Promise.allSettled(promises);

    // Extract results in original order
    const orderedResults: R[] = new Array(items.length);
    let successCount = 0;

    for (const result of settledResults) {
      if (result.status === 'fulfilled' && result.value.success) {
        orderedResults[result.value.index] = result.value.result;
        successCount++;
      }
    }

    // Filter out undefined results (from errors)
    const finalResults = orderedResults.filter((r) => r !== undefined);

    return {
      success: errors.length === 0,
      results: finalResults,
      errors,
      totalProcessed: items.length,
      successCount,
      failureCount: errors.length,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Process a single item with retry logic
   */
  private async processItem<T, R>(
    item: T,
    processor: (item: T) => Promise<R>,
    options: IBatchProcessorOptions
  ): Promise<R> {
    const { maxRetries = 0 } = options;

    if (maxRetries <= 0) {
      return await processor(item);
    }

    return RetryHelper.withRetry(
      () => processor(item),
      {
        maxRetries,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
      }
    );
  }

  /**
   * Process items in chunks (sequential batch processing)
   */
  async processInChunks<T, R>(
    items: T[],
    chunkSize: number,
    processor: (chunk: T[]) => Promise<R[]>,
    options?: Partial<IBatchProcessorOptions>
  ): Promise<IBatchProcessorResult<R>> {
    const startTime = Date.now();
    const results: R[] = [];
    const errors: Array<{ item: T; error: string }> = [];
    let completedChunks = 0;

    // Split items into chunks
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    // Process each chunk sequentially
    for (const chunk of chunks) {
      try {
        const chunkResults = await processor(chunk);
        results.push(...chunkResults);

        completedChunks++;
        options?.onProgress?.(completedChunks, chunks.length);
      } catch (error: any) {
        // Add all items in chunk to errors
        for (const item of chunk) {
          errors.push({ item, error: error.message || String(error) });
        }

        if (!options?.continueOnError) {
          break;
        }
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      totalProcessed: items.length,
      successCount: results.length,
      failureCount: errors.length,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Process items with a timeout
   */
  async processWithTimeout<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    timeoutMs: number,
    options?: Partial<IBatchProcessorOptions>
  ): Promise<IBatchProcessorResult<R>> {
    const wrappedProcessor = async (item: T): Promise<R> => {
      return Promise.race([
        processor(item),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        ),
      ]);
    };

    return this.processBatch(items, wrappedProcessor, options);
  }

  /**
   * Map items to results (simpler API)
   */
  async map<T, R>(
    items: T[],
    mapper: (item: T) => Promise<R>,
    concurrency?: number
  ): Promise<R[]> {
    const result = await this.processBatch(items, mapper, { concurrency });

    if (!result.success && result.errors.length > 0) {
      throw new Error(
        `Batch processing failed: ${result.errors.length} errors occurred`
      );
    }

    return result.results;
  }

  /**
   * Filter items (simpler API)
   */
  async filter<T>(
    items: T[],
    predicate: (item: T) => Promise<boolean>,
    concurrency?: number
  ): Promise<T[]> {
    const results = await this.map(
      items,
      async (item) => ({ item, pass: await predicate(item) }),
      concurrency
    );

    return results.filter((r) => r.pass).map((r) => r.item);
  }

  /**
   * Reduce items (simpler API)
   */
  async reduce<T, R>(
    items: T[],
    reducer: (accumulator: R, item: T) => Promise<R>,
    initialValue: R,
    concurrency?: number
  ): Promise<R> {
    let accumulator = initialValue;

    for (const item of items) {
      accumulator = await reducer(accumulator, item);
    }

    return accumulator;
  }
}
