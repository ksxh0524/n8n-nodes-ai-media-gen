/**
 * Error Handling Utilities
 *
 * Centralized error handling for API requests with proper logging and error classification.
 */

import type { IExecuteFunctions } from 'n8n-workflow';
import { MediaGenError } from './errors';

/**
 * Handles API errors with logging and proper error classification
 *
 * @param error - The error object (can be Error, unknown, or any type)
 * @param context - Context description for the error (e.g., 'ModelScope API call')
 * @param logger - Optional n8n logger instance
 * @throws Never returns, always throws a MediaGenError
 */
export function handleApiErrorWithLogging(
	error: unknown,
	context: string,
	logger?: IExecuteFunctions['logger']
): never {
	// Log the error
	logger?.error(`${context} failed`, {
		error: error instanceof Error ? error.message : String(error),
	});

	// If it's already a MediaGenError, re-throw it
	if (error instanceof MediaGenError) {
		throw error;
	}

	// Handle specific error types
	if (error instanceof Error) {
		const errorMessage = error.message;

		// Timeout errors
		if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
			throw new MediaGenError(`${context} timeout`, 'TIMEOUT');
		}

		// Authentication errors
		if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
			throw new MediaGenError(`${context} authentication failed`, 'INVALID_API_KEY');
		}

		// Rate limiting
		if (errorMessage.includes('429')) {
			throw new MediaGenError(`${context} rate limit exceeded`, 'RATE_LIMIT');
		}

		// Not found
		if (errorMessage.includes('404')) {
			throw new MediaGenError(`${context} resource not found`, 'API_ERROR');
		}

		// Bad request
		if (errorMessage.includes('400')) {
			// Try to extract more detailed error information
			let detailedError = errorMessage;
			try {
				const errorObj = error as { response?: { body?: unknown } | string };
				if (errorObj.response) {
					if (typeof errorObj.response === 'object' && 'body' in errorObj.response) {
						detailedError = JSON.stringify(errorObj.response.body);
					} else if (typeof errorObj.response === 'string') {
						detailedError = errorObj.response;
					}
				}
			} catch {
				// Keep original error message
			}
			throw new MediaGenError(`${context} bad request: ${detailedError}`, 'INVALID_PARAMS');
		}

		// Service unavailable
		if (errorMessage.includes('503')) {
			throw new MediaGenError(`${context} service temporarily unavailable`, 'SERVICE_UNAVAILABLE');
		}
	}

	// Fallback for unknown error types
	throw new MediaGenError(
		`${context}: ${error instanceof Error ? error.message : String(error)}`,
		'API_ERROR'
	);
}

/**
 * Wraps an async function with error handling
 *
 * @param fn - The async function to wrap
 * @param context - Context description for error messages
 * @param logger - Optional n8n logger instance
 * @returns The result of the function or throws a MediaGenError
 */
export async function withErrorHandling<T>(
	fn: () => Promise<T>,
	context: string,
	logger?: IExecuteFunctions['logger']
): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		return handleApiErrorWithLogging(error, context, logger);
	}
}
