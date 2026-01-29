import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
} from 'n8n-workflow';
import { MediaGenError } from './utils/errors';

/**
 * Doubao API credentials
 */
interface DoubaoApiCredentials {
	/** API key for authentication */
	apiKey: string;
	/** Optional custom base URL */
	baseUrl?: string;
}

/**
 * Seedream image generation response
 */
interface SeedreamResponse {
	data?: Array<{
		url?: string;
		b64_json?: string;
		revised_prompt?: string;
	}>;
	request_id?: string;
	output_url?: string;
	b64_json?: string;
	status?: string;
}

/**
 * Doubao Image Generation Node
 *
 * Generates and edits images using Doubao Seedream AI model
 * through Volcengine API.
 *
 * Features:
 * - Text-to-image generation
 * - Image-to-image editing
 * - Multiple aspect ratios
 * - High resolution support
 */
export class DoubaoGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Doubao Image Generation',
		name: 'doubaoGen',
		icon: 'file:ai-media-gen.svg',
		description: 'Generate and edit images using Doubao Seedream AI model',
		version: 1.0,
		group: ['transform'],
		subtitle: '={{$parameter.mode}}',
		defaults: {
			name: 'Doubao Image Generation',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'doubaoApi',
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
						name: 'Doubao Seedream 4.5',
						value: 'doubao-seedream-4-5-251128',
						description: 'Latest high-quality image generation model (2025-01-28)',
					},
					{
						name: 'Doubao Seedream 4.0',
						value: 'doubao-seedream-4-0-250828',
						description: 'Previous generation model (2024-08-28)',
					},
				],
				default: 'doubao-seedream-4-5-251128',
				description: 'Select Doubao model to use',
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
				displayName: 'Size',
				name: 'size',
				type: 'options',
				default: '2048x2048',
				options: [
					{ name: '1:1 (2048x2048)', value: '2048x2048' },
					{ name: '4:3 (2304x1728)', value: '2304x1728' },
					{ name: '3:4 (1728x2304)', value: '1728x2304' },
					{ name: '16:9 (2560x1440)', value: '2560x1440' },
					{ name: '9:16 (1440x2560)', value: '1440x2560' },
					{ name: '3:2 (2496x1664)', value: '2496x1664' },
					{ name: '2:3 (1664x2496)', value: '1664x2496' },
					{ name: '21:9 (3024x1296)', value: '3024x1296' },
				],
				description: 'Image size and aspect ratio',
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
				description: 'Response format: URL or Base64',
			},
			{
				displayName: 'Seed',
				name: 'seed',
				type: 'number',
				default: 0,
				typeOptions: {
					minValue: 0,
					maxValue: 4294967295,
				},
				description: 'Random seed for generation (0 for random)',
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
	 * Executes the Doubao generation node
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		this.logger?.info('Starting Doubao generation', {
			itemCount: items.length,
		});

		for (let i = 0; i < items.length; i++) {
			try {
				const credentials = await this.getCredentials<DoubaoApiCredentials>('doubaoApi');
				if (!credentials || !credentials.apiKey) {
					throw new NodeOperationError(
						this.getNode(),
						'API Key is required. Please configure your Doubao API credentials.',
						{ itemIndex: i }
					);
				}

				this.logger?.info('[Doubao] Processing item', { index: i });

				const result = await DoubaoGen.executeGeneration(this, i, credentials);

				results.push(result);
			} catch (error) {
				const errorCode = error instanceof MediaGenError ? error.code : 'UNKNOWN';

				this.logger?.error('[Doubao] Execution failed', {
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
	 * Executes Doubao API generation
	 */
	private static async executeGeneration(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials: DoubaoApiCredentials
	): Promise<INodeExecutionData> {
		const baseUrl = credentials.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';

		context.logger?.info('[Doubao] Starting generation', {
			itemIndex,
			baseUrl,
		});

		const mode = context.getNodeParameter('mode', itemIndex) as string;
		const model = context.getNodeParameter('model', itemIndex) as string;
		const prompt = context.getNodeParameter('prompt', itemIndex) as string;
		const size = context.getNodeParameter('size', itemIndex) as string || '2048x2048';
		const responseFormat = context.getNodeParameter('responseFormat', itemIndex) as string || 'url';
		const seed = context.getNodeParameter('seed', itemIndex) as number || 0;

		let timeout = 60000;
		try {
			timeout = context.getNodeParameter('options.timeout', itemIndex) as number;
		} catch (error) {
			// Use default
		}

		// Validate prompt
		if (!prompt || prompt.trim() === '') {
			throw new NodeOperationError(
				context.getNode(),
				'Prompt is required',
				{ itemIndex }
			);
		}

		// Get input image for image-to-image mode
		let inputImage = '';
		if (mode === 'image-to-image') {
			const inputImageType = context.getNodeParameter('inputImageType', itemIndex) as string;
			if (inputImageType === 'binary') {
				const binaryPropertyName = context.getNodeParameter('inputImageBinary', itemIndex) as string;
				const items = context.getInputData();
				const binaryData = items[itemIndex].binary;

				if (!binaryData || !binaryData[binaryPropertyName]) {
					throw new NodeOperationError(
						context.getNode(),
						`Binary property '${binaryPropertyName}' not found.`,
						{ itemIndex }
					);
				}

				const binary = binaryData[binaryPropertyName] as { data: string; mimeType: string };
				if (binary.data) {
					inputImage = `data:${binary.mimeType || 'image/jpeg'};base64,${binary.data}`;
				}
			} else {
				inputImage = context.getNodeParameter('inputImage', itemIndex) as string || '';
			}
		}

		// Validate input image for image-to-image mode
		if (mode === 'image-to-image' && !inputImage) {
			throw new NodeOperationError(
				context.getNode(),
				'Input image is required for image-to-image mode',
				{ itemIndex }
			);
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			let imageUrl: string;

			if (mode === 'text-to-image') {
				// Text to Image
				const requestBody = {
					model: model,
					prompt: prompt.trim(),
					size,
					response_format: responseFormat,
					stream: false,
					watermark: false,
					seed: seed > 0 ? seed : undefined,
				};

				context.logger?.info('[Doubao] Sending text-to-image request', {
					model,
					prompt: prompt.substring(0, 50) + '...',
					size,
					responseFormat,
				});

				const response = await fetch(`${baseUrl}/images/generations`, {
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
					context.logger?.error('[Doubao] API error', {
						status: response.status,
						statusText: response.statusText,
						body: errorText,
					});
					throw new MediaGenError(
						`API request failed: ${response.status} ${response.statusText}`,
						'API_ERROR'
					);
				}

				const data = await response.json() as SeedreamResponse;

				// Parse response - support both OpenAI format and legacy format
				if (data.data && data.data.length > 0 && data.data[0].url) {
					// OpenAI-compatible format: { data: [{ url: "..." }] }
					imageUrl = data.data[0].url;
				} else if (data.data && data.data.length > 0 && data.data[0].b64_json) {
					// OpenAI-compatible format with base64
					imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
				} else if (data.output_url) {
					// Legacy format: { output_url: "..." }
					imageUrl = data.output_url;
				} else {
					context.logger?.error('[Doubao] Unexpected response format', { data });
					throw new MediaGenError('No image data returned from API', 'API_ERROR');
				}

				context.logger?.info('[Doubao] Generation completed', {
					requestId: data.request_id,
					imageUrl: imageUrl.substring(0, 50) + '...',
				});
			} else {
				// Image to Image
				const formData = new FormData();
				formData.append('model', model);
				formData.append('prompt', prompt);
				formData.append('size', size);
				formData.append('response_format', responseFormat);
				formData.append('stream', 'false');
				formData.append('watermark', 'false');
				if (seed > 0) {
					formData.append('seed', seed.toString());
				}

				// Add input image
				if (inputImage.startsWith('data:')) {
					// Base64 image
					const base64Data = inputImage.split(',')[1];
					const byteCharacters = atob(base64Data);
					const byteNumbers = new Array(byteCharacters.length);
					for (let i = 0; i < byteCharacters.length; i++) {
						byteNumbers[i] = byteCharacters.charCodeAt(i);
					}
					const byteArray = new Uint8Array(byteNumbers);
					const blob = new Blob([byteArray], { type: 'image/jpeg' });
					formData.append('image', blob, 'image.jpg');
				} else {
					// URL - append as-is
					formData.append('image_url', inputImage);
				}

				context.logger?.info('[Doubao] Sending image-to-image request', {
					model,
					prompt: prompt.substring(0, 50) + '...',
					size,
					responseFormat,
				});

				const response = await fetch(`${baseUrl}/images/edits`, {
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
					context.logger?.error('[Doubao] API error', {
						status: response.status,
						statusText: response.statusText,
						body: errorText,
					});
					throw new MediaGenError(
						`API request failed: ${response.status} ${response.statusText}`,
						'API_ERROR'
					);
				}

				const data = await response.json() as SeedreamResponse;

				// Parse response - support both OpenAI format and legacy format
				if (data.data && data.data.length > 0 && data.data[0].url) {
					// OpenAI-compatible format: { data: [{ url: "..." }] }
					imageUrl = data.data[0].url;
				} else if (data.data && data.data.length > 0 && data.data[0].b64_json) {
					// OpenAI-compatible format with base64
					imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
				} else if (data.output_url) {
					// Legacy format: { output_url: "..." }
					imageUrl = data.output_url;
				} else {
					context.logger?.error('[Doubao] Unexpected response format', { data });
					throw new MediaGenError('No image data returned from API', 'API_ERROR');
				}

				context.logger?.info('[Doubao] Edit completed', {
					requestId: data.request_id,
					imageUrl: imageUrl.substring(0, 50) + '...',
				});
			}

			// Prepare response data
			const jsonData: any = {
				success: true,
				imageUrl,
				model,
				mode,
				_metadata: {
					timestamp: new Date().toISOString(),
				},
			};

			const binaryData: any = {};

			// Download image if URL returned (not base64)
			if (imageUrl && !imageUrl.startsWith('data:')) {
				try {
					context.logger?.info('[Doubao] Downloading image from URL');
					const imageResponse = await fetch(imageUrl);
					if (imageResponse.ok) {
						const buffer = await imageResponse.arrayBuffer();
						const base64 = Buffer.from(buffer).toString('base64');
						const mimeType = imageResponse.headers.get('content-type') || 'image/png';

						binaryData.data = {
							data: base64,
							mimeType,
							fileName: `doubao-${Date.now()}.png`,
						};

						context.logger?.info('[Doubao] Image downloaded successfully');
					} else {
						context.logger?.warn('[Doubao] Failed to download image', {
							status: imageResponse.status,
						});
					}
				} catch (error) {
					context.logger?.warn('[Doubao] Failed to download image', {
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			return {
				json: jsonData,
				binary: Object.keys(binaryData).length > 0 ? binaryData : undefined,
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
