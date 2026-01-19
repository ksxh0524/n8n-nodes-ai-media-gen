/**
 * Logger utility for AI Media Gen nodes
 */

import { IExecuteFunctions } from 'n8n-workflow';

export class Logger {
	private logger: IExecuteFunctions['logger'];

	constructor(logger: IExecuteFunctions['logger']) {
		this.logger = logger;
	}

	info(message: string, meta?: any): void {
		if (meta) {
			this.logger.info(`[AI Media Gen] ${message}`, JSON.stringify(meta, null, 2));
		} else {
			this.logger.info(`[AI Media Gen] ${message}`);
		}
	}

	warn(message: string, meta?: any): void {
		if (meta) {
			this.logger.warn(`[AI Media Gen] ${message}`, JSON.stringify(meta, null, 2));
		} else {
			this.logger.warn(`[AI Media Gen] ${message}`);
		}
	}

	error(message: string, error?: any): void {
		if (error) {
			this.logger.error(`[AI Media Gen] ${message}`, error);
		} else {
			this.logger.error(`[AI Media Gen] ${message}`);
		}
	}

	debug(message: string, meta?: any): void {
		if (meta) {
			this.logger.debug(`[AI Media Gen] ${message}`, JSON.stringify(meta, null, 2));
		} else {
			this.logger.debug(`[AI Media Gen] ${message}`);
		}
	}
}

export function createLogger(executeFunctions: IExecuteFunctions): Logger {
	return new Logger(executeFunctions.logger);
}
