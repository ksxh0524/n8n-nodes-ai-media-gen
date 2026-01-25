/**
 * Sora Action Handler for n8n-nodes-ai-media-gen
 * Handles video generation using Sora models
 */

import { BaseActionHandler, type IActionHandler, type ActionParameters, type ValidationResult } from '../utils/actionHandler';
import type { INodeExecutionData } from 'n8n-workflow';
import { MediaGenError } from '../utils/errors';
import type { IExecuteFunctions } from 'n8n-workflow';

/**
 * Sora Action Handler
 */
export class SoraActionHandler extends BaseActionHandler implements IActionHandler {
	readonly actionName = 'sora' as const;
	readonly displayName = 'Sora (Video Generation)';
	readonly description = 'Generate videos using Sora AI models (sora-2, sora-2-pro, veo-3.1)';
	readonly mediaType = 'video' as const;
	readonly credentialType = 'openAiApi';
	readonly requiresCredential = true;

	constructor() {
		super(
			'sora',
			'Sora (Video Generation)',
			'Generate videos using Sora AI models (sora-2, sora-2-pro, veo-3.1)',
			'video',
			'openAiApi',
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

		if (params.duration !== undefined) {
			const duration = Number(params.duration);
			if (isNaN(duration) || duration < 1 || duration > 120) {
				errors.push('Duration must be between 1 and 120 seconds');
			}
		}

		if (params.aspectRatio && typeof params.aspectRatio === 'string') {
			const validRatios = ['16:9', '9:16', '1:1', '4:3', '3:4'];
			if (!validRatios.includes(params.aspectRatio)) {
				errors.push(`Invalid aspect ratio. Must be one of: ${validRatios.join(', ')}`);
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
			const duration = this.getParameter<number>(context, itemIndex, 'duration');
			const aspectRatio = this.getParameter<string>(context, itemIndex, 'aspectRatio');
			const additionalParams = this.getParameter<Record<string, unknown>>(context, itemIndex, 'additionalParams');

			const validation = this.validateParameters({
				model,
				prompt,
				duration,
				aspectRatio,
			});

			if (!validation.valid) {
				return this.buildErrorResponse(validation.errors.join(', '));
			}

			if (!credentials || !credentials.apiKey) {
				return this.buildErrorResponse('OpenAI API key is required', 'INVALID_API_KEY');
			}

			const result = await this.callSoraApi({
				model,
				prompt,
				duration,
				aspectRatio,
				additionalParams,
				apiKey: credentials.apiKey as string,
			});

			return this.buildSuccessResponse(result, {
				model,
				mediaType: 'video',
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
	 * Call Sora API
	 */
	private async callSoraApi(params: {
		model: string;
		prompt: string;
		duration?: number;
		aspectRatio?: string;
		additionalParams?: Record<string, unknown>;
		apiKey: string;
	}): Promise<Record<string, unknown>> {
		const { model, prompt, duration, aspectRatio, additionalParams, apiKey } = params;

		const url = 'https://api.openai.com/v1/videos/generations';
		const headers = {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		};

		const body: Record<string, unknown> = {
			model,
			prompt,
		};

		if (duration !== undefined) {
			body.duration = duration;
		}

		if (aspectRatio) {
			body.aspect_ratio = aspectRatio;
		}

		if (additionalParams) {
			Object.assign(body, additionalParams);
		}

		const response = await this.makeRequest({
			url,
			method: 'POST',
			headers,
			body,
			timeout: 300000,
		});

		if (!response.success) {
			throw new MediaGenError(
				response.error || 'Failed to call Sora API',
				'API_ERROR'
			);
		}

		if (!response.data) {
			throw new MediaGenError('No data returned from Sora API', 'API_ERROR');
		}

		return response.data as Record<string, unknown>;
	}
}
