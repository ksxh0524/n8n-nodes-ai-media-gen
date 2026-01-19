/**
 * AI Media Generation Node
 * Unified node for OpenAI, Gemini, Bailian, and Doubao
 */

import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
} from 'n8n-workflow';

import { OpenAIClient } from './clients/OpenAIClient';
import { GeminiClient } from './clients/GeminiClient';
import { BailianClient } from './clients/BailianClient';
import { DoubaoClient } from './clients/DoubaoClient';
import { createLogger } from './utils/Logger';

export class AIMediaGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI Media Generation',
		name: 'aiMediaGen',
		icon: 'file:ai-media-gen.svg',
		iconColor: '#FF6B6B',
		group: ['transform'],
		version: [1],
		defaultVersion: 1,
		description: 'Generate images, videos, and audio using OpenAI, Gemini, Bailian, or Doubao',
		defaults: {
			name: 'AI Media Gen',
		},
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		subtitle: '={{$parameter.provider + " - " + $parameter.operation}}',
		notes: [
			'Supports OpenAI (DALL-E, Sora, TTS), Gemini (Imagen), Bailian (WanX, FLUX), Doubao',
			'Configure API credentials in node properties',
			'Supports Tool mode for AI Agents',
		],
		properties: [
			{
				displayName: 'Provider',
				name: 'provider',
				type: 'options',
				required: true,
				default: 'openai',
				description: 'Select the AI service provider',
				options: [
					{
						name: 'OpenAI',
						value: 'openai',
						description: 'DALL-E, Sora, TTS',
					},
					{
						name: 'Gemini (Google)',
						value: 'gemini',
						description: 'Imagen image generation',
					},
					{
						name: 'Bailian (Alibaba)',
						value: 'bailian',
						description: 'WanX, FLUX, Sambert TTS',
					},
					{
						name: 'Doubao (ByteDance)',
						value: 'doubao',
						description: 'Image generation, TTS',
					},
				],
			},
			{
				displayName: 'API Key',
				name: 'apiKey',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						provider: ['openai', 'gemini', 'bailian', 'doubao'],
					},
				},
				description: 'API key for the selected provider',
			},
			{
				displayName: 'Base URL (Optional)',
				name: 'baseUrl',
				type: 'string',
				default: '',
				required: false,
				displayOptions: {
					show: {
						provider: ['openai', 'gemini', 'bailian', 'doubao'],
					},
				},
				description: 'Custom API base URL (for proxy or self-hosted)',
				placeholder: 'https://api.openai.com/v1',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				required: true,
				default: 'generateImage',
				description: 'Select the operation to perform',
				options: [
					{
						name: 'Generate Image',
						value: 'generateImage',
						description: 'Generate images from text',
						action: 'Generate image',
					},
					{
						name: 'Generate Audio',
						value: 'generateAudio',
						description: 'Generate audio from text (TTS)',
						action: 'Generate audio',
					},
					{
						name: 'Generate Video',
						value: 'generateVideo',
						description: 'Generate videos from text',
						action: 'Generate video',
					},
				],
			},
			// === OpenAI Image Options ===
			{
				displayName: 'Model',
				name: 'openaiImageModel',
				type: 'options',
				default: 'dall-e-3',
				required: true,
				displayOptions: {
					show: {
						provider: ['openai'],
						operation: ['generateImage'],
					},
				},
				options: [
					{ name: 'DALL-E 3', value: 'dall-e-3' },
					{ name: 'DALL-E 2', value: 'dall-e-2' },
				],
			},
			{
				displayName: 'Size',
				name: 'openaiImageSize',
				type: 'options',
				default: '1024x1024',
				displayOptions: {
					show: {
						provider: ['openai'],
						operation: ['generateImage'],
						openaiImageModel: ['dall-e-3'],
					},
				},
				options: [
					{ name: '1024x1024', value: '1024x1024' },
					{ name: '1792x1024 (Landscape)', value: '1792x1024' },
					{ name: '1024x1792 (Portrait)', value: '1024x1792' },
				],
			},
			{
				displayName: 'Size',
				name: 'openaiImageSize',
				type: 'options',
				default: '1024x1024',
				displayOptions: {
					show: {
						provider: ['openai'],
						operation: ['generateImage'],
						openaiImageModel: ['dall-e-2'],
					},
				},
				options: [
					{ name: '256x256', value: '256x256' },
					{ name: '512x512', value: '512x512' },
					{ name: '1024x1024', value: '1024x1024' },
				],
			},
			{
				displayName: 'Quality',
				name: 'openaiImageQuality',
				type: 'options',
				default: 'standard',
				displayOptions: {
					show: {
						provider: ['openai'],
						operation: ['generateImage'],
						openaiImageModel: ['dall-e-3'],
					},
				},
				options: [
					{ name: 'Standard', value: 'standard' },
					{ name: 'HD', value: 'hd' },
				],
			},
			{
				displayName: 'Style',
				name: 'openaiImageStyle',
				type: 'options',
				default: 'vivid',
				displayOptions: {
					show: {
						provider: ['openai'],
						operation: ['generateImage'],
						openaiImageModel: ['dall-e-3'],
					},
				},
				options: [
					{ name: 'Vivid', value: 'vivid' },
					{ name: 'Natural', value: 'natural' },
				],
			},
			// === Gemini Image Options ===
			{
				displayName: 'Model',
				name: 'geminiImageModel',
				type: 'options',
				default: 'imagen-2.0',
				displayOptions: {
					show: {
						provider: ['gemini'],
						operation: ['generateImage'],
					},
				},
				options: [
					{ name: 'Imagen 2.0', value: 'imagen-2.0' },
					{ name: 'Imagen 3.0', value: 'imagen-3.0' },
				],
			},
			{
				displayName: 'Aspect Ratio',
				name: 'geminiAspectRatio',
				type: 'options',
				default: '1:1',
				displayOptions: {
					show: {
						provider: ['gemini'],
						operation: ['generateImage'],
					},
				},
				options: [
					{ name: '1:1 (Square)', value: '1:1' },
					{ name: '16:9 (Landscape)', value: '16:9' },
					{ name: '9:16 (Portrait)', value: '9:16' },
					{ name: '4:3', value: '4:3' },
					{ name: '3:4', value: '3:4' },
				],
			},
			// === Bailian Image Options ===
			{
				displayName: 'Model',
				name: 'bailianImageModel',
				type: 'options',
				default: 'wanx-v1',
				displayOptions: {
					show: {
						provider: ['bailian'],
						operation: ['generateImage'],
					},
				},
				options: [
					{ name: 'WanX V1', value: 'wanx-v1' },
					{ name: 'FLUX Schnell', value: 'flux-schnell' },
					{ name: 'FLUX Pro', value: 'flux-pro' },
				],
			},
			{
				displayName: 'Size',
				name: 'bailianImageSize',
				type: 'options',
				default: '1024*1024',
				displayOptions: {
					show: {
						provider: ['bailian'],
						operation: ['generateImage'],
					},
				},
				options: [
					{ name: '1024*1024', value: '1024*1024' },
					{ name: '768*1024', value: '768*1024' },
					{ name: '1024*768', value: '1024*768' },
					{ name: '512*512', value: '512*512' },
				],
			},
			// === Doubao Image Options ===
			{
				displayName: 'Model',
				name: 'doubaoImageModel',
				type: 'options',
				default: 'doubao-v1',
				displayOptions: {
					show: {
						provider: ['doubao'],
						operation: ['generateImage'],
					},
				},
				options: [
					{ name: 'Doubao V1', value: 'doubao-v1' },
					{ name: 'Doubao V2', value: 'doubao-v2' },
				],
			},
			{
				displayName: 'Size',
				name: 'doubaoImageSize',
				type: 'options',
				default: '1024x1024',
				displayOptions: {
					show: {
						provider: ['doubao'],
						operation: ['generateImage'],
					},
				},
				options: [
					{ name: '1024x1024', value: '1024x1024' },
					{ name: '768x1024', value: '768x1024' },
					{ name: '1024x768', value: '1024x768' },
					{ name: '512x512', value: '512x512' },
				],
			},
			// === Audio Options (OpenAI TTS) ===
			{
				displayName: 'Model',
				name: 'openaiAudioModel',
				type: 'options',
				default: 'tts-1',
				displayOptions: {
					show: {
						provider: ['openai'],
						operation: ['generateAudio'],
					},
				},
				options: [
					{ name: 'TTS-1', value: 'tts-1' },
					{ name: 'TTS-1 HD', value: 'tts-1-hd' },
				],
			},
			{
				displayName: 'Voice',
				name: 'openaiAudioVoice',
				type: 'options',
				default: 'alloy',
				displayOptions: {
					show: {
						provider: ['openai'],
						operation: ['generateAudio'],
					},
				},
				options: [
					{ name: 'Alloy', value: 'alloy' },
					{ name: 'Echo', value: 'echo' },
					{ name: 'Fable', value: 'fable' },
					{ name: 'Onyx', value: 'onyx' },
					{ name: 'Nova', value: 'nova' },
					{ name: 'Shimmer', value: 'shimmer' },
				],
			},
			{
				displayName: 'Speed',
				name: 'openaiAudioSpeed',
				type: 'number',
				default: 1.0,
				displayOptions: {
					show: {
						provider: ['openai'],
						operation: ['generateAudio'],
					},
				},
				description: 'Speed of the audio (0.25 to 4.0)',
			},
			// === Common Prompts ===
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['generateImage', 'generateVideo'],
					},
				},
				description: 'Text description for generation',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['generateAudio'],
					},
				},
				description: 'Text to convert to speech',
			},
			// === Binary Output Options ===
			{
				displayName: 'Output Binary Key',
				name: 'outputBinaryKey',
				type: 'string',
				default: 'data',
				description: 'Property name for binary data (e.g., "data", "image", "audio")',
			},
			{
				displayName: 'Download Binary',
				name: 'downloadBinary',
				type: 'boolean',
				default: true,
				description: 'Download and return binary data. Disable to return only URLs.',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const logger = createLogger(this);
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		// Get parameters
		const provider = this.getNodeParameter('provider', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const apiKey = this.getNodeParameter('apiKey', 0) as string;
		const baseUrl = this.getNodeParameter('baseUrl', 0) as string || undefined;
		const outputBinaryKey = this.getNodeParameter('outputBinaryKey', 0) as string || 'data';
		const downloadBinary = this.getNodeParameter('downloadBinary', 0) as boolean !== false;

		logger.info(`Executing ${provider} ${operation}`, {
			provider,
			operation,
			downloadBinary,
		});

		for (const item of items) {
			try {
				let result: any;

				// Route to appropriate provider and operation
				if (provider === 'openai') {
					result = await this.executeOpenAI(operation, downloadBinary);
				} else if (provider === 'gemini') {
					result = await this.executeGemini(operation, downloadBinary);
				} else if (provider === 'bailian') {
					result = await this.executeBailian(operation, downloadBinary);
				} else if (provider === 'doubao') {
					result = await this.executeDoubao(operation, downloadBinary);
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown provider: ${provider}`);
				}

				if (!result.success) {
					throw new NodeOperationError(this.getNode(), `Generation failed: ${result.error}`);
				}

				// Prepare output
				const outputData: INodeExecutionData = {
					json: {
						success: true,
						provider,
						operation,
						...result.metadata,
					},
				};

				// Add binary data if available and requested
				if (result.data && downloadBinary) {
					outputData.binary = {
						[outputBinaryKey]: {
							data: result.data.toString('base64'),
							mimeType: result.mimeType,
							fileName: this.generateFileName(result.mimeType, provider),
						},
					};
				} else if (result.url && downloadBinary) {
					// Download file from URL
					try {
						let client;
						if (provider === 'openai') {
							client = new OpenAIClient({ apiKey, baseUrl }, this.helpers, logger);
						} else if (provider === 'gemini') {
							client = new GeminiClient({ apiKey, baseUrl }, this.helpers, logger);
						} else if (provider === 'bailian') {
							client = new BailianClient({ apiKey, baseUrl }, this.helpers, logger);
						} else if (provider === 'doubao') {
							client = new DoubaoClient({ apiKey, baseUrl }, this.helpers, logger);
						}

						const data = await (client as any).downloadFile(result.url);
						outputData.binary = {
							[outputBinaryKey]: {
								data: data.toString('base64'),
								mimeType: result.mimeType,
								fileName: this.generateFileName(result.mimeType, provider),
							},
						};
						outputData.json.url = result.url;
					} catch (error) {
						logger.warn('Failed to download file, returning URL only', { error });
						outputData.json.url = result.url;
					}
				} else if (result.url) {
					outputData.json.url = result.url;
				}

				results.push(outputData);
			} catch (error: any) {
				logger.error('Item processing failed', error);
				throw error;
			}
		}

		return [this.helpers.constructExecutionMetaData(results, { itemData: { item: 0 } })];
	}

	private async executeOpenAI(operation: string, downloadBinary: boolean): Promise<any> {
		const logger = createLogger(this);
		const apiKey = this.getNodeParameter('apiKey', 0) as string;
		const baseUrl = this.getNodeParameter('baseUrl', 0) as string || undefined;

		const client = new OpenAIClient({ apiKey, baseUrl }, this.helpers, logger);

		if (operation === 'generateImage') {
			const model = this.getNodeParameter('openaiImageModel', 0) as 'dall-e-2' | 'dall-e-3';
			const size = this.getNodeParameter('openaiImageSize', 0) as any;
			const quality = this.getNodeParameter('openaiImageQuality', 0) as any;
			const style = this.getNodeParameter('openaiImageStyle', 0) as any;
			const prompt = this.getNodeParameter('prompt', 0) as string;

			return await client.generateImage({
				prompt,
				model,
				size,
				quality,
				style,
			});
		} else if (operation === 'generateAudio') {
			const model = this.getNodeParameter('openaiAudioModel', 0) as any;
			const voice = this.getNodeParameter('openaiAudioVoice', 0) as any;
			const speed = this.getNodeParameter('openaiAudioSpeed', 0) as number;
			const text = this.getNodeParameter('text', 0) as string;

			return await client.generateAudio({
				input: text,
				model,
				voice,
				speed,
			});
		} else if (operation === 'generateVideo') {
			const prompt = this.getNodeParameter('prompt', 0) as string;

			return await client.generateVideo({
				prompt,
				model: 'sora',
			});
		}

		throw new Error(`Unknown operation: ${operation}`);
	}

	private async executeGemini(operation: string, downloadBinary: boolean): Promise<any> {
		const logger = createLogger(this);
		const apiKey = this.getNodeParameter('apiKey', 0) as string;
		const baseUrl = this.getNodeParameter('baseUrl', 0) as string || undefined;

		const client = new GeminiClient({ apiKey, baseUrl }, this.helpers, logger);

		if (operation === 'generateImage') {
			const model = this.getNodeParameter('geminiImageModel', 0) as any;
			const aspectRatio = this.getNodeParameter('geminiAspectRatio', 0) as any;
			const prompt = this.getNodeParameter('prompt', 0) as string;

			return await client.generateImage({
				prompt,
				model,
				aspectRatio,
			});
		}

		throw new Error(`Gemini does not support operation: ${operation}`);
	}

	private async executeBailian(operation: string, downloadBinary: boolean): Promise<any> {
		const logger = createLogger(this);
		const apiKey = this.getNodeParameter('apiKey', 0) as string;
		const baseUrl = this.getNodeParameter('baseUrl', 0) as string || undefined;

		const client = new BailianClient({ apiKey, baseUrl }, this.helpers, logger);

		if (operation === 'generateImage') {
			const model = this.getNodeParameter('bailianImageModel', 0) as any;
			const size = this.getNodeParameter('bailianImageSize', 0) as any;
			const prompt = this.getNodeParameter('prompt', 0) as string;

			return await client.generateImage({
				prompt,
				model,
				size,
			});
		} else if (operation === 'generateAudio') {
			// TODO: Implement Bailian TTS
			throw new Error('Bailian TTS not yet implemented');
		}

		throw new Error(`Bailian does not support operation: ${operation}`);
	}

	private async executeDoubao(operation: string, downloadBinary: boolean): Promise<any> {
		const logger = createLogger(this);
		const apiKey = this.getNodeParameter('apiKey', 0) as string;
		const baseUrl = this.getNodeParameter('baseUrl', 0) as string || undefined;

		const client = new DoubaoClient({ apiKey, baseUrl }, this.helpers, logger);

		if (operation === 'generateImage') {
			const model = this.getNodeParameter('doubaoImageModel', 0) as any;
			const size = this.getNodeParameter('doubaoImageSize', 0) as any;
			const prompt = this.getNodeParameter('prompt', 0) as string;

			return await client.generateImage({
				prompt,
				model,
				size,
			});
		} else if (operation === 'generateAudio') {
			const text = this.getNodeParameter('text', 0) as string;

			return await client.generateSpeech({
				text,
			});
		}

		throw new Error(`Doubao does not support operation: ${operation}`);
	}

	private generateFileName(mimeType: string, provider: string): string {
		const timestamp = Date.now();
		const ext = mimeType.includes('png') ? 'png' :
		             mimeType.includes('jpeg') ? 'jpg' :
		             mimeType.includes('mp4') ? 'mp4' :
		             mimeType.includes('mp3') ? 'mp3' : 'bin';
		return `${provider}_${timestamp}.${ext}`;
	}
}
