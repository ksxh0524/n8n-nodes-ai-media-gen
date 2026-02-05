import type { ParsedMediaResponse } from '../types/platforms';
import { MediaGenError } from '../utils/errors';

/**
 * Platform-specific response parsers
 *
 * Provides consistent response parsing for all supported platforms.
 */
export class ResponseParsers {
	/**
	 * Parses ModelScope API response
	 *
	 * @param response - Raw API response
	 * @returns Parsed media response
	 */
	static parseModelScopeResponse(response: unknown): ParsedMediaResponse {
		if (!response || typeof response !== 'object') {
			throw new MediaGenError('Invalid ModelScope response', 'API_ERROR');
		}

		const resp = response as Record<string, unknown>;

		// Check for async task
		if (resp.task_id) {
			return {
				metadata: {
					taskId: resp.task_id as string,
					async: true,
				},
			};
		}

		// Check for direct output
		if (resp.output_images) {
			const images = resp.output_images as Array<string | { url: string }>;
			if (images.length > 0) {
				const firstImage = images[0];
				const imageUrl = typeof firstImage === 'string' ? firstImage : firstImage.url;
				return { imageUrl };
			}
		}

		if (resp.output_url) {
			return { imageUrl: resp.output_url as string };
		}

		throw new MediaGenError('No image data in ModelScope response', 'API_ERROR');
	}

	/**
	 * Parses Doubao Seedream response
	 *
	 * @param response - Raw API response
	 * @returns Parsed media response
	 */
	static parseDoubaoResponse(response: unknown): ParsedMediaResponse {
		if (!response || typeof response !== 'object') {
			throw new MediaGenError('Invalid Doubao response', 'API_ERROR');
		}

		const resp = response as Record<string, unknown>;

		// Try OpenAI-compatible format
		if (resp.data && Array.isArray(resp.data) && resp.data.length > 0) {
			const firstItem = resp.data[0] as Record<string, unknown>;

			if (firstItem.url) {
				return { imageUrl: firstItem.url as string };
			}

			if (firstItem.b64_json) {
				return { base64Data: `data:image/png;base64,${firstItem.b64_json}` };
			}
		}

		// Try legacy format
		if (resp.output_url) {
			return { imageUrl: resp.output_url as string };
		}

		if (resp.b64_json) {
			return { base64Data: `data:image/png;base64,${resp.b64_json}` };
		}

		throw new MediaGenError('No image data in Doubao response', 'API_ERROR');
	}

	/**
	 * Parses Sora task status response
	 *
	 * @param response - Raw API response
	 * @returns Parsed media response
	 */
	static parseSoraResponse(response: unknown): ParsedMediaResponse {
		if (!response || typeof response !== 'object') {
			throw new MediaGenError('Invalid Sora response', 'API_ERROR');
		}

		const resp = response as Record<string, unknown>;

		// Check if task is still pending
		if (resp.status === 'NOT_START' || resp.status === 'IN_PROGRESS') {
			return {
				metadata: {
					status: resp.status,
					progress: resp.progress,
				},
			};
		}

		// Check for failure
		if (resp.status === 'FAILURE') {
			throw new MediaGenError(
				resp.fail_reason as string || 'Sora generation failed',
				'VIDEO_GENERATION_FAILED'
			);
		}

		// Check for success
		if (resp.status === 'SUCCESS' && resp.data && (resp.data as Record<string, unknown>).output) {
			return {
				videoUrl: (resp.data as Record<string, unknown>).output as string,
				metadata: {
					taskId: resp.task_id as string,
				},
			};
		}

		throw new MediaGenError('Invalid Sora response state', 'API_ERROR');
	}

	/**
	 * Parses Veo task status response
	 *
	 * @param response - Raw API response
	 * @returns Parsed media response
	 */
	static parseVeoResponse(response: unknown): ParsedMediaResponse {
		if (!response || typeof response !== 'object') {
			throw new MediaGenError('Invalid Veo response', 'API_ERROR');
		}

		const resp = response as Record<string, unknown>;

		// Check if task is pending
		if (resp.status === 'PENDING' || resp.status === 'PROCESSING') {
			return {
				metadata: {
					status: resp.status,
				},
			};
		}

		// Check for failure
		if (resp.status === 'FAILED') {
			throw new MediaGenError(
				resp.error as string || 'Veo generation failed',
				'VIDEO_GENERATION_FAILED'
			);
		}

		// Check for success
		if (resp.status === 'COMPLETED' && resp.video_url) {
			return {
				videoUrl: resp.video_url as string,
				metadata: {
					taskId: resp.id,
				},
			};
		}

		throw new MediaGenError('Invalid Veo response state', 'API_ERROR');
	}

	/**
	 * Parses Gemini/Nano Banana response
	 *
	 * @param response - Raw API response
	 * @returns Parsed media response
	 */
	static parseNanoBananaResponse(response: unknown): ParsedMediaResponse {
		if (!response || typeof response !== 'object') {
			throw new MediaGenError('Invalid Nano Banana response', 'API_ERROR');
		}

		const resp = response as Record<string, unknown>;

		// Navigate Gemini response structure
		const candidates = resp.candidates as Array<{
			content?: {
				parts?: Array<{
					inlineData?: { data: string; mimeType: string };
				}>;
			};
		}>;

		if (candidates && candidates.length > 0) {
			const content = candidates[0].content;
			if (content && content.parts) {
				for (const part of content.parts) {
					if (part.inlineData) {
						const { data, mimeType } = part.inlineData;
						return {
							base64Data: `data:${mimeType};base64,${data}`,
							metadata: { mimeType },
						};
					}
				}
			}
		}

		throw new MediaGenError('No image data in Nano Banana response', 'API_ERROR');
	}

	/**
	 * Parses Suno response
	 *
	 * @param response - Raw API response
	 * @returns Parsed media response
	 */
	static parseSunoResponse(response: unknown): ParsedMediaResponse {
		// Log raw response
		console.log('[Suno ResponseParser] Raw response:', JSON.stringify(response, null, 2));

		if (!response || typeof response !== 'object') {
			console.error('[Suno ResponseParser] Invalid response - not an object');
			throw new MediaGenError('Invalid Suno response', 'API_ERROR');
		}

		const resp = response as Record<string, unknown>;

		// Log response keys
		console.log('[Suno ResponseParser] Response keys:', Object.keys(resp));

		// Case 1: /suno/generate direct response
		// Format: { id: "task-id", status: "submitted", clips: [{ id, status, audio_url, ... }] }
		if (resp.clips && Array.isArray(resp.clips) && resp.clips.length > 0 && resp.id) {
			const clips = resp.clips as Array<Record<string, unknown>>;
			const taskId = resp.id as string; // Use top-level id for polling
			console.log('[Suno ResponseParser] Got /suno/generate response with', clips.length, 'clips');

			const firstClip = clips[0];
			const songId = firstClip.id as string;
			const status = firstClip.status as string;
			const audioUrl = firstClip.audio_url as string;
			const title = firstClip.title as string;

			console.log('[Suno ResponseParser] Task info:', {
				taskId,
				songId,
				status,
				title,
				hasAudioUrl: !!audioUrl,
				audioUrl: audioUrl ? audioUrl.substring(0, 50) + '...' : '',
			});

			// If song is still processing (submitted, streaming, queued, processing)
			if (status === 'submitted' || status === 'streaming' || status === 'queued' || status === 'processing' || status === 'pending') {
				console.log('[Suno ResponseParser] Song is still processing:', status);
				return {
					metadata: {
						taskId, // Use top-level id for polling
						status: 'processing',
						async: true,
					},
				};
			}

			// If song failed
			if (status === 'failed' || status === 'error') {
				throw new MediaGenError(
					firstClip.error_message as string || 'Suno generation failed',
					'MUSIC_GENERATION_FAILED'
				);
			}

			// If song completed successfully with audio URL
			if ((status === 'complete' || status === 'success' || status === 'succeeded') && audioUrl) {
				console.log('[Suno ResponseParser] Song completed with audio URL:', audioUrl);
				return {
					audioUrl,
					metadata: {
						taskId,
						status: 'succeeded',
					},
				};
			}
		}

		// Case 2: /suno/fetch/{songid} response (polling)
		// Format: { code: "success", data: { task_id, status: "SUCCESS", progress: "100%", data: [{ id, status: "complete", audio_url, ... }] } }
		if (resp.code && resp.data && typeof resp.data === 'object') {
			const code = resp.code as string;
			const data = resp.data as Record<string, unknown>;
			console.log('[Suno ResponseParser] Got /suno/fetch response, code:', code);

			// Check for error response
			if (code === 'error' || code === 'fail') {
				throw new MediaGenError(
					resp.message as string || 'Suno API returned error',
					'API_ERROR'
				);
			}

			// Only proceed if code is "success"
			if (code !== 'success') {
				console.log('[Suno ResponseParser] Unexpected code:', code, '- treating as async');
				return {
					metadata: {
						async: true,
					},
				};
			}

			// Check outer status - if still processing, return async
			const outerStatus = data.status as string;
			console.log('[Suno ResponseParser] Outer status:', outerStatus);

			if (outerStatus !== 'SUCCESS' && outerStatus !== 'success' && outerStatus !== 'succeeded') {
				console.log('[Suno ResponseParser] Task still processing, outer status:', outerStatus);
				return {
					metadata: {
						taskId: data.task_id as string,
						status: outerStatus,
						async: true,
					},
				};
			}

			// Check if data array exists
			if (data.data && Array.isArray(data.data)) {
				const songs = data.data as Array<Record<string, unknown>>;
				console.log('[Suno ResponseParser] Got', songs.length, 'songs from /suno/fetch');

				if (songs.length > 0) {
					// Check if any song is still processing
					const processingSongs = songs.filter(song => {
						const status = song.status as string;
						const state = song.state as string;
						return (
							status === 'streaming' ||
							status === 'queued' ||
							status === 'processing' ||
							status === 'pending' ||
							state === 'processing' ||
							state === 'pending'
						);
					});

					if (processingSongs.length > 0) {
						// At least one song is still processing
						return {
							metadata: {
								taskId: data.task_id as string,
								status: 'processing',
								async: true,
							},
						};
					}

					// Check if any song failed
					const failedSongs = songs.filter(song => {
						const status = song.status as string;
						const state = song.state as string;
						return status === 'failed' || status === 'error' || state === 'failed';
					});

					if (failedSongs.length > 0) {
						throw new MediaGenError(
							failedSongs[0].error_message as string || 'Suno generation failed',
							'MUSIC_GENERATION_FAILED'
						);
					}

					// Collect all completed songs with audio URLs
					const completedSongs = songs.filter(song => {
						const status = song.status as string;
						const state = song.state as string;
						const audioUrl = song.audio_url as string;
						return (
							audioUrl &&
							(status === 'complete' || status === 'success' || status === 'succeeded' || state === 'succeeded')
						);
					});

					if (completedSongs.length > 0) {
						console.log('[Suno ResponseParser] Found', completedSongs.length, 'completed songs');

						// Return all songs with their metadata
						return {
							audioUrls: completedSongs.map(song => ({
								id: song.id as string,
								audioUrl: song.audio_url as string,
								title: song.title as string,
								tags: song.tags as string,
							})),
							metadata: {
								taskId: data.task_id as string,
								status: 'succeeded',
								count: completedSongs.length,
							},
						};
					}
				}
			}
		}

		// Fallback - mark for polling
		console.log('[Suno ResponseParser] Response unclear, marking as async');
		return {
			metadata: {
				async: true,
			},
		};
	}

	/**
	 * Generic response parser for unknown platforms
	 *
	 * Tries multiple strategies to extract media data
	 *
	 * @param response - Raw API response
	 * @returns Parsed media response
	 * @throws MediaGenError if cannot extract data
	 */
	static parseGenericResponse(response: unknown): ParsedMediaResponse {
		if (!response || typeof response !== 'object') {
			throw new MediaGenError('Invalid response: not an object', 'API_ERROR');
		}

		const resp = response as Record<string, unknown>;

		// Try common patterns for image URLs
		const imageUrlPatterns = [
			'data.0.url',
			'data.0.b64_json',
			'output_url',
			'image_url',
			'url',
			'output.0.url',
		];

		for (const pattern of imageUrlPatterns) {
			const value = this.getNestedValue(resp, pattern);
			if (value) {
				if (pattern.includes('b64_json')) {
					return { base64Data: `data:image/png;base64,${value}` };
				}
				return { imageUrl: value as string };
			}
		}

		// Try video URL patterns
		const videoUrlPatterns = [
			'content.video_url',
			'output_url',
			'video_url',
			'url',
		];

		for (const pattern of videoUrlPatterns) {
			const value = this.getNestedValue(resp, pattern);
			if (value) {
				return { videoUrl: value as string };
			}
		}

		throw new MediaGenError('Could not extract media data from response', 'API_ERROR');
	}

	/**
	 * Gets nested value from object using dot notation
	 *
	 * @param obj - Object to traverse
	 * @param path - Dot-notation path (e.g., 'data.0.url')
	 * @returns Value at path or undefined
	 */
	private static getNestedValue(obj: Record<string, unknown>, path: string): unknown {
		const keys = path.split('.');
		let value: unknown = obj;

		for (const key of keys) {
			if (value && typeof value === 'object' && key in value) {
				value = (value as Record<string, unknown>)[key];
			} else {
				return undefined;
			}

			// Handle array indices
			if (key.match(/^\d+$/)) {
				const index = parseInt(key, 10);
				if (Array.isArray(value) && index < value.length) {
					value = value[index];
				} else {
					return undefined;
				}
			}
		}

		return value;
	}

	/**
	 * Validates response has required fields
	 *
	 * @param response - Response to validate
	 * @param requiredFields - Array of required field paths
	 * @throws MediaGenError if validation fails
	 */
	static validateResponse(response: unknown, requiredFields: string[]): void {
		if (!response || typeof response !== 'object') {
			throw new MediaGenError('Invalid response: not an object', 'API_ERROR');
		}

		const resp = response as Record<string, unknown>;

		for (const fieldPath of requiredFields) {
			const value = this.getNestedValue(resp, fieldPath);
			if (value === undefined || value === null) {
				throw new MediaGenError(
					`Invalid response: missing required field '${fieldPath}'`,
					'API_ERROR'
				);
			}
		}
	}
}
