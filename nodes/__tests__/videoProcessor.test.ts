/**
 * Unit tests for VideoProcessor
 */

import { VideoProcessor } from '../utils/videoProcessor';
import { MediaGenError } from '../utils/errors';

describe('VideoProcessor', () => {
	describe('constructor', () => {
		it('should create VideoProcessor with default options', () => {
			const processor = new VideoProcessor();
			expect(processor).toBeDefined();
		});

		it('should create VideoProcessor with custom options', () => {
			const processor = new VideoProcessor({ maxFileSize: 10000000 });
			expect(processor).toBeDefined();
		});
	});

	describe('loadVideo', () => {
		it('should load video from buffer', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');

			await processor.loadVideo({
				type: 'binary',
				data: testBuffer,
				fileName: 'test.mp4',
			});

			expect((processor as any).currentBuffer).toBe(testBuffer);
		});

		it('should load video from base64', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');
			const base64 = testBuffer.toString('base64');

			await processor.loadVideo({
				type: 'base64',
				data: base64,
			});

			expect((processor as any).currentBuffer).toBeDefined();
		});

		it('should load video from data URL', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');
			const dataUrl = `data:video/mp4;base64,${testBuffer.toString('base64')}`;

			await processor.loadVideo({
				type: 'base64',
				data: dataUrl,
			});

			expect((processor as any).currentBuffer).toBeDefined();
		});

		it('should throw error if no data provided', async () => {
			const processor = new VideoProcessor();

			await expect(
				processor.loadVideo({
					type: 'binary',
				} as any)
			).rejects.toThrow(MediaGenError);
		});

		it('should throw error for invalid base64', async () => {
			const processor = new VideoProcessor();

			await expect(
				processor.loadVideo({
					type: 'base64',
					data: 'not-valid-base64!!!',
				})
			).rejects.toThrow();
		});

		it('should throw error if file size exceeds max', async () => {
			const processor = new VideoProcessor({ maxFileSize: 100 });
			const testBuffer = Buffer.alloc(200, 'test');

			await expect(
				processor.loadVideo({
					type: 'binary',
					data: testBuffer,
				})
			).rejects.toThrow(MediaGenError);
		});
	});

	describe('getMetadata', () => {
		it('should return metadata for loaded video', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');

			await processor.loadVideo({
				type: 'binary',
				data: testBuffer,
				fileName: 'test.mp4',
			});

			const metadata = await processor.getMetadata();

			expect(metadata).toBeDefined();
			expect(metadata.format).toBe('mp4');
			expect(metadata.size).toBeGreaterThan(0);
		});

		it('should throw error if no video loaded', async () => {
			const processor = new VideoProcessor();

			await expect(processor.getMetadata()).rejects.toThrow('No video loaded');
		});
	});

	describe('transcode', () => {
		it('should transcode video to different format', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');

			await processor.loadVideo({
				type: 'binary',
				data: testBuffer,
				fileName: 'test.mp4',
			});

			await processor.transcode({
				outputFormat: 'webm',
			});

			expect((processor as any).currentBuffer).toBeDefined();
		});

		it('should transcode with custom codec', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');

			await processor.loadVideo({
				type: 'binary',
				data: testBuffer,
				fileName: 'test.mp4',
			});

			await processor.transcode({
				outputFormat: 'mp4',
				videoCodec: 'libx264',
			});

			expect((processor as any).currentBuffer).toBeDefined();
		});

		it('should throw error if no video loaded', async () => {
			const processor = new VideoProcessor();

			await expect(
				processor.transcode({
					outputFormat: 'webm',
				})
			).rejects.toThrow('No video loaded');
		});
	});

	describe('trim', () => {
		it('should trim video to specified duration', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');

			await processor.loadVideo({
				type: 'binary',
				data: testBuffer,
				fileName: 'test.mp4',
			});

			await processor.trim({
				startTime: 0,
				duration: 10,
			});

			expect((processor as any).currentBuffer).toBeDefined();
		});

		it('should trim video with start and end time', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');

			await processor.loadVideo({
				type: 'binary',
				data: testBuffer,
				fileName: 'test.mp4',
			});

			await processor.trim({
				startTime: 5,
				endTime: 15,
			});

			expect((processor as any).currentBuffer).toBeDefined();
		});

		it('should throw error if no video loaded', async () => {
			const processor = new VideoProcessor();

			await expect(
				processor.trim({
					startTime: 0,
					duration: 10,
				})
			).rejects.toThrow('No video loaded');
		});
	});

	describe('merge', () => {
		it('should merge multiple videos', async () => {
			const processor = new VideoProcessor();
			const testBuffer1 = Buffer.from('test video data 1');
			const testBuffer2 = Buffer.from('test video data 2');

			await processor.loadVideo({
				type: 'binary',
				data: testBuffer1,
				fileName: 'test1.mp4',
			});

			await processor.merge({
				videos: [
					{ type: 'binary', data: testBuffer1, fileName: 'test1.mp4' },
					{ type: 'binary', data: testBuffer2, fileName: 'test2.mp4' },
				],
			});

			expect((processor as any).currentBuffer).toBeDefined();
		});

		it('should throw error if no video loaded', async () => {
			const processor = new VideoProcessor();

			await expect(
				processor.merge({
					videos: [],
				})
			).rejects.toThrow('No video loaded');
		});
	});

	describe('extractFrames', () => {
		it('should extract frames from video', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');

			await processor.loadVideo({
				type: 'binary',
				data: testBuffer,
				fileName: 'test.mp4',
			});

			const frames = await processor.extractFrames({
				frameRate: 1,
				count: 5,
			});

			expect(frames).toBeDefined();
			expect(Array.isArray(frames)).toBe(true);
		});

		it('should throw error if no video loaded', async () => {
			const processor = new VideoProcessor();

			await expect(
				processor.extractFrames({
					frameRate: 1,
					count: 5,
				})
			).rejects.toThrow('No video loaded');
		});
	});

	describe('addAudio', () => {
		it('should add audio track to video', async () => {
			const processor = new VideoProcessor();
			const testVideoBuffer = Buffer.from('test video data');
			const testAudioBuffer = Buffer.from('test audio data');

			await processor.loadVideo({
				type: 'binary',
				data: testVideoBuffer,
				fileName: 'test.mp4',
			});

			await processor.addAudio({
				audio: {
					type: 'binary',
					data: testAudioBuffer,
					fileName: 'test.mp3',
				},
			});

			expect((processor as any).currentBuffer).toBeDefined();
		});

		it('should throw error if no video loaded', async () => {
			const processor = new VideoProcessor();

			await expect(
				processor.addAudio({
					audio: {
						type: 'binary',
						data: Buffer.from('test'),
						fileName: 'test.mp3',
					},
				})
			).rejects.toThrow('No video loaded');
		});
	});

	describe('extractAudio', () => {
		it('should extract audio from video', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');

			await processor.loadVideo({
				type: 'binary',
				data: testBuffer,
				fileName: 'test.mp4',
			});

			const audio = await processor.extractAudio();

			expect(audio).toBeDefined();
			expect(audio.length).toBeGreaterThan(0);
		});

		it('should throw error if no video loaded', async () => {
			const processor = new VideoProcessor();

			await expect(processor.extractAudio()).rejects.toThrow('No video loaded');
		});
	});

	describe('resize', () => {
		it('should resize video to specified dimensions', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');

			await processor.loadVideo({
				type: 'binary',
				data: testBuffer,
				fileName: 'test.mp4',
			});

			await processor.resize({
				width: 640,
				height: 480,
			});

			expect((processor as any).currentBuffer).toBeDefined();
		});

		it('should throw error if no video loaded', async () => {
			const processor = new VideoProcessor();

			await expect(
				processor.resize({
					width: 640,
					height: 480,
				})
			).rejects.toThrow('No video loaded');
		});
	});

	describe('toBuffer', () => {
		it('should return video buffer', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');

			await processor.loadVideo({
				type: 'binary',
				data: testBuffer,
				fileName: 'test.mp4',
			});

			const buffer = await processor.toBuffer();

			expect(buffer).toBeDefined();
			expect(buffer.length).toBeGreaterThan(0);
		});

		it('should throw error if no video loaded', async () => {
			const processor = new VideoProcessor();

			await expect(processor.toBuffer()).rejects.toThrow('No video loaded');
		});
	});

	describe('toN8nBinary', () => {
		it('should output n8n binary format', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');

			await processor.loadVideo({
				type: 'binary',
				data: testBuffer,
				fileName: 'test.mp4',
			});

			const binary = await processor.toN8nBinary('test_output.mp4');

			expect(binary.data).toBeDefined();
			expect(binary.mimeType).toBe('video/mp4');
			expect(binary.fileName).toBe('test_output.mp4');
			expect(binary.fileExtension).toBe('.mp4');
			expect(binary.fileSize).toBeDefined();
		});

		it('should include base64 encoded data', async () => {
			const processor = new VideoProcessor();
			const testBuffer = Buffer.from('test video data');

			await processor.loadVideo({
				type: 'binary',
				data: testBuffer,
				fileName: 'test.mp4',
			});

			const binary = await processor.toN8nBinary('output.mp4');

			expect(() => Buffer.from(binary.data, 'base64')).not.toThrow();
		});
	});

	describe('destroy', () => {
		it('should clean up resources', () => {
			const processor = new VideoProcessor();
			processor.destroy();

			expect((processor as any).currentBuffer).toBeNull();
		});
	});

	describe('utility methods', () => {
		describe('getFormatFromFileName', () => {
			it('should detect format from file name', () => {
				expect(VideoProcessor.getFormatFromFileName('video.mp4')).toBe('mp4');
				expect(VideoProcessor.getFormatFromFileName('video.webm')).toBe('webm');
				expect(VideoProcessor.getFormatFromFileName('video.mov')).toBe('mov');
			});

			it('should default to mp4 for unknown format', () => {
				expect(VideoProcessor.getFormatFromFileName('video.unknown')).toBe('mp4');
			});
		});

		describe('getMimeTypeFromFileName', () => {
			it('should get MIME type from file name', () => {
				expect(VideoProcessor.getMimeTypeFromFileName('video.mp4')).toBe('video/mp4');
				expect(VideoProcessor.getMimeTypeFromFileName('video.webm')).toBe('video/webm');
				expect(VideoProcessor.getMimeTypeFromFileName('video.mov')).toBe('video/quicktime');
			});
		});

		describe('isFormatSupported', () => {
			it('should check if format is supported', () => {
				expect(VideoProcessor.isFormatSupported('mp4')).toBe(true);
				expect(VideoProcessor.isFormatSupported('webm')).toBe(true);
				expect(VideoProcessor.isFormatSupported('avi')).toBe(false);
			});
		});

		describe('getSupportedFormats', () => {
			it('should return list of supported formats', () => {
				const formats = VideoProcessor.getSupportedFormats();

				expect(formats).toContain('mp4');
				expect(formats).toContain('webm');
				expect(formats).toContain('mov');
			});
		});
	});
});
