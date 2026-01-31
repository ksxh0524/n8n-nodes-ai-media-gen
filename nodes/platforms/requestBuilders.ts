import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import type {
	ModelScopeParams,
	DoubaoParams,
	SoraParams,
	VeoParams,
	NanoBananaParams,
	Credentials,
} from '../types/platforms';

/**
 * Platform-specific request builders
 *
 * Provides consistent request building for all supported platforms.
 */
export class RequestBuilders {
	/**
	 * Builds ModelScope API request
	 *
	 * @param context - n8n execution context
	 * @param itemIndex - Current item index
	 * @param params - ModelScope parameters
	 * @param credentials - API credentials
	 * @returns HTTP request options
	 */
	static buildModelScopeRequest(
		_context: IExecuteFunctions,
		_itemIndex: number,
		params: ModelScopeParams,
		credentials: Credentials
	): IHttpRequestOptions {
		const { mode, model, prompt, size, inputImages = [] } = params;

		// Validate size if provided
		const finalSize = size || '2048x2048';

		let body: Record<string, unknown>;

		if (mode === 'text-to-image') {
			body = {
				model,
				input: {
					prompt: prompt.trim(),
				},
				parameters: {
					size: finalSize,
				},
			};
		} else if (mode === 'image-to-image') {
			body = {
				model,
				input: {
					prompt: prompt.trim(),
				},
				parameters: {
					size: finalSize,
					image: inputImages[0] || '',
				},
			};
		} else {
			throw new Error(`Unknown ModelScope mode: ${mode}`);
		}

		const baseUrl = (credentials as { baseUrl?: string }).baseUrl || 'https://api-inference.modelscope.cn/v1';

		return {
			method: 'POST' as const,
			url: `${baseUrl}/matches/text2image`,
			body,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${credentials.apiKey}`,
			},
		};
	}

	/**
	 * Builds Doubao API request
	 *
	 * @param context - n8n execution context
	 * @param itemIndex - Current item index
	 * @param params - Doubao parameters
	 * @param credentials - API credentials
	 * @returns HTTP request options
	 */
	static buildDoubaoRequest(
		_context: IExecuteFunctions,
		_itemIndex: number,
		params: DoubaoParams,
		credentials: Credentials
	): IHttpRequestOptions | FormData {
		const { mode, model, prompt, size, seed } = params;
		const baseUrl = (credentials as { baseUrl?: string }).baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';

		// Normalize seed
		const seedValue = seed !== undefined && seed >= 0 ? seed : undefined;

		if (mode === 'text-to-image') {
			const body = {
				model,
				prompt: prompt.trim(),
				size,
				stream: false,
				watermark: false,
				seed: seedValue,
			};

			return {
				method: 'POST' as const,
				url: `${baseUrl}/images/generations`,
				body,
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${credentials.apiKey}`,
				},
			};
		} else if (mode === 'image-to-image') {
			// For image-to-image, use FormData
			const formData = new FormData();
			formData.append('model', model);
			formData.append('prompt', prompt);
			formData.append('size', size);
			formData.append('stream', 'false');
			formData.append('watermark', 'false');

			if (seedValue) {
				formData.append('seed', seedValue.toString());
			}

			return {
				method: 'POST' as const,
				url: `${baseUrl}/images/edits`,
				body: formData as unknown as Record<string, unknown>,
				headers: {
					Authorization: `Bearer ${credentials.apiKey}`,
				},
			};
		} else {
			throw new Error(`Unknown Doubao mode: ${mode}`);
		}
	}

	/**
	 * Builds Sora API request
	 *
	 * @param context - n8n execution context
	 * @param itemIndex - Current item index
	 * @param params - Sora parameters
	 * @param credentials - API credentials
	 * @returns HTTP request options
	 */
	static buildSoraRequest(
		_context: IExecuteFunctions,
		_itemIndex: number,
		params: SoraParams,
		credentials: Credentials
	): IHttpRequestOptions {
		const { model, prompt, aspectRatio, duration, hd = false, inputImage } = params;

		const body: Record<string, unknown> = {
			model,
			prompt: prompt.trim(),
			aspect_ratio: aspectRatio,
			duration,
		};

		if (hd) {
			body.hd = true;
		}

		if (inputImage) {
			body.images = [inputImage];
		}

		const baseUrl = (credentials as { baseUrl?: string }).baseUrl || 'https://api.openai.com/v1';

		return {
			method: 'POST' as const,
			url: `${baseUrl}/videos/generations`,
			body,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${credentials.apiKey}`,
			},
		};
	}

	/**
	 * Builds Veo API request
	 *
	 * @param context - n8n execution context
	 * @param itemIndex - Current item index
	 * @param params - Veo parameters
	 * @param credentials - API credentials
	 * @returns HTTP request options
	 */
	static buildVeoRequest(
		_context: IExecuteFunctions,
		_itemIndex: number,
		params: VeoParams,
		credentials: Credentials
	): IHttpRequestOptions {
		const { model, prompt, aspectRatio, duration, inputImage } = params;

		const body: Record<string, unknown> = {
			model,
			prompt: prompt.trim(),
			aspect_ratio: aspectRatio,
			duration,
		};

		if (inputImage) {
			body.image = inputImage;
		}

		// Veo uses Google API (similar to Gemini)
		const baseUrl = (credentials as { baseUrl?: string }).baseUrl || 'https://generativelanguage.googleapis.com/v1beta';

		return {
			method: 'POST' as const,
			url: `${baseUrl}/${model}:predictLongRunning`,
			body,
			headers: {
				'Content-Type': 'application/json',
			},
		};
	}

	/**
	 * Builds Nano Banana (Gemini) API request
	 *
	 * @param context - n8n execution context
	 * @param itemIndex - Current item index
	 * @param params - Nano Banana parameters
	 * @param credentials - API credentials
	 * @returns HTTP request options
	 */
	static buildNanoBananaRequest(
		_context: IExecuteFunctions,
		_itemIndex: number,
		params: NanoBananaParams,
		credentials: Credentials
	): IHttpRequestOptions {
		const { model, prompt, size = '2048x2048', seed } = params;

		const body = {
			contents: [
				{
					parts: [
						{
							text: prompt,
						},
					],
				},
			],
			generationConfig: {
				responseMimeType: 'application/json',
			},
		};

		// Add size and seed parameters
		if (size) {
			(body.contents[0] as { parts: unknown[] }).parts.push({
				'@type': 'type.googleapis.com/google.type.Parameter',
				name: 'size',
			});
			(body.contents[0] as { parts: unknown[] }).parts.push({
				'@type': 'type.googleapis.com/google.type.StringValue',
				value: size,
			});
		}

		if (seed !== undefined && seed >= 0) {
			(body.contents[0] as { parts: unknown[] }).parts.push({
				'@type': 'type.googleapis.com/google.type.Parameter',
				name: 'seed',
			});
			(body.contents[0] as { parts: unknown[] }).parts.push({
				'@type': 'type.googleapis.com/google.type.Int64Value',
				value: seed.toString(),
			});
		}

		const host = (credentials as { host?: string }).host || 'ai.comfly.chat';
		const baseUrl = `https://${host}/v1beta`;

		return {
			method: 'POST' as const,
			url: `${baseUrl}/models/${model}:generateContent`,
			body,
			headers: {
				'Content-Type': 'application/json',
			},
		};
	}
}
