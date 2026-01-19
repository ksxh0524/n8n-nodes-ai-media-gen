# n8n-nodes-ai-media-gen

A highly extensible n8n node package for AI media generation (images, videos, audio). This framework provides a unified interface for multiple AI providers and models, making it easy to add new models without modifying core code.

## Features

- **Unified Interface**: Single node for images, videos, and audio generation
- **Multi-Provider Support**: OpenAI, Stability AI, ElevenLabs, and more
- **Extensible Architecture**: Add new models in 4 simple steps
- **Advanced Features**:
  - Result caching with configurable TTL
  - Batch processing with concurrency control
  - Async task management with polling
  - Automatic retry with exponential backoff
- **Dual Mode**: Works as both Action node and AI Agent Tool
- **Type Safety**: Full TypeScript support

## Installation

```bash
cd /Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-nodes-ai-media-gen
npm install
npm run build
```

## Quick Start

### Basic Usage

1. Add the "AI Media Generation" node to your workflow
2. Select media type (Image, Video, or Audio)
3. Choose a provider (e.g., OpenAI, Stability AI)
4. Select a model (e.g., DALL-E 3, Stable Diffusion XL)
5. Configure generation parameters
6. Run the workflow

### Example: Generate an Image

```javascript
// Input data
{
  "prompt": "A serene sunset over a calm ocean, digital art",
  "size": "1024x1024",
  "quality": "hd"
}

// Output data
{
  "success": true,
  "url": "https://example.com/generated/image.png",
  "mediaType": "image",
  "provider": "openai",
  "model": "dall-e-3"
}
```

## Architecture

```
n8n-nodes-ai-media-gen/
├── nodes/
│   ├── core/           # Core framework
│   ├── types/          # Type definitions
│   ├── config/         # Provider/Model configs
│   ├── providers/      # Provider implementations
│   ├── nodes/          # n8n node definitions
│   └── errors/         # Error handling
└── docs/               # Documentation
```

### Key Components

- **Interfaces**: `IProvider`, `IModel`, `INodeExecutor`
- **Base Classes**: `BaseProvider`, `BaseModel`
- **Factories**: `ProviderFactory`, `ModelFactory`
- **Registries**: `ProviderRegistry`, `ModelRegistry`
- **Utilities**: Request, Retry, Validation helpers
- **Advanced Features**: Cache, Async tasks, Batch processing

## Supported Providers

| Provider | Image | Video | Audio | Status |
|----------|-------|-------|-------|--------|
| OpenAI   | DALL-E 2/3 | Sora | TTS | Framework ready |
| Stability AI | SDXL | SVD | - | Framework ready |
| ElevenLabs | - | - | TTS | Framework ready |
| Replicate | Various | Various | - | Framework ready |
| Custom | - | - | - | Framework ready |

## Adding New Models

### Step 1: Create Model Class

```typescript
// providers/openai/models/DallE3.ts
export class DallE3 extends BaseModel {
  readonly id = 'dall-e-3';
  readonly displayName = 'DALL-E 3';
  readonly type = 'image';

  readonly parameters: IParameter[] = [
    {
      name: 'prompt',
      type: 'string',
      required: true,
      description: 'Image generation prompt',
    },
    // ... more parameters
  ];

  async execute(params: IGenerationParameters): Promise<IGenerationResult> {
    // Call OpenAI API
    const response = await this.getProvider().request('/images/generations', {
      method: 'POST',
      body: { prompt: params.prompt, ...params },
    });

    return {
      success: true,
      url: response.data[0].url,
      mimeType: 'image/png',
    };
  }
}
```

### Step 2: Register in Provider

```typescript
// providers/openai/OpenAIProvider.ts
export class OpenAIProvider extends BaseProvider {
  constructor() {
    super(config);
    this.registerModel(new DallE3(this));
    this.registerModel(new Sora(this));
  }
}
```

### Step 3: Add to Config

```typescript
// config/models.config.ts
export const MODELS_CONFIG = {
  'openai.dall-e-3': {
    id: 'dall-e-3',
    displayName: 'DALL-E 3',
    type: 'image',
    provider: 'openai',
    capabilities: {
      supportsBatch: false,
      supportsAsync: false,
      maxConcurrentRequests: 5,
      supportedFormats: ['png'],
      maxResolution: '1024x1024',
    },
  },
};
```

### Step 4: Add Credentials (if new provider)

```typescript
// providers/openai/credentials.ts
export const OpenAICredentials = {
  name: 'openaiApi',
  displayName: 'OpenAI API',
  properties: [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
    },
  ],
};
```

Done! No core code modifications needed.

## Advanced Features

### Result Caching

```javascript
{
  "options": {
    "enableCache": true,
    "cacheTTL": 3600  // 1 hour
  }
}
```

### Batch Processing

```javascript
// Automatically batch multiple inputs
const processor = new BatchProcessor({ concurrency: 3 });
const results = await processor.processBatch(items, generateFn);
```

### Async Task Management

```javascript
{
  "options": {
    "asyncProcessing": true,
    "maxWaitTime": 300  // 5 minutes
  }
}
```

### Automatic Retry

```javascript
// Configured per model
await RetryHelper.withRetry(
  () => model.execute(params),
  { maxRetries: 3, initialDelayMs: 1000 }
);
```

## Error Handling

All errors are wrapped in `MediaGenError` with proper error codes:

```typescript
try {
  await model.execute(params);
} catch (error) {
  if (error instanceof MediaGenError) {
    console.log(error.code);      // 'rate_limit_error'
    console.log(error.isRetryable()); // true
    console.log(error.getUserMessage()); // User-friendly message
  }
}
```

## Testing

```bash
npm test                    # Run tests
npm run build              # Build for production
npm run dev                # Watch mode for development
npm run lint               # Lint code
npm run format             # Format code
```

## Configuration

### Cache Configuration

```typescript
const cache = CacheManager.getInstance();
cache.setEnabled(true);
cache.setDefaultTTL(3600);
```

### Concurrency Limits

```typescript
const taskManager = AsyncTaskManager.getInstance({
  maxConcurrentTasks: 10,
});
```

### Retry Configuration

```typescript
const retryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};
```

## API Reference

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed API documentation.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please use the GitHub issue tracker.
