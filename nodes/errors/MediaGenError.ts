/**
 * Custom error class for AI Media Generation
 */

/**
 * Error codes
 */
export enum MediaGenErrorCode {
  // Provider errors
  PROVIDER_NOT_FOUND = 'provider_not_found',
  PROVIDER_INIT_FAILED = 'provider_init_failed',
  PROVIDER_UNAVAILABLE = 'provider_unavailable',

  // Model errors
  MODEL_NOT_FOUND = 'model_not_found',
  MODEL_EXECUTION_FAILED = 'model_execution_failed',
  MODEL_VALIDATION_FAILED = 'model_validation_failed',

  // Authentication errors
  AUTH_ERROR = 'auth_error',
  INVALID_CREDENTIALS = 'invalid_credentials',
  TOKEN_EXPIRED = 'token_expired',

  // Request errors
  HTTP_ERROR = 'http_error',
  TIMEOUT_ERROR = 'timeout_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  NETWORK_ERROR = 'network_error',

  // Parameter errors
  INVALID_PARAMETERS = 'invalid_parameters',
  MISSING_REQUIRED_PARAMETER = 'missing_required_parameter',

  // Task errors
  TASK_NOT_FOUND = 'task_not_found',
  TASK_FAILED = 'task_failed',
  TASK_CANCELLED = 'task_cancelled',
  TASK_TIMEOUT = 'task_timeout',

  // Cache errors
  CACHE_ERROR = 'cache_error',

  // Batch errors
  BATCH_ERROR = 'batch_error',
  CONCURRENCY_LIMIT = 'concurrency_limit',

  // Retry errors
  RETRY_ERROR = 'retry_error',
  MAX_RETRIES_EXCEEDED = 'max_retries_exceeded',

  // Server errors
  SERVER_ERROR = 'server_error',
  CLIENT_ERROR = 'client_error',

  // Generic error
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Custom error class for Media Generation operations
 */
export class MediaGenError extends Error {
  readonly code: MediaGenErrorCode;
  readonly metadata?: Record<string, any>;
  readonly originalError?: Error;

  constructor(
    message: string,
    code: MediaGenErrorCode = MediaGenErrorCode.UNKNOWN_ERROR,
    metadata?: Record<string, any>
  );
  constructor(
    message: string,
    code: MediaGenErrorCode = MediaGenErrorCode.UNKNOWN_ERROR,
    originalError?: Error,
    metadata?: Record<string, any>
  );
  constructor(
    message: string,
    code: MediaGenErrorCode = MediaGenErrorCode.UNKNOWN_ERROR,
    errorOrMetadata?: Error | Record<string, any>,
    metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'MediaGenError';
    this.code = code;

    // Handle overloaded parameters
    if (errorOrMetadata instanceof Error) {
      this.originalError = errorOrMetadata;
      this.metadata = metadata;
    } else {
      this.metadata = errorOrMetadata;
    }

    // Maintain proper stack trace
    Error.captureStackTrace?.(this, MediaGenError);
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    const retryableCodes = [
      MediaGenErrorCode.TIMEOUT_ERROR,
      MediaGenErrorCode.RATE_LIMIT_ERROR,
      MediaGenErrorCode.NETWORK_ERROR,
      MediaGenErrorCode.SERVER_ERROR,
      MediaGenErrorCode.TASK_TIMEOUT,
    ];

    return retryableCodes.includes(this.code);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    const userMessages: Record<MediaGenErrorCode, string> = {
      [MediaGenErrorCode.PROVIDER_NOT_FOUND]: 'The specified AI provider is not available.',
      [MediaGenErrorCode.PROVIDER_INIT_FAILED]: 'Failed to initialize the AI provider.',
      [MediaGenErrorCode.PROVIDER_UNAVAILABLE]: 'The AI provider is currently unavailable.',

      [MediaGenErrorCode.MODEL_NOT_FOUND]: 'The specified AI model is not available.',
      [MediaGenErrorCode.MODEL_EXECUTION_FAILED]: 'Failed to generate content using the AI model.',
      [MediaGenErrorCode.MODEL_VALIDATION_FAILED]: 'The provided parameters are invalid for this model.',

      [MediaGenErrorCode.AUTH_ERROR]: 'Authentication failed. Please check your credentials.',
      [MediaGenErrorCode.INVALID_CREDENTIALS]: 'Invalid credentials provided.',
      [MediaGenErrorCode.TOKEN_EXPIRED]: 'Authentication token has expired.',

      [MediaGenErrorCode.HTTP_ERROR]: 'An HTTP error occurred while communicating with the AI provider.',
      [MediaGenErrorCode.TIMEOUT_ERROR]: 'The request timed out. Please try again.',
      [MediaGenErrorCode.RATE_LIMIT_ERROR]: 'Rate limit exceeded. Please wait before trying again.',
      [MediaGenErrorCode.NETWORK_ERROR]: 'A network error occurred. Please check your connection.',

      [MediaGenErrorCode.INVALID_PARAMETERS]: 'Invalid parameters provided.',
      [MediaGenErrorCode.MISSING_REQUIRED_PARAMETER]: 'A required parameter is missing.',

      [MediaGenErrorCode.TASK_NOT_FOUND]: 'The requested task was not found.',
      [MediaGenErrorCode.TASK_FAILED]: 'The task failed to complete.',
      [MediaGenErrorCode.TASK_CANCELLED]: 'The task was cancelled.',
      [MediaGenErrorCode.TASK_TIMEOUT]: 'The task timed out.',

      [MediaGenErrorCode.CACHE_ERROR]: 'An error occurred while accessing the cache.',
      [MediaGenErrorCode.BATCH_ERROR]: 'An error occurred during batch processing.',
      [MediaGenErrorCode.CONCURRENCY_LIMIT]: 'Maximum concurrent tasks limit reached.',

      [MediaGenErrorCode.RETRY_ERROR]: 'Failed after retrying the operation.',
      [MediaGenErrorCode.MAX_RETRIES_EXCEEDED]: 'Maximum retry attempts exceeded.',

      [MediaGenErrorCode.SERVER_ERROR]: 'The AI provider server encountered an error.',
      [MediaGenErrorCode.CLIENT_ERROR]: 'The request was invalid.',

      [MediaGenErrorCode.UNKNOWN_ERROR]: 'An unknown error occurred.',
    };

    return userMessages[this.code] || this.message;
  }

  /**
   * Convert error to plain object for logging/serialization
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      metadata: this.metadata,
      stack: this.stack,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            stack: this.originalError.stack,
          }
        : undefined,
    };
  }

  /**
   * Create error from HTTP status code
   */
  static fromHttpStatus(
    status: number,
    message?: string,
    metadata?: Record<string, any>
  ): MediaGenError {
    let code: MediaGenErrorCode;

    if (status === 401 || status === 403) {
      code = MediaGenErrorCode.AUTH_ERROR;
    } else if (status === 429) {
      code = MediaGenErrorCode.RATE_LIMIT_ERROR;
    } else if (status >= 500) {
      code = MediaGenErrorCode.SERVER_ERROR;
    } else if (status >= 400) {
      code = MediaGenErrorCode.CLIENT_ERROR;
    } else {
      code = MediaGenErrorCode.HTTP_ERROR;
    }

    return new MediaGenError(
      message || `HTTP Error: ${status}`,
      code,
      { ...metadata, status }
    );
  }

  /**
   * Wrap an existing error
   */
  static wrap(error: Error, code?: MediaGenErrorCode, message?: string): MediaGenError {
    if (error instanceof MediaGenError) {
      return error;
    }

    return new MediaGenError(
      message || error.message,
      code || MediaGenErrorCode.UNKNOWN_ERROR,
      error
    );
  }
}
