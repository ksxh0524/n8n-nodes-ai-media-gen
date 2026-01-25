/**
 * Nano Banana Action Handler for n8n-nodes-ai-media-gen
 * Handles image generation using Nano Banana models
 */

import { BaseActionHandler, type IActionHandler, type ActionParameters, type ValidationResult } from '../utils/actionHandler';
import type { INodeExecutionData } from 'n8n-workflow';
import { MediaGenError } from '../utils/errors';
import type { IExecuteFunctions } from 'n8n-workflow';

/**
 * Nano Banana Action Handler
 */
export class NanoBananaActionHandler extends BaseActionHandler implements IActionHandler {
	readonly actionName = 'nanoBanana' as const;
	readonly displayName = 'Nano Banana (Image Generation)';
	readonly description = 'Generate images using Nano Banana AI models (nano-banana, nano-banana-pro, z-image-turbo)';
	readonly mediaType = 'image' as const;
	readonly credentialType = 'nanoBananaApi';
	readonly requiresCredential = true;

	constructor() {
		super(
			'nanoBanana',
			'Nano Banana (Image Generation)',
			'Generate images using Nano Banana AI models (nano-banana, nano-banana-pro, z-image-turbo)',
			'image',
			'nanoBananaApi',
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

		if (params.numImages !== undefined) {
			const numImages = Number(params.numImages);
			if (isNaN(numImages) || numImages < 1 || numImages > 10) {
				errors.push('Number of images must be between 1 and 10');
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
			const size = this.getParameter<string>(context, itemIndex, 'size');
			const quality = this.getParameter<number>(context, itemIndex, 'quality');
			const numImages = this.getParameter<number>(context, itemIndex, 'numImages');
			const seed = this.getParameter<number>(context, itemIndex, 'seed');
			const additionalParams = this.getParameter<Record<string, unknown>>(context, itemIndex, 'additionalParams');

			const validation = this.validateParameters({
				model,
				prompt,
				size,
				quality,
				numImages,
			});

			if (!validation.valid) {
				return this.buildErrorResponse(validation.errors.join(', '));
			}

			if (!credentials || !credentials.apiKey) {
				return this.buildErrorResponse('Nano Banana API key is required', 'INVALID_API_KEY');
			}

			const result = await this.callNanoBananaApi({
				model,
				prompt,
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
	 * Call Nano Banana API
	 */
	private async callNanoBananaApi(params: {
		model: string;
		prompt: string;
		size?: string;
		quality?: number;
		numImages?: number;
		seed?: number;
		additionalParams?: Record<string, unknown>;
		apiKey: string;
	}): Promise<Record<string, unknown>> {
		const { model, prompt, size, quality, numImages, seed, additionalParams, apiKey } = params;

		const url = 'https://api.nanobanana.com/v1/images/generations';
		const headers = {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		};

		const body: Record<string, unknown> = {
			model,
			prompt,
		};

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
				response.error || 'Failed to call Nano Banana API',
				'API_ERROR'
			);
		}

		if (!response.data) {
			throw new MediaGenError('No data returned from Nano Banana API', 'API_ERROR');
		}

		return response.data as Record<string, unknown>;
	}
}
