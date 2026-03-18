# Inclawbator API Reference

## Chat Endpoint

```
POST https://inclawbate.com/api/inclawbate/agent-chat
```

The Inclawbator is a conversational agent. Send a message, it picks the right tool and responds. No tool selection needed on your end.

**Request:**
```json
{
  "message": "I want to launch a token called MoonCat on Base",
  "session_id": "optional — reuse to continue a conversation",
  "wallet": "optional — 0x address for personalized responses"
}
```

**Response:**
```json
{
  "reply": "The agent's text response",
  "function_called": "configure_token_launch",
  "session_id": "sess_abc123"
}
```

**`function_called`** tells you which tool the agent used (or null if it just replied). Useful for programmatic flows.

---

## Available Tools (auto-selected by the agent)

| Tool | Trigger phrases |
|------|----------------|
| `launch_token_info` | "launch a token", "create a token", "deploy a token" |
| `configure_token_launch` | (called automatically as you provide token details) |
| `deploy_staking` | "create staking pool", "add staking to my token" |
| `register_project` | "register my existing token", "join Inclawbate ecosystem" |
| `health_check` | "how is my project doing", "check my token" |
| `get_token_analytics` | "price of 0x...", "volume for my token" |
| `get_staking_stats` | "staking APY", "TVL", "my staking position" |
| `get_project_status` | "what have I launched", "my projects" |
| `get_user_workspace` | "what have I built", "my workspace" |
| `create_agent_info` | "create marketing agent", "auto-post to X" |
| `setup_x_agent` | "set up X agent", "automated posting" |
| `book_promo` | "promote my project", "buy a shoutout" |
| `disperse_tokens` | "airdrop tokens", "distribute to wallets" |
| `build_app_info` | "build an app", "create an app" |
| `build_landing_page` | "make a landing page", "build a website" |
| `browse_apps` | "show me apps", "what apps exist" |
| `suggest_app_ideas` | "app ideas", "what should I build" |
| `browse_inclawbators` | "find a designer", "who can help with dev" |
| `hire_inclawbator` | "I need a logo", "hire someone for marketing" — posts to Council |
| `get_ecosystem_info` | "what is Inclawbate", "tell me about CLAWS" |
| `get_incubation_info` | "full incubation", "handle everything for me" |
| `get_staking_info` | "how do I stake", "staking info" |

---

## Direct Data Endpoints

These return raw JSON without the conversational agent:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/inclawbate/analytics` | GET | CLAWS price, volume, staking TVL, platform metrics |
| `/api/inclawbate/staking` | GET | Treasury stats, top stakers. Add `?wallet=0x...` for position |
| `/api/inclawbate/fee-report?wallet=0x...` | GET | Pending WETH fees, per-token daily earnings |
| `/api/inclawbate/health-check?address=0x...` | GET | Token price, volume, staking, suggestions |
| `/api/inclawbate/apps` | GET | Browse app store. `?search=`, `?category=` |
| `/api/inclawbate/inclawbators` | GET | Browse the Inclawbate Council. `?skill=design` |

---

## Error Responses

```json
{"error": "Description of what went wrong"}
```

| Status | Meaning |
|--------|---------|
| 400 | Missing or invalid parameters |
| 429 | Rate limit exceeded |
| 500 | Server error |
