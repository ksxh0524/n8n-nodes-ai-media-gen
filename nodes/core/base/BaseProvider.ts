/**
 * Base Provider class
 * Provides common functionality for all providers
 */

import { IProvider } from '../interfaces/IProvider';
import { IModel } from '../interfaces/IModel';
import { ICredentials, IRequestOptions, IRequestResponse, IProviderConfig } from '../../types/core.types';
import { RequestHelper } from '../utils/RequestHelper';
import { MediaGenError } from '../../errors/MediaGenError';

/**
 * Abstract base class for all providers
 */
export abstract class BaseProvider implements IProvider {
  readonly name: string;
  readonly displayName: string;
  readonly config: IProviderConfig;
  protected credentials?: ICredentials;
  protected models: Map<string, IModel> = new Map();
  protected requestHelper: RequestHelper;

  constructor(config: IProviderConfig) {
    this.name = config.name;
    this.displayName = config.displayName;
    this.config = config;
    this.requestHelper = new RequestHelper(config.baseUrl);
  }

  /**
   * Authenticate with the provider
   * Override in subclass for provider-specific auth
   */
  async authenticate(credentials: ICredentials): Promise<void> {
    this.credentials = credentials;
    // Default: simple API key validation
    if (!credentials.apiKey) {
      throw new MediaGenError('API key is required', 'auth_error');
    }
    await this.healthCheck();
  }

  /**
   * Make an HTTP request to the provider
   */
  async request<T>(endpoint: string, options: IRequestOptions): Promise<IRequestResponse<T>> {
    if (!this.credentials) {
      throw new MediaGenError('Provider not authenticated', 'auth_error');
    }

    // Add authentication headers
    const headers = {
      ...options.headers,
      ...this.getAuthHeaders(),
    };

    return this.requestHelper.request<T>(endpoint, {
      ...options,
      headers,
    });
  }

  /**
   * Get authentication headers
   * Override in subclass for custom auth
   */
  protected getAuthHeaders(): Record<string, string> {
    if (!this.credentials?.apiKey) {
      return {};
    }
    return {
      Authorization: `Bearer ${this.credentials.apiKey}`,
    };
  }

  /**
   * Get all available models
   */
  getAvailableModels(): IModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Get a specific model by ID
   */
  getModel(modelId: string): IModel | undefined {
    return this.models.get(modelId);
  }

  /**
   * Health check - override in subclass
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request('/health', {
        method: 'GET',
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Register a model
   */
  registerModel(model: IModel): void {
    this.models.set(model.id, model);
  }

  /**
   * Unregister a model
   */
  unregisterModel(modelId: string): void {
    this.models.delete(modelId);
  }

  /**
   * Check if a model is supported
   */
  hasModel(modelId: string): boolean {
    return this.models.has(modelId);
  }

  /**
   * Get rate limits - override in subclass if provider supports it
   */
  async getRateLimits?(): Promise<{
    remaining: number;
    reset: Date;
    limit: number;
  } | undefined> {
    return undefined;
  }
}
