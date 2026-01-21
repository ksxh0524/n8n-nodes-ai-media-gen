/**
 * Image Processor for n8n-nodes-ai-media-gen
 * Handles image loading, processing, and conversion operations using sharp
 */

import sharp from 'sharp';
import { MediaGenError, ERROR_CODES } from './errors';
import type {
	ImageInput,
	ImageMetadata,
	ResizeOptions,
	CropOptions,
	ConvertOptions,
	N8nBinaryData,
	ImageProcessorOptions,
} from './imageTypes';
import {
	FORMAT_TO_MIME_TYPE,
	EXTENSION_TO_FORMAT,
	SUPPORTED_IMAGE_FORMATS,
} from './imageTypes';

/**
 * Default configuration values
 */
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Supported image MIME types
 */
const SUPPORTED_MIME_TYPES = new Set<string>(Object.values(FORMAT_TO_MIME_TYPE));

/**
 * ImageProcessor class for handling image operations
 */
export class ImageProcessor {
	private image: sharp.Sharp | null = null;
	private maxFileSize: number;
	private timeout: number;
	private currentBuffer: Buffer | null = null;

	constructor(options: ImageProcessorOptions = {}) {
		this.maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
		this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
	}

	/**
	 * Load image from various input sources
	 */
	async loadImage(input: ImageInput): Promise<void> {
		try {
			let buffer: Buffer;

			switch (input.type) {
				case 'url':
					if (!input.url) {
						throw new MediaGenError('URL is required for url type', ERROR_CODES.INVALID_PARAMS);
					}
					buffer = await this.loadFromUrl(input.url);
					break;

				case 'base64':
					if (!input.data) {
						throw new MediaGenError('Data is required for base64 type', ERROR_CODES.INVALID_PARAMS);
					}
					buffer = this.loadFromBase64(input.data as string);
					break;

				case 'binary':
				case 'n8n-binary':
					if (!input.data) {
						throw new MediaGenError('Data is required for binary type', ERROR_CODES.INVALID_PARAMS);
					}
					buffer = input.data instanceof Buffer ? input.data : Buffer.from(input.data as string, 'base64');
					break;

				default:
					throw new MediaGenError(
						`Unsupported input type: ${(input as ImageInput).type}`,
						ERROR_CODES.INVALID_PARAMS
					);
			}

			// Validate file size
			if (buffer.length > this.maxFileSize) {
				throw new MediaGenError(
					`Image file size (${buffer.length} bytes) exceeds maximum allowed size (${this.maxFileSize} bytes)`,
					ERROR_CODES.IMAGE_TOO_LARGE
				);
			}

			this.currentBuffer = buffer;
			this.image = sharp(buffer);
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to load image: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Load image from URL
	 */
	private async loadFromUrl(url: string): Promise<Buffer> {
		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(this.timeout),
			});

			if (!response.ok) {
				throw new MediaGenError(
					`Failed to fetch image from URL: ${response.statusText} (${response.status})`,
					ERROR_CODES.NETWORK_ERROR
				);
			}

			const contentType = response.headers.get('content-type');
			if (contentType && !SUPPORTED_MIME_TYPES.has(contentType)) {
				throw new MediaGenError(
					`Unsupported content type: ${contentType}`,
					ERROR_CODES.UNSUPPORTED_FORMAT
				);
			}

			const arrayBuffer = await response.arrayBuffer();
			return Buffer.from(arrayBuffer);
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			if (error instanceof TypeError && error.message.includes('timeout')) {
				throw new MediaGenError(
					`Request timeout: Failed to load image within ${this.timeout}ms`,
					ERROR_CODES.TIMEOUT
				);
			}
			throw new MediaGenError(
				`Failed to load image from URL: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.NETWORK_ERROR
			);
		}
	}

	/**
	 * Load image from base64 string
	 */
	private loadFromBase64(base64: string): Buffer {
		try {
			// Remove data URL prefix if present
			let cleanBase64 = base64;
			const match = base64.match(/^data:([^;]+);base64,(.+)$/);
			if (match) {
				const mimeType = match[1];
				if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
					throw new MediaGenError(
						`Unsupported content type: ${mimeType}`,
						ERROR_CODES.UNSUPPORTED_FORMAT
					);
				}
				cleanBase64 = match[2];
			}

			// Validate base64 format
			if (!cleanBase64 || cleanBase64.length === 0) {
				throw new MediaGenError(
					'Invalid base64 data: empty string',
					ERROR_CODES.INVALID_PARAMS
				);
			}

			const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
			if (!base64Regex.test(cleanBase64)) {
				throw new MediaGenError(
					'Invalid base64 format: contains invalid characters',
					ERROR_CODES.INVALID_PARAMS
				);
			}

			// Check for proper padding
			if (cleanBase64.length % 4 !== 0) {
				throw new MediaGenError(
					'Invalid base64 format: incorrect padding',
					ERROR_CODES.INVALID_PARAMS
				);
			}

			const buffer = Buffer.from(cleanBase64, 'base64');

			// Verify the buffer is not empty
			if (buffer.length === 0) {
				throw new MediaGenError(
					'Invalid base64 data: resulted in empty buffer',
					ERROR_CODES.INVALID_PARAMS
				);
			}

			return buffer;
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to parse base64 data: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.INVALID_PARAMS
			);
		}
	}

	/**
	 * Get image metadata from the current sharp instance
	 * Note: This returns metadata of the original loaded image, not after processing
	 */
	async getMetadata(): Promise<ImageMetadata> {
		if (!this.image) {
			throw new MediaGenError(
				'No image loaded. Call loadImage() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}

		try {
			const metadata = await this.image.metadata();
			return {
				format: metadata.format || 'unknown',
				width: metadata.width || 0,
				height: metadata.height || 0,
				channels: metadata.channels || 0,
				prefixed: (metadata as any).prefixed,
				hasAlpha: metadata.hasAlpha || false,
				hasProfile: metadata.hasProfile || false,
				isProgressive: metadata.isProgressive || false,
				fileSize: this.currentBuffer?.length,
				orientation: metadata.orientation,
				density: metadata.density,
				chromaSubsampling: metadata.chromaSubsampling,
				isLinear: (metadata as any).isLinear,
			};
		} catch (error) {
			throw new MediaGenError(
				`Failed to get metadata: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Get metadata from a buffer
	 * This is useful for getting metadata of a processed image
	 */
	static async getMetadataFromBuffer(buffer: Buffer): Promise<ImageMetadata> {
		try {
			const metadata = await sharp(buffer).metadata();
			return {
				format: metadata.format || 'unknown',
				width: metadata.width || 0,
				height: metadata.height || 0,
				channels: metadata.channels || 0,
				prefixed: (metadata as any).prefixed,
				hasAlpha: metadata.hasAlpha || false,
				hasProfile: metadata.hasProfile || false,
				isProgressive: metadata.isProgressive || false,
				fileSize: buffer.length,
				orientation: metadata.orientation,
				density: metadata.density,
				chromaSubsampling: metadata.chromaSubsampling,
				isLinear: (metadata as any).isLinear,
			};
		} catch (error) {
			throw new MediaGenError(
				`Failed to get metadata from buffer: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Resize image
	 */
	async resize(options: ResizeOptions): Promise<void> {
		if (!this.image) {
			throw new MediaGenError(
				'No image loaded. Call loadImage() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}

		try {
			this.image = this.image.resize({
				width: options.width,
				height: options.height,
				fit: options.fit,
				kernel: options.kernel,
				withoutEnlargement: options.withoutEnlargement,
				position: options.position as any,
			});
		} catch (error) {
			throw new MediaGenError(
				`Failed to resize image: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Crop image
	 */
	async crop(options: CropOptions): Promise<void> {
		if (!this.image) {
			throw new MediaGenError(
				'No image loaded. Call loadImage() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}

		try {
			this.image = this.image.extract({
				left: options.left,
				top: options.top,
				width: options.width,
				height: options.height,
			});
		} catch (error) {
			throw new MediaGenError(
				`Failed to crop image: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Convert image to different format with compression options
	 */
	async convert(options: ConvertOptions): Promise<void> {
		if (!this.image) {
			throw new MediaGenError(
				'No image loaded. Call loadImage() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}

		try {
			const compressOptions = options.compressOptions || {};

			switch (options.format) {
				case 'jpeg':
					this.image = this.image.jpeg({
						quality: compressOptions.quality,
						progressive: compressOptions.progressive,
					});
					break;
				case 'png':
					this.image = this.image.png({
						progressive: compressOptions.progressive,
						effort: compressOptions.effort,
					});
					break;
				case 'webp':
					this.image = this.image.webp({
						quality: compressOptions.quality,
						nearLossless: compressOptions.nearLossless,
						effort: compressOptions.effort,
					});
					break;
				case 'gif':
					this.image = this.image.gif({
						effort: compressOptions.effort,
					});
					break;
				case 'tiff':
					this.image = this.image.tiff({
						quality: compressOptions.quality,
					});
					break;
				case 'avif':
					this.image = this.image.avif({
						quality: compressOptions.quality,
						effort: compressOptions.effort,
					});
					break;
				default:
					throw new MediaGenError(
						`Unsupported format: ${options.format}`,
						ERROR_CODES.UNSUPPORTED_FORMAT
					);
			}
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to convert image: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Output image as Buffer
	 */
	async toBuffer(): Promise<Buffer> {
		if (!this.image) {
			throw new MediaGenError(
				'No image loaded. Call loadImage() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}

		try {
			return await this.image.toBuffer();
		} catch (error) {
			throw new MediaGenError(
				`Failed to output buffer: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Output image as n8n binary format
	 */
	async toN8nBinary(fileName: string): Promise<N8nBinaryData> {
		try {
			const buffer = await this.toBuffer();
			const metadata = await ImageProcessor.getMetadataFromBuffer(buffer);

			// Determine file extension from format
			const fileExtension = `.${metadata.format === 'jpeg' ? 'jpg' : metadata.format}`;

			const mimeType = metadata.format as keyof typeof FORMAT_TO_MIME_TYPE;
			return {
				data: buffer.toString('base64'),
				mimeType: FORMAT_TO_MIME_TYPE[mimeType] || 'image/jpeg',
				fileName: fileName || `image${fileExtension}`,
				fileExtension,
				fileSize: buffer.length.toString(),
			};
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to output n8n binary: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Get the format from file name
	 */
	static getFormatFromFileName(fileName: string): string {
		const ext = fileName.toLowerCase().split('.').pop();
		if (ext && EXTENSION_TO_FORMAT[`.${ext}`]) {
			return EXTENSION_TO_FORMAT[`.${ext}`];
		}
		return 'jpeg'; // Default to JPEG
	}

	/**
	 * Get MIME type from file name
	 */
	static getMimeTypeFromFileName(fileName: string): string {
		const format = ImageProcessor.getFormatFromFileName(fileName);
		const formatKey = format as keyof typeof FORMAT_TO_MIME_TYPE;
		return FORMAT_TO_MIME_TYPE[formatKey] || 'image/jpeg';
	}

	/**
	 * Validate if a format is supported
	 */
	static isFormatSupported(format: string): boolean {
		return SUPPORTED_IMAGE_FORMATS.includes(format as any);
	}

	/**
	 * Get supported formats
	 */
	static getSupportedFormats(): typeof SUPPORTED_IMAGE_FORMATS {
		return SUPPORTED_IMAGE_FORMATS;
	}

	/**
	 * Get supported MIME types
	 */
	static getSupportedMimeTypes(): typeof SUPPORTED_MIME_TYPES {
		return SUPPORTED_MIME_TYPES;
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		if (this.image) {
			this.image.destroy();
			this.image = null;
		}
		this.currentBuffer = null;
	}
}
