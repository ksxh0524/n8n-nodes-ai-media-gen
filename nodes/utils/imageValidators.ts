/**
 * Image validators for n8n-nodes-ai-media-gen
 * Provides validation functions for image inputs and processing options
 */

import { MediaGenError, ERROR_CODES } from './errors';
import type {
	ImageInput,
	ResizeOptions,
	CropOptions,
	CompressOptions,
	ConvertOptions,
} from './imageTypes';
import {
	SUPPORTED_IMAGE_FORMATS,
	SUPPORTED_RESIZE_FITS,
	SUPPORTED_RESIZE_KERNELS,
	MIME_TYPE_TO_FORMAT,
} from './imageTypes';

/**
 * Validate image input
 */
export function validateImageInput(input: unknown): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!input || typeof input !== 'object') {
		errors.push('Image input is required and must be an object');
		return { valid: false, errors };
	}

	const imgInput = input as ImageInput;

	// Validate type
	if (!imgInput.type || typeof imgInput.type !== 'string') {
		errors.push('Input type is required');
	} else {
		const validTypes: ImageInput['type'][] = ['url', 'base64', 'binary', 'n8n-binary'];
		if (!validTypes.includes(imgInput.type)) {
			errors.push(`Input type must be one of: ${validTypes.join(', ')}`);
		}

		// Validate type-specific fields
		switch (imgInput.type) {
			case 'url':
				if (!imgInput.url) {
					errors.push('URL is required for url type');
				} else if (!isValidUrl(imgInput.url)) {
					errors.push('Invalid URL format');
				}
				break;

			case 'base64':
				if (!imgInput.data) {
					errors.push('Data is required for base64 type');
				} else if (typeof imgInput.data !== 'string' || !isValidBase64(imgInput.data)) {
					errors.push('Invalid base64 data format');
				}
				break;

			case 'binary':
			case 'n8n-binary':
				if (!imgInput.data) {
					errors.push('Data is required for binary type');
				}
				break;
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
}

/**
 * Validate base64 string format
 */
function isValidBase64(str: string): boolean {
	if (!str || str.length === 0) {
		return false;
	}

	// Check for data URL prefix or pure base64
	const dataUrlRegex = /^data:([^;]+);base64,(.+)$/;
	const pureBase64Regex = /^[A-Za-z0-9+/]+={0,2}$/;

	// Remove data URL prefix if present
	let cleanStr = str;
	const match = str.match(dataUrlRegex);
	if (match) {
		cleanStr = match[2];
	}

	// Basic base64 validation
	return (
		cleanStr.length > 0 &&
		pureBase64Regex.test(cleanStr) &&
		cleanStr.length % 4 === 0
	);
}

/**
 * Validate resize options
 */
export function validateResizeOptions(options: unknown): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!options || typeof options !== 'object') {
		errors.push('Resize options are required and must be an object');
		return { valid: false, errors };
	}

	const resizeOpts = options as ResizeOptions;

	// Validate width
	if (resizeOpts.width === undefined || typeof resizeOpts.width !== 'number') {
		errors.push('Width is required and must be a number');
	} else if (resizeOpts.width <= 0 || resizeOpts.width > 65535) {
		errors.push('Width must be between 1 and 65535');
	}

	// Validate height (optional)
	if (resizeOpts.height !== undefined) {
		if (typeof resizeOpts.height !== 'number') {
			errors.push('Height must be a number');
		} else if (resizeOpts.height <= 0 || resizeOpts.height > 65535) {
			errors.push('Height must be between 1 and 65535');
		}
	}

	// Validate fit (optional)
	if (resizeOpts.fit !== undefined && !SUPPORTED_RESIZE_FITS.includes(resizeOpts.fit)) {
		errors.push(`Fit must be one of: ${SUPPORTED_RESIZE_FITS.join(', ')}`);
	}

	// Validate kernel (optional)
	if (resizeOpts.kernel !== undefined && !SUPPORTED_RESIZE_KERNELS.includes(resizeOpts.kernel)) {
		errors.push(`Kernel must be one of: ${SUPPORTED_RESIZE_KERNELS.join(', ')}`);
	}

	// Validate withoutEnlargement (optional)
	if (
		resizeOpts.withoutEnlargement !== undefined &&
		typeof resizeOpts.withoutEnlargement !== 'boolean'
	) {
		errors.push('WithoutEnlargement must be a boolean');
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Validate crop options
 */
export function validateCropOptions(options: unknown): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!options || typeof options !== 'object') {
		errors.push('Crop options are required and must be an object');
		return { valid: false, errors };
	}

	const cropOpts = options as CropOptions;

	// Validate left
	if (cropOpts.left === undefined || typeof cropOpts.left !== 'number') {
		errors.push('Left is required and must be a number');
	} else if (cropOpts.left < 0) {
		errors.push('Left must be non-negative');
	}

	// Validate top
	if (cropOpts.top === undefined || typeof cropOpts.top !== 'number') {
		errors.push('Top is required and must be a number');
	} else if (cropOpts.top < 0) {
		errors.push('Top must be non-negative');
	}

	// Validate width
	if (cropOpts.width === undefined || typeof cropOpts.width !== 'number') {
		errors.push('Width is required and must be a number');
	} else if (cropOpts.width <= 0) {
		errors.push('Width must be positive');
	}

	// Validate height
	if (cropOpts.height === undefined || typeof cropOpts.height !== 'number') {
		errors.push('Height is required and must be a number');
	} else if (cropOpts.height <= 0) {
		errors.push('Height must be positive');
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Validate compress options
 */
export function validateCompressOptions(options: unknown): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!options || typeof options !== 'object') {
		errors.push('Compress options are required and must be an object');
		return { valid: false, errors };
	}

	const compressOpts = options as CompressOptions;

	// Validate quality (optional)
	if (compressOpts.quality !== undefined) {
		if (typeof compressOpts.quality !== 'number') {
			errors.push('Quality must be a number');
		} else if (compressOpts.quality < 1 || compressOpts.quality > 100) {
			errors.push('Quality must be between 1 and 100');
		}
	}

	// Validate progressive (optional)
	if (
		compressOpts.progressive !== undefined &&
		typeof compressOpts.progressive !== 'boolean'
	) {
		errors.push('Progressive must be a boolean');
	}

	// Validate effort (optional)
	if (compressOpts.effort !== undefined) {
		if (typeof compressOpts.effort !== 'number') {
			errors.push('Effort must be a number');
		} else if (compressOpts.effort < 0 || compressOpts.effort > 100) {
			errors.push('Effort must be between 0 and 100');
		}
	}

	// Validate nearLossless (optional)
	if (
		compressOpts.nearLossless !== undefined &&
		typeof compressOpts.nearLossless !== 'boolean'
	) {
		errors.push('NearLossless must be a boolean');
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Validate convert options
 */
export function validateConvertOptions(options: unknown): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!options || typeof options !== 'object') {
		errors.push('Convert options are required and must be an object');
		return { valid: false, errors };
	}

	const convertOpts = options as ConvertOptions;

	// Validate format
	if (!convertOpts.format || typeof convertOpts.format !== 'string') {
		errors.push('Format is required');
	} else if (!SUPPORTED_IMAGE_FORMATS.includes(convertOpts.format)) {
		errors.push(`Format must be one of: ${SUPPORTED_IMAGE_FORMATS.join(', ')}`);
	}

	// Validate compressOptions (optional)
	if (convertOpts.compressOptions !== undefined) {
		const compressValidation = validateCompressOptions(convertOpts.compressOptions);
		if (!compressValidation.valid) {
			errors.push(...compressValidation.errors.map(e => `CompressOptions: ${e}`));
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Validate file size
 */
export function validateFileSize(fileSize: number, maxSize: number): boolean {
	return fileSize > 0 && fileSize <= maxSize;
}

/**
 * Validate image format
 */
export function validateImageFormat(format: string): boolean {
	return SUPPORTED_IMAGE_FORMATS.includes(format as any);
}

/**
 * Validate MIME type
 */
export function validateMimeType(mimeType: string): boolean {
	return Object.keys(MIME_TYPE_TO_FORMAT).includes(mimeType);
}

/**
 * Throw error if validation fails
 */
export function assertValidImageInput(input: unknown): void {
	const validation = validateImageInput(input);
	if (!validation.valid) {
		throw new MediaGenError(
			`Invalid image input: ${validation.errors.join(', ')}`,
			ERROR_CODES.INVALID_IMAGE_INPUT
		);
	}
}

/**
 * Throw error if resize options validation fails
 */
export function assertValidResizeOptions(options: unknown): void {
	const validation = validateResizeOptions(options);
	if (!validation.valid) {
		throw new MediaGenError(
			`Invalid resize options: ${validation.errors.join(', ')}`,
			ERROR_CODES.INVALID_PARAMS
		);
	}
}

/**
 * Throw error if crop options validation fails
 */
export function assertValidCropOptions(options: unknown): void {
	const validation = validateCropOptions(options);
	if (!validation.valid) {
		throw new MediaGenError(
			`Invalid crop options: ${validation.errors.join(', ')}`,
			ERROR_CODES.INVALID_PARAMS
		);
	}
}

/**
 * Throw error if compress options validation fails
 */
export function assertValidCompressOptions(options: unknown): void {
	const validation = validateCompressOptions(options);
	if (!validation.valid) {
		throw new MediaGenError(
			`Invalid compress options: ${validation.errors.join(', ')}`,
			ERROR_CODES.INVALID_PARAMS
		);
	}
}

/**
 * Throw error if convert options validation fails
 */
export function assertValidConvertOptions(options: unknown): void {
	const validation = validateConvertOptions(options);
	if (!validation.valid) {
		throw new MediaGenError(
			`Invalid convert options: ${validation.errors.join(', ')}`,
			ERROR_CODES.INVALID_PARAMS
		);
	}
}
