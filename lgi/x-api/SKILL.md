---
name: x-api
description: Post to X (Twitter) using the official API with OAuth 1.0a. Use when you need to tweet, post updates, or publish content. Bypasses rate limits and bot detection that affect cookie-based approaches like bird CLI.
---

# x-api 🐦

Post to X using the official API (OAuth 1.0a).

## When to Use

- Posting tweets (cookie-based `bird tweet` gets blocked by bot detection)
- Official API access is needed for reliability

For **reading** (timeline, search, mentions), use `bird` CLI instead — it's free and works well for reads.

## Setup

### 1. Get API Credentials

1. Go to https://developer.x.com/en/portal/dashboard
2. Create a Project and App
3. Set App permissions to **Read and Write**
4. Get your keys from "Keys and tokens" tab:
   - API Key (Consumer Key)
   - API Key Secret (Consumer Secret)
   - Access Token
   - Access Token Secret

### 2. Configure Credentials

**Option A: Environment variables**
```bash
export X_API_KEY="your-api-key"
export X_API_SECRET="your-api-secret"
export X_ACCESS_TOKEN="your-access-token"
export X_ACCESS_SECRET="your-access-token-secret"
```

**Option B: Config file** at `~/.clawdbot/secrets/x-api.json`
```json
{
  "consumerKey": "your-api-key",
  "consumerSecret": "your-api-secret",
  "accessToken": "your-access-token",
  "accessTokenSecret": "your-access-token-secret"
}
```

### 3. Install Dependency

```bash
npm install -g twitter-api-v2
```

## Post a Tweet

```bash
x-post "Your tweet text here"
```

Or with full path:
```bash
node /path/to/skills/x-api/scripts/x-post.mjs "Your tweet text here"
```

Supports multi-line tweets:
```bash
x-post "Line one

Line two

Line three"
```

Returns the tweet URL on success.

## Limits

- Free tier: 1,500 posts/month (requires credits in X Developer Portal)
- Basic tier ($100/mo): Higher limits

## Reading (use bird)

For reading, searching, and monitoring — use the `bird` CLI:

```bash
bird home                    # Timeline
bird mentions                # Mentions
bird search "query"          # Search
bird user-tweets @handle     # User's posts
bird read <tweet-url>        # Single tweet
```

## Troubleshooting

**402 Credits Depleted**: Add credits in X Developer Portal → Dashboard

**401 Unauthorized**: Regenerate Access Token (ensure Read+Write permissions are set first)

**No credentials found**: Set env vars or create config file (see Setup above)
