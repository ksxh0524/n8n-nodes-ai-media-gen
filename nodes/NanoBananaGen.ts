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
interface GoogleGeminiCredentials {
	/** API key from Google AI Studio */
	apiKey: string;
}

/**
 * Nano Banana API request response
 */
interface NanoBananaApiResponse {
	data: {
		id: string;
		results: Array<{
			url: string;
			content: string;
		}>;
		progress: number;
		status: 'running' | 'succeeded' | 'failed';
		failure_reason: string | null;
		error: string | null;
		credits_cost: number;
	};
}

/**
 * Nano Banana Image Generation Node
 *
 * Generates and edits images using Google's Nano Banana AI model:
 * - Text-to-image: Generate images from text descriptions
 * - Image-to-image: Edit images with text instructions
 * - Supports multiple aspect ratios and image sizes (1K, 2K, 4K)
 */
export class NanoBananaGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nano Banana Generation',
		name: 'nanoBananaGen',
		icon: 'file:ai-media-gen.svg',
		description: 'Generate and edit images using Google Nano Banana AI model',
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
				name: 'googleGeminiApi',
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
						name: 'Nano Banana Fast',
						value: 'nano-banana-fast',
						description: 'Fast generation (5 credits)',
					},
					{
						name: 'Nano Banana',
						value: 'nano-banana',
						description: 'Balanced quality and speed (15 credits)',
					},
					{
						name: 'Nano Banana Pro',
						value: 'nano-banana-pro',
						description: 'Highest quality (20 credits)',
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
				displayName: 'Aspect Ratio',
				name: 'aspectRatio',
				type: 'options',
				default: 'auto',
				options: [
					{ name: 'Auto', value: 'auto' },
					{ name: '1:1', value: '1:1' },
					{ name: '16:9', value: '16:9' },
					{ name: '9:16', value: '9:16' },
					{ name: '4:3', value: '4:3' },
					{ name: '3:4', value: '3:4' },
					{ name: '3:2', value: '3:2' },
					{ name: '2:3', value: '2:3' },
				],
				description: 'Image aspect ratio',
			},
			{
				displayName: 'Image Size',
				name: 'imageSize',
				type: 'options',
				default: '1K',
				options: [
					{ name: '1K (1024x1024)', value: '1K' },
					{ name: '2K (2048x2048)', value: '2K' },
					{ name: '4K (4096x4096)', value: '4K' },
				],
				description: 'Output image resolution (Pro model supports up to 4K)',
			},
			{
				displayName: 'Number of Images',
				name: 'numImages',
				type: 'number',
				default: 1,
				typeOptions: {
					minValue: 1,
					maxValue: 4,
				},
				description: 'Number of images to generate (1-4)',
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
							minValue: 1000,
							maxValue: 600000,
						},
						default: 120000,
						description: 'Request timeout in milliseconds (default: 2 minutes)',
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
				const credentials = await this.getCredentials<GoogleGeminiCredentials>('googleGeminiApi');
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
				const aspectRatio = this.getNodeParameter('aspectRatio', i) as string || 'auto';
				const imageSize = this.getNodeParameter('imageSize', i) as string || '1K';
				const numImages = this.getNodeParameter('numImages', i) as number || 1;

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

				let timeout = 120000;
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
					credentials.apiKey,
					{
						mode,
						model,
						prompt: prompt.trim(),
						aspectRatio,
						imageSize,
						numImages,
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
	 * Executes Nano Banana API generation
	 */
	private static async executeGeneration(
		context: IExecuteFunctions,
		itemIndex: number,
		apiKey: string,
		params: {
			mode: string;
			model: string;
			prompt: string;
			aspectRatio: string;
			imageSize: string;
			numImages: number;
			inputImage: string;
		},
		timeout: number
	): Promise<INodeExecutionData> {
		const baseUrl = 'https://nanobananapro.cloud';

		context.logger?.info('[Nano Banana] Starting generation', {
			itemIndex,
			mode: params.mode,
			model: params.model,
		});

		// Submit generation task
		const formData = new FormData();
		formData.append('prompt', params.prompt);
		formData.append('model', params.model);
		formData.append('mode', params.mode);
		formData.append('aspectRatio', params.aspectRatio);
		formData.append('imageSize', params.imageSize);

		if (params.mode === 'image-to-image' && params.inputImage) {
			formData.append('imageUrl', params.inputImage);
		}

		console.log('[Nano Banana] Submitting task', {
			url: `${baseUrl}/api/v1/image/nano-banana`,
			model: params.model,
			mode: params.mode,
		});

		const submitResponse = await fetch(`${baseUrl}/api/v1/image/nano-banana`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
			},
			body: formData,
		});

		if (!submitResponse.ok) {
			throw new MediaGenError(
				`Failed to submit task: ${submitResponse.status} ${submitResponse.statusText}`,
				'API_ERROR'
			);
		}

		const submitData = await submitResponse.json() as NanoBananaApiResponse;

		if (!submitData.data || !submitData.data.id) {
			throw new MediaGenError('No task ID returned from API', 'API_ERROR');
		}

		const taskId = submitData.data.id;

		console.log('[Nano Banana] Task submitted', { taskId });

		// Poll for result
		const imageUrl = await NanoBananaGen.pollForResult(
			baseUrl,
			apiKey,
			taskId,
			timeout
		);

		console.log('[Nano Banana] Generation completed', { imageUrl });

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
	}

	/**
	 * Polls for task result
	 */
	private static async pollForResult(
		baseUrl: string,
		apiKey: string,
		taskId: string,
		timeout: number
	): Promise<string> {
		const startTime = Date.now();
		const pollInterval = 2000; // 2 seconds

		console.log('[Nano Banana] Starting polling', { taskId, timeout });

		let pollCount = 0;
		while (Date.now() - startTime < timeout) {
			pollCount++;
			const elapsed = Date.now() - startTime;

			if (pollCount > 1) {
				await new Promise(resolve => setTimeout(resolve, pollInterval));
			}

			console.log('[Nano Banana] Polling result', { pollCount, elapsed, taskId });

			const response = await fetch(`${baseUrl}/api/v1/image/nano-banana/result`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`,
				},
				body: JSON.stringify({ taskId }),
			});

			if (!response.ok) {
				throw new MediaGenError(
					`Failed to check result: ${response.status} ${response.statusText}`,
					'API_ERROR'
				);
			}

			const data = await response.json() as NanoBananaApiResponse;

			console.log('[Nano Banana] Poll response', {
				status: data.data.status,
				progress: data.data.progress,
			});

			if (data.data.status === 'succeeded') {
				if (data.data.results && data.data.results.length > 0) {
					console.log('[Nano Banana] Task succeeded', { taskId, pollCount, elapsed });
					return data.data.results[0].url;
				}
				throw new MediaGenError('Task succeeded but no image URL returned', 'API_ERROR');
			}

			if (data.data.status === 'failed') {
				console.error('[Nano Banana] Task failed', {
					taskId,
					reason: data.data.failure_reason,
					error: data.data.error,
				});
				throw new MediaGenError(
					data.data.failure_reason || data.data.error || 'Task failed',
					'API_ERROR'
				);
			}

			// Continue polling for 'running' status
		}

		console.error('[Nano Banana] Polling timeout', { taskId, pollCount, timeout });
		throw new MediaGenError('Task polling timeout', 'TIMEOUT');
	}
}
