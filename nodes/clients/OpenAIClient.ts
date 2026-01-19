/**
 * OpenAI Client
 * Handles all OpenAI API interactions (DALL-E, Sora, TTS)
 */

import { IExecuteFunctions } from 'n8n-workflow';
import { Logger } from '../utils/Logger';

export interface OpenAIConfig {
	apiKey: string;
	organizationId?: string;
	baseUrl?: string;
	timeout?: number;
}

export interface ImageGenerationOptions {
	prompt: string;
	model: 'dall-e-2' | 'dall-e-3';
	size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
	quality?: 'standard' | 'hd';
	style?: 'vivid' | 'natural';
	n?: number;
}

export interface AudioGenerationOptions {
	input: string;
	model: 'tts-1' | 'tts-1-hd';
	voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
	speed?: number;
}

export interface VideoGenerationOptions {
	prompt: string;
	model: 'sora';
	duration?: number;
	aspect_ratio?: '16:9' | '9:16' | '1:1';
}

export interface GenerationResult {
	success: boolean;
	url?: string;
	data?: Buffer;
	mimeType?: string;
	metadata?: Record<string, any>;
	error?: string;
}

/**
 * OpenAI API Client
 */
export class OpenAIClient {
	private config: OpenAIConfig;
	private logger: Logger;
	private helpers: IExecuteFunctions['helpers'];

	constructor(config: OpenAIConfig, helpers: IExecuteFunctions['helpers'], logger: Logger) {
		this.config = config;
		this.helpers = helpers;
		this.logger = logger;
	}

	/**
	 * Generate image using DALL-E
	 */
	async generateImage(options: ImageGenerationOptions): Promise<GenerationResult> {
		try {
			this.logger.info('Generating image with DALL-E', { model: options.model, prompt: options.prompt.substring(0, 50) });

			const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
			const endpoint = '/images/generations';

			const requestBody = {
				model: options.model,
				prompt: options.prompt,
				size: options.size || '1024x1024',
				quality: options.quality || 'standard',
				n: options.n || 1,
			};

			if (options.model === 'dall-e-3') {
				requestBody.style = options.style || 'vivid';
			}

			const response = await this.makeRequest(endpoint, requestBody);

			if (response.error) {
				throw new Error(`OpenAI API error: ${response.error.message}`);
			}

			const imageData = response.data?.[0];
			if (!imageData) {
				throw new Error('No image data in response');
			}

			this.logger.info('Image generated successfully', {
				model: options.model,
				revisedPrompt: imageData.revised_prompt ? 'yes' : 'no',
			});

			return {
				success: true,
				url: imageData.url,
				mimeType: 'image/png',
				metadata: {
					provider: 'openai',
					model: options.model,
					size: requestBody.size,
					quality: requestBody.quality,
					revisedPrompt: imageData.revised_prompt,
				},
			};
		} catch (error: any) {
			this.logger.error('Image generation failed', error);
			return {
				success: false,
				error: error.message || 'Unknown error',
			};
		}
	}

	/**
	 * Generate audio using TTS
	 */
	async generateAudio(options: AudioGenerationOptions): Promise<GenerationResult> {
		try {
			this.logger.info('Generating audio with TTS', { model: options.model, voice: options.voice });

			const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
			const endpoint = '/audio/speech';

			const requestBody = {
				model: options.model,
				input: options.input,
				voice: options.voice,
				speed: options.speed || 1.0,
			};

			// Audio endpoint returns binary data
			const response = await this.makeBinaryRequest(endpoint, requestBody);

			this.logger.info('Audio generated successfully', {
				model: options.model,
				voice: options.voice,
				size: response.length,
			});

			return {
				success: true,
				data: response,
				mimeType: 'audio/mp3',
				metadata: {
					provider: 'openai',
					model: options.model,
					voice: options.voice,
					speed: requestBody.speed,
				},
			};
		} catch (error: any) {
			this.logger.error('Audio generation failed', error);
			return {
				success: false,
				error: error.message || 'Unknown error',
			};
		}
	}

	/**
	 * Generate video using Sora
	 */
	async generateVideo(options: VideoGenerationOptions): Promise<GenerationResult> {
		try {
			this.logger.info('Generating video with Sora', { prompt: options.prompt.substring(0, 50) });

			// Sora API - endpoint might vary, check OpenAI docs
			const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
			const endpoint = '/videos/generations';

			const requestBody = {
				model: options.model,
				prompt: options.prompt,
				duration: options.duration || 10,
				aspect_ratio: options.aspect_ratio || '16:9',
			};

			const response = await this.makeRequest(endpoint, requestBody);

			if (response.error) {
				throw new Error(`OpenAI API error: ${response.error.message}`);
			}

			const videoData = response.data?.[0];
			if (!videoData) {
				throw new Error('No video data in response');
			}

			this.logger.info('Video generation initiated', {
				id: videoData.id,
				status: videoData.status,
			});

			// Sora might return async task info
			return {
				success: true,
				url: videoData.url,
				mimeType: 'video/mp4',
				metadata: {
					provider: 'openai',
					model: options.model,
					taskId: videoData.id,
					status: videoData.status,
					duration: requestBody.duration,
					aspectRatio: requestBody.aspect_ratio,
				},
			};
		} catch (error: any) {
			this.logger.error('Video generation failed', error);
			return {
				success: false,
				error: error.message || 'Unknown error',
			};
		}
	}

	/**
	 * Make HTTP request to OpenAI API (JSON response)
	 */
	private async makeRequest(endpoint: string, body: any): Promise<any> {
		const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
		const url = baseUrl + endpoint;

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${this.config.apiKey}`,
		};

		if (this.config.organizationId) {
			headers['OpenAI-Organization'] = this.config.organizationId;
		}

		const response = await this.helpers.httpRequest({
			method: 'POST',
			url,
			headers,
			body,
			json: true,
		});

		return response;
	}

	/**
	 * Make HTTP request to OpenAI API (binary response)
	 */
	private async makeBinaryRequest(endpoint: string, body: any): Promise<Buffer> {
		const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
		const url = baseUrl + endpoint;

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${this.config.apiKey}`,
		};

		if (this.config.organizationId) {
			headers['OpenAI-Organization'] = this.config.organizationId;
		}

		const response = await this.helpers.httpRequest({
			method: 'POST',
			url,
			headers,
			body,
			encoding: null, // Get binary response
			responseType: 'buffer',
		});

		return response;
	}

	/**
	 * Download file from URL
	 */
	async downloadFile(url: string): Promise<Buffer> {
		this.logger.info('Downloading file', { url });

		const response = await this.helpers.httpRequest({
			method: 'GET',
			url,
			encoding: null,
			responseType: 'buffer',
		});

		return response;
	}
}
