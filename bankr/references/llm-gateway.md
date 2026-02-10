# LLM Gateway Reference

The Bankr LLM Gateway is a unified API for Claude, Gemini, GPT, and other models. It provides multi-provider access, cost tracking, automatic failover, and SDK compatibility through a single endpoint.

**Base URL:** `https://llm.bankr.bot`

The gateway accepts both `https://llm.bankr.bot` and `https://llm.bankr.bot/v1` — it normalizes paths automatically. Works with both OpenAI and Anthropic API formats.

## Authentication

The gateway uses your **LLM key** for authentication. The key resolution order:

1. `BANKR_LLM_KEY` environment variable
2. `llmKey` in `~/.bankr/config.json`
3. Falls back to your Bankr API key (`BANKR_API_KEY` / `apiKey`)

Most users only need a single key for both the agent API and the LLM gateway. Set a separate LLM key only if your keys have different permissions or rate limits.

### Setting the LLM Key

**Via CLI:**
```bash
bankr login --llm-key YOUR_LLM_KEY            # during login
bankr config set llmKey YOUR_LLM_KEY           # after login
```

**Via environment variable:**
```bash
export BANKR_LLM_KEY=your_llm_key_here
```

**Verify:**
```bash
bankr config get llmKey
```

## Available Models

| Model | Provider | Best For |
|-------|----------|----------|
| `claude-opus-4.6` | Anthropic | Most capable, advanced reasoning |
| `claude-opus-4.5` | Anthropic | Complex reasoning, architecture |
| `claude-sonnet-4.5` | Anthropic | Balanced speed and quality |
| `claude-haiku-4.5` | Anthropic | Fast, cost-effective |
| `gemini-3-pro` | Google | Long context (2M tokens) |
| `gemini-3-flash` | Google | High throughput |
| `gemini-2.5-pro` | Google | Long context, multimodal |
| `gemini-2.5-flash` | Google | Speed, high throughput |
| `gpt-5.2` | OpenAI | Advanced reasoning |
| `gpt-5.2-codex` | OpenAI | Code generation |
| `gpt-5-mini` | OpenAI | Fast, economical |
| `gpt-5-nano` | OpenAI | Ultra-fast, lowest cost |
| `kimi-k2.5` | Moonshot AI | Long-context reasoning |
| `qwen3-coder` | Alibaba | Code generation, debugging |

```bash
# Fetch live model list from the gateway
bankr llm models
```

## Credits

Check your LLM gateway credit balance:

```bash
bankr llm credits
```

Returns your remaining USD credit balance. When credits are exhausted, gateway requests will fail with HTTP 402.

## Tool Integrations

### OpenClaw

Auto-install the Bankr provider into your OpenClaw config:

```bash
# Write config to ~/.openclaw/openclaw.json
bankr llm setup openclaw --install

# Preview the config without writing
bankr llm setup openclaw
```

This writes the following provider config (with your key and all available models):

```json
{
  "models": {
    "providers": {
      "bankr": {
        "baseUrl": "https://llm.bankr.bot",
        "apiKey": "your_key_here",
        "api": "openai-completions",
        "models": [
          { "id": "claude-sonnet-4.5", "name": "Claude Sonnet 4.5", "api": "anthropic-messages" },
          { "id": "claude-haiku-4.5", "name": "Claude Haiku 4.5", "api": "anthropic-messages" },
          { "id": "gemini-3-flash", "name": "Gemini 3 Flash" },
          { "id": "gpt-5.2", "name": "GPT 5.2" }
        ]
      }
    }
  }
}
```

Claude models are automatically configured with `"api": "anthropic-messages"` per-model overrides while all other models use the default `"api": "openai-completions"`.

To use a Bankr model as your default in OpenClaw, add to `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "bankr/claude-sonnet-4.5"
      }
    }
  }
}
```

### Claude Code

Two ways to use Claude Code with the gateway:

**Option A: Launch directly (recommended)**

```bash
# Launch Claude Code through the gateway
bankr llm claude

# Pass any Claude Code flags through
bankr llm claude --model claude-sonnet-4.5
bankr llm claude --allowedTools Edit,Write,Bash
bankr llm claude --resume
```

All arguments after `claude` are forwarded to the `claude` binary. The CLI sets `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` automatically from your config (using `llmKey` if set, otherwise `apiKey`).

**Option B: Set environment variables**

```bash
# Print the env vars to add to your shell profile
bankr llm setup claude
```

This outputs:
```bash
export ANTHROPIC_BASE_URL="https://llm.bankr.bot"
export ANTHROPIC_AUTH_TOKEN="your_key_here"
```

Add these to `~/.zshrc` or `~/.bashrc` so all Claude Code sessions use the gateway.

### OpenCode

```bash
# Auto-install Bankr provider into ~/.config/opencode/opencode.json
bankr llm setup opencode --install

# Preview without writing
bankr llm setup opencode
```

### Cursor

```bash
# Get step-by-step setup instructions with your API key
bankr llm setup cursor
```

The setup adds your key as the OpenAI API Key, sets `https://llm.bankr.bot/v1` as the base URL override, and registers the available model IDs. When the base URL override is enabled, all model requests go through the gateway.

## Direct SDK Usage

The gateway is compatible with standard OpenAI and Anthropic SDKs — just override the base URL.

### curl (OpenAI format)

```bash
curl -X POST "https://llm.bankr.bot/v1/chat/completions" \
  -H "Authorization: Bearer $BANKR_LLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4.5",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### curl (Anthropic format)

```bash
curl -X POST "https://llm.bankr.bot/v1/messages" \
  -H "x-api-key: $BANKR_LLM_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4.5",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://llm.bankr.bot/v1",
    api_key="your_bankr_key",
)

response = client.chat.completions.create(
    model="claude-sonnet-4.5",
    messages=[{"role": "user", "content": "Hello"}],
)
```

### OpenAI SDK (TypeScript)

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://llm.bankr.bot/v1",
  apiKey: "your_bankr_key",
});

const response = await client.chat.completions.create({
  model: "gemini-3-flash",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Anthropic SDK (Python)

```python
from anthropic import Anthropic

client = Anthropic(
    base_url="https://llm.bankr.bot",
    api_key="your_bankr_key",
)

message = client.messages.create(
    model="claude-sonnet-4.5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)
```

## Troubleshooting

### 401 Unauthorized
- Verify key is set: `bankr config get llmKey` or `echo $BANKR_LLM_KEY`
- Check for leading/trailing spaces
- Ensure the key hasn't expired

### 402 Payment Required
- Credits exhausted: `bankr llm credits` shows $0.00
- Top up credits at [bankr.bot/api](https://bankr.bot/api)

### Model not found
- Use exact model IDs (e.g., `claude-sonnet-4.5`, not `claude-3-sonnet`)
- Check available models: `bankr llm models`

### Claude Code not found
- `bankr llm claude` requires Claude Code to be installed separately
- Install: https://docs.anthropic.com/en/docs/claude-code

### Slow responses
- Try `claude-haiku-4.5` or `gemini-3-flash` for faster responses
- The gateway has automatic failover — temporary slowness usually resolves itself

---

**Documentation**: https://docs.bankr.bot/llm-gateway/overview
