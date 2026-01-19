export interface NormalizedResponse {
	success: boolean;
	url?: string;
	mimeType?: string;
	data?: any;
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
}

export class ResponseNormalizer {
	static normalize(
		response: any,
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
		model: string
	): NormalizedResponse {
		return {
			success: false,
			error: error.message,
			errorCode: error.name,
			metadata: {
				provider,
				model,
				mediaType: 'image',
				timestamp: new Date().toISOString(),
				cached: false,
			},
		};
	}

	private static extractUrl(
		response: any,
		mediaType: 'image' | 'audio' | 'video',
		provider: string
	): string | undefined {
		if (!response) return undefined;

		switch (provider) {
			case 'openai':
				if (response.data?.[0]?.url) {
					return response.data[0].url;
				}
				break;

			case 'gemini':
				if (response.image) {
					return response.image;
				}
				break;

			case 'bailian':
				if (response.output?.url) {
					return response.output.url;
				}
				if (response.output?.audio_url) {
					return response.output.audio_url;
				}
				if (response.output?.video_url) {
					return response.output.video_url;
				}
				break;

			case 'replicate':
				if (response.output) {
					return response.output;
				}
				break;

			case 'huggingface':
				if (typeof response === 'string') {
					return response;
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
