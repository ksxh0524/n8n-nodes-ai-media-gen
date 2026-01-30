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
 * Validates all parameters for a model request
 * @param model - The model name
 * @param size - The image size
 * @param numImages - Number of images to generate
 * @throws NodeOperationError or MediaGenError if validation fails
 */
export function validateModelRequest(
	model: string,
	size: string,
	numImages: number
): void {
	// Validate size
	validateSizeForModel(model, size);

	// Validate numImages if supported
	const constraints = MODEL_CONSTRAINTS[model as keyof typeof MODEL_CONSTRAINTS];
	if (constraints?.supportsNumImages) {
		validateNumImages(numImages);
	}
}
