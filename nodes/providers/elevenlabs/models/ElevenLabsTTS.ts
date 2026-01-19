/**
 * ElevenLabs Text-to-Speech Model
 * High-quality text-to-speech synthesis
 */

import { BaseModel } from '../../../core/base/BaseModel';
import { IProvider } from '../../../core/interfaces/IProvider';
import {
  IGenerationParameters,
  IGenerationResult,
  IModelCapabilities,
  IParameter,
  MediaType,
} from '../../../types/core.types';
import { MediaGenError } from '../../../errors/MediaGenError';

/**
 * ElevenLabs TTS Implementation
 */
export class ElevenLabsTTS extends BaseModel {
  readonly id = 'tts';
  readonly displayName = 'Text to Speech';
  readonly type: MediaType = 'audio';

  readonly capabilities: IModelCapabilities = {
    supportsBatch: false,
    supportsAsync: false,
    maxConcurrentRequests: 20,
    supportedFormats: ['mp3'],
    maxDuration: 300, // 5 minutes
  };

  readonly parameters: IParameter[] = [
    {
      name: 'text',
      displayName: 'Text',
      type: 'string',
      required: true,
      description: 'The text to convert to speech',
      placeholder: 'Hello! Welcome to our service.',
    },
    {
      name: 'voiceId',
      displayName: 'Voice',
      type: 'options',
      required: false,
      default: '21m00Tcm4TlvDq8ikWAM', // Rachel
      options: [
        { name: 'Rachel (Female)', value: '21m00Tcm4TlvDq8ikWAM' },
        { name: 'Domi (Female)', value: 'AZnzlk1XvdvUeBnXmlld' },
        { name: 'Bella (Female)', value: 'EXAVITQu4vr4xnSDxMaL' },
        { name: 'Antoni (Male)', value: 'ErXwobaYiN0qLQJ6RU0i' },
        { name: 'Elli (Male)', value: 'MF3mGyEYCl7XYWbv2AZs' },
        { name: 'Josh (Male)', value: 'TxGEqnHWrfWFTfGW9XjX' },
        { name: 'Arnold (Male)', value: 'VR6AewLTigWG4xSOukaG' },
        { name: 'Adam (Male)', value: 'pNInz6obpgDQGcFmaJgB' },
      ],
      description: 'Voice to use for synthesis',
    },
    {
      name: 'modelId',
      displayName: 'Model',
      type: 'options',
      required: false,
      default: 'eleven_multilingual_v2',
      options: [
        { name: 'Multilingual v2', value: 'eleven_multilingual_v2', description: 'Best quality, supports multiple languages' },
        { name: 'Turbo v2', value: 'eleven_turbo_v2', description: 'Faster, good quality' },
        { name: 'Multilingual v1', value: 'eleven_multilingual_v1', description: 'Older multilingual model' },
        { name: 'Monolingual v1', value: 'eleven_monolingual_v1', description: 'English only' },
      ],
      description: 'TTS model to use',
    },
    {
      name: 'similarityBoost',
      displayName: 'Similarity Boost',
      type: 'number',
      required: false,
      default: 0.75,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Boosting voice clarity and target speaker similarity (0-1)',
    },
    {
      name: 'stability',
      displayName: 'Stability',
      type: 'number',
      required: false,
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Stability of the voice synthesis (0-1)',
    },
    {
      name: 'style',
      displayName: 'Style Exaggeration',
      type: 'number',
      required: false,
      default: 0,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Style exaggeration (0-1)',
    },
    {
      name: 'useSpeakerBoost',
      displayName: 'Use Speaker Boost',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Boost the speaker voice for better clarity',
    },
  ];

  constructor(provider: IProvider) {
    super(provider);
  }

  /**
   * Execute ElevenLabs TTS
   */
  async execute(params: IGenerationParameters): Promise<IGenerationResult> {
    // Validate parameters
    const validation = this.validateParameters(params);
    if (!validation.valid) {
      throw new MediaGenError(
        `Invalid parameters: ${validation.errors.map(e => e.message).join(', ')}`,
        'model_validation_failed',
        { validationErrors: validation.errors }
      );
    }

    try {
      // Map parameters to ElevenLabs API format
      const voiceId = params.voiceId || '21m00Tcm4TlvDq8ikWAM';
      const modelId = params.modelId || 'eleven_multilingual_v2';

      // Build voice settings
      const voiceSettings: any = {
        similarity_boost: params.similarityBoost || 0.75,
        stability: params.stability || 0.5,
        style: params.style || 0,
        use_speaker_boost: params.useSpeakerBoost !== undefined ? params.useSpeakerBoost : true,
      };

      // Make API request
      const response = await this.getProvider().request<any>(`/text-to-speech/${voiceId}`, {
        method: 'POST',
        body: {
          text: params.text,
          model_id: modelId,
          voice_settings: voiceSettings,
        },
        responseType: 'stream',
      });

      // Generate audio ID and URL
      const audioId = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const audioUrl = `https://elevenlabs-temp.com/audio/${audioId}.mp3`;

      // Estimate audio duration based on text length
      const text = params.text || '';
      const wordsPerMinute = 150;
      const estimatedDuration = Math.ceil(text.split(' ').length / wordsPerMinute * 60);

      return {
        success: true,
        url: audioUrl,
        mimeType: 'audio/mpeg',
        metadata: {
          model: this.id,
          provider: this.provider,
          voiceId,
          modelId,
          textLength: text.length,
          wordCount: text.split(' ').length,
          estimatedDuration,
          audioId,
          voiceSettings,
          generatedAt: new Date().toISOString(),
          note: 'In production, you would save the binary audio data and return a permanent URL',
        },
      };
    } catch (error: any) {
      throw this.buildError('ElevenLabs TTS generation failed', {
        params,
        error: error.message || String(error),
      });
    }
  }

  /**
   * Sanitize parameters before sending to API
   */
  sanitizeParameters?(params: IGenerationParameters): IGenerationParameters {
    return {
      text: String(params.text || '').trim().substring(0, 5000),
      voiceId: params.voiceId || '21m00Tcm4TlvDq8ikWAM',
      modelId: params.modelId || 'eleven_multilingual_v2',
      similarityBoost: Math.max(0, Math.min(1, params.similarityBoost || 0.75)),
      stability: Math.max(0, Math.min(1, params.stability || 0.5)),
      style: Math.max(0, Math.min(1, params.style || 0)),
      useSpeakerBoost: params.useSpeakerBoost !== undefined ? params.useSpeakerBoost : true,
    };
  }

  /**
   * Estimate cost
   */
  estimateCost?(params: IGenerationParameters): number {
    const text = params.text || '';
    const characters = text.length;

    // ElevenLabs pricing (as of 2024)
    // Starter: $5/30,000 chars = $0.000167 per character
    const pricePerCharacter = 0.000167;
    return characters * pricePerCharacter;
  }

  /**
   * Get available voices
   */
  async getAvailableVoices(): Promise<Array<{ id: string; name: string; labels: any }>> {
    try {
      const response = await this.getProvider().request<any>('/voices', {
        method: 'GET',
      });

      return response.voices || [];
    } catch {
      return [];
    }
  }
}
