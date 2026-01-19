/**
 * Audio generation specific types
 */

import { IGenerationParameters, IGenerationResult, IModelCapabilities } from './core.types';

/**
 * Audio generation parameters
 */
export interface IAudioGenerationParameters extends IGenerationParameters {
  prompt: string;
  text?: string; // For TTS
  voice?: string;
  duration?: number; // in seconds
  format?: 'mp3' | 'wav' | 'opus' | 'aac';
  sampleRate?: number;
  bitrate?: number;
  language?: string;
  speed?: number; // 0.25 to 4.0
  seed?: number;
}

/**
 * Audio generation result
 */
export interface IAudioGenerationResult extends IGenerationResult {
  audio: Array<{
    url: string;
    duration: number;
    format: string;
    mimeType: string;
    sizeBytes?: number;
    sampleRate?: number;
    bitrate?: number;
    seed?: number;
  }>;
}

/**
 * TTS parameters
 */
export interface ITTSParameters extends IAudioGenerationParameters {
  text: string;
  voice: string;
  speed?: number;
  pitch?: number;
  emotion?: string;
}

/**
 * Music generation parameters
 */
export interface IMusicGenerationParameters extends IAudioGenerationParameters {
  prompt: string;
  genre?: string;
  mood?: string;
  tempo?: number;
  duration?: number;
  instruments?: string[];
}

/**
 * Audio model capabilities
 */
export interface IAudioModelCapabilities extends IModelCapabilities {
  supportedFormats: string[];
  supportedSampleRates: number[];
  supportedVoices?: string[]; // For TTS
  supportsTextToSpeech: boolean;
  supportsMusicGeneration: boolean;
  supportsSoundEffects: boolean;
  supportsSpeedControl: boolean;
  supportsPitchControl: boolean;
  maxDuration: number; // in seconds
}

/**
 * Audio format presets
 */
export type AudioFormat = 'mp3' | 'wav' | 'opus' | 'aac' | 'flac';

/**
 * Sample rate presets
 */
export type AudioSampleRate = 8000 | 16000 | 22050 | 44100 | 48000 | 96000;

/**
 * Common emotions for TTS
 */
export type TTSEmotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'excited' | 'calm';
