/**
 * ModelScope Action Handlers for n8n-nodes-ai-media-gen
 * Multiple independent actions for ModelScope AI models
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
 * ModelScope Generate Image Action Handler
 */
export class ModelScopeGenerateImageAction extends BaseActionHandler {
	constructor() {
		super(
			'modelScopeGenerateImage',
			'ModelScope Generate Image',
			'Generate images using ModelScope AI models',
			'image',
			'modelScopeApi',
			true
		);
	}

	getParameters(): ActionParameterDefinition[] {
		return [];
	}

	validateParameters(params: ActionParameters): ValidationResult {
		const errors: string[] = [];

		if (!params.prompt || typeof params.prompt !== 'string' || params.prompt.trim() === '') {
			errors.push('Prompt is required');
		}

		if (params.numImages !== undefined) {
			const numImages = params.numImages as number;
			if (typeof numImages !== 'number' || numImages < 1 || numImages > 4) {
				errors.push('numImages must be between 1 and 4');
			}
		}

		return { valid: errors.length === 0, errors };
	}

	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials?: Record<string, unknown>
	): Promise<INodeExecutionData> {
		const model = this.getParameter<string>(context, itemIndex, 'model');
		const prompt = this.getParameter<string>(context, itemIndex, 'prompt');
		const size = this.getParameter<string>(context, itemIndex, 'size');
		const seed = this.getParameter<number>(context, itemIndex, 'seed');
		const numImages = this.getParameter<number>(context, itemIndex, 'numImages');

		const validation = this.validateParameters({ model, prompt, size, seed, numImages });
		if (!validation.valid) {
			return this.buildErrorResponse(
				`Validation failed: ${validation.errors.join(', ')}`,
				'VALIDATION_ERROR'
			);
		}

		const apiKey = credentials?.apiKey as string;
		if (!apiKey) {
			return this.buildErrorResponse(
				'API Key is required. Please configure your ModelScope API credentials.',
				'CREDENTIALS_ERROR'
			);
		}

		const baseUrl = credentials?.baseUrl as string || 'https://api.modelscope.cn/v1';
		const timeout = (credentials?.timeout as number || 120) * 1000;

		const response = await this.makeRequest({
			url: `${baseUrl}/files/generation`,
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: {
				model: model,
				input: {
					prompt: prompt.trim(),
				},
				parameters: {
					size: size || '1024x1024',
					seed: seed || 0,
					num_images: numImages || 1,
				},
			},
			timeout,
		});

		if (!response.success) {
			let errorMessage = response.error || 'Failed to generate image';
			if (response.statusCode === 401) errorMessage = 'Authentication failed. Please check your API Key.';
			else if (response.statusCode === 429) errorMessage = 'Rate limit exceeded. Please try again later.';
			else if (response.statusCode === 408) errorMessage = 'Request timeout.';

			return this.buildErrorResponse(errorMessage, 'API_ERROR');
		}

		const data = response.data as Record<string, unknown>;
		const output = data?.output as Record<string, unknown> | undefined;
		const imageUrl = (output?.url || data?.url || data?.image_url) as string;

		if (!imageUrl) {
			return this.buildErrorResponse('No image URL returned from API', 'API_ERROR');
		}

		return this.buildSuccessResponse({
			imageUrl,
			model,
			prompt,
			size,
			seed,
			numImages,
		});
	}
}

/**
 * ModelScope Edit Image Action Handler
 */
export class ModelScopeEditImageAction extends BaseActionHandler {
	constructor() {
		super(
			'modelScopeEditImage',
			'ModelScope Edit Image',
			'Edit images using ModelScope Qwen-Image-Edit model',
			'image',
			'modelScopeApi',
			true
		);
	}

	getParameters(): ActionParameterDefinition[] {
		return [];
	}

	validateParameters(params: ActionParameters): ValidationResult {
		const errors: string[] = [];

		if (!params.prompt || typeof params.prompt !== 'string' || params.prompt.trim() === '') {
			errors.push('Prompt is required');
		}

		if (!params.editImage || typeof params.editImage !== 'string' || params.editImage.trim() === '') {
			errors.push('Edit Image is required');
		}

		return { valid: errors.length === 0, errors };
	}

	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials?: Record<string, unknown>
	): Promise<INodeExecutionData> {
		const prompt = this.getParameter<string>(context, itemIndex, 'prompt');
		const editImage = this.getParameter<string>(context, itemIndex, 'editImage');
		const seed = this.getParameter<number>(context, itemIndex, 'seed');

		const validation = this.validateParameters({ prompt, editImage, seed });
		if (!validation.valid) {
			return this.buildErrorResponse(
				`Validation failed: ${validation.errors.join(', ')}`,
				'VALIDATION_ERROR'
			);
		}

		const apiKey = credentials?.apiKey as string;
		if (!apiKey) {
			return this.buildErrorResponse(
				'API Key is required. Please configure your ModelScope API credentials.',
				'CREDENTIALS_ERROR'
			);
		}

		const baseUrl = credentials?.baseUrl as string || 'https://api.modelscope.cn/v1';
		const timeout = (credentials?.timeout as number || 120) * 1000;

		const response = await this.makeRequest({
			url: `${baseUrl}/files/generation`,
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: {
				model: 'Qwen-Image-Edit-2511',
				input: {
					prompt: prompt.trim(),
					image: editImage.trim(),
				},
				parameters: {
					seed: seed || 0,
				},
			},
			timeout,
		});

		if (!response.success) {
			let errorMessage = response.error || 'Failed to edit image';
			if (response.statusCode === 401) errorMessage = 'Authentication failed. Please check your API Key.';
			else if (response.statusCode === 429) errorMessage = 'Rate limit exceeded. Please try again later.';
			else if (response.statusCode === 408) errorMessage = 'Request timeout.';

			return this.buildErrorResponse(errorMessage, 'API_ERROR');
		}

		const data = response.data as Record<string, unknown>;
		const output = data?.output as Record<string, unknown> | undefined;
		const imageUrl = (output?.url || data?.url || data?.image_url) as string;

		if (!imageUrl) {
			return this.buildErrorResponse('No image URL returned from API', 'API_ERROR');
		}

		return this.buildSuccessResponse({
			imageUrl,
			model: 'Qwen-Image-Edit-2511',
			prompt,
			seed,
		});
	}
}
