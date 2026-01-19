/**
 * Alibaba Bailian Client
 * Handles all Alibaba Bailian (阿里百炼) API interactions
 */

import { IExecuteFunctions } from 'n8n-workflow';
import { Logger } from '../utils/Logger';

export interface BailianConfig {
	apiKey: string;
	baseUrl?: string;
	timeout?: number;
}

export interface ImageGenerationOptions {
	prompt: string;
	model?: 'wanx-v1' | 'flux-schnell' | 'flux-pro';
	size?: '1024*1024' | '768*1024' | '1024*768' | '512*512';
	n?: number;
	seed?: number;
}

export interface TextToSpeechOptions {
	text: string;
	model?: 'sambert-zhichu-v1' | 'sambert-zhichu-v2';
	voice?: 'zhichu' | 'zhihui' | 'xiaoyun' | 'xiaofen';
	sampleRate?: number;
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
 * Alibaba Bailian API Client
 */
export class BailianClient {
	private config: BailianConfig;
	private logger: Logger;
	private helpers: IExecuteFunctions['helpers'];

	constructor(config: BailianConfig, helpers: IExecuteFunctions['helpers'], logger: Logger) {
		this.config = config;
		this.helpers = helpers;
		this.logger = logger;
	}

	/**
	 * Generate image using WanX or FLUX
	 */
	async generateImage(options: ImageGenerationOptions): Promise<GenerationResult> {
		try {
			this.logger.info('Generating image with Bailian', {
				model: options.model || 'wanx-v1',
				prompt: options.prompt.substring(0, 50),
			});

			const baseUrl = this.config.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';
			const endpoint = '/services/aigc/text2image/image-synthesis';

			const model = options.model || 'wanx-v1';

			const requestBody = {
				model,
				input: {
					prompt: options.prompt,
				},
				parameters: {
					size: options.size || '1024*1024',
					n: options.n || 1,
					seed: options.seed,
				},
			};

			const response = await this.helpers.httpRequest({
				method: 'POST',
				url: baseUrl + endpoint,
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.config.apiKey}`,
					'X-DashScope-Async': 'enable',
				},
				body: requestBody,
				json: true,
			});

			if (response.code && response.code !== '200') {
				throw new Error(`Bailian API error: ${response.message || 'Unknown error'}`);
			}

			// Bailian returns async task info
			const taskId = response.output?.task_id;

			if (!taskId) {
				throw new Error('No task ID in response');
			}

			this.logger.info('Image generation task submitted', { taskId });

			// Poll for result
			const result = await this.pollTask(taskId);

			return {
				success: true,
				url: result.url,
				mimeType: 'image/png',
				metadata: {
					provider: 'bailian',
					model,
					taskId,
					size: requestBody.parameters.size,
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
	 * Generate speech using Sambert
	 */
	async generateSpeech(options: TextToSpeechOptions): Promise<GenerationResult> {
		try {
			this.logger.info('Generating speech with Sambert', {
				model: options.model || 'sambert-zhichu-v1',
				voice: options.voice || 'zhichu',
			});

			const baseUrl = this.config.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';
			const endpoint = '/services/aigc/text2speech/synthesis';

			const model = options.model || 'sambert-zhichu-v1';

			const requestBody = {
				model,
				input: {
					text: options.text,
				},
				parameters: {
					voice: options.voice || 'zhichu',
					sample_rate: options.sampleRate || 22050,
				},
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
				voice: requestBody.parameters.voice,
				size: response.length,
			});

			return {
				success: true,
				data: response,
				mimeType: 'audio/mp3',
				metadata: {
					provider: 'bailian',
					model,
					voice: requestBody.parameters.voice,
					sampleRate: requestBody.parameters.sample_rate,
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
	 * Poll async task result
	 */
	private async pollTask(taskId: string, maxWaitTime: number = 300): Promise<any> {
		const startTime = Date.now();
		const baseUrl = this.config.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';

		this.logger.info('Polling for task result', { taskId });

		while (Date.now() - startTime < maxWaitTime * 1000) {
			try {
				const response = await this.helpers.httpRequest({
					method: 'GET',
					url: `${baseUrl}/tasks/${taskId}`,
					headers: {
						'Authorization': `Bearer ${this.config.apiKey}`,
					},
					json: true,
				});

				const status = response.output?.task_status;

				if (status === 'SUCCEEDED' || status === 'succeeded') {
					this.logger.info('Task completed successfully', { taskId });
					return {
						url: response.output?.results?.[0]?.url,
					};
				}

				if (status === 'FAILED' || status === 'failed') {
					throw new Error(`Task failed: ${response.output?.message || 'Unknown error'}`);
				}

				// Still processing, wait before next poll
				await new Promise(resolve => setTimeout(resolve, 2000));
			} catch (error: any) {
				this.logger.error('Polling failed', { taskId, error: error.message });
				throw error;
			}
		}

		throw new Error('Task timeout - maximum wait time exceeded');
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
