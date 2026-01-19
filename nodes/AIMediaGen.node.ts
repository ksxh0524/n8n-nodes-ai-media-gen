/**
 * AI Media Generation Node
 * Simple API wrapper - no validation, no error handling, just API calls
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
		properties: [
			{
				displayName: 'Provider',
				name: 'provider',
				type: 'options',
				required: true,
				default: 'openai',
				options: [
					{ name: 'OpenAI', value: 'openai' },
					{ name: 'Gemini', value: 'gemini' },
					{ name: 'Bailian (阿里百炼)', value: 'bailian' },
					{ name: 'Doubao (豆包)', value: 'doubao' },
				],
			},
			{
				displayName: 'API Key',
				name: 'apiKey',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: true,
			},
			{
				displayName: 'Base URL',
				name: 'baseUrl',
				type: 'string',
				default: '',
				required: false,
				placeholder: 'https://api.openai.com/v1',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				required: true,
				default: 'text2Image',
				options: [
					{ name: 'Text to Image', value: 'text2Image' },
					{ name: 'Text to Audio', value: 'text2Audio' },
					{ name: 'Text to Video', value: 'text2Video' },
				],
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'dall-e-3',
				required: true,
				description: 'Model name (e.g., dall-e-3, imagen-2.0, wanx-v1, etc.)',
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				displayOptions: {
					show: {
						operation: ['text2Image', 'text2Video'],
					},
				},
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				displayOptions: {
					show: {
						operation: ['text2Audio'],
					},
				},
			},
			{
				displayName: 'Request Body (JSON)',
				name: 'requestBody',
				type: 'string',
				typeOptions: { rows: 10 },
				default: '{}',
				description: 'Additional parameters as JSON object',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		for (const _item of items) {
			const provider = this.getNodeParameter('provider', 0) as string;
			const apiKey = this.getNodeParameter('apiKey', 0) as string;
			let baseUrl = this.getNodeParameter('baseUrl', 0) as string;
			const operation = this.getNodeParameter('operation', 0) as string;
			const model = this.getNodeParameter('model', 0) as string;
			const prompt = this.getNodeParameter('prompt', 0) as string;
			const text = this.getNodeParameter('text', 0) as string;
			const requestBodyJson = this.getNodeParameter('requestBody', 0) as string;

			// Set default base URLs
			if (!baseUrl) {
				baseUrl = getDefaultBaseUrl(provider);
			}

			// Parse additional parameters
			let additionalParams = {};
			try {
				additionalParams = JSON.parse(requestBodyJson || '{}');
			} catch (e) {
				// Ignore JSON parse errors
			}

			// Build request
			const endpoint = getEndpoint(provider, operation);
			const body = buildRequestBody(provider, operation, model, prompt || text, additionalParams);

			// Make API call
			const response = await this.helpers.httpRequest({
				method: 'POST',
				url: baseUrl + endpoint,
				headers: getHeaders(provider, apiKey),
				body,
				json: true,
			});

			// Return response
			results.push({
				json: response,
			});
		}

		return [this.helpers.constructExecutionMetaData(results, { itemData: { item: 0 } })];
	}
}

function getDefaultBaseUrl(provider: string): string {
	const defaults: Record<string, string> = {
		openai: 'https://api.openai.com/v1',
		gemini: 'https://generativelanguage.googleapis.com/v1beta',
		bailian: 'https://dashscope.aliyuncs.com/api/v1',
		doubao: 'https://ark.cn-beijing.volces.com/api/v3',
	};
	return defaults[provider] || '';
}

function getEndpoint(provider: string, operation: string): string {
	if (provider === 'openai') {
		if (operation === 'text2Image') return '/images/generations';
		if (operation === 'text2Audio') return '/audio/speech';
		if (operation === 'text2Video') return '/videos/generations';
	}
	if (provider === 'gemini') {
		return '/models/imagen-2.0:predictImage';
	}
	if (provider === 'bailian') {
		if (operation === 'text2Image') return '/services/aigc/text2image/image-synthesis';
	}
	if (provider === 'doubao') {
		if (operation === 'text2Image') return '/images/generations';
		if (operation === 'text2Audio') return '/audio/speech';
	}
	return '';
}

function getHeaders(provider: string, apiKey: string): Record<string, string> {
	if (provider === 'gemini') {
		return { 'Content-Type': 'application/json' };
	}
	return {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${apiKey}`,
	};
}

function buildRequestBody(provider: string, operation: string, model: string, text: string, additional: any): any {
	if (provider === 'openai') {
		if (operation === 'text2Image') {
			return {
				model,
				prompt: text,
				...additional,
			};
		}
		if (operation === 'text2Audio') {
			return {
				model,
				input: text,
				...additional,
			};
		}
	}
	if (provider === 'gemini') {
		return {
			prompt: { text },
			...additional,
		};
	}
	if (provider === 'bailian') {
		return {
			model,
			input: { prompt: text },
			parameters: additional,
		};
	}
	if (provider === 'doubao') {
		return {
			model,
			prompt: text,
			...additional,
		};
	}
	return { model, prompt: text, ...additional };
}
