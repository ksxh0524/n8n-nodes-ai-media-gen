/**
 * Model interface
 * All AI models must implement this interface
 */

import {
  IGenerationParameters,
  IGenerationResult,
  IModelConfig,
  IModelCapabilities,
  IParameter,
  IValidationResult,
  MediaType,
} from '../../types/core.types';

/**
 * Model interface for AI generation models
 */
export interface IModel {
  /**
   * Unique model identifier
   */
  readonly id: string;

  /**
   * Human-readable display name
   */
  readonly displayName: string;

  /**
   * Media type this model generates
   */
  readonly type: MediaType;

  /**
   * Provider that hosts this model
   */
  readonly provider: string;

  /**
   * Model configuration
   */
  readonly config: IModelConfig;

  /**
   * Model capabilities
   */
  readonly capabilities: IModelCapabilities;

  /**
   * Parameters accepted by this model
   */
  readonly parameters: IParameter[];

  /**
   * Execute generation with the provided parameters
   * @param params - Generation parameters
   * @returns Generation result
   */
  execute(params: IGenerationParameters): Promise<IGenerationResult>;

  /**
   * Validate parameters before execution
   * @param params - Parameters to validate
   * @returns Validation result with any errors
   */
  validateParameters(params: IGenerationParameters): IValidationResult;

  /**
   * Get default parameters for this model
   * @returns Object with default parameter values
   */
  getDefaultParameters(): IGenerationParameters;

  /**
   * Check if the model supports a specific feature
   * @param feature - Feature to check
   * @returns True if feature is supported
   */
  supportsFeature(feature: string): boolean;

  /**
   * Estimate cost for a generation request
   * @param params - Generation parameters
   * @returns Estimated cost in USD or undefined if not available
   */
  estimateCost?(params: IGenerationParameters): number | undefined;

  /**
   * Get parameter schema for dynamic form generation
   * @returns Array of parameter definitions
   */
  getParameterSchema(): IParameter[];

  /**
   * Sanitize parameters before sending to API
   * @param params - Raw parameters
   * @returns Sanitized parameters
   */
  sanitizeParameters?(params: IGenerationParameters): IGenerationParameters;
}
