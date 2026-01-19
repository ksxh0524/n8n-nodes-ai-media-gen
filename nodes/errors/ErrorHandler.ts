/**
 * Error Handler
 * Centralized error handling and logging
 */

import { MediaGenError, MediaGenErrorCode } from './MediaGenError';
import { INodeExecutionData } from 'n8n-workflow';

/**
 * Error handler options
 */
export interface IErrorHandlerOptions {
  logErrors?: boolean;
  includeStackTrace?: boolean;
  notifyUser?: boolean;
  retryOnError?: boolean;
}

/**
 * Error handler result
 */
export interface IErrorHandlerResult {
  success: boolean;
  error?: {
    message: string;
    code: string;
    userMessage: string;
    retryable: boolean;
  };
}

/**
 * Centralized error handler
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private options: IErrorHandlerOptions = {
    logErrors: true,
    includeStackTrace: true,
    notifyUser: true,
    retryOnError: false,
  };

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Set error handler options
   */
  setOptions(options: Partial<IErrorHandlerOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Handle an error
   */
  handle(error: unknown, context?: Record<string, any>): IErrorHandlerResult {
    const mediaGenError = this.normalizeError(error);

    if (this.options.logErrors) {
      this.logError(mediaGenError, context);
    }

    return {
      success: false,
      error: {
        message: mediaGenError.message,
        code: mediaGenError.code,
        userMessage: mediaGenError.getUserMessage(),
        retryable: mediaGenError.isRetryable(),
      },
    };
  }

  /**
   * Handle error and return n8n execution data
   */
  handleForNode(
    error: unknown,
    context?: Record<string, any>
  ): INodeExecutionData {
    const result = this.handle(error, context);

    return {
      json: {
        success: false,
        error: result.error,
        context,
      },
    };
  }

  /**
   * Normalize error to MediaGenError
   */
  private normalizeError(error: unknown): MediaGenError {
    if (error instanceof MediaGenError) {
      return error;
    }

    if (error instanceof Error) {
      return MediaGenError.wrap(error);
    }

    if (typeof error === 'string') {
      return new MediaGenError(error);
    }

    return new MediaGenError(
      'An unknown error occurred',
      MediaGenErrorCode.UNKNOWN_ERROR
    );
  }

  /**
   * Log error with context
   */
  private logError(error: MediaGenError, context?: Record<string, any>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: error.toJSON(),
      context,
    };

    console.error('[MediaGenError]', JSON.stringify(logEntry, null, 2));
  }

  /**
   * Create a user-friendly error message
   */
  createUserMessage(error: MediaGenError): string {
    const baseMessage = error.getUserMessage();

    if (error.isRetryable()) {
      return `${baseMessage} You can try again.`;
    }

    return baseMessage;
  }

  /**
   * Check if error should trigger a retry
   */
  shouldRetry(error: unknown): boolean {
    const normalized = this.normalizeError(error);
    return normalized.isRetryable() && this.options.retryOnError;
  }

  /**
   * Wrap a function with error handling
   */
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: Record<string, any>
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        const result = this.handle(error, context);
        throw result.error;
      }
    }) as T;
  }

  /**
   * Handle batch processing errors
   */
  handleBatchError(
    errors: Array<{
      item: any;
      error: unknown;
    }>
  ): {
    total: number;
    failed: number;
    succeeded: number;
    errors: Array<{
      item: any;
      error: IErrorHandlerResult['error'];
    }>;
  } {
    const failed = errors.length;
    const succeeded = 0; // Already filtered out

    return {
      total: failed + succeeded,
      failed,
      succeeded,
      errors: errors.map(({ item, error }) => ({
        item,
        error: this.handle(error).error,
      })),
    };
  }

  /**
   * Create error from validation result
   */
  fromValidationErrors(errors: Array<{ field: string; message: string }>): MediaGenError {
    const message = `Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
    return new MediaGenError(
      message,
      MediaGenErrorCode.MODEL_VALIDATION_FAILED,
      { validationErrors: errors }
    );
  }

  /**
   * Parse API error response
   */
  parseApiError(response: any): MediaGenError {
    if (!response) {
      return new MediaGenError(
        'Unknown API error',
        MediaGenErrorCode.HTTP_ERROR
      );
    }

    // Try to extract error message from various API formats
    let message = 'API error occurred';
    let code = MediaGenErrorCode.HTTP_ERROR;
    let status = response.status;

    if (response.error) {
      message = typeof response.error === 'string'
        ? response.error
        : response.error.message || message;
    } else if (response.message) {
      message = response.message;
    }

    // Map HTTP status to error code
    if (status) {
      return MediaGenError.fromHttpStatus(status, message);
    }

    return new MediaGenError(message, code, { response });
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): {
    recentErrors: MediaGenError[];
    errorCounts: Record<string, number>;
  } {
    // This would be implemented with proper error tracking
    return {
      recentErrors: [],
      errorCounts: {},
    };
  }
}

/**
 * Convenience function to handle errors
 */
export function handleError(
  error: unknown,
  context?: Record<string, any>
): IErrorHandlerResult {
  return ErrorHandler.getInstance().handle(error, context);
}

/**
 * Convenience function to create and throw MediaGenError
 */
export function throwError(
  message: string,
  code?: MediaGenErrorCode,
  metadata?: Record<string, any>
): never {
  throw new MediaGenError(message, code, metadata);
}
