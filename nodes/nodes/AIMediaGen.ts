/**
 * AI Media Generation Node
 * Main n8n node for AI media generation
 */

import {
  INodeType,
  INodeTypeDescription,
  INodeExecutionData,
  IExecuteFunctions,
  ICredentialDataFunctions,
} from 'n8n-workflow';

import { ProviderFactory } from '../core/factories/ProviderFactory';
import { ModelFactory } from '../core/factories/ModelFactory';
import { CacheManager, CacheKeyGenerator } from '../core/cache/CacheManager';
import { BatchProcessor } from '../core/batch/BatchProcessor';
import { AsyncTaskManager } from '../core/async/AsyncTaskManager';
import { ErrorHandler } from '../errors/ErrorHandler';
import { MediaGenError } from '../errors/MediaGenError';
import { MediaType, IGenerationParameters } from '../types/core.types';

/**
 * AI Media Generation Node
 * Universal node for generating images, videos, and audio
 */
export class AIMediaGen implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'AI Media Generation',
    name: 'aiMediaGen',
    icon: 'file:icon.svg',
    group: ['ai'],
    version: 1,
    description: 'Generate images, videos, and audio using various AI models',
    defaults: {
      name: 'AI Media Gen',
    },
    inputs: ['main'],
    outputs: ['main'],
    usableAsTool: true, // Can be used by AI Agent
    credentials: [
      // Credentials are dynamically loaded based on provider
    ],
    properties: [
      {
        displayName: 'Media Type',
        name: 'mediaType',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Image',
            value: 'image',
            description: 'Generate images using AI models',
            action: 'Generate images',
          },
          {
            name: 'Video',
            value: 'video',
            description: 'Generate videos using AI models',
            action: 'Generate videos',
          },
          {
            name: 'Audio',
            value: 'audio',
            description: 'Generate audio using AI models',
            action: 'Generate audio',
          },
        ],
        default: 'image',
      },
      {
        displayName: 'Provider',
        name: 'provider',
        type: 'options',
        noDataExpression: true,
        description: 'Select the AI service provider',
        typeOptions: {
          loadOptionsMethod: 'getProviders',
          loadOptionsDependsOn: ['mediaType'],
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Model',
        name: 'model',
        type: 'options',
        noDataExpression: true,
        description: 'Select the AI model to use',
        typeOptions: {
          loadOptionsMethod: 'getModels',
          loadOptionsDependsOn: ['provider', 'mediaType'],
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Enable Caching',
            name: 'enableCache',
            type: 'boolean',
            default: true,
            description: 'Cache generation results for identical requests',
          },
          {
            displayName: 'Cache TTL (seconds)',
            name: 'cacheTTL',
            type: 'number',
            default: 3600,
            description: 'How long to cache results (default: 1 hour)',
            displayOptions: {
              show: {
                enableCache: [true],
              },
            },
          },
          {
            displayName: 'Use Binary Output',
            name: 'binaryOutput',
            type: 'boolean',
            default: false,
            description: 'Return binary data instead of URL',
          },
          {
            displayName: 'Async Processing',
            name: 'asyncProcessing',
            type: 'boolean',
            default: false,
            description: 'Use asynchronous processing for long-running tasks',
          },
          {
            displayName: 'Max Wait Time (seconds)',
            name: 'maxWaitTime',
            type: 'number',
            default: 300,
            description: 'Maximum time to wait for async task completion',
            displayOptions: {
              show: {
                asyncProcessing: [true],
              },
            },
          },
        ],
      },
      // Dynamic parameters will be loaded based on selected model
      {
        displayName: 'Generation Parameters',
        name: 'generationParams',
        type: 'fixedCollection',
        placeholder: 'Add Parameter',
        typeOptions: {
          multipleValues: true,
        },
        default: {},
        options: [
          {
            displayName: 'Parameters',
            name: 'parameters',
            values: [
              // This will be populated dynamically
            ],
          },
        ],
      },
    ],
  };

  /**
   * Get available providers for a media type
   */
  async getProviders(this: IExecuteFunctions): Promise<Array<{ name: string; value: string }>> {
    const mediaType = this.getNodeParameter('mediaType') as MediaType;
    const models = await ModelFactory.getModelsByType(mediaType);

    // Get unique providers
    const providers = new Set(models.map((m) => m.provider));

    return Array.from(providers).map((provider) => ({
      name: provider.charAt(0).toUpperCase() + provider.slice(1),
      value: provider,
    }));
  }

  /**
   * Get available models for a provider
   */
  async getModels(this: IExecuteFunctions): Promise<Array<{ name: string; value: string }>> {
    const providerName = this.getNodeParameter('provider') as string;
    const mediaType = this.getNodeParameter('mediaType') as MediaType;

    const models = await ModelFactory.getModelsByType(mediaType);
    const providerModels = models.filter((m) => m.provider === providerName);

    return providerModels.map((model) => ({
      name: model.displayName,
      value: model.id,
    }));
  }

  /**
   * Execute the node
   */
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    // Get node parameters
    const mediaType = this.getNodeParameter('mediaType') as MediaType;
    const providerName = this.getNodeParameter('provider') as string;
    const modelId = this.getNodeParameter('model') as string;
    const options = this.getNodeParameter('options', {}) as any;

    // Get credentials
    const credentials = await this.getCredentials(`${providerName}Credentials`);

    // Create model instance
    const model = await ModelFactory.create(providerName, modelId, credentials);

    // Get cache manager
    const cacheManager = CacheManager.getInstance();

    // Process each item
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        const params = this.extractParameters(item, model);

        // Check cache if enabled
        if (options.enableCache !== false) {
          const cacheKey = CacheKeyGenerator.forGeneration(modelId, params);
          const cached = await cacheManager.get<any>(cacheKey);

          if (cached) {
            returnData.push(this.formatOutput(cached, options.binaryOutput, true));
            continue;
          }
        }

        // Execute generation
        let result;

        if (options.asyncProcessing && model.supportsFeature('async')) {
          // Async processing
          result = await this.executeAsync(model, params, options);
        } else {
          // Synchronous processing
          result = await this.executeSync(model, params);
        }

        // Cache result if enabled
        if (options.enableCache !== false && result.success) {
          const cacheKey = CacheKeyGenerator.forGeneration(modelId, params);
          await cacheManager.set(cacheKey, result, options.cacheTTL);
        }

        returnData.push(this.formatOutput(result, options.binaryOutput, false));

      } catch (error) {
        const errorHandler = ErrorHandler.getInstance();
        returnData.push(errorHandler.handleForNode(error, {
          itemIndex: i,
          provider: providerName,
          model: modelId,
        }));
      }
    }

    return [returnData];
  }

  /**
   * Extract parameters from input data and node config
   */
  private extractParameters(item: INodeExecutionData, model: any): IGenerationParameters {
    const params: IGenerationParameters = { ...item.json };

    // Get model-specific parameters from node config
    const modelParams = this.getNodeParameter('generationParams', {});

    // Merge parameters
    return {
      ...params,
      ...modelParams,
    };
  }

  /**
   * Execute synchronous generation
   */
  private async executeSync(
    model: any,
    params: IGenerationParameters
  ): Promise<any> {
    return await model.execute(params);
  }

  /**
   * Execute asynchronous generation
   */
  private async executeAsync(
    model: any,
    params: IGenerationParameters,
    options: any
  ): Promise<any> {
    const taskManager = AsyncTaskManager.getInstance();

    // Submit task
    const taskId = await taskManager.submitTask(
      async (task) => {
        return await model.execute(params);
      },
      'generation',
      { modelId: model.id, params }
    );

    // Poll for completion
    const maxWaitTime = (options.maxWaitTime || 300) * 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const result = await taskManager.pollTask(taskId);

      if (result.success) {
        return result.data;
      }

      if (result.error) {
        throw new MediaGenError(result.error, 'task_failed');
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new MediaGenError('Async task timed out', 'task_timeout');
  }

  /**
   * Format output for n8n
   */
  private formatOutput(
    result: any,
    binaryOutput: boolean,
    cached: boolean
  ): INodeExecutionData {
    const output: INodeExecutionData = {
      json: {
        success: result.success,
        url: result.url,
        mediaType: result.metadata?.type || 'unknown',
        provider: result.metadata?.provider,
        model: result.metadata?.model,
        cached,
        ...result.metadata,
      },
    };

    // Add binary data if requested and URL is available
    if (binaryOutput && result.url) {
      output.binary = {
        data: {
          data: Buffer.from(result.url).toString('base64'), // Placeholder - would download actual file
          mimeType: result.mimeType || 'application/octet-stream',
          fileName: `generated_${Date.now()}.${this.getFileExtension(result.mimeType)}`,
        },
      };
    }

    return output;
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimeType?: string): string {
    if (!mimeType) return 'bin';

    const extensions: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
    };

    return extensions[mimeType] || 'bin';
  }
}
