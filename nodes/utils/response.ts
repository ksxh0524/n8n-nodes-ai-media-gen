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
			case 'openai':
				if ((response as Record<string, unknown>).data?.[0]?.url) {
					return (response as Record<string, unknown>).data[0].url as string;
				}
				break;

			case 'gemini':
				if ((response as Record<string, unknown>).image) {
					return (response as Record<string, unknown>).image as string;
				}
				break;

			case 'bailian':
				if ((response as Record<string, unknown>).output?.url) {
					return (response as Record<string, unknown>).output.url as string;
				}
				if ((response as Record<string, unknown>).output?.audio_url) {
					return (response as Record<string, unknown>).output.audio_url as string;
				}
				if ((response as Record<string, unknown>).output?.video_url) {
					return (response as Record<string, unknown>).output.video_url as string;
				}
				break;

			case 'replicate':
				if ((response as Record<string, unknown>).output) {
					if (typeof (response as Record<string, unknown>).output === 'string') {
						return (response as Record<string, unknown>).output as string;
					}
					if (Array.isArray((response as Record<string, unknown>).output) && (response as Record<string, unknown>).output.length > 0) {
						return (response as Record<string, unknown>).output[0] as string;
					}
				}
				break;

			case 'huggingface':
				if (typeof response === 'string') {
					return response;
				}
				if ((response as Record<string, unknown>).url) {
					return (response as Record<string, unknown>).url as string;
				}
				if ((response as Record<string, unknown>).image) {
					if (typeof (response as Record<string, unknown>).image === 'string') {
						return (response as Record<string, unknown>).image as string;
					}
					if ((response as Record<string, unknown>).image?.url) {
						return (response as Record<string, unknown>).image.url as string;
					}
				}
				if (Array.isArray(response) && response.length > 0) {
					if (typeof response[0] === 'string') {
						return response[0];
					}
					if ((response[0] as Record<string, unknown>).url) {
						return (response[0] as Record<string, unknown>).url as string;
					}
				}
				break;
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
