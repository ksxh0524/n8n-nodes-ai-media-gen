# n8n-nodes-ai-media-gen 部署文档

## 部署状态

✅ **已成功部署到 Docker n8n**

- 节点路径：`/home/node/.n8n/custom/n8n-nodes-ai-media-gen`
- 挂载配置：已配置在 `/Users/liuyang/codes/n8n/docker-compose.yml`
- 构建状态：✅ 成功
- 容器状态：✅ 运行中

## 验证节点是否可用

### 方法 1：通过 n8n Web 界面

1. 访问：`https://n8n.wwrs01.top`
2. 登录后，创建新工作流
3. 添加节点，搜索 "AI Media Generation" 或 "aiMediaGen"
4. 如果找到该节点，说明部署成功

### 方法 2：通过 n8n API

```bash
# 获取所有节点列表
curl -X GET http://localhost:5678/rest/nodes \
  -H "Content-Type: application/json"

# 查找 AI Media Generation 节点
# 应该在返回的列表中看到 "aiMediaGen" 或 "AI Media Generation"
```

## 重新部署步骤

如果需要更新节点代码：

```bash
cd /Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-nodes-ai-media-gen

# 1. 构建项目
npm run build

# 2. 确保 package.json 在 dist 目录中（已自动创建）

# 3. 重启 n8n 容器
cd /Users/liuyang/codes/n8n
docker-compose restart n8n n8n-worker

# 4. 验证节点加载
docker-compose logs --tail=50 n8n | grep -i "package.json"
```

## 节点使用说明

### 1. 配置凭证

在 n8n 中：
1. 点击节点 → Credentials → Create New
2. 选择 "ModelScope API"
3. 输入：
   - API Key: 你的 ModelScope API 密钥
   - Base URL: (可选) 默认为 `https://api.modelscope.cn/v1`

### 2. 使用节点

#### 生成图片（Z-Image 模型）
```json
{
  "model": "Tongyi-MAI/Z-Image",
  "prompt": "A beautiful sunset over the ocean",
  "size": "1024x1024",
  "seed": 42,
  "numImages": 1
}
```

#### 编辑图片（Qwen-Image-Edit 模型）
```json
{
  "model": "Qwen-Image-Edit-2511",
  "prompt": "Add a rainbow to the sky",
  "inputImage": "https://example.com/image.jpg",
  "size": "1024x1024"
}
```

### 3. 输出格式

成功响应：
```json
{
  "success": true,
  "imageUrl": "https://modelscope.cn/api/v1/...",
  "model": "Tongyi-MAI/Z-Image",
  "_metadata": {
    "timestamp": "2025-01-29T06:00:00.000Z",
    "cached": false
  }
}
```

错误响应：
```json
{
  "success": false,
  "error": "Error message",
  "errorCode": "INVALID_API_KEY",
  "_metadata": {
    "timestamp": "2025-01-29T06:00:00.000Z"
  }
}
```

## 故障排除

### 问题 1: 节点不出现在列表中

**解决方案**：
```bash
# 1. 检查容器中的文件
docker exec n8n ls -la /home/node/.n8n/custom/n8n-nodes-ai-media-gen/

# 2. 检查 package.json 是否存在
docker exec n8n cat /home/node/.n8n/custom/n8n-nodes-ai-media-gen/package.json

# 3. 重启容器
docker-compose restart n8n n8n-worker

# 4. 检查日志
docker-compose logs --tail=100 n8n | grep -i "custom\|node"
```

### 问题 2: MODULE_NOT_FOUND 错误

**解决方案**：确保 package.json 使用 `peerDependencies` 而不是 `dependencies`

```json
{
  "peerDependencies": {
    "n8n-workflow": "*"
  }
}
```

### 问题 3: 节点执行失败

**检查项**：
- ✅ API Key 是否正确
- ✅ 网络连接是否正常
- ✅ 模型名称是否正确
- ✅ 参数是否符合模型要求

## 当前配置

### Docker Compose 挂载

```yaml
volumes:
  - ./projets/n8n-service/custom-nodes/n8n-nodes-ai-media-gen/dist:/home/node/.n8n/custom/n8n-nodes-ai-media-gen:ro
```

### 节点信息

- **名称**: AI Media Generation
- **类型**: `aiMediaGen`
- **版本**: 1.1.0
- **支持模型**:
  - Tongyi-MAI/Z-Image (图片生成)
  - Qwen-Image-2512 (图片生成)
  - Qwen-Image-Edit-2511 (图片编辑)

## 更新日志

### v1.1.0 (2025-01-29)
- ✅ 修复多 item 工作流参数访问 bug
- ✅ 修复错误代码保留问题
- ✅ 添加输入验证
- ✅ 移除未使用代码 (~54k 行)
- ✅ 添加全面测试覆盖
- ✅ 添加 JSDoc 文档

## 支持

- GitHub Issues: https://github.com/n8n-nodes-ai-media-gen/issues
- ModelScope API 文档: https://www.modelscope.cn/docs
