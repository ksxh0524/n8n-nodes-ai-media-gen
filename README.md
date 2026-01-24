# n8n-nodes-ai-media-gen

A simple and extensible n8n node for AI media generation (images, videos, audio) using multiple API formats.

## Features

- **Unified Interface**: Single node for images, videos, and audio generation
- **Multi-Format Support**: OpenAI, Google Gemini, Alibaba Bailian, Replicate, Hugging Face
- **Auto Detection**: Automatically detects media type from model name
- **Smart Caching**: Built-in caching to reduce API calls and improve performance
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Retry Logic**: Automatic retry with exponential backoff
- **Input Validation**: Validates all inputs before API calls
- **Logging**: Detailed logging for debugging and monitoring
- **Configurable**: Customizable retry count, timeout, and cache settings

## Installation

```bash
cd /path/to/n8n-nodes-ai-media-gen
npm install
npm run build
```

## Quick Start

### Basic Usage

1. Add "AI Media Generation" node to your workflow
2. Select API Format (OpenAI, Gemini, Bailian, Replicate, or Hugging Face)
3. Configure API credentials
4. Enter model name (e.g., dall-e-3, imagen-2.0, wanx-v1, flux-schnell, tts-1, sora)
5. Enter prompt for generation
6. Add optional parameters (JSON format)
7. Configure caching settings (optional)
8. Run workflow

### Example: Generate an Image with OpenAI

**Input data**:
```json
{
  "model": "dall-e-3",
  "prompt": "A serene sunset over a calm ocean, digital art",
  "additionalParams": "{\"size\": \"1024x1024\", \"quality\": \"hd\"}"
}
```

**Output data**:
```json
{
  "created": 1700000000,
  "data": [
    {
      "url": "https://example.com/generated/image.png",
      "revised_prompt": "A serene sunset..."
    }
  ],
  "_metadata": {
    "apiFormat": "openai",
    "model": "dall-e-3",
    "mediaType": "image",
    "timestamp": "2024-01-20T04:39:00.000Z",
    "cached": false
  }
}
```

## Supported API Formats

| API Format | Image | Video | Audio | Description |
|-----------|-------|-------|-------|-------------|
| OpenAI | DALL-E 2/3 | Sora | TTS | OpenAI API format (Authorization: Bearer <key>) |
| Gemini | Imagen | - | - | Google Gemini API format |
| Bailian | Wanx | Wanx Video | CosyVoice | Alibaba Bailian API format (Authorization: Bearer <key>) |
| Replicate | Various | Various | Various | Replicate API format (Authorization: Bearer <key>) |
| Hugging Face | Various | Various | Various | Hugging Face API format (Authorization: Bearer <key>) |

## Media Type Detection

The node automatically detects media type based on model name:

### Video Models
- Contains: `sora`, `video`, `svd`, `cogvideo`, `wanx-video`
- Examples: `sora`, `video-gen`, `svd-xt`, `cogvideox`, `wanx-video-v1`

### Audio Models
- Contains: `tts`, `audio`, `speech`, `voice`, `sambert`, `cosyvoice`
- Examples: `tts-1`, `audio-gen`, `speech-api`, `voice-synthesis`, `sambert-v1`, `cosyvoice-v1`

### Image Models
- Default for all other models
- Examples: `dall-e-3`, `imagen-2.0`, `wanx-v1`, `flux-schnell`, `stable-diffusion`

## Node Configuration

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|-------|----------|-------------|
| Model | string | Yes | Model name (e.g., dall-e-3, imagen-2.0, wanx-v1, flux-schnell, tts-1, sora) |
| Prompt | string | Yes | Text prompt for generation |
| Additional Parameters (JSON) | string | No | {} | Additional parameters as JSON object (e.g., {"size": "1024x1024", "n": 1}) |
| Max Retries | number | No | 3 | Maximum number of retry attempts for failed requests |
| Timeout (ms) | number | No | 60000 | Request timeout in milliseconds |

### Credentials

| Field | Type | Required | Description |
|-------|-------|----------|-------------|
| API Format | options | Yes | Select API format (OpenAI, Gemini, Bailian, Replicate, Hugging Face) |
| API Key | string | Yes | API key for the selected service |
| Base URL | string | No | Custom base URL (optional, uses provider default if empty) |
| Enable Caching | boolean | No | true | Enable result caching to reduce API calls |
| Cache TTL (seconds) | number | No | 3600 | Cache time-to-live in seconds (default: 3600 = 1 hour) |

## Caching

The node includes a built-in caching mechanism to reduce API calls and improve performance:

### How It Works

1. **Cache Key Generation**: Each generation request creates a unique cache key based on:
   - API format
   - Model name
   - Prompt text
   - Additional parameters

2. **Cache Lookup**: Before making an API call, the node checks if a cached result exists

3. **Cache Hit**: If found, returns the cached result immediately

4. **Cache Miss**: If not found, makes the API call and stores the result

### Cache Configuration

- **Default TTL**: 3600 seconds (1 hour)
- **Max Size**: 200 entries
- **Eviction Policy**: LRU (Least Recently Used) - oldest entries are evicted first

### Benefits

- **Reduced API Costs**: Fewer API calls means lower costs
- **Faster Response Times**: Cached results are returned instantly
- **Rate Limit Protection**: Helps avoid hitting rate limits

### Disabling Caching

You can disable caching in the credentials configuration if you always want fresh results.

## Error Handling

All errors are wrapped in `MediaGenError` with proper error codes:

### Error Codes

| Code | Retryable | Description |
|------|-----------|-------------|
| INVALID_API_KEY | No | API key is invalid or missing |
| RATE_LIMIT | Yes | Rate limit exceeded, please try again later |
| INVALID_MODEL | No | Model name is invalid |
| NETWORK_ERROR | Yes | Network error occurred |
| TIMEOUT | Yes | Request timed out |
| INVALID_PARAMS | No | Invalid parameters provided |
| API_ERROR | No | API error occurred |
| SERVICE_UNAVAILABLE | Yes | Service is temporarily unavailable |

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
- **Debug**: Detailed information (detected media type, API request, cache key)
- **Error**: Failures with context

Logs include:
- Model name
- Media type
- API format
- Error messages
- Timestamps
- Cache status

## Examples

### Example 1: Generate Image with OpenAI

```json
{
  "model": "dall-e-3",
  "prompt": "A futuristic city with flying cars at sunset, digital art style",
  "additionalParams": "{\"size\": \"1024x1024\", \"quality\": \"hd\", \"style\": \"vivid\"}"
}
```

### Example 2: Generate Audio with OpenAI

```json
{
  "model": "tts-1",
  "prompt": "Welcome to our service! We're happy to have you here.",
  "additionalParams": "{\"voice\": \"alloy\", \"speed\": 1.0}"
}
```

### Example 3: Generate Video with Bailian

```json
{
  "model": "wanx-video-v1",
  "prompt": "A drone flying over a tropical island",
  "additionalParams": "{\"duration\": 10}"
}
```

### Example 4: Generate Image with Gemini

```json
{
  "model": "imagen-2.0",
  "prompt": "A professional photo of a business meeting",
  "additionalParams": "{\"aspectRatio\": \"1:1\", \"negativePrompt\": \"blurry, low quality\"}"
}
```

### Example 5: Generate Image with Replicate

```json
{
  "model": "stability-ai/sdxl",
  "prompt": "A beautiful landscape with mountains and a lake",
  "additionalParams": "{\"width\": 1024, \"height\": 1024, \"num_inference_steps\": 50}"
}
```

### Example 6: Generate Image with Hugging Face

```json
{
  "model": "stabilityai/stable-diffusion-xl-base-1.0",
  "prompt": "A cat sitting on a windowsill",
  "additionalParams": "{\"negative_prompt\": \"blurry, low quality\", \"guidance_scale\": 7.5}"
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
│   ├── AIMediaGen.node.ts  # Main node implementation
│   ├── ai-media-gen.svg    # Node icon
│   ├── index.ts            # Export file
│   ├── credentials/        # Credential definitions
│   │   ├── aiMediaApi.credentials.ts
│   │   └── index.ts
│   ├── utils/             # Utility functions
│   │   ├── errors.ts       # Error handling and validation
│   │   ├── helpers.ts      # Helper functions
│   │   └── cache.ts        # Caching mechanism
│   └── __tests__/         # Unit tests
│       ├── detectMediaType.test.ts
│       ├── helpers.test.ts
│       └── errors.test.ts
├── docs/                   # Documentation
├── dist/                  # Compiled output
└── Configuration files
```

### Adding New API Formats

To add a new API format:

1. **Add to credentials**: Update `nodes/credentials/aiMediaApi.credentials.ts`
2. **Add default URL**: Update `getDefaultBaseUrl()` in `nodes/utils/helpers.ts`
3. **Add endpoint logic**: Update `getEndpoint()` in `nodes/utils/helpers.ts`
4. **Add headers**: Update `getHeaders()` in `nodes/utils/helpers.ts`
5. **Add request body**: Update `buildRequestBody()` in `nodes/utils/helpers.ts`
6. **Add tests**: Create tests in `nodes/__tests__/`

### Code Style

- TypeScript strict mode enabled
- ESLint for linting
- Prettier for formatting
- Jest for testing

## Performance Tips

### 1. Enable Caching
Caching can significantly reduce API costs and improve response times for repeated requests.

### 2. Use Appropriate Timeouts
Set timeouts based on the expected generation time:
- Images: 30-60 seconds
- Videos: 60-300 seconds
- Audio: 10-30 seconds

### 3. Adjust Retry Count
For production environments, consider:
- Low latency: 2-3 retries
- High latency: 3-5 retries

### 4. Optimize Cache TTL
Set cache TTL based on how often your data changes:
- Static content: 86400 seconds (24 hours)
- Dynamic content: 3600 seconds (1 hour)
- Real-time: 300 seconds (5 minutes)

## Troubleshooting

### Issue: Authentication errors

**Solution**:
- Verify API key is correct
- Check API format matches the provider
- Ensure base URL is correct (if custom)

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

### Issue: Cache not working

**Solution**:
- Verify caching is enabled in credentials
- Check cache TTL is set correctly
- Review logs for cache hit/miss messages

### Issue: Invalid model

**Solution**:
- Verify model name is correct
- Check model is available for the provider
- Ensure media type detection is correct

## License

MIT

## Support

For issues and questions, please use the GitHub issue tracker.
