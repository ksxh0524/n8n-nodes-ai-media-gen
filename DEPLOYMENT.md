# Deployment Guide for n8n-nodes-ai-media-gen

This guide explains how to build and deploy the n8n-nodes-ai-media-gen community node to n8n.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Build Process](#build-process)
- [Deployment Methods](#deployment-methods)
- [Verification](#verification)
- [Available Nodes](#available-nodes)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- n8n instance (Docker, npm, or Desktop)

## 🏗️ Build Process

### 1. Install Dependencies

```bash
cd /path/to/n8n-nodes-ai-media-gen
npm install
```

### 2. Build the Project

```bash
npm run build
```

This will:
- ✅ Clean the `dist` directory
- ✅ Compile TypeScript files to JavaScript
- ✅ Generate source maps for debugging
- ✅ Copy `package.json` to `dist`
- ✅ Copy icon files to `dist/nodes`
- ✅ Build both nodes: AIMediaGen and DoubaoGen

### 3. Verify Build Output

Check that the following files exist in the `dist` directory:

```
dist/
├── package.json
├── nodes/
│   ├── AIMediaGen.js (139KB - main node)
│   ├── AIMediaGen.d.ts
│   ├── DoubaoGen.js (38KB - dedicated node)
│   ├── DoubaoGen.d.ts
│   ├── credentials/
│   │   ├── modelScopeApi.credentials.js
│   │   └── doubaoApi.credentials.js
│   ├── icons/
│   │   ├── ai-media-gen.svg
│   │   └── modelscope.svg
│   ├── utils/ (utility modules)
│   └── index.js
└── ... (other files)
```

### 4. Run Linting (Optional)

```bash
npm run lint
```

## 🚀 Deployment Methods

### Method 1: Docker Deployment (Recommended)

If you're running n8n in Docker, mount the `dist` directory as a volume:

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

**Apply changes**:
```bash
docker-compose down
docker-compose up -d
```

### Method 2: Local npm Installation

If you're running n8n locally via npm:

```bash
# Option A: Install from local directory
cd /path/to/n8n-nodes-ai-media-gen
npm install -g .

# Option B: Install from dist directory
cd dist
npm link
```

Then restart n8n:
```bash
n8n restart
```

### Method 3: Copy to Custom Nodes Directory

**For Docker installations**:
```bash
# Copy dist directory to n8n custom nodes
cp -r dist /path/to/n8n/data/.n8n/custom/n8n-nodes-ai-media-gen

# Restart n8n container
docker restart n8n
```

**For local npm installations**:
```bash
# Copy dist directory to n8n custom nodes
cp -r dist ~/.n8n/custom/n8n-nodes-ai-media-gen

# Restart n8n
n8n restart
```

### Method 4: Community Node Installation via n8n UI

1. Open n8n Web Interface
2. Go to **Settings** → **Community Nodes**
3. Click **Install from Package**
4. Enter package name: `n8n-nodes-ai-media-gen`
5. Click **Install**

## ✅ Verification

After deployment, verify the nodes are available:

### Via n8n Web Interface

1. Open n8n Web Interface
2. Create a new workflow
3. Add a node
4. Search for:
   - **AI Media Generation** (AIMediaGen)
   - **Doubao Media Generation** (DoubaoGen)

Both nodes should appear in the node list with their respective icons.

### Via API

```bash
# Get all nodes
curl -X GET http://localhost:5678/rest/nodes \
  -H "Content-Type: application/json"

# Should return both "aiMediaGen" and "doubaoGen"
```

## 📦 Available Nodes

### 1. AI Media Generation (AIMediaGen)

**Display Name**: AI Media Generation
**Node Name**: `aiMediaGen`
**File**: `nodes/AIMediaGen.js`
**Size**: ~139KB compiled

**Supported Operations**:
- **ModelScope** - Image generation (Tongyi-MAI/Z-Image, Qwen-Image-2512)
- **Nano Banana** - Image generation (nano-banana, nano-banana-2)
- **Sora** - Video generation (OpenAI Sora)
- **Veo** - Video generation (Google Veo)

**Credentials Required**:
- ModelScope API
- Google PaLM API (for Nano Banana)
- OpenAI API (for Sora)
- Google PaLM API (for Veo)

### 2. Doubao Media Generation (DoubaoGen)

**Display Name**: Doubao Media Generation
**Node Name**: `doubaoGen`
**File**: `nodes/DoubaoGen.js`
**Size**: ~38KB compiled

**Supported Operations**:
- **Text to Image** - Generate images from text (Doubao Seedream 4.5/4.0)
- **Image to Image** - Edit images with AI (Doubao Seedream 4.5/4.0)
- **Video Generation** - Generate videos (Doubao Seedance 1.5 Pro/1.0 Pro/1.0 Pro Fast/1.0 Lite)

**Supported Resolutions**:
- **2K**: 2048x2048, 2304x1728, 1728x2304, 2560x1440, 1440x2560, 2496x1664, 1664x2496, 3024x1296
- **4K**: 4096x4096, 4608x3456, 3456x4608, 5120x2880, 2880x5120, 4992x3328, 3328x4992, 6048x2592

**Credentials Required**:
- Doubao API

## 🔑 Credentials Configuration

After installation, configure credentials in n8n:

### ModelScope API

1. Go to **Credentials** → **Create New Credential**
2. Select **ModelScope API**
3. Enter:
   - **Name**: Credential name (e.g., "ModelScope API")
   - **API Key**: Your ModelScope API key
   - **Base URL**: Optional, default is `https://api-inference.modelscope.cn/v1`
4. Save

### Doubao API

1. Go to **Credentials** → **Create New Credential**
2. Select **Doubao API**
3. Enter:
   - **Name**: Credential name (e.g., "Doubao API")
   - **API Key**: Your Volcengine API key
   - **Base URL**: Optional, default is `https://ark.cn-beijing.volces.com/api/v3`
4. Save

### Google PaLM API (for Nano Banana & Veo)

1. Go to **Credentials** → **Create New Credential**
2. Select **Google PaLM API**
3. Enter:
   - **Name**: Credential name (e.g., "Nano Banana API")
   - **API Key**: API key from ai.comfly.chat
   - **Host**: Leave empty or `ai.comfly.chat`
4. Save

### OpenAI API (for Sora)

1. Go to **Credentials** → **Create New Credential**
2. Select **OpenAI API**
3. Enter:
   - **Name**: Credential name (e.g., "Sora API")
   - **API Key**: API key from ai.comfly.chat
   - **Base URL**: Leave empty or `https://api.openai.com/v1`
4. Save

## 🔧 Troubleshooting

### Problem 1: Nodes Not Appearing in List

**Solution**:
```bash
# 1. Check build output
ls -la dist/nodes/
# Should see AIMediaGen.js, DoubaoGen.js, credentials/, icons/

# 2. Check package.json in dist
cat dist/package.json | grep -A 10 '"n8n"'

# 3. Check files in container (if using Docker)
docker exec n8n ls -la /home/node/.n8n/custom/n8n-nodes-ai-media-gen/

# 4. Restart n8n
docker-compose restart n8n

# 5. Check logs
docker logs n8n | grep -i "custom node\|ai-media-gen\|doubao"
```

### Problem 2: MODULE_NOT_FOUND Error

**Solution**: Ensure `package.json` uses correct dependency format:

```json
{
  "dependencies": {
    "n8n-workflow": "^1.0.0"
  }
}
```

### Problem 3: TypeScript Compilation Errors

**Solution**:
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
npm run lint
```

### Problem 4: Linting Errors

**Solution**:
```bash
# Auto-fix linting issues
npm run lint:fix

# If auto-fix doesn't work, fix manually
npm run lint
```

### Problem 5: Node Execution Fails

**Checklist**:
- ✅ API key is correct and active
- ✅ Network connection is working
- ✅ Model name is correct
- ✅ Parameters meet model requirements
- ✅ Sufficient account balance

## 📊 Project Structure

```
n8n-nodes-ai-media-gen/
├── nodes/
│   ├── AIMediaGen.ts         # Main node (139KB compiled)
│   ├── DoubaoGen.ts          # Doubao dedicated node (38KB compiled)
│   ├── credentials/          # API credential definitions
│   │   ├── modelScopeApi.credentials.ts
│   │   └── doubaoApi.credentials.ts
│   ├── utils/                # Utility functions (refactored)
│   │   ├── httpRequest.ts     # HTTP request utility
│   │   ├── polling.ts         # Polling utility
│   │   ├── paramValidation.ts # Validation utilities
│   │   ├── binaryData.ts      # Binary data utilities
│   │   ├── constants.ts       # Shared constants
│   │   ├── errors.ts          # Error handling
│   │   ├── cache.ts           # Cache management
│   │   ├── monitoring.ts      # Performance monitoring
│   │   ├── validators.ts      # Input validators
│   │   ├── helpers.ts         # Helper functions
│   │   └── index.ts           # Central exports
│   └── icons/                # Node icons
├── dist/                      # Compiled output (deploy this)
│   ├── nodes/
│   │   ├── AIMediaGen.js
│   │   ├── DoubaoGen.js
│   │   └── ...
│   └── package.json
├── gulpfile.js               # Build configuration
├── tsconfig.json             # TypeScript configuration
└── package.json             # Project configuration
```

## 🔄 Development Mode

For development with auto-rebuild:

```bash
npm run dev
```

This will:
- Watch for file changes in `nodes/`
- Automatically rebuild on changes
- Generate source maps

## 📦 Publishing to npm

To publish a new version:

1. **Update version** in `package.json`:
   ```json
   {
     "version": "0.0.7"
   }
   ```

2. **Run quality checks**:
   ```bash
   npm run build
   npm run lint
   npm test
   ```

3. **Publish to npm**:
   ```bash
   npm publish
   ```

4. **Verify**:
   ```bash
   npm view n8n-nodes-ai-media-gen
   ```

## 🚀 Continuous Deployment

For automated deployment, consider:

### GitHub Actions Workflow

```yaml
name: Build and Deploy
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Dependencies
        run: npm install

      - name: Build Project
        run: npm run build

      - name: Run Linting
        run: npm run lint

      - name: Run Tests
        run: npm test

      - name: Upload Build Artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
```

## 📈 Changelog

### v0.0.6 (Current)
- ✅ Refactored code with utility infrastructure
- ✅ Added DoubaoGen as standalone node
- ✅ Fixed all ESLint errors
- ✅ Added Sora and Veo platform support
- ✅ Updated documentation with new platform order

### Previous Versions
See [CHANGELOG.md](CHANGELOG.md) for detailed history.

## 💬 Support

- **GitHub Issues**: [https://github.com/ksxh0524/n8n-nodes-ai-media-gen/issues](https://github.com/ksxh0524/n8n-nodes-ai-media-gen/issues)
- **README**: [https://github.com/ksxh0524/n8n-nodes-ai-media-gen/blob/main/README.md](https://github.com/ksxh0524/n8n-nodes-ai-media-gen/blob/main/README.md)
- **Platform Documentation**: See README for each platform's API documentation

## 🎯 Quick Deployment Checklist

Before deploying, ensure:

- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Both nodes appear in dist/nodes/
- [ ] package.json includes both nodes in n8n.nodes array
- [ ] Credentials are properly exported
- [ ] Icons are copied to dist/nodes/

After deploying:

- [ ] Restart n8n
- [ ] Verify both nodes appear in node list
- [ ] Test with sample workflow
- [ ] Check n8n logs for errors

---

**Last Updated**: 2025-01-30
**Version**: 0.0.6
**Maintainer**: ksxh0524
