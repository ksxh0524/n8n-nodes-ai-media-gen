/**
 * Action Handler types and interfaces for n8n-nodes-ai-media-gen
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

/**
 * Action type
 */
export type ActionType = 'sora' | 'nanoBanana' | 'modelScope' | 'processing';

/**
 * Action type
 */
export type MediaType = 'image' | 'video' | 'audio';

/**
 * Validation result
 */
export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings?: string[];
}

/**
 * Action parameters
 */
export interface ActionParameters {
	[key: string]: unknown;
}

/**
 * Action result
 */
export interface ActionResult {
	success: boolean;
	data?: Record<string, unknown>;
	error?: string;
	errorCode?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Action handler interface
 */
export interface IActionHandler {
	readonly actionName: ActionType;
	readonly displayName: string;
	readonly description: string;
	readonly mediaType: MediaType;
	readonly credentialType: string;
	readonly requiresCredential: boolean;

	validateParameters(params: ActionParameters): ValidationResult;
	execute(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials?: Record<string, unknown>
	): Promise<INodeExecutionData>;

	getParameters(): ActionParameterDefinition[];
}

/**
 * Action parameter definition
 */
export interface ActionParameterDefinition {
	name: string;
	displayName: string;
	type: 'string' | 'number' | 'boolean' | 'options' | 'json';
	required: boolean;
	default?: unknown;
	options?: Array<{ name: string; value: unknown }>;
	min?: number;
	max?: number;
	description?: string;
	placeholder?: string;
}

/**
 * Model definition
 */
export interface ModelDefinition {
	id: string;
	displayName: string;
	type: MediaType;
	capabilities: ModelCapabilities;
	parameters: ActionParameterDefinition[];
}

/**
 * Model capabilities
 */
export interface ModelCapabilities {
	supportsBatch: boolean;
	supportsAsync: boolean;
	maxConcurrentRequests?: number;
	supportedFormats?: string[];
	maxResolution?: string;
	maxDuration?: number;
}

/**
 * Credentials interface
 */
export interface ICredentials {
	apiKey: string;
	baseUrl?: string;
	[key: string]: unknown;
}

/**
 * Action context
 */
export interface ActionContext {
	action: ActionType;
	model?: string;
	mediaType: MediaType;
	enableCache: boolean;
	cacheTtl: number;
	maxRetries: number;
	timeout: number;
}

/**
 * API request options
 */
export interface ApiRequestOptions {
	url: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	headers?: Record<string, string>;
	body?: unknown;
	timeout?: number;
}

/**
 * API response
 */
export interface ApiResponse {
	success: boolean;
	data?: unknown;
	error?: string;
	statusCode?: number;
	headers?: Record<string, string>;
}

/**
 * Action configuration
 */
export interface ActionConfig {
	action: ActionType;
	model?: string;
	prompt?: string;
	additionalParams?: Record<string, unknown>;
	postProcess?: boolean;
	postProcessOptions?: Record<string, unknown>;
}

/**
 * Base Action Handler class
 */
export abstract class BaseActionHandler implements IActionHandler {
	readonly actionName: ActionType;
	readonly displayName: string;
	readonly description: string;
	readonly mediaType: MediaType;
	readonly credentialType: string;
	readonly requiresCredential: boolean;

	constructor(
		actionName: ActionType,
		displayName: string,
		description: string,
		mediaType: MediaType,
		credentialType: string = '',
		requiresCredential: boolean = true
	) {
		this.actionName = actionName;
		this.displayName = displayName;
		this.description = description;
		this.mediaType = mediaType;
		this.credentialType = credentialType;
		this.requiresCredential = requiresCredential;
	}

	abstract validateParameters(params: ActionParameters): ValidationResult;
	abstract execute(
		context: IExecuteFunctions,
		itemIndex: number,
		credentials?: Record<string, unknown>
	): Promise<INodeExecutionData>;

	abstract getParameters(): ActionParameterDefinition[];

	/**
	 * Get parameter value from context
	 */
	protected getParameter<T = unknown>(
		context: IExecuteFunctions,
		itemIndex: number,
		parameterName: string
	): T {
		return context.getNodeParameter(parameterName, itemIndex) as T;
	}

	/**
	 * Validate required parameters
	 */
	protected validateRequiredParameters(
		params: ActionParameters,
		requiredParams: string[]
	): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		for (const paramName of requiredParams) {
			if (!params[paramName]) {
				errors.push(`Parameter '${paramName}' is required`);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	/**
	 * Build success response
	 */
	protected buildSuccessResponse(
		data: Record<string, unknown>,
		metadata?: Record<string, unknown>
	): INodeExecutionData {
		return {
			json: {
				success: true,
				...data,
				_metadata: {
					action: this.actionName,
					timestamp: new Date().toISOString(),
					...metadata,
				},
			},
		};
	}

	/**
	 * Build error response
	 */
	protected buildErrorResponse(
		error: string,
		errorCode?: string,
		metadata?: Record<string, unknown>
	): INodeExecutionData {
		return {
			json: {
				success: false,
				error,
				errorCode,
				_metadata: {
					action: this.actionName,
					timestamp: new Date().toISOString(),
					...metadata,
				},
			},
		};
	}

	/**
	 * Make HTTP request
	 */
	protected async makeRequest(options: ApiRequestOptions): Promise<ApiResponse> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), options.timeout || 60000);

		try {
			const response = await fetch(options.url, {
				method: options.method,
				headers: options.headers,
				body: options.body ? JSON.stringify(options.body) : undefined,
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			const headers: Record<string, string> = {};
			response.headers.forEach((value, key) => {
				headers[key] = value;
			});

			const data = await response.json().catch(() => null);

			return {
				success: response.ok,
				data,
				statusCode: response.status,
				headers,
			};
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof Error && error.name === 'AbortError') {
				return {
					success: false,
					error: 'Request timeout',
					statusCode: 408,
				};
			}

			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
