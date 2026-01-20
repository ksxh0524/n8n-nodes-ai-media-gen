import type { ModelConfig } from '../configManager';

export interface OpenAIRequest {
	model: string;
	prompt: string;
	params?: Record<string, unknown>;
	image?: string;
}

export interface OpenAIResponse {
	success: boolean;
	url?: string;
	data?: unknown;
	error?: string;
}

export class OpenAIProvider {
	private static baseUrl = 'https://api.openai.com/v1';
	private static apiKey = '';

	static setApiKey(apiKey: string): void {
		OpenAIProvider.apiKey = apiKey;
	}

	static async generateImage(request: OpenAIRequest): Promise<OpenAIResponse> {
		const response = await fetch(`${OpenAIProvider.baseUrl}/images/generations`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${OpenAIProvider.apiKey}`,
			},
			body: JSON.stringify({
				model: request.model,
				prompt: request.prompt,
				...request.params,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`OpenAI API error: ${errorText}`);
		}

		return await response.json();
	}

	static async generateVideo(request: OpenAIRequest): Promise<OpenAIResponse> {
		const response = await fetch(`${OpenAIProvider.baseUrl}/videos/generations`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${OpenAIProvider.apiKey}`,
			},
			body: JSON.stringify({
				model: request.model,
				prompt: request.prompt,
				...request.params,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`OpenAI API error: ${errorText}`);
		}

		return await response.json();
	}

	static async editImage(request: OpenAIRequest): Promise<OpenAIResponse> {
		const response = await fetch(`${OpenAIProvider.baseUrl}/images/edits`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${OpenAIProvider.apiKey}`,
			},
			body: JSON.stringify({
				model: request.model,
				prompt: request.prompt,
				image: request.image,
				...request.params,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`OpenAI API error: ${errorText}`);
		}

		return await response.json();
	}

	static normalizeResponse(response: unknown): OpenAIResponse {
		if (response && typeof response === 'object') {
			const data = response as Record<string, unknown>;
			
			if (data.data && Array.isArray(data.data) && data.data.length > 0) {
				const firstItem = data.data[0] as Record<string, unknown>;
				return {
					success: true,
					url: firstItem.url as string,
					data: response,
				};
			}
		}

		return {
			success: false,
			error: 'Invalid response from OpenAI API',
		};
	}
}
