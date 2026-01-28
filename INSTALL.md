# n8n-nodes-ai-media-gen 安装指南

## 项目概述

n8n-nodes-ai-media-gen 是一个 n8n 自定义节点，用于 AI 媒体生成，支持通过 ModelScope API 进行图像生成和编辑。

**支持的功能：**
- Z-Image：高质量文本到图像生成
- Qwen-Image-2512：高级文本到图像生成
- Qwen-Image-Edit-2511：图像编辑模型

## 前置条件

- 已部署 n8n（Docker 或本地安装）
- n8n 版本 >= 2.0.0
- ModelScope API Key（用于节点配置）

## 安装步骤

### 方法一：Docker Compose 部署（推荐）

#### 1. 准备节点文件

确保节点项目已编译：

```bash
cd projets/n8n-service/custom-nodes/n8n-nodes-ai-media-gen
npm run build
```

编译后的文件位于 `dist/` 目录。

#### 2. 配置 docker-compose.yml

在 n8n 服务的 `docker-compose.yml` 中添加以下配置：

```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    environment:
      # 添加自定义节点目录环境变量
      - N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom
    volumes:
      # 挂载节点目录（读写模式）
      - ./projets/n8n-service/custom-nodes/n8n-nodes-ai-media-gen/dist:/home/node/.n8n/custom/n8n-nodes-ai-media-gen:rw

  n8n-worker:
    environment:
      # Worker 也需要相同的环境变量
      - N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom
    volumes:
      # Worker 也需要挂载节点目录
      - ./projets/n8n-service/custom-nodes/n8n-nodes-ai-media-gen/dist:/home/node/.n8n/custom/n8n-nodes-ai-media-gen:rw
```

**重要说明：**
- 挂载使用 `:rw`（读写模式），不要使用 `:ro`（只读模式）
- 主节点和 worker 都需要配置相同的挂载和环境变量

#### 3. 重启容器

```bash
docker-compose down
docker-compose up -d
```

#### 4. 安装节点依赖

进入容器并安装依赖：

```bash
docker exec -it n8n sh
cd /home/node/.n8n/nodes
npm install
exit
```

或者直接执行：

```bash
docker exec n8n sh -c "cd /home/node/.n8n/nodes && npm install"
```

### 方法二：通过 n8n 界面安装（最简单）

#### 1. 登录 n8n

访问 n8n 界面：
```
https://your-n8n-domain.com
```

#### 2. 进入社区节点设置

- 点击右上角设置图标（⚙️）
- 选择 "Community Nodes"（社区节点）

#### 3. 安装节点

在搜索框中输入：
```
n8n-nodes-ai-media-gen
```

或者直接粘贴 GitHub 仓库 URL：
```
https://github.com/your-username/n8n-nodes-ai-media-gen
```

点击 "Install" 并等待安装完成。

## 验证安装

### 1. 检查容器日志

```bash
docker logs n8n | grep -i "ai-media-gen"
```

### 2. 检查节点文件

```bash
docker exec n8n ls -la /home/node/.n8n/custom/n8n-nodes-ai-media-gen/
```

应该看到以下文件：
- `package.json`
- `index.js`
- `nodes/AIMediaGen.js`
- `nodes/credentials/modelScopeApi.credentials.js`

### 3. 在 n8n 界面中验证

1. 创建新工作流
2. 在节点面板中搜索 "AI Media Generation" 或 "AIMediaGen"
3. 如果找到节点，说明安装成功

## 配置节点

### 1. 添加凭证

1. 在工作流中添加 "AI Media Generation" 节点
2. 点击 "Credentials" 下拉菜单
3. 选择 "Create New Credential"
4. 填写 ModelScope API Key：
   - Name: 任意名称（如 "ModelScope API"）
   - API Key: 你的 ModelScope API Key

### 2. 配置节点参数

- **Model**: 选择模型（Z-Image、Qwen-Image-2512、Qwen-Image-Edit-2511）
- **Prompt**: 输入提示词
- **Size**: 图像尺寸（可选）
- **Seed**: 随机种子（可选）
- **Input Image**: 编辑模式下的输入图像（可选）
- **Timeout**: 请求超时时间（默认 30000ms）

## 常见问题

### 问题 1: 节点没有出现在节点列表中

**原因：**
- 节点文件未正确挂载
- 依赖未安装
- n8n 未重启

**解决方案：**
```bash
# 检查文件是否存在
docker exec n8n test -f /home/node/.n8n/custom/n8n-nodes-ai-media-gen/nodes/AIMediaGen.js

# 安装依赖
docker exec n8n sh -c "cd /home/node/.n8n/nodes && npm install"

# 重启容器
docker-compose restart n8n
```

### 问题 2: 权限错误 `EACCES: permission denied`

**原因：**
- 挂载使用了 `:ro`（只读模式）
- 容器内文件权限不正确

**解决方案：**
```yaml
# 修改 docker-compose.yml 中的挂载为读写模式
volumes:
  - ./path/to/nodes:/home/node/.n8n/custom/n8n-nodes-ai-media-gen:rw
```

### 问题 3: Worker 崩溃

**原因：**
- Worker 没有配置相同的环境变量和挂载

**解决方案：**
确保 `docker-compose.yml` 中 n8n-worker 服务也配置了：
```yaml
n8n-worker:
  environment:
    - N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom
  volumes:
    - ./path/to/nodes:/home/node/.n8n/custom/n8n-nodes-ai-media-gen:rw
```

### 问题 4: 节点执行失败

**原因：**
- API Key 无效
- 网络连接问题
- API 限流

**解决方案：**
1. 检查 API Key 是否正确
2. 检查网络连接
3. 增加重试次数或调整超时时间

## 目录结构

正确的节点目录结构：

```
n8n-nodes-ai-media-gen/
├── package.json              # 包配置文件
├── index.js                 # 主入口文件
├── index.d.ts               # TypeScript 类型定义
├── nodes/                   # 节点目录
│   ├── AIMediaGen.js       # 主节点文件
│   ├── AIMediaGen.d.ts     # 节点类型定义
│   └── credentials/         # 凭证目录
│       └── modelScopeApi.credentials.js
└── utils/                   # 工具函数
    ├── cache.js
    ├── monitoring.js
    ├── errors.js
    └── validators.js
```

## package.json 配置要点

确保 `package.json` 包含以下配置：

```json
{
  "name": "n8n-nodes-ai-media-gen",
  "version": "1.0.0",
  "main": "index.js",
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [
      "nodes/credentials/modelScopeApi.credentials.js"
    ],
    "nodes": [
      "nodes/AIMediaGen.js"
    ]
  },
  "dependencies": {
    "n8n-workflow": "^1.0.0"
  }
}
```

**注意：**
- 不要包含 `"files": ["dist"]` 配置（会导致问题）
- 节点路径不要包含 `dist/` 前缀
- 确保所有路径相对于 `package.json` 的位置

## 更新节点

当节点代码更新后：

1. 重新编译节点：
```bash
cd projets/n8n-service/custom-nodes/n8n-nodes-ai-media-gen
npm run build
```

2. 重启 n8n 容器：
```bash
docker-compose restart n8n n8n-worker
```

3. 清除浏览器缓存并刷新 n8n 界面

## 技术支持

如遇到问题，请检查：

1. n8n 日志：`docker logs n8n`
2. Worker 日志：`docker logs n8n_worker`
3. 数据库节点表：
```bash
docker exec n8n_postgres psql -U n8n -d n8n -c "SELECT * FROM installed_nodes;"
```

## 参考资源

- n8n 官方文档：https://docs.n8n.io/
- n8n 社区节点开发：https://docs.n8n.io/integrations/community-nodes/
- ModelScope API 文档：https://modelscope.cn/docs

---

**最后更新：** 2026-01-29
**维护者：** n8n-nodes-ai-media-gen 团队