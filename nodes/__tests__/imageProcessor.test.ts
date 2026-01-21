/**
 * Unit tests for ImageProcessor
 */

import { ImageProcessor } from '../utils/imageProcessor';
import {
	assertValidImageInput,
	assertValidResizeOptions,
	assertValidCropOptions,
	assertValidCompressOptions,
	assertValidConvertOptions,
	validateImageInput,
	validateResizeOptions,
	validateCropOptions,
	validateCompressOptions,
	validateConvertOptions,
} from '../utils/imageValidators';
import { MediaGenError } from '../utils/errors';
import sharp from 'sharp';

describe('ImageProcessor', () => {
	let testBuffer: Buffer;

	beforeAll(async () => {
		// Create a simple test image (100x100 red square)
		testBuffer = await sharp({
			create: {
				width: 100,
				height: 100,
				channels: 3,
				background: { r: 255, g: 0, b: 0 },
			},
		})
			.jpeg()
			.toBuffer();
	});

	afterEach(() => {
		// Clean up processor after each test
	});

	describe('loadImage from buffer', () => {
		it('should load image from buffer', async () => {
			const processor = new ImageProcessor();
			await processor.loadImage({
				type: 'binary',
				data: testBuffer,
				fileName: 'test.jpg',
			});

			const metadata = await processor.getMetadata();
			expect(metadata.format).toBe('jpeg');
			expect(metadata.width).toBe(100);
			expect(metadata.height).toBe(100);
		});

		it('should load image from base64', async () => {
			const processor = new ImageProcessor();
			const base64 = testBuffer.toString('base64');
			await processor.loadImage({
				type: 'base64',
				data: base64,
			});

			const metadata = await processor.getMetadata();
			expect(metadata.format).toBe('jpeg');
			expect(metadata.width).toBe(100);
		});

		it('should load image from data URL', async () => {
			const processor = new ImageProcessor();
			const dataUrl = `data:image/jpeg;base64,${testBuffer.toString('base64')}`;
			await processor.loadImage({
				type: 'base64',
				data: dataUrl,
			});

			const metadata = await processor.getMetadata();
			expect(metadata.format).toBe('jpeg');
		});
	});

	describe('file size validation', () => {
		it('should reject images larger than max file size', async () => {
			const processor = new ImageProcessor({ maxFileSize: 100 }); // 100 bytes

			await expect(
				processor.loadImage({
					type: 'binary',
					data: testBuffer,
				})
			).rejects.toThrow(MediaGenError);
		});

		it('should accept images within max file size', async () => {
			const processor = new ImageProcessor({ maxFileSize: 1000000 }); // 1MB

			await expect(
				processor.loadImage({
					type: 'binary',
					data: testBuffer,
				})
			).resolves.not.toThrow();
		});
	});

	describe('getMetadata', () => {
		it('should extract image metadata', async () => {
			const processor = new ImageProcessor();
			await processor.loadImage({
				type: 'binary',
				data: testBuffer,
			});

			const metadata = await processor.getMetadata();

			expect(metadata).toMatchObject({
				format: 'jpeg',
				width: 100,
				height: 100,
				hasAlpha: false,
				isProgressive: false,
			});
			expect(metadata.fileSize).toBeGreaterThan(0);
		});

		it('should throw error if no image loaded', async () => {
			const processor = new ImageProcessor();

			await expect(processor.getMetadata()).rejects.toThrow('No image loaded');
		});
	});

	describe('resize', () => {
		it('should resize image with default options', async () => {
			const processor = new ImageProcessor();
			await processor.loadImage({
				type: 'binary',
				data: testBuffer,
			});

			await processor.resize({ width: 50, height: 50 });
			const buffer = await processor.toBuffer();
			const resizedMetadata = await sharp(buffer).metadata();

			expect(resizedMetadata.width).toBe(50);
			expect(resizedMetadata.height).toBe(50);
		});

		it('should resize image with cover fit', async () => {
			const processor = new ImageProcessor();
			await processor.loadImage({
				type: 'binary',
				data: testBuffer,
			});

			await processor.resize({ width: 200, height: 100, fit: 'cover' });
			const buffer = await processor.toBuffer();
			const resizedMetadata = await sharp(buffer).metadata();

			expect(resizedMetadata.width).toBe(200);
			expect(resizedMetadata.height).toBe(100);
		});

		it('should throw error if no image loaded', async () => {
			const processor = new ImageProcessor();

			await expect(processor.resize({ width: 50, height: 50 })).rejects.toThrow(
				'No image loaded'
			);
		});
	});

	describe('crop', () => {
		it('should crop image', async () => {
			const processor = new ImageProcessor();
			await processor.loadImage({
				type: 'binary',
				data: testBuffer,
			});

			await processor.crop({ left: 10, top: 10, width: 50, height: 50 });
			const buffer = await processor.toBuffer();
			const croppedMetadata = await sharp(buffer).metadata();

			expect(croppedMetadata.width).toBe(50);
			expect(croppedMetadata.height).toBe(50);
		});

		it('should throw error if no image loaded', async () => {
			const processor = new ImageProcessor();

			await expect(
				processor.crop({ left: 0, top: 0, width: 50, height: 50 })
			).rejects.toThrow('No image loaded');
		});
	});

	describe('convert', () => {
		it('should convert jpeg to png', async () => {
			const processor = new ImageProcessor();
			await processor.loadImage({
				type: 'binary',
				data: testBuffer,
			});

			await processor.convert({ format: 'png' });
			const buffer = await processor.toBuffer();

			expect(buffer.length).toBeGreaterThan(0);
		});

		it('should convert jpeg to webp with quality', async () => {
			const processor = new ImageProcessor();
			await processor.loadImage({
				type: 'binary',
				data: testBuffer,
			});

			await processor.convert({ format: 'webp', compressOptions: { quality: 85 } });
			const buffer = await processor.toBuffer();

			expect(buffer.length).toBeGreaterThan(0);
		});

		it('should throw error for unsupported format', async () => {
			const processor = new ImageProcessor();
			await processor.loadImage({
				type: 'binary',
				data: testBuffer,
			});

			await expect(processor.convert({ format: 'bmp' as any })).rejects.toThrow();
		});
	});

	describe('toN8nBinary', () => {
		it('should output n8n binary format', async () => {
			const processor = new ImageProcessor();
			await processor.loadImage({
				type: 'binary',
				data: testBuffer,
			});

			const binary = await processor.toN8nBinary('test_output.jpg');

			expect(binary.data).toBeDefined();
			expect(binary.mimeType).toBe('image/jpeg');
			expect(binary.fileName).toBe('test_output.jpg');
			expect(binary.fileExtension).toBe('.jpg');
			expect(binary.fileSize).toBeDefined();
		});

		it('should include base64 encoded data', async () => {
			const processor = new ImageProcessor();
			await processor.loadImage({
				type: 'binary',
				data: testBuffer,
			});

			const binary = await processor.toN8nBinary('output.jpg');

			// Should be valid base64
			expect(() => Buffer.from(binary.data, 'base64')).not.toThrow();
		});
	});

	describe('utility methods', () => {
		describe('getFormatFromFileName', () => {
			it('should detect format from file name', () => {
				expect(ImageProcessor.getFormatFromFileName('image.jpg')).toBe('jpeg');
				expect(ImageProcessor.getFormatFromFileName('image.jpeg')).toBe('jpeg');
				expect(ImageProcessor.getFormatFromFileName('image.png')).toBe('png');
				expect(ImageProcessor.getFormatFromFileName('image.webp')).toBe('webp');
			});

			it('should default to jpeg for unknown format', () => {
				expect(ImageProcessor.getFormatFromFileName('image.unknown')).toBe('jpeg');
			});
		});

		describe('getMimeTypeFromFileName', () => {
			it('should get MIME type from file name', () => {
				expect(ImageProcessor.getMimeTypeFromFileName('image.jpg')).toBe('image/jpeg');
				expect(ImageProcessor.getMimeTypeFromFileName('image.png')).toBe('image/png');
				expect(ImageProcessor.getMimeTypeFromFileName('image.webp')).toBe('image/webp');
			});
		});

		describe('isFormatSupported', () => {
			it('should check if format is supported', () => {
				expect(ImageProcessor.isFormatSupported('jpeg')).toBe(true);
				expect(ImageProcessor.isFormatSupported('png')).toBe(true);
				expect(ImageProcessor.isFormatSupported('bmp')).toBe(false);
			});
		});

		describe('getSupportedFormats', () => {
			it('should return list of supported formats', () => {
				const formats = ImageProcessor.getSupportedFormats();

				expect(formats).toContain('jpeg');
				expect(formats).toContain('png');
				expect(formats).toContain('webp');
			});
		});
	});

	describe('destroy', () => {
		it('should clean up resources', () => {
			const processor = new ImageProcessor();
			processor.destroy();

			expect((processor as any).image).toBeNull();
			expect((processor as any).currentBuffer).toBeNull();
		});
	});

	describe('error handling', () => {
		it('should handle invalid base64 data', async () => {
			const processor = new ImageProcessor();

			await expect(
				processor.loadImage({
					type: 'base64',
					data: 'not-valid-base64!!!',
				})
			).rejects.toThrow();

			processor.destroy();
		});

		it('should handle missing input data', async () => {
			const processor = new ImageProcessor();

			await expect(
				processor.loadImage({
					type: 'binary',
				})
			).rejects.toThrow(MediaGenError);
		});
	});
});

describe('ImageValidators', () => {
	describe('validateImageInput', () => {
		it('should validate correct input', () => {
			const result = validateImageInput({
				type: 'url',
				url: 'https://example.com/image.jpg',
			});

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject invalid input', () => {
			const result = validateImageInput(null);

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should reject invalid URL', () => {
			const result = validateImageInput({
				type: 'url',
				url: 'not-a-valid-url',
			});

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Invalid URL format');
		});

		it('should reject missing data for base64 type', () => {
			const result = validateImageInput({
				type: 'base64',
			});

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Data is required for base64 type');
		});
	});

	describe('validateResizeOptions', () => {
		it('should validate correct resize options', () => {
			const result = validateResizeOptions({
				width: 100,
				height: 100,
				fit: 'cover',
			});

			expect(result.valid).toBe(true);
		});

		it('should reject invalid width', () => {
			const result = validateResizeOptions({
				width: -10,
			});

			expect(result.valid).toBe(false);
		});

		it('should reject invalid fit', () => {
			const result = validateResizeOptions({
				width: 100,
				fit: 'invalid' as any,
			});

			expect(result.valid).toBe(false);
		});
	});

	describe('validateCropOptions', () => {
		it('should validate correct crop options', () => {
			const result = validateCropOptions({
				left: 10,
				top: 10,
				width: 100,
				height: 100,
			});

			expect(result.valid).toBe(true);
		});

		it('should reject negative dimensions', () => {
			const result = validateCropOptions({
				left: -10,
				top: 0,
				width: 100,
				height: 100,
			});

			expect(result.valid).toBe(false);
		});
	});

	describe('validateCompressOptions', () => {
		it('should validate correct compress options', () => {
			const result = validateCompressOptions({
				quality: 85,
				progressive: true,
			});

			expect(result.valid).toBe(true);
		});

		it('should reject quality out of range', () => {
			const result = validateCompressOptions({
				quality: 150,
			});

			expect(result.valid).toBe(false);
		});
	});

	describe('validateConvertOptions', () => {
		it('should validate correct convert options', () => {
			const result = validateConvertOptions({
				format: 'png',
				compressOptions: {
					quality: 90,
				},
			});

			expect(result.valid).toBe(true);
		});

		it('should reject invalid format', () => {
			const result = validateConvertOptions({
				format: 'invalid' as any,
			});

			expect(result.valid).toBe(false);
		});
	});

	describe('assert functions', () => {
		it('should throw error for invalid input', () => {
			expect(() => assertValidImageInput(null)).toThrow(MediaGenError);
		});

		it('should throw error for invalid resize options', () => {
			expect(() => assertValidResizeOptions({ width: -1 })).toThrow(MediaGenError);
		});

		it('should throw error for invalid crop options', () => {
			expect(() => assertValidCropOptions({ left: -1, top: 0, width: 100, height: 100 })).toThrow(
				MediaGenError
			);
		});

		it('should throw error for invalid compress options', () => {
			expect(() => assertValidCompressOptions({ quality: 150 })).toThrow(MediaGenError);
		});

		it('should throw error for invalid convert options', () => {
			expect(() => assertValidConvertOptions({ format: 'invalid' as any })).toThrow(MediaGenError);
		});

		it('should not throw for valid input', () => {
			expect(() =>
				assertValidImageInput({ type: 'url', url: 'https://example.com/image.jpg' })
			).not.toThrow();
		});
	});
});
