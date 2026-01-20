# Sora 节点

## 简介

Sora 节点用于生成 AI 视频，使用 OpenAI Sora API。

## 配置

### 凭证配置

- **API Key**: OpenAI API 密钥（必填）

### 节点参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|---------|------|
| Model | options | 是 | sora-2 | 选择预设模型或自定义模型 |
| Custom Model | string | 否 | - | 自定义模型名称（当 Model 选择 custom 时） |
| Add to Config | string | 否 | - | 添加新模型到配置文件（可选） |
| Prompt | string | 是 | - | 文本提示词 |
| Additional Parameters (JSON) | string | 否 | {} | 额外参数（JSON 格式） |
| Max Retries | number | 否 | 3 | 最大重试次数 |
| Timeout (ms) | number | 否 | 60000 | 请求超时时间（毫秒） |

## 预设模型

- **Sora 2**: `sora-2`
- **Sors 2 Pro**: `sors-2-pro`
- **Veo 3.1**: `veo-3.1`

## 使用示例

### 基础视频生成

```json
{
  "model": "sora-2",
  "prompt": "A drone flying over a tropical island",
  "additionalParams": "{\"duration\": 10, \"aspect_ratio\": \"16:9\"}"
}
```

### 自定义模型

```json
{
  "model": "custom",
  "customModel": "sora-3",
  "prompt": "A cinematic shot of a person walking through a city",
  "additionalParams": "{\"fps\": 24, \"resolution\": \"4k\"}"
}
```

### 添加新模型到配置

```json
{
  "model": "custom",
  "customModel": "sora-4",
  "addToConfig": "sora-4",
  "prompt": "Generate a video",
  "additionalParams": "{}"
}
```

## 输出格式

成功响应：

```json
{
  "success": true,
  "url": "https://example.com/generated/video.mp4",
  "data": { ... },
  "metadata": {
    "provider": "Sora",
    "model": "sora-2",
    "mediaType": "video",
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
    "provider": "Sora",
    "model": "sora-2",
    "timestamp": "2024-01-20T00:00:00.000Z"
  }
}
```

## 注意事项

1. **API Key 安全**：请妥善保管您的 API Key
2. **参数格式**：Additional Parameters 必须是有效的 JSON 格式
3. **超时设置**：视频生成通常需要较长时间，建议设置 60-120 秒
4. **模型名称**：使用自定义模型时，请确保模型名称正确
5. **配置文件**：添加的模型会保存到 `config/models.json`，方便下次使用
6. **视频格式**：生成的视频通常是 MP4 格式
