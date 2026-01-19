/**
 * Validation Helper Tests
 */

import { ValidationHelper } from '../utils/ValidationHelper';

describe('ValidationHelper', () => {
  describe('validateType', () => {
    test('should validate strings', () => {
      expect(ValidationHelper.validateType('hello', 'string')).toBe(true);
      expect(ValidationHelper.validateType(123, 'string')).toBe(false);
    });

    test('should validate numbers', () => {
      expect(ValidationHelper.validateType(123, 'number')).toBe(true);
      expect(ValidationHelper.validateType('123', 'number')).toBe(false);
      expect(ValidationHelper.validateType(NaN, 'number')).toBe(false);
    });

    test('should validate booleans', () => {
      expect(ValidationHelper.validateType(true, 'boolean')).toBe(true);
      expect(ValidationHelper.validateType(false, 'boolean')).toBe(true);
      expect(ValidationHelper.validateType('true', 'boolean')).toBe(false);
    });

    test('should validate arrays', () => {
      expect(ValidationHelper.validateType([1, 2, 3], 'collection')).toBe(true);
      expect(ValidationHelper.validateType({ a: 1 }, 'collection')).toBe(true);
    });

    test('should validate objects', () => {
      expect(ValidationHelper.validateType({ a: 1 }, 'json')).toBe(true);
      expect(ValidationHelper.validateType('{"a":1}', 'json')).toBe(true);
      expect(ValidationHelper.validateType('invalid', 'json')).toBe(false);
    });
  });

  describe('isInRange', () => {
    test('should check if number is in range', () => {
      expect(ValidationHelper.isInRange(5, 0, 10)).toBe(true);
      expect(ValidationHelper.isInRange(0, 0, 10)).toBe(true);
      expect(ValidationHelper.isInRange(10, 0, 10)).toBe(true);
      expect(ValidationHelper.isInRange(-1, 0, 10)).toBe(false);
      expect(ValidationHelper.isInRange(11, 0, 10)).toBe(false);
    });

    test('should work with only min constraint', () => {
      expect(ValidationHelper.isInRange(5, 0, undefined)).toBe(true);
      expect(ValidationHelper.isInRange(-1, 0, undefined)).toBe(false);
    });

    test('should work with only max constraint', () => {
      expect(ValidationHelper.isInRange(5, undefined, 10)).toBe(true);
      expect(ValidationHelper.isInRange(11, undefined, 10)).toBe(false);
    });
  });

  describe('isValidURL', () => {
    test('should validate URLs', () => {
      expect(ValidationHelper.isValidURL('https://example.com')).toBe(true);
      expect(ValidationHelper.isValidURL('http://example.com')).toBe(true);
      expect(ValidationHelper.isValidURL('ftp://example.com')).toBe(true);
      expect(ValidationHelper.isValidURL('not-a-url')).toBe(false);
      expect(ValidationHelper.isValidURL('')).toBe(false);
    });
  });

  describe('validateRequired', () => {
    test('should validate required fields', () => {
      const data = {
        name: 'Test',
        value: 123,
      };

      const result = ValidationHelper.validateRequired(data, ['name', 'value']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail on missing required fields', () => {
      const data = {
        name: 'Test',
      };

      const result = ValidationHelper.validateRequired(data, ['name', 'value']);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('value');
    });

    test('should fail on empty string', () => {
      const data = {
        name: '',
      };

      const result = ValidationHelper.validateRequired(data, ['name']);
      expect(result.valid).toBe(false);
    });

    test('should fail on null or undefined', () => {
      const data1 = {
        name: null,
      };

      const result1 = ValidationHelper.validateRequired(data1, ['name']);
      expect(result1.valid).toBe(false);

      const data2 = {
        name: undefined,
      };

      const result2 = ValidationHelper.validateRequired(data2, ['name']);
      expect(result2.valid).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    test('should trim whitespace', () => {
      expect(ValidationHelper.sanitizeString('  hello  ')).toBe('hello');
    });

    test('should limit length', () => {
      const result = ValidationHelper.sanitizeString('hello world', 5);
      expect(result).toBe('hello');
    });

    test('should not modify valid string', () => {
      expect(ValidationHelper.sanitizeString('hello world')).toBe('hello world');
    });
  });

  describe('validateAndSanitize', () => {
    test('should validate and sanitize parameters', () => {
      const schema = [
        {
          name: 'name',
          type: 'string',
          required: true,
          sanitize: true,
        },
        {
          name: 'age',
          type: 'number',
          min: 0,
          max: 150,
        },
      ];

      const params = {
        name: '  John  ',
        age: 25,
      };

      const result = ValidationHelper.validateAndSanitize(params, schema);

      expect(result.valid).toBe(true);
      expect(result.sanitized.name).toBe('John');
      expect(result.sanitized.age).toBe(25);
    });

    test('should sanitize strings with max length', () => {
      const schema = [
        {
          name: 'text',
          type: 'string',
          required: true,
          sanitize: true,
          max: 5,
        },
      ];

      const params = {
        text: 'hello world',
      };

      const result = ValidationHelper.validateAndSanitize(params, schema);

      expect(result.valid).toBe(true);
      expect(result.sanitized.text).toBe('hello');
    });

    test('should fail validation', () => {
      const schema = [
        {
          name: 'age',
          type: 'number',
          min: 0,
          max: 150,
        },
      ];

      const params = {
        age: 200,
      };

      const result = ValidationHelper.validateAndSanitize(params, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('age');
    });
  });
});
