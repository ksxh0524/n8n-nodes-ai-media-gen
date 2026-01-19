# Usage Examples

Practical examples for using n8n-nodes-ai-media-gen.

## Table of Contents

1. [Image Generation](#image-generation)
2. [Video Generation](#video-generation)
3. [Audio Generation](#audio-generation)
4. [Batch Processing](#batch-processing)
5. [Using with AI Agent](#using-with-ai-agent)
6. [Advanced Workflows](#advanced-workflows)

## Image Generation

### Example 1: Simple Image Generation

Generate an image with DALL-E 3:

```json
// Input data to AIMediaGen node
{
  "prompt": "A futuristic city with flying cars at sunset, digital art style"
}
```

**Node Configuration**:
- Media Type: Image
- Provider: OpenAI
- Model: DALL-E 3
- Size: 1024x1024
- Quality: HD
- Style: Vivid

**Output**:
```json
{
  "success": true,
  "url": "https://oaidalleapiprodscus.blob.core.windows.net/private/...",
  "mediaType": "image",
  "provider": "openai",
  "model": "dall-e-3",
  "metadata": {
    "revisedPrompt": "A futuristic cityscape...",
    "size": "1024x1024"
  }
}
```

### Example 2: Multiple Images

Generate multiple images with different seeds:

```javascript
// In a Function node
const prompts = [
  { prompt: "A mountain landscape", seed: 12345 },
  { prompt: "A beach scene", seed: 67890 },
  { prompt: "A forest path", seed: 54321 },
];

return prompts.map(p => ({ json: p }));
```

Connect to AIMediaGen node with:
- Media Type: Image
- Provider: Stability AI
- Model: Stable Diffusion XL
- Samples: 1 per input

### Example 3: Image with Negative Prompt

Generate image with things to avoid:

```json
{
  "prompt": "A professional photo of a business meeting",
  "negativePrompt": "blurry, low quality, distorted faces, cartoon",
  "cfgScale": 7,
  "steps": 40
}
```

## Video Generation

### Example 1: Image to Video

Convert an image to video using Stable Video Diffusion:

```json
{
  "imageUrl": "https://example.com/image.png",
  "motionBucketId": 127,
  "cfgScale": 2.5
}
```

**Node Configuration**:
- Media Type: Video
- Provider: Stability AI
- Model: Stable Video Diffusion
- Duration: 4 seconds (fixed for SVD)

### Example 2: Async Video Generation

For longer videos, use async processing:

```json
{
  "prompt": "A drone flying over a tropical island",
  "duration": 10,
  "options": {
    "asyncProcessing": true,
    "maxWaitTime": 300
  }
}
```

## Audio Generation

### Example 1: Text-to-Speech

Convert text to speech:

```json
{
  "text": "Welcome to our service! We're happy to have you here.",
  "voice": "Rachel",
  "model": "Multilingual v2",
  "similarityBoost": 0.75,
  "stability": 0.5
}
```

**Output**:
```json
{
  "success": true,
  "url": "https://elevenlabs-temp.com/audio/abc123.mp3",
  "mediaType": "audio",
  "mimeType": "audio/mpeg",
  "metadata": {
    "voiceId": "21m00Tcm4TlvDq8ikWAM",
    "textLength": 64,
    "estimatedDuration": 4
  }
}
```

### Example 2: Multi-language TTS

Generate speech in different languages:

```javascript
// Function node
const texts = [
  { text: "Hello!", lang: "en", voice: "Rachel" },
  { text: "¡Hola!", lang: "es", voice: "Bella" },
  { text: "Bonjour!", lang: "fr", voice: "Domi" },
];

return texts.map(t => ({ json: t }));
```

## Batch Processing

### Example 1: Generate Multiple Images

Use a Loop node for batch generation:

```
1. Webhook/Manual Trigger
   ↓
2. Function Node (create array of prompts)
   ↓
3. Split Out Batches
   ↓
4. AI Media Generation (for each item)
   ↓
5. Aggregate Items
   ↓
6. Webhook Response / Save to File
```

**Function Node Code**:
```javascript
const prompts = [
  "A cat sitting on a wall",
  "A dog playing in the park",
  "A bird flying in the sky",
  "A fish swimming in the ocean",
];

return prompts.map(prompt => ({ json: { prompt } }));
```

### Example 2: Batch with Rate Limiting

Add delays between requests:

```javascript
// Wait node configuration
{
  "amount": 2,
  "unit": "seconds"
}
```

Place Wait node after AI Media Generation in loop.

## Using with AI Agent

### Example 1: AI Agent Tool

Use AI Media Generation as a tool for AI Agent:

```
1. AI Agent (Chat Model)
   ↓
2. AI Media Generation (as Tool)
   ↓
3. Return result to Agent
```

**Agent Prompt**:
```
You are a creative assistant. When the user asks for an image,
use the AI_Media_Generation tool to create it.
```

**User Input**:
```
Can you create an image of a cyberpunk city at night?
```

**Agent will automatically call**:
```json
{
  "prompt": "A cyberpunk city at night, neon lights, rain, futuristic architecture"
}
```

### Example 2: Multi-modal Workflow

```
1. Chat Input
   ↓
2. AI Agent (analyze request)
   ↓
3. IF (media type)
   ├─ Image → AI Media Generation (Image)
   ├─ Video → AI Media Generation (Video)
   └─ Audio → AI Media Generation (Audio)
   ↓
4. Format Response
   ↓
5. Chat Output
```

## Advanced Workflows

### Example 1: Image Editing Pipeline

Generate and edit images:

```
1. Manual Trigger
   ↓
2. AI Media Generation (generate base image)
   ↓
3. HTTP Request (upload to storage)
   ↓
4. IF (downloadUrl exists)
   ↓
5. Code Node (process image)
   ↓
6. AI Media Generation (edit image - when supported)
   ↓
7. Send to Webhook
```

**Code Node**:
```javascript
// Transform the image URL for storage
const imageUrl = $input.item.json.url;

return {
  json: {
    originalUrl: imageUrl,
    filename: `image_${Date.now()}.png`,
    timestamp: new Date().toISOString()
  }
};
```

### Example 2: Content Generation Pipeline

Generate multi-media content:

```
1. Webhook (content request)
   ↓
2. AI Agent (generate script)
   ↓
3. Split into parallel:
   ├─ Branch 1: AI Media Generation (Image for thumbnail)
   ├─ Branch 2: AI Media Generation (Audio narration)
   └─ Branch 3: AI Media Generation (Video background)
   ↓
4. Wait for all branches
   ↓
5. Code Node (combine results)
   ↓
6. Webhook Response (final content)
```

**Input**:
```json
{
  "topic": "The future of renewable energy",
  "duration": 60
}
```

### Example 3: Automated Social Media Posts

Generate and post content:

```
1. Cron (daily at 9 AM)
   ↓
2. Google Sheets (get topics)
   ↓
3. Loop over topics
   ↓
4. AI Agent (generate caption)
   ↓
5. AI Media Generation (generate image)
   ↓
6. Code Node (create post)
   ↓
7. Social Media (post to platform)
   ↓
8. Sheets (mark as posted)
```

**Code Node**:
```javascript
const caption = $input.item.json.caption;
const imageUrl = $input.item.json.url;

return {
  json: {
    caption,
    imageUrl,
    hashtags: ['#AI', '#GenerativeArt', '#Tech'],
    platform: 'twitter'
  }
};
```

### Example 4: Dynamic Storybook

Create an interactive storybook:

```
1. Webhook (story request)
   ↓
2. AI Agent (generate story outline)
   ↓
3. Loop over scenes
   ↓
4. AI Agent (generate scene description)
   ↓
5. AI Media Generation (generate scene image)
   ↓
6. AI Media Generation (generate narration audio)
   ↓
7. Code Node (compile scene)
   ↓
8. Aggregate all scenes
   ↓
9. Code Node (create storybook)
   ↓
10. Webhook Response (return storybook)
```

**Scene Code**:
```javascript
const scene = {
  number: $input.item.json.sceneNumber,
  description: $input.item.json.description,
  imageUrl: $input.item.json.url,
  audioUrl: $input.item.json.audioUrl,
  duration: $input.item.json.duration
};

return { json: scene };
```

## Error Handling

### Example 1: Retry Failed Requests

```
1. AI Media Generation
   ↓
2. IF (error)
   ↓
3. Wait (5 seconds)
   ↓
4. Go back to step 1 (max 3 retries)
   ↓
5. IF (still failed)
   ↓
6. Send error notification
```

### Example 2: Fallback Provider

```
1. AI Media Generation (Provider A)
   ↓
2. IF (error OR rate limit)
   ↓
3. AI Media Generation (Provider B - fallback)
   ↓
4. Continue workflow
```

**Switch Node Code**:
```javascript
// Check if first generation failed
if ($input.item.json.error) {
  return { json: { useFallback: true } };
}
return { json: { useFallback: false } };
```

## Tips and Best Practices

### 1. Prompt Engineering

**Good prompts**:
- Be specific: "A serene sunset over a calm ocean, digital art"
- Use style descriptors: "oil painting, impressionist style"
- Specify quality: "high quality, detailed, 4K"

**Bad prompts**:
- Too vague: "nice picture"
- Overly complex: 500+ word descriptions
- Contradictory: "A dark bright sunny day"

### 2. Batch Optimization

- Use caching for identical requests
- Limit concurrent requests to avoid rate limits
- Add delays between batches
- Monitor usage and costs

### 3. Result Management

- Save URLs to database for later retrieval
- Download and store important images
- Clean up temporary files
- Track generation costs

### 4. Error Recovery

- Always handle API errors gracefully
- Implement retry logic with exponential backoff
- Have fallback providers ready
- Log errors for debugging

## Troubleshooting Examples

### Example 1: Timeout Issues

If requests timeout frequently:

```json
{
  "options": {
    "asyncProcessing": true,
    "maxWaitTime": 600
  }
}
```

### Example 2: Rate Limiting

If hitting rate limits:

```json
{
  "options": {
    "enableCache": true,
    "cacheTTL": 86400
  }
}
```

Then add a Wait node between batches.

### Example 3: Quality Issues

If output quality is low:

```json
{
  "quality": "hd",
  "steps": 50,
  "cfgScale": 7
}
```

For images, or:

```json
{
  "model": "Multilingual v2",
  "similarityBoost": 0.9,
  "useSpeakerBoost": true
}
```

For audio.
