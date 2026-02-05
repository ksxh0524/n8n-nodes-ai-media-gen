import type { IExecuteFunctions } from 'n8n-workflow';
import { MediaGenError } from './errors';
import { makeHttpRequest } from './httpRequest';

/**
 * Options for polling a task
 */
export interface PollingOptions {
	/** n8n execution context */
	context: IExecuteFunctions;
	/** Credentials with API key */
	credentials: { apiKey: string; baseUrl?: string };
	/** Task ID to poll */
	taskId: string;
	/** Status endpoint path (will be appended to baseUrl) */
	statusEndpoint: string;
	/** Maximum timeout in milliseconds (default: 600000 / 10 minutes) */
	timeoutMs?: number;
	/** Status values that indicate success */
	onSuccessStatus: string[];
	/** Status values that indicate failure */
	failureStatuses: string[];
	/** Prefix for logging messages */
	logPrefix: string;
	/** Additional headers for the request */
	headers?: Record<string, string>;
}

/**
 * Task status response interface
 */
export interface TaskStatusResponse {
	id?: string;
	status: string;
	content?: {
		video_url?: string;
		image_url?: string;
		output_url?: string;
		url?: string;
		last_frame_url?: string;
	};
	error?: {
		code?: string;
		message?: string;
	};
	[key: string]: any;
}

/**
 * Polls a task with adaptive intervals until completion or timeout
 *
 * This utility consolidates the common polling pattern used across multiple nodes:
 * - Starts with 5 second intervals
 * - Increases to 10 seconds after 30 seconds
 * - Increases to 15 seconds after 2 minutes
 * - Handles timeout detection
 * - Provides consistent logging
 *
 * @param options - Polling configuration options
 * @returns Final task status response
 * @throws MediaGenError on timeout or task failure
 *
 * @example
 * ```typescript
 * const result = await pollTask({
 *   context,
 *   credentials: { apiKey: 'sk-...', baseUrl: 'https://api.example.com' },
 *   taskId: 'task-123',
 *   statusEndpoint: '/tasks/status',
 *   timeoutMs: 300000,
 *   onSuccessStatus: ['succeeded', 'completed'],
 *   failureStatuses: ['failed', 'cancelled'],
 *   logPrefix: 'VideoGeneration',
 * });
 * ```
 */
export async function pollTask(options: PollingOptions): Promise<TaskStatusResponse> {
	const {
		context,
		credentials,
		taskId,
		statusEndpoint,
		timeoutMs = 600000,
		onSuccessStatus,
		failureStatuses,
		logPrefix,
		headers: additionalHeaders = {},
	} = options;

	const startTime = Date.now();
	let pollCount = 0;
	const maxPolls = 120;

	while (Date.now() - startTime < timeoutMs && pollCount < maxPolls) {
		pollCount++;
		const elapsed = Date.now() - startTime;

		// Build status URL
		const baseUrl = credentials.baseUrl || '';
		const statusUrl = `${baseUrl}${statusEndpoint}/${taskId}`;

		// Make status request
		let status: TaskStatusResponse;
		try {
			status = await makeHttpRequest(context, {
				method: 'GET',
				url: statusUrl,
				credentials,
				headers: additionalHeaders,
				timeout: 10000,
			}) as TaskStatusResponse;
		} catch (error) {
			context.logger?.warn(`[${logPrefix}] Poll request failed`, {
				error: error instanceof Error ? error.message : String(error),
				pollCount,
				elapsed: `${Math.floor(elapsed / 1000)}s`,
			});
			// Continue polling on network errors
			continue;
		}

		// Log progress
		context.logger?.info(`[${logPrefix}] Progress: ${status.status}`, {
			taskId,
			elapsed: `${Math.floor(elapsed / 1000)}s`,
			pollCount,
		});

		// Check for success
		if (onSuccessStatus.includes(status.status)) {
			return status;
		}

		// Check for failure
		if (failureStatuses.includes(status.status)) {
			throw new MediaGenError(
				`Task failed: ${status.error?.message || status.status}`,
				'TASK_FAILED',
				status.error
			);
		}

		// Check if still running/queued
		if (status.status === 'running' || status.status === 'queued' || status.status === 'processing') {
			continue;
		}

		// Unknown status
		context.logger?.warn(`[${logPrefix}] Unknown status: ${status.status}`, {
			taskId,
			status: status.status,
		});
	}

	// Timeout
	throw new MediaGenError(
		`Polling timeout after ${Math.floor((Date.now() - startTime) / 1000)}s`,
		'TIMEOUT'
	);
}

/**
 * Polls a task with ModelScope-specific configuration
 *
 * ModelScope uses specific status codes and headers, so this is a
 * specialized version for that provider.
 *
 * @param options - Polling configuration
 * @returns Task status response
 */
export async function pollModelScopeTask(options: Omit<PollingOptions, 'headers' | 'onSuccessStatus' | 'failureStatuses'>): Promise<TaskStatusResponse> {
	return pollTask({
		...options,
		headers: {
			'X-ModelScope-Task-Type': 'image_generation',
		},
		onSuccessStatus: ['SUCCESS', 'success', 'succeeded', 'SUCCEEDED'],
		failureStatuses: ['FAILED', 'failed', 'failed', 'FAILED'],
	});
}

/**
 * Polls a task with Sora-specific configuration
 *
 * Sora uses specific status codes, so this is a specialized version.
 *
 * @param options - Polling configuration
 * @returns Task status response
 */
export async function pollSoraTask(options: Omit<PollingOptions, 'headers' | 'onSuccessStatus' | 'failureStatuses'>): Promise<TaskStatusResponse> {
	return pollTask({
		...options,
		onSuccessStatus: ['succeeded', 'completed'],
		failureStatuses: ['failed', 'cancelled', 'canceled'],
	});
}

/**
 * Polls a task with Replicate-specific configuration
 *
 * Replicate uses specific status codes, so this is a specialized version.
 *
 * @param options - Polling configuration
 * @returns Task status response
 */
export async function pollReplicateTask(options: Omit<PollingOptions, 'headers' | 'onSuccessStatus' | 'failureStatuses'>): Promise<TaskStatusResponse> {
	return pollTask({
		...options,
		onSuccessStatus: ['succeeded'],
		failureStatuses: ['failed', 'canceled'],
	});
}

/**
 * Polls a task with Suno-specific configuration
 *
 * Suno uses specific response format: { code: "success", data: { status: "SUCCESS" } }
 * This function adapts the response format before calling pollTask
 *
 * @param options - Polling configuration
 * @returns Task status response
 */
export async function pollSunoTask(options: Omit<PollingOptions, 'headers' | 'onSuccessStatus' | 'failureStatuses'>): Promise<any> {
	const { context, credentials, taskId, statusEndpoint, timeoutMs = 600000, logPrefix } = options;

	const startTime = Date.now();
	let pollCount = 0;
	const maxPolls = 120;

	while (Date.now() - startTime < timeoutMs && pollCount < maxPolls) {
		pollCount++;
		const elapsed = Date.now() - startTime;

		// Build status URL
		const baseUrl = credentials.baseUrl || '';
		const statusUrl = `${baseUrl}${statusEndpoint}/${taskId}`;

		// Make status request
		let response: any;
		try {
			response = await makeHttpRequest(context, {
				method: 'GET',
				url: statusUrl,
				credentials,
				timeout: 10000,
			});
		} catch (error) {
			context.logger?.warn(`[${logPrefix}] Poll request failed`, {
				error: error instanceof Error ? error.message : String(error),
				pollCount,
				elapsed: `${Math.floor(elapsed / 1000)}s`,
			});
			// Continue polling on network errors
			continue;
		}

		// Adapt Suno response format: { code: "success", data: { status: "SUCCESS" } }
		// Extract status from data.status
		const sunoStatus = response?.data?.status || response?.status;

		// Log progress
		console.log(`[${logPrefix}] Progress: ${sunoStatus} (${pollCount}, ${Math.floor(elapsed / 1000)}s)`);

		// Check for success
		if (sunoStatus === 'SUCCESS' || sunoStatus === 'success') {
			return response; // Return full response for parsing by responseParsers
		}

		// Check for failure
		if (sunoStatus === 'FAILED' || sunoStatus === 'failed') {
			throw new MediaGenError(
				`Task failed: ${response?.data?.fail_reason || sunoStatus}`,
				'TASK_FAILED'
			);
		}

		// Check if still processing
		if (sunoStatus === 'IN_PROGRESS' || sunoStatus === 'processing' || sunoStatus === 'streaming') {
			continue;
		}

		// Unknown status
		context.logger?.warn(`[${logPrefix}] Unknown status: ${sunoStatus}`, {
			taskId,
			pollCount,
		});
	}

	// Timeout
	throw new MediaGenError(
		`Polling timeout after ${Math.floor((Date.now() - startTime) / 1000)}s`,
		'TIMEOUT'
	);
}
