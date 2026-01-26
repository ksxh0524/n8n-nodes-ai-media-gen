/**
 * Video processing types for n8n-nodes-ai-media-gen
 */

/**
 * Supported video formats for conversion
 */
export type VideoFormat = 'mp4' | 'webm' | 'avi' | 'mov' | 'mkv' | 'flv';

/**
 * Supported video codecs
 */
export type VideoCodec = 'h264' | 'h265' | 'vp8' | 'vp9' | 'av1' | 'prores' | 'copy';

/**
 * Supported audio codecs
 */
export type AudioCodec = 'aac' | 'mp3' | 'opus' | 'vorbis' | 'flac' | 'copy';

/**
 * Video input source types
 */
export type VideoInputType = 'url' | 'base64' | 'binary' | 'n8n-binary' | 'buffer';

/**
 * Video input from various sources
 */
export interface VideoInput {
	type: VideoInputType;
	url?: string;
	data?: string | Buffer;
	fileName?: string;
	mimeType?: string;
}

/**
 * Video metadata information
 */
export interface VideoMetadata {
	format: string;
	duration: number;
	width: number;
	height: number;
	bitrate: number;
	frameRate: number;
	hasAudio: boolean;
	audioCodec?: string;
	videoCodec?: string;
	fileSize?: number;
}

/**
 * Transcode options
 */
export interface TranscodeOptions {
	format: VideoFormat;
	videoCodec?: VideoCodec;
	audioCodec?: AudioCodec;
	videoBitrate?: string;
	audioBitrate?: string;
	frameRate?: number;
	crf?: number;
	preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
}

/**
 * Trim options
 */
export interface TrimOptions {
	startTime: number;
	endTime?: number;
	duration?: number;
}

/**
 * Merge options
 */
export interface MergeOptions {
	inputs: (Buffer | string)[];
	outputFormat?: VideoFormat;
	audioCodec?: AudioCodec;
	videoCodec?: VideoCodec;
}

/**
 * Extract frames options
 */
export interface ExtractFramesOptions {
	frameRate?: number;
	startTime?: number;
	endTime?: number;
	count?: number;
	format?: 'jpg' | 'png' | 'webp';
	quality?: number;
}

/**
 * Add audio options
 */
export interface AddAudioOptions {
	audio: Buffer | string;
	audioCodec?: AudioCodec;
	audioVolume?: number;
	mix?: boolean;
}

/**
 * Extract audio options
 */
export interface ExtractAudioOptions {
	format?: 'mp3' | 'aac' | 'flac' | 'wav';
	bitrate?: string;
}

/**
 * Resize video options
 */
export interface ResizeVideoOptions {
	width?: number;
	height?: number;
	aspectRatio?: string;
}

/**
 * Video processor configuration options
 */
export interface VideoProcessorOptions {
	maxFileSize?: number;
	timeout?: number;
	tempDir?: string;
}

/**
 * n8n binary data format for video
 */
export interface N8nVideoBinaryData {
	data: string;
	mimeType: string;
	fileName?: string;
	fileExtension?: string;
	fileSize?: string;
	duration?: number;
	[key: string]: string | number | undefined;
}

/**
 * Frame data
 */
export interface FrameData {
	data: string;
	fileName: string;
	timestamp: number;
	frameNumber: number;
}

/**
 * FFProbe stream info
 */
export interface StreamInfo {
	codec_type: 'video' | 'audio' | 'subtitle';
	codec_name?: string;
	width?: number;
	height?: number;
	r_frame_rate?: string;
}

/**
 * FFProbe format info
 */
export interface FormatInfo {
	format_name?: string;
	duration?: string;
	bit_rate?: string;
}

/**
 * FFProbe data
 */
export interface FFProbeData {
	format?: FormatInfo;
	streams?: StreamInfo[];
}

/**
 * Shared constants for video processing
 */
export const SUPPORTED_VIDEO_FORMATS: VideoFormat[] = ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv'];
export const SUPPORTED_VIDEO_CODECS: VideoCodec[] = ['h264', 'h265', 'vp8', 'vp9', 'av1', 'prores', 'copy'];
export const SUPPORTED_AUDIO_CODECS: AudioCodec[] = ['aac', 'mp3', 'opus', 'vorbis', 'flac', 'copy'];
export const SUPPORTED_PRESETS: TranscodeOptions['preset'][] = [
	'ultrafast',
	'superfast',
	'veryfast',
	'faster',
	'fast',
	'medium',
	'slow',
	'slower',
	'veryslow',
];

/**
 * Format to MIME type mapping
 */
export const VIDEO_FORMAT_TO_MIME_TYPE: Record<VideoFormat, string> = {
	mp4: 'video/mp4',
	webm: 'video/webm',
	avi: 'video/x-msvideo',
	mov: 'video/quicktime',
	mkv: 'video/x-matroska',
	flv: 'video/x-flv',
} as const;

/**
 * Extension to format mapping
 */
export const VIDEO_EXTENSION_TO_FORMAT: Record<string, VideoFormat> = {
	'.mp4': 'mp4',
	'.webm': 'webm',
	'.avi': 'avi',
	'.mov': 'mov',
	'.mkv': 'mkv',
	'.flv': 'flv',
} as const;

/**
 * MIME type to format mapping
 */
export const VIDEO_MIME_TYPE_TO_FORMAT: Record<string, VideoFormat> = {
	'video/mp4': 'mp4',
	'video/webm': 'webm',
	'video/x-msvideo': 'avi',
	'video/quicktime': 'mov',
	'video/x-matroska': 'mkv',
	'video/x-flv': 'flv',
} as const;
