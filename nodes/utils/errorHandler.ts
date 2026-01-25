import { NodeOperationError, INode, Logger } from 'n8n-workflow';
import { MediaGenError } from './errors';

export interface ErrorHandlerOptions {
	node: INode;
	itemIndex: number;
	logger?: Logger;
	context?: Record<string, unknown>;
}

export class ErrorHandler {
	static handle(error: unknown, options: ErrorHandlerOptions): NodeOperationError {
		const { node, itemIndex, logger, context } = options;

		let errorMessage: string;
		let errorCode: string = 'UNKNOWN';

		if (error instanceof MediaGenError) {
			errorMessage = error.getUserMessage();
			errorCode = error.code;

			if (logger) {
				logger.error('Media generation failed', {
					errorCode,
					message: error.message,
					details: error.details,
					...context,
				});
			}
		} else if (error instanceof Error) {
			errorMessage = error.message;

			if (logger) {
				logger.error('Unexpected error occurred', {
					error: error.message,
					stack: error.stack,
					...context,
				});
			}
		} else {
			errorMessage = String(error);

			if (logger) {
				logger.error('Unknown error occurred', {
					error: errorMessage,
					...context,
				});
			}
		}

		const nodeError = new NodeOperationError(
			node,
			errorMessage,
			{ itemIndex }
		);

		if (errorCode !== 'UNKNOWN') {
			const errorWithCode = nodeError as NodeOperationError & { errorCode?: string };
			errorWithCode.errorCode = errorCode;
		}

		return nodeError;
	}

	static logSuccess(logger: Logger | undefined, operation: string, data: Record<string, unknown>): void {
		if (logger) {
			logger.info(`${operation} successful`, data);
		}
	}

	static logInfo(logger: Logger | undefined, message: string, data?: Record<string, unknown>): void {
		if (logger) {
			logger.info(message, data);
		}
	}

	static logDebug(logger: Logger | undefined, message: string, data?: Record<string, unknown>): void {
		if (logger) {
			logger.debug(message, data);
		}
	}

	static sanitizeForLogging(data: Record<string, unknown>): Record<string, unknown> {
		const sanitized = { ...data };

		if (sanitized.apiKey) {
			sanitized.apiKey = '***REDACTED***';
		}
		if (sanitized.password) {
			sanitized.password = '***REDACTED***';
		}
		if (sanitized.token) {
			sanitized.token = '***REDACTED***';
		}

		return sanitized;
	}
}
