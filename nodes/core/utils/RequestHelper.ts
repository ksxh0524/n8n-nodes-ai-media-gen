/**
 * HTTP Request Helper
 * Handles HTTP requests with proper error handling
 */

import { IRequestOptions, IRequestResponse } from '../../types/core.types';
import { MediaGenError } from '../../errors/MediaGenError';

/**
 * Helper class for making HTTP requests
 */
export class RequestHelper {
  private baseUrl: string;
  private defaultTimeout: number = 30000; // 30 seconds

  constructor(baseUrl: string) {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Make an HTTP request
   * @param endpoint - API endpoint
   * @param options - Request options
   * @returns Response data
   */
  async request<T>(endpoint: string, options: IRequestOptions): Promise<IRequestResponse<T>> {
    const url = this.buildUrl(endpoint);
    const timeout = options.timeout || this.defaultTimeout;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await this.parseResponse<T>(response, options.responseType);

      if (!response.ok) {
        throw this.createErrorFromResponse(response, data);
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: this.parseHeaders(response.headers),
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new MediaGenError(
          `Request timeout after ${timeout}ms`,
          'timeout_error'
        );
      }

      if (error instanceof MediaGenError) {
        throw error;
      }

      throw new MediaGenError(
        `HTTP request failed: ${error.message}`,
        'http_error',
        { originalError: error }
      );
    }
  }

  /**
   * Build full URL from endpoint
   */
  private buildUrl(endpoint: string): string {
    // Remove leading slash from endpoint
    const cleanEndpoint = endpoint.replace(/^\//, '');

    // Add query params if present
    let url = `${this.baseUrl}/${cleanEndpoint}`;

    return url;
  }

  /**
   * Parse response based on type
   */
  private async parseResponse<T>(
    response: Response,
    responseType: 'json' | 'text' | 'stream' = 'json'
  ): Promise<T> {
    switch (responseType) {
      case 'json':
        return await response.json();
      case 'text':
        return await response.text() as T;
      case 'stream':
        return response.body as T;
      default:
        return await response.json();
    }
  }

  /**
   * Create error from response
   */
  private createErrorFromResponse(response: Response, data: any): MediaGenError {
    let message = response.statusText;
    let code = 'http_error';

    // Try to extract error message from response body
    if (data && typeof data === 'object') {
      if (data.error) {
        message = typeof data.error === 'string' ? data.error : data.error.message;
      } else if (data.message) {
        message = data.message;
      }
    }

    // Categorize error types
    if (response.status === 401 || response.status === 403) {
      code = 'auth_error';
    } else if (response.status === 429) {
      code = 'rate_limit_error';
    } else if (response.status >= 500) {
      code = 'server_error';
    } else if (response.status >= 400) {
      code = 'client_error';
    }

    return new MediaGenError(
      message,
      code,
      {
        status: response.status,
        response: data,
      }
    );
  }

  /**
   * Parse fetch headers to plain object
   */
  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};

    headers.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }

  /**
   * Set default timeout
   */
  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * Update base URL
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }
}
