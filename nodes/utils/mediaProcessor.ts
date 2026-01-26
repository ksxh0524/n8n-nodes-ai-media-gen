/**
 * Media Processor for n8n-nodes-ai-media-gen
 * Unified interface for image and video processing
 */

import { ImageProcessor } from './imageProcessor';
import type {
	ImageInput,
	ImageMetadata,
	ResizeOptions,
	CropOptions,
	ConvertOptions,
	FilterOptions,
	WatermarkOptions,
	ExtendedCompressOptions,
	RotateOptions,
	FlipOptions,
	AdjustOptions,
	BlurOptions,
	SharpenOptions,
	N8nBinaryData,
} from './imageTypes';
import { VideoProcessor } from './videoProcessor';
import type {
	VideoInput,
	VideoMetadata,
	TranscodeOptions,
	TrimOptions,
	MergeOptions,
	ExtractFramesOptions,
	AddAudioOptions,
	ExtractAudioOptions,
	ResizeVideoOptions,
} from './videoTypes';
import { MediaGenError, ERROR_CODES } from './errors';

/**
 * Media type
 */
export type MediaType = 'image' | 'video';

/**
 * Media input
 */
export type MediaInput = ImageInput | VideoInput;

/**
 * Media metadata
 */
export type MediaMetadata = ImageMetadata | VideoMetadata;

/**
 * Process configuration
 */
export interface MediaProcessConfig {
	type: MediaType;
	input: MediaInput;
	operations: MediaOperation[];
}

/**
 * Media operation types
 */
export type MediaOperationType =
	| 'resize'
	| 'crop'
	| 'convert'
	| 'filter'
	| 'watermark'
	| 'compress'
	| 'rotate'
	| 'flip'
	| 'adjust'
	| 'blur'
	| 'sharpen'
	| 'transcode'
	| 'trim'
	| 'merge'
	| 'extractFrames'
	| 'addAudio'
	| 'extractAudio'
	| 'resizeVideo';

/**
 * Media operation
 */
export interface MediaOperation {
	type: MediaOperationType;
	options:
		| ResizeOptions
		| CropOptions
		| ConvertOptions
		| FilterOptions
		| WatermarkOptions
		| ExtendedCompressOptions
		| RotateOptions
		| FlipOptions
		| AdjustOptions
		| BlurOptions
		| SharpenOptions
		| TranscodeOptions
		| TrimOptions
		| MergeOptions
		| ExtractFramesOptions
		| AddAudioOptions
		| ExtractAudioOptions
		| ResizeVideoOptions;
}

/**
 * Process result
 */
export interface ProcessResult {
	success: boolean;
	data?: Buffer | Buffer[];
	metadata?: MediaMetadata;
	error?: string;
}

/**
 * MediaProcessor configuration options
 */
export interface MediaProcessorOptions {
	maxFileSize?: number;
	timeout?: number;
	tempDir?: string;
}

/**
 * MediaProcessor class for unified media processing
 */
export class MediaProcessor {
	private imageProcessor: ImageProcessor | null = null;
	private videoProcessor: VideoProcessor | null = null;
	private mediaType: MediaType | null = null;
	private options: MediaProcessorOptions;

	constructor(options: MediaProcessorOptions = {}) {
		this.options = options;
	}

	/**
	 * Load media from input
	 */
	async loadMedia(input: MediaInput): Promise<void> {
		try {
			if (this.isImageInput(input)) {
				this.mediaType = 'image';
				this.imageProcessor = new ImageProcessor({
					maxFileSize: this.options.maxFileSize,
					timeout: this.options.timeout,
				});
				await this.imageProcessor.loadImage(input);
			} else if (this.isVideoInput(input)) {
				this.mediaType = 'video';
				this.videoProcessor = new VideoProcessor({
					maxFileSize: this.options.maxFileSize,
					timeout: this.options.timeout,
					tempDir: this.options.tempDir,
				});
				await this.videoProcessor.loadVideo(input);
			} else {
				throw new MediaGenError(
					'Unsupported media input type',
					ERROR_CODES.INVALID_PARAMS
				);
			}
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to load media: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Check if input is image
	 */
	private isImageInput(input: MediaInput): input is ImageInput {
		const imageTypes: ImageInput['type'][] = ['url', 'base64', 'binary', 'n8n-binary'];
		return imageTypes.includes(input.type);
	}

	/**
	 * Check if input is video
	 */
	private isVideoInput(input: MediaInput): input is VideoInput {
		const videoTypes: VideoInput['type'][] = ['url', 'base64', 'binary', 'n8n-binary', 'buffer'];
		return videoTypes.includes(input.type);
	}

	/**
	 * Get media metadata
	 */
	async getMetadata(): Promise<MediaMetadata | undefined> {
		if (this.mediaType === 'image' && this.imageProcessor) {
			return await this.imageProcessor.getMetadata();
		}
		if (this.mediaType === 'video' && this.videoProcessor) {
			return await this.videoProcessor.getMetadata();
		}
		return undefined;
	}

	/**
	 * Process media with configuration
	 */
	async process(config: MediaProcessConfig): Promise<ProcessResult> {
		try {
			await this.loadMedia(config.input);

			for (const operation of config.operations) {
				await this.executeOperation(operation);
			}

			const buffer = await this.toBuffer();
			const metadata = await this.getMetadata();

			return {
				success: true,
				data: buffer,
				metadata,
			};
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Execute a single operation
	 */
	private async executeOperation(operation: MediaOperation): Promise<void> {
		if (this.mediaType === 'image' && this.imageProcessor) {
			await this.executeImageOperation(operation);
		} else if (this.mediaType === 'video' && this.videoProcessor) {
			await this.executeVideoOperation(operation);
		} else {
			throw new MediaGenError(
				'No media loaded. Call loadMedia() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Execute image operation
	 */
	private async executeImageOperation(operation: MediaOperation): Promise<void> {
		if (!this.imageProcessor) {
			throw new MediaGenError('Image processor not initialized', ERROR_CODES.IMAGE_PROCESSING_FAILED);
		}

		switch (operation.type) {
			case 'resize':
				await this.imageProcessor.resize(operation.options as ResizeOptions);
				break;
			case 'crop':
				await this.imageProcessor.crop(operation.options as CropOptions);
				break;
			case 'convert':
				await this.imageProcessor.convert(operation.options as ConvertOptions);
				break;
			case 'filter':
				await this.imageProcessor.filter(operation.options as FilterOptions);
				break;
			case 'watermark':
				await this.imageProcessor.watermark(operation.options as WatermarkOptions);
				break;
			case 'compress':
				await this.imageProcessor.compress(operation.options as ExtendedCompressOptions);
				break;
			case 'rotate':
				await this.imageProcessor.rotate(operation.options as RotateOptions);
				break;
			case 'flip':
				await this.imageProcessor.flip(operation.options as FlipOptions);
				break;
			case 'adjust':
				await this.imageProcessor.adjust(operation.options as AdjustOptions);
				break;
			case 'blur':
				await this.imageProcessor.blur(operation.options as BlurOptions);
				break;
			case 'sharpen':
				await this.imageProcessor.sharpen(operation.options as SharpenOptions);
				break;
			default:
				throw new MediaGenError(
					`Unsupported image operation: ${operation.type}`,
					ERROR_CODES.INVALID_PARAMS
				);
		}
	}

	/**
	 * Execute video operation
	 */
	private async executeVideoOperation(operation: MediaOperation): Promise<void> {
		if (!this.videoProcessor) {
			throw new MediaGenError('Video processor not initialized', ERROR_CODES.IMAGE_PROCESSING_FAILED);
		}

		switch (operation.type) {
			case 'transcode':
				await this.videoProcessor.transcode(operation.options as TranscodeOptions);
				break;
			case 'trim':
				await this.videoProcessor.trim(operation.options as TrimOptions);
				break;
			case 'merge':
				await this.videoProcessor.merge(operation.options as MergeOptions);
				break;
			case 'extractFrames':
				await this.videoProcessor.extractFrames(operation.options as ExtractFramesOptions);
				break;
			case 'addAudio':
				await this.videoProcessor.addAudio(operation.options as AddAudioOptions);
				break;
			case 'extractAudio':
				await this.videoProcessor.extractAudio(operation.options as ExtractAudioOptions);
				break;
			case 'resizeVideo':
				await this.videoProcessor.resize(operation.options as ResizeVideoOptions);
				break;
			default:
				throw new MediaGenError(
					`Unsupported video operation: ${operation.type}`,
					ERROR_CODES.INVALID_PARAMS
				);
		}
	}

	/**
	 * Resize media
	 */
	async resize(options: ResizeOptions | ResizeVideoOptions): Promise<void> {
		if (this.mediaType === 'image' && this.imageProcessor) {
			await this.imageProcessor.resize(options as ResizeOptions);
		} else if (this.mediaType === 'video' && this.videoProcessor) {
			await this.videoProcessor.resize(options as ResizeVideoOptions);
		} else {
			throw new MediaGenError(
				'No media loaded. Call loadMedia() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Convert media format
	 */
	async convert(options: ConvertOptions | TranscodeOptions): Promise<void> {
		if (this.mediaType === 'image' && this.imageProcessor) {
			await this.imageProcessor.convert(options as ConvertOptions);
		} else if (this.mediaType === 'video' && this.videoProcessor) {
			await this.videoProcessor.transcode(options as TranscodeOptions);
		} else {
			throw new MediaGenError(
				'No media loaded. Call loadMedia() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Output media as Buffer
	 */
	async toBuffer(): Promise<Buffer> {
		if (this.mediaType === 'image' && this.imageProcessor) {
			return await this.imageProcessor.toBuffer();
		}
		if (this.mediaType === 'video' && this.videoProcessor) {
			return await this.videoProcessor.toBuffer();
		}
		throw new MediaGenError(
			'No media loaded. Call loadMedia() first.',
			ERROR_CODES.IMAGE_PROCESSING_FAILED
		);
	}

	/**
	 * Output media as n8n binary format
	 */
	async toN8nBinary(fileName: string): Promise<N8nBinaryData | N8nBinaryData[]> {
		if (this.mediaType === 'image' && this.imageProcessor) {
			return await this.imageProcessor.toN8nBinary(fileName);
		}
		if (this.mediaType === 'video' && this.videoProcessor) {
			return await this.videoProcessor.toN8nBinary(fileName);
		}
		throw new MediaGenError(
			'No media loaded. Call loadMedia() first.',
			ERROR_CODES.IMAGE_PROCESSING_FAILED
		);
	}

	/**
	 * Clean up resources
	 */
	async destroy(): Promise<void> {
		if (this.imageProcessor) {
			this.imageProcessor.destroy();
			this.imageProcessor = null;
		}
		if (this.videoProcessor) {
			await this.videoProcessor.destroy();
			this.videoProcessor = null;
		}
		this.mediaType = null;
	}

	/**
	 * Get media type
	 */
	getMediaType(): MediaType | null {
		return this.mediaType;
	}

	/**
	 * Get image processor
	 */
	getImageProcessor(): ImageProcessor | null {
		return this.imageProcessor;
	}

	/**
	 * Get video processor
	 */
	getVideoProcessor(): VideoProcessor | null {
		return this.videoProcessor;
	}
}
