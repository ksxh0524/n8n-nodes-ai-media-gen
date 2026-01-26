/**
 * Video Processor for n8n-nodes-ai-media-gen
 * Handles video loading, processing, and conversion operations using ffmpeg
 */

import { spawn } from 'child_process';
import { MediaGenError, ERROR_CODES } from './errors';
import { VIDEO_MIME_TYPE_TO_FORMAT } from './videoTypes';
import type {
	VideoInput,
	VideoMetadata,
	TranscodeOptions,
	TrimOptions,
	MergeOptions,
	ExtractFramesOptions,
	AddAudioOptions,
	ExtractAudioOptions,
	ResizeVideoOptions,
	N8nVideoBinaryData,
	VideoProcessorOptions,
	FrameData,
	StreamInfo,
	FormatInfo,
} from './videoTypes';
import {
	VIDEO_FORMAT_TO_MIME_TYPE,
	VIDEO_EXTENSION_TO_FORMAT,
	SUPPORTED_VIDEO_FORMATS,
	VideoFormat,
} from './videoTypes';

/**
 * Default configuration values
 */
const DEFAULT_MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const DEFAULT_TIMEOUT = 300000; // 5 minutes
const DEFAULT_TEMP_DIR = '/tmp';

/**
 * Supported video MIME types
 */
const SUPPORTED_MIME_TYPES = new Set<string>(Object.values(VIDEO_FORMAT_TO_MIME_TYPE));

/**
 * VideoProcessor class for handling video operations
 */
export class VideoProcessor {
	private videoPath: string | null = null;
	private metadata: VideoMetadata | undefined = undefined;
	private maxFileSize: number;
	private timeout: number;
	private tempDir: string;
	private tempFiles: string[] = [];

	constructor(options: VideoProcessorOptions = {}) {
		this.maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
		this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
		this.tempDir = options.tempDir ?? DEFAULT_TEMP_DIR;
	}

	/**
	 * Load video from various input sources
	 */
	async loadVideo(input: VideoInput): Promise<void> {
		try {
			let buffer: Buffer;

			switch (input.type) {
				case 'url':
					if (!input.url) {
						throw new MediaGenError('URL is required for url type', ERROR_CODES.INVALID_PARAMS);
					}
					buffer = await this.loadFromUrl(input.url);
					break;

				case 'base64':
					if (!input.data) {
						throw new MediaGenError('Data is required for base64 type', ERROR_CODES.INVALID_PARAMS);
					}
					buffer = this.loadFromBase64(input.data as string);
					break;

				case 'binary':
				case 'n8n-binary':
				case 'buffer':
					if (!input.data) {
						throw new MediaGenError('Data is required for binary type', ERROR_CODES.INVALID_PARAMS);
					}
					buffer = input.data instanceof Buffer ? input.data : Buffer.from(input.data as string, 'base64');
					break;

				default:
					throw new MediaGenError(
						`Unsupported input type: ${(input as VideoInput).type}`,
						ERROR_CODES.INVALID_PARAMS
					);
			}

			if (buffer.length > this.maxFileSize) {
				throw new MediaGenError(
					`Video file size (${buffer.length} bytes) exceeds maximum allowed size (${this.maxFileSize} bytes)`,
					ERROR_CODES.IMAGE_TOO_LARGE
				);
			}

			const tempPath = `${this.tempDir}/video_${Date.now()}_${Math.random().toString(36).substring(7)}.${this.detectFormat(input)}`;
			await this.writeFile(tempPath, buffer);
			this.tempFiles.push(tempPath);
			this.videoPath = tempPath;

			await this.loadMetadata();
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to load video: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Load video from URL
	 */
	private async loadFromUrl(url: string): Promise<Buffer> {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), this.timeout);

			try {
				const response = await fetch(url, {
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					throw new MediaGenError(
						`Failed to fetch video from URL: ${response.statusText} (${response.status})`,
						ERROR_CODES.NETWORK_ERROR
					);
				}

				const contentType = response.headers.get('content-type');
				if (contentType && !SUPPORTED_MIME_TYPES.has(contentType)) {
					throw new MediaGenError(
						`Unsupported content type: ${contentType}`,
						ERROR_CODES.UNSUPPORTED_FORMAT
					);
				}

				const arrayBuffer = await response.arrayBuffer();
				return Buffer.from(arrayBuffer);
			} catch (error) {
				clearTimeout(timeoutId);
				throw error;
			}
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			if (error instanceof Error && error.name === 'AbortError') {
				throw new MediaGenError(
					`Request timeout: Failed to load video within ${this.timeout}ms`,
					ERROR_CODES.TIMEOUT
				);
			}
			throw new MediaGenError(
				`Failed to load video from URL: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.NETWORK_ERROR
			);
		}
	}

	/**
	 * Load video from base64 string
	 */
	private loadFromBase64(base64: string): Buffer {
		try {
			let cleanBase64 = base64;
			const match = base64.match(/^data:([^;]+);base64,(.+)$/);
			if (match) {
				const mimeType = match[1];
				if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
					throw new MediaGenError(
						`Unsupported content type: ${mimeType}`,
						ERROR_CODES.UNSUPPORTED_FORMAT
					);
				}
				cleanBase64 = match[2];
			}

			if (!cleanBase64 || cleanBase64.length === 0) {
				throw new MediaGenError(
					'Invalid base64 data: empty string',
					ERROR_CODES.INVALID_PARAMS
				);
			}

			const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
			if (!base64Regex.test(cleanBase64)) {
				throw new MediaGenError(
					'Invalid base64 format: contains invalid characters',
					ERROR_CODES.INVALID_PARAMS
				);
			}

			if (cleanBase64.length % 4 !== 0) {
				throw new MediaGenError(
					'Invalid base64 format: incorrect padding',
					ERROR_CODES.INVALID_PARAMS
				);
			}

			const buffer = Buffer.from(cleanBase64, 'base64');

			if (buffer.length === 0) {
				throw new MediaGenError(
					'Invalid base64 data: resulted in empty buffer',
					ERROR_CODES.INVALID_PARAMS
				);
			}

			return buffer;
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to parse base64 data: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.INVALID_PARAMS
			);
		}
	}

	/**
	 * Detect video format from input
	 */
	private detectFormat(input: VideoInput): string {
		if (input.fileName) {
			const ext = input.fileName.toLowerCase().split('.').pop();
			return ext || 'mp4';
		}
		if (input.mimeType) {
			const format = VIDEO_MIME_TYPE_TO_FORMAT[input.mimeType];
			return format || 'mp4';
		}
		return 'mp4';
	}

	/**
	 * Write buffer to file
	 */
	private async writeFile(path: string, buffer: Buffer): Promise<void> {
		const fs = await import('fs/promises');
		await fs.writeFile(path, buffer);
	}

	/**
	 * Load video metadata using ffprobe
	 */
	private async loadMetadata(): Promise<void> {
		if (!this.videoPath) {
			throw new MediaGenError(
				'No video loaded. Call loadVideo() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}

		try {
			const metadata = await this.runFFprobe(this.videoPath);
			this.metadata = metadata;
		} catch (error) {
			throw new MediaGenError(
				`Failed to load metadata: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Run ffprobe to get video metadata
	 */
	private async runFFprobe(inputPath: string): Promise<VideoMetadata> {
		return new Promise((resolve, reject) => {
			const ffprobe = spawn('ffprobe', [
				'-v', 'error',
				'-show_entries', 'format=stream=width,height,duration,bit_rate,codec_type,codec_name,r_frame_rate',
				'-of', 'json',
				inputPath,
			]);

			let stdout = '';
			let stderr = '';

			ffprobe.stdout.on('data', (data) => {
				stdout += data.toString();
			});

			ffprobe.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			ffprobe.on('close', (code) => {
				if (code !== 0) {
					reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
					return;
				}

				try {
					const data = JSON.parse(stdout);
					const streams = data.streams || [];

					const videoStream = streams.find((s: StreamInfo) => s.codec_type === 'video');
					const audioStream = streams.find((s: StreamInfo) => s.codec_type === 'audio');

					resolve({
						format: data.format?.format_name || 'unknown',
						duration: parseFloat(data.format?.duration || '0'),
						width: videoStream?.width || 0,
						height: videoStream?.height || 0,
						bitrate: parseInt(data.format?.bit_rate || '0'),
						frameRate: parseFloat(videoStream?.r_frame_rate || '0'),
						hasAudio: !!audioStream,
						audioCodec: audioStream?.codec_name,
						videoCodec: videoStream?.codec_name,
					});
				} catch (error) {
					reject(new Error(`Failed to parse ffprobe output: ${error}`));
				}
			});

			ffprobe.on('error', (error) => {
				reject(error);
			});
		});
	}

	/**
	 * Get video metadata
	 */
	getMetadata(): VideoMetadata | undefined {
		return this.metadata;
	}

	/**
	 * Transcode video to different format
	 */
	async transcode(options: TranscodeOptions): Promise<void> {
		if (!this.videoPath) {
			throw new MediaGenError(
				'No video loaded. Call loadVideo() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}

		try {
			const outputPath = `${this.tempDir}/transcoded_${Date.now()}.${options.format}`;
			this.tempFiles.push(outputPath);

			const args = this.buildTranscodeArgs(this.videoPath, outputPath, options);
			await this.runFFmpeg(args);

			this.videoPath = outputPath;
			await this.loadMetadata();
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to transcode video: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Build ffmpeg transcode arguments
	 */
	private buildTranscodeArgs(inputPath: string, outputPath: string, options: TranscodeOptions): string[] {
		const args = ['-i', inputPath];

		if (options.videoCodec) {
			args.push('-c:v', options.videoCodec);
		}

		if (options.audioCodec) {
			args.push('-c:a', options.audioCodec);
		}

		if (options.videoBitrate) {
			args.push('-b:v', options.videoBitrate);
		}

		if (options.audioBitrate) {
			args.push('-b:a', options.audioBitrate);
		}

		if (options.frameRate) {
			args.push('-r', options.frameRate.toString());
		}

		if (options.crf !== undefined) {
			args.push('-crf', options.crf.toString());
		}

		if (options.preset) {
			args.push('-preset', options.preset);
		}

		args.push(outputPath);
		return args;
	}

	/**
	 * Trim video
	 */
	async trim(options: TrimOptions): Promise<void> {
		if (!this.videoPath) {
			throw new MediaGenError(
				'No video loaded. Call loadVideo() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}

		try {
			const outputPath = `${this.tempDir}/trimmed_${Date.now()}.${this.detectFormatFromPath(this.videoPath)}`;
			this.tempFiles.push(outputPath);

			const args = [
				'-i', this.videoPath,
				'-ss', options.startTime.toString(),
			];

			if (options.endTime) {
				args.push('-to', options.endTime.toString());
			} else if (options.duration) {
				args.push('-t', options.duration.toString());
			}

			args.push('-c', 'copy');
			args.push(outputPath);

			await this.runFFmpeg(args);

			this.videoPath = outputPath;
			await this.loadMetadata();
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to trim video: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Detect format from file path
	 */
	private detectFormatFromPath(path: string): string {
		const ext = path.split('.').pop();
		return ext || 'mp4';
	}

	/**
	 * Merge multiple videos
	 */
	async merge(options: MergeOptions): Promise<void> {
		try {
			const outputPath = `${this.tempDir}/merged_${Date.now()}.${options.outputFormat || 'mp4'}`;
			this.tempFiles.push(outputPath);

			const args = ['-f', 'concat'];

			for (const input of options.inputs) {
				if (typeof input === 'string') {
					args.push('-i', input);
				} else {
					const tempPath = `${this.tempDir}/merge_input_${Date.now()}.mp4`;
					this.tempFiles.push(tempPath);
					await this.writeFile(tempPath, input);
					args.push('-i', tempPath);
				}
			}

			args.push('-c', 'copy');
			args.push(outputPath);

			await this.runFFmpeg(args);

			this.videoPath = outputPath;
			await this.loadMetadata();
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to merge videos: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Extract frames from video
	 */
	async extractFrames(options: ExtractFramesOptions): Promise<FrameData[]> {
		if (!this.videoPath) {
			throw new MediaGenError(
				'No video loaded. Call loadVideo() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}

		try {
			const framesDir = `${this.tempDir}/frames_${Date.now()}`;
			const fs = await import('fs/promises');
			await fs.mkdir(framesDir, { recursive: true });

			const args = [
				'-i', this.videoPath,
				'-vf', `fps=${options.frameRate || 1}`,
			];

			if (options.startTime !== undefined) {
				args.push('-ss', options.startTime.toString());
			}

			if (options.endTime !== undefined) {
				args.push('-to', options.endTime.toString());
			}

			args.push(`${framesDir}/frame_%04d.${options.format || 'jpg'}`);

			await this.runFFmpeg(args);

			const files = await fs.readdir(framesDir);
			const frames: FrameData[] = [];

			for (const file of files) {
				const filePath = `${framesDir}/${file}`;
				const buffer = await fs.readFile(filePath);
				const match = file.match(/frame_(\d{4})/);
				const frameNumber = match ? parseInt(match[1]) : 0;

				frames.push({
					buffer,
					timestamp: frameNumber / (options.frameRate || 1),
					frameNumber,
				});
			}

			return frames.sort((a, b) => a.frameNumber - b.frameNumber);
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to extract frames: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Add audio to video
	 */
	async addAudio(options: AddAudioOptions): Promise<void> {
		if (!this.videoPath) {
			throw new MediaGenError(
				'No video loaded. Call loadVideo() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}

		try {
			let audioPath: string;

			if (typeof options.audio === 'string') {
				if (options.audio.startsWith('data:')) {
					const base64Data = options.audio.split(',')[1];
					const buffer = Buffer.from(base64Data, 'base64');
					audioPath = `${this.tempDir}/audio_${Date.now()}.mp3`;
					await this.writeFile(audioPath, buffer);
					this.tempFiles.push(audioPath);
				} else {
					audioPath = options.audio;
				}
			} else {
				audioPath = `${this.tempDir}/audio_${Date.now()}.mp3`;
				await this.writeFile(audioPath, options.audio);
				this.tempFiles.push(audioPath);
			}

			const outputPath = `${this.tempDir}/with_audio_${Date.now()}.${this.detectFormatFromPath(this.videoPath)}`;
			this.tempFiles.push(outputPath);

			const args = [
				'-i', this.videoPath,
				'-i', audioPath,
			];

			if (options.audioCodec) {
				args.push('-c:a', options.audioCodec);
			}

			if (options.audioVolume !== undefined) {
				args.push('-af', `volume=${options.audioVolume}`);
			}

			if (options.mix) {
				args.push('-filter_complex', '[0:v][1:a]concat=n=1:v=0:a=0[out]');
				args.push('-map', '[out]');
			}

			args.push('-c:v', 'copy');
			args.push(outputPath);

			await this.runFFmpeg(args);

			this.videoPath = outputPath;
			await this.loadMetadata();
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to add audio: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Extract audio from video
	 */
	async extractAudio(options: ExtractAudioOptions = {}): Promise<Buffer> {
		if (!this.videoPath) {
			throw new MediaGenError(
				'No video loaded. Call loadVideo() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}

		try {
			const outputPath = `${this.tempDir}/audio_${Date.now()}.${options.format || 'mp3'}`;
			this.tempFiles.push(outputPath);

			const args = [
				'-i', this.videoPath,
				'-vn',
			];

			if (options.bitrate) {
				args.push('-b:a', options.bitrate);
			}

			args.push(outputPath);

			await this.runFFmpeg(args);

			const fs = await import('fs/promises');
			return await fs.readFile(outputPath);
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to extract audio: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Resize video
	 */
	async resize(options: ResizeVideoOptions): Promise<void> {
		if (!this.videoPath) {
			throw new MediaGenError(
				'No video loaded. Call loadVideo() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}

		try {
			const outputPath = `${this.tempDir}/resized_${Date.now()}.${this.detectFormatFromPath(this.videoPath)}`;
			this.tempFiles.push(outputPath);

			const args = ['-i', this.videoPath];

			if (options.width || options.height) {
				let scaleFilter = 'scale=';
				if (options.width) {
					scaleFilter += `${options.width}:`;
				}
				if (options.height) {
					scaleFilter += options.height;
				} else {
					scaleFilter += '-1';
				}

				if (options.aspectRatio) {
					scaleFilter += `:force_original_aspect_ratio=decrease`;
				}

				args.push('-vf', scaleFilter);
			}

			args.push('-c:a', 'copy');
			args.push(outputPath);

			await this.runFFmpeg(args);

			this.videoPath = outputPath;
			await this.loadMetadata();
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to resize video: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Run ffmpeg command
	 */
	private async runFFmpeg(args: string[]): Promise<void> {
		return new Promise((resolve, reject) => {
			const ffmpeg = spawn('ffmpeg', args);

			let stderr = '';

			ffmpeg.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			ffmpeg.on('close', (code) => {
				if (code !== 0) {
					reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
					return;
				}
				resolve();
			});

			ffmpeg.on('error', (error) => {
				reject(error);
			});
		});
	}

	/**
	 * Output video as Buffer
	 */
	async toBuffer(): Promise<Buffer> {
		if (!this.videoPath) {
			throw new MediaGenError(
				'No video loaded. Call loadVideo() first.',
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}

		try {
			const fs = await import('fs/promises');
			return await fs.readFile(this.videoPath);
		} catch (error) {
			throw new MediaGenError(
				`Failed to output buffer: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Output video as n8n binary format
	 */
	async toN8nBinary(fileName: string): Promise<N8nVideoBinaryData> {
		try {
			const buffer = await this.toBuffer();
			const metadata = this.getMetadata();

			const fileExtension = `.${metadata?.format || 'mp4'}`;
			const format = metadata?.format as VideoFormat || 'mp4';

			return {
				data: buffer.toString('base64'),
				mimeType: VIDEO_FORMAT_TO_MIME_TYPE[format] || 'video/mp4',
				fileName: fileName || `video${fileExtension}`,
				fileExtension,
				fileSize: buffer.length.toString(),
				duration: metadata?.duration,
			};
		} catch (error) {
			if (error instanceof MediaGenError) {
				throw error;
			}
			throw new MediaGenError(
				`Failed to output n8n binary: ${error instanceof Error ? error.message : String(error)}`,
				ERROR_CODES.IMAGE_PROCESSING_FAILED
			);
		}
	}

	/**
	 * Get format from file name
	 */
	static getFormatFromFileName(fileName: string): string {
		const ext = fileName.toLowerCase().split('.').pop();
		if (ext && VIDEO_EXTENSION_TO_FORMAT[`.${ext}`]) {
			return VIDEO_EXTENSION_TO_FORMAT[`.${ext}`];
		}
		return 'mp4';
	}

	/**
	 * Get MIME type from file name
	 */
	static getMimeTypeFromFileName(fileName: string): string {
		const format = VideoProcessor.getFormatFromFileName(fileName);
		const formatKey = format as keyof typeof VIDEO_FORMAT_TO_MIME_TYPE;
		return VIDEO_FORMAT_TO_MIME_TYPE[formatKey] || 'video/mp4';
	}

	/**
	 * Validate if a format is supported
	 */
	static isFormatSupported(format: string): boolean {
		return SUPPORTED_VIDEO_FORMATS.includes(format as VideoFormat);
	}

	/**
	 * Get supported formats
	 */
	static getSupportedFormats(): typeof SUPPORTED_VIDEO_FORMATS {
		return SUPPORTED_VIDEO_FORMATS;
	}

	/**
	 * Get supported MIME types
	 */
	static getSupportedMimeTypes(): typeof SUPPORTED_MIME_TYPES {
		return SUPPORTED_MIME_TYPES;
	}

	/**
	 * Clean up resources
	 */
	async destroy(): Promise<void> {
		const fs = await import('fs/promises');

		for (const tempFile of this.tempFiles) {
			try {
				await fs.unlink(tempFile);
			} catch {
				// Ignore cleanup errors
			}
		}

		this.tempFiles = [];
		this.videoPath = null;
		this.metadata = undefined;
	}
}
