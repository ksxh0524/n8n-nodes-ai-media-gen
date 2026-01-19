# How to Add a New Model

Step-by-step guide for adding a new AI model to n8n-nodes-ai-media-gen.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Understanding the Structure](#understanding-the-structure)
3. [Step-by-Step Guide](#step-by-step-guide)
4. [Examples](#examples)
5. [Testing](#testing)
6. [Best Practices](#best-practices)

## Prerequisites

Before adding a new model, ensure you have:

- [ ] Access to the model's API documentation
- [ ] API credentials (if required)
- [ ] Understanding of the model's input/output format
- [ ] TypeScript knowledge

## Understanding the Structure

### Key Files

```
nodes/
├── providers/
│   └── {provider}/
│       ├── {Provider}Provider.ts    # Provider implementation
│       ├── credentials.ts             # Credential definition
│       └── models/
│           └── {Model}Model.ts       # Model implementation
└── config/
    ├── providers.config.ts            # Provider registry
    └── models.config.ts               # Model registry
```

### Key Interfaces

```typescript
// IProvider - Provider interface
interface IProvider {
  readonly name: string;
  readonly displayName: string;
  request<T>(endpoint: string, options: IRequestOptions): Promise<T>;
  getAvailableModels(): IModel[];
  getModel(modelId: string): IModel | undefined;
}

// IModel - Model interface
interface IModel {
  readonly id: string;
  readonly displayName: string;
  readonly type: MediaType;
  readonly parameters: IParameter[];

  execute(params: IGenerationParameters): Promise<IGenerationResult>;
  validateParameters(params: IGenerationParameters): IValidationResult;
}
```

## Step-by-Step Guide

### Step 1: Check if Provider Exists

First, check if the provider already exists:

```typescript
// In nodes/core/registry/ProviderRegistry.ts
ProviderRegistry.getInstance().hasProvider('openai')  // Check
```

If the provider exists, skip to Step 3.

### Step 2: Create Provider (if new)

Create a new provider file:

```typescript
// nodes/providers/myprovider/MyProvider.ts
import { BaseProvider } from '../../core/base/BaseProvider';
import { IProviderConfig } from '../../types/core.types';

export class MyProvider extends BaseProvider {
  constructor() {
    const config: IProviderConfig = {
      name: 'myprovider',
      displayName: 'My Provider',
      type: 'commercial',
      baseUrl: 'https://api.myprovider.com/v1',
      credentialsType: 'api-key',
    };

    super(config);
  }

  // Override authentication headers
  protected getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.credentials?.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  // Override health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request('/health', { method: 'GET' });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
```

Register the provider:

```typescript
// nodes/config/providers.config.ts
export const PROVIDERS_CONFIG = {
  myprovider: {
    name: 'myprovider',
    displayName: 'My Provider',
    type: 'commercial',
    baseUrl: 'https://api.myprovider.com/v1',
    credentialsType: 'api-key',
  },
};
```

### Step 3: Create Model

Create a model file:

```typescript
// nodes/providers/myprovider/models/MyImageModel.ts
import { BaseModel } from '../../../core/base/BaseModel';
import { IProvider } from '../../../core/interfaces/IProvider';
import {
  IGenerationParameters,
  IGenerationResult,
  IModelCapabilities,
  IParameter,
  MediaType,
} from '../../../types/core.types';
import { MediaGenError } from '../../../errors/MediaGenError';

export class MyImageModel extends BaseModel {
  // Required properties
  readonly id = 'my-image-model';
  readonly displayName = 'My Image Generator';
  readonly type: MediaType = 'image';

  // Model capabilities
  readonly capabilities: IModelCapabilities = {
    supportsBatch: true,
    supportsAsync: false,
    maxConcurrentRequests: 5,
    supportedFormats: ['png', 'jpeg'],
    maxResolution: '1024x1024',
  };

  // Parameter schema
  readonly parameters: IParameter[] = [
    {
      name: 'prompt',
      displayName: 'Prompt',
      type: 'string',
      required: true,
      description: 'Text prompt for image generation',
    },
    {
      name: 'negativePrompt',
      displayName: 'Negative Prompt',
      type: 'string',
      required: false,
    },
    {
      name: 'size',
      displayName: 'Size',
      type: 'options',
      required: false,
      default: '1024x1024',
      options: [
        { name: 'Square', value: '1024x1024' },
        { name: 'Wide', value: '1792x1024' },
        { name: 'Tall', value: '1024x1792' },
      ],
    },
    {
      name: 'numberOfImages',
      displayName: 'Number of Images',
      type: 'number',
      required: false,
      default: 1,
      min: 1,
      max: 4,
    },
  ];

  constructor(provider: IProvider) {
    super(provider);
  }

  // Main execution method
  async execute(params: IGenerationParameters): Promise<IGenerationResult> {
    // 1. Validate parameters
    const validation = this.validateParameters(params);
    if (!validation.valid) {
      throw new MediaGenError(
        `Invalid parameters: ${validation.errors.map(e => e.message).join(', ')}`,
        'model_validation_failed'
      );
    }

    // 2. Sanitize parameters
    const sanitized = this.sanitizeParameters
      ? this.sanitizeParameters(params)
      : params;

    try {
      // 3. Make API request
      const response = await this.getProvider().request('/images/generate', {
        method: 'POST',
        body: {
          prompt: sanitized.prompt,
          negative_prompt: sanitized.negativePrompt,
          size: sanitized.size,
          n: sanitized.numberOfImages,
        },
      });

      // 4. Format response
      const images = response.data.images.map((img: any) => ({
        url: img.url,
        width: parseInt(sanitized.size?.split('x')[0] || '1024'),
        height: parseInt(sanitized.size?.split('x')[1] || '1024'),
        mimeType: 'image/png',
      }));

      return {
        success: true,
        url: images[0].url,
        data: images,
        metadata: {
          model: this.id,
          provider: this.provider,
          parameters: sanitized,
          count: images.length,
        },
      };
    } catch (error) {
      throw this.buildError('Image generation failed', {
        params: sanitized,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
```

### Step 4: Register Model in Provider

```typescript
// nodes/providers/myprovider/MyProvider.ts
import { MyImageModel } from './models/MyImageModel';

export class MyProvider extends BaseProvider {
  constructor() {
    super(config);

    // Register models
    this.registerModel(new MyImageModel(this));
  }
}
```

### Step 5: Add Model to Config

```typescript
// nodes/config/models.config.ts
export const MODELS_CONFIG = {
  'myprovider.my-image-model': {
    id: 'my-image-model',
    displayName: 'My Image Generator',
    type: 'image',
    provider: 'myprovider',
    capabilities: {
      supportsBatch: true,
      supportsAsync: false,
      maxConcurrentRequests: 5,
      supportedFormats: ['png', 'jpeg'],
      maxResolution: '1024x1024',
    },
  },
};
```

### Step 6: Add Credentials (if new provider)

```typescript
// nodes/providers/myprovider/credentials.ts
export const MyProviderCredentials = {
  name: 'myProviderApi',
  displayName: 'My Provider API',
  type: 'http',
  properties: [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      required: true,
    },
    {
      displayName: 'Organization ID',
      name: 'organizationId',
      type: 'string',
      required: false,
    },
  ],
};
```

Done! Your model is now available in n8n.

## Examples

### Example 1: Text-to-Image Model

```typescript
export class MyTextToImageModel extends BaseModel {
  readonly id = 'text2img';
  readonly displayName = 'Text to Image';
  readonly type = 'image';

  readonly parameters: IParameter[] = [
    {
      name: 'prompt',
      displayName: 'Prompt',
      type: 'string',
      required: true,
    },
    {
      name: 'width',
      displayName: 'Width',
      type: 'number',
      default: 1024,
      min: 256,
      max: 2048,
    },
    {
      name: 'height',
      displayName: 'Height',
      type: 'number',
      default: 1024,
      min: 256,
      max: 2048,
    },
  ];

  async execute(params: IGenerationParameters): Promise<IGenerationResult> {
    const response = await this.getProvider().request('/generate', {
      method: 'POST',
      body: {
        text: params.prompt,
        width: params.width,
        height: params.height,
      },
    });

    return {
      success: true,
      url: response.image_url,
      mimeType: 'image/png',
    };
  }
}
```

### Example 2: Text-to-Video Model (Async)

```typescript
export class MyTextToVideoModel extends BaseModel {
  readonly id = 'text2video';
  readonly displayName = 'Text to Video';
  readonly type = 'video';

  readonly capabilities = {
    supportsBatch: false,
    supportsAsync: true,
    maxConcurrentRequests: 2,
    supportedFormats: ['mp4'],
    maxDuration: 60,
  };

  async execute(params: IGenerationParameters): Promise<IGenerationResult> {
    // 1. Start generation
    const startResponse = await this.getProvider().request('/video/start', {
      method: 'POST',
      body: { prompt: params.prompt },
    });

    const taskId = startResponse.task_id;

    // 2. Poll for completion
    let status = 'processing';
    let attempts = 0;
    const maxAttempts = 60;

    while (status === 'processing' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await this.getProvider().request(`/video/status/${taskId}`, {
        method: 'GET',
      });

      status = statusResponse.status;
      attempts++;

      if (status === 'completed') {
        return {
          success: true,
          url: statusResponse.video_url,
          mimeType: 'video/mp4',
          metadata: { taskId },
        };
      }
    }

    throw new MediaGenError('Video generation timed out', 'task_timeout');
  }
}
```

### Example 3: Text-to-Speech Model

```typescript
export class MyTTSModel extends BaseModel {
  readonly id = 'tts';
  readonly displayName = 'Text to Speech';
  readonly type = 'audio';

  readonly parameters: IParameter[] = [
    {
      name: 'text',
      displayName: 'Text',
      type: 'string',
      required: true,
    },
    {
      name: 'voice',
      displayName: 'Voice',
      type: 'options',
      options: [
        { name: 'Male', value: 'male' },
        { name: 'Female', value: 'female' },
      ],
    },
    {
      name: 'speed',
      displayName: 'Speed',
      type: 'number',
      default: 1.0,
      min: 0.5,
      max: 2.0,
    },
  ];

  async execute(params: IGenerationParameters): Promise<IGenerationResult> {
    const response = await this.getProvider().request('/tts', {
      method: 'POST',
      body: {
        text: params.text,
        voice: params.voice,
        speed: params.speed,
      },
    });

    return {
      success: true,
      url: response.audio_url,
      mimeType: 'audio/mpeg',
      metadata: {
        duration: response.duration,
        size: response.size_bytes,
      },
    };
  }
}
```

## Testing

### Unit Tests

```typescript
import { MyImageModel } from './MyImageModel';
import { MyProvider } from '../MyProvider';

describe('MyImageModel', () => {
  let model: MyImageModel;
  let provider: MyProvider;

  beforeEach(() => {
    provider = new MyProvider();
    model = new MyImageModel(provider);
  });

  test('should validate required parameters', () => {
    const result = model.validateParameters({});
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  test('should validate parameter ranges', () => {
    const result = model.validateParameters({
      prompt: 'test',
      numberOfImages: 10,
    });
    expect(result.valid).toBe(false);
  });

  test('should execute generation', async () => {
    // Mock provider request
    jest.spyOn(provider, 'request').mockResolvedValue({
      data: { images: [{ url: 'https://example.com/image.png' }] },
    });

    const result = await model.execute({
      prompt: 'A sunset',
      numberOfImages: 1,
    });

    expect(result.success).toBe(true);
    expect(result.url).toBeDefined();
  });
});
```

### Integration Tests

```bash
# Build the project
npm run build

# Install in n8n
npm link

# Test in n8n UI
# 1. Create new workflow
# 2. Add "AI Media Generation" node
# 3. Select your provider/model
# 4. Configure parameters
# 5. Execute
```

## Best Practices

### 1. Parameter Validation

Always validate parameters before API calls:

```typescript
const validation = this.validateParameters(params);
if (!validation.valid) {
  throw new MediaGenError('Invalid parameters', 'model_validation_failed', {
    errors: validation.errors,
  });
}
```

### 2. Error Handling

Use MediaGenError for consistent error handling:

```typescript
try {
  const response = await this.getProvider().request(...);
  return { success: true, ...response };
} catch (error) {
  throw this.buildError('Generation failed', { params, error });
}
```

### 3. Response Formatting

Ensure consistent response format:

```typescript
return {
  success: true,
  url: result.url,
  mimeType: 'image/png',
  metadata: {
    model: this.id,
    provider: this.provider,
    parameters: sanitized,
    ...extraMetadata,
  },
};
```

### 4. Async Operations

For long-running operations, implement proper polling:

```typescript
while (status === 'processing' && attempts < maxAttempts) {
  await sleep(pollInterval);
  status = await checkStatus(taskId);
  if (status === 'completed') {
    return getResult();
  }
}
throw new MediaGenError('Timeout', 'task_timeout');
```

### 5. Resource Cleanup

Clean up resources when done:

```typescript
try {
  return await execute();
} finally {
  // Cleanup
  await cleanupResources();
}
```

## Troubleshooting

### Issue: Model not appearing in n8n

**Solution**:
- Check provider is registered in `ProviderRegistry`
- Check model is registered in provider
- Check model config in `models.config.ts`
- Rebuild: `npm run build`

### Issue: Authentication errors

**Solution**:
- Verify credentials format
- Check `getAuthHeaders()` implementation
- Test API credentials separately

### Issue: Validation errors

**Solution**:
- Check parameter schema
- Ensure required fields are marked
- Verify parameter types match

### Issue: Timeouts

**Solution**:
- Increase timeout in `RequestHelper`
- Implement async processing for long tasks
- Add retry logic

## Checklist

Before submitting your new model:

- [ ] Model implements `IModel` interface
- [ ] All parameters defined with proper types
- [ ] Parameter validation works correctly
- [ ] Error handling implemented
- [ ] Response format consistent
- [ ] Model registered in provider
- [ ] Provider registered in config
- [ ] Credentials defined (if new provider)
- [ ] Code compiles without errors
- [ ] Tests pass
- [ ] Documentation updated
