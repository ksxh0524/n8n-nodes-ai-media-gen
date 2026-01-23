import sharp from 'sharp';

const SUPPORTED_MIME_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/tiff',
	'image/avif',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const MIN_DIMENSION = 1;
const MAX_DIMENSION = 65535;

export interface ValidationOptions {
	maxFileSize?: number;
	minWidth?: number;
	maxWidth?: number;
	minHeight?: number;
	maxHeight?: number;
	allowedFormats?: string[];
}

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

export class ImageValidator {
	static validateMimeType(mimeType: string): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!mimeType) {
			errors.push('MIME type is required');
			return { valid: false, errors, warnings };
		}

		if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
			errors.push(`Unsupported MIME type: ${mimeType}. Supported types: ${Array.from(SUPPORTED_MIME_TYPES).join(', ')}`);
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	static validateFileSize(size: number, maxSize: number = MAX_FILE_SIZE): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (typeof size !== 'number' || size < 0) {
			errors.push('File size must be a positive number');
			return { valid: false, errors, warnings };
		}

		if (size === 0) {
			errors.push('File size cannot be zero');
		}

		if (size > maxSize) {
			errors.push(`File size (${size} bytes) exceeds maximum allowed size (${maxSize} bytes)`);
		}

		if (size > 10 * 1024 * 1024) {
			warnings.push('Large file size may affect performance');
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	static validateDimensions(width: number, height: number): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (typeof width !== 'number' || typeof height !== 'number') {
			errors.push('Dimensions must be numbers');
			return { valid: false, errors, warnings };
		}

		if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
			errors.push(`Dimensions must be at least ${MIN_DIMENSION}x${MIN_DIMENSION}`);
		}

		if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
			errors.push(`Dimensions cannot exceed ${MAX_DIMENSION}x${MAX_DIMENSION}`);
		}

		if (width !== height && (width > 4096 || height > 4096)) {
			warnings.push('Large dimensions may affect performance');
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	static validateBuffer(buffer: Buffer, options?: ValidationOptions): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!Buffer.isBuffer(buffer)) {
			errors.push('Input must be a Buffer');
			return { valid: false, errors, warnings };
		}

		if (buffer.length === 0) {
			errors.push('Buffer cannot be empty');
		}

		const maxSize = options?.maxFileSize ?? MAX_FILE_SIZE;
		const sizeValidation = this.validateFileSize(buffer.length, maxSize);
		errors.push(...sizeValidation.errors);
		warnings.push(...sizeValidation.warnings);

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	static async validateImage(buffer: Buffer, options?: ValidationOptions): Promise<ValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];

		const bufferValidation = this.validateBuffer(buffer, options);
		errors.push(...bufferValidation.errors);
		warnings.push(...bufferValidation.warnings);

		if (!bufferValidation.valid) {
			return { valid: false, errors, warnings };
		}

		try {
			const metadata = await sharp(buffer).metadata();

			if (options?.allowedFormats && metadata.format) {
				if (!options.allowedFormats.includes(metadata.format)) {
					errors.push(`Image format '${metadata.format}' is not allowed. Allowed formats: ${options.allowedFormats.join(', ')}`);
				}
			}

			const dimensionValidation = this.validateDimensions(
				metadata.width || 0,
				metadata.height || 0
			);
			errors.push(...dimensionValidation.errors);
			warnings.push(...dimensionValidation.warnings);

			if (metadata.hasAlpha && metadata.format === 'jpeg') {
				warnings.push('JPEG format does not support transparency');
			}

			if (metadata.isProgressive && metadata.format === 'png') {
				warnings.push('Progressive PNG may not be supported by all viewers');
			}

		} catch (error) {
			errors.push(`Failed to validate image: ${error instanceof Error ? error.message : String(error)}`);
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	static async validateImageFile(filePath: string, options?: ValidationOptions): Promise<ValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			const metadata = await sharp(filePath).metadata();

			if (metadata.format) {
				const mimeType = `image/${metadata.format}`;
				const mimeValidation = this.validateMimeType(mimeType);
				errors.push(...mimeValidation.errors);
				warnings.push(...mimeValidation.warnings);
			}

			const dimensionValidation = this.validateDimensions(
				metadata.width || 0,
				metadata.height || 0
			);
			errors.push(...dimensionValidation.errors);
			warnings.push(...dimensionValidation.warnings);

			if (metadata.size) {
				const sizeValidation = this.validateFileSize(metadata.size, options?.maxFileSize);
				errors.push(...sizeValidation.errors);
				warnings.push(...sizeValidation.warnings);
			}

		} catch (error) {
			errors.push(`Failed to validate image file: ${error instanceof Error ? error.message : String(error)}`);
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	static validateResizeOptions(width: number, height: number): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (typeof width !== 'number' || typeof height !== 'number') {
			errors.push('Width and height must be numbers');
			return { valid: false, errors, warnings };
		}

		if (width < 0 || height < 0) {
			errors.push('Width and height must be non-negative');
		}

		if (width === 0 && height === 0) {
			errors.push('At least one dimension must be greater than zero');
		}

		if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
			errors.push(`Dimensions cannot exceed ${MAX_DIMENSION}x${MAX_DIMENSION}`);
		}

		if (width > 0 && height > 0 && width / height > 100) {
			warnings.push('Extreme aspect ratio may cause unexpected results');
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	static validateQuality(quality: number): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (typeof quality !== 'number') {
			errors.push('Quality must be a number');
			return { valid: false, errors, warnings };
		}

		if (quality < 1 || quality > 100) {
			errors.push('Quality must be between 1 and 100');
		}

		if (quality < 50) {
			warnings.push('Low quality may result in poor image quality');
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	static validateFormat(format: string): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		const validFormats = ['jpeg', 'png', 'webp', 'gif', 'tiff', 'avif'];

		if (!format) {
			errors.push('Format is required');
			return { valid: false, errors, warnings };
		}

		if (!validFormats.includes(format)) {
			errors.push(`Invalid format: ${format}. Valid formats: ${validFormats.join(', ')}`);
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}
}
