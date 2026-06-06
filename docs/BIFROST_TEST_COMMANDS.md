# Bifrost Integration Test Commands

These commands help you test the Bifrost integration with OpusX.

## Prerequisites

- Have a valid OpusX API key (`sk-ox-*`)
- Bifrost Gateway deployed and accessible
- OpusX deployed with Bifrost environment variables set

## Test Commands

### 1. Check OpusX Health

```bash
curl -X GET https://opusxmax.vercel.app/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 2. Check API Key Status

```bash
curl -X GET "https://opusxmax.vercel.app/api/key-status?key=sk-ox-your-api-key"
# Should show usage stats and key details
```

### 3. Test Bifrost Connection (Direct)

```bash
# Test Bifrost models endpoint
curl -X GET "https://your-bifrost-domain.com/openai/v1/models" \
  -H "Authorization: Bearer your-bifrost-internal-key"
```

### 4. Test Anthropic Messages Through Bifrost

```bash
# Non-streaming request
curl -X POST https://opusxmax.vercel.app/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ox-your-api-key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4.6",
    "messages": [
      {"role": "user", "content": "Hello! What is the capital of France?"}
    ],
    "max_tokens": 100
  }'
```

### 5. Test Streaming Through Bifrost

```bash
# Streaming request
curl -X POST https://opusxmax.vercel.app/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ox-your-api-key" \
  -H "Accept: text/event-stream" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4.6",
    "messages": [
      {"role": "user", "content": "Tell me a short story about a cat"}
    ],
    "stream": true,
    "max_tokens": 200
  }'
```

### 6. Test OpenAI Chat Completion Through Bifrost

```bash
curl -X POST https://opusxmax.vercel.app/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ox-your-api-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello! What is 2 + 2?"}
    ],
    "max_tokens": 100
  }'
```

### 7. Test Model Mapping

```bash
# Test different model formats
curl -X POST https://opusxmax.vercel.app/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ox-your-api-key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-opus-4.8",
    "messages": [
      {"role": "user", "content": "Test message"}
    ]
  }'

# With Bifrost prefix
curl -X POST https://opusxmax.vercel.app/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ox-your-api-key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "anthropic/claude-opus-4.8",
    "messages": [
      {"role": "user", "content": "Test message"}
    ]
  }'
```

### 8. Test Error Cases

```bash
# Invalid API key
curl -X POST https://opusxmax.vercel.app/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ox-invalid" \
  -d '{
    "model": "claude-sonnet-4.6",
    "messages": [{"role": "user", "content": "test"}]
  }'

# Missing model
curl -X POST https://opusxmax.vercel.app/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ox-your-api-key" \
  -d '{
    "messages": [{"role": "user", "content": "test"}]
  }'

# Bifrost unavailable (temporarily disable BIFROST_BASE_URL)
# Should fall back to direct upstream
```

### 9. Test Rate Limiting

```bash
# Make multiple requests quickly to test RPM limits
for i in {1..5}; do
  curl -X POST https://opusxmax.vercel.app/api/v1/messages \
    -H "Content-Type: application/json" \
    -H "x-api-key: sk-ox-your-api-key" \
    -H "anthropic-version: 2023-06-01" \
    -d '{
      "model": "claude-sonnet-4.6",
      "messages": [{"role": "user", "content": "Test $i"}]
    }' &
done
wait
```

### 10. Check Models List

```bash
curl -X GET "https://opusxmax.vercel.app/api/v1/models" \
  -H "x-api-key: sk-ox-your-api-key"
# Check x-opusx-models header to see if using bifrost
```

## Verification Steps

After running tests, verify:

1. **Success Cases**
   - Requests complete with 200 status
   - Responses contain expected content
   - Streaming shows `[DONE]` message

2. **Headers Check**
   - `x-opusx-models` header shows source (`bifrost`, `merged`, etc.)
   - `content-type` is correct for responses

3. **Logging**
   - Check OpusX logs for "Bifrost failed" messages (if fallback occurs)
   - Verify usage is logged correctly

4. **Performance**
   - Check response times
   - Monitor for timeouts (30s Bifrost timeout)

## Debug Commands

### View Recent Usage

```bash
# Check key status to see recent usage
curl -X GET "https://opusxmax.vercel.app/api/key-status?key=sk-ox-your-api-key"
```

### Check Admin Dashboard (if available)

```
https://opusxmax.vercel.app/admin/usage
```

## Test Script

Create a test script file `test-bifrost.sh`:

```bash
#!/bin/bash

echo "=== Bifrost Integration Test Script ==="
echo

API_KEY="sk-ox-your-api-key"
BASE_URL="https://opusxmax.vercel.app"

echo "1. Testing health endpoint..."
curl -s "$BASE_URL/api/health"

echo -e "\n\n2. Testing models endpoint..."
curl -s -H "x-api-key: $API_KEY" "$BASE_URL/api/v1/models"

echo -e "\n\n3. Testing non-streaming message..."
curl -s -X POST "$BASE_URL/api/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4.6",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

echo -e "\n\n4. Testing streaming message..."
curl -s -X POST "$BASE_URL/api/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "Accept: text/event-stream" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4.6",
    "messages": [{"role": "user", "content": "Tell me a joke"}],
    "stream": true
  }' | head -n 10

echo -e "\n\n=== Test Complete ==="
```

Run with:
```bash
chmod +x test-bifrost.sh
./test-bifrost.sh
```