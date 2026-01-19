/**
 * Core type definitions for the AI Media Generation framework
 */

/**
 * Supported media types
 */
export type MediaType = 'image' | 'video' | 'audio';

/**
 * Provider types
 */
export type ProviderType = 'commercial' | 'open-source' | 'self-hosted';

/**
 * Model types
 */
export type ModelType = MediaType;

/**
 * Parameter data types
 */
export type ParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'options'
  | 'multi-options'
  | 'json'
  | 'collection'
  | 'fixed-collection';

/**
 * Provider configuration
 */
export interface IProviderConfig {
  name: string;
  displayName: string;
  type: ProviderType;
  baseUrl: string;
  credentialsType: string;
  rateLimits?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
}

/**
 * Model configuration
 */
export interface IModelConfig {
  id: string;
  displayName: string;
  type: ModelType;
  provider: string;
  capabilities: ModelCapabilities;
}

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  supportsBatch: boolean;
  supportsAsync: boolean;
  maxConcurrentRequests?: number;
  supportedFormats?: string[];
  maxResolution?: string;
  maxDuration?: number; // For video/audio in seconds
  maxSizeBytes?: number;
}

/**
 * Parameter definition
 */
export interface IParameter {
  name: string;
  displayName: string;
  type: ParameterType;
  description?: string;
  required?: boolean;
  default?: any;
  options?: Array<{
    name: string;
    value: any;
    description?: string;
  }>;
  min?: number;
  max?: number;
  step?: number;
  validation?: (value: any) => boolean | string;
  placeholder?: string;
  hint?: string;
  typeOptions?: any;
}

/**
 * Credentials interface
 */
export interface ICredentials {
  apiKey?: string;
  organizationId?: string;
  [key: string]: any;
}

/**
 * HTTP Request options
 */
export interface IRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, any>;
  timeout?: number;
  responseType?: 'json' | 'text' | 'stream';
}

/**
 * Request response
 */
export interface IRequestResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

/**
 * Generation parameters
 */
export interface IGenerationParameters {
  [key: string]: any;
}

/**
 * Generation result
 */
export interface IGenerationResult {
  success: boolean;
  url?: string;
  data?: Buffer;
  mimeType?: string;
  metadata?: Record<string, any>;
  error?: string;
  cached?: boolean;
  taskId?: string; // For async operations
}

/**
 * Batch generation result
 */
export interface IBatchResult<T> {
  success: boolean;
  results: T[];
  errors: Array<{
    item: any;
    error: string;
  }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

/**
 * Validation result
 */
export interface IValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Task status for async operations
 */
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Async task information
 */
export interface IAsyncTask {
  id: string;
  status: TaskStatus;
  progress?: number;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  estimatedCompletionTime?: Date;
}

/**
 * Polling strategy configuration
 */
export interface IPollingConfig {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
}

/**
 * Batch processing options
 */
export interface IBatchOptions {
  concurrency?: number;
  delayMs?: number;
  maxRetries?: number;
  continueOnError?: boolean;
}

/**
 * Cache configuration
 */
export interface ICacheConfig {
  enabled: boolean;
  ttl?: number; // Time to live in seconds
  maxSize?: number; // Maximum number of entries
  strategy?: 'lru' | 'fifo' | 'lfu';
}

/**
 * Retry configuration
 */
export interface IRetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
  retryableErrors?: string[];
}

/**
 * Node execution context
 */
export interface INodeContext {
  node: any;
  items: any[];
  credentials: ICredentials;
  parameters: IGenerationParameters;
}
