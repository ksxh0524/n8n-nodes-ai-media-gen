/**
 * Providers configuration
 * Central registry of all AI service providers
 */

import { IProviderConfig } from '../types/core.types';

/**
 * Provider configurations
 * Add new providers here
 */
export const PROVIDERS_CONFIG: Record<string, IProviderConfig> = {
  // Example provider for framework validation
  example: {
    name: 'example',
    displayName: 'Example Provider',
    type: 'commercial',
    baseUrl: 'https://api.example.com/v1',
    credentialsType: 'api-key',
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 90000,
    },
  },

  // OpenAI (to be implemented)
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    type: 'commercial',
    baseUrl: 'https://api.openai.com/v1',
    credentialsType: 'api-key',
    rateLimits: {
      requestsPerMinute: 500,
      tokensPerMinute: 150000,
    },
  },

  // Stability AI (to be implemented)
  stability: {
    name: 'stability',
    displayName: 'Stability AI',
    type: 'commercial',
    baseUrl: 'https://api.stability.ai/v1',
    credentialsType: 'api-key',
    rateLimits: {
      requestsPerMinute: 100,
    },
  },

  // ElevenLabs (to be implemented)
  elevenlabs: {
    name: 'elevenlabs',
    displayName: 'ElevenLabs',
    type: 'commercial',
    baseUrl: 'https://api.elevenlabs.io/v1',
    credentialsType: 'api-key',
    rateLimits: {
      requestsPerMinute: 60,
    },
  },

  // Replicate (to be implemented)
  replicate: {
    name: 'replicate',
    displayName: 'Replicate',
    type: 'commercial',
    baseUrl: 'https://api.replicate.com/v1',
    credentialsType: 'api-key',
    rateLimits: {
      requestsPerMinute: 60,
    },
  },

  // Hugging Face (to be implemented)
  huggingface: {
    name: 'huggingface',
    displayName: 'Hugging Face',
    type: 'commercial',
    baseUrl: 'https://api-inference.huggingface.co',
    credentialsType: 'api-key',
    rateLimits: {},
  },

  // Midjourney (to be implemented - via Discord API)
  midjourney: {
    name: 'midjourney',
    displayName: 'Midjourney',
    type: 'commercial',
    baseUrl: 'https://discord.com/api/v10',
    credentialsType: 'custom',
    rateLimits: {
      requestsPerMinute: 50,
    },
  },

  // Self-hosted / Custom provider
  custom: {
    name: 'custom',
    displayName: 'Custom Provider',
    type: 'self-hosted',
    baseUrl: 'http://localhost:8080',
    credentialsType: 'api-key',
    rateLimits: {},
  },
};

/**
 * Get provider configuration
 */
export function getProviderConfig(providerName: string): IProviderConfig | undefined {
  return PROVIDERS_CONFIG[providerName];
}

/**
 * Get all provider configurations
 */
export function getAllProviderConfigs(): IProviderConfig[] {
  return Object.values(PROVIDERS_CONFIG);
}

/**
 * Get providers by type
 */
export function getProvidersByType(type: 'commercial' | 'open-source' | 'self-hosted'): IProviderConfig[] {
  return Object.values(PROVIDERS_CONFIG).filter(p => p.type === type);
}

/**
 * Get provider names
 */
export function getProviderNames(): string[] {
  return Object.keys(PROVIDERS_CONFIG);
}
