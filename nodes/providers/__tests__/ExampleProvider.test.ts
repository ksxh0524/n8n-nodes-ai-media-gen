/**
 * Example Provider Tests
 */

import { ExampleProvider } from '../example/ExampleProvider';
import { ExampleImageModel } from '../example/models/ExampleImageModel';

describe('ExampleProvider', () => {
  let provider: ExampleProvider;

  beforeEach(() => {
    provider = new ExampleProvider();
  });

  describe('initialization', () => {
    test('should create provider with correct properties', () => {
      expect(provider.name).toBe('example');
      expect(provider.displayName).toBe('Example Provider');
    });

    test('should register models', () => {
      const models = provider.getAvailableModels();
      expect(models).toHaveLength(1);
      expect(models[0]).toBeInstanceOf(ExampleImageModel);
    });
  });

  describe('authentication', () => {
    test('should fail without API key', async () => {
      await expect(provider.authenticate({ apiKey: '' }))
        .rejects.toThrow('API key is required');
    });

    test('should succeed with valid API key', async () => {
      // Mock implementation will pass any non-empty API key
      await expect(provider.authenticate({ apiKey: 'test-key' }))
        .resolves.not.toThrow();
    });
  });

  describe('model retrieval', () => {
    test('should get model by ID', () => {
      const model = provider.getModel('imagegen');
      expect(model).toBeDefined();
      expect(model?.id).toBe('imagegen');
    });

    test('should return undefined for non-existent model', () => {
      const model = provider.getModel('non-existent');
      expect(model).toBeUndefined();
    });

    test('should check if model exists', () => {
      expect(provider.hasModel('imagegen')).toBe(true);
      expect(provider.hasModel('non-existent')).toBe(false);
    });
  });

  describe('health check', () => {
    test('should return true when authenticated', async () => {
      await provider.authenticate({ apiKey: 'test-key' });
      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });

    test('should return false when not authenticated', async () => {
      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });
});
