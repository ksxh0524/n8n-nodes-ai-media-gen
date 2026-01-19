/**
 * Validation Helper
 * Parameter and data validation utilities
 */

import { IValidationResult, ParameterType } from '../../types/core.types';

/**
 * Helper class for validation
 */
export class ValidationHelper {
  /**
   * Validate a value against a parameter type
   * @param value - Value to validate
   * @param type - Parameter type
   * @returns True if valid
   */
  static validateType(value: any, type: ParameterType): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';

      case 'number':
        return typeof value === 'number' && !isNaN(value);

      case 'boolean':
        return typeof value === 'boolean';

      case 'options':
      case 'multi-options':
        // Validation handled separately with options list
        return true;

      case 'json':
        return typeof value === 'object' || this.isValidJSON(value);

      case 'collection':
      case 'fixed-collection':
        return Array.isArray(value) || typeof value === 'object';

      default:
        return true;
    }
  }

  /**
   * Check if a string is valid JSON
   */
  static isValidJSON(value: string): boolean {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate required fields
   * @param data - Data to validate
   * @param requiredFields - Array of required field names
   * @returns Validation result
   */
  static validateRequired(
    data: Record<string, any>,
    requiredFields: string[]
  ): IValidationResult {
    const errors: Array<{ field: string; message: string }> = [];

    for (const field of requiredFields) {
      const value = data[field];
      if (value === undefined || value === null || value === '') {
        errors.push({
          field,
          message: `${field} is required`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate URL format
   * @param url - URL to validate
   * @returns True if valid URL
   */
  static isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate email format
   * @param email - Email to validate
   * @returns True if valid email
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate that a number is within range
   * @param value - Value to validate
   * @param min - Minimum value (optional)
   * @param max - Maximum value (optional)
   * @returns True if valid
   */
  static isInRange(value: number, min?: number, max?: number): boolean {
    if (min !== undefined && value < min) {
      return false;
    }
    if (max !== undefined && value > max) {
      return false;
    }
    return true;
  }

  /**
   * Validate that a string matches a pattern
   * @param value - Value to validate
   * @param pattern - Regex pattern
   * @returns True if matches
   */
  static matchesPattern(value: string, pattern: RegExp): boolean {
    return pattern.test(value);
  }

  /**
   * Validate file size
   * @param size - Size in bytes
   * @param maxSize - Maximum size in bytes
   * @returns True if within limit
   */
  static validateFileSize(size: number, maxSize: number): boolean {
    return size <= maxSize;
  }

  /**
   * Sanitize a string input
   * @param input - Input to sanitize
   * @param maxLength - Maximum length
   * @returns Sanitized string
   */
  static sanitizeString(input: string, maxLength?: number): string {
    let sanitized = input.trim();

    if (maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  /**
   * Validate and sanitize parameters
   * @param params - Parameters to validate
   * @param schema - Parameter schema
   * @returns Validation result with sanitized data
   */
  static validateAndSanitize(
    params: Record<string, any>,
    schema: Array<{
      name: string;
      type: ParameterType;
      required?: boolean;
      min?: number;
      max?: number;
      sanitize?: boolean;
    }>
  ): { valid: boolean; errors: Array<{ field: string; message: string }>; sanitized: Record<string, any> } {
    const errors: Array<{ field: string; message: string }> = [];
    const sanitized: Record<string, any> = {};

    for (const field of schema) {
      const value = params[field.name];

      // Check required
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: field.name,
          message: `${field.name} is required`,
        });
        continue;
      }

      // Skip sanitization if not provided
      if (value === undefined || value === null) {
        continue;
      }

      // Validate type
      if (!this.validateType(value, field.type)) {
        errors.push({
          field: field.name,
          message: `${field.name} must be of type ${field.type}`,
        });
        continue;
      }

      // Validate range for numbers
      if (field.type === 'number' && !this.isInRange(value, field.min, field.max)) {
        const minMsg = field.min !== undefined ? `at least ${field.min}` : '';
        const maxMsg = field.max !== undefined ? `at most ${field.max}` : '';
        errors.push({
          field: field.name,
          message: `${field.name} must be ${minMsg} ${maxMsg}`.trim(),
        });
        continue;
      }

      // Sanitize if requested
      if (field.sanitize && field.type === 'string') {
        sanitized[field.name] = this.sanitizeString(value, field.max);
      } else {
        sanitized[field.name] = value;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized,
    };
  }
}
