/**
 * Image processing types for n8n-nodes-ai-media-gen
 */

/**
 * Supported image formats for conversion
 */
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'tiff' | 'avif';

/**
 * Supported fit modes for resize operation
 */
export type ResizeFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

/**
 * Supported kernel algorithms for resize
 */
export type ResizeKernel =
	| 'nearest'
	| 'cubic'
	| 'mitchell'
	| 'lanczos2'
	| 'lanczos3';

/**
 * Input source types for image loading
 */
export type ImageInputType = 'url' | 'base64' | 'binary' | 'n8n-binary' | 'buffer';

/**
 * Image input from various sources
 */
export interface ImageInput {
	type: ImageInputType;
	// For 'url' type
	url?: string;
	// For 'base64' type
	data?: string | Buffer;
	// For 'binary' and 'n8n-binary' types
	fileName?: string;
	mimeType?: string;
}

/**
 * Image metadata information
 */
export interface ImageMetadata {
	format: string;
	width: number;
	height: number;
	channels: number;
	prefixed?: boolean;
	hasAlpha: boolean;
	hasProfile: boolean;
	isProgressive: boolean;
	fileSize?: number;
	orientation?: number;
	density?: number;
	chromaSubsampling?: string;
	isLinear?: boolean;
}

/**
 * Resize options
 */
export interface ResizeOptions {
	width: number;
	height?: number;
	fit?: ResizeFit;
	kernel?: ResizeKernel;
	withoutEnlargement?: boolean;
	position?: number | string;
}

/**
 * Crop options
 */
export interface CropOptions {
	left: number;
	top: number;
	width: number;
	height: number;
}

/**
 * Compression options
 */
export interface CompressOptions {
	quality?: number;
	progressive?: boolean;
	effort?: number;
	nearLossless?: boolean;
}

/**
 * Format conversion options
 */
export interface ConvertOptions {
	format: ImageFormat;
	compressOptions?: CompressOptions;
}

/**
 * n8n binary data format
 */
export interface N8nBinaryData {
	data: string;
	mimeType: string;
	fileName?: string;
	fileExtension?: string;
	fileSize?: string;
	[key: string]: string | number | undefined;
}

/**
 * Image processor configuration options
 */
export interface ImageProcessorOptions {
	maxFileSize?: number;
	timeout?: number;
}

/**
 * Shared constants for image processing
 */
export const SUPPORTED_IMAGE_FORMATS: ImageFormat[] = ['jpeg', 'png', 'webp', 'gif', 'tiff', 'avif'];

export const SUPPORTED_RESIZE_FITS: ResizeFit[] = ['cover', 'contain', 'fill', 'inside', 'outside'];

export const SUPPORTED_RESIZE_KERNELS: ResizeKernel[] = ['nearest', 'cubic', 'mitchell', 'lanczos2', 'lanczos3'];

/**
 * Format to MIME type mapping
 */
export const FORMAT_TO_MIME_TYPE: Record<ImageFormat, string> = {
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif',
	tiff: 'image/tiff',
	avif: 'image/avif',
} as const;

/**
 * Extension to format mapping
 */
export const EXTENSION_TO_FORMAT: Record<string, ImageFormat> = {
	'.jpg': 'jpeg',
	'.jpeg': 'jpeg',
	'.png': 'png',
	'.webp': 'webp',
	'.gif': 'gif',
	'.tif': 'tiff',
	'.tiff': 'tiff',
	'.avif': 'avif',
} as const;

/**
 * MIME type to format mapping
 */
export const MIME_TYPE_TO_FORMAT: Record<string, ImageFormat> = {
	'image/jpeg': 'jpeg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/tiff': 'tiff',
	'image/avif': 'avif',
} as const;

/**
 * Filter types for image processing
 */
export type FilterType =
	| 'blur'
	| 'sharpen'
	| 'brightness'
	| 'contrast'
	| 'saturation'
	| 'grayscale'
	| 'sepia'
	| 'invert'
	| 'normalize'
	| 'modulate';

/**
 * Filter options
 */
export interface FilterOptions {
	type: FilterType;
	value?: number;
	sigma?: number;
	flat?: number;
	jagged?: number;
}

/**
 * Watermark options
 */
export interface WatermarkOptions {
	image: Buffer | string;
	position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
	opacity?: number;
	scale?: number;
	padding?: number;
}

/**
 * Compress options (extended)
 */
export interface ExtendedCompressOptions extends CompressOptions {
	method?: 'auto' | 'jpeg' | 'png' | 'webp';
	targetSize?: number;
	targetQuality?: number;
}

/**
 * Rotate options
 */
export interface RotateOptions {
	angle: number;
	background?: string;
}

/**
 * Flip options
 */
export interface FlipOptions {
	horizontal?: boolean;
	vertical?: boolean;
}

/**
 * Adjust options (brightness, contrast, etc.)
 */
export interface AdjustOptions {
	brightness?: number;
	contrast?: number;
	saturation?: number;
	hue?: number;
	lightness?: number;
}

/**
 * Blur options
 */
export interface BlurOptions {
	sigma?: number;
	precise?: boolean;
}

/**
 * Sharpen options
 */
export interface SharpenOptions {
	sigma?: number;
	flat?: boolean;
	jagged?: boolean;
}
