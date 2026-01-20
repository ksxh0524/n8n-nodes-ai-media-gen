# Doubao 节点

## 简介

Doubao 节点用于生成 AI 图片和视频，使用 Qwen API（阿里云百炼）。

## 配置

### 凭证配置

- **API Key**: Qwen API 密钥（必填）

### 节点参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|---------|------|
| Model | options | 是 | wanx-v1 | 选择预设模型或自定义模型 |
| Custom Model | string | 否 | - | 自定义模型名称（当 Model 选择 custom 时） |
| Add to Config | string | 否 | - | 添加新模型到配置文件（可选） |
| Prompt | string | 是 | - | 文本提示词 |
| Additional Parameters (JSON) | string | 否 | {} | 额外参数（JSON 格式） |
| Max Retries | number | 否 | 3 | 最大重试次数 |
| Timeout (ms) | number | 否 | 60000 | 请求超时时间（毫秒） |

## 预设模型

- **Image Generate**: `wanx-v1`（图片生成）
- **Video Generate**: `wanx-video-v1`（视频生成）

## 使用示例

### 图片生成

```json
{
  "model": "wanx-v1",
  "prompt": "A professional photo of a business meeting",
  "additionalParams": "{\"size\": \"1024x1024\", \"style\": \"realistic\"}"
}
```

### 视频生成

```json
{
  "model": "wanx-video-v1",
  "prompt": "A drone flying over a tropical island",
  "additionalParams": "{\"duration\": 10, \"fps\": 24}"
}
```

### 自定义模型

```json
{
  "model": "custom",
  "customModel": "my-custom-model-v3",
  "prompt": "Generate content",
  "additionalParams": "{\"steps\": 50, \"guidance_scale\": 7.5}"
}
```

### 添加新模型到配置

```json
{
  "model": "custom",
  "customModel": "my-new-model",
  "addToConfig": "my-new-model",
  "prompt": "Test the new model",
  "additionalParams": "{}"
}
```

## 输出格式

成功响应：

```json
{
  "success": true,
  "url": "https://example.com/generated/image.png",
  "data": { ... },
  "metadata": {
    "provider": "Doubao",
    "model": "wanx-v1",
    "mediaType": "image",
    "timestamp": "2024-01-20T00:00:00.000Z",
    "cached": false
  }
}
```

错误响应：

```json
{
  "success": false,
  "error": "API error message",
  "metadata": {
    "provider": "Doubao",
    "model": "wanx-v1",
    "timestamp": "2024-01-20T00:00:00.000Z"
  }
}
```

## 注意事项

1. **API Key 安全**：请妥善保管您的 API Key
2. **参数格式**：Additional Parameters 必须是有效的 JSON 格式
3. **超时设置**：根据网络情况调整超时时间
4. **模型名称**：使用自定义模型时，请确保模型名称正确
5. **配置文件**：添加的模型会保存到 `config/models.json`，方便下次使用
6. **图片格式**：生成的图片通常是 PNG 或 JPG 格式
7. **视频格式**：生成的视频通常是 MP4 格式
