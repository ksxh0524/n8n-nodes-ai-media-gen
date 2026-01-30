/**
 * Options for creating binary data
 */
export interface BinaryDataOptions {
	/** Data as Buffer or base64 string */
	data: Buffer | string;
	/** MIME type of the data */
	mimeType: string;
	/** Filename for the data */
	fileName: string;
}

/**
 * Creates a binary data object for n8n
 *
 * Converts Buffer or base64 data to the format expected by n8n's binary data.
 *
 * @param options - Binary data creation options
 * @returns Binary data object
 *
 * @example
 * ```typescript
 * const binary = createBinaryData({
 *   data: Buffer.from('...'),
 *   mimeType: 'image/png',
 *   fileName: 'generated_image.png',
 * });
 * ```
 */
export function createBinaryData(options: BinaryDataOptions): Record<string, any> {
	const base64 = options.data instanceof Buffer
		? options.data.toString('base64')
		: options.data;

	return {
		data: base64,
		mimeType: options.mimeType,
		fileName: options.fileName,
	};
}

/**
 * Generates a filename with timestamp
 *
 * @param prefix - Filename prefix
 * @param extension - File extension (without dot)
 * @returns Generated filename
 *
 * @example
 * ```typescript
 * generateFileName('video', 'mp4'); // "video_1706666789123.mp4"
 * ```
 */
export function generateFileName(prefix: string, extension: string): string {
	return `${prefix}_${Date.now()}.${extension}`;
}

/**
 * Detects MIME type from a URL or file extension
 *
 * @param url - URL or filename
 * @returns Detected MIME type or default
 *
 * @example
 * ```typescript
 * detectMimeTypeFromUrl('https://example.com/image.jpg'); // "image/jpeg"
 * detectMimeTypeFromUrl('video.mp4'); // "video/mp4"
 * ```
 */
export function detectMimeTypeFromUrl(url: string): string {
	const lowerUrl = url.toLowerCase();

	// Images
	if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) {
		return 'image/jpeg';
	}
	if (lowerUrl.endsWith('.png')) {
		return 'image/png';
	}
	if (lowerUrl.endsWith('.webp')) {
		return 'image/webp';
	}
	if (lowerUrl.endsWith('.gif')) {
		return 'image/gif';
	}
	if (lowerUrl.endsWith('.svg')) {
		return 'image/svg+xml';
	}
	if (lowerUrl.endsWith('.bmp')) {
		return 'image/bmp';
	}

	// Video
	if (lowerUrl.endsWith('.mp4')) {
		return 'video/mp4';
	}
	if (lowerUrl.endsWith('.webm')) {
		return 'video/webm';
	}
	if (lowerUrl.endsWith('.mov')) {
		return 'video/quicktime';
	}
	if (lowerUrl.endsWith('.avi')) {
		return 'video/x-msvideo';
	}

	// Audio
	if (lowerUrl.endsWith('.mp3')) {
		return 'audio/mpeg';
	}
	if (lowerUrl.endsWith('.wav')) {
		return 'audio/wav';
	}
	if (lowerUrl.endsWith('.ogg')) {
		return 'audio/ogg';
	}
	if (lowerUrl.endsWith('.m4a')) {
		return 'audio/mp4';
	}

	// Default
	return 'application/octet-stream';
}

/**
 * Extracts file extension from a URL or filename
 *
 * @param url - URL or filename
 * @returns File extension without dot, or 'bin' if unknown
 *
 * @example
 * ```typescript
 * getFileExtension('image.jpg'); // "jpg"
 * getFileExtension('https://example.com/video.mp4'); // "mp4"
 * ```
 */
export function getFileExtension(url: string): string {
	const match = url.match(/\.([^.?#]+)(?:[?#]|$)/);
	return match ? match[1].toLowerCase() : 'bin';
}

/**
 * Creates binary data from a URL
 *
 * This is a helper for when you need to create a binary object
 * but only have the URL. It detects MIME type and generates filename.
 *
 * @param buffer - Data buffer
 * @param url - Source URL (for MIME type detection)
 * @param prefix - Filename prefix
 * @returns Binary data object
 *
 * @example
 * ```typescript
 * const binary = await createBinaryDataFromUrl(
 *   imageBuffer,
 *   'https://example.com/image.jpg',
 *   'generated_image'
 * );
 * ```
 */
export function createBinaryDataFromUrl(
	buffer: Buffer,
	url: string,
	prefix: string
): Record<string, any> {
	const mimeType = detectMimeTypeFromUrl(url);
	const extension = getFileExtension(url);
	const fileName = generateFileName(prefix, extension);

	return createBinaryData({
		data: buffer,
		mimeType,
		fileName,
	});
}

/**
 * Validates if data is valid base64
 *
 * @param str - String to validate
 * @returns true if valid base64
 */
export function isValidBase64(str: string): boolean {
	if (typeof str !== 'string') {
		return false;
	}

	// Check if it matches base64 pattern
	const base64Regex = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/;
	if (base64Regex.test(str)) {
		return true;
	}

	// Check if it's pure base64 (no data URL prefix)
	const pureBase64Regex = /^[A-Za-z0-9+/]+=*$/;
	return pureBase64Regex.test(str) && str.length % 4 === 0;
}

/**
 * Extracts base64 data from a data URL
 *
 * @param dataUrl - Data URL string (e.g., "data:image/png;base64,...")
 * @returns Base64 data without prefix
 * @throws Error if invalid data URL
 *
 * @example
 * ```typescript
 * extractBase64FromDataUrl('data:image/png;base64,iVBORw0KG...'); // "iVBORw0KG..."
 * ```
 */
export function extractBase64FromDataUrl(dataUrl: string): string {
	const match = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
	if (!match) {
		throw new Error('Invalid data URL format');
	}
	return match[2];
}
