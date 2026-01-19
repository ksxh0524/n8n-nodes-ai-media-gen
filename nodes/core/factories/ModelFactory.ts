/**
 * Model Factory
 * Creates model instances through providers
 */

import { IModel } from '../interfaces/IModel';
import { IProvider } from '../interfaces/IProvider';
import { ProviderFactory } from './ProviderFactory';
import { MediaGenError } from '../../errors/MediaGenError';
import { MediaType } from '../../types/core.types';

/**
 * Factory for creating/accessing model instances
 */
export class ModelFactory {
  /**
   * Get a model from a provider
   * @param providerName - Name of the provider
   * @param modelId - Model identifier
   * @param credentials - Provider credentials (optional if provider already authenticated)
   * @returns Model instance
   */
  static async create(
    providerName: string,
    modelId: string,
    credentials?: any
  ): Promise<IModel> {
    let provider: IProvider;

    if (credentials) {
      provider = await ProviderFactory.create(providerName, credentials);
    } else {
      if (!ProviderFactory.hasProvider(providerName)) {
        throw new MediaGenError(
          `Provider "${providerName}" not found`,
          'provider_not_found'
        );
      }
      provider = await ProviderFactory.create(providerName);
    }

    const model = provider.getModel(modelId);

    if (!model) {
      const availableModels = provider.getAvailableModels().map((m) => m.id);
      throw new MediaGenError(
        `Model "${modelId}" not found in provider "${providerName}". Available models: ${availableModels.join(', ')}`,
        'model_not_found'
      );
    }

    return model;
  }

  /**
   * Get all available models from all providers
   * @returns Array of model instances
   */
  static async getAllModels(credentialsMap?: Record<string, any>): Promise<IModel[]> {
    const models: IModel[] = [];
    const providerNames = ProviderFactory.getAvailableProviders();

    for (const providerName of providerNames) {
      try {
        const credentials = credentialsMap?.[providerName];
        const provider = await ProviderFactory.create(providerName, credentials);
        const providerModels = provider.getAvailableModels();
        models.push(...providerModels);
      } catch (error) {
        // Skip providers that fail to initialize
        console.warn(`Failed to load models from provider "${providerName}":`, error);
      }
    }

    return models;
  }

  /**
   * Get models by media type
   * @param mediaType - Type of media (image, video, audio)
   * @param credentialsMap - Optional credentials for providers
   * @returns Array of models of the specified type
   */
  static async getModelsByType(
    mediaType: MediaType,
    credentialsMap?: Record<string, any>
  ): Promise<IModel[]> {
    const allModels = await this.getAllModels(credentialsMap);
    return allModels.filter((model) => model.type === mediaType);
  }

  /**
   * Get models by provider
   * @param providerName - Name of the provider
   * @param credentials - Provider credentials
   * @returns Array of models from the provider
   */
  static async getModelsByProvider(
    providerName: string,
    credentials?: any
  ): Promise<IModel[]> {
    const provider = await ProviderFactory.create(providerName, credentials);
    return provider.getAvailableModels();
  }

  /**
   * Search for models by name or capability
   * @param query - Search query
   * @param credentialsMap - Optional credentials for providers
   * @returns Array of matching models
   */
  static async searchModels(
    query: string,
    credentialsMap?: Record<string, any>
  ): Promise<IModel[]> {
    const allModels = await this.getAllModels(credentialsMap);
    const lowerQuery = query.toLowerCase();

    return allModels.filter(
      (model) =>
        model.id.toLowerCase().includes(lowerQuery) ||
        model.displayName.toLowerCase().includes(lowerQuery) ||
        model.provider.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Validate if a model is available
   * @param providerName - Name of the provider
   * @param modelId - Model identifier
   * @returns True if model exists
   */
  static async modelExists(providerName: string, modelId: string): Promise<boolean> {
    try {
      const provider = await ProviderFactory.create(providerName);
      return provider.hasModel(modelId);
    } catch {
      return false;
    }
  }
}
