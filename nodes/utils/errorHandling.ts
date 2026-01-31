import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { MediaGenError } from './errors';

/**
 * Unified error handler for AI media generation nodes
 *
 * Provides consistent error handling across all node types,
 * converting various error types into n8n-compatible errors.
 */
export class ErrorHandler {
	/**
	 * Converts any error to a NodeOperationError
	 *
	 * Handles:
	 * - NodeOperationError (returned as-is)
	 * - MediaGenError (wrapped with itemIndex)
	 * - Generic Errors (wrapped with message)
	 * - Unknown types (converted to string)
	 *
	 * @param error - The error to convert
	 * @param context - n8n execution context
	 * @param itemIndex - Index of the current item
	 * @returns A properly formatted NodeOperationError
	 */
	static toNodeOperationError(
		error: unknown,
		context: IExecuteFunctions,
		itemIndex: number
	): NodeOperationError {
		// Already a NodeOperationError - return as-is
		if (error instanceof NodeOperationError) {
			return error;
		}

		// MediaGenError - wrap with context
		if (error instanceof MediaGenError) {
			return new NodeOperationError(context.getNode(), error.message, {
				itemIndex,
			});
		}

		// Generic Error - extract message
		if (error instanceof Error) {
			return new NodeOperationError(context.getNode(), error.message, {
				itemIndex,
			});
		}

		// Unknown type - convert to string
		return new NodeOperationError(context.getNode(), String(error), {
			itemIndex,
		});
	}

	/**
	 * Creates an error result object for continueOnFail scenarios
	 *
	 * When continueOnFail is enabled, errors should be returned
	 * as result objects rather than thrown.
	 *
	 * @param error - The error that occurred
	 * @returns An error result object
	 */
	static createErrorResult(error: unknown): {
		success: false;
		error: string;
		errorCode: string;
		_metadata: {
			timestamp: string;
		};
	} {
		const errorCode = error instanceof MediaGenError ? error.code : 'UNKNOWN';
		const errorMessage = error instanceof Error ? error.message : String(error);

		return {
			success: false,
			error: errorMessage,
			errorCode,
			_metadata: {
				timestamp: new Date().toISOString(),
			},
		};
	}

	/**
	 * Logs an error with appropriate context
	 *
	 * @param error - The error to log
	 * @param context - n8n execution context
	 * @param itemIndex - Index of the current item
	 * @param prefix - Optional prefix for log messages
	 */
	static logError(
		error: unknown,
		context: IExecuteFunctions,
		itemIndex: number,
		prefix = 'Error'
	): void {
		const errorCode = error instanceof MediaGenError ? error.code : 'UNKNOWN';
		const errorMessage = error instanceof Error ? error.message : String(error);

		context.logger?.error(`[${prefix}]`, {
			itemIndex,
			error: errorMessage,
			errorCode,
		});
	}
}
