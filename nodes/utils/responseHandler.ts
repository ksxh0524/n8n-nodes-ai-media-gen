import type { INodeExecutionData } from 'n8n-workflow';
import { MediaGenError } from './errors';
import type { BinaryData } from './imageDownloader';

/**
 * Response handler for AI media generation APIs
 *
 * Provides consistent handling of API responses across different providers.
 * Handles image URLs, base64 data, and various response formats.
 */
export class ResponseHandler {
	/**
	 * Extracts image data from various response formats
	 *
	 * Handles:
	 * 1. External URLs (non-data URLs that should be downloaded)
	 * 2. Base64 data (data:image/...;base64,...)
	 * 3. OpenAI-compatible format (data[].b64_json or data[].url)
	 * 4. Legacy format (output_url or b64_json)
	 *
	 * Priority order:
	 * - External URL (imageUrl && !startsWith('data:'))
	 * - Base64 data parameter
	 * - Data URI (imageUrl && startsWith('data:'))
	 *
	 * @param imageUrl - Optional image URL from response
	 * @param base64Data - Optional base64 data from response
	 * @returns The image data string or null if none found
	 */
	static handleImageData(imageUrl?: string, base64Data?: string): string | null {
		// Priority 1: External URL (not a data URI)
		if (imageUrl && !imageUrl.startsWith('data:')) {
			return imageUrl;
		}

		// Priority 2: Explicit base64 data
		if (base64Data) {
			return base64Data;
		}

		// Priority 3: Data URI
		if (imageUrl && imageUrl.startsWith('data:')) {
			return imageUrl;
		}

		// No image data found
		return null;
	}

	/**
	 * Extracts image data from OpenAI-compatible response format
	 *
	 * OpenAI format: { data: [{ url?: string, b64_json?: string }] }
	 *
	 * @param response - The API response object
	 * @returns Image URL or base64 data, or null if not found
	 */
	static extractFromOpenAiFormat(response: {
		data?: Array<{ url?: string; b64_json?: string }>;
	}): string | null {
		if (!response.data || response.data.length === 0) {
			return null;
		}

		const firstItem = response.data[0];

		// Prefer URL over base64
		if (firstItem.url) {
			return firstItem.url;
		}

		if (firstItem.b64_json) {
			return `data:image/png;base64,${firstItem.b64_json}`;
		}

		return null;
	}

	/**
	 * Extracts image data from legacy API format
	 *
	 * Legacy format: { output_url?: string, b64_json?: string }
	 *
	 * @param response - The API response object
	 * @returns Image URL or base64 data, or null if not found
	 */
	static extractFromLegacyFormat(response: {
		output_url?: string;
		b64_json?: string;
	}): string | null {
		// Prefer output_url
		if (response.output_url) {
			return response.output_url;
		}

		// Fall back to b64_json
		if (response.b64_json) {
			return `data:image/png;base64,${response.b64_json}`;
		}

		return null;
	}

	/**
	 * Tries multiple response formats to extract image data
	 *
	 * Attempts to extract from:
	 * 1. OpenAI format
	 * 2. Legacy format
	 * 3. Direct imageUrl/base64Data fields
	 *
	 * @param response - The raw API response
	 * @param imageUrl - Optional direct image URL
	 * @param base64Data - Optional direct base64 data
	 * @returns Extracted image data or null
	 */
	static extractImageData(
		response: Record<string, unknown>,
		imageUrl?: string,
		base64Data?: string
	): string | null {
		// Try direct fields first
		const directResult = this.handleImageData(imageUrl, base64Data);
		if (directResult) {
			return directResult;
		}

		// Try OpenAI format
		const openAiResult = this.extractFromOpenAiFormat(response as { data?: Array<{ url?: string; b64_json?: string }> });
		if (openAiResult) {
			return openAiResult;
		}

		// Try legacy format
		const legacyResult = this.extractFromLegacyFormat(response as { output_url?: string; b64_json?: string });
		if (legacyResult) {
			return legacyResult;
		}

		return null;
	}

	/**
	 * Checks if image data should be downloaded
	 *
	 * Images should be downloaded if:
	 * - They are external URLs (not data URIs)
	 * - The caller wants binary data
	 *
	 * @param imageData - The image data to check
	 * @returns true if the image should be downloaded
	 */
	static shouldDownloadImage(imageData: string): boolean {
		return Boolean(imageData && !imageData.startsWith('data:'));
	}

	/**
	 * Creates a binary data object from image buffer
	 *
	 * @param buffer - The image buffer
	 * @param url - Original URL (for mime type detection)
	 * @param prefix - Filename prefix
	 * @returns Binary data object
	 */
	static createBinaryData(
		buffer: Buffer,
		_url: string,
		prefix: string
	): { data: string; mimeType: string; fileName: string } {
		// TODO: Extract mime type from URL
		const mimeType = 'image/png';
		const extension = 'png';

		return {
			data: buffer.toString('base64'),
			mimeType,
			fileName: `${prefix}_${Date.now()}.${extension}`,
		};
	}

	/**
	 * Handles binary data creation from downloaded content
	 *
	 * @param buffer - Downloaded buffer
	 * @param url - Original URL
	 * @param prefix - Filename prefix
	 * @returns Binary data object
	 */
	static handleBinaryData(
		buffer: Buffer,
		url: string,
		prefix: string = 'downloaded'
	): BinaryData {
		// Detect MIME type from URL
		let mimeType = 'image/png';
		const urlLower = url.toLowerCase();
		if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) {
			mimeType = 'image/jpeg';
		} else if (urlLower.endsWith('.png')) {
			mimeType = 'image/png';
		} else if (urlLower.endsWith('.webp')) {
			mimeType = 'image/webp';
		} else if (urlLower.endsWith('.gif')) {
			mimeType = 'image/gif';
		} else if (urlLower.endsWith('.mp4')) {
			mimeType = 'video/mp4';
		}

		const extension = mimeType.split('/')[1] || 'png';

		return {
			data: buffer.toString('base64'),
			mimeType,
			fileName: `${prefix}_${Date.now()}.${extension}`,
		};
	}

	/**
	 * Extracts image URL from various API response formats
	 *
	 * @param response - API response object
	 * @returns Image URL or null
	 */
	static extractImageUrl(response: unknown): string | null {
		if (!response || typeof response !== 'object') {
			return null;
		}

		const resp = response as Record<string, unknown>;

		// Try OpenAI format first
		const openAiResult = this.extractFromOpenAiFormat(resp);
		if (openAiResult) {
			return openAiResult;
		}

		// Try legacy format
		const legacyResult = this.extractFromLegacyFormat(resp);
		if (legacyResult) {
			return legacyResult;
		}

		return null;
	}

	/**
	 * Extracts video URL from task response
	 *
	 * @param response - API response object
	 * @returns Video URL or null
	 */
	static extractVideoUrl(response: unknown): string | null {
		if (!response || typeof response !== 'object') {
			return null;
		}

		const resp = response as Record<string, unknown>;

		// Common patterns for video URLs
		const patterns = [
			'content.video_url',
			'content.output',
			'output_url',
			'video_url',
			'url',
		];

		for (const pattern of patterns) {
			const keys = pattern.split('.');
			let value: unknown = resp;

			for (const key of keys) {
				if (value && typeof value === 'object' && key in value) {
					value = (value as Record<string, unknown>)[key];
				} else {
					value = null;
					break;
				}
			}

			if (typeof value === 'string') {
				return value;
			}
		}

		return null;
	}

	/**
	 * Builds standard success response
	 *
	 * @param data - Response data
	 * @param metadata - Optional metadata
	 * @returns Execution data with success response
	 */
	static buildSuccessResponse(
		data: Record<string, unknown>,
		metadata?: Record<string, unknown>
	): INodeExecutionData {
		return {
			json: {
				success: true,
				...data,
				_metadata: {
					timestamp: new Date().toISOString(),
					...metadata,
				},
			},
		};
	}

	/**
	 * Builds error response for continueOnFail scenarios
	 *
	 * @param error - The error that occurred
	 * @param itemIndex - Index of the failed item
	 * @returns Execution data with error response
	 */
	static buildErrorResponse(
		error: unknown,
		itemIndex: number
	): INodeExecutionData {
		const errorCode = error instanceof MediaGenError ? error.code : 'UNKNOWN';
		const errorMessage = error instanceof Error ? error.message : String(error);

		return {
			json: {
				success: false,
				error: errorMessage,
				errorCode,
				_metadata: {
					timestamp: new Date().toISOString(),
					itemIndex,
				},
			},
		};
	}

	/**
	 * Validates response has expected data
	 *
	 * @param response - Response to validate
	 * @param requiredFields - Array of required field paths (dot notation)
	 * @returns True if response is valid
	 * @throws MediaGenError if validation fails
	 */
	static validateResponse(
		response: unknown,
		requiredFields: string[]
	): void {
		if (!response || typeof response !== 'object') {
			throw new MediaGenError('Invalid response: not an object', 'API_ERROR');
		}

		const resp = response as Record<string, unknown>;

		for (const fieldPath of requiredFields) {
			const keys = fieldPath.split('.');
			let value: unknown = resp;

			for (const key of keys) {
				if (value && typeof value === 'object' && key in value) {
					value = (value as Record<string, unknown>)[key];
				} else {
					throw new MediaGenError(
						`Invalid response: missing field '${fieldPath}'`,
						'API_ERROR'
					);
				}
			}

			if (value === undefined || value === null) {
				throw new MediaGenError(
					`Invalid response: field '${fieldPath}' is ${value}`,
					'API_ERROR'
				);
			}
		}
	}
}
