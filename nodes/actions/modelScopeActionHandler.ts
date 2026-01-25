/**
 * ModelScope Action Handler for n8n-nodes-ai-media-gen
 * Handles image generation and editing using ModelScope models
 */

import { BaseActionHandler, type IActionHandler, type ActionParameters, type ValidationResult } from '../utils/actionHandler';
import type { INodeExecutionData } from 'n8n-workflow';
import { MediaGenError } from '../utils/errors';
import type { IExecuteFunctions } from 'n8n-workflow';

/**
 * ModelScope Action Handler
 */
export class ModelScopeActionHandler extends BaseActionHandler implements IActionHandler {
	readonly actionName = 'modelScope' as const;
	readonly displayName = 'ModelScope (Multi-Model Platform)';
	readonly description = 'Generate and edit images using ModelScope AI models (qwen-image, qwen-image-edit, z-image-turbo)';
	readonly mediaType = 'image' as const;
	readonly credentialType = 'modelScopeApi';
	readonly requiresCredential = true;

	constructor() {
		super(
			'modelScope',
			'ModelScope (Multi-Model Platform)',
			'Generate and edit images using ModelScope AI models (qwen-image, qwen-image-edit, z-image-turbo)',
			'image',
			'modelScopeApi',
			true
		);
	}

	getParameters() {
		return [];
	}

	validateParameters(params: ActionParameters): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!params.model || typeof params.model !== 'string') {
			errors.push('Model is required and must be a string');
		}

		if (!params.prompt || typeof params.prompt !== 'string') {
			errors.push('Prompt is required and must be a string');
		}

		if (typeof params.prompt === 'string' && params.prompt.length > 10000) {
			errors.push('Prompt too long (max 10000 characters)');
		}

		if (typeof params.model === 'string' && params.model.includes('edit')) {
			if (!params.editImage) {
				errors.push('Edit image is required for edit models');
			}
		}

		if (params.size && typeof params.size === 'string') {
			const validSizes = ['256x256', '512x512', '1024x1024', '2048x2048'];
			if (!validSizes.includes(params.size)) {
				errors.push(`Invalid size. Must be one of: ${validSizes.join(', ')}`);
			}
		}

		if (params.quality !== undefined) {
			const quality = Number(params.quality);
			if (isNaN(quality) || quality < 1 || quality > 100) {
				errors.push('Quality must be a number between 1 and 100');
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials?: Record<string, unknown>
	): Promise<INodeExecutionData> {
		try {
			const model = this.getParameter<string>(context, itemIndex, 'model');
			const prompt = this.getParameter<string>(context, itemIndex, 'prompt');
			const editImage = this.getParameter<string>(context, itemIndex, 'editImage');
			const size = this.getParameter<string>(context, itemIndex, 'size');
			const quality = this.getParameter<number>(context, itemIndex, 'quality');
			const numImages = this.getParameter<number>(context, itemIndex, 'numImages');
			const seed = this.getParameter<number>(context, itemIndex, 'seed');
			const additionalParams = this.getParameter<Record<string, unknown>>(context, itemIndex, 'additionalParams');

			const validation = this.validateParameters({
				model,
				prompt,
				editImage,
				size,
				quality,
				numImages,
			});

			if (!validation.valid) {
				return this.buildErrorResponse(validation.errors.join(', '));
			}

			if (!credentials || !credentials.apiKey) {
				return this.buildErrorResponse('ModelScope API key is required', 'INVALID_API_KEY');
			}

			const result = await this.callModelScopeApi({
				model,
				prompt,
				editImage,
				size,
				quality,
				numImages,
				seed,
				additionalParams,
				apiKey: credentials.apiKey as string,
			});

			return this.buildSuccessResponse(result, {
				model,
				mediaType: 'image',
			});
		} catch (error) {
			if (error instanceof MediaGenError) {
				return this.buildErrorResponse(error.message, error.code, error.details as Record<string, unknown>);
			}
			return this.buildErrorResponse(
				error instanceof Error ? error.message : String(error),
				'UNKNOWN'
			);
		}
	}

	/**
	 * Call ModelScope API
	 */
	private async callModelScopeApi(params: {
		model: string;
		prompt: string;
		editImage?: string;
		size?: string;
		quality?: number;
		numImages?: number;
		seed?: number;
		additionalParams?: Record<string, unknown>;
		apiKey: string;
	}): Promise<Record<string, unknown>> {
		const { model, prompt, editImage, size, quality, numImages, seed, additionalParams, apiKey } = params;

		const isEditModel = model.includes('edit');
		const url = isEditModel
			? 'https://api.modelscope.cn/v1/images/edit'
			: 'https://api.modelscope.cn/v1/images/generations';

		const headers = {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		};

		const body: Record<string, unknown> = {
			model,
			prompt,
		};

		if (isEditModel && editImage) {
			body.image = editImage;
		}

		if (size) {
			body.size = size;
		}

		if (quality !== undefined) {
			body.quality = quality;
		}

		if (numImages !== undefined) {
			body.n = numImages;
		}

		if (seed !== undefined) {
			body.seed = seed;
		}

		if (additionalParams) {
			Object.assign(body, additionalParams);
		}

		const response = await this.makeRequest({
			url,
			method: 'POST',
			headers,
			body,
			timeout: 60000,
		});

		if (!response.success) {
			throw new MediaGenError(
				response.error || 'Failed to call ModelScope API',
				'API_ERROR'
			);
		}

		if (!response.data) {
			throw new MediaGenError('No data returned from ModelScope API', 'API_ERROR');
		}

		return response.data as Record<string, unknown>;
	}
}
