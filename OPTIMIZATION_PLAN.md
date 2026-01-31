# n8n-nodes-ai-media-gen 优化计划

**项目路径**: `/Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-nodes-ai-media-gen`

**当前状态**: v0.0.8

**目标**: 减少代码重复、提高可维护性、优化性能

---

## 📊 当前代码分析

### 文件大小分布

| 文件 | 行数 | 占比 | 状态 |
|------|------|------|------|
| `nodes/AIMediaGen.ts` | 3555 | 57% | 🔴 需要重构 |
| `nodes/utils/` | 2280 | 37% | 🟡 可优化 |
| `nodes/credentials/` | 43 | 1% | 🟢 良好 |
| `nodes/base/` | 125 | 2% | 🟢 良好 |
| 其他 | 239 | 3% | 🟢 良好 |
| **总计** | **6142** | **100%** | |

### 重复代码模式分析

| 模式 | 出现次数 | 重复度 | 优先级 |
|------|----------|--------|--------|
| 图片下载逻辑 | 4-5 处 | 80% | 高 |
| HTTP 请求 | 44 处 | 60% | 高 |
| MediaGenError 抛出 | 14 处 | 70% | 中 |
| 凭证获取 | 8 处 | 50% | 中 |
| 种子值处理 | 6 处 | 80% | 低 |
| for 循环处理 items | 1 处 | - | - |

### 平台方法分布

AIMediaGen.ts 包含 6 个平台执行方法：

```typescript
- executeModelRequest()    // ModelScope (Tongyi-MAI, Qwen-Image)
- executeGeminiRequest()   // Gemini/Nano Banana
- executeNanoBananaRequest() // Nano Banana v2
- executeDoubaoRequest()    // Doubao Seedream
- executeSoraRequest()      // OpenAI Sora
- executeVeoRequest()       // Google Veo
```

每个方法 200-400 行，包含大量重复逻辑。

---

## 🎯 优化目标

| 指标 | 当前 | 目标 | 改善 |
|------|------|------|------|
| AIMediaGen.ts 行数 | 3555 | 1800-2000 | -45% |
| 代码重复率 | 60-70% | 20-30% | -60% |
| 方法数量 | 11 | 15+ | +36% (更小的方法) |
| 可测试性 | 低 | 高 | ⬆️ |
| 类型安全 | 中 | 高 | ⬆️ |

---

## 📋 优化计划

### 阶段 1: 提取通用辅助方法（优先级：🔴 高）

**预期减少代码**: 400-500 行

#### 1.1 创建统一的图片下载模块

**新文件**: `nodes/utils/imageDownloader.ts`

```typescript
/**
 * Unified image download utilities
 */
export class ImageDownloader {
  /**
   * Downloads an image from URL and converts to binary data
   */
  static async downloadImage(
    context: IExecuteFunctions,
    imageUrl: string,
    options?: {
      timeout?: number;
      prefix?: string;
      detectDimensions?: boolean;
    }
  ): Promise<BinaryData | null>;

  /**
   * Extracts MIME type from URL or buffer
   */
  static detectMimeType(url: string, buffer?: Buffer): string;

  /**
   * Extracts file extension from MIME type
   */
  static getFileExtension(mimeType: string): string;
}
```

**替换位置**:
- `executeModelRequest()` - 图片下载逻辑
- `executeDoubaoRequest()` - 图片下载逻辑 (2处)
- 其他需要下载图片的地方

**预期影响**: 减少 ~150 行重复代码

---

#### 1.2 创建统一的 HTTP 请求封装

**增强**: `nodes/utils/httpRequest.ts`

添加以下方法：

```typescript
export class HttpRequestHelper {
  /**
   * Download binary data (image, video, etc.)
   */
  static async downloadBinary(
    context: IExecuteFunctions,
    url: string,
    timeout: number
  ): Promise<Buffer>;

  /**
   * POST JSON data
   */
  static async postJson<T>(
    context: IExecuteFunctions,
    url: string,
    body: unknown,
    options: RequestOptions
  ): Promise<T>;

  /**
   * POST form data (multipart)
   */
  static async postForm<T>(
    context: IExecuteFunctions,
    url: string,
    formData: FormData,
    options: RequestOptions
  ): Promise<T>;
}
```

**替换位置**:
- 所有 `context.helpers.httpRequest()` 调用（44处）

**预期影响**: 减少 ~100 行重复代码，提高一致性

---

#### 1.3 创建统一的响应处理模块

**增强**: `nodes/utils/responseHandler.ts`

添加以下方法：

```typescript
export class ResponseHandler {
  /**
   * Handle binary data creation from downloaded content
   */
  static createBinaryData(
    buffer: Buffer,
    url: string,
    prefix: string
  ): BinaryData;

  /**
   * Extract image URL from various API response formats
   */
  static extractImageUrl(response: unknown): string | null;

  /**
   * Extract video URL from task response
   */
  static extractVideoUrl(response: unknown): string | null;

  /**
   * Build standard success response
   */
  static buildSuccessResponse(
    data: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): INodeExecutionData;

  /**
   * Build error response for continueOnFail
   */
  static buildErrorResponse(
    error: unknown,
    itemIndex: number
  ): INodeExecutionData;
}
```

**预期影响**: 减少 ~200 行重复代码

---

### 阶段 2: 重构平台执行方法（优先级：🔴 高）

**预期减少代码**: 800-1000 行

#### 2.1 提取请求构建逻辑

为每个平台创建请求构建器：

**新文件**: `nodes/platforms/requestBuilders.ts`

```typescript
/**
 * Platform-specific request builders
 */
export namespace RequestBuilders {
  export function buildModelScopeRequest(
    params: ModelScopeParams
  ): HttpRequestOptions;

  export function buildGeminiRequest(
    params: GeminiParams
  ): HttpRequestOptions;

  export function buildDoubaoRequest(
    params: DoubaoParams
  ): HttpRequestOptions | FormData;

  export function buildSoraRequest(
    params: SoraParams
  ): HttpRequestOptions;

  export function buildVeoRequest(
    params: VeoParams
  ): HttpRequestOptions;
}
```

**预期影响**: 减少 ~300 行重复代码

---

#### 2.2 提取响应解析逻辑

**新文件**: `nodes/platforms/responseParsers.ts`

```typescript
/**
 * Platform-specific response parsers
 */
export namespace ResponseParsers {
  export function parseModelScopeResponse(
    response: unknown
  ): ParsedResponse;

  export function parseGeminiResponse(
    response: unknown
  ): ParsedResponse;

  export function parseDoubaoResponse(
    response: unknown
  ): ParsedResponse;

  export function parseSoraResponse(
    response: unknown
  ): ParsedResponse;

  export function parseVeoResponse(
    response: unknown
  ): ParsedResponse;

  interface ParsedResponse {
    imageUrl?: string;
    videoUrl?: string;
    base64Data?: string;
    metadata?: Record<string, unknown>;
  }
}
```

**预期影响**: 减少 ~200 行重复代码

---

#### 2.3 创建通用执行模板

**新文件**: `nodes/platforms/platformExecutor.ts`

```typescript
/**
 * Generic platform execution template
 */
export class PlatformExecutor {
  /**
   * Execute a synchronous API request
   */
  static async executeSync<T>(
    context: IExecuteFunctions,
    itemIndex: number,
    credentials: Credentials,
    options: {
      buildRequest: () => HttpRequestOptions;
      parseResponse: (response: unknown) => ParsedResponse;
      postProcess?: (result: ParsedResponse) => Promise<INodeExecutionData>;
    }
  ): Promise<INodeExecutionData>;

  /**
   * Execute an asynchronous task with polling
   */
  static async executeAsync<T>(
    context: IExecuteFunctions,
    itemIndex: number,
    credentials: Credentials,
    options: {
      submitEndpoint: string;
      buildSubmitRequest: () => HttpRequestOptions;
      parseSubmitResponse: (response: unknown) => { taskId: string };
      statusEndpoint: string;
      parseStatusResponse: (response: unknown) => TaskStatus;
      onSuccessStatus: string[];
      onFailureStatus: string[];
      postProcess?: (result: ParsedResponse) => Promise<INodeExecutionData>;
    }
  ): Promise<INodeExecutionData>;
}
```

**预期影响**: 减少 ~400 行重复代码

---

### 阶段 3: 简化主执行逻辑（优先级：🟡 中）

**预期减少代码**: 300-400 行

#### 3.1 重构 execute() 方法

**当前问题**:
- 1179-1739 行：560 行的超长方法
- 包含大量 if-else 判断
- 重复的缓存逻辑
- 重复的错误处理

**优化方案**:

```typescript
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const results: INodeExecutionData[] = [];

  const executor = new MediaGenExecutor(this, {
    enableCache: this.getCacheOption(),
    cacheManager: new CacheManager(),
    performanceMonitor: new PerformanceMonitor(),
  });

  for (let i = 0; i < items.length; i++) {
    try {
      const result = await executor.processItem(items[i], i);
      results.push(result);
    } catch (error) {
      if (!this.continueOnFail()) throw;
      results.push(ErrorHandler.buildErrorResponse(error, i));
    }
  }

  return [this.helpers.constructExecutionMetaData(results, { itemData: { item: 0 } })];
}
```

**新文件**: `nodes/utils/mediaGenExecutor.ts`

```typescript
/**
 * Media generation execution coordinator
 */
export class MediaGenExecutor {
  constructor(
    private context: IExecuteFunctions,
    private options: ExecutorOptions
  ) {}

  async processItem(
    item: INodeExecutionData,
    itemIndex: number
  ): Promise<INodeExecutionData> {
    const operation = this.context.getNodeParameter('operation', itemIndex);

    // Use strategy pattern for different operations
    const strategy = this.getStrategy(operation);
    return await strategy.execute(item, itemIndex);
  }

  private getStrategy(operation: string): PlatformStrategy {
    switch (operation) {
      case 'modelscope':
        return new ModelScopeStrategy(this.options);
      case 'nanoBanana':
        return new NanoBananaStrategy(this.options);
      case 'sora':
        return new SoraStrategy(this.options);
      case 'veo':
        return new VeoStrategy(this.options);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}
```

**预期影响**: 减少 ~300 行代码

---

#### 3.2 创建策略模式实现

**新文件**: `nodes/platforms/strategies.ts`

```typescript
/**
 * Platform strategy pattern implementation
 */
export interface PlatformStrategy {
  execute(
    item: INodeExecutionData,
    itemIndex: number
  ): Promise<INodeExecutionData>;
}

export abstract class BasePlatformStrategy implements PlatformStrategy {
  constructor(protected options: ExecutorOptions) {}

  protected abstract getCredentials(context: IExecuteFunctions, itemIndex: number);

  protected abstract buildRequest(context: IExecuteFunctions, itemIndex: number);

  protected abstract parseResponse(response: unknown): ParsedResponse;

  async execute(
    item: INodeExecutionData,
    itemIndex: number
  ): Promise<INodeExecutionData> {
    const context = this.options.context;

    // 1. Get credentials
    const credentials = await this.getCredentials(context, itemIndex);

    // 2. Check cache
    const cached = await this.checkCache(context, itemIndex);
    if (cached) return cached;

    // 3. Build and send request
    const request = this.buildRequest(context, itemIndex);
    const response = await this.sendRequest(request, credentials);

    // 4. Parse response
    const parsed = this.parseResponse(response);

    // 5. Post-process (download binaries, etc.)
    const result = await this.postProcess(parsed, context);

    // 6. Cache result
    await this.cacheResult(result, context, itemIndex);

    return result;
  }
}

// Concrete implementations
export class ModelScopeStrategy extends BasePlatformStrategy { /* ... */ }
export class NanoBananaStrategy extends BasePlatformStrategy { /* ... */ }
export class SoraStrategy extends BasePlatformStrategy { /* ... */ }
export class VeoStrategy extends BasePlatformStrategy { /* ... */ }
```

**预期影响**: 减少 ~200 行，提高可测试性

---

### 阶段 4: 类型安全改进（优先级：🟡 中）

#### 4.1 创建严格的类型定义

**新文件**: `nodes/types/platforms.ts`

```typescript
/**
 * Platform-specific type definitions
 */

// Common interfaces
export interface BasePlatformParams {
  prompt: string;
  model: string;
  seed?: number;
}

export interface ImageGenerationParams extends BasePlatformParams {
  size?: string;
  numImages?: number;
}

export interface VideoGenerationParams extends BasePlatformParams {
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
}

// ModelScope
export interface ModelScopeParams extends ImageGenerationParams {
  operation: 'modelscope';
  mode: 'text-to-image' | 'image-to-image';
  inputImages?: string[];
}

// Doubao
export interface DoubaoParams extends ImageGenerationParams {
  operation: 'doubao';
  mode: 'text-to-image' | 'image-to-image';
  resolutionLevel?: '2K' | '4K';
}

// Sora
export interface SoraParams extends VideoGenerationParams {
  operation: 'sora';
  model: 'sora-2' | 'sora-2-pro';
  hd?: boolean;
  inputImage?: string;
}

// Veo
export interface VeoParams extends VideoGenerationParams {
  operation: 'veo';
  inputImage?: string;
}

// Union type
export type PlatformParams =
  | ModelScopeParams
  | DoubaoParams
  | SoraParams
  | VeoParams;
```

**预期影响**: 提高类型安全，减少运行时错误

---

#### 4.2 移除所有 `any` 类型

**当前**: 8 处 `any` 类型警告

**目标**: 0 处

**行动计划**:
1. `nodes/utils/binaryData.ts` - 2 处
2. `nodes/utils/httpRequest.ts` - 4 处
3. `nodes/utils/polling.ts` - 1 处
4. 添加严格的类型定义

---

### 阶段 5: 性能优化（优先级：🟢 低）

#### 5.1 优化缓存键生成

**当前问题**:
- 每次生成缓存键时都进行 JSON.stringify
- 没有缓存键的缓存

**优化方案**:

```typescript
export class CacheKeyOptimizer {
  private static keyCache = new Map<string, string>();

  static forGeneration(
    apiFormat: string,
    model: string,
    prompt: string,
    params: Record<string, unknown>
  ): string {
    const cacheKey = `${apiFormat}:${model}:${prompt}:${JSON.stringify(params)}`;

    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    const hash = this.hashKey(cacheKey);
    this.keyCache.set(cacheKey, hash);
    return hash;
  }
}
```

---

#### 5.2 添加请求批处理

对于批量请求，考虑并行处理：

```typescript
export class BatchProcessor {
  static async processItems(
    items: INodeExecutionData[],
    executor: MediaGenExecutor,
    concurrency: number = 3
  ): Promise<INodeExecutionData[]> {
    const chunks = this.chunk(items, concurrency);
    const results: INodeExecutionData[] = [];

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((item, i) => executor.processItem(item, i))
      );
      results.push(...chunkResults);
    }

    return results;
  }
}
```

---

### 阶段 6: 测试改进（优先级：🟡 中）

#### 6.1 添加单元测试

**目标测试覆盖率**: 80%+

**需要测试的模块**:
- `utils/imageDownloader.ts` - 100%
- `utils/responseHandler.ts` - 100%
- `platforms/requestBuilders.ts` - 90%
- `platforms/responseParsers.ts` - 90%
- `platforms/strategies.ts` - 80%

---

#### 6.2 添加集成测试

**新文件**: `nodes/__tests__/integration/platforms.test.ts`

```typescript
describe('Platform Integration Tests', () => {
  describe('ModelScope', () => {
    it('should generate image successfully', async () => {
      // Test with mock API
    });

    it('should handle errors gracefully', async () => {
      // Test error scenarios
    });
  });

  // Similar tests for other platforms
});
```

---

## 📁 新文件结构

```
nodes/
├── AIMediaGen.ts                    # 主节点 (减少到 ~1800 行)
├── base/
│   └── BaseMediaGenNode.ts          # 基类
├── platforms/
│   ├── requestBuilders.ts           # 请求构建器
│   ├── responseParsers.ts           # 响应解析器
│   ├── strategies.ts                # 策略模式实现
│   └── platformExecutor.ts          # 平台执行器
├── utils/
│   ├── cache.ts
│   ├── monitoring.ts
│   ├── errors.ts
│   ├── errorHandling.ts
│   ├── responseHandler.ts           # 增强
│   ├── imageDownloader.ts           # 新增
│   ├── httpRequest.ts               # 增强
│   ├── polling.ts
│   ├── paramValidation.ts
│   ├── binaryData.ts
│   ├── constants.ts
│   ├── helpers.ts
│   ├── types.ts
│   ├── mediaGenExecutor.ts          # 新增
│   └── index.ts
├── credentials/
│   └── modelScopeApi.credentials.ts
└── types/
    └── platforms.ts                 # 新增
```

---

## 🗂️ 文件迁移计划

### 删除的文件
- 无（所有现有文件保留）

### 新增的文件
1. `nodes/utils/imageDownloader.ts` (~150 行)
2. `nodes/platforms/requestBuilders.ts` (~200 行)
3. `nodes/platforms/responseParsers.ts` (~150 行)
4. `nodes/platforms/strategies.ts` (~400 行)
5. `nodes/platforms/platformExecutor.ts` (~150 行)
6. `nodes/utils/mediaGenExecutor.ts` (~200 行)
7. `nodes/types/platforms.ts` (~100 行)

**总计新增**: ~1350 行

**预计减少**: AIMediaGen.ts 从 3555 → 1800 (-1755 行)

**净变化**: -405 行 (-6.6%)

---

## ⏱️ 实施时间估算

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 1.1 | 创建图片下载模块 | 2-3 小时 |
| 1.2 | 增强 HTTP 请求封装 | 1-2 小时 |
| 1.3 | 增强响应处理模块 | 2-3 小时 |
| 2.1 | 提取请求构建逻辑 | 3-4 小时 |
| 2.2 | 提取响应解析逻辑 | 2-3 小时 |
| 2.3 | 创建通用执行模板 | 4-5 小时 |
| 3.1 | 重构 execute() 方法 | 3-4 小时 |
| 3.2 | 创建策略模式实现 | 5-6 小时 |
| 4.1 | 创建严格类型定义 | 2-3 小时 |
| 4.2 | 移除 any 类型 | 2-3 小时 |
| 5.1 | 优化缓存键生成 | 1-2 小时 |
| 5.2 | 添加请求批处理 | 2-3 小时 |
| 6.1 | 添加单元测试 | 6-8 小时 |
| 6.2 | 添加集成测试 | 4-5 小时 |
| **总计** | | **48-65 小时** |

---

## ✅ 验证清单

### 功能测试
- [ ] 所有平台（ModelScope, Nano Banana, Sora, Veo）正常工作
- [ ] 缓存功能正常
- [ ] 错误处理正确
- [ ] continueOnFail 正常工作
- [ ] 批量处理正常

### 代码质量
- [ ] `npm run type-check` - 无错误
- [ ] `npm run lint` - 无错误（允许 any 警告减少到 0）
- [ ] `npm test` - 所有测试通过
- [ ] 测试覆盖率 > 80%

### 性能测试
- [ ] 单个请求性能不降低
- [ ] 批量请求性能提升
- [ ] 内存使用不增加

### n8n 规范
- [ ] 节点正确加载
- [ ] 凭证正确配置
- [ ] UI 正常显示

---

## 🎯 成功指标

### 定量指标
| 指标 | 当前 | 目标 | 验证方法 |
|------|------|------|----------|
| AIMediaGen.ts 行数 | 3555 | 1800-2000 | `wc -l` |
| 代码重复率 | 60-70% | 20-30% | 代码审查 |
| any 类型数量 | 8 | 0 | ESLint |
| 测试覆盖率 | ~30% | >80% | Jest coverage |
| 构建时间 | ~1.3s | <2s | `npm run build` |

### 定性指标
- ✅ 更容易添加新平台
- ✅ 更容易测试单个组件
- ✅ 更容易维护和调试
- ✅ 更好的类型安全
- ✅ 更清晰的代码结构

---

## 🔄 实施建议

### 渐进式重构策略
1. **每次只重构一个平台的方法**
2. **每完成一个阶段就运行完整测试**
3. **使用 Git 分支，每个阶段一个 commit**
4. **保留原有代码作为参考，直到完全验证**

### 风险缓解
1. **为现有代码添加更多测试**（在重构前）
2. **使用特性开关**（可以在新旧实现间切换）
3. **并行开发**（新代码与旧代码共存）
4. **逐步迁移**（一次迁移一个平台）

### 回滚计划
- 每个 commit 都应该是可独立工作的
- 保留旧代码直到新代码完全验证
- Git 标签每个稳定版本

---

## 📝 后续优化方向

完成本次优化后，可以考虑：

1. **插件化架构** - 允许第三方添加平台
2. **配置文件驱动** - 从 JSON/YAML 加载平台配置
3. **WebSocket 支持** - 实时任务状态更新
4. **本地模型支持** - 支持本地运行的模型
5. **批量优化** - 并行处理多个请求
6. **结果缓存策略** - LRU、TTL、持久化缓存

---

**创建日期**: 2025-02-01
**版本**: 1.0
**预计完成**: 2025-02-15 (2周)
