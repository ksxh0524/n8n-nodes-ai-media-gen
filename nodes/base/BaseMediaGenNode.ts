import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { CacheManager } from '../utils/cache';
import { PerformanceMonitor } from '../utils/monitoring';
import { MediaGenError } from '../utils/errors';

/**
 * Service container for node dependencies
 */
export interface NodeServices {
	/** Cache manager for storing API responses */
	cacheManager: CacheManager;
	/** Performance monitor for tracking operations */
	performanceMonitor: PerformanceMonitor;
}

/**
 * Context for processing individual items
 */
export interface ItemProcessContext {
	/** n8n execution context */
	context: IExecuteFunctions;
	/** Index of the current item */
	itemIndex: number;
	/** Available services */
	services: NodeServices;
}

/**
 * Base class for AI media generation nodes
 *
 * Provides common functionality for:
 * - Execution template with batch processing
 * - Error handling
 * - Caching
 * - Performance monitoring
 *
 * Subclasses should implement the processItem method to handle
 * platform-specific logic.
 */
export abstract class BaseMediaGenNode {
	/**
	 * Normalizes a seed value
	 *
	 * Converts negative seeds to undefined (indicating random generation).
	 * Ensures positive seeds are passed through.
	 *
	 * @param seed - The seed value to normalize
	 * @returns Normalized seed value or undefined for random
	 */
	protected normalizeSeed(seed: number): number | undefined {
		return seed >= 0 ? seed : undefined;
	}

	/**
	 * Checks if a value is a data URI
	 *
	 * @param value - The value to check
	 * @returns true if the value starts with 'data:'
	 */
	protected isDataUri(value: string): boolean {
		return value.startsWith('data:');
	}

	/**
	 * Handles errors during item processing
	 *
	 * Wraps errors in appropriate n8n error types.
	 *
	 * @param error - The error that occurred
	 * @param itemIndex - Index of the item that failed
	 * @param context - n8n execution context
	 * @throws NodeOperationError - Always throws with proper error wrapping
	 */
	protected handleItemError(error: unknown, itemIndex: number, context: IExecuteFunctions): never {
		const errorCode = error instanceof MediaGenError ? error.code : 'UNKNOWN';
		const errorMessage = error instanceof Error ? error.message : String(error);

		context.logger?.error('[BaseMediaGenNode] Item processing failed', {
			itemIndex,
			error: errorMessage,
			errorCode,
		});

		// Wrap in NodeOperationError for n8n
		if (error instanceof NodeOperationError) {
			throw error;
		}

		if (error instanceof MediaGenError) {
			throw new NodeOperationError(context.getNode(), error.message, { itemIndex });
		}

		throw new NodeOperationError(context.getNode(), errorMessage, { itemIndex });
	}

	/**
	 * Extracts and validates credentials
	 *
	 * Helper method for getting credentials with proper error handling.
	 *
	 * @param context - n8n execution context
	 * @param credentialType - Name of the credential type
	 * @param itemIndex - Index of the current item
	 * @returns The credentials object
	 * @throws NodeOperationError if credentials are missing
	 */
	protected async getCredentials<T extends object>(
		context: IExecuteFunctions,
		credentialType: string,
		itemIndex: number
	): Promise<T> {
		const credentials = await context.getCredentials<T>(credentialType);

		if (!credentials) {
			throw new NodeOperationError(
				context.getNode(),
				`Credentials '${credentialType}' are required. Please configure your credentials.`,
				{ itemIndex }
			);
		}

		return credentials;
	}
}
