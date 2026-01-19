import { detectMediaType } from '../utils/helpers';

describe('detectMediaType', () => {
	test('should detect video models', () => {
		expect(detectMediaType('sora')).toBe('video');
		expect(detectMediaType('video-gen')).toBe('video');
		expect(detectMediaType('svd-xt')).toBe('video');
		expect(detectMediaType('cogvideox')).toBe('video');
		expect(detectMediaType('wanx-video-v1')).toBe('video');
	});

	test('should detect audio models', () => {
		expect(detectMediaType('tts-1')).toBe('audio');
		expect(detectMediaType('audio-gen')).toBe('audio');
		expect(detectMediaType('speech-api')).toBe('audio');
		expect(detectMediaType('voice-synthesis')).toBe('audio');
		expect(detectMediaType('sambert-v1')).toBe('audio');
		expect(detectMediaType('cosyvoice-v1')).toBe('audio');
	});

	test('should detect image models', () => {
		expect(detectMediaType('dall-e-3')).toBe('image');
		expect(detectMediaType('imagen-2.0')).toBe('image');
		expect(detectMediaType('wanx-v1')).toBe('image');
		expect(detectMediaType('flux-schnell')).toBe('image');
		expect(detectMediaType('stable-diffusion')).toBe('image');
	});

	test('should be case insensitive', () => {
		expect(detectMediaType('SORA')).toBe('video');
		expect(detectMediaType('TTS-1')).toBe('audio');
		expect(detectMediaType('DALL-E-3')).toBe('image');
	});

	test('should default to image for unknown models', () => {
		expect(detectMediaType('unknown-model')).toBe('image');
		expect(detectMediaType('custom-ai')).toBe('image');
	});
});
