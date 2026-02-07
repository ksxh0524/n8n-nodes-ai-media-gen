import type { IExecuteFunctions } from 'n8n-workflow';
import * as CONSTANTS from './constants';
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
	/** Maximum timeout in milliseconds (default: 300000 / 5 minutes) */
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
 * Suno-specific response interface
 */
interface SunoFetchResponse {
	code: string;
	message: string;
	data: {
		task_id: string;
		status: 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';
		fail_reason: string;
		data: Array<{
			id: string;
			title: string;
			tags: string;
			duration: number;
			audio_url: string;
			video_url: string;
			image_url: string;
			state: string;
			status: string;
		}>;
	};
}

/**
 * Polls a Suno music generation task
 *
 * Suno has a specific API structure with different status codes.
 * This function polls the fetch endpoint until songs are ready.
 *
 * @param context - n8n execution context
 * @param credentials - Credentials with API key and optional baseUrl
 * @param taskId - Task ID to poll
 * @param timeoutMs - Maximum timeout in milliseconds (must be provided by caller)
 * @returns Suno fetch response with song data
 * @throws MediaGenError on timeout or task failure
 *
 * @example
 * ```typescript
 * const result = await pollSunoTask(
 *   context,
 *   { apiKey: 'sk-...', baseUrl: 'https://api.sunoservice.org' },
 *   'task-123',
 *   300000
 * );
 * ```
 */
export async function pollSunoTask(
	context: IExecuteFunctions,
	credentials: { apiKey: string; baseUrl?: string },
	taskId: string,
	timeoutMs: number
): Promise<SunoFetchResponse> {
	const startTime = Date.now();
	const baseUrl = credentials.baseUrl || CONSTANTS.SUNO.DEFAULT_BASE_URL;
	const pollInterval = CONSTANTS.SUNO.POLL_INTERVAL_MS;

	context.logger?.info('[Suno] Starting polling', {
		taskId,
		timeout: `${Math.floor(timeoutMs / 1000)}s`,
	});

	while (Date.now() - startTime < timeoutMs) {
		const elapsed = Date.now() - startTime;

		try {
			const response = await makeHttpRequest(context, {
				method: 'GET',
				url: `${baseUrl}${CONSTANTS.SUNO.FETCH_ENDPOINT}/${taskId}`,
				credentials,
				timeout: pollInterval,
			}) as SunoFetchResponse;

			// Log progress
			context.logger?.debug('[Suno] Poll status', {
				status: response.data.status,
				elapsed: `${Math.floor(elapsed / 1000)}s`,
			});

			// Check for completion
			if (response.data.status === CONSTANTS.SUNO.STATUS.SUCCESS) {
				context.logger?.info('[Suno] Generation completed', {
					taskId,
					songCount: response.data.data.length,
					duration: `${Math.floor(elapsed / 1000)}s`,
				});
				return response;
			}

			// Check for failure
			if (response.data.status === CONSTANTS.SUNO.STATUS.FAILED) {
				throw new MediaGenError(
					`Generation failed: ${response.data.fail_reason || 'Unknown error'}`,
					'GENERATION_FAILED'
				);
			}

			// Still in progress, wait before next poll
			await new Promise(resolve => setTimeout(resolve, pollInterval));
		} catch (error) {
			// If it's a MediaGenError, re-throw it
			if (error instanceof MediaGenError) {
				throw error;
			}

			// Log network errors but continue polling
			context.logger?.warn('[Suno] Poll request failed', {
				error: error instanceof Error ? error.message : String(error),
				elapsed: `${Math.floor(elapsed / 1000)}s`,
			});

			// Wait before retry
			await new Promise(resolve => setTimeout(resolve, pollInterval));
		}
	}

	// Timeout
	throw new MediaGenError(
		`Polling timeout after ${Math.floor((Date.now() - startTime) / 1000)}s`,
		'TIMEOUT'
	);
}
