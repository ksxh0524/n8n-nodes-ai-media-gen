/**
 * Image generation specific types
 */

import { IGenerationParameters, IGenerationResult, IModelCapabilities } from './core.types';

/**
 * Image generation parameters
 */
export interface IImageGenerationParameters extends IGenerationParameters {
  prompt: string;
  negativePrompt?: string;
  size?: string;
  width?: number;
  height?: number;
  quality?: string;
  style?: string;
  numberOfImages?: number;
  seed?: number;
  format?: 'png' | 'jpeg' | 'webp';
}

/**
 * Image generation result
 */
export interface IImageGenerationResult extends IGenerationResult {
  images: Array<{
    url: string;
    width: number;
    height: number;
    mimeType: string;
    sizeBytes?: number;
    seed?: number;
  }>;
}

/**
 * Image editing parameters
 */
export interface IImageEditParameters {
  image: Buffer | string;
  mask?: Buffer | string;
  prompt: string;
  size?: string;
  n?: number;
}

/**
 * Image variation parameters
 */
export interface IImageVariationParameters {
  image: Buffer | string;
  size?: string;
  n?: number;
}

/**
 * Image model capabilities
 */
export interface IImageModelCapabilities extends IModelCapabilities {
  supportedSizes: string[];
  supportsEdit: boolean;
  supportsVariations: boolean;
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  maxImagesPerRequest: number;
}

/**
 * Image generation style presets
 */
export type ImageStylePreset =
  | 'vivid'
  | 'natural'
  | 'cinematic'
  | 'anime'
  | 'photographic'
  | 'digital-art'
  | 'fantasy-art'
  | '3d-model'
  | 'comic-book';

/**
 * Common image sizes
 */
export type ImageSize =
  | '256x256'
  | '512x512'
  | '1024x1024'
  | '1792x1024'
  | '1024x1792'
  | '1024x768'
  | '768x1024';

/**
 * Image quality presets
 */
export type ImageQuality = 'standard' | 'hd' | 'ultra';
