import { MODEL_CONSTRAINTS, VALIDATION } from './constants';
import { MediaGenError } from './errors';

/**
 * Validates the number of images parameter
 * @param value - The number of images to validate
 * @throws MediaGenError if value is out of range
 */
export function validateNumImages(value: number): void {
	if (value < VALIDATION.NUM_IMAGES.MIN || value > VALIDATION.NUM_IMAGES.MAX) {
		throw new MediaGenError(
			`Number of images must be between ${VALIDATION.NUM_IMAGES.MIN} and ${VALIDATION.NUM_IMAGES.MAX}`,
			'INVALID_PARAMS'
		);
	}
}

/**
 * Validates that the size is supported for the given model
 * @param model - The model name
 * @param size - The size to validate
 * @throws MediaGenError if size is not supported for the model
 */
export function validateSizeForModel(model: string, size: string): void {
	const constraints = MODEL_CONSTRAINTS[model as keyof typeof MODEL_CONSTRAINTS];

	if (!constraints) {
		throw new MediaGenError(`Unknown model: ${model}`, 'INVALID_MODEL');
	}

	const supportedSizes = constraints.supportedSizes as readonly string[];
	if (!supportedSizes.includes(size)) {
		throw new MediaGenError(
			`Size "${size}" is not supported for model "${model}". Supported sizes: ${constraints.supportedSizes.join(', ')}`,
			'INVALID_PARAMS'
		);
	}
}

/**
 * Validates the input image format (URL or base64)
 * @param inputImage - The input image string to validate
 * @throws MediaGenError if format is invalid
 */
export function validateInputImage(inputImage: string): void {
	if (!inputImage || inputImage.trim() === '') {
		throw new MediaGenError('Input image is required for Edit model', 'INVALID_IMAGE_INPUT');
	}

	const trimmed = inputImage.trim();

	// Check if it's a valid URL
	if (VALIDATION.URL_PATTERN.test(trimmed)) {
		return;
	}

	// Check if it's valid base64
	if (VALIDATION.BASE64_PATTERN.test(trimmed)) {
		return;
	}

	throw new MediaGenError(
		'Input image must be a valid URL or base64 encoded data (data:image/...;base64,...)',
		'INVALID_IMAGE_INPUT'
	);
}

/**
 * Validates all parameters for a model request
 * @param model - The model name
 * @param size - The image size
 * @param numImages - Number of images to generate
 * @param inputImage - Input image for edit models
 * @throws NodeOperationError or MediaGenError if validation fails
 */
export function validateModelRequest(
	model: string,
	size: string,
	numImages: number,
	inputImage?: string
): void {
	// Validate size
	validateSizeForModel(model, size);

	// Validate numImages if supported
	const constraints = MODEL_CONSTRAINTS[model as keyof typeof MODEL_CONSTRAINTS];
	if (constraints?.supportsNumImages) {
		validateNumImages(numImages);
	}

	// Validate input image for edit models
	if (model === 'Qwen-Image-Edit-2511' && inputImage) {
		validateInputImage(inputImage);
	}
}
