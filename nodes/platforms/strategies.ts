import type { IExecuteFunctions, INodeExecutionData, IHttpRequestOptions, IHttpRequestMethods } from 'n8n-workflow';

import { BasePlatformStrategy, type PlatformConfig } from '../utils/mediaGenExecutor';
import { MediaGenError } from '../utils/errors';
import { ResponseHandler } from '../utils/index';
import { RequestBuilders } from './requestBuilders';
import { ResponseParsers } from './responseParsers';
import type { ParsedMediaResponse, Credentials } from '../types/platforms';
import { DEFAULT_SUNO_MODEL } from '../constants/sunoModels';

/**
 * ModelScope platform strategy
 */
export class ModelScopeStrategy extends BasePlatformStrategy {
	getConfig(): PlatformConfig {
		return {
			operation: 'modelscope',
			credentialType: 'modelScopeApi',
			provider: 'modelScope',
			mediaType: 'image',
		};
	}

	extractParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown> {
		const model = context.getNodeParameter('model', itemIndex) as string;
		const mode = 'text-to-image'; // Default mode
		const prompt = context.getNodeParameter('prompt', itemIndex) as string;
		const size = this.getParam(context, 'size', itemIndex, '1024x1024');
		const seed = this.getParam(context, 'seed', itemIndex, 0);
		const numImages = this.getParam(context, 'numImages', itemIndex, 1);

		return {
			operation: 'modelscope' as const,
			mode,
			model,
			prompt,
			size,
			seed,
			numImages,
		};
	}

	buildCacheParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown> {
		const size = this.getParam(context, 'size', itemIndex, '1024x1024');
		const seed = this.getParam(context, 'seed', itemIndex, 0);
		const numImages = this.getParam(context, 'numImages', itemIndex, 1);

		return {
			size,
			seed,
			num_images: numImages,
		};
	}

	protected buildRequest(
		_context: IExecuteFunctions,
		_itemIndex: number,
		params: Record<string, unknown>,
		credentials: Credentials
	): { method: string; url: string; body?: unknown; headers?: Record<string, string> } {
		return RequestBuilders.buildModelScopeRequest(
			_context,
			_itemIndex,
			params as any,
			credentials
		) as IHttpRequestOptions as any;
	}

	protected parseResponse(response: unknown): ParsedMediaResponse {
		return ResponseParsers.parseModelScopeResponse(response);
	}

	protected buildResult(
		parsed: ParsedMediaResponse,
		params: Record<string, unknown>
	): INodeExecutionData {
		const config = this.getConfig();
		const imageData = ResponseHandler.handleImageData(parsed.imageUrl, parsed.base64Data);

		// Handle async tasks
		if (parsed.metadata?.async) {
			return ResponseHandler.buildSuccessResponse(
				{
					model: params.model as string,
					taskId: parsed.metadata.taskId as string,
					async: true,
					provider: config.provider,
					mediaType: config.mediaType,
				},
				{
					provider: config.provider,
					mediaType: config.mediaType,
					...parsed.metadata,
				}
			);
		}

		return ResponseHandler.buildSuccessResponse(
			{
				model: params.model as string,
				imageUrl: imageData,
				provider: config.provider,
				mediaType: config.mediaType,
			},
			{
				provider: config.provider,
				mediaType: config.mediaType,
				...parsed.metadata,
			}
		);
	}
}

/**
 * Doubao platform strategy
 */
export class DoubaoStrategy extends BasePlatformStrategy {
	getConfig(): PlatformConfig {
		return {
			operation: 'doubao',
			credentialType: 'doubaoApi',
			provider: 'doubao',
			mediaType: 'image',
		};
	}

	extractParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown> {
		const model = context.getNodeParameter('doubaoModel', itemIndex) as string;
		const mode = context.getNodeParameter('doubaoMode', itemIndex) as string;
		const prompt = context.getNodeParameter('doubaoPrompt', itemIndex) as string;
		const resolutionLevel = this.getParam(context, 'doubaoResolutionLevel', itemIndex, '2K');

		// Get size based on resolution level
		let size = '2048x2048';
		if (resolutionLevel === '2K') {
			size = this.getParam(context, 'doubaoSize2K', itemIndex, '2048x2048');
		} else {
			size = this.getParam(context, 'doubaoSize4K', itemIndex, '4096x4096');
		}

		const seed = this.getParam(context, 'doubaoSeed', itemIndex, -1);

		// Get input images for image-to-image mode
		let inputImages: string[] = [];
		if (mode === 'image-to-image') {
			try {
				const imagesData = context.getNodeParameter('doubaoInputImages', itemIndex) as {
					image?: Array<{ url: string }>;
				};
				if (imagesData.image && imagesData.image.length > 0) {
					inputImages = imagesData.image.map(img => img.url);
				}
			} catch (error) {
				// No input images
			}
		}

		return {
			operation: 'doubao' as const,
			mode,
			model,
			prompt,
			size,
			seed: seed >= 0 ? seed : undefined,
			resolutionLevel,
			inputImages,
		};
	}

	buildCacheParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown> {
		const resolutionLevel = this.getParam(context, 'doubaoResolutionLevel', itemIndex, '2K');
		const mode = context.getNodeParameter('doubaoMode', itemIndex) as string;
		const seed = this.getParam(context, 'doubaoSeed', itemIndex, -1);

		let size = '2048x2048';
		if (resolutionLevel === '2K') {
			size = this.getParam(context, 'doubaoSize2K', itemIndex, '2048x2048');
		} else {
			size = this.getParam(context, 'doubaoSize4K', itemIndex, '4096x4096');
		}

		const cacheParams: Record<string, unknown> = {
			mode,
			resolutionLevel,
			size,
			seed: seed >= 0 ? seed : undefined,
		};

		// Add input images for image-to-image mode
		if (mode === 'image-to-image') {
			try {
				const imagesData = context.getNodeParameter('doubaoInputImages', itemIndex) as {
					image?: Array<{ url: string }>;
				};
				if (imagesData.image && imagesData.image.length > 0) {
					cacheParams.images = imagesData.image.map(img => img.url).join('|');
					cacheParams.imageCount = imagesData.image.length;
				}
			} catch (error) {
				// No input images
			}
		}

		return cacheParams;
	}

	protected buildRequest(
		_context: IExecuteFunctions,
		_itemIndex: number,
		params: Record<string, unknown>,
		credentials: Credentials
	): { method: string; url: string; body?: unknown; headers?: Record<string, string> } {
		const request = RequestBuilders.buildDoubaoRequest(
			_context,
			_itemIndex,
			params as any,
			credentials
		);

		// Handle FormData case
		if (request instanceof FormData) {
			return {
				method: 'POST',
				url: '', // Will be set by the request builder
				body: request as any,
			};
		}

		return request as IHttpRequestOptions as any;
	}

	protected parseResponse(response: unknown): ParsedMediaResponse {
		return ResponseParsers.parseDoubaoResponse(response);
	}
}

/**
 * Sora platform strategy
 */
export class SoraStrategy extends BasePlatformStrategy {
	getConfig(): PlatformConfig {
		return {
			operation: 'sora',
			credentialType: 'openAiApi',
			provider: 'sora',
			mediaType: 'video',
		};
	}

	extractParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown> {
		const model = context.getNodeParameter('soraModel', itemIndex) as string;
		const prompt = context.getNodeParameter('soraPrompt', itemIndex) as string;
		const aspectRatio = context.getNodeParameter('soraAspectRatio', itemIndex) as string;
		const duration = context.getNodeParameter('soraDuration', itemIndex) as string;
		const hd = this.getParam(context, 'soraHd', itemIndex, false);

		// Get input image (optional)
		let inputImage: string | undefined;
		try {
			const imageData = context.getNodeParameter('soraInputImage', itemIndex) as string;
			if (imageData) {
				inputImage = imageData;
			}
		} catch (error) {
			// No input image
		}

		return {
			operation: 'sora' as const,
			model,
			prompt,
			aspectRatio,
			duration,
			hd,
			inputImage,
		};
	}

	buildCacheParams(_context: IExecuteFunctions, itemIndex: number): Record<string, unknown> {
		const aspectRatio = _context.getNodeParameter('soraAspectRatio', itemIndex) as string;
		const duration = _context.getNodeParameter('soraDuration', itemIndex) as string;
		const hd = this.getParam(_context, 'soraHd', itemIndex, false);

		return {
			aspectRatio,
			duration,
			hd,
		};
	}

	protected buildRequest(
		_context: IExecuteFunctions,
		_itemIndex: number,
		params: Record<string, unknown>,
		credentials: Credentials
	): { method: string; url: string; body?: unknown; headers?: Record<string, string> } {
		return RequestBuilders.buildSoraRequest(
			_context,
			_itemIndex,
			params as any,
			credentials
		) as IHttpRequestOptions as any;
	}

	protected parseResponse(response: unknown): ParsedMediaResponse {
		return ResponseParsers.parseSoraResponse(response);
	}

	protected buildResult(
		parsed: ParsedMediaResponse,
		params: Record<string, unknown>
	): INodeExecutionData {
		const config = this.getConfig();

		// Handle async tasks
		if (parsed.metadata?.status) {
			return ResponseHandler.buildSuccessResponse(
				{
					model: params.model as string,
					taskId: parsed.metadata.taskId as string,
					status: parsed.metadata.status as string,
					async: true,
					provider: config.provider,
					mediaType: config.mediaType,
				},
				{
					provider: config.provider,
					mediaType: config.mediaType,
					...parsed.metadata,
				}
			);
		}

		return ResponseHandler.buildSuccessResponse(
			{
				model: params.model as string,
				videoUrl: parsed.videoUrl,
				provider: config.provider,
				mediaType: config.mediaType,
			},
			{
				provider: config.provider,
				mediaType: config.mediaType,
				...parsed.metadata,
			}
		);
	}
}

/**
 * Veo platform strategy
 */
export class VeoStrategy extends BasePlatformStrategy {
	getConfig(): PlatformConfig {
		return {
			operation: 'veo',
			credentialType: 'googlePalmApi',
			provider: 'veo',
			mediaType: 'video',
		};
	}

	extractParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown> {
		const model = context.getNodeParameter('veoModel', itemIndex) as string;
		const prompt = context.getNodeParameter('veoPrompt', itemIndex) as string;
		const aspectRatio = context.getNodeParameter('veoAspectRatio', itemIndex) as string;
		const duration = context.getNodeParameter('veoDuration', itemIndex) as string;

		// Get input image (optional)
		let inputImage: string | undefined;
		try {
			const imageData = context.getNodeParameter('veoInputImage', itemIndex) as string;
			if (imageData) {
				inputImage = imageData;
			}
		} catch (error) {
			// No input image
		}

		return {
			operation: 'veo' as const,
			model,
			prompt,
			aspectRatio,
			duration,
			inputImage,
		};
	}

	buildCacheParams(_context: IExecuteFunctions, itemIndex: number): Record<string, unknown> {
		const aspectRatio = _context.getNodeParameter('veoAspectRatio', itemIndex) as string;
		const duration = _context.getNodeParameter('veoDuration', itemIndex) as string;

		return {
			aspectRatio,
			duration,
		};
	}

	protected buildRequest(
		_context: IExecuteFunctions,
		_itemIndex: number,
		params: Record<string, unknown>,
		credentials: Credentials
	): { method: string; url: string; body?: unknown; headers?: Record<string, string> } {
		return RequestBuilders.buildVeoRequest(
			_context,
			_itemIndex,
			params as any,
			credentials
		) as IHttpRequestOptions as any;
	}

	protected parseResponse(response: unknown): ParsedMediaResponse {
		return ResponseParsers.parseVeoResponse(response);
	}

	protected buildResult(
		parsed: ParsedMediaResponse,
		params: Record<string, unknown>
	): INodeExecutionData {
		const config = this.getConfig();

		// Handle async tasks
		if (parsed.metadata?.status && parsed.metadata.status !== 'COMPLETED') {
			return ResponseHandler.buildSuccessResponse(
				{
					model: params.model as string,
					taskId: parsed.metadata.taskId as string,
					status: parsed.metadata.status as string,
					async: true,
					provider: config.provider,
					mediaType: config.mediaType,
				},
				{
					provider: config.provider,
					mediaType: config.mediaType,
					...parsed.metadata,
				}
			);
		}

		return ResponseHandler.buildSuccessResponse(
			{
				model: params.model as string,
				videoUrl: parsed.videoUrl,
				provider: config.provider,
				mediaType: config.mediaType,
			},
			{
				provider: config.provider,
				mediaType: config.mediaType,
				...parsed.metadata,
			}
		);
	}
}

/**
 * Nano Banana platform strategy
 */
export class NanoBananaStrategy extends BasePlatformStrategy {
	getConfig(): PlatformConfig {
		return {
			operation: 'nanoBanana',
			credentialType: 'googlePalmApi',
			provider: 'nanoBanana',
			mediaType: 'image',
		};
	}

	extractParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown> {
		const model = context.getNodeParameter('nbModel', itemIndex) as string;
		const mode = 'text-to-image';
		const prompt = context.getNodeParameter('nbPrompt', itemIndex) as string;
		const size = this.getParam(context, 'nbSize', itemIndex, '2048x2048');
		const seed = this.getParam(context, 'nbSeed', itemIndex, -1);

		// Get aspect ratio (only for nano-banana-2)
		let aspectRatio: string | undefined;
		if (model === 'nano-banana-2') {
			aspectRatio = this.getParam(context, 'nbAspectRatio', itemIndex, '1:1');
		}

		return {
			operation: 'nanoBanana' as const,
			mode,
			model,
			prompt,
			size,
			seed: seed >= 0 ? seed : undefined,
			aspectRatio,
		};
	}

	buildCacheParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown> {
		const model = context.getNodeParameter('nbModel', itemIndex) as string;
		const size = this.getParam(context, 'nbSize', itemIndex, '2048x2048');
		const seed = this.getParam(context, 'nbSeed', itemIndex, -1);

		const cacheParams: Record<string, unknown> = {
			size,
			seed: seed >= 0 ? seed : undefined,
		};

		// Add aspect ratio for nano-banana-2
		if (model === 'nano-banana-2') {
			cacheParams.aspectRatio = this.getParam(context, 'nbAspectRatio', itemIndex, '1:1');
			cacheParams.resolution = this.getParam(context, 'nbResolution', itemIndex, '2048x2048');
		} else {
			cacheParams.aspectRatio = this.getParam(context, 'nbAspectRatio', itemIndex, '1:1');
		}

		return cacheParams;
	}

	protected buildRequest(
		_context: IExecuteFunctions,
		_itemIndex: number,
		params: Record<string, unknown>,
		credentials: Credentials
	): { method: string; url: string; body?: unknown; headers?: Record<string, string> } {
		return RequestBuilders.buildNanoBananaRequest(
			_context,
			_itemIndex,
			params as any,
			credentials
		) as IHttpRequestOptions as any;
	}

	protected parseResponse(response: unknown): ParsedMediaResponse {
		return ResponseParsers.parseNanoBananaResponse(response);
	}
}

/**
 * Suno platform strategy
 */
export class SunoStrategy extends BasePlatformStrategy {
	getConfig(): PlatformConfig {
		return {
			operation: 'suno',
			credentialType: 'sunoApi',
			provider: 'suno',
			mediaType: 'audio',
		};
	}

	extractParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown> {
		const prompt = context.getNodeParameter('sunoPrompt', itemIndex) as string;
		const title = this.getParam(context, 'sunoTitle', itemIndex, '');
		const tags = this.getParam(context, 'sunoTags', itemIndex, '');
		const makeInstrumental = this.getParam(context, 'sunoMakeInstrumental', itemIndex, false);
		const model = this.getParam(context, 'sunoModel', itemIndex, DEFAULT_SUNO_MODEL);

		// Log extracted parameters
		context.logger?.info('[Suno] Extracted parameters', {
			promptLength: prompt.length,
			promptPreview: prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt,
			title,
			tags,
			makeInstrumental,
			model,
		});

		return {
			operation: 'suno' as const,
			model,
			prompt: prompt.trim(),
			title: title || undefined,
			tags: tags || undefined,
			makeInstrumental,
		};
	}

	buildCacheParams(context: IExecuteFunctions, itemIndex: number): Record<string, unknown> {
		const tags = this.getParam(context, 'sunoTags', itemIndex, '');
		const makeInstrumental = this.getParam(context, 'sunoMakeInstrumental', itemIndex, false);
		const model = this.getParam(context, 'sunoModel', itemIndex, DEFAULT_SUNO_MODEL);

		return {
			model,
			tags,
			makeInstrumental,
		};
	}

	/**
	 * Override executeRequest to add polling and audio download logic
	 */
	async executeRequest(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials: Credentials,
		params: Record<string, unknown>,
		timeout: number
	): Promise<INodeExecutionData> {
		const config = this.getConfig();

		// Import required modules
		const { pollSunoTask } = await import('../utils/polling');

		// Build initial request
		const request = this.buildRequest(context, itemIndex, params, credentials);

		// Log request details
		console.log('[Suno] Sending initial request');
		console.log('Method:', request.method);
		console.log('URL:', request.url);

		// Execute initial HTTP request
		let response: unknown;
		try {
			response = await context.helpers.httpRequest({
				method: request.method as IHttpRequestMethods,
				url: request.url as string,
				body: request.body as Record<string, unknown> | undefined,
				headers: request.headers as Record<string, string>,
				timeout,
			});
		} catch (error) {
			console.error('[Suno] Initial request failed:', error);
			context.logger?.error(`[${config.provider.toUpperCase()}] API Request Failed`, {
				error: error instanceof Error ? error.message : String(error),
				url: request.url,
			});
			throw error;
		}

		// Parse initial response
		const parsed = this.parseResponse(response);
		console.log('[Suno] Parsed response:', {
			hasTaskId: !!parsed.metadata?.taskId,
			hasAudioUrl: !!parsed.audioUrl,
			hasAudioUrls: !!parsed.audioUrls,
			audioUrlsCount: parsed.audioUrls?.length || 0,
			metadata: parsed.metadata
		});

		// If we already have audio URLs, handle them
		if (parsed.audioUrls && parsed.audioUrls.length > 0) {
			return this.handleMultipleAudioResponse(context, itemIndex, parsed, params);
		}

		// Legacy: single audio URL
		if (parsed.audioUrl) {
			return this.handleAudioResponse(context, itemIndex, parsed, params);
		}

		// If need polling (has taskId but not audio URL yet)
		if (parsed.metadata?.taskId && parsed.metadata.async) {
			const taskId = parsed.metadata.taskId as string;
			console.log('[Suno] Task submitted, polling for completion. Song ID:', taskId);

			// Poll for task completion using /suno/fetch/{songid}
			try {
				const pollResult = await pollSunoTask({
					context,
					taskId,
					credentials,
					statusEndpoint: '/suno/fetch',
					timeoutMs: 600000, // 10 minutes max
					logPrefix: 'Suno',
				});

				console.log('[Suno] Poll completed:', pollResult);

				// Parse the final poll result
				const finalParsed = this.parseResponse(pollResult);

				// If we got audio URLs from polling
				if (finalParsed.audioUrls && finalParsed.audioUrls.length > 0) {
					return this.handleMultipleAudioResponse(context, itemIndex, finalParsed, params);
				}

				// Legacy: single audio URL
				if (finalParsed.audioUrl) {
					return this.handleAudioResponse(context, itemIndex, finalParsed, params);
				}

				// Still no audio URL, return current status
				return this.buildResult(finalParsed, params);
			} catch (pollError) {
				console.error('[Suno] Polling failed:', pollError);
				// Return initial response on polling failure
				return this.buildResult(parsed, params);
			}
		}

		// No audio URL - return task info
		console.warn('[Suno] No audio URL in response, returning task info');
		return this.buildResult(parsed, params);
	}

	/**
	 * Handle response with multiple audio URLs
	 * Downloads binary for each song and returns array of songs in a single item
	 */
	private async handleMultipleAudioResponse(
		context: IExecuteFunctions,
		_itemIndex: number,
		parsed: ParsedMediaResponse,
		params: Record<string, unknown>
	): Promise<INodeExecutionData> {
		if (!parsed.audioUrls || parsed.audioUrls.length === 0) {
			console.error('[Suno] handleMultipleAudioResponse called but no audioUrls available');
			return this.buildResult(parsed, params);
		}

		console.log('[Suno] Got', parsed.audioUrls.length, 'songs');

		const config = this.getConfig();

		// Process all songs - always download binary AND keep URL
		const songs: Array<{
			id: string;
			audioUrl: string;
			binaryData: { data: string; mimeType: string; fileName: string };
			title?: string;
			tags?: string;
		}> = [];

		for (let i = 0; i < parsed.audioUrls.length; i++) {
			const song = parsed.audioUrls[i];
			console.log(`[Suno] Processing song ${i + 1}/${parsed.audioUrls.length}:`, {
				id: song.id,
				title: song.title,
			});

			// Download binary data
			let binaryData: { data: string; mimeType: string; fileName: string };
			try {
				const audioBuffer = await context.helpers.httpRequest({
					method: 'GET',
					url: song.audioUrl,
					encoding: 'arraybuffer',
					timeout: 60000,
				}) as Buffer;

				console.log(`[Suno] Downloaded song ${i + 1}, size:`, audioBuffer.byteLength);

				// Detect MIME type
				let mimeType = 'audio/mpeg';
				let extension = 'mp3';
				if (song.audioUrl.includes('.wav')) {
					mimeType = 'audio/wav';
					extension = 'wav';
				} else if (song.audioUrl.includes('.m4a')) {
					mimeType = 'audio/mp4';
					extension = 'm4a';
				}

				const base64 = audioBuffer.toString('base64');
				const fileName = song.title
					? `${song.title.replace(/[^a-zA-Z0-9]/g, '_')}_${i + 1}.${extension}`
					: `suno_${song.id}_${i + 1}.${extension}`;

				binaryData = {
					data: base64,
					mimeType,
					fileName,
				};
			} catch (error) {
				console.error(`[Suno] Failed to download song ${i + 1}:`, error);
				// Create empty binary data on failure
				binaryData = {
					data: '',
					mimeType: 'audio/mpeg',
					fileName: `error_${song.id}.mp3`,
				};
			}

			songs.push({
				id: song.id,
				audioUrl: song.audioUrl,
				binaryData,
				title: song.title,
				tags: song.tags,
			});
		}

		console.log('[Suno] Returning', songs.length, 'songs in single item');

		// Build response with all songs
		return ResponseHandler.buildSuccessResponse(
			{
				model: params.model as string,
				songs,
				provider: config.provider,
				mediaType: config.mediaType,
			},
			{
				provider: config.provider,
				mediaType: config.mediaType,
				...parsed.metadata,
				songCount: songs.length,
			}
		);
	}

	/**
	 * Handle response with audio URL
	 * Always downloads binary AND returns URL
	 */
	private async handleAudioResponse(
		context: IExecuteFunctions,
		_itemIndex: number,
		parsed: ParsedMediaResponse,
		params: Record<string, unknown>
	): Promise<INodeExecutionData> {
		const config = this.getConfig();

		// Type guard: ensure audioUrl exists
		if (!parsed.audioUrl) {
			console.error('[Suno] handleAudioResponse called but no audioUrl available');
			return this.buildResult(parsed, params);
		}

		const audioUrl: string = parsed.audioUrl;
		console.log('[Suno] Audio URL obtained:', audioUrl);
		console.log('[Suno] Downloading audio file...');

		// Always download binary data
		try {
			// Download audio file using n8n's httpRequest with arraybuffer encoding
			const audioBuffer = await context.helpers.httpRequest({
				method: 'GET',
				url: audioUrl,
				encoding: 'arraybuffer',
				timeout: 60000,
			}) as Buffer;

			console.log('[Suno] Audio file downloaded, size:', audioBuffer.byteLength);

			// Detect MIME type
			let mimeType = 'audio/mpeg';
			let extension = 'mp3';
			if (audioUrl.includes('.wav')) {
				mimeType = 'audio/wav';
				extension = 'wav';
			} else if (audioUrl.includes('.m4a')) {
				mimeType = 'audio/mp4';
				extension = 'm4a';
			}

			const base64 = audioBuffer.toString('base64');

			const binaryData = {
				data: base64,
				mimeType,
				fileName: `suno-${Date.now()}.${extension}`,
			};

			console.log('[Suno] Binary data prepared:', {
				mimeType,
				fileName: binaryData.fileName,
				dataSize: base64.length,
			});

			// Return with BOTH audioUrl AND binaryData
			return ResponseHandler.buildSuccessResponse(
				{
					model: params.model as string,
					audioUrl,
					binaryData,
					provider: config.provider,
					mediaType: config.mediaType,
				},
				{
					provider: config.provider,
					mediaType: config.mediaType,
					...parsed.metadata,
				}
			);
		} catch (error) {
			console.error('[Suno] Failed to download audio:', error);
			context.logger?.warn('[Suno] Audio download failed, returning URL only', {
				error: error instanceof Error ? error.message : String(error),
			});
			// Return URL only on download failure
			return this.buildResult(parsed, params);
		}
	}

	protected buildRequest(
		context: IExecuteFunctions,
		_itemIndex: number,
		params: Record<string, unknown>,
		credentials: Credentials
	): { method: string; url: string; body?: unknown; headers?: Record<string, string> } {
		const request = RequestBuilders.buildSunoRequest(
			context,
			_itemIndex,
			params as any,
			credentials
		) as IHttpRequestOptions as any;

		// Log request details
		context.logger?.info('[Suno] Built request', {
			method: request.method,
			url: request.url,
			hasBody: !!request.body,
			bodyKeys: request.body ? Object.keys(request.body as Record<string, unknown>) : [],
			hasHeaders: !!request.headers,
		});

		return request;
	}

	protected parseResponse(response: unknown): ParsedMediaResponse {
		// Log raw response before parsing
		const context = (this as any).context;
		context?.logger?.info('[Suno] Parsing response', {
			responseType: typeof response,
			responseKeys: response && typeof response === 'object' ? Object.keys(response as Record<string, unknown>) : 'N/A',
		});

		const parsed = ResponseParsers.parseSunoResponse(response);

		// Log parsed result
		context?.logger?.info('[Suno] Parsed response result', {
			hasAudioUrl: !!parsed.audioUrl,
			hasMetadata: !!parsed.metadata,
			metadata: parsed.metadata,
		});

		return parsed;
	}

	protected buildResult(
		parsed: ParsedMediaResponse,
		_params: Record<string, unknown>
	): INodeExecutionData {
		const config = this.getConfig();
		const model = _params.model as string;

		// If still processing, return task status
		if (parsed.metadata?.status && parsed.metadata.status !== 'succeeded') {
			return ResponseHandler.buildSuccessResponse(
				{
					model,
					taskId: parsed.metadata.taskId as string,
					status: parsed.metadata.status as string,
					async: true,
					provider: config.provider,
					mediaType: config.mediaType,
				},
				{
					provider: config.provider,
					mediaType: config.mediaType,
					...parsed.metadata,
				}
			);
		}

		// Return with audio URL if available
		return ResponseHandler.buildSuccessResponse(
			{
				model,
				audioUrl: parsed.audioUrl || undefined,
				provider: config.provider,
				mediaType: config.mediaType,
			},
			{
				provider: config.provider,
				mediaType: config.mediaType,
				...parsed.metadata,
			}
		);
	}
}

/**
 * Strategy registry
 *
 * Provides a single point to register and retrieve platform strategies.
 */
export class StrategyRegistry {
	private static strategies: Map<string, BasePlatformStrategy> = new Map();

	/**
	 * Register a strategy instance
	 */
	static register(operation: string, strategy: BasePlatformStrategy): void {
		this.strategies.set(operation, strategy);
	}

	/**
	 * Get a strategy instance
	 */
	static get(operation: string): BasePlatformStrategy {
		const strategy = this.strategies.get(operation);
		if (!strategy) {
			throw new MediaGenError(`Unknown operation: ${operation}`, 'INVALID_OPERATION');
		}
		return strategy;
	}

	/**
	 * Get all registered operations
	 */
	static getOperations(): string[] {
		return Array.from(this.strategies.keys());
	}
}

/**
 * Initialize all platform strategies
 */
export function initializeStrategies(): void {
	StrategyRegistry.register('modelscope', new ModelScopeStrategy());
	StrategyRegistry.register('doubao', new DoubaoStrategy());
	StrategyRegistry.register('sora', new SoraStrategy());
	StrategyRegistry.register('veo', new VeoStrategy());
	StrategyRegistry.register('nanoBanana', new NanoBananaStrategy());
	StrategyRegistry.register('suno', new SunoStrategy());
}
