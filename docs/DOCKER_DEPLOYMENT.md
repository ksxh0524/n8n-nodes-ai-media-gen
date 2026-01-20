# Docker 部署文档

## 概述

本文档介绍如何将 `n8n-nodes-ai-media-gen` 自定义节点部署到 Docker 环境中的 n8n。

## 前置要求

- Docker 已安装并运行
- n8n 已通过 Docker 部署
- 对项目目录有读写权限

## 部署步骤

### 1. 准备部署目录

在宿主机上创建自定义节点目录：

```bash
mkdir -p /Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-custom-nodes
```

### 2. 复制节点文件

将编译好的节点文件复制到部署目录：

```bash
cd /Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-nodes-ai-media-gen

# 复制节点文件
cp -r nodes /Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-custom-nodes/

# 复制凭证文件
cp -r credentials /Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-custom-nodes/

# 复制配置文件
cp -r config /Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-custom-nodes/

# 复制工具类
cp -r utils /Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-custom-nodes/
```

### 3. 配置 Docker Compose

使用提供的 `docker-compose.yml` 文件：

```yaml
version: '3.8'

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=your_password
    volumes:
      - n8n_data:/home/node/.n8n
      - /Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-custom-nodes:/home/node/.n8n/custom

volumes:
  n8n_data:
```

#### 配置说明

- **端口映射**：将容器内的 5678 端口映射到宿主机的 5678 端口
- **数据卷**：
  - `n8n_data`：n8n 数据持久化
  - `/Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-custom-nodes`：自定义节点目录挂载到 `/home/node/.n8n/custom`
- **环境变量**：
  - `N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true`：强制设置文件权限
  - `N8N_BASIC_AUTH_ACTIVE=true`：启用基础认证
  - `N8N_BASIC_AUTH_USER=admin`：用户名
  - `N8N_BASIC_AUTH_PASSWORD=your_password`：密码（请修改为实际密码）

### 4. 重启 n8n 服务

```bash
# 停止现有服务
docker compose down

# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f n8n
```

### 5. 验证节点部署

1. 打开浏览器访问 n8n：`http://localhost:5678`
2. 使用配置的用户名和密码登录
3. 创建新工作流
4. 在节点面板中搜索以下节点：
   - **Nano Banana**
   - **Sora**
   - **Z-Image**
   - **Qwen**
   - **Doubao**
5. 确认可以看到所有自定义节点
6. 测试节点功能

## 支持的节点

### Nano Banana

- **功能**：图片生成
- **凭证**：NanoBanana API Key
- **预设模型**：
  - Nano Banana
  - Nano Banana Pro
- **文档**：[NanoBanana.md](./docs/NanoBanana.md)

### Sora

- **功能**：视频生成
- **凭证**：OpenAI API Key
- **预设模型**：
  - Sora 2
  - Sors 2 Pro
  - Veo 3.1
- **文档**：[Sora.md](./docs/Sora.md)

### Z-Image

- **功能**：图片生成
- **凭证**：OpenAI API Key
- **预设模型**：
  - Z-Image Turbo
- **文档**：[ZImage.md](./docs/ZImage.md)

### Qwen

- **功能**：图片生成、图片编辑、视频生成
- **凭证**：Qwen API Key
- **预设模型**：
  - Qwen Image
  - Qwen Image Edit
  - Image Generate
  - Video Generate
- **文档**：[Qwen.md](./docs/Qwen.md)

### Doubao

- **功能**：图片生成、视频生成
- **凭证**：Qwen API Key
- **预设模型**：
  - Image Generate
  - Video Generate
- **文档**：[Doubao.md](./docs/Doubao.md)

## 常见问题排查

### 节点未显示

**可能原因**：
1. 文件复制不完整
2. Docker 容器未正确重启
3. 配置文件路径错误

**解决方案**：
```bash
# 检查文件结构
ls -la /Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-custom-nodes/

# 应该看到以下结构：
# nodes/
#   NanoBanana.node.ts
#   Sora.node.ts
#   ZImage.node.ts
#   Qwen.node.ts
#   Doubao.node.ts
# credentials/
#   NanoBanana.credentials.ts
#   OpenAI.credentials.ts
#   Qwen.credentials.ts
# config/
#   models.json

# 重启容器
docker compose restart n8n

# 查看日志
docker compose logs -f n8n
```

### 凭证错误

**可能原因**：
1. API Key 配置错误
2. 凭证类型不匹配

**解决方案**：
1. 检查节点使用的凭证类型
2. 确认 API Key 正确
3. 在 n8n 中重新配置凭证

### 配置文件错误

**可能原因**：
1. `config/models.json` 文件格式错误
2. 文件路径不正确

**解决方案**：
```bash
# 验证配置文件格式
cat /Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-custom-nodes/config/models.json

# 如果格式错误，会显示 JSON 解析错误
```

## 更新节点

当需要更新节点时：

1. 修改节点源代码
2. 重新编译（如果需要）
3. 复制新文件到部署目录
4. 重启 n8n 服务

```bash
# 1. 修改代码后重新编译
npm run build

# 2. 复制新文件
cp -r dist/nodes/* /Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-custom-nodes/nodes/

# 3. 重启服务
docker compose restart n8n
```

## 添加自定义模型

用户可以在节点界面中直接添加自定义模型：

1. 在节点中选择 "Custom Model" 选项
2. 在 "Custom Model" 输入框中填写模型名称
3. 在 "Add to Config" 输入框中填写要添加的模型名称
4. 运行工作流
5. 模型会自动添加到 `config/models.json` 文件

## 注意事项

1. **API Key 安全**：请妥善保管 API Key，不要提交到版本控制系统
2. **文件权限**：确保 n8n 容器有权限访问挂载的目录
3. **网络连接**：确保 Docker 容器可以访问外部 API
4. **数据备份**：定期备份 `config/models.json` 文件
5. **日志监控**：定期查看 n8n 日志，及时发现错误

## 技术支持

如遇到问题，请：
1. 查看节点文档：`docs/` 目录下的详细文档
2. 查看日志：`docker compose logs -f n8n`
3. 检查配置文件：`config/models.json`
