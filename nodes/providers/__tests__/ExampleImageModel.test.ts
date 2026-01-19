/**
 * Example Image Model Tests
 */

import { ExampleImageModel } from '../example/models/ExampleImageModel';
import { ExampleProvider } from '../example/ExampleProvider';

describe('ExampleImageModel', () => {
  let model: ExampleImageModel;
  let provider: ExampleProvider;

  beforeEach(() => {
    provider = new ExampleProvider();
    model = new ExampleImageModel(provider);
  });

  describe('initialization', () => {
    test('should have correct properties', () => {
      expect(model.id).toBe('imagegen');
      expect(model.displayName).toBe('Example Image Generator');
      expect(model.type).toBe('image');
      expect(model.provider).toBe('example');
    });

    test('should have correct capabilities', () => {
      expect(model.capabilities.supportsBatch).toBe(true);
      expect(model.capabilities.supportsAsync).toBe(false);
      expect(model.capabilities.maxConcurrentRequests).toBe(3);
    });
  });

  describe('parameter validation', () => {
    test('should validate required parameters', () => {
      const result = model.validateParameters({});
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'prompt')).toBe(true);
    });

    test('should validate parameter ranges', () => {
      const result = model.validateParameters({
        prompt: 'test',
        numberOfImages: 10,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'numberOfImages')).toBe(true);
    });

    test('should pass validation with valid parameters', () => {
      const result = model.validateParameters({
        prompt: 'A beautiful sunset',
        size: '1024x1024',
        numberOfImages: 1,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('get default parameters', () => {
    test('should return default parameters', () => {
      const defaults = model.getDefaultParameters();

      expect(defaults.size).toBe('1024x1024');
      expect(defaults.numberOfImages).toBe(1);
      expect(defaults.quality).toBe('standard');
    });
  });

  describe('execute', () => {
    test('should generate image with valid parameters', async () => {
      const result = await model.execute({
        prompt: 'A beautiful sunset',
        size: '1024x1024',
        numberOfImages: 1,
      });

      expect(result.success).toBe(true);
      expect(result.url).toBeDefined();
      expect(result.mimeType).toBe('image/png');
      expect(result.metadata).toBeDefined();
    }, 10000);

    test('should fail with invalid parameters', async () => {
      await expect(model.execute({
        numberOfImages: 10,
      })).rejects.toThrow();
    });

    test('should include metadata in result', async () => {
      const result = await model.execute({
        prompt: 'test',
        seed: 12345,
      });

      expect(result.metadata).toHaveProperty('model', 'imagegen');
      expect(result.metadata).toHaveProperty('provider', 'example');
      expect(result.metadata).toHaveProperty('seed', 12345);
    });
  });

  describe('cost estimation', () => {
    test('should estimate cost', () => {
      const cost = model.estimateCost?.({
        numberOfImages: 2,
      });

      expect(cost).toBeDefined();
      expect(cost).toBe(0.08); // $0.04 per image * 2
    });
  });
});
