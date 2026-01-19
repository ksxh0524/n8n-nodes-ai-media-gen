/**
 * Base Model class
 * Provides common functionality for all models
 */

import { IModel } from '../interfaces/IModel';
import { IProvider } from '../interfaces/IProvider';
import {
  IGenerationParameters,
  IGenerationResult,
  IModelConfig,
  IModelCapabilities,
  IParameter,
  IValidationResult,
  MediaType,
} from '../../types/core.types';
import { ValidationHelper } from '../utils/ValidationHelper';
import { MediaGenError } from '../../errors/MediaGenError';

/**
 * Abstract base class for all models
 */
export abstract class BaseModel implements IModel {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly type: MediaType;
  readonly provider: string;
  abstract readonly capabilities: IModelCapabilities;
  abstract readonly parameters: IParameter[];

  protected config: IModelConfig;
  protected providerInstance: IProvider;

  constructor(provider: IProvider, config?: Partial<IModelConfig>) {
    this.providerInstance = provider;
    this.provider = provider.name;
    this.config = {
      id: this.id,
      displayName: this.displayName,
      type: this.type,
      provider: provider.name,
      capabilities: this.capabilities,
      ...config,
    };
  }

  /**
   * Execute generation - must be implemented by subclass
   */
  abstract execute(params: IGenerationParameters): Promise<IGenerationResult>;

  /**
   * Validate parameters
   */
  validateParameters(params: IGenerationParameters): IValidationResult {
    const errors: Array<{ field: string; message: string }> = [];

    for (const param of this.parameters) {
      const value = params[param.name];

      // Check required parameters
      if (param.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: param.name,
          message: `${param.displayName} is required`,
        });
        continue;
      }

      // Skip validation if value is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!ValidationHelper.validateType(value, param.type)) {
        errors.push({
          field: param.name,
          message: `${param.displayName} must be of type ${param.type}`,
        });
        continue;
      }

      // Range validation for numbers
      if (param.type === 'number') {
        if (param.min !== undefined && value < param.min) {
          errors.push({
            field: param.name,
            message: `${param.displayName} must be at least ${param.min}`,
          });
        }
        if (param.max !== undefined && value > param.max) {
          errors.push({
            field: param.name,
            message: `${param.displayName} must be at most ${param.max}`,
          });
        }
      }

      // Options validation
      if (param.options && param.options.length > 0) {
        const validValues = param.options.map((opt) => opt.value);
        if (!validValues.includes(value)) {
          errors.push({
            field: param.name,
            message: `${param.displayName} must be one of: ${validValues.join(', ')}`,
          });
        }
      }

      // Custom validation
      if (param.validation) {
        const validationResult = param.validation(value);
        if (validationResult !== true) {
          errors.push({
            field: param.name,
            message: typeof validationResult === 'string' ? validationResult : 'Validation failed',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get default parameters
   */
  getDefaultParameters(): IGenerationParameters {
    const defaults: IGenerationParameters = {};
    for (const param of this.parameters) {
      if (param.default !== undefined) {
        defaults[param.name] = param.default;
      }
    }
    return defaults;
  }

  /**
   * Check if model supports a feature
   */
  supportsFeature(feature: string): boolean {
    const capabilityMap: Record<string, keyof IModelCapabilities> = {
      batch: 'supportsBatch',
      async: 'supportsAsync',
    };

    const capabilityKey = capabilityMap[feature];
    if (capabilityKey) {
      return this.capabilities[capabilityKey] === true;
    }

    return false;
  }

  /**
   * Get parameter schema
   */
  getParameterSchema(): IParameter[] {
    return this.parameters;
  }

  /**
   * Sanitize parameters before API call
   * Override in subclass for custom sanitization
   */
  sanitizeParameters?(params: IGenerationParameters): IGenerationParameters {
    // Remove undefined values
    const sanitized: IGenerationParameters = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Get provider instance
   */
  protected getProvider(): IProvider {
    return this.providerInstance;
  }

  /**
   * Build error message with context
   */
  protected buildError(message: string, context?: Record<string, any>): Error {
    return new MediaGenError(
      `${this.displayName}: ${message}`,
      'model_error',
      {
        model: this.id,
        provider: this.provider,
        ...context,
      }
    );
  }
}
