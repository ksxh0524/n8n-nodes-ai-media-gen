/**
 * Video generation specific types
 */

import { IGenerationParameters, IGenerationResult, IModelCapabilities } from './core.types';

/**
 * Video generation parameters
 */
export interface IVideoGenerationParameters extends IGenerationParameters {
  prompt: string;
  negativePrompt?: string;
  duration?: number; // in seconds
  fps?: number;
  resolution?: string;
  aspectRatio?: string;
  style?: string;
  seed?: number;
  format?: 'mp4' | 'webm' | 'mov';
}

/**
 * Video generation result
 */
export interface IVideoGenerationResult extends IGenerationResult {
  videos: Array<{
    url: string;
    duration: number;
    fps: number;
    resolution: string;
    mimeType: string;
    sizeBytes?: number;
    seed?: number;
  }>;
}

/**
 * Video-to-video parameters
 */
export interface IVideoToVideoParameters {
  inputVideo: Buffer | string;
  prompt: string;
  strength?: number; // 0-1, how much to transform
  duration?: number;
}

/**
 * Image-to-video parameters
 */
export interface IImageToVideoParameters {
  image: Buffer | string;
  prompt: string;
  duration?: number;
  motion?: string;
  fps?: number;
}

/**
 * Video model capabilities
 */
export interface IVideoModelCapabilities extends IModelCapabilities {
  supportedDurations: number[];
  supportedResolutions: string[];
  supportedFps: number[];
  supportsImageToVideo: boolean;
  supportsVideoToVideo: boolean;
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  maxDuration: number; // in seconds
  maxResolution: string;
}

/**
 * Video aspect ratios
 */
export type VideoAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

/**
 * Video resolution presets
 */
export type VideoResolution = '480p' | '720p' | '1080p' | '4K';

/**
 * Video motion presets
 */
export type VideoMotionPreset = 'slow' | 'medium' | 'fast' | 'dynamic' | 'smooth';
