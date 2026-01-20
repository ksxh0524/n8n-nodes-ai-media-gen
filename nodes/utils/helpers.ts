import type { ApiFormat, IAdditionalParams } from './types';

export const MEDIA_TYPE_PATTERNS = {
	video: /^(sora|video|svd|cogvideo|wanx-video)/i,
	audio: /^(tts|audio|speech|voice|sambert|cosyvoice)/i,
} as const;

export type MediaType = 'image' | 'audio' | 'video';

export function detectMediaType(model: string): MediaType {
	const modelLower = model.toLowerCase();

	for (const [type, pattern] of Object.entries(MEDIA_TYPE_PATTERNS)) {
		if (pattern.test(modelLower)) {
			return type as MediaType;
		}
	}

	return 'image';
}

export function getDefaultBaseUrl(apiFormat: ApiFormat): string {
	const defaults: Record<ApiFormat, string> = {
		openai: 'https://api.openai.com/v1',
		gemini: 'https://generativelanguage.googleapis.com/v1beta',
		bailian: 'https://dashscope.aliyuncs.com/api/v1',
		replicate: 'https://api.replicate.com/v1',
		huggingface: 'https://api-inference.huggingface.co/models',
	};
	return defaults[apiFormat] || '';
}

export function getEndpoint(
	apiFormat: ApiFormat,
	mediaType: MediaType,
	model: string,
	apiKey?: string
): string {
	if (apiFormat === 'openai') {
		if (mediaType === 'image') return '/images/generations';
		if (mediaType === 'audio') return '/audio/speech';
		if (mediaType === 'video') return '/videos/generations';
	}

	if (apiFormat === 'gemini') {
		const separator = '?';
		const keyParam = apiKey ? `key=${apiKey}` : '';
		return `/models/${model}:predictImage${separator}${keyParam}`;
	}

	if (apiFormat === 'bailian') {
		if (mediaType === 'image') return '/services/aigc/text2image/image-synthesis';
		if (mediaType === 'audio') return '/services/aigc/text2speech/synthesis';
		if (mediaType === 'video') return '/services/aigc/text2video/video-synthesis';
	}

	if (apiFormat === 'replicate') {
		return `/predictions/${model}`;
	}

	if (apiFormat === 'huggingface') {
		return `/${model}`;
	}

	return '';
}

export function getHeaders(apiFormat: ApiFormat, apiKey: string): Record<string, string> {
	if (apiFormat === 'gemini') {
		return {
			'Content-Type': 'application/json',
		};
	}

	if (apiFormat === 'huggingface') {
		return {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		};
	}

	return {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${apiKey}`,
	};
}

export function buildRequestBody(
	apiFormat: ApiFormat,
	mediaType: MediaType,
	model: string,
	prompt: string,
	additional: IAdditionalParams
): unknown {
	if (apiFormat === 'openai') {
		const base: Record<string, unknown> = { model };

		if (mediaType === 'image') {
			base.prompt = prompt;
		} else if (mediaType === 'audio') {
			base.input = prompt;
		} else if (mediaType === 'video') {
			base.prompt = prompt;
		}

		return { ...base, ...additional };
	}

	if (apiFormat === 'gemini') {
		return {
			prompt: { text: prompt },
			...additional,
		};
	}

	if (apiFormat === 'bailian') {
		if (mediaType === 'image') {
			return {
				model,
				input: { prompt },
				parameters: additional,
			};
		}

		if (mediaType === 'audio') {
			return {
				model,
				input: { text: prompt },
				parameters: additional,
			};
		}

		if (mediaType === 'video') {
			return {
				model,
				input: { prompt },
				parameters: additional,
			};
		}
	}

	if (apiFormat === 'replicate') {
		return {
			input: {
				prompt,
				...additional,
			},
		};
	}

	if (apiFormat === 'huggingface') {
		return {
			inputs: prompt,
			parameters: additional,
		};
	}

	return { model, prompt, ...additional };
}
