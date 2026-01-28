# n8n-nodes-ai-media-gen 安装部署指南

## 概述

这是一个 n8n 自定义节点，用于通过 ModelScope API 生成 AI 图片。节点采用 Resource/Action 架构，便于扩展其他 AI 提供商和媒体类型。

## 前置要求

- Node.js >= 18.0.0
- n8n Docker 部署
- ModelScope API Key

## 目录结构

```
n8n-nodes-ai-media-gen/
├── nodes/
│   ├── AIMediaGen.node.ts       # 主节点实现
│   ├── credentials/              # 凭证定义
│   │   ├── index.ts
│   │   └── modelScopeApi.credentials.ts
│   └── utils/                    # 工具函数
│       ├── cache.ts
│       ├── constants.ts
│       ├── monitoring.ts
│       └── types.ts
├── dist/                         # 编译输出目录
├── package.json
├── tsconfig.json
└── gulpfile.js                   # 构建脚本
```

## 开发环境构建

### 1. 安装依赖

```bash
cd n8n-nodes-ai-media-gen
npm install
```

### 2. 构建项目

```bash
npm run build
```

这将：
- 清理 `dist/` 目录
- 编译 TypeScript 代码到 `dist/`
- 生成 source maps

### 3. 本地测试

在开发过程中，可以使用 watch 模式：

```bash
npm run dev
```

## Docker 部署（推荐）

### 方案一：Volume 挂载（开发测试）

#### 修改 docker-compose.yml

在您的 n8n `docker-compose.yml` 中添加 volume 挂载：

```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    volumes:
      - n8n_data:/home/node/.n8n
      - ./n8n_files:/files
      # 挂载自定义节点的 dist 目录
      - ./projets/n8n-service/custom-nodes/n8n-nodes-ai-media-gen/dist:/home/node/.n8n/custom/n8n-nodes-ai-media-gen:ro

  n8n-worker:
    image: n8nio/n8n:latest
    command: worker
    volumes:
      - ./n8n_files:/files
      # Worker 也需要挂载相同路径
      - ./projets/n8n-service/custom-nodes/n8n-nodes-ai-media-gen/dist:/home/node/.n8n/custom/n8n-nodes-ai-media-gen:ro
```

#### 在容器内安装节点

```bash
# 进入容器
docker exec -it n8n sh

# 安装节点
cd ~/.n8n/nodes
npm install /home/node/.n8n/custom/n8n-nodes-ai-media-gen

# 退出容器
exit
```

#### 重启容器

```bash
docker-compose restart n8n n8n-worker
```

### 方案二：自定义 Docker 镜像（生产环境）

#### 1. 创建 Dockerfile

在项目根目录创建 `Dockerfile.custom`：

```dockerfile
FROM n8nio/n8n:latest

USER node
WORKDIR /home/node

# 复制编译后的节点到自定义目录
COPY dist /home/node/.n8n/custom/n8n-nodes-ai-media-gen

# 安装节点
RUN cd /home/node/.n8n/nodes && \
    npm install /home/node/.n8n/custom/n8n-nodes-ai-media-gen && \
    rm -rf /home/node/.n8n/custom
```

#### 2. 构建镜像

```bash
docker build -f Dockerfile.custom -t my-n8n-custom:latest .
```

#### 3. 修改 docker-compose.yml 使用自定义镜像

```yaml
services:
  n8n:
    image: my-n8n-custom:latest
    # ... 其他配置

  n8n-worker:
    image: my-n8n-custom:latest
    command: worker
    # ... 其他配置
```

#### 4. 启动

```bash
docker-compose up -d
```

## 发布为 npm 包（可选）

### 1. 准备发布

确保 `package.json` 包含正确的信息：

```json
{
  "name": "n8n-nodes-ai-media-gen",
  "version": "1.0.0",
  "main": "index.js",
  "types": "index.d.ts",
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": ["modelScopeApi"],
    "nodes": [...]
  }
}
```

### 2. 构建并发布

```bash
# 构建
npm run build

# 复制 package.json 到 dist
cp package.json dist/

# 发布（需要 npm 账号）
cd dist && npm publish
```

### 3. 在 n8n 中安装

```bash
docker exec -it n8n sh
cd ~/.n8n/nodes
npm install n8n-nodes-ai-media-gen
exit
docker-compose restart n8n n8n-worker
```

## 验证安装

### 1. 检查节点是否加载

在 n8n 编辑器中：
1. 点击 "Add step" 或 "+" 按钮
2. 搜索 "AI Media Generation"
3. 应该能看到该节点

### 2. 验证节点配置

添加节点后，应该看到：
- **Resource**: ModelScope
- **Action**: Generate Image
- **Model**: Z-Image 或 Qwen-Image-2512

### 3. 配置凭证

1. 点击 "Credential to connect with"
2. 选择 "Create New credential"
3. 输入 ModelScope API Key
4. （可选）自定义 Base URL

## 常见问题

### Q1: 节点在 n8n 中不显示

**解决方案**：
1. 确认节点已正确安装到 `~/.n8n/nodes/node_modules/`
2. 检查 `package.json` 中的 `n8n` 配置是否正确
3. 重启 n8n 容器
4. 清除浏览器缓存

### Q2: 构建失败

**解决方案**：
1. 删除 `node_modules/` 和 `dist/` 目录
2. 重新运行 `npm install`
3. 确认 Node.js 版本 >= 18.0.0

### Q3: 容器内找不到 package.json

**解决方案**：
构建后需要复制 `package.json` 到 `dist/` 目录：
```bash
npm run build && cp package.json dist/
```

### Q4: Worker 容器也需要挂载

**重要**：如果使用 queue 模式，Worker 容器也必须挂载相同的自定义节点目录，否则执行工作流时会报错。

## 开发指南

### 添加新的 Action

1. 在 `AIMediaGen.node.ts` 的 `properties` 中添加新的 action 选项：

```typescript
{
  displayName: 'Action',
  name: 'action',
  type: 'options',
  options: [
    { name: 'Generate Image', value: 'generateImage' },
    { name: 'Your New Action', value: 'yourNewAction' },
  ],
  default: 'generateImage',
}
```

2. 在 `execute` 方法中添加处理逻辑

3. 重新构建并部署

### 添加新的 Resource

1. 添加 resource 选项
2. 创建对应的凭证类型
3. 实现 API 调用逻辑
4. 更新 documentationUrl

## 项目维护

### 更新依赖

```bash
npm update
npm audit fix
```

### 代码检查

```bash
# Lint
npm run lint

# 自动修复
npm run lint:fix

# 格式化
npm run format
```

### 运行测试

```bash
npm test
```

## 许可证

MIT

## 联系方式

- GitHub Issues: https://github.com/n8n-nodes-ai-media-gen/issues
