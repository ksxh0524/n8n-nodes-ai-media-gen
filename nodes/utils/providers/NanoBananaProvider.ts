import type { ModelConfig } from '../configManager';

export interface NanoBananaRequest {
	model: string;
	prompt: string;
	params?: Record<string, unknown>;
}

export interface NanoBananaResponse {
	success: boolean;
	url?: string;
	data?: unknown;
	error?: string;
}

export class NanoBananaProvider {
	private static baseUrl = 'https://api.nanobanana.com/v1';
	private static apiKey = '';

	static setApiKey(apiKey: string): void {
		NanoBananaProvider.apiKey = apiKey;
	}

	static async generate(request: NanoBananaRequest): Promise<NanoBananaResponse> {
		const response = await fetch(`${NanoBananaProvider.baseUrl}/generate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${NanoBananaProvider.apiKey}`,
			},
			body: JSON.stringify({
				model: request.model,
				prompt: request.prompt,
				...request.params,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Nano Banana API error: ${errorText}`);
		}

		return await response.json();
	}

	static normalizeResponse(response: unknown): NanoBananaResponse {
		if (response && typeof response === 'object') {
			const data = response as Record<string, unknown>;
			return {
				success: true,
				url: data.url as string,
				data: response,
			};
		}

		return {
			success: false,
			error: 'Invalid response from Nano Banana API',
		};
	}
}
