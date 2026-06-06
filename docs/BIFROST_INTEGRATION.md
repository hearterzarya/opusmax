# Bifrost Gateway Integration

This document explains how to integrate Bifrost Gateway as the upstream AI provider for OpusX Gateway.

## Architecture Overview

```
Client / Claude Code / Cursor / VS Code
  → OpusX on Vercel (customer-facing gateway)
  → Bifrost deployed separately (Railway/Render/VPS)
  → Real AI providers (Anthropic/OpenAI/Gemini/etc.)
```

## Key Features

- OpusX remains the front-facing gateway for customers
- Customers continue using their existing `sk-ox-*` keys
- Bifrost acts as a unified upstream gateway to multiple providers
- Automatic fallback to direct provider if Bifrost is unavailable
- Model mapping between OpusX names and Bifrost provider-prefixed names
- Streaming responses preserved
- Usage logging maintained

## Environment Variables

Add these to your `.env.local` file:

```bash
# Bifrost Gateway Configuration
BIFROST_BASE_URL=https://your-bifrost-domain.com
BIFROST_INTERNAL_KEY=your-internal-key-optional

# Keep existing provider config as fallback
UPSTREAM_ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_API_KEY=sk-ant-api03-...
```

## Deployment

### 1. Deploy Bifrost Gateway

Deploy Bifrost on Railway, Render, or your own VPS:

```bash
# Example Railway deployment
railway init bifrost-gateway
railway up
```

Ensure Bifrost is accessible at a public URL (e.g., `https://bifrost-railway.up.railway.app`).

### 2. Configure OpusX

Set the following environment variables on Vercel:

```env
BIFROST_BASE_URL=https://your-bifrost-domain.com
BIFROST_INTERNAL_KEY=your-internal-api-key

# These are kept as fallback
UPSTREAM_ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_API_KEY=your-real-anthropic-key
```

## Model Mapping

OpusX automatically maps model names to Bifrost's provider-prefixed format:

### Anthropic Models
- `claude-opus-4.8` → `anthropic/claude-opus-4-8`
- `claude-opus-4.7` → `anthropic/claude-opus-4-7`
- `claude-sonnet-4.6` → `anthropic/claude-sonnet-4-6`
- `claude-haiku-4.5` → `anthropic/claude-haiku-4-5`

### OpenAI Models
- `gpt-4o-mini` → `openai/gpt-4o-mini`
- `gpt-4o` → `openai/gpt-4o`
- `gpt-4-turbo` → `openai/gpt-4-turbo`
- `gpt-3.5-turbo` → `openai/gpt-3.5-turbo`

### Google Models
- `gemini-1.5-pro` → `google/gemini-1.5-pro`
- `gemini-1.5-flash` → `google/gemini-1.5-flash`

### Groq Models
- `llama-3.1-70b` → `groq/llama-3.1-70b`
- `llama-3.1-8b` → `groq/llama-3.1-8b`

If a model already has a provider prefix (e.g., `anthropic/claude-3-sonnet-20240229`), it's passed through unchanged.

## Request Flow

### Anthropic Requests

```bash
curl -X POST https://opusxmax.vercel.app/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ox-your-api-key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4.6",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'
```

### OpenAI Requests

```bash
curl -X POST https://opusxmax.vercel.app/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ox-your-api-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## Testing

### 1. Test Direct Connection

```bash
# Test Bifrost connection directly
curl -X GET https://your-bifrost-domain.com/openai/v1/models \
  -H "Authorization: Bearer your-internal-key"
```

### 2. Test Through OpusX

```bash
# Test non-streaming request
curl -X POST https://opusxmax.vercel.app/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ox-test-key" \
  -d '{
    "model": "claude-sonnet-4.6",
    "messages": [
      {"role": "user", "content": "Hello! What is the capital of France?"}
    ]
  }'

# Test streaming request
curl -X POST https://opusxmax.vercel.app/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ox-test-key" \
  -H "Accept: text/event-stream" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4.6",
    "messages": [
      {"role": "user", "content": "Tell me a short story"}
    ],
    "stream": true
  }'
```

### 3. Test Fallback Behavior

Temporarily disable Bifrost to verify fallback:

```bash
# Temporarily comment out BIFROST_BASE_URL in your deployment
# Then test again - requests should fall back to direct provider
```

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**
   - Check Bifrost URL is correct
   - Verify Bifrost is running and accessible
   - Check logs: `console.error('[messages] upstream', error)`

2. **Authentication Errors**
   - Verify `BIFROST_INTERNAL_KEY` is correct
   - Check if Bifrost requires authentication

3. **Streaming Not Working**
   - Ensure Bifrost supports streaming
   - Check headers are preserved correctly

4. **Model Not Found**
   - Check model mapping in `src/lib/bifrost.ts`
   - Try using full provider prefix (e.g., `anthropic/claude-sonnet-4-6`)

### Debug Headers

Check response headers to see which provider is being used:

- `x-opusx-models`: `static` | `bifrost` | `merged` | `direct`

### Logs

OpusX logs will show:
- `Bifrost failed, falling back to direct upstream` - when fallback occurs
- Model source in usage logs
- Provider information in streaming metrics

## Security Notes

- Never expose `BIFROST_INTERNAL_KEY` to clients
- Customer `sk-ox-*` keys are only validated by OpusX
- Bifrost keys are never sent to clients
- All traffic goes through OpusX's validation layer
- Quota and rate limits are enforced by OpusX

## Performance Considerations

- Bifrost adds one extra hop in the request chain
- For optimal performance, deploy Bifrost in the same region as OpusX
- Bifrost should be deployed with sufficient resources to handle throughput
- Monitor Bifrost health with the pre-warm connection feature