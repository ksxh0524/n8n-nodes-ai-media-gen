/**
 * Provider Factory
 * Creates provider instances
 */

import { IProvider } from '../interfaces/IProvider';
import { ProviderRegistry } from '../registry/ProviderRegistry';
import { ICredentials } from '../../types/core.types';
import { MediaGenError } from '../../errors/MediaGenError';

/**
 * Factory for creating provider instances
 */
export class ProviderFactory {
  private static registry: ProviderRegistry = ProviderRegistry.getInstance();

  /**
   * Create a provider instance
   * @param providerName - Name of the provider
   * @param credentials - Provider credentials
   * @returns Provider instance
   */
  static async create(providerName: string, credentials?: ICredentials): Promise<IProvider> {
    const provider = this.registry.getProvider(providerName);

    if (!provider) {
      throw new MediaGenError(
        `Provider "${providerName}" not found. Available providers: ${this.registry.getProviderNames().join(', ')}`,
        'provider_not_found'
      );
    }

    if (credentials) {
      await provider.authenticate(credentials);
    }

    return provider;
  }

  /**
   * Create multiple provider instances
   * @param providerConfigs - Array of provider configs with credentials
   * @returns Map of provider name to instance
   */
  static async createMany(
    providerConfigs: Array<{ name: string; credentials: ICredentials }>
  ): Promise<Map<string, IProvider>> {
    const providers = new Map<string, IProvider>();

    for (const config of providerConfigs) {
      const provider = await this.create(config.name, config.credentials);
      providers.set(config.name, provider);
    }

    return providers;
  }

  /**
   * Check if a provider exists
   * @param providerName - Name of the provider
   * @returns True if provider exists
   */
  static hasProvider(providerName: string): boolean {
    return this.registry.hasProvider(providerName);
  }

  /**
   * Get all available provider names
   * @returns Array of provider names
   */
  static getAvailableProviders(): string[] {
    return this.registry.getProviderNames();
  }

  /**
   * Get provider info without creating instance
   * @param providerName - Name of the provider
   * @returns Provider config or undefined
   */
  static getProviderInfo(providerName: string): any {
    return this.registry.getProviderConfig(providerName);
  }
}
