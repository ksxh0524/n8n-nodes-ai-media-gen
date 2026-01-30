# n8n-nodes-ai-media-gen

<div align="center">

**A powerful and extensible n8n custom node for AI media generation**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![n8n Version](https://img.shields.io/badge/n8n-%3E%3D2.0.0-orange.svg)](https://n8n.io)

</div>

## 📋 Project Overview

**n8n-nodes-ai-media-gen** is an advanced AI media generation node designed for the n8n workflow automation platform. This node integrates image generation and editing capabilities from multiple leading AI platforms, providing a unified and simple interface that allows you to easily achieve in n8n workflows:

- 🎨 **Text-to-Image Generation**: Create high-quality images from simple text descriptions
- 🖼️ **Image Editing**: Intelligently edit and modify existing images with AI
- 🚀 **Batch Processing**: Automate image generation tasks in workflows
- 💾 **Smart Caching**: Reduce duplicate API calls and save costs
- 🔄 **Auto Retry**: Automatically retry on network failures for improved reliability

### Key Advantages

- ✅ **Multi-Platform Support**: Integrates ModelScope, Nano Banana, Sora, Doubao AI platforms
- ✅ **Production-Ready**: Comprehensive error handling, logging, and performance monitoring
- ✅ **Easy to Use**: Intuitive configuration interface, no programming required
- ✅ **Highly Configurable**: Supports custom parameters, timeouts, retries, and more
- ✅ **Type-Safe**: Complete TypeScript type definitions

---

## 🎯 Supported AI Platforms and Models

### 1. ModelScope

[ModelScope](https://modelscope.cn) is an open-source model community by Alibaba Cloud, providing powerful AI image generation capabilities.

#### Supported Models

| Model Name | Type | Supported Sizes | Features |
|------------|------|----------------|----------|
| **Tongyi-MAI/Z-Image** | Text-to-Image | 2048x2048, 2048x1152, 1152x2048, 2048x1536, 1536x2048, 1024x2048 | High-quality generation with multiple aspect ratios |
| **Qwen/Qwen-Image-2512** | Text-to-Image | 1328x1328, 1664x928, 928x1664, 1472x1104, 1104x1472, 1584x1056, 1056x1584 | Advanced generation with richer details |
| **Qwen/Qwen-Image-Edit-2511** | Image Editing | Auto maintain original size | Intelligent image editing and modification |

#### Get API Key

1. Visit [ModelScope Website](https://modelscope.cn)
2. Register and login to your account
3. Go to console and create API Key
4. Configure credentials in n8n

---

### 2. Nano Banana (Third-Party API) ⭐

**Nano Banana** is a third-party API service based on Google Gemini 2.5 Flash image generation model, providing fast and high-quality image generation capabilities.

> ⚠️ **Important Note**: Nano Banana is an API wrapper service provided by a third-party provider, not the official Google API. This service requires registration and payment through a third-party platform.

#### Why Choose Nano Banana?

- ⚡ **Ultra-Fast Speed**: Based on Gemini 2.5 Flash for lightning-fast generation
- 🎨 **High-Quality Output**: Supports 1K/2K/4K multiple resolutions
- 🖼️ **Flexible Aspect Ratios**: Supports 10 common aspect ratios
- 📸 **Image-to-Image**: Supports reference image-guided generation

#### Register Account

👉 **Sign Up**: [https://ai.comfly.chat/register?aff=296d6933380](https://ai.comfly.chat/register?aff=296d6933380)

#### Supported Models

| Model Name | Resolution Options | Aspect Ratios | Features |
|------------|-------------------|--------------|----------|
| **Nano Banana** | Fixed Resolution | 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 | Standard quality model |
| **Nano Banana 2** | 1K, 2K, 4K | Same as above | Second-generation model with higher quality and multi-resolution support |

#### Get API Key

1. Visit [Registration Page](https://ai.comfly.chat/register?aff=296d6933380)
2. Complete registration and top up
3. Get API Key from console
4. Configure Google PaLM API credentials in n8n

---

### 3. Sora (OpenAI Video Generation)

[Sora](https://openai.com/sora) is OpenAI's advanced text-to-video generation model, capable of creating high-quality videos from text descriptions.

> ⚠️ **Important Note**: Sora API access requires registration through a third-party API service provider.

#### Why Choose Sora?

- 🎬 **Professional Video Quality**: Generate high-resolution videos up to 1080p
- ⏱️ **Flexible Duration**: Support for 5s, 10s, 15s, 20s, and 25s videos
- 🎨 **Advanced AI**: Based on OpenAI's cutting-edge video generation technology
- 🖼️ **Image-to-Video**: Generate videos from reference images
- 🎵 **Audio Generation**: Optional synchronized audio generation

#### Register Account

👉 **Sign Up**: [https://ai.comfly.chat/register?aff=296d6933380](https://ai.comfly.chat/register?aff=296d6933380)

#### Supported Features

| Feature | Options | Description |
|---------|---------|-------------|
| **Duration** | 5s, 10s, 15s, 20s, 25s | Video length in seconds |
| **Resolution** | 480p, 720p, 1080p | Output video resolution |
| **Aspect Ratio** | 16:9, 9:16, 1:1, etc. | Multiple aspect ratios supported |
| **Mode** | Text-to-Video, Image-to-Video | Generation mode |

#### Get API Key

1. Visit [Registration Page](https://ai.comfly.chat/register?aff=296d6933380)
2. Complete registration and top up
3. Get API Key from console
4. Configure OpenAI API credentials in n8n

---

### 4. Doubao

[Doubao](https://www.volcengine.com/product/238) is an AI image generation model by ByteDance, providing high-quality image generation and editing capabilities.

#### Supported Models

| Model Name | Type | Resolution Support | Features |
|------------|------|-------------------|----------|
| **Doubao Seedream 4.5** | Text Generation/Image Editing | 2K, 4K | Latest model (2025-01-28) |
| **Doubao Seedream 4.0** | Text Generation/Image Editing | 2K, 4K | Previous generation model (2024-08-28) |

#### 2K Resolution Sizes

- 1:1 (2048x2048)
- 4:3 (2304x1728)
- 3:4 (1728x2304)
- 16:9 (2560x1440)
- 9:16 (1440x2560)
- 3:2 (2496x1664)
- 2:3 (1664x2496)
- 21:9 (3024x1296)

#### 4K Resolution Sizes

- 1:1 (4096x4096)
- 4:3 (4608x3456)
- 3:4 (3456x4608)
- 16:9 (5120x2880)
- 9:16 (2880x5120)
- 3:2 (4992x3328)
- 2:3 (3328x4992)
- 21:9 (6048x2592)

#### Get API Key

1. Visit [Volcengine Console](https://console.volcengine.com/ark)
2. Enable Doubao Image Generation service
3. Create API Key
4. Configure Doubao API credentials in n8n

---

## 🚀 Quick Start

### Prerequisites

- ✅ n8n installed (version >= 2.0.0)
- ✅ Node.js >= 18.0.0
- ✅ API Key for corresponding platform

### Install Node

#### Method 1: Install via n8n Interface (Recommended)

1. Login to n8n Web interface
2. Click **Settings Icon** → **Community Nodes**
3. Search `n8n-nodes-ai-media-gen`
4. Click **Install**

#### Method 2: Manual Installation

```bash
# Clone project
git clone https://github.com/your-username/n8n-nodes-ai-media-gen.git
cd n8n-nodes-ai-media-gen

# Install dependencies
npm install

# Build project
npm run build

# Copy dist directory to n8n custom nodes directory
# Docker: /home/node/.n8n/custom/
# Local: ~/.n8n/custom/
```

---

## 📖 Detailed Usage Guide

### Basic Configuration Steps

The usage flow is similar for all platforms:

1. **Add Node**: Add "AI Media Generation" node to workflow
2. **Select Operation**: Choose platform (ModelScope / Nano Banana / Doubao)
3. **Configure Credentials**: Create and select corresponding API credentials
4. **Set Parameters**: Configure generation parameters based on requirements
5. **Execute Workflow**: Run workflow to get generated images

---

### 🔧 ModelScope Usage Guide

#### Step 1: Configure Credentials

1. Click **Credentials** dropdown in node
2. Select **Create New Credential**
3. Select **ModelScope API**
4. Fill credential info:
   - **Name**: Credential name (e.g., "ModelScope API")
   - **API Key**: Your ModelScope API Key
   - **Base URL**: Optional, default is `https://api-inference.modelscope.cn/v1`

#### Step 2: Select Model

In **Model** dropdown select:

- **Tongyi-MAI/Z-Image**: General image generation
- **Qwen/Qwen-Image-2512**: High-quality image generation
- **Qwen/Qwen-Image-Edit-2511**: Image editing (requires input image)

#### Step 3: Configure Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| **Prompt** | Text | ✅ | Image generation prompt (describe desired image) |
| **Size** | Options | ✅ | Image size (options vary by model) |
| **Input Image** | String | ❎ | Original image URL or Base64 for edit mode |
| **Seed** | Number | ❎ | Random seed (0=random, other values=fixed result) |
| **Number of Images** | Number | ❎ | Generation count (1-4, default 1) |

#### Example 1: Generate Image (Z-Image)

```
Prompt: A serene sunset over a calm ocean, digital art style
Size: 2048x2048
Seed: 12345
Number of Images: 1
```

**Output**:
```json
{
  "success": true,
  "imageUrl": "https://modelscope.cn/api/v1/...",
  "model": "Tongyi-MAI/Z-Image",
  "_metadata": {
    "timestamp": "2025-01-29T12:00:00.000Z",
    "cached": false
  }
}
```

#### Example 2: Edit Image (Qwen-Image-Edit)

```
Model: Qwen/Qwen-Image-Edit-2511
Prompt: Add a beautiful rainbow in the sky
Input Image: https://example.com/original-image.jpg
Seed: 0
```

---

### 🍌 Nano Banana Usage Guide

#### Step 1: Register and Get API Key

1. Visit registration page: https://ai.comfly.chat/register?aff=296d6933380
2. Complete registration and top up
3. Get API Key from console

#### Step 2: Configure Credentials

1. Select **Nano Banana** operation in node
2. Click **Credentials** → **Create New Credential**
3. Select **Google PaLM API**
4. Fill credential info:
   - **Name**: Credential name (e.g., "Nano Banana API")
   - **API Key**: API Key from ai.comfly.chat
   - **Host**: Leave empty or fill `ai.comfly.chat`

#### Step 3: Select Mode

- **Text to Image**: Generate images from text description
- **Image to Image**: Generate new images based on reference images

#### Step 4: Configure Parameters

##### Text-to-Image Mode

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| **Model** | Options | ✅ | nano-banana or nano-banana-2 |
| **Prompt** | Text | ✅ | Image description |
| **Aspect Ratio** | Options | ✅ | Aspect ratio (1:1, 16:9, etc.) |
| **Resolution** | Options | ❎ | Resolution (only for nano-banana-2: 1K/2K/4K) |

##### Image-to-Image Mode

Additional parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| **Reference Images** | Collection | ❎ | Reference images (max 4, supports URL/Base64/binary) |

#### Example 1: High-Quality Image Generation (Nano Banana 2)

```
Mode: Text to Image
Model: Nano Banana 2
Prompt: A futuristic city at night with neon lights
Aspect Ratio: 16:9
Resolution: 4K
```

#### Example 2: Image-to-Image

```
Mode: Image to Image
Model: Nano Banana 2
Prompt: Transform this into a watercolor painting
Aspect Ratio: 1:1
Resolution: 2K
Reference Images:
  - https://example.com/photo.jpg
```

---

### 🫘 Doubao Usage Guide

#### Step 1: Configure Credentials

1. Select **Doubao** operation in node
2. Click **Credentials** → **Create New Credential**
3. Select **Doubao API**
4. Fill credential info:
   - **Name**: Credential name
   - **API Key**: API Key from Volcengine
   - **Base URL**: Default is `https://ark.cn-beijing.volces.com/api/v3`

#### Step 2: Select Mode

- **Text to Image**: Text to image generation
- **Image to Image**: Image editing

#### Step 3: Configure Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| **Model** | Options | ✅ | doubao-seedream-4-5-251128 or 4.0 |
| **Prompt** | Text | ✅ | Image description |
| **Resolution Level** | Options | ✅ | 2K or 4K |
| **Size** | Options | ✅ | Specific size (varies by resolution) |
| **Input Image Type** | Options | ❎ | URL/Base64 or binary file |
| **Input Image** | String | ❎ | Original image for editing |
| **Seed** | Number | ❎ | Random seed (-1=random) |

#### Example: Generate 4K Image

```
Mode: Text to Image
Model: Doubao Seedream 4.5
Resolution Level: 4K
Size: 16:9 (5120x2880)
Prompt: A majestic mountain landscape at golden hour
Seed: -1
```

---

### 🎬 Sora Usage Guide

#### Step 1: Register and Get API Key

1. Visit registration page: https://ai.comfly.chat/register?aff=296d6933380
2. Complete registration and top up
3. Get API Key from console

#### Step 2: Configure Credentials

1. Select **Sora** operation in node
2. Click **Credentials** → **Create New Credential**
3. Select **OpenAI API**
4. Fill credential info:
   - **Name**: Credential name (e.g., "Sora API")
   - **API Key**: API Key from ai.comfly.chat
   - **Base URL**: Leave empty or fill `https://api.openai.com/v1`

#### Step 3: Select Mode

- **Text to Video**: Generate videos from text description
- **Image to Video**: Generate videos based on reference images

#### Step 4: Configure Parameters

##### Text-to-Video Mode

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| **Prompt** | Text | ✅ | Video description |
| **Duration** | Options | ✅ | 5s, 10s, 15s, 20s, or 25s |
| **Resolution** | Options | ✅ | 480p, 720p, or 1080p |
| **Aspect Ratio** | Options | ✅ | 16:9, 9:16, 1:1, etc. |
| **Seed** | Number | ❎ | Random seed (-1=random) |

##### Image-to-Video Mode

Additional parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| **First Frame Image** | String | ✅ | First frame URL or Base64 |
| **Last Frame Image** | String | ❎ | Optional last frame |

#### Example 1: Generate 10s Video

```
Mode: Text to Video
Prompt: A serene beach at sunset with gentle waves
Duration: 10s
Resolution: 1080p
Aspect Ratio: 16:9
Seed: -1
```

#### Example 2: Image-to-Video

```
Mode: Image to Video
Prompt: Animate this scene with gentle camera movement
Duration: 5s
Resolution: 720p
Aspect Ratio: 9:16
First Frame Image: https://example.com/image.jpg
```

#### Output Mode Options

- **URL Only**: Return video URL only (recommended)
- **Binary Data**: Download and include video file in output

---

## ⚙️ Advanced Configuration Options

All platforms support the following advanced options:

### Options (Optional Parameters)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| **Timeout (ms)** | Number | 60000 | Request timeout in milliseconds |
| **Enable Caching** | Boolean | true | Whether to enable caching |
| **Cache TTL (seconds)** | Number | 3600 | Cache validity period in seconds |
| **Max Retries** | Number | 3 | Maximum retry attempts |

---

## 🎨 Practical Examples

### Example 1: Batch Generate Social Media Images

**Scenario**: Generate multiple sizes of promotional images for a product

**Workflow Design**:

1. **HTTP Request Node**: Fetch product information
2. **AI Media Generation Node**:
   - Use ModelScope Z-Image
   - Generate 3 sizes for each product
   - Sizes: 2048x2048 (square), 2048x1152 (landscape), 1152x2048 (portrait)
3. **Save to Disk**: Save generated images

### Example 2: Image Style Transfer

**Scenario**: Transform user-uploaded photos into artistic styles

**Workflow Design**:

1. **Webhook Node**: Receive user-uploaded images
2. **AI Media Generation Node**:
   - Use Nano Banana 2 (Image to Image mode)
   - Prompt: "Transform into oil painting style"
   - Upload user image as reference
3. **Return to User**: Return transformed image

### Example 3: Automated Content Creation

**Scenario**: Auto-generate featured images for blog posts

**Workflow Design**:

1. **RSS Feed Node**: Monitor new articles
2. **AI Agent Node**: Extract article topic and generate image prompt
3. **AI Media Generation Node**:
   - Use Doubao Seedream 4.5
   - Generate featured image based on prompt
4. **Upload to CDN**: Upload image to CDN
5. **Update Blog**: Add image URL to article

---

## 📊 Output Format

### Success Response

```json
{
  "success": true,
  "imageUrl": "https://...",
  "model": "Model Name",
  "_metadata": {
    "timestamp": "2025-01-29T12:00:00.000Z",
    "cached": false,
    "provider": "modelscope",
    "generationTime": 3500
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error description message",
  "errorCode": "ERROR_CODE",
  "_metadata": {
    "timestamp": "2025-01-29T12:00:00.000Z"
  }
}
```

### Error Code Reference

| Error Code | Retryable | Description |
|------------|-----------|-------------|
| `INVALID_API_KEY` | ❌ | API key is invalid or expired |
| `RATE_LIMIT` | ✅ | Rate limit exceeded |
| `NETWORK_ERROR` | ✅ | Network connection error |
| `TIMEOUT` | ✅ | Request timeout |
| `API_ERROR` | ❌ | API returned error |
| `INVALID_IMAGE_INPUT` | ❌ | Invalid image input format |
| `INVALID_PARAMS` | ❌ | Parameter validation failed |
| `SERVICE_UNAVAILABLE` | ✅ | Service temporarily unavailable |

---

## 🚀 Performance Optimization Tips

### 1. Enable Caching

For repeated generation requests, enabling caching can:
- ✅ Reduce API call count
- ✅ Lower costs
- ✅ Improve response speed

```json
{
  "options": {
    "enableCaching": true,
    "cacheTtl": 3600
  }
}
```

### 2. Adjust Timeout

Adjust timeout based on image complexity:
- Simple images: 30-60 seconds
- Complex images: 60-120 seconds
- 4K images: 120-180 seconds

### 3. Batch Processing Strategy

When handling large numbers of requests:
- Use n8n's loop functionality
- Process 5-10 requests per batch
- Add delays to avoid rate limits

### 4. Choose Appropriate Model

| Use Case | Recommended Model | Reason |
|----------|------------------|--------|
| Social media images | Z-Image | Fast, multiple aspect ratios |
| High-quality print | Doubao 4K | Highest resolution |
| Image editing | Qwen-Image-Edit | Professional editing |
| Rapid prototyping | Nano Banana | Fastest speed |

---

## 🛠️ Troubleshooting

### Problem 1: Node Not Appearing in List

**Solution**:

```bash
# Check if node is correctly installed
docker exec n8n ls -la /home/node/.n8n/custom/n8n-nodes-ai-media-gen/

# Restart n8n
docker-compose restart n8n n8n-worker

# Check logs
docker logs n8n | grep -i "ai-media-gen"
```

### Problem 2: Authentication Failed

**Checklist**:
- ✅ API key is correctly copied (no extra spaces)
- ✅ API key is activated
- ✅ Account has sufficient balance
- ✅ Base URL is correct

### Problem 3: Generation Timeout

**Solution**:
1. Increase timeout parameter
2. Check network connection
3. Try generating smaller size images
4. Check service provider status page

### Problem 4: Image Quality Not Meeting Expectations

**Optimization Tips**:
1. Optimize prompt:
   - Add style descriptions: `digital art`, `oil painting`, `photorealistic`
   - Add detail descriptions: `highly detailed`, `8K resolution`
   - Add lighting descriptions: `golden hour lighting`, `soft shadows`

2. Try different models
3. Adjust seed to generate multiple versions
4. Use image editing to refine results

### Problem 5: Rate Limiting

**Solution**:
1. Enable caching to reduce duplicate requests
2. Add delay nodes in workflow
3. Contact service provider to increase quota
4. Use multiple API keys for rotation

---

## 📚 Development Guide

### Project Structure

```
n8n-nodes-ai-media-gen/
├── nodes/
│   ├── AIMediaGen.ts          # Main node implementation
│   ├── DoubaoGen.ts           # Doubao dedicated node
│   ├── credentials/           # API credential definitions
│   ├── utils/                 # Utility functions
│   │   ├── cache.ts          # Cache management
│   │   ├── errors.ts         # Error handling
│   │   ├── monitoring.ts     # Performance monitoring
│   │   ├── validators.ts     # Input validation
│   │   └── helpers.ts        # Helper functions
│   └── __tests__/            # Test suite
├── dist/                      # Compiled output
└── Configuration files
```

### Local Development

```bash
# Install dependencies
npm install

# Development mode (auto-watch file changes)
npm run dev

# Run tests
npm test

# Code linting
npm run lint

# Code formatting
npm run format

# Production build
npm run build
```

### Adding New AI Platform

1. Create new credential type in `nodes/credentials/`
2. Add new operation option in `AIMediaGen.ts`
3. Implement corresponding API call logic
4. Add test cases
5. Update documentation

---

## 📝 Changelog

### v0.0.2 (2025-01-29)

**Fixed**:
- ✅ Fixed ESLint violations for n8n community node package compliance
  - Removed duplicate `buildDev` function declaration in gulpfile.js
  - Added ESLint disable comments for restricted globals in jest.setup.js
  - All n8n security checks now pass

### v0.0.1 (2025-01-29)

**New Features**:
- ✅ Add Doubao Seedream 4.5 support
- ✅ Complete input validation system
- ✅ Comprehensive unit test coverage

**Important Fixes**:
- 🐛 Fix multi-item workflow parameter access bug
- 🐛 Fix error code preservation issue
- 🐛 Each node now correctly uses its own timeout configuration

**Code Improvements**:
- 🧹 Remove ~54,000 lines of unused code
- 📚 Add complete JSDoc documentation
- 🔒 Improve type safety

View full changelog: [CHANGELOG.md](CHANGELOG.md)

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork this project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details

---

## 💬 Support

### Official Resources

- **GitHub Issues**: [Report Issues](https://github.com/n8n-nodes-ai-media-gen/issues)
- **n8n Official Docs**: [https://docs.n8n.io](https://docs.n8n.io)

### Platform Documentation

- **ModelScope**: [https://modelscope.cn/docs](https://modelscope.cn/docs)
- **Nano Banana**: [https://ai.comfly.chat](https://ai.comfly.chat/register?aff=296d6933380)
- **Sora**: [https://ai.comfly.chat/register?aff=296d6933380](https://ai.comfly.chat/register?aff=296d6933380)
- **Doubao**: [https://www.volcengine.com/docs/82379](https://www.volcengine.com/docs/82379)

---

## 🙏 Acknowledgments

Thanks to the following open source projects and communities:

- [n8n](https://n8n.io) - Excellent workflow automation platform
- [ModelScope](https://modelscope.cn) - Alibaba Cloud open source model community
- All contributors to this project

---

<div align="center">

**If this project helps you, please give it a ⭐️**

Made with ❤️ by n8n-nodes-ai-media-gen team

</div>
