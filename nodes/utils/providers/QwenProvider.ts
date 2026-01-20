import type { ModelConfig } from '../configManager';

export interface QwenRequest {
	model: string;
	prompt: string;
	params?: Record<string, unknown>;
	image?: string;
}

export interface QwenResponse {
	success: boolean;
	url?: string;
	data?: unknown;
	error?: string;
}

export class QwenProvider {
	private static baseUrl = 'https://dashscope.aliyuncs.com/api/v1';
	private static apiKey = '';

	static setApiKey(apiKey: string): void {
		QwenProvider.apiKey = apiKey;
	}

	static async generateImage(request: QwenRequest): Promise<QwenResponse> {
		const response = await fetch(`${QwenProvider.baseUrl}/services/aigc/text2image/image-synthesis`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${QwenProvider.apiKey}`,
			},
			body: JSON.stringify({
				model: request.model,
				input: {
					prompt: request.prompt,
				},
				parameters: request.params,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Qwen API error: ${errorText}`);
		}

		return await response.json();
	}

	static async editImage(request: QwenRequest): Promise<QwenResponse> {
		const response = await fetch(`${QwenProvider.baseUrl}/services/aigc/image-edit/image-edit`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${QwenProvider.apiKey}`,
			},
			body: JSON.stringify({
				model: request.model,
				input: {
					prompt: request.prompt,
					image_url: request.image,
				},
				parameters: request.params,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Qwen API error: ${errorText}`);
		}

		return await response.json();
	}

	static async generateVideo(request: QwenRequest): Promise<QwenResponse> {
		const response = await fetch(`${QwenProvider.baseUrl}/services/aigc/text2video/video-synthesis`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${QwenProvider.apiKey}`,
			},
			body: JSON.stringify({
				model: request.model,
				input: {
					prompt: request.prompt,
				},
				parameters: request.params,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Qwen API error: ${errorText}`);
		}

		return await response.json();
	}

	static normalizeResponse(response: unknown): QwenResponse {
		if (response && typeof response === 'object') {
			const data = response as Record<string, unknown>;
			
			if (data.output) {
				const output = data.output as Record<string, unknown>;
				if (output.url) {
					return {
						success: true,
						url: output.url as string,
						data: response,
					};
				}
				if (output.results && Array.isArray(output.results) && output.results.length > 0) {
					const firstResult = output.results[0] as Record<string, unknown>;
					if (firstResult.url) {
						return {
							success: true,
							url: firstResult.url as string,
							data: response,
						};
					}
				}
			}
		}

		return {
			success: false,
			error: 'Invalid response from Qwen API',
		};
	}
}
