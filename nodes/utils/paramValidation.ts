import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { MODEL_CONSTRAINTS, VALIDATION } from './constants';
import { MediaGenError } from './errors';

// ============================================================================
// Basic Parameter Validation
// ============================================================================

/**
 * Validates that a prompt is non-empty
 *
 * @param prompt - Prompt string to validate
 * @param context - n8n execution context
 * @param itemIndex - Index of the current item
 * @throws NodeOperationError if prompt is empty
 */
export function validatePrompt(
	prompt: string,
	context: IExecuteFunctions,
	itemIndex: number
): void {
	if (!prompt || prompt.trim() === '') {
		throw new NodeOperationError(
			context.getNode(),
			'Prompt is required',
			{ itemIndex }
		);
	}
}

/**
 * Validates that a seed is within the valid range
 *
 * @param seed - Seed value to validate
 * @returns Validated seed value
 * @throws Error if seed is out of range
 */
export function validateSeed(seed: number): number {
	const minSeed = -1;
	const maxSeed = 4294967295;
	if (seed < minSeed || seed > maxSeed) {
		throw new Error(`Seed must be between ${minSeed} and ${maxSeed}`);
	}
	return seed;
}

/**
 * Validates that an image URL is provided and non-empty
 *
 * @param url - URL string to validate
 * @param fieldName - Name of the field (for error message)
 * @param context - n8n execution context
 * @param itemIndex - Index of the current item
 * @throws NodeOperationError if URL is empty
 */
export function validateImageUrl(
	url: string,
	fieldName: string,
	context: IExecuteFunctions,
	itemIndex: number
): void {
	if (!url || !url.trim()) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} is required`,
			{ itemIndex }
		);
	}
}

/**
 * Validates that a model name is provided and non-empty
 *
 * @param model - Model name to validate
 * @param context - n8n execution context
 * @param itemIndex - Index of the current item
 * @throws NodeOperationError if model is empty
 */
export function validateModel(
	model: string,
	context: IExecuteFunctions,
	itemIndex: number
): void {
	if (!model || model.trim() === '') {
		throw new NodeOperationError(
			context.getNode(),
			'Model is required',
			{ itemIndex }
		);
	}
}

/**
 * Validates timeout value is within reasonable range
 *
 * @param timeout - Timeout value in milliseconds
 * @param minTimeout - Minimum allowed timeout (default: 1000)
 * @param maxTimeout - Maximum allowed timeout (default: 600000)
 * @returns Validated timeout value
 * @throws Error if timeout is out of range
 */
export function validateTimeout(
	timeout: number,
	minTimeout: number = 1000,
	maxTimeout: number = 600000
): number {
	if (timeout < minTimeout || timeout > maxTimeout) {
		throw new Error(`Timeout must be between ${minTimeout} and ${maxTimeout} milliseconds`);
	}
	return timeout;
}

/**
 * Safely extracts a timeout parameter with default value
 *
 * @param context - n8n execution context
 * @param paramName - Name of the parameter
 * @param itemIndex - Index of the current item
 * @param defaultValue - Default timeout value
 * @returns Timeout value or default
 */
export function getTimeoutOrDefault(
	context: IExecuteFunctions,
	paramName: string,
	itemIndex: number,
	defaultValue: number
): number {
	try {
		const timeout = context.getNodeParameter(paramName, itemIndex) as number;
		return timeout || defaultValue;
	} catch {
		return defaultValue;
	}
}

// ============================================================================
// Model-Specific Validation
// ============================================================================

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
