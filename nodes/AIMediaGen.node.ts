/**
 * AI Media Generation Node
 * Simple API wrapper with 3 credential types and auto media type detection
 */

import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
} from 'n8n-workflow';

export class AIMediaGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI Media Generation',
		name: 'aiMediaGen',
		icon: 'file:ai-media-gen.svg',
		group: ['transform'],
		version: 1,
		description: 'Generate images, videos, and audio using AI APIs',
		defaults: {
			name: 'AI Media Gen',
		},
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'aiMediaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'dall-e-3',
				required: true,
				description: 'Model name (e.g., dall-e-3, imagen-2.0, wanx-v1, flux-schnell, tts-1, sora)',
				placeholder: 'dall-e-3',
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				required: true,
				description: 'Text prompt for generation',
			},
			{
				displayName: 'Additional Parameters (JSON)',
				name: 'additionalParams',
				type: 'string',
				typeOptions: { rows: 8 },
				default: '{}',
				description: 'Additional parameters as JSON object (e.g., {"size": "1024x1024", "n": 1})',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		for (const _item of items) {
			const model = this.getNodeParameter('model', 0) as string;
			const prompt = this.getNodeParameter('prompt', 0) as string;
			const additionalParamsJson = this.getNodeParameter('additionalParams', 0) as string;

			// Parse additional parameters
			let additionalParams = {};
			try {
				additionalParams = JSON.parse(additionalParamsJson || '{}');
			} catch (e) {
				// Ignore JSON parse errors, use empty object
			}

			// Get credentials
			const credentials = await this.getCredentials('aiMediaApi');
			const apiFormat = credentials.apiFormat as string;
			const apiKey = credentials.apiKey as string;
			const baseUrl = credentials.baseUrl as string || getDefaultBaseUrl(apiFormat);

			// Auto-detect media type from model name
			const mediaType = detectMediaType(model);

			// Build request
			const endpoint = getEndpoint(apiFormat, mediaType, model);
			const headers = getHeaders(apiFormat, apiKey);
			const body = buildRequestBody(apiFormat, mediaType, model, prompt, additionalParams);

			// Make API call
			const response = await this.helpers.httpRequest({
				method: 'POST',
				url: baseUrl + endpoint,
				headers,
				body,
				json: true,
			});

			// Return response with metadata
			results.push({
				json: {
					...response,
					_metadata: {
						apiFormat,
						model,
						mediaType,
						timestamp: new Date().toISOString(),
					},
				},
			});
		}

		return [this.helpers.constructExecutionMetaData(results, { itemData: { item: 0 } })];
	}
}

/**
 * Detect media type from model name
 */
function detectMediaType(model: string): 'image' | 'audio' | 'video' {
	const modelLower = model.toLowerCase();

	// Video models
	if (modelLower.includes('sora') ||
		modelLower.includes('video') ||
		modelLower.includes('svd') ||
		modelLower.includes('cogvideo')) {
		return 'video';
	}

	// Audio models
	if (modelLower.includes('tts') ||
		modelLower.includes('audio') ||
		modelLower.includes('speech') ||
		modelLower.includes('voice') ||
		modelLower.includes('sambert')) {
		return 'audio';
	}

	// Default to image
	return 'image';
}

/**
 * Get default base URL for API format
 */
function getDefaultBaseUrl(apiFormat: string): string {
	const defaults: Record<string, string> = {
		openai: 'https://api.openai.com/v1',
		gemini: 'https://generativelanguage.googleapis.com/v1beta',
		bailian: 'https://dashscope.aliyuncs.com/api/v1',
	};
	return defaults[apiFormat] || '';
}

/**
 * Get API endpoint based on API format and media type
 */
function getEndpoint(apiFormat: string, mediaType: 'image' | 'audio' | 'video', model: string): string {
	if (apiFormat === 'openai') {
		if (mediaType === 'image') return '/images/generations';
		if (mediaType === 'audio') return '/audio/speech';
		if (mediaType === 'video') return '/videos/generations';
	}

	if (apiFormat === 'gemini') {
		// Gemini uses different endpoint format with model name
		return `/models/${model}:predictImage`;
	}

	if (apiFormat === 'bailian') {
		if (mediaType === 'image') return '/services/aigc/text2image/image-synthesis';
		if (mediaType === 'audio') return '/services/aigc/text2speech/synthesis';
		if (mediaType === 'video') return '/services/aigc/text2video/video-synthesis';
	}

	return '';
}

/**
 * Get request headers for API format
 */
function getHeaders(apiFormat: string, apiKey: string): Record<string, string> {
	if (apiFormat === 'gemini') {
		return {
			'Content-Type': 'application/json',
		};
	}

	return {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${apiKey}`,
	};
}

/**
 * Build request body based on API format and media type
 */
function buildRequestBody(
	apiFormat: string,
	mediaType: 'image' | 'audio' | 'video',
	model: string,
	prompt: string,
	additional: any
): any {
	if (apiFormat === 'openai') {
		const base: any = { model };

		if (mediaType === 'image') {
			base.prompt = prompt;
		} else if (mediaType === 'audio') {
			base.input = prompt;
		} else if (mediaType === 'video') {
			base.prompt = prompt;
		}

		return { ...base, ...additional };
	}

	if (apiFormat === 'gemini') {
		return {
			prompt: { text: prompt },
			...additional,
		};
	}

	if (apiFormat === 'bailian') {
		if (mediaType === 'image') {
			return {
				model,
				input: { prompt },
				parameters: additional,
			};
		}

		if (mediaType === 'audio') {
			return {
				model,
				input: { text: prompt },
				parameters: additional,
			};
		}

		if (mediaType === 'video') {
			return {
				model,
				input: { prompt },
				parameters: additional,
			};
		}
	}

	return { model, prompt, ...additional };
}
