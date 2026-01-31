import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

/**
 * Binary data representation
 */
export interface BinaryData {
	data: string;
	mimeType: string;
	fileName: string;
}

/**
 * Image download options
 */
export interface ImageDownloadOptions {
	/** Download timeout in milliseconds (default: 30000) */
	timeout?: number;
	/** Prefix for generated filename */
	prefix?: string;
	/** Whether to detect image dimensions (default: false) */
	detectDimensions?: boolean;
	/** Logger for output */
	logger?: IExecuteFunctions['logger'];
}

/**
 * Image dimensions
 */
export interface ImageDimensions {
	width: number;
	height: number;
}

/**
 * Unified image download utilities
 *
 * Provides consistent image downloading and processing across all platforms.
 */
export class ImageDownloader {
	/**
	 * Downloads an image from URL and converts to binary data
	 *
	 * @param context - n8n execution context
	 * @param imageUrl - URL of the image to download
	 * @param options - Download options
	 * @returns Binary data or null if download fails
	 */
	static async downloadImage(
		context: IExecuteFunctions,
		imageUrl: string,
		options: ImageDownloadOptions = {}
	): Promise<BinaryData | null> {
		const {
			timeout = 30000,
			prefix = 'generated',
			detectDimensions = false,
			logger,
		} = options;

		// Check if should download
		if (!imageUrl || imageUrl.startsWith('data:')) {
			return null;
		}

		try {
			logger?.info('[ImageDownloader] Downloading image', { url: imageUrl.substring(0, 50) + '...' });

			const imageBuffer = await context.helpers.httpRequest({
				method: 'GET',
				url: imageUrl,
				encoding: 'arraybuffer',
				timeout,
			}) as Buffer;

			const base64 = imageBuffer.toString('base64');
			const mimeType = this.detectMimeType(imageUrl, imageBuffer);
			const extension = this.getFileExtension(mimeType);

			// Detect dimensions if requested
			let dimensions: ImageDimensions | undefined;
			if (detectDimensions) {
				dimensions = this.getImageDimensions(imageBuffer);
				logger?.info('[ImageDownloader] Image downloaded', {
					mimeType,
					fileSize: imageBuffer.byteLength,
					dimensions: dimensions ? `${dimensions.width}x${dimensions.height}` : 'unknown',
				});
			}

			return {
				data: base64,
				mimeType,
				fileName: `${prefix}-${Date.now()}.${extension}`,
			};
		} catch (error) {
			logger?.warn('[ImageDownloader] Failed to download image', {
				error: error instanceof Error ? error.message : String(error),
			});
			return null;
		}
	}

	/**
	 * Downloads multiple images from URLs
	 *
	 * @param context - n8n execution context
	 * @param imageUrls - Array of image URLs
	 * @param options - Download options
	 * @returns Array of binary data (may contain null entries for failed downloads)
	 */
	static async downloadImages(
		context: IExecuteFunctions,
		imageUrls: string[],
		options: ImageDownloadOptions = {}
	): Promise<Array<BinaryData | null>> {
		const results: Array<BinaryData | null> = [];

		for (let i = 0; i < imageUrls.length; i++) {
			const binaryData = await this.downloadImage(context, imageUrls[i], {
				...options,
				prefix: options.prefix || `image-${i}`,
			});
			results.push(binaryData);
		}

		return results;
	}

	/**
	 * Extracts MIME type from URL or buffer
	 *
	 * @param url - Image URL
	 * @param buffer - Optional image buffer for better detection
	 * @returns MIME type string
	 */
	static detectMimeType(url: string, buffer?: Buffer): string {
		// First, try to detect from URL extension
		const urlLower = url.toLowerCase();
		if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) {
			return 'image/jpeg';
		}
		if (urlLower.endsWith('.png')) {
			return 'image/png';
		}
		if (urlLower.endsWith('.webp')) {
			return 'image/webp';
		}
		if (urlLower.endsWith('.gif')) {
			return 'image/gif';
		}
		if (urlLower.endsWith('.svg')) {
			return 'image/svg+xml';
		}
		if (urlLower.endsWith('.bmp')) {
			return 'image/bmp';
		}

		// Try to detect from buffer magic numbers
		if (buffer && buffer.length > 0) {
			return this.detectMimeTypeFromBuffer(buffer);
		}

		// Default to PNG
		return 'image/png';
	}

	/**
	 * Detects MIME type from buffer magic numbers
	 *
	 * @param buffer - Image buffer
	 * @returns MIME type string
	 */
	private static detectMimeTypeFromBuffer(buffer: Buffer): string {
		if (buffer.length < 4) {
			return 'image/png';
		}

		// Check for JPEG
		if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
			return 'image/jpeg';
		}

		// Check for PNG
		if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
			return 'image/png';
		}

		// Check for GIF
		if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
			return 'image/gif';
		}

		// Check for WebP
		if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
			return 'image/webp';
		}

		// Default to PNG
		return 'image/png';
	}

	/**
	 * Gets file extension from MIME type
	 *
	 * @param mimeType - MIME type string
	 * @returns File extension (without dot)
	 */
	static getFileExtension(mimeType: string): string {
		const extensionMap: Record<string, string> = {
			'image/jpeg': 'jpg',
			'image/png': 'png',
			'image/webp': 'webp',
			'image/gif': 'gif',
			'image/svg+xml': 'svg',
			'image/bmp': 'bmp',
		};

		return extensionMap[mimeType] || 'png';
	}

	/**
	 * Detects image dimensions from buffer
	 *
	 * Supports: PNG, JPEG, GIF, WebP, BMP
	 *
	 * @param buffer - Image buffer
	 * @returns Image dimensions or undefined if cannot detect
	 */
	static getImageDimensions(buffer: Buffer): ImageDimensions | undefined {
		if (!buffer || buffer.length < 8) {
			return undefined;
		}

		// Check for PNG
		if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
			// PNG dimensions are at offset 16-23 (width and height as 4-byte big-endian)
			if (buffer.length >= 24) {
				const width = buffer.readUInt32BE(16);
				const height = buffer.readUInt32BE(20);
				return { width, height };
			}
		}

		// Check for JPEG
		if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
			// JPEG dimensions are more complex, need to parse markers
			return this.getJpegDimensions(buffer);
		}

		// Check for GIF
		if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
			// GIF dimensions are at offset 6-9 (width and height as little-endian)
			if (buffer.length >= 10) {
				const width = buffer.readUInt16LE(6);
				const height = buffer.readUInt16LE(8);
				return { width, height };
			}
		}

		// Check for WebP
		if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
			return this.getWebPDimensions(buffer);
		}

		// Check for BMP
		if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
			// BMP dimensions are at offset 18-25 (width and height as little-endian)
			if (buffer.length >= 26) {
				const width = buffer.readUInt32LE(18);
				const height = buffer.readInt32LE(22);
				return { width, height: Math.abs(height) };
			}
		}

		return undefined;
	}

	/**
	 * Gets JPEG image dimensions
	 *
	 * @param buffer - JPEG buffer
	 * @returns Dimensions or undefined
	 */
	private static getJpegDimensions(buffer: Buffer): ImageDimensions | undefined {
		let i = 2;
		while (i < buffer.length) {
			// Look for SOF (Start Of Frame) markers
			if (buffer[i] === 0xFF && buffer[i + 1] >= 0xC0 && buffer[i + 1] <= 0xCF && buffer[i + 1] !== 0xC4 && buffer[i + 1] !== 0xC8 && buffer[i + 1] !== 0xCC) {
				if (i + 9 < buffer.length) {
					const height = buffer.readUInt16BE(i + 5);
					const width = buffer.readUInt16BE(i + 7);
					return { width, height };
				}
				break;
			}
			// Skip to next marker
			i += 2;
			const segmentLength = buffer.readUInt16BE(i);
			if (segmentLength < 2) {
				break;
			}
			i += segmentLength;
		}
		return undefined;
	}

	/**
	 * Gets WebP image dimensions
	 *
	 * @param buffer - WebP buffer
	 * @returns Dimensions or undefined
	 */
	private static getWebPDimensions(buffer: Buffer): ImageDimensions | undefined {
		// VP8 chunk starts at byte 12
		if (buffer.length < 30) {
			return undefined;
		}

		// Check for VP8
		if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38) {
			// Simple or extended VP8
			if (buffer[15] === 0x20 || buffer[15] === 0x58) {
				const width = (buffer[26] & 0x3F) << 8 | buffer[25];
				const height = (buffer[28] & 0x3F) << 8 | buffer[27];
				return { width, height };
			}
		}

		// Check for VP8L (lossless)
		if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4C) {
			const bits = (buffer[24] & 0xC0) >> 6;
			if (bits === 0) {
				let width = (buffer[24] & 0x3F) << 8 | buffer[25];
				let height = (buffer[26] & 0x3F) << 8 | buffer[27];
				width += 1;
				height += 1;
				return { width, height };
			}
		}

		return undefined;
	}

	/**
	 * Creates binary data property for n8n node output
	 *
	 * @param binaryData - Binary data object
	 * @returns Binary data property structure
	 */
	static createBinaryProperty(binaryData: BinaryData): {
		data: {
			data: string;
			mimeType: string;
			fileName: string;
		};
	} {
		return {
			data: {
				data: binaryData.data,
				mimeType: binaryData.mimeType,
				fileName: binaryData.fileName,
			},
		};
	}

	/**
	 * Attaches binary data to execution result
	 *
	 * @param result - Execution result
	 * @param binaryData - Binary data to attach
	 * @returns Result with binary data attached
	 */
	static attachBinaryData(
		result: INodeExecutionData,
		binaryData: BinaryData
	): INodeExecutionData {
		return {
			...result,
			binary: this.createBinaryProperty(binaryData),
		};
	}

	/**
	 * Extracts base64 data from data URI
	 *
	 * @param dataUri - Data URI string (e.g., "data:image/png;base64,...")
	 * @returns Base64 string or null if invalid
	 */
	static extractBase64FromDataUri(dataUri: string): string | null {
		if (!dataUri || !dataUri.startsWith('data:')) {
			return null;
		}

		const match = dataUri.match(/data:([^;]+);base64,(.+)/s);
		if (match && match[2]) {
			return match[2];
		}

		return null;
	}

	/**
	 * Creates binary data from data URI
	 *
	 * @param dataUri - Data URI string
	 * @param prefix - Filename prefix
	 * @returns Binary data or null if invalid
	 */
	static createBinaryDataFromDataUri(
		dataUri: string,
		prefix: string = 'data-uri'
	): BinaryData | null {
		const match = dataUri.match(/data:([^;]+);base64,(.+)/s);
		if (!match) {
			return null;
		}

		const mimeType = match[1];
		const base64 = match[2];
		const extension = this.getFileExtension(mimeType);

		return {
			data: base64,
			mimeType,
			fileName: `${prefix}-${Date.now()}.${extension}`,
		};
	}
}
