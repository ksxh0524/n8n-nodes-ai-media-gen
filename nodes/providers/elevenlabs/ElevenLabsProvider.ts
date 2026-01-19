/**
 * ElevenLabs Provider
 * Implements ElevenLabs API integration for text-to-speech
 */

import { BaseProvider } from '../../core/base/BaseProvider';
import { IProviderConfig } from '../../types/core.types';
import { ElevenLabsTTS } from './models/ElevenLabsTTS';

/**
 * ElevenLabs Provider Implementation
 */
export class ElevenLabsProvider extends BaseProvider {
  constructor() {
    const config: IProviderConfig = {
      name: 'elevenlabs',
      displayName: 'ElevenLabs',
      type: 'commercial',
      baseUrl: 'https://api.elevenlabs.io/v1',
      credentialsType: 'api-key',
      rateLimits: {
        requestsPerMinute: 60,
      },
    };

    super(config);

    // Register all available models
    this.registerModel(new ElevenLabsTTS(this));
  }

  /**
   * Authenticate with ElevenLabs
   */
  async authenticate(credentials: { apiKey: string }): Promise<void> {
    if (!credentials.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }

    this.credentials = credentials;

    // Verify credentials by making a test request
    try {
      const response = await this.request('/user', {
        method: 'GET',
      });

      if (response.status !== 200) {
        throw new Error('Invalid ElevenLabs API key');
      }
    } catch (error: any) {
      throw new Error(`ElevenLabs authentication failed: ${error.message}`);
    }
  }

  /**
   * Get authentication headers
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      'xi-api-key': this.credentials?.apiKey || '',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request('/user', {
        method: 'GET',
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get rate limit info
   */
  async getRateLimits(): Promise<{
    remaining: number;
    reset: Date;
    limit: number;
  }> {
    try {
      const response = await this.request<any>('/user/subscription', {
        method: 'GET',
      });

      const subscription = response.data;
      const remaining = subscription.character_count || 0;
      const limit = subscription.character_limit || 10000;

      return {
        remaining: Math.max(0, limit - remaining),
        reset: new Date(Date.now() + 86400000), // Reset monthly
        limit,
      };
    } catch {
      return {
        remaining: 0,
        reset: new Date(Date.now() + 86400000),
        limit: 10000,
      };
    }
  }
}
