/**
 * Provider Registry
 * Singleton registry for all providers
 */

import { IProvider } from '../interfaces/IProvider';
import { IProviderConfig } from '../../types/core.types';
import { MediaGenError } from '../../errors/MediaGenError';

/**
 * Singleton registry for managing providers
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, IProvider> = new Map();
  private configs: Map<string, IProviderConfig> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Register a provider
   * @param provider - Provider instance
   */
  registerProvider(provider: IProvider): void {
    if (this.providers.has(provider.name)) {
      throw new MediaGenError(
        `Provider "${provider.name}" is already registered`,
        'duplicate_provider'
      );
    }

    this.providers.set(provider.name, provider);
    this.configs.set(provider.name, provider.config);
  }

  /**
   * Register a provider config for later instantiation
   * @param config - Provider configuration
   */
  registerConfig(config: IProviderConfig): void {
    if (this.configs.has(config.name)) {
      throw new MediaGenError(
        `Provider config "${config.name}" is already registered`,
        'duplicate_provider'
      );
    }

    this.configs.set(config.name, config);
  }

  /**
   * Register multiple providers
   * @param providers - Array of provider instances
   */
  registerProviders(providers: IProvider[]): void {
    for (const provider of providers) {
      this.registerProvider(provider);
    }
  }

  /**
   * Unregister a provider
   * @param providerName - Name of the provider
   */
  unregisterProvider(providerName: string): void {
    this.providers.delete(providerName);
    this.configs.delete(providerName);
  }

  /**
   * Get a provider by name
   * @param providerName - Name of the provider
   * @returns Provider instance or undefined
   */
  getProvider(providerName: string): IProvider | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Get provider config
   * @param providerName - Name of the provider
   * @returns Provider config or undefined
   */
  getProviderConfig(providerName: string): IProviderConfig | undefined {
    return this.configs.get(providerName);
  }

  /**
   * Check if a provider is registered
   * @param providerName - Name of the provider
   * @returns True if provider exists
   */
  hasProvider(providerName: string): boolean {
    return this.providers.has(providerName);
  }

  /**
   * Get all registered provider names
   * @returns Array of provider names
   */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get all registered providers
   * @returns Array of provider instances
   */
  getAllProviders(): IProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all provider configs
   * @returns Array of provider configs
   */
  getAllConfigs(): IProviderConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    this.providers.clear();
    this.configs.clear();
  }

  /**
   * Get count of registered providers
   * @returns Number of registered providers
   */
  get count(): number {
    return this.providers.size;
  }
}
