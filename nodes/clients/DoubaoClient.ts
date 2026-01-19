/**
 * Doubao Client
 * Handles all Doubao (字节跳动豆包) API interactions
 */

import { IExecuteFunctions } from 'n8n-workflow';
import { Logger } from '../utils/Logger';

export interface DoubaoConfig {
	apiKey: string;
	baseUrl?: string;
	timeout?: number;
}

export interface ImageGenerationOptions {
	prompt: string;
	model?: 'doubao-v1' | 'doubao-v2';
	size?: '1024x1024' | '768x1024' | '1024x768' | '512x512';
	steps?: number;
	cfg_scale?: number;
	seed?: number;
}

export interface TextToSpeechOptions {
	text: string;
	model?: 'doubao-tts-1' | 'doubao-tts-2';
	voice?: 'zh_female_shuangkuaisisi_moon_bigtts' | 'zh_male_zhiboshuai_moon_bigtts' | 'zh_female_wanwanxiao_moon_bigtts';
	speed?: number;
	pitch?: number;
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
 * Doubao API Client
 */
export class DoubaoClient {
	private config: DoubaoConfig;
	private logger: Logger;
	private helpers: IExecuteFunctions['helpers'];

	constructor(config: DoubaoConfig, helpers: IExecuteFunctions['helpers'], logger: Logger) {
		this.config = config;
		this.helpers = helpers;
		this.logger = logger;
	}

	/**
	 * Generate image using Doubao
	 */
	async generateImage(options: ImageGenerationOptions): Promise<GenerationResult> {
		try {
			this.logger.info('Generating image with Doubao', {
				model: options.model || 'doubao-v1',
				prompt: options.prompt.substring(0, 50),
			});

			const baseUrl = this.config.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
			const endpoint = '/images/generations';

			const model = options.model || 'doubao-v1';

			const requestBody = {
				model,
				prompt: options.prompt,
				size: options.size || '1024x1024',
				steps: options.steps || 20,
				cfg_scale: options.cfg_scale || 7,
				seed: options.seed,
			};

			const response = await this.helpers.httpRequest({
				method: 'POST',
				url: baseUrl + endpoint,
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.config.apiKey}`,
				},
				body: requestBody,
				json: true,
			});

			if (response.error) {
				throw new Error(`Doubao API error: ${response.error.message}`);
			}

			const imageData = response.data?.[0];
			if (!imageData) {
				throw new Error('No image data in response');
			}

			this.logger.info('Image generated successfully', {
				model,
				size: requestBody.size,
			});

			return {
				success: true,
				url: imageData.url,
				mimeType: 'image/png',
				metadata: {
					provider: 'doubao',
					model,
					size: requestBody.size,
					steps: requestBody.steps,
					cfgScale: requestBody.cfg_scale,
					seed: requestBody.seed,
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
	 * Generate speech using Doubao TTS
	 */
	async generateSpeech(options: TextToSpeechOptions): Promise<GenerationResult> {
		try {
			this.logger.info('Generating speech with Doubao TTS', {
				model: options.model || 'doubao-tts-1',
				voice: options.voice || 'zh_female_shuangkuaisisi_moon_bigtts',
			});

			const baseUrl = this.config.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
			const endpoint = '/audio/speech';

			const model = options.model || 'doubao-tts-1';

			const requestBody = {
				model,
				input: options.text,
				voice: options.voice || 'zh_female_shuangkuaisisi_moon_bigtts',
				speed: options.speed || 1.0,
				pitch: options.pitch || 1.0,
			};

			const response = await this.helpers.httpRequest({
				method: 'POST',
				url: baseUrl + endpoint,
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.config.apiKey}`,
				},
				body: requestBody,
				encoding: null,
				responseType: 'buffer',
			});

			this.logger.info('Speech generated successfully', {
				model,
				voice: requestBody.voice,
				size: response.length,
			});

			return {
				success: true,
				data: response,
				mimeType: 'audio/mp3',
				metadata: {
					provider: 'doubao',
					model,
					voice: requestBody.voice,
					speed: requestBody.speed,
					pitch: requestBody.pitch,
				},
			};
		} catch (error: any) {
			this.logger.error('Speech generation failed', error);
			return {
				success: false,
				error: error.message || 'Unknown error',
			};
		}
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
