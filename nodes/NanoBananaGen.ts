import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
} from 'n8n-workflow';
import { MediaGenError } from './utils/errors';

/**
 * Google Gemini API credentials (reused for Nano Banana)
 */
interface GoogleAiCredentials {
	/** API key from Google AI Studio or compatible service */
	apiKey: string;
	/** Optional custom base URL */
	baseUrl?: string;
}

/**
 * OpenAI DALL-E format image generation response
 */
interface DalleImage {
	b64_json?: string;
	url?: string;
	revised_prompt?: string;
}

interface DalleResponse {
	created: number;
	data: DalleImage[];
}

/**
 * Nano Banana Image Generation Node
 *
 * Generates and edits images using Google's Nano Banana AI model (Gemini 2.5 Flash Image)
 * through an OpenAI DALL-E compatible API.
 *
 * Features:
 * - Text-to-image generation
 * - Image-to-image editing
 * - Multiple aspect ratios
 * - 1K/2K/4K resolution support
 */
export class NanoBananaGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nano Banana Generation',
		name: 'nanoBananaGen',
		icon: 'file:ai-media-gen.svg',
		description: 'Generate and edit images using Google Nano Banana (Gemini 2.5 Flash) AI model',
		version: 1.0,
		group: ['transform'],
		subtitle: '={{$parameter.mode}}',
		defaults: {
			name: 'Nano Banana Generation',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'googleAi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				required: true,
				options: [
					{
						name: 'Text to Image',
						value: 'text-to-image',
						description: 'Generate images from text description',
					},
					{
						name: 'Image to Image',
						value: 'image-to-image',
						description: 'Edit images with text instructions',
					},
				],
				default: 'text-to-image',
				description: 'Select generation mode',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				required: true,
				options: [
					{
						name: 'Nano Banana (Standard)',
						value: 'nano-banana',
						description: 'Standard quality generation',
					},
					{
						name: 'Nano Banana HD',
						value: 'nano-banana-hd',
						description: 'High quality 4K output',
					},
				],
				default: 'nano-banana',
				description: 'Select model quality level',
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				default: '',
				required: true,
				description: 'Text description for generation or editing',
			},
			{
				displayName: 'Input Image Type',
				name: 'inputImageType',
				type: 'options',
				default: 'url',
				options: [
					{ name: 'URL / Base64', value: 'url' },
					{ name: 'Binary File', value: 'binary' },
				],
				description: 'Choose how to provide the input image',
				displayOptions: {
					show: {
						mode: ['image-to-image'],
					},
				},
			},
			{
				displayName: 'Input Image',
				name: 'inputImage',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						mode: ['image-to-image'],
						inputImageType: ['url'],
					},
				},
				description: 'URL or base64 of the image to edit',
				placeholder: 'https://example.com/image.jpg or data:image/jpeg;base64,...',
			},
			{
				displayName: 'Input Image File',
				name: 'inputImageBinary',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						mode: ['image-to-image'],
						inputImageType: ['binary'],
					},
				},
				description: 'Binary property containing the image file to edit',
				placeholder: 'Enter a property name containing the binary data, e.g., data',
			},
			{
				displayName: 'Number of Images',
				name: 'n',
				type: 'number',
				default: 1,
				typeOptions: {
					minValue: 1,
					maxValue: 4,
				},
				description: 'Number of images to generate (1-4)',
			},
			{
				displayName: 'Size',
				name: 'size',
				type: 'options',
				default: '1024x1024',
				options: [
					{ name: '256x256', value: '256x256' },
					{ name: '512x512', value: '512x512' },
					{ name: '1024x1024', value: '1024x1024' },
					{ name: '1792x1024', value: '1792x1024' },
					{ name: '1024x1792', value: '1024x1792' },
				],
				description: 'Image size (Note: HD model supports up to 4K)',
			},
			{
				displayName: 'Response Format',
				name: 'responseFormat',
				type: 'options',
				default: 'url',
				options: [
					{ name: 'URL', value: 'url' },
					{ name: 'Base64', value: 'b64_json' },
				],
				description: 'The format in which the generated images are returned',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 5000,
							maxValue: 300000,
						},
						default: 60000,
						description: 'Request timeout in milliseconds (default: 60 seconds)',
					},
				],
			},
		],
	};

	/**
	 * Executes the Nano Banana generation node
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		this.logger?.info('Starting Nano Banana generation', {
			itemCount: items.length,
		});

		for (let i = 0; i < items.length; i++) {
			try {
				const credentials = await this.getCredentials<GoogleAiCredentials>('googleAi');
				if (!credentials || !credentials.apiKey) {
					throw new NodeOperationError(
						this.getNode(),
						'API Key is required. Please configure your Google Gemini API credentials.',
						{ itemIndex: i }
					);
				}

				this.logger?.info('[Nano Banana] Processing item', { index: i });

				const mode = this.getNodeParameter('mode', i) as string;
				const model = this.getNodeParameter('model', i) as string;
				const prompt = this.getNodeParameter('prompt', i) as string;
				const n = this.getNodeParameter('n', i) as number || 1;
				const size = this.getNodeParameter('size', i) as string || '1024x1024';
				const responseFormat = this.getNodeParameter('responseFormat', i) as string || 'url';

				let inputImage = '';
				if (mode === 'image-to-image') {
					const inputImageType = this.getNodeParameter('inputImageType', i) as string;
					if (inputImageType === 'binary') {
						const binaryPropertyName = this.getNodeParameter('inputImageBinary', i) as string;
						const binaryData = items[i].binary;

						if (!binaryData || !binaryData[binaryPropertyName]) {
							throw new NodeOperationError(
								this.getNode(),
								`Binary property '${binaryPropertyName}' not found.`,
								{ itemIndex: i }
							);
						}

						const binary = binaryData[binaryPropertyName] as { data: string; mimeType: string };
						if (binary.data) {
							inputImage = `data:${binary.mimeType || 'image/jpeg'};base64,${binary.data}`;
						}
					} else {
						inputImage = this.getNodeParameter('inputImage', i) as string || '';
					}
				}

				let timeout = 60000;
				try {
					timeout = this.getNodeParameter('options.timeout', i) as number;
				} catch (error) {
					// Use default
				}

				if (!prompt || prompt.trim() === '') {
					throw new NodeOperationError(
						this.getNode(),
						'Prompt is required',
						{ itemIndex: i }
					);
				}

				if (mode === 'image-to-image' && !inputImage) {
					throw new NodeOperationError(
						this.getNode(),
						'Input image is required for image-to-image mode',
						{ itemIndex: i }
					);
				}

				const result = await NanoBananaGen.executeGeneration(
					this,
					i,
					credentials,
					{
						mode,
						model,
						prompt: prompt.trim(),
						n,
						size,
						responseFormat,
						inputImage,
					},
					timeout
				);

				results.push(result);
			} catch (error) {
				const errorCode = error instanceof MediaGenError ? error.code : 'UNKNOWN';

				this.logger?.error('[Nano Banana] Execution failed', {
					error: error instanceof Error ? error.message : String(error),
					errorCode,
				});

				results.push({
					json: {
						success: false,
						error: error instanceof Error ? error.message : String(error),
						errorCode,
						_metadata: {
							timestamp: new Date().toISOString(),
						},
					},
				});

				if (this.continueOnFail()) {
					continue;
				}
				throw error;
			}
		}

		return [this.helpers.constructExecutionMetaData(results, { itemData: { item: 0 } })];
	}

	/**
	 * Executes Nano Banana API generation using OpenAI DALL-E format
	 */
	private static async executeGeneration(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials: GoogleAiCredentials,
		params: {
			mode: string;
			model: string;
			prompt: string;
			n: number;
			size: string;
			responseFormat: string;
			inputImage: string;
		},
		timeout: number
	): Promise<INodeExecutionData> {
		// Use baseUrl from credentials or default to Google official
		const baseUrl = credentials.baseUrl || 'https://generativelanguage.googleapis.com';

		context.logger?.info('[Nano Banana] Starting generation', {
			itemIndex,
			mode: params.mode,
			model: params.model,
			baseUrl,
		});

		console.log('[Nano Banana] Using base URL', { baseUrl });

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			let imageUrl: string;

			if (params.mode === 'text-to-image') {
				// POST /v1/images/generations (OpenAI DALL-E format)
				const requestBody = {
					model: params.model,
					prompt: params.prompt,
					n: params.n,
					size: params.size,
					response_format: params.responseFormat,
				};

				console.log('[Nano Banana] Sending text-to-image request', {
					model: params.model,
					prompt: params.prompt.substring(0, 50) + '...',
				});

				const response = await fetch(`${baseUrl}/v1/images/generations`, {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(requestBody),
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorText = await response.text();
					console.error('[Nano Banana] API error', {
						status: response.status,
						statusText: response.statusText,
						body: errorText,
					});
					throw new MediaGenError(
						`API request failed: ${response.status} ${response.statusText}`,
						'API_ERROR'
					);
				}

				const data = await response.json() as DalleResponse;

				if (!data.data || data.data.length === 0) {
					throw new MediaGenError('No images returned from API', 'API_ERROR');
				}

				// Get first image
				const firstImage = data.data[0];
				imageUrl = firstImage.url || firstImage.b64_json || '';

				if (!imageUrl) {
					throw new MediaGenError('No image URL or base64 data returned', 'API_ERROR');
				}

				console.log('[Nano Banana] Generation completed', {
					imageUrl: imageUrl.substring(0, 50) + '...',
				});

			} else {
				// POST /v1/images/edits (OpenAI DALL-E Edits format)
				const formData = new FormData();
				formData.append('model', params.model);
				formData.append('prompt', params.prompt);
				formData.append('n', params.n.toString());
				formData.append('size', params.size);
				formData.append('response_format', params.responseFormat);

				// Add input image
				if (params.inputImage.startsWith('data:')) {
					// It's base64 - convert to blob
					const base64Data = params.inputImage.split(',')[1];
					const byteCharacters = atob(base64Data);
					const byteNumbers = new Array(byteCharacters.length);
					for (let i = 0; i < byteCharacters.length; i++) {
						byteNumbers[i] = byteCharacters.charCodeAt(i);
					}
					const byteArray = new Uint8Array(byteNumbers);
					const blob = new Blob([byteArray], { type: 'image/jpeg' });
					formData.append('image', blob, 'image.jpg');
				} else {
					// It's a URL - append as-is
					formData.append('image', params.inputImage);
				}

				console.log('[Nano Banana] Sending image-to-image request', {
					model: params.model,
					prompt: params.prompt.substring(0, 50) + '...',
				});

				const response = await fetch(`${baseUrl}/v1/images/edits`, {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${credentials.apiKey}`,
					},
					body: formData,
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorText = await response.text();
					console.error('[Nano Banana] API error', {
						status: response.status,
						statusText: response.statusText,
						body: errorText,
					});
					throw new MediaGenError(
						`API request failed: ${response.status} ${response.statusText}`,
						'API_ERROR'
					);
				}

				const data = await response.json() as DalleResponse;

				if (!data.data || data.data.length === 0) {
					throw new MediaGenError('No images returned from API', 'API_ERROR');
				}

				const firstImage = data.data[0];
				imageUrl = firstImage.url || firstImage.b64_json || '';

				if (!imageUrl) {
					throw new MediaGenError('No image URL or base64 data returned', 'API_ERROR');
				}

				console.log('[Nano Banana] Edit completed', {
					imageUrl: imageUrl.substring(0, 50) + '...',
				});
			}

			return {
				json: {
					success: true,
					imageUrl,
					model: params.model,
					mode: params.mode,
					_metadata: {
						timestamp: new Date().toISOString(),
					},
				},
			};
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof Error && error.name === 'AbortError') {
				throw new MediaGenError('Request timeout', 'TIMEOUT');
			}

			if (error instanceof MediaGenError) {
				throw error;
			}

			throw new MediaGenError(
				error instanceof Error ? error.message : String(error),
				'NETWORK_ERROR'
			);
		}
	}
}
