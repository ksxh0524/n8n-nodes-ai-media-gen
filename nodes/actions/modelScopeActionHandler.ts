/**
 * ModelScope Action Handler for n8n-nodes-ai-media-gen
 * Supports image generation and editing using ModelScope AI models
 */

import type {
	IExecuteFunctions,
	INodeExecutionData,
} from 'n8n-workflow';
import {
	BaseActionHandler,
	type ValidationResult,
	type ActionParameters,
	type ActionParameterDefinition,
} from '../utils/actionHandler';

/**
 * ModelScope model constants
 */
const MODELS = {
	Z_IMAGE_TURBO: 'Z-Image-Turbo',
	QWEN_IMAGE_2512: 'Qwen-Image-2512',
	QWEN_IMAGE_EDIT_2511: 'Qwen-Image-Edit-2511',
} as const;

/**
 * ModelScope model resolutions
 */
const MODEL_RESOLUTIONS = {
	[MODELS.Z_IMAGE_TURBO]: ['1024x1024', '512x512', '768x768', '512x1024', '1024x512'],
	[MODELS.QWEN_IMAGE_2512]: ['1024x1024', '2048x2048', '512x512'],
	[MODELS.QWEN_IMAGE_EDIT_2511]: null, // Not supported for image editing
} as const;

/**
 * ModelScope Action Handler
 * Handles image generation and editing using ModelScope AI models
 */
export class ModelScopeActionHandler extends BaseActionHandler {
	constructor() {
		super(
			'modelScope',
			'ModelScope (Image Generation)',
			'Generate and edit images using ModelScope AI models',
			'image',
			'modelScopeApi',
			true
		);
	}

	/**
	 * Validate parameters for ModelScope API
	 */
	validateParameters(params: ActionParameters): ValidationResult {
		const model = params.model as string;
		const errors: string[] = [];
		const warnings: string[] = [];

		// Basic validation
		if (!params.prompt || typeof params.prompt !== 'string' || params.prompt.trim() === '') {
			errors.push('Prompt is required and must be a non-empty string');
		}

		// Model-specific validation
		if (model === MODELS.QWEN_IMAGE_EDIT_2511) {
			if (!params.editImage || typeof params.editImage !== 'string' || params.editImage.trim() === '') {
				errors.push('editImage is required for Qwen-Image-Edit-2511');
			}
		}

		// Validate numImages range
		if (params.numImages !== undefined) {
			const numImages = params.numImages as number;
			if (typeof numImages !== 'number' || numImages < 1 || numImages > 4) {
				errors.push('numImages must be a number between 1 and 4');
			}
		}

		// Validate seed
		if (params.seed !== undefined && typeof params.seed !== 'number') {
			errors.push('seed must be a number');
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	/**
	 * Execute ModelScope API call
	 */
	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials?: Record<string, unknown>
	): Promise<INodeExecutionData> {
		// Get parameters
		const model = this.getParameter<string>(context, itemIndex, 'model');
		const prompt = this.getParameter<string>(context, itemIndex, 'prompt');
		const size = this.getParameter<string>(context, itemIndex, 'size');
		const editImage = this.getParameter<string>(context, itemIndex, 'editImage');
		const seed = this.getParameter<number>(context, itemIndex, 'seed');
		const numImages = this.getParameter<number>(context, itemIndex, 'numImages');

		// Build parameters object for validation
		const params: ActionParameters = {
			model,
			prompt,
			size,
			editImage,
			seed,
			numImages,
		};

		// Validate parameters
		const validation = this.validateParameters(params);
		if (!validation.valid) {
			return this.buildErrorResponse(
				`Validation failed: ${validation.errors.join(', ')}`,
				'VALIDATION_ERROR',
				{ model }
			);
		}

		// Get credentials
		const apiKey = credentials?.apiKey as string;
		if (!apiKey) {
			return this.buildErrorResponse(
				'API Key is required. Please configure your ModelScope API credentials.',
				'CREDENTIALS_ERROR',
				{ model }
			);
		}

		const baseUrl = credentials?.baseUrl as string || 'https://api.modelscope.cn/v1';
		const timeout = (credentials?.timeout as number || 120) * 1000;

		// Build API request
		const endpoint = `${baseUrl}/files/generation`;
		let requestBody: Record<string, unknown>;

		if (model === MODELS.QWEN_IMAGE_EDIT_2511) {
			// Image editing API
			requestBody = {
				model: model,
				input: {
					prompt: prompt.trim(),
					image: editImage?.trim(), // URL or base64
				},
				parameters: {
					size: size || '1024x1024',
					seed: seed || 0,
				},
			};
		} else {
			// Image generation API
			requestBody = {
				model: model,
				input: {
					prompt: prompt.trim(),
				},
				parameters: {
					size: size || '1024x1024',
					seed: seed || 0,
					num_images: numImages || 1,
				},
			};
		}

		// Send request
		const response = await this.makeRequest({
			url: endpoint,
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: requestBody,
			timeout,
		});

		// Handle error response
		if (!response.success) {
			let errorMessage = response.error || 'Failed to generate image';

			// Add more context for common errors
			if (response.statusCode === 401) {
				errorMessage = 'Authentication failed. Please check your API Key.';
			} else if (response.statusCode === 429) {
				errorMessage = 'Rate limit exceeded. Please try again later.';
			} else if (response.statusCode === 408) {
				errorMessage = 'Request timeout. The server took too long to respond.';
			} else if (response.statusCode === 503) {
				errorMessage = 'Service temporarily unavailable. Please try again later.';
			}

			return this.buildErrorResponse(
				errorMessage,
				'API_ERROR',
				{
					model,
					statusCode: response.statusCode,
					prompt: prompt.substring(0, 50),
				}
			);
		}

		// Parse ModelScope response
		const data = response.data as Record<string, unknown>;
		const output = data?.output as Record<string, unknown> | undefined;
		const imageUrl = (output?.url || data?.url || data?.image_url) as string;

		if (!imageUrl) {
			return this.buildErrorResponse(
				'No image URL returned from API',
				'API_ERROR',
				{ model, response: data }
			);
		}

		// Build success response
		return this.buildSuccessResponse(
			{
				imageUrl: imageUrl,
				model: model,
				prompt: prompt,
				size: size,
				seed: seed,
				numImages: numImages,
			},
			{
				requestId: data?.request_id as string | undefined,
			}
		);
	}

	/**
	 * Get parameter definitions for ModelScope action
	 */
	getParameters(): ActionParameterDefinition[] {
		return [
			{
				name: 'model',
				displayName: 'Model',
				type: 'options',
				required: true,
				options: [
					{ name: 'Z-Image-Turbo', value: MODELS.Z_IMAGE_TURBO },
					{ name: 'Qwen-Image-2512', value: MODELS.QWEN_IMAGE_2512 },
					{ name: 'Qwen-Image-Edit-2511', value: MODELS.QWEN_IMAGE_EDIT_2511 },
				],
				description: 'Select the AI model to use',
			},
			{
				name: 'prompt',
				displayName: 'Prompt',
				type: 'string',
				required: true,
				description: 'Text description of the image to generate or edit',
			},
			{
				name: 'editImage',
				displayName: 'Edit Image',
				type: 'string',
				required: false,
				description: 'URL or base64 of image to edit (required for Qwen-Image-Edit-2511)',
				placeholder: 'https://example.com/image.jpg or data:image/jpeg;base64,...',
			},
			{
				name: 'size',
				displayName: 'Size',
				type: 'options',
				required: false,
				default: '1024x1024',
				options: [
					{ name: '512x512', value: '512x512' },
					{ name: '768x768', value: '768x768' },
					{ name: '1024x1024', value: '1024x1024' },
					{ name: '2048x2048', value: '2048x2048' },
					{ name: '512x1024 (Portrait)', value: '512x1024' },
					{ name: '1024x512 (Landscape)', value: '1024x512' },
				],
				description: 'Image size (not available for Qwen-Image-Edit-2511)',
			},
			{
				name: 'seed',
				displayName: 'Seed',
				type: 'number',
				required: false,
				default: 0,
				description: 'Random seed for reproducibility (0 = random)',
			},
			{
				name: 'numImages',
				displayName: 'Number of Images',
				type: 'number',
				required: false,
				default: 1,
				min: 1,
				max: 4,
				description: 'Number of images to generate (1-4)',
			},
		];
	}
}

/**
 * Export model constants for use in other files
 */
export { MODELS, MODEL_RESOLUTIONS };
