/**
 * Media Processing Action Handler for n8n-nodes-ai-media-gen
 * Handles local media processing operations (resize, crop, convert, etc.)
 */

import { BaseActionHandler, type IActionHandler, type ActionParameters, type ValidationResult } from '../utils/actionHandler';
import type { INodeExecutionData } from 'n8n-workflow';
import { ImageProcessor } from '../utils/imageProcessor';
import { VideoProcessor } from '../utils/videoProcessor';
import { MediaGenError, ERROR_CODES } from '../utils/errors';
import type { IExecuteFunctions } from 'n8n-workflow';

/**
 * Media Processing Action Handler
 */
export class MediaProcessingActionHandler extends BaseActionHandler implements IActionHandler {
	readonly actionName = 'processing' as const;
	readonly displayName = 'Media Processing';
	readonly description = 'Process images and videos locally (resize, crop, convert, filter, etc.)';
	readonly mediaType = 'image' as const;
	readonly credentialType = '';
	readonly requiresCredential = false;

	constructor() {
		super('processing', 'Media Processing', 'Process images and videos locally (resize, crop, convert, filter, etc.)', 'image', '', false);
	}

	getParameters() {
		return [];
	}

	validateParameters(params: ActionParameters): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!params.operation || typeof params.operation !== 'string') {
			errors.push('Operation is required');
		}

		if (!params.input) {
			errors.push('Input media is required');
		}

		const operation = params.operation as string;
		const validImageOperations = [
			'resize',
			'crop',
			'convert',
			'filter',
			'watermark',
			'compress',
			'rotate',
			'flip',
			'adjust',
			'blur',
			'sharpen',
		];

		const validVideoOperations = [
			'transcode',
			'trim',
			'extractFrames',
			'addAudio',
			'extractAudio',
			'resizeVideo',
		];

		const mediaType = params.mediaType as string;
		if (mediaType === 'image' && !validImageOperations.includes(operation)) {
			errors.push(`Invalid image operation: ${operation}`);
		}

		if (mediaType === 'video' && !validVideoOperations.includes(operation)) {
			errors.push(`Invalid video operation: ${operation}`);
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
		_credentials?: Record<string, unknown>
	): Promise<INodeExecutionData> {
		try {
			const mediaType = this.getParameter<string>(context, itemIndex, 'mediaType') || 'image';
			const operation = this.getParameter<string>(context, itemIndex, 'operation');
			const binaryPropertyName = this.getParameter<string>(context, itemIndex, 'binaryPropertyName');

			const items = context.getInputData();
			const item = items[itemIndex];

			if (!item || !item.binary) {
				return this.buildErrorResponse('No binary data found in input');
			}

			const binaryKey = binaryPropertyName || Object.keys(item.binary)[0];
			context.helpers.assertBinaryData(itemIndex, binaryKey);
			const buffer = await context.helpers.getBinaryDataBuffer(itemIndex, binaryKey) as Buffer;

			if (mediaType === 'image') {
				const result = await this.processImage(buffer, operation, context, itemIndex);
				return this.buildSuccessResponse(result);
			} else if (mediaType === 'video') {
				const result = await this.processVideo(buffer, operation, context, itemIndex);
				return this.buildSuccessResponse(result);
			} else {
				return this.buildErrorResponse(`Unsupported media type: ${mediaType}`);
			}
		} catch (error) {
			if (error instanceof MediaGenError) {
				return this.buildErrorResponse(error.message, error.code, error.details as Record<string, unknown>);
			}
			return this.buildErrorResponse(
				error instanceof Error ? error.message : String(error),
				'UNKNOWN'
			);
		}
	}

	private async processImage(
		buffer: Buffer,
		operation: string,
		context: IExecuteFunctions,
		itemIndex: number
	): Promise<{ data: string; mimeType: string; fileName: string }> {
		const processor = new ImageProcessor();

		await processor.loadImage({
			type: 'binary',
			data: buffer,
		});

		switch (operation) {
			case 'resize': {
				const width = this.getParameter<number>(context, itemIndex, 'width');
				const height = this.getParameter<number>(context, itemIndex, 'height');
				const fit = this.getParameter<string>(context, itemIndex, 'fit');

				await processor.resize({
					width,
					height,
					fit: (fit as any) || 'cover',
				});
				break;
			}

			case 'crop': {
				const left = this.getParameter<number>(context, itemIndex, 'left');
				const top = this.getParameter<number>(context, itemIndex, 'top');
				const cropWidth = this.getParameter<number>(context, itemIndex, 'cropWidth');
				const cropHeight = this.getParameter<number>(context, itemIndex, 'cropHeight');

				await processor.crop({ left, top, width: cropWidth, height: cropHeight });
				break;
			}

			case 'convert': {
				const format = this.getParameter<string>(context, itemIndex, 'format');
				const quality = this.getParameter<number>(context, itemIndex, 'quality');

				await processor.convert({
					format: format as any,
					compressOptions: { quality },
				});
				break;
			}

			case 'filter': {
				const filterType = this.getParameter<string>(context, itemIndex, 'filterType');
				const filterValue = this.getParameter<number>(context, itemIndex, 'filterValue');

				await processor.filter({
					type: filterType as any,
					value: filterValue,
				});
				break;
			}

			case 'watermark': {
				const watermarkImage = this.getParameter<string>(context, itemIndex, 'watermarkImage');
				const watermarkPosition = this.getParameter<string>(context, itemIndex, 'watermarkPosition');

				await processor.watermark({
					image: watermarkImage,
					position: watermarkPosition as any,
				});
				break;
			}

			case 'compress': {
				const quality = this.getParameter<number>(context, itemIndex, 'quality');
				const targetSize = this.getParameter<number>(context, itemIndex, 'targetSize');

				await processor.compress({
					quality,
					targetSize,
				});
				break;
			}

			case 'rotate': {
				const angle = this.getParameter<number>(context, itemIndex, 'angle');

				await processor.rotate({ angle });
				break;
			}

			case 'flip': {
				const horizontal = this.getParameter<boolean>(context, itemIndex, 'horizontal');
				const vertical = this.getParameter<boolean>(context, itemIndex, 'vertical');

				await processor.flip({ horizontal, vertical });
				break;
			}

			case 'adjust': {
				const brightness = this.getParameter<number>(context, itemIndex, 'brightness');
				const contrast = this.getParameter<number>(context, itemIndex, 'contrast');
				const saturation = this.getParameter<number>(context, itemIndex, 'saturation');

				await processor.adjust({ brightness, contrast, saturation });
				break;
			}

			case 'blur': {
				const sigma = this.getParameter<number>(context, itemIndex, 'sigma');

				await processor.blur({ sigma });
				break;
			}

			case 'sharpen': {
				const sigma = this.getParameter<number>(context, itemIndex, 'sigma');

				await processor.sharpen({ sigma });
				break;
			}

			default:
				throw new MediaGenError(`Unsupported image operation: ${operation}`, ERROR_CODES.INVALID_PARAMS);
		}

		const outputBuffer = await processor.toBuffer();
		const metadata = await processor.getMetadata();
		const format = metadata.format || 'jpeg';
		const fileName = `processed_${Date.now()}.${format}`;

		return {
			data: outputBuffer.toString('base64'),
			mimeType: `image/${format}`,
			fileName,
		};
	}

	private async processVideo(
		buffer: Buffer,
		operation: string,
		context: IExecuteFunctions,
		itemIndex: number
	): Promise<{ data: string; mimeType: string; fileName: string }> {
		const processor = new VideoProcessor();

		await processor.loadVideo({
			type: 'binary',
			data: buffer,
		});

		switch (operation) {
			case 'transcode': {
				const outputFormat = this.getParameter<string>(context, itemIndex, 'outputFormat');
				const videoCodec = this.getParameter<string>(context, itemIndex, 'videoCodec');

				await processor.transcode({
					format: outputFormat as any,
					videoCodec: videoCodec as any,
				});
				break;
			}

			case 'trim': {
				const startTime = this.getParameter<number>(context, itemIndex, 'startTime');
				const duration = this.getParameter<number>(context, itemIndex, 'duration');

				await processor.trim({
					startTime,
					duration,
				});
				break;
			}

			case 'extractFrames': {
				const frameRate = this.getParameter<number>(context, itemIndex, 'frameRate');
				const count = this.getParameter<number>(context, itemIndex, 'count');

				await processor.extractFrames({
					frameRate,
					count,
				});
				break;
			}

			case 'addAudio': {
				const audioUrl = this.getParameter<string>(context, itemIndex, 'audioUrl');

				await processor.addAudio({
					audio: audioUrl,
				});
				break;
			}

			case 'extractAudio': {
				await processor.extractAudio();
				break;
			}

			case 'resizeVideo': {
				const width = this.getParameter<number>(context, itemIndex, 'width');
				const height = this.getParameter<number>(context, itemIndex, 'height');

				await processor.resize({
					width,
					height,
				});
				break;
			}

			default:
				throw new MediaGenError(`Unsupported video operation: ${operation}`, ERROR_CODES.INVALID_PARAMS);
		}

		const outputBuffer = await processor.toBuffer();
		const fileName = `processed_${Date.now()}.mp4`;

		return {
			data: outputBuffer.toString('base64'),
			mimeType: 'video/mp4',
			fileName,
		};
	}
}
