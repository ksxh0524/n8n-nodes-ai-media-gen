/**
 * Example Provider for Framework Validation
 * Demonstrates how to implement a provider
 */

import { BaseProvider } from '../../core/base/BaseProvider';
import { IProviderConfig } from '../../types/core.types';
import { ExampleImageModel } from './models/ExampleImageModel';
import { MediaGenError } from '../../errors/MediaGenError';

/**
 * Example Provider Implementation
 */
export class ExampleProvider extends BaseProvider {
  constructor() {
    const config: IProviderConfig = {
      name: 'example',
      displayName: 'Example Provider',
      type: 'commercial',
      baseUrl: 'https://api.example.com/v1',
      credentialsType: 'api-key',
      rateLimits: {
        requestsPerMinute: 60,
      },
    };

    super(config);

    // Register available models
    this.registerModel(new ExampleImageModel(this));
  }

  /**
   * Authenticate with the example provider
   */
  async authenticate(credentials: { apiKey: string }): Promise<void> {
    if (!credentials.apiKey) {
      throw new MediaGenError('API key is required', 'auth_error');
    }

    // Simulate authentication
    this.credentials = credentials;

    // Validate credentials by making a test request
    try {
      const isValid = await this.healthCheck();
      if (!isValid) {
        throw new MediaGenError('Invalid API key', 'auth_error');
      }
    } catch (error) {
      throw new MediaGenError('Authentication failed', 'auth_error', { error });
    }
  }

  /**
   * Health check for the provider
   */
  async healthCheck(): Promise<boolean> {
    try {
      // In a real implementation, this would make an actual API call
      // For demo purposes, we'll just check if credentials are set
      return !!this.credentials?.apiKey;
    } catch {
      return false;
    }
  }

  /**
   * Get authentication headers
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      'X-API-Key': this.credentials?.apiKey || '',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Example method to get rate limit info
   */
  async getRateLimits(): Promise<{
    remaining: number;
    reset: Date;
    limit: number;
  }> {
    // In a real implementation, this would fetch from the API
    return {
      remaining: 60,
      reset: new Date(Date.now() + 60000),
      limit: 60,
    };
  }
}
