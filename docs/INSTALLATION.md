# Installation Guide

Detailed installation instructions for n8n-nodes-ai-media-gen.

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- n8n >= 1.0.0 (for using the node)

## Installation Methods

### Method 1: Install in Existing n8n Installation

1. **Navigate to n8n custom nodes directory**:
   ```bash
   cd ~/.n8n/custom
   ```

   Or if using Docker, mount the volume:
   ```bash
   docker exec -it n8n bash
   cd /data/custom
   ```

2. **Clone or copy the package**:
   ```bash
   git clone https://github.com/n8n-nodes-ai-media-gen.git
   # Or copy from local path
   cp -r /path/to/n8n-nodes-ai-media-gen .
   ```

3. **Install dependencies**:
   ```bash
   cd n8n-nodes-ai-media-gen
   npm install
   ```

4. **Build the package**:
   ```bash
   npm run build
   ```

5. **Restart n8n**:
   ```bash
   # If running standalone
   n8n stop
   n8n start

   # If using Docker
   docker restart n8n
   ```

6. **Verify installation**:
   - Open n8n editor
   - Add a new node
   - Search for "AI Media Generation"
   - The node should appear in the list

### Method 2: Install via npm link (Development)

For local development:

1. **Navigate to the project directory**:
   ```bash
   cd /path/to/n8n-nodes-ai-media-gen
   ```

2. **Install and build**:
   ```bash
   npm install
   npm run build
   npm link
   ```

3. **Link in n8n**:
   ```bash
   cd ~/.n8n
   npm link n8n-nodes-ai-media-gen
   ```

4. **Restart n8n**

### Method 3: Docker Installation

Add to your `docker-compose.yml`:

```yaml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_CUSTOM_NODE_DIR=/data/custom
    volumes:
      - ./n8n-data:/data
      - ./custom-nodes:/data/custom
```

Then:

```bash
# Create custom nodes directory
mkdir -p custom-nodes

# Copy the package
cp -r n8n-nodes-ai-media-gen custom-nodes/

# Start Docker
docker-compose up -d
```

## Configuration

### API Keys

You need to configure API keys for each provider:

1. **OpenAI**:
   - Go to https://platform.openai.com/api-keys
   - Create an API key
   - In n8n: Credentials → Add → OpenAI API

2. **Stability AI**:
   - Go to https://platform.stability.ai/account/keys
   - Create an API key
   - In n8n: Credentials → Add → Stability AI API

3. **ElevenLabs**:
   - Go to https://elevenlabs.io
   - Sign up and get API key
   - In n8n: Credentials → Add → ElevenLabs API

### Node Configuration

1. **Add the node** to your workflow
2. **Select media type**: Image, Video, or Audio
3. **Select provider**: OpenAI, Stability AI, ElevenLabs, etc.
4. **Select model**: DALL-E 3, SDXL, TTS, etc.
5. **Configure parameters**:
   - Prompt (required)
   - Size, quality, style (optional)
   - Number of items (optional)
   - Seed for reproducibility (optional)
6. **Advanced options**:
   - Enable caching
   - Use binary output
   - Async processing for long tasks

## Verification

### Test the Installation

Create a simple test workflow:

1. Add "AI Media Generation" node
2. Configure:
   - Media Type: Image
   - Provider: OpenAI
   - Model: DALL-E 3
   - Prompt: "A serene sunset over a calm ocean"
3. Execute the workflow
4. You should receive an image URL in the output

### Check Logs

If the node doesn't appear:

```bash
# Check n8n logs
n8n logs

# Or Docker logs
docker logs n8n

# Look for custom node loading errors
```

## Troubleshooting

### Node Not Appearing

**Problem**: Node doesn't show up in n8n editor

**Solutions**:
1. Verify build completed successfully
2. Check node is in correct directory
3. Restart n8n completely
4. Clear n8n cache: `rm -rf ~/.n8n/cache`
5. Check n8n logs for errors

### Import Errors

**Problem**: "Cannot find module" errors

**Solutions**:
1. Run `npm install` in the package directory
2. Verify `n8n-workflow` is installed
3. Rebuild: `npm run build`
4. Check TypeScript compilation succeeded

### API Authentication Errors

**Problem**: "Invalid API key" or "Authentication failed"

**Solutions**:
1. Verify API key is correct
2. Check API key has required permissions
3. Ensure API key is not expired
4. Check provider account status

### Rate Limiting

**Problem**: "Rate limit exceeded" errors

**Solutions**:
1. Enable caching in node options
2. Reduce batch size
3. Add delays between requests
4. Upgrade API plan if needed

## Updating

To update to the latest version:

```bash
cd /path/to/n8n-nodes-ai-media-gen
git pull origin main
npm install
npm run build
# Restart n8n
```

## Uninstallation

To remove the package:

```bash
# Remove the package directory
rm -rf /path/to/n8n-nodes-ai-media-gen

# Or if installed via npm link
npm unlink -g n8n-nodes-ai-media-gen

# Restart n8n
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/n8n-nodes-ai-media-gen/issues
- Documentation: See `docs/` directory
