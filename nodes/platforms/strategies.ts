import type { IExecuteFunctions, INodeExecutionData, IHttpRequestOptions } from 'n8n-workflow';

import { BasePlatformStrategy, type PlatformConfig } from '../utils/mediaGenExecutor';
import { MediaGenError } from '../utils/errors';
import { ResponseHandler } from '../utils/index';
import { RequestBuilders } from './requestBuilders';
import { ResponseParsers } from './responseParsers';
import type { ParsedMediaResponse, Credentials } from '../types/platforms';

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
}
