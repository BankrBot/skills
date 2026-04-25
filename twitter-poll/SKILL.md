---
name: twitter-poll
description: Create and manage Twitter/X polls via OAuth 1.0a. Use when the user wants to run a poll on Twitter/X, check poll results, or schedule a recurring poll. Supports custom poll durations (default 24h) and up to 4 options.
emoji: 📊
tags: [twitter, x, poll, social, automation]
visibility: public
---

# Twitter Poll Skill

Create polls on Twitter/X, then fetch live results — all via OAuth 1.0a.

## When To Use

- **Run a poll** — "post a poll asking which chain is best"
- **Check poll results** — "how is my poll doing?" / "get results for poll 123..."
- **Schedule a recurring poll** — "run a poll every week asking..."
- **Custom duration** — "run a 48h poll on..."

## Prerequisites

### Environment Variables

Set these in your Bankr settings (gear icon → Env Vars). Generate them from the [X Developer Portal](https://developer.x.com/en/portal/dashboard) with **Read and Write** permissions:

- `X_API_KEY` — Consumer Key (OAuth 1.0a)
- `X_API_KEY_SECRET` — Consumer Secret
- `X_ACCESS_TOKEN` — User Access Token
- `X_ACCESS_TOKEN_SECRET` — User Access Token Secret

The app **must** have Write permissions. Read-only keys cannot create polls.

### Label Your Account as Automated

If this account posts programmatically, mark it automated on X:

1. Log in → **Settings** → **Your account** → **Account information** → **Automation**
2. Set the managing account and save

Direct link: https://x.com/settings/account/automation

## Scripts

All scripts live in `scripts/` and use `twitter-api-v2@1.17.2`.

### `scripts/create-poll.js`

Creates a poll tweet. Reads config from environment or CLI args.

**Usage:**

```bash
node scripts/create-poll.js \
  --question "Which chain has the best UX?" \
  --options "Base" "Solana" "Ethereum" "Other" \
  --duration 1440
```

**Arguments:**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--question` | ✅ | — | Poll question / tweet text |
| `--options` | ✅ | — | 2–4 poll options (space-separated, quote each) |
| `--duration` | ❌ | `1440` | Poll duration in minutes (5–10080; default = 24h) |

**Output (JSON to stdout):**

```json
{
  "tweetId": "1234567890",
  "question": "Which chain has the best UX?",
  "options": ["Base", "Solana", "Ethereum", "Other"],
  "durationMinutes": 1440,
  "endsAt": "2026-04-26T15:00:00.000Z",
  "url": "https://x.com/i/web/status/1234567890"
}
```

---

### `scripts/get-poll-results.js`

Fetches current vote counts for a poll by tweet ID.

**Usage:**

```bash
node scripts/get-poll-results.js --tweet-id 1234567890
```

**Arguments:**

| Flag | Required | Description |
|------|----------|-------------|
| `--tweet-id` | ✅ | Tweet ID of the poll (from create output or URL) |

**Output (JSON to stdout):**

```json
{
  "tweetId": "1234567890",
  "question": "Which chain has the best UX?",
  "status": "open",
  "endsAt": "2026-04-26T15:00:00.000Z",
  "totalVotes": 142,
  "options": [
    { "label": "Base",     "votes": 87, "pct": "61.3%" },
    { "label": "Solana",   "votes": 31, "pct": "21.8%" },
    { "label": "Ethereum", "votes": 18, "pct": "12.7%" },
    { "label": "Other",    "votes":  6, "pct": "4.2%"  }
  ]
}
```

`status` is `"open"` while the poll is running, `"closed"` once it ends.

---

## Recurring Polls

To run a poll on a schedule, use a Bankr automation with this skill.

### Example: Weekly Poll (every Monday 9am ET)

**Cron (UTC):** `0 13 * * 1`

**Prompt:**

> Run the twitter-poll skill. Create a poll with question "What's your biggest crypto focus this week?" and options "Trading" "Building" "Learning" "HODLing". Use the default 24h duration. After creating, output the tweet URL and the time it ends.

### Example: Custom Duration

**Prompt:**

> Run the twitter-poll skill. Create a 48h poll with question "Should we ship the new feature?" and options "Yes, ship it" "Needs more work" "More info needed".

---

## Implementation Notes

### Duration Limits (X API)

- Minimum: **5 minutes**
- Maximum: **10,080 minutes** (7 days)
- Default: **1440 minutes** (24 hours)

Durations outside this range are clamped and a warning is printed.

### Rate Limits

Free-tier X API: ~50 tweets/day. Each poll creation counts as 1 tweet.

### Fetching Poll Results

Poll data (vote counts) requires the `polls` expansion and is only available to apps with **Elevated** access or above. If your app is at Basic tier, vote counts may be unavailable — the script will return the question and end time but note the limitation.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `403 Forbidden` | App lacks Write permissions — enable in X Developer Portal |
| `401 Unauthorized` | Keys wrong or expired — regenerate in X Developer Portal |
| `429 Too Many Requests` | Rate limited — wait and retry |
| Poll results show `null` votes | App needs Elevated access for poll metrics |
| `node: command not found` | Use `bun scripts/create-poll.js` if node isn't available |

---

## Example User Prompts

- "Run a 24h poll on Twitter asking which L2 people prefer"
- "Create a poll: 'Best meme coin?' with options PEPE, DOGE, WIF, Other — run for 48 hours"
- "Check the results on my poll, tweet ID is 1234567890"
- "Set up a weekly Monday poll asking my followers what they're building"
- "How is my poll doing?" *(requires tweet ID from the create output)*
