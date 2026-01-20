import { getDefaultBaseUrl, getEndpoint, getHeaders, buildRequestBody } from '../utils/helpers';

describe('Helper Functions', () => {
	describe('getDefaultBaseUrl', () => {
		test('should return correct base URLs', () => {
			expect(getDefaultBaseUrl('openai')).toBe('https://api.openai.com/v1');
			expect(getDefaultBaseUrl('gemini')).toBe('https://generativelanguage.googleapis.com/v1beta');
			expect(getDefaultBaseUrl('bailian')).toBe('https://dashscope.aliyuncs.com/api/v1');
		});

		test('should return empty string for unknown format', () => {
			expect(getDefaultBaseUrl('replicate')).toBe('https://api.replicate.com/v1');
			expect(getDefaultBaseUrl('huggingface')).toBe('https://api-inference.huggingface.co/models');
		});
	});

	describe('getEndpoint', () => {
		test('should return correct OpenAI endpoints', () => {
			expect(getEndpoint('openai', 'image', 'dall-e-3')).toBe('/images/generations');
			expect(getEndpoint('openai', 'audio', 'tts-1')).toBe('/audio/speech');
			expect(getEndpoint('openai', 'video', 'sora')).toBe('/videos/generations');
		});

		test('should return correct Gemini endpoints', () => {
			expect(getEndpoint('gemini', 'image', 'imagen-2.0')).toBe('/models/imagen-2.0:predictImage?');
			expect(getEndpoint('gemini', 'image', 'imagen-2.0', 'test-key')).toBe('/models/imagen-2.0:predictImage?key=test-key');
		});

		test('should return correct Bailian endpoints', () => {
			expect(getEndpoint('bailian', 'image', 'wanx-v1')).toBe('/services/aigc/text2image/image-synthesis');
			expect(getEndpoint('bailian', 'audio', 'sambert-v1')).toBe('/services/aigc/text2speech/synthesis');
			expect(getEndpoint('bailian', 'video', 'wanx-video-v1')).toBe('/services/aigc/text2video/video-synthesis');
		});
	});

	describe('getHeaders', () => {
		test('should return OpenAI headers', () => {
			const headers = getHeaders('openai', 'test-key');
			expect(headers).toEqual({
				'Content-Type': 'application/json',
				'Authorization': 'Bearer test-key',
			});
		});

		test('should return Bailian headers', () => {
			const headers = getHeaders('bailian', 'test-key');
			expect(headers).toEqual({
				'Content-Type': 'application/json',
				'Authorization': 'Bearer test-key',
			});
		});

		test('should return Gemini headers (no auth)', () => {
			const headers = getHeaders('gemini', 'test-key');
			expect(headers).toEqual({
				'Content-Type': 'application/json',
			});
		});
	});

	describe('buildRequestBody', () => {
		test('should build OpenAI image request', () => {
			const body = buildRequestBody('openai', 'image', 'dall-e-3', 'A sunset', { size: '1024x1024' });
			expect(body).toEqual({
				model: 'dall-e-3',
				prompt: 'A sunset',
				size: '1024x1024',
			});
		});

		test('should build OpenAI audio request', () => {
			const body = buildRequestBody('openai', 'audio', 'tts-1', 'Hello world', { voice: 'alloy' });
			expect(body).toEqual({
				model: 'tts-1',
				input: 'Hello world',
				voice: 'alloy',
			});
		});

		test('should build Gemini request', () => {
			const body = buildRequestBody('gemini', 'image', 'imagen-2.0', 'A cat', { aspectRatio: '1:1' });
			expect(body).toEqual({
				prompt: { text: 'A cat' },
				aspectRatio: '1:1',
			});
		});

		test('should build Bailian image request', () => {
			const body = buildRequestBody('bailian', 'image', 'wanx-v1', 'A mountain', { n: 1 });
			expect(body).toEqual({
				model: 'wanx-v1',
				input: { prompt: 'A mountain' },
				parameters: { n: 1 },
			});
		});
	});
});
