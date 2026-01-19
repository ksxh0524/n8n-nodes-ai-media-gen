/**
 * Models configuration
 * Central registry of all AI models
 */

import { IModelConfig } from '../types/core.types';

/**
 * Model configurations
 * Add new models here
 */
export const MODELS_CONFIG: Record<string, IModelConfig> = {
  // Example model for framework validation
  'example.imagegen': {
    id: 'imagegen',
    displayName: 'Example Image Generator',
    type: 'image',
    provider: 'example',
    capabilities: {
      supportsBatch: true,
      supportsAsync: false,
      maxConcurrentRequests: 3,
      supportedFormats: ['png', 'jpeg'],
      maxResolution: '1024x1024',
    },
  },

  // OpenAI Models
  'openai.dall-e-3': {
    id: 'dall-e-3',
    displayName: 'DALL-E 3',
    type: 'image',
    provider: 'openai',
    capabilities: {
      supportsBatch: false,
      supportsAsync: false,
      maxConcurrentRequests: 5,
      supportedFormats: ['png'],
      maxResolution: '1024x1024',
    },
  },

  'openai.dall-e-2': {
    id: 'dall-e-2',
    displayName: 'DALL-E 2',
    type: 'image',
    provider: 'openai',
    capabilities: {
      supportsBatch: true,
      supportsAsync: false,
      maxConcurrentRequests: 5,
      supportedFormats: ['png'],
      maxResolution: '1024x1024',
    },
  },

  'openai.sora': {
    id: 'sora',
    displayName: 'Sora',
    type: 'video',
    provider: 'openai',
    capabilities: {
      supportsBatch: false,
      supportsAsync: true,
      maxConcurrentRequests: 1,
      supportedFormats: ['mp4'],
      maxDuration: 60,
    },
  },

  'openai.tts-1': {
    id: 'tts-1',
    displayName: 'TTS-1',
    type: 'audio',
    provider: 'openai',
    capabilities: {
      supportsBatch: false,
      supportsAsync: false,
      maxConcurrentRequests: 10,
      supportedFormats: ['mp3'],
      maxDuration: 60,
    },
  },

  'openai.tts-1-hd': {
    id: 'tts-1-hd',
    displayName: 'TTS-1 HD',
    type: 'audio',
    provider: 'openai',
    capabilities: {
      supportsBatch: false,
      supportsAsync: false,
      maxConcurrentRequests: 10,
      supportedFormats: ['mp3'],
      maxDuration: 60,
    },
  },

  // Stability AI Models
  'stability.sdxl': {
    id: 'sdxl',
    displayName: 'Stable Diffusion XL',
    type: 'image',
    provider: 'stability',
    capabilities: {
      supportsBatch: true,
      supportsAsync: false,
      maxConcurrentRequests: 10,
      supportedFormats: ['png', 'jpeg'],
      maxResolution: '1024x1024',
    },
  },

  'stability.svd': {
    id: 'svd',
    displayName: 'Stable Video Diffusion',
    type: 'video',
    provider: 'stability',
    capabilities: {
      supportsBatch: true,
      supportsAsync: true,
      maxConcurrentRequests: 3,
      supportedFormats: ['mp4'],
      maxDuration: 4,
    },
  },

  // ElevenLabs Models
  'elevenlabs.tts': {
    id: 'tts',
    displayName: 'Text to Speech',
    type: 'audio',
    provider: 'elevenlabs',
    capabilities: {
      supportsBatch: false,
      supportsAsync: false,
      maxConcurrentRequests: 20,
      supportedFormats: ['mp3'],
      maxDuration: 300,
    },
  },

  'elevenlabs.ssd': {
    id: 'ssd',
    displayName: 'Speech to Speech',
    type: 'audio',
    provider: 'elevenlabs',
    capabilities: {
      supportsBatch: false,
      supportsAsync: false,
      maxConcurrentRequests: 10,
      supportedFormats: ['mp3'],
      maxDuration: 300,
    },
  },

  // Replicate Models (examples)
  'replicate.stable-diffusion': {
    id: 'stable-diffusion',
    displayName: 'Stable Diffusion',
    type: 'image',
    provider: 'replicate',
    capabilities: {
      supportsBatch: false,
      supportsAsync: true,
      maxConcurrentRequests: 5,
      supportedFormats: ['png', 'jpeg'],
      maxResolution: '1024x1024',
    },
  },
};

/**
 * Get model configuration
 */
export function getModelConfig(providerName: string, modelId: string): IModelConfig | undefined {
  const key = `${providerName}.${modelId}`;
  return MODELS_CONFIG[key];
}

/**
 * Get all model configurations
 */
export function getAllModelConfigs(): IModelConfig[] {
  return Object.values(MODELS_CONFIG);
}

/**
 * Get models by provider
 */
export function getModelsByProvider(providerName: string): IModelConfig[] {
  return Object.values(MODELS_CONFIG).filter(m => m.provider === providerName);
}

/**
 * Get models by type
 */
export function getModelsByType(type: 'image' | 'video' | 'audio'): IModelConfig[] {
  return Object.values(MODELS_CONFIG).filter(m => m.type === type);
}

/**
 * Get model names
 */
export function getModelKeys(): string[] {
  return Object.keys(MODELS_CONFIG);
}
