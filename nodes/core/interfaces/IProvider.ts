/**
 * Provider interface
 * All AI service providers must implement this interface
 */

import {
  ICredentials,
  IRequestOptions,
  IRequestResponse,
  IProviderConfig,
} from '../../types/core.types';
import { IModel } from './IModel';

/**
 * Provider interface for AI service providers
 */
export interface IProvider {
  /**
   * Provider unique identifier
   */
  readonly name: string;

  /**
   * Human-readable display name
   */
  readonly displayName: string;

  /**
   * Provider configuration
   */
  readonly config: IProviderConfig;

  /**
   * Authenticate with the provider using credentials
   * @param credentials - Provider credentials
   */
  authenticate(credentials: ICredentials): Promise<void>;

  /**
   * Make an HTTP request to the provider API
   * @param endpoint - API endpoint path
   * @param options - Request options
   * @returns Response data
   */
  request<T>(endpoint: string, options: IRequestOptions): Promise<IRequestResponse<T>>;

  /**
   * Get all available models from this provider
   * @returns Array of available models
   */
  getAvailableModels(): IModel[];

  /**
   * Get a specific model by ID
   * @param modelId - Model identifier
   * @returns Model instance or undefined if not found
   */
  getModel(modelId: string): IModel | undefined;

  /**
   * Check if the provider is healthy and accessible
   * @returns True if provider is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Register a model with this provider
   * @param model - Model instance to register
   */
  registerModel(model: IModel): void;

  /**
   * Unregister a model from this provider
   * @param modelId - Model identifier
   */
  unregisterModel(modelId: string): void;

  /**
   * Check if a model is supported
   * @param modelId - Model identifier
   * @returns True if model is supported
   */
  hasModel(modelId: string): boolean;

  /**
   * Get provider-specific rate limit information
   * @returns Rate limit data or undefined
   */
  getRateLimits?: () => Promise<{
    remaining: number;
    reset: Date;
    limit: number;
  } | undefined>;
}
