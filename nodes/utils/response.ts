export interface NormalizedResponse {
	success: boolean;
	url?: string;
	mimeType?: string;
	data?: unknown;
	metadata: {
		provider: string;
		model: string;
		mediaType: 'image' | 'audio' | 'video';
		timestamp: string;
		cached: boolean;
		duration?: number;
	};
	error?: string;
	errorCode?: string;
	[key: string]: unknown;
}

export class ResponseNormalizer {
	static normalize(
		response: unknown,
		mediaType: 'image' | 'audio' | 'video',
		provider: string,
		model: string,
		cached: boolean = false,
		duration?: number
	): NormalizedResponse {
		const url = ResponseNormalizer.extractUrl(response, mediaType, provider);
		const mimeType = ResponseNormalizer.getMimeType(mediaType);

		return {
			success: true,
			url,
			mimeType,
			data: response,
			metadata: {
				provider,
				model,
				mediaType,
				timestamp: new Date().toISOString(),
				cached,
				duration,
			},
		};
	}

	static normalizeError(
		error: Error,
		provider: string,
		model: string,
		mediaType: 'image' | 'audio' | 'video' = 'image'
	): NormalizedResponse {
		return {
			success: false,
			error: error.message,
			errorCode: error.name,
			metadata: {
				provider,
				model,
				mediaType,
				timestamp: new Date().toISOString(),
				cached: false,
			},
		};
	}

	private static extractUrl(
		response: unknown,
		_mediaType: 'image' | 'audio' | 'video',
		provider: string
	): string | undefined {
		if (!response) return undefined;

		switch (provider) {
			case 'openai': {
				const openaiResponse = response as Record<string, unknown>;
				if (Array.isArray(openaiResponse.data) && openaiResponse.data.length > 0) {
					const firstItem = openaiResponse.data[0] as Record<string, unknown>;
					if (typeof firstItem.url === 'string') {
						return firstItem.url;
					}
				}
				break;
			}

			case 'gemini': {
				const geminiResponse = response as Record<string, unknown>;
				if (typeof geminiResponse.image === 'string') {
					return geminiResponse.image;
				}
				break;
			}

			case 'bailian': {
				const bailianResponse = response as Record<string, unknown>;
				const output = bailianResponse.output as Record<string, unknown> | undefined;
				if (output) {
					if (typeof output.url === 'string') {
						return output.url;
					}
					if (typeof output.audio_url === 'string') {
						return output.audio_url;
					}
					if (typeof output.video_url === 'string') {
						return output.video_url;
					}
				}
				break;
			}

			case 'replicate': {
				const replicateResponse = response as Record<string, unknown>;
				const output = replicateResponse.output as unknown;
				if (typeof output === 'string') {
					return output;
				}
				if (Array.isArray(output) && output.length > 0) {
					const firstItem = output[0];
					if (typeof firstItem === 'string') {
						return firstItem;
					}
				}
				break;
			}

			case 'huggingface': {
				if (typeof response === 'string') {
					return response;
				}
				const hfResponse = response as Record<string, unknown>;
				if (typeof hfResponse.url === 'string') {
					return hfResponse.url;
				}
				const image = hfResponse.image as unknown;
				if (typeof image === 'string') {
					return image;
				}
				if (image && typeof image === 'object' && image !== null) {
					const imageObj = image as Record<string, unknown>;
					if (typeof imageObj.url === 'string') {
						return imageObj.url;
					}
				}
				if (Array.isArray(response) && response.length > 0) {
					const firstItem = response[0];
					if (typeof firstItem === 'string') {
						return firstItem;
					}
					if (typeof firstItem === 'object' && firstItem !== null) {
						const firstItemObj = firstItem as Record<string, unknown>;
						if (typeof firstItemObj.url === 'string') {
							return firstItemObj.url;
						}
					}
				}
				break;
			}
		}

		return undefined;
	}

	private static getMimeType(mediaType: 'image' | 'audio' | 'video'): string {
		const mimeTypes = {
			image: 'image/png',
			audio: 'audio/mp3',
			video: 'video/mp4',
		};
		return mimeTypes[mediaType];
	}
}
