# 开发指南

中文开发指南

## 目录

1. [快速开始](#快速开始)
2. [项目结构](#项目结构)
3. [开发环境设置](#开发环境设置)
4. [添加新的模型](#添加新的模型)
5. [测试](#测试)
6. [构建和部署](#构建和部署)

## 快速开始

### 安装依赖

```bash
cd n8n-nodes-ai-media-gen
npm install
```

### 开发模式

```bash
npm run dev
```

这将监视文件变化并自动重新编译。

### 构建项目

```bash
npm run build
```

## 项目结构

```
n8n-nodes-ai-media-gen/
├── nodes/                  # 源代码目录
│   ├── types/             # 类型定义
│   ├── core/              # 核心框架
│   │   ├── interfaces/    # 接口定义
│   │   ├── base/          # 基类
│   │   ├── factories/     # 工厂类
│   │   ├── registries/    # 注册表
│   │   ├── utils/         # 工具类
│   │   ├── cache/         # 缓存系统
│   │   ├── async/         # 异步任务
│   │   └── batch/         # 批处理
│   ├── providers/         # 提供商实现
│   │   ├── openai/        # OpenAI
│   │   ├── stability/     # Stability AI
│   │   ├── elevenlabs/    # ElevenLabs
│   │   └── example/       # 示例
│   ├── nodes/             # n8n 节点
│   ├── config/            # 配置文件
│   └── errors/            # 错误处理
├── docs/                  # 文档
├── dist/                  # 编译输出
└── test/                  # 测试文件
```

## 开发环境设置

### 前置要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- TypeScript 5.7+

### 推荐工具

- VSCode
- ESLint 扩展
- Prettier 扩展

### VSCode 配置

创建 `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ]
}
```

## 添加新的模型

### 步骤 1: 创建模型类

```typescript
// providers/myprovider/models/MyModel.ts
import { BaseModel } from '../../../core/base/BaseModel';
import { IProvider } from '../../../core/interfaces/IProvider';

export class MyModel extends BaseModel {
  readonly id = 'my-model';
  readonly displayName = '我的模型';
  readonly type = 'image';

  readonly parameters = [
    {
      name: 'prompt',
      displayName: '提示词',
      type: 'string',
      required: true,
    },
  ];

  constructor(provider: IProvider) {
    super(provider);
  }

  async execute(params) {
    // 实现生成逻辑
    const response = await this.getProvider().request('/generate', {
      method: 'POST',
      body: { prompt: params.prompt },
    });

    return {
      success: true,
      url: response.url,
      mimeType: 'image/png',
    };
  }
}
```

### 步骤 2: 在 Provider 中注册

```typescript
// providers/myprovider/MyProvider.ts
import { MyModel } from './models/MyModel';

export class MyProvider extends BaseProvider {
  constructor() {
    super(config);
    this.registerModel(new MyModel(this));
  }
}
```

### 步骤 3: 添加配置

```typescript
// config/models.config.ts
export const MODELS_CONFIG = {
  'myprovider.my-model': {
    id: 'my-model',
    displayName: '我的模型',
    type: 'image',
    provider: 'myprovider',
    capabilities: {
      supportsBatch: true,
      supportsAsync: false,
    },
  },
};
```

### 步骤 4: 测试

```bash
npm test -- MyModel.test.ts
```

## 测试

### 运行所有测试

```bash
npm test
```

### 运行特定测试

```bash
npm test -- ValidationHelper
```

### 测试覆盖率

```bash
npm test -- --coverage
```

### 编写测试

```typescript
describe('MyModel', () => {
  test('应该成功生成图像', async () => {
    const result = await model.execute({ prompt: '测试' });
    expect(result.success).toBe(true);
  });
});
```

## 构建和部署

### 本地构建

```bash
npm run build
```

### 开发构建（带 source maps）

```bash
npm run build:dev
```

### 生产构建

```bash
npm run build
npm run lint
npm test
```

### 部署到 n8n

1. 复制到 n8n 自定义节点目录：
   ```bash
   cp -r dist/* ~/.n8n/custom/n8n-nodes-ai-media-gen/
   ```

2. 重启 n8n

3. 在 n8n 中验证节点可用

### Docker 部署

```dockerfile
FROM n8nio/n8n

COPY n8n-nodes-ai-media-gen /data/custom/n8n-nodes-ai-media-gen

WORKDIR /data/custom/n8n-nodes-ai-media-gen
RUN npm install && npm run build
```

## 常见问题

### Q: 如何调试模型？

在模型中添加日志：

```typescript
async execute(params) {
  console.log('执行模型，参数：', params);
  const result = await this.getProvider().request(...);
  console.log('结果：', result);
  return result;
}
```

### Q: 如何处理异步任务？

```typescript
async execute(params) {
  const taskId = await this.startGeneration(params);

  // 轮询状态
  while (true) {
    const status = await this.checkStatus(taskId);
    if (status === 'completed') {
      return await this.getResult(taskId);
    }
    await sleep(2000);
  }
}
```

### Q: 如何添加缓存？

```typescript
async execute(params) {
  const cacheKey = CacheKeyGenerator.forGeneration(this.id, params);

  // 检查缓存
  const cached = await cacheManager.get(cacheKey);
  if (cached) return cached;

  // 执行生成
  const result = await this.generate(params);

  // 保存到缓存
  await cacheManager.set(cacheKey, result, 3600);

  return result;
}
```

## 性能优化

### 1. 批处理

```typescript
const results = await batchProcessor.processBatch(
  items,
  (item) => model.execute(item),
  { concurrency: 3 }
);
```

### 2. 并发控制

```typescript
const semaphore = new Semaphore(3);
await semaphore.execute(async () => {
  return await model.execute(params);
});
```

### 3. 缓存策略

```typescript
// 启用缓存
cacheManager.setEnabled(true);

// 设置 TTL
cacheManager.setDefaultTTL(7200); // 2 小时
```

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交代码
4. 推送到分支
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 使用 Prettier 格式化
- 编写测试
- 更新文档

### Commit 消息格式

```
feat: 添加新的图像模型
fix: 修复参数验证问题
docs: 更新 README
test: 添加模型测试
refactor: 优化缓存逻辑
```

## 获取帮助

- 查看 `docs/` 目录
- 阅读代码注释
- 查看 GitHub Issues
- 提交新的 Issue
