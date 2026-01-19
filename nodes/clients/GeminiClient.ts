/**
 * Gemini Client
 * Handles all Google Gemini API interactions
 */

import { IExecuteFunctions } from 'n8n-workflow';
import { Logger } from '../utils/Logger';

export interface GeminiConfig {
	apiKey: string;
	baseUrl?: string;
	timeout?: number;
}

export interface ImageGenerationOptions {
	prompt: string;
	model?: 'imagen-2.0' | 'imagen-3.0';
	aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
	numberOfImages?: number;
	safetyFilterLevel?: 'block_some' | 'block_most' | 'block_few';
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
 * Gemini API Client
 */
export class GeminiClient {
	private config: GeminiConfig;
	private logger: Logger;
	private helpers: IExecuteFunctions['helpers'];

	constructor(config: GeminiConfig, helpers: IExecuteFunctions['helpers'], logger: Logger) {
		this.config = config;
		this.helpers = helpers;
		this.logger = logger;
	}

	/**
	 * Generate image using Imagen
	 */
	async generateImage(options: ImageGenerationOptions): Promise<GenerationResult> {
		try {
			this.logger.info('Generating image with Imagen', {
				model: options.model || 'imagen-2.0',
				prompt: options.prompt.substring(0, 50),
			});

			// Gemini API uses Imagen for image generation
			const baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
			const model = options.model || 'imagen-2.0';
			const endpoint = `/models/${model}:predictImage`;

			const url = `${baseUrl}${endpoint}?key=${this.config.apiKey}`;

			const requestBody = {
				prompt: {
					text: options.prompt,
				},
				safetySettings: [
					{
											category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
						threshold: options.safetyFilterLevel || 'block_some',
					},
					{
						category: 'HARM_CATEGORY_HATE_SPEECH',
						threshold: options.safetyFilterLevel || 'block_some',
					},
					{
						category: 'HARM_CATEGORY_HARASSMENT',
						threshold: options.safetyFilterLevel || 'block_some',
					},
					{
						category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
						threshold: options.safetyFilterLevel || 'block_some',
					},
				],
				imageGenerationConfig: {
					numberOfImages: options.numberOfImages || 1,
					aspectRatio: options.aspectRatio || '1:1',
					negativePrompt: '',
				},
			};

			const response = await this.helpers.httpRequest({
				method: 'POST',
				url,
				headers: {
					'Content-Type': 'application/json',
				},
				body: requestBody,
				json: true,
			});

			if (response.error) {
				throw new Error(`Gemini API error: ${response.error.message}`);
			}

			const generatedImages = response.generatedImages || [];
			if (generatedImages.length === 0) {
				throw new Error('No images generated');
			}

			const imageData = generatedImages[0];

			this.logger.info('Image generated successfully', {
				model,
				imageCount: generatedImages.length,
			});

			return {
				success: true,
				data: Buffer.from(imageData.bytesBase64Encoded, 'base64'),
				mimeType: 'image/png',
				metadata: {
					provider: 'gemini',
					model,
					aspectRatio: requestBody.imageGenerationConfig.aspectRatio,
					imageCount: generatedImages.length,
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
