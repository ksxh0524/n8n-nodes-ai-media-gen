/**
 * API Response Type Definitions
 *
 * This file contains type definitions for API responses used across the project.
 */

/**
 * Generic JSON data interface for dynamic objects
 */
export interface IJsonData {
	[key: string]: unknown;
}

/**
 * Binary data interface for file attachments
 */
export interface IBinaryData {
	data: string;
	mimeType: string;
	fileName: string;
}

/**
 * Gemini API response interface
 */
export interface IGeminiGenerateResponse {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				inlineData?: { data: string; mimeType: string };
				text?: string;
			}>;
		};
	}>;
}

/**
 * ModelScope async submit response interface
 */
export interface IModelScopeAsyncSubmitResponse {
	id: string;
	status: string;
	[key: string]: unknown;
}

/**
 * ModelScope task status response interface
 */
export interface IModelScopeTaskStatusResponse {
	id: string;
	status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
	output?: unknown;
	error?: unknown;
	[key: string]: unknown;
}

/**
 * Doubao API response interface
 */
export interface IDoubaoApiResponse {
	status_code: number;
	request_id: string;
	data?: {
		task_id: string;
		task_status: string;
		submit_time: number;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}
