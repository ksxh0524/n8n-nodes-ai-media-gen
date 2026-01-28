# n8n-nodes-ai-media-gen

A simple and extensible n8n node for AI media generation (images) using ModelScope API.

## Features

- **Image Generation**: Generate images using ModelScope AI models
- **Image Editing**: Edit images with AI-powered tools
- **Smart Caching**: Built-in caching to reduce API calls and improve performance
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Retry Logic**: Automatic retry with exponential backoff
- **Input Validation**: Validates all inputs before API calls
- **Logging**: Detailed logging for debugging and monitoring
- **Configurable**: Customizable retry count, timeout, and cache settings

## Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Install the Node

```bash
cd /path/to/n8n-nodes-ai-media-gen
npm install
npm run build
```

## Quick Start

### Basic Usage

1. Add "AI Media Generation" node to your workflow
2. Configure ModelScope API credentials
3. Select the AI model
4. Enter prompt for generation or editing
5. Configure optional parameters (size, seed, number of images)
6. Configure caching settings (optional)
7. Run workflow

### Example: Generate an Image with Z-Image

**Input data**:
```json
{
  "model": "Tongyi-MAI/Z-Image",
  "prompt": "A serene sunset over a calm ocean, digital art",
  "size": "1024x1024",
  "seed": 0,
  "numImages": 1
}
```

**Output data**:
```json
{
  "success": true,
  "imageUrl": "https://example.com/generated/image.png",
  "model": "Tongyi-MAI/Z-Image",
  "_metadata": {
    "timestamp": "2024-01-20T04:39:00.000Z",
    "cached": false
  }
}
```

## Supported Models

### Image Generation Models

| Model | Description | Supported Sizes |
|-------|-------------|----------------|
| Tongyi-MAI/Z-Image | High-quality text-to-image generation model | 512x512, 768x768, 1024x1024 |
| Qwen-Image-2512 | Advanced text-to-image generation model | 1024x1024, 1152x896, 896x1152, 1216x832, 832x1216, 1344x768, 768x1344, 1536x640, 640x1536 |

### Image Editing Models

| Model | Description | Supported Sizes |
|-------|-------------|----------------|
| Qwen-Image-Edit-2511 | Image editing model - requires input image | 1024x1024, 1152x896, 896x1152, 1216x832, 832x1216, 1344x768, 768x1344 |

## Node Configuration

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|-------|----------|---------|-------------|
| Model | options | Yes | Tongyi-MAI/Z-Image | Select the AI model to use |
| Prompt | string | Yes | - | Text description for generation or editing |
| Input Image | string | Conditional | - | URL or base64 of the image to edit (required for Edit model) |
| Size | options | Yes | 1024x1024 | Image size (depends on model) |
| Seed | number | No | 0 | Random seed for reproducibility (0 = random) |
| Number of Images | number | No | 1 | Number of images to generate (1-4) |

### Options

| Parameter | Type | Required | Default | Description |
|-----------|-------|----------|---------|-------------|
| Max Retries | number | No | 3 | Maximum number of retry attempts for failed requests |
| Timeout (ms) | number | No | 60000 | Request timeout in milliseconds (1000-600000) |
| Enable Caching | boolean | No | true | Enable result caching to reduce API calls |
| Cache TTL (seconds) | number | No | 3600 | Cache time-to-live in seconds (60-86400) |

### Credentials

| Field | Type | Required | Description |
|-------|-------|----------|-------------|
| API Key | string | Yes | ModelScope API key for authentication |
| Base URL | string | No | Custom base URL (optional, uses ModelScope default if empty) |

## Caching

The node includes a built-in caching mechanism to reduce API calls and improve performance.

### How It Works

1. **Cache Key Generation**: Each generation request creates a unique cache key based on:
   - Model name
   - Prompt text
   - Size
   - Seed
   - Number of images
   - Input image (for editing)

2. **Cache Lookup**: Before making an API call, the node checks if a cached result exists

3. **Cache Hit**: If found, returns the cached result immediately

4. **Cache Miss**: If not found, makes an API call and stores the result

### Cache Configuration

- **Default TTL**: 3600 seconds (1 hour)
- **Max Size**: 200 entries
- **Eviction Policy**: LRU (Least Recently Used) - oldest entries are evicted first

### Benefits

- **Reduced API Costs**: Fewer API calls means lower costs
- **Faster Response Times**: Cached results are returned instantly
- **Rate Limit Protection**: Helps avoid hitting rate limits

## Error Handling

All errors are wrapped in `MediaGenError` with proper error codes.

### Error Codes

| Code | Retryable | Description |
|------|-----------|-------------|
| INVALID_API_KEY | No | API key is invalid or missing |
| RATE_LIMIT | Yes | Rate limit exceeded, please try again later |
| NETWORK_ERROR | Yes | Network error occurred |
| TIMEOUT | Yes | Request timed out |
| API_ERROR | No | API error occurred |
| INVALID_IMAGE_INPUT | No | Invalid image input provided |
| INVALID_PARAMS | No | Invalid parameters provided |
| SERVICE_UNAVAILABLE | Yes | Service temporarily unavailable |

### Error Response Format

```json
{
  "success": false,
  "error": "API key is invalid or missing",
  "errorCode": "INVALID_API_KEY",
  "_metadata": {
    "timestamp": "2024-01-20T04:39:00.000Z"
  }
}
```

## Retry Logic

The node implements automatic retry with exponential backoff:

- **Initial Delay**: 1000ms
- **Backoff Multiplier**: 2x
- **Max Delay**: 30000ms
- **Max Retries**: Configurable (default: 3)

Only retryable errors will be retried (NETWORK_ERROR, TIMEOUT, RATE_LIMIT, SERVICE_UNAVAILABLE).

## Logging

The node provides detailed logging at different levels:

- **Info**: High-level operations (start, success, cache hit/miss)
- **Debug**: Detailed information (API request, cache key)
- **Error**: Failures with context

Logs include:
- Model name
- Error messages
- Timestamps
- Cache status

## Examples

### Example 1: Generate Image with Z-Image

```json
{
  "model": "Tongyi-MAI/Z-Image",
  "prompt": "A futuristic city with flying cars at sunset, digital art style",
  "size": "1024x1024",
  "seed": 12345,
  "numImages": 2
}
```

### Example 2: Generate Image with Qwen-Image-2512

```json
{
  "model": "Qwen-Image-2512",
  "prompt": "A professional photo of a business meeting",
  "size": "1152x896",
  "seed": 0,
  "numImages": 1
}
```

### Example 3: Edit Image with Qwen-Image-Edit-2511

```json
{
  "model": "Qwen-Image-Edit-2511",
  "prompt": "Add a blue sky with clouds",
  "inputImage": "https://example.com/original-image.jpg",
  "size": "1024x1024"
}
```

### Example 4: Edit Image with Base64 Input

```json
{
  "model": "Qwen-Image-Edit-2511",
  "prompt": "Remove the background",
  "inputImage": "data:image/jpeg;base64,/9j/4AAQSkZJRgABA...",
  "size": "1024x1024"
}
```

## Testing

```bash
npm test                    # Run tests
npm run build              # Build for production
npm run dev                # Watch mode for development
npm run lint               # Lint code
npm run format             # Format code
```

## Development

### Project Structure

```
n8n-nodes-ai-media-gen/
├── nodes/                  # Source code
│   ├── AIMediaGen.ts      # Main node implementation
│   ├── ai-media-gen.svg    # Node icon
│   ├── credentials/        # Credential definitions
│   │   ├── modelScopeApi.credentials.ts
│   │   └── index.ts
│   ├── utils/             # Utility functions
│   │   ├── cache.ts       # Caching mechanism
│   │   ├── constants.ts   # Constants
│   │   ├── errors.ts      # Error handling
│   │   ├── helpers.ts     # Helper functions
│   │   ├── monitoring.ts  # Performance monitoring
│   │   ├── types.ts       # Type definitions
│   │   └── validators.ts  # Input validation
│   └── __tests__/         # Unit tests
│       ├── AIMediaGen.test.ts
│       ├── apiIntegration.test.ts
│       ├── cache.test.ts
│       ├── errors.test.ts
│       ├── monitoring.test.ts
│       ├── helpers/
│       │   └── n8nMock.ts
│       └── fixtures/
│           ├── apiResponses.ts
│           └── testData.ts
├── dist/                  # Compiled output
└── Configuration files
```

### Code Style

- TypeScript strict mode enabled
- ESLint for linting
- Prettier for formatting
- Jest for testing

## Performance Tips

### 1. Enable Caching
Caching can significantly reduce API costs and improve response times for repeated requests.

### 2. Use Appropriate Timeouts
Set timeouts based on expected generation time:
- Simple images: 30-60 seconds
- Complex images: 60-120 seconds

### 3. Adjust Retry Count
For production environments, consider:
- Low latency environments: 2-3 retries
- High latency environments: 3-5 retries

### 4. Optimize Cache TTL
Set cache TTL based on how often your data changes:
- Static content: 86400 seconds (24 hours)
- Dynamic content: 3600 seconds (1 hour)
- Real-time: 300 seconds (5 minutes)

## Troubleshooting

### Issue: Authentication errors

**Solution**:
- Verify API key is correct
- Check base URL is correct (if custom)
- Ensure API key has proper permissions

### Issue: Timeout errors

**Solution**:
- Increase timeout parameter
- Check network connectivity
- Try again with retry enabled

### Issue: Rate limiting

**Solution**:
- Increase delay between requests
- Reduce concurrent requests
- Use caching if available

### Issue: Invalid size for model

**Solution**:
- Check supported sizes for your model
- Verify size parameter matches model capabilities
- Refer to the Supported Models table

### Issue: Invalid input image format

**Solution**:
- Ensure input image is a valid URL starting with http:// or https://
- Or use base64 format: `data:image/<format>;base64,<data>`
- Verify the URL is accessible

## License

MIT

## Support

For issues and questions, please use the GitHub issue tracker.
