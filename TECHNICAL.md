# Technical Documentation for n8n-nodes-ai-media-gen

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Installation & Setup](#installation--setup)
- [API Reference](#api-reference)
- [Development Guide](#development-guide)
- [Error Codes & Troubleshooting](#error-codes--troubleshooting)
- [Changelog](#changelog)

---

## Architecture Overview

### Project Structure

```
n8n-nodes-ai-media-gen/
├── nodes/
│   ├── base/
│   │   └── BaseMediaGenNode.ts    # Base class for all media gen nodes
│   ├── AIMediaGen.ts              # Main AI media generation node
│   ├── DoubaoGen.ts               # Doubao-specific media gen node
│   ├── credentials/               # API credential definitions
│   │   ├── modelScopeApi.credentials.ts
│   │   └── doubaoApi.credentials.ts
│   ├── utils/                    # Utility functions
│   │   ├── cache.ts              # Cache management (LRU)
│   │   ├── monitoring.ts         # Performance monitoring
│   │   ├── errors.ts             # Custom error types & retry logic
│   │   ├── errorHandling.ts      # Unified error handling
│   │   ├── responseHandler.ts    # Response data extraction
│   │   ├── paramValidation.ts    # Parameter validation
│   │   ├── httpRequest.ts        # HTTP request utilities
│   │   ├── polling.ts            # Task polling utilities
│   │   ├── binaryData.ts         # Binary data handling
│   │   ├── constants.ts          # Project constants
│   │   ├── helpers.ts            # Helper functions
│   │   ├── types.ts              # TypeScript type definitions
│   │   └── index.ts              # Central exports
│   ├── icons/                    # Node icons
│   └── index.ts                  # Node exports
├── dist/                         # Compiled output
├── gulpfile.js                   # Build configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Project configuration
```

### Node Classes

#### BaseMediaGenNode

Base class providing common functionality for all AI media generation nodes:

- **Execution Template**: Handles batch processing with proper error handling
- **Caching**: Integrated `CacheManager` for response caching
- **Monitoring**: Integrated `PerformanceMonitor` for metrics
- **Helper Methods**:
  - `normalizeSeed()` - Normalizes seed values
  - `isDataUri()` - Checks for data URIs
  - `handleItemError()` - Unified error handling
  - `getCredentials()` - Credential extraction with validation

#### AIMediaGen

Main node supporting multiple AI platforms:

| Platform | Operation | Models |
|----------|-----------|--------|
| ModelScope | Image Generation | Tongyi-MAI/Z-Image, Qwen-Image-2512 |
| Nano Banana | Image Generation | nano-banana, nano-banana-2 |
| Sora | Video Generation | OpenAI Sora |
| Veo | Video Generation | Google Veo |

#### DoubaoGen

Dedicated Doubao API node:

| Operation | Models |
|-----------|--------|
| Text to Image | Doubao Seedream 4.5, 4.0 |
| Image to Image | Doubao Seedream 4.5, 4.0 |
| Video Generation | Seedance 1.5 Pro, 1.0 Pro, 1.0 Pro Fast, 1.0 Lite |

---

## Installation & Setup

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- n8n instance (Docker, npm, or Desktop)

### Build Process

#### 1. Install Dependencies

```bash
cd /path/to/n8n-nodes-ai-media-gen
npm install
```

#### 2. Build the Project

```bash
npm run build
```

This will:
- Clean the `dist` directory
- Compile TypeScript files to JavaScript
- Generate source maps for debugging
- Copy `package.json` to `dist`
- Copy icon files to `dist/nodes`

#### 3. Verify Build Output

```bash
ls -la dist/nodes/
```

Expected files:
```
dist/
├── package.json
├── nodes/
│   ├── AIMediaGen.js
│   ├── AIMediaGen.d.ts
│   ├── DoubaoGen.js
│   ├── DoubaoGen.d.ts
│   ├── credentials/
│   ├── icons/
│   └── utils/
└── index.js
```

### Deployment Methods

#### Method 1: Docker Deployment (Recommended)

**docker-compose.yml**:
```yaml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=password
      - NODE_FUNCTION_ALLOW_BUILTIN=crypto,fs
      - NODE_FUNCTION_ALLOW_EXTERNAL=*
    volumes:
      - ./n8n-data:/home/node/.n8n
      # Mount custom nodes
      - ./n8n-nodes-ai-media-gen/dist:/home/node/.n8n/custom/n8n-nodes-ai-media-gen:ro
```

```bash
docker-compose down
docker-compose up -d
```

#### Method 2: Local npm Installation

```bash
cd /path/to/n8n-nodes-ai-media-gen
npm install -g .
n8n restart
```

#### Method 3: Copy to Custom Nodes Directory

**For Docker**:
```bash
cp -r dist /path/to/n8n/data/.n8n/custom/n8n-nodes-ai-media-gen
docker restart n8n
```

**For local npm**:
```bash
cp -r dist ~/.n8n/custom/n8n-nodes-ai-media-gen
n8n restart
```

#### Method 4: Community Node Installation via UI

1. Open n8n Web Interface
2. Go to **Settings** → **Community Nodes**
3. Click **Install from Package**
4. Enter: `n8n-nodes-ai-media-gen`
5. Click **Install**

### Verification

#### Via n8n Web Interface

1. Create a new workflow
2. Add a node
3. Search for:
   - **AI Media Generation** (AIMediaGen)
   - **Doubao Media Generation** (DoubaoGen)

Both nodes should appear in the node list.

#### Via API

```bash
curl -X GET http://localhost:5678/rest/nodes \
  -H "Content-Type: application/json"
```

Should return both "aiMediaGen" and "doubaoGen".

---

## API Reference

### Credentials

#### ModelScope API

**Fields**:
- `apiKey` (required): ModelScope API key
- `baseUrl` (optional): Custom base URL (default: `https://api-inference.modelscope.cn/v1`)

#### Doubao API

**Fields**:
- `apiKey` (required): Volcengine API key
- `baseUrl` (optional): Custom base URL (default: `https://ark.cn-beijing.volces.com/api/v3`)

#### Google PaLM API

**Fields**:
- `apiKey` (required): API key from ai.comfly.chat
- `host` (optional): Host (default: `ai.comfly.chat`)

#### OpenAI API

**Fields**:
- `apiKey` (required): API key
- `organizationId` (optional): Organization ID
- `baseUrl` (optional): Custom base URL

### Common Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | required | Text description for generation |
| `model` | string | - | Model to use |
| `size` | string | - | Image size (e.g., "2048x2048") |
| `seed` | number | -1 | Random seed (-1 for random) |
| `timeout` | number | 60000 | Request timeout (ms) |
| `enableCache` | boolean | false | Enable response caching |

### Utility Modules

#### CacheManager

```typescript
import { CacheManager } from './utils/cache';

const cache = new CacheManager();
await cache.set(key, value, ttl);
const value = await cache.get(key);
await cache.delete(key);
await cache.clear();
```

#### PerformanceMonitor

```typescript
import { PerformanceMonitor } from './utils/monitoring';

const monitor = new PerformanceMonitor();
const startTime = monitor.startTimer('operation');
// ... do work
const duration = monitor.endTimer(startTime);

monitor.recordMetric({
  provider: 'modelscope',
  model: 'qwen-image-2512',
  mediaType: 'image',
  duration,
  success: true,
  timestamp: new Date().toISOString(),
  fromCache: false,
});

const stats = monitor.getStats({ provider: 'modelscope' });
```

#### ErrorHandler

```typescript
import { ErrorHandler } from './utils/errorHandling';

// Convert any error to NodeOperationError
const nodeError = ErrorHandler.toNodeOperationError(error, context, itemIndex);

// Create error result for continueOnFail
const errorResult = ErrorHandler.createErrorResult(error);

// Log error with context
ErrorHandler.logError(error, context, itemIndex, 'MyOperation');
```

#### ResponseHandler

```typescript
import { ResponseHandler } from './utils/responseHandler';

// Extract image data from response
const imageData = ResponseHandler.handleImageData(imageUrl, base64Data);

// Check if download needed
if (ResponseHandler.shouldDownloadImage(imageData)) {
  // Download image
}

// Create binary data object
const binaryData = ResponseHandler.createBinaryData(buffer, url, 'prefix');
```

---

## Development Guide

### Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build for production |
| `npm run build:dev` | Build with development settings |
| `npm run dev` | Watch mode for development |
| `npm run type-check` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm test` | Run Jest tests |
| `npm run format` | Format code with Prettier |

### Adding a New Node

1. Create node file in `nodes/`:

```typescript
import { BaseMediaGenNode, ItemProcessContext } from './base/BaseMediaGenNode';
import type { INodeTypeDescription, INodeExecutionData } from 'n8n-workflow';

export class MyNode extends BaseMediaGenNode {
  description: INodeTypeDescription = {
    displayName: 'My Node',
    name: 'myNode',
    // ... node description
  };

  protected async processItem(
    item: INodeExecutionData,
    context: ItemProcessContext
  ): Promise<INodeExecutionData[]> {
    // Implementation here
    return [{ json: { result: '...' } }];
  }
}
```

2. Export node in `nodes/index.ts`:

```typescript
import { MyNode } from './MyNode';

export const nodeClasses = [
  AIMediaGen,
  DoubaoGen,
  MyNode,
];
```

3. Add to `package.json` n8n.nodes array:

```json
{
  "n8n": {
    "nodes": [
      "nodes/AIMediaGen.js",
      "nodes/DoubaoGen.js",
      "nodes/MyNode.js"
    ]
  }
}
```

### Adding a New Utility

1. Create utility file in `nodes/utils/`
2. Export from `nodes/utils/index.ts`

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

---

## Error Codes & Troubleshooting

### Error Codes

| Code | Retryable | Description |
|------|-----------|-------------|
| `INVALID_API_KEY` | No | API key is invalid or missing |
| `RATE_LIMIT` | Yes | Rate limit exceeded |
| `NETWORK_ERROR` | Yes | Network error occurred |
| `TIMEOUT` | Yes | Request timed out |
| `API_ERROR` | No | API error occurred |
| `INVALID_PARAMS` | No | Invalid parameters provided |
| `SERVICE_UNAVAILABLE` | Yes | Service temporarily unavailable |

### Common Issues

#### Problem: Nodes Not Appearing in List

**Solution**:
```bash
# 1. Check build output
ls -la dist/nodes/

# 2. Check package.json in dist
cat dist/package.json | grep -A 10 '"n8n"'

# 3. Check files in container (if using Docker)
docker exec n8n ls -la /home/node/.n8n/custom/n8n-nodes-ai-media-gen/

# 4. Restart n8n
docker-compose restart n8n

# 5. Check logs
docker logs n8n | grep -i "custom node\|ai-media-gen\|doubao"
```

#### Problem: MODULE_NOT_FOUND Error

**Solution**: Ensure `package.json` uses correct dependency format:

```json
{
  "dependencies": {
    "n8n-workflow": "~1.0.0"
  }
}
```

#### Problem: TypeScript Compilation Errors

**Solution**:
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
npm run lint
```

#### Problem: Node Execution Fails

**Checklist**:
- ✅ API key is correct and active
- ✅ Network connection is working
- ✅ Model name is correct
- ✅ Parameters meet model requirements
- ✅ Sufficient account balance

### Recent Fixes Summary

#### Version 0.0.3 (2025-01-31)

**Removed**:
- **Qwen-Image-Edit-2511 model**: Completely removed image editing model and all related functionality

**Breaking Changes**:
- Workflows using `Qwen/Qwen-Image-Edit-2511` model will no longer function

#### Version 0.0.2 (2025-01-29)

**Fixed**:
- **Security**: Fixed ESLint violations for n8n community node package compliance
  - Removed duplicate `buildDev` function declaration
  - Added ESLint disable comments for restricted globals

---

## Changelog

### [0.0.8] - Current (Refactoring Release)

**Added**:
- `BaseMediaGenNode` base class for code reuse
- `ErrorHandler` utility for unified error handling
- `ResponseHandler` utility for response data extraction
- Consolidated validation modules (merged `validators.ts` into `paramValidation.ts`)

**Changed**:
- Fixed duplicate `n8n` configuration in `package.json`
- Added `DoubaoGen.js` to nodes array in `package.json`
- Updated `.gitignore` to include `.pytest_cache/` and `.coverage/`

**Removed**:
- `nodes/utils/validators.ts` (merged into `paramValidation.ts`)

**Documentation**:
- Created `TECHNICAL.md` consolidating all technical documentation
- Merged `DEPLOYMENT.md`, `DEPLOYMENT_CHECKLIST.md`, `FIXES_SUMMARY.md` into `TECHNICAL.md`

### [0.0.3] - 2025-01-31

**Removed**:
- **Qwen-Image-Edit-2511 model**: Completely removed image editing model and all related functionality

### [0.0.2] - 2025-01-29

**Fixed**:
- **Security**: Fixed ESLint violations for n8n community node package compliance

### [1.1.0] - 2025-01-28

**Added**:
- Input validation for `numImages`, `size`, `inputImage` parameters
- Comprehensive test suite
- JSDoc documentation

**Fixed**:
- **Critical**: Fixed parameter access bug with wrong index in multi-item workflows
- **Critical**: Fixed error code preservation

**Removed**:
- Unused utility files (~54k lines of dead code)
- Unused dependencies (sharp)

---

## Support

- **GitHub Issues**: [https://github.com/ksxh0524/n8n-nodes-ai-media-gen/issues](https://github.com/ksxh0524/n8n-nodes-ai-media-gen/issues)
- **README**: See main README for usage examples and platform-specific documentation
- **Platform Documentation**: Refer to platform-specific API docs for detailed parameter information

---

**Last Updated**: 2025-02-01
**Version**: 0.0.8
**Maintainer**: ksxh0524
