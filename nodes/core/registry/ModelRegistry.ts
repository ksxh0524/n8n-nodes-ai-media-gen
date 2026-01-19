/**
 * Model Registry
 * Registry for all models across providers
 */

import { IModel } from '../interfaces/IModel';
import { MediaType } from '../../types/core.types';

/**
 * Registry for managing models
 */
export class ModelRegistry {
  private static instance: ModelRegistry;
  private models: Map<string, IModel> = new Map();
  private modelsByProvider: Map<string, Set<string>> = new Map();
  private modelsByType: Map<MediaType, Set<string>> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  /**
   * Register a model
   * @param model - Model instance
   */
  registerModel(model: IModel): void {
    const key = `${model.provider}.${model.id}`;

    if (this.models.has(key)) {
      console.warn(`Model "${key}" is already registered, skipping`);
      return;
    }

    this.models.set(key, model);

    // Index by provider
    if (!this.modelsByProvider.has(model.provider)) {
      this.modelsByProvider.set(model.provider, new Set());
    }
    this.modelsByProvider.get(model.provider)!.add(model.id);

    // Index by type
    if (!this.modelsByType.has(model.type)) {
      this.modelsByType.set(model.type, new Set());
    }
    this.modelsByType.get(model.type)!.add(key);
  }

  /**
   * Register multiple models
   * @param models - Array of model instances
   */
  registerModels(models: IModel[]): void {
    for (const model of models) {
      this.registerModel(model);
    }
  }

  /**
   * Unregister a model
   * @param providerName - Provider name
   * @param modelId - Model ID
   */
  unregisterModel(providerName: string, modelId: string): void {
    const key = `${providerName}.${modelId}`;

    this.models.delete(key);

    // Remove from provider index
    const providerModels = this.modelsByProvider.get(providerName);
    if (providerModels) {
      providerModels.delete(modelId);
    }

    // Remove from type index
    const model = this.models.get(key);
    if (model) {
      const typeModels = this.modelsByType.get(model.type);
      if (typeModels) {
        typeModels.delete(key);
      }
    }
  }

  /**
   * Get a model
   * @param providerName - Provider name
   * @param modelId - Model ID
   * @returns Model instance or undefined
   */
  getModel(providerName: string, modelId: string): IModel | undefined {
    const key = `${providerName}.${modelId}`;
    return this.models.get(key);
  }

  /**
   * Get all models from a provider
   * @param providerName - Provider name
   * @returns Array of model instances
   */
  getModelsByProvider(providerName: string): IModel[] {
    const modelIds = this.modelsByProvider.get(providerName);
    if (!modelIds) {
      return [];
    }

    return Array.from(modelIds)
      .map((id) => this.models.get(`${providerName}.${id}`))
      .filter((model) => model !== undefined) as IModel[];
  }

  /**
   * Get all models of a specific type
   * @param mediaType - Media type
   * @returns Array of model instances
   */
  getModelsByType(mediaType: MediaType): IModel[] {
    const modelKeys = this.modelsByType.get(mediaType);
    if (!modelKeys) {
      return [];
    }

    return Array.from(modelKeys)
      .map((key) => this.models.get(key))
      .filter((model) => model !== undefined) as IModel[];
  }

  /**
   * Get all registered models
   * @returns Array of all model instances
   */
  getAllModels(): IModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Check if a model exists
   * @param providerName - Provider name
   * @param modelId - Model ID
   * @returns True if model exists
   */
  hasModel(providerName: string, modelId: string): boolean {
    const key = `${providerName}.${modelId}`;
    return this.models.has(key);
  }

  /**
   * Get model IDs for a provider
   * @param providerName - Provider name
   * @returns Array of model IDs
   */
  getModelIds(providerName: string): string[] {
    const modelIds = this.modelsByProvider.get(providerName);
    return modelIds ? Array.from(modelIds) : [];
  }

  /**
   * Clear all registered models
   */
  clear(): void {
    this.models.clear();
    this.modelsByProvider.clear();
    this.modelsByType.clear();
  }

  /**
   * Get count of registered models
   * @returns Number of registered models
   */
  get count(): number {
    return this.models.size;
  }

  /**
   * Get statistics
   * @returns Object with registry statistics
   */
  getStats(): {
    total: number;
    byProvider: Record<string, number>;
    byType: Record<MediaType, number>;
  } {
    const byProvider: Record<string, number> = {};
    const byType: Record<string, number> = {
      image: 0,
      video: 0,
      audio: 0,
    };

    for (const [provider, modelIds] of this.modelsByProvider.entries()) {
      byProvider[provider] = modelIds.size;
    }

    for (const [type, modelKeys] of this.modelsByType.entries()) {
      byType[type] = modelKeys.size;
    }

    return {
      total: this.models.size,
      byProvider,
      byType: byType as Record<MediaType, number>,
    };
  }
}
