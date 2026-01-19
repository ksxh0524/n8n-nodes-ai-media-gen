# Architecture Documentation

Detailed technical documentation for n8n-nodes-ai-media-gen.

## Table of Contents

1. [Overview](#overview)
2. [Core Design Principles](#core-design-principles)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Extension Points](#extension-points)
6. [Advanced Features](#advanced-features)

## Overview

The framework is built on a modular, plugin-based architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                     n8n Workflow                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   AIMediaGen Node                        │
│  • Parameter extraction                                  │
│  • Credential handling                                   │
│  • Output formatting                                     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Factory Layer                          │
│  • ProviderFactory                                       │
│  • ModelFactory                                          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Registry Layer                         │
│  • ProviderRegistry                                      │
│  • ModelRegistry                                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Provider Layer                         │
│  • BaseProvider (abstract)                               │
│  • Concrete Providers (OpenAI, Stability, etc.)          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Model Layer                            │
│  • BaseModel (abstract)                                  │
│  • Concrete Models (DallE3, Sora, etc.)                 │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   External APIs                          │
└─────────────────────────────────────────────────────────┘
```

## Core Design Principles

### 1. Separation of Concerns

- **Node Layer**: n8n-specific logic
- **Factory Layer**: Object creation and dependency injection
- **Registry Layer**: Service registration and discovery
- **Provider Layer**: API communication and authentication
- **Model Layer**: Generation logic and parameter handling

### 2. Dependency Inversion

All components depend on abstractions (interfaces), not concrete implementations:

```typescript
IProvider  ←──  BaseProvider  ←──  OpenAIProvider
IModel     ←──  BaseModel     ←──  DallE3
```

### 3. Open/Closed Principle

- Open for extension: Add new providers/models without modifying core code
- Closed for modification: Core framework is stable

### 4. Single Responsibility

Each class has one reason to change:
- `ProviderFactory`: Creates providers
- `RequestHelper`: Makes HTTP requests
- `CacheManager`: Manages caching
- `BatchProcessor`: Handles batch operations

## Component Architecture

### Node Layer

#### AIMediaGen

**Responsibility**: n8n node entry point

**Key Methods**:
- `execute()`: Main execution logic
- `getProviders()`: Load available providers
- `getModels()`: Load available models
- `formatOutput()`: Format results for n8n

**Flow**:
```typescript
1. Extract parameters from input
2. Get credentials
3. Create provider and model via factories
4. Check cache (if enabled)
5. Execute generation
6. Cache result (if enabled)
7. Format and return output
```

### Factory Layer

#### ProviderFactory

**Responsibility**: Create provider instances

**Methods**:
```typescript
ProviderFactory.create(providerName, credentials) → IProvider
ProviderFactory.hasProvider(providerName) → boolean
ProviderFactory.getAvailableProviders() → string[]
```

#### ModelFactory

**Responsibility**: Create/access model instances

**Methods**:
```typescript
ModelFactory.create(providerName, modelId, credentials) → IModel
ModelFactory.getModelsByType(mediaType) → IModel[]
ModelFactory.searchModels(query) → IModel[]
```

### Registry Layer

#### ProviderRegistry

**Responsibility**: Register and discover providers

**Storage**: `Map<string, IProvider>`

**Methods**:
```typescript
registerProvider(provider: IProvider): void
getProvider(name: string): IProvider | undefined
hasProvider(name: string): boolean
```

#### ModelRegistry

**Responsibility**: Register and discover models

**Storage**: `Map<string, IModel>` with secondary indexes

**Indexes**:
- By provider: `Map<string, Set<string>>`
- By type: `Map<MediaType, Set<string>>`

### Provider Layer

#### BaseProvider

**Abstract base class for all providers**

**Features**:
- Authentication handling
- HTTP request wrapping
- Model registration
- Health checks

**Template Methods** (override in subclasses):
```typescript
protected getAuthHeaders(): Record<string, string>
async healthCheck(): Promise<boolean>
```

**Example**:
```typescript
class OpenAIProvider extends BaseProvider {
  protected getAuthHeaders() {
    return { Authorization: `Bearer ${this.credentials.apiKey}` };
  }

  async healthCheck() {
    const response = await this.request('/models', { method: 'GET' });
    return response.status === 200;
  }
}
```

### Model Layer

#### BaseModel

**Abstract base class for all models**

**Features**:
- Parameter validation
- Default parameter handling
- Error formatting

**Required Properties**:
```typescript
readonly id: string;
readonly displayName: string;
readonly type: MediaType;
readonly capabilities: IModelCapabilities;
readonly parameters: IParameter[];
```

**Required Methods**:
```typescript
abstract execute(params: IGenerationParameters): Promise<IGenerationResult>
```

**Built-in Methods**:
```typescript
validateParameters(params): IValidationResult
getDefaultParameters(): IGenerationParameters
supportsFeature(feature): boolean
```

## Data Flow

### Synchronous Generation

```
┌──────────────┐
│ n8n Input    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Extract      │
│ Parameters   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Get          │
│ Credentials  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Provider     │
│ Factory      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Get Model    │
│ from Provider│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Check Cache  │── hit ───▶ Return Cached
└──────┬───────┘
       │ miss
       ▼
┌──────────────┐
│ Validate     │
│ Parameters   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Execute      │
│ Model        │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Cache Result │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Format       │
│ Output       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Return to n8n│
└──────────────┘
```

### Asynchronous Generation

```
┌──────────────┐
│ Submit Task  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Task Manager │
│ Creates Task │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Start        │
│ Execution    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Polling      │
│ Strategy     │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────┐
│ Loop:                       │
│  1. Check status            │
│  2. If complete → return    │
│  3. If failed → throw       │
│  4. Wait                    │
│  5. Repeat                  │
└─────────────────────────────┘
```

## Extension Points

### Adding a New Provider

**Files to Create**:
1. `providers/{provider}/{Provider}Provider.ts`
2. `providers/{provider}/credentials.ts`
3. `providers/{provider}/models/{Model}Model.ts`

**Steps**:
```typescript
// 1. Extend BaseProvider
export class MyProvider extends BaseProvider {
  constructor() {
    super(config);
    this.registerModel(new MyModel(this));
  }

  protected getAuthHeaders() {
    return { 'X-API-Key': this.credentials.apiKey };
  }
}

// 2. Extend BaseModel
export class MyModel extends BaseModel {
  readonly id = 'my-model';
  readonly type = 'image';

  async execute(params) {
    const response = await this.getProvider().request('/generate', {
      method: 'POST',
      body: params,
    });
    return { success: true, url: response.url };
  }
}

// 3. Register in config
export const PROVIDERS_CONFIG = {
  myprovider: { name: 'myprovider', ... }
};
```

### Adding Custom Cache Implementation

```typescript
export class RedisCache implements ICache {
  async get<T>(key: string): Promise<T | null> {
    // Redis implementation
  }

  async set<T>(key: string, value: T, options?: ICacheOptions): Promise<void> {
    // Redis implementation
  }
  // ... other methods
}

// Use it
CacheManager.getInstance(new RedisCache());
```

### Adding Custom Polling Strategy

```typescript
export class WebSocketPollingStrategy {
  async poll<T>(taskId: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`wss://api.example.com/tasks/${taskId}`);

      ws.onmessage = (event) => {
        const result = JSON.parse(event.data);
        if (result.status === 'completed') {
          resolve(result.data);
        }
      };

      ws.onerror = reject;
    });
  }
}
```

## Advanced Features

### Caching System

**Architecture**:
```
CacheManager (Singleton)
    │
    ├── ICache (Interface)
    │       ├── MemoryCache (Default)
    │       ├── RedisCache (Optional)
    │       └── CustomCache
    │
    └── CacheKeyGenerator
            ├── forGeneration()
            ├── forApiRequest()
            └── forTask()
```

**Key Features**:
- LRU eviction policy
- Configurable TTL
- Automatic cleanup
- Thread-safe operations

### Batch Processing

**Architecture**:
```
BatchProcessor
    │
    ├── Semaphore (Concurrency Control)
    ├── Throttle (Rate Limiting)
    └── RetryHelper (Error Recovery)
```

**Process**:
```typescript
const processor = new BatchProcessor({
  concurrency: 3,
  delayMs: 1000,
  maxRetries: 2,
});

const results = await processor.processBatch(
  items,
  async (item) => await model.execute(item)
);
```

### Async Task Management

**Architecture**:
```
AsyncTaskManager (Singleton)
    │
    ├── Map<taskId, IAsyncTask>
    ├── Set<runningTaskIds>
    └── PollingStrategy
```

**Task Lifecycle**:
```
pending → processing → completed
                    ↓
                  failed
                    ↓
                 cancelled
```

## Performance Considerations

### Concurrency

- **Default**: 3 concurrent requests
- **Configurable**: Per-model basis
- **Controlled**: Semaphore implementation

### Memory

- **Cache**: LRU with configurable max size
- **Tasks**: Auto-cleanup after 1 hour
- **Batch**: Streaming for large datasets

### Network

- **Retry**: Exponential backoff
- **Timeout**: Configurable per request
- **Pooling**: HTTP connection reuse

## Security

### Credentials

- Encrypted at rest (n8n credential store)
- Never logged
- Memory-scoped

### Input Validation

- Type checking
- Range validation
- Sanitization

### Rate Limiting

- Per-provider limits
- Token bucket algorithm
- Automatic backoff
