---
name: twitter-poll
description: Create and manage Twitter/X polls via OAuth 1.0a. Use when the user wants to run a poll on Twitter/X, check poll results, or schedule a recurring poll. Supports custom poll durations (default 24h) and up to 4 options.
emoji: 📊
tags: [twitter, x, poll, social, automation]
visibility: public
---

# Twitter Poll Skill

Create polls on Twitter/X and fetch live results — all via OAuth 1.0a.

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

---

## Creating a Poll

To create a poll, use `execute_cli` with the `twitter-api-v2@1.17.2` package. The script should:

1. Read OAuth credentials from env vars: `X_API_KEY`, `X_API_KEY_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`
2. Create a `TwitterApi` client with OAuth 1.0a credentials
3. Call `client.v2.tweet()` with a `poll` object containing:
   - `options` — array of plain strings (2–4 options, e.g. `["Yes", "No"]`)
   - `duration_minutes` — integer between 5 and 10080 (default: `1440` = 24h)
   - `text` — the poll question as the tweet text
4. Output the tweet ID, question, options, duration, end time, and URL as JSON

**Duration limits:**
- Minimum: 5 minutes
- Maximum: 10,080 minutes (7 days)
- Default: 1,440 minutes (24 hours)

**Example output:**
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

## Fetching Poll Results

To get current vote counts for a poll, use `execute_cli` with `twitter-api-v2@1.17.2`. The script should:

1. Read OAuth credentials from env vars (same as above)
2. Call `client.v2.singleTweet(tweetId, { expansions: ['attachments.poll_ids'], 'tweet.fields': ['attachments'], 'poll.fields': ['options', 'end_datetime', 'voting_status', 'duration_minutes'] })`
3. Extract the poll from `response.includes.polls[0]`
4. Calculate total votes and percentage per option
5. Set `status` to `"open"` or `"closed"` based on `voting_status` or whether end time has passed
6. Output results as JSON

**Example output:**
```json
{
  "tweetId": "1234567890",
  "question": "Which chain has the best UX?",
  "status": "closed",
  "endsAt": "2026-04-26T15:00:00.000Z",
  "totalVotes": 142,
  "options": [
    { "label": "Base",     "votes": 87, "pct": "61.3%" },
    { "label": "Solana",   "votes": 31, "pct": "21.8%" },
    { "label": "Ethereum", "votes": 18, "pct": "12.7%" },
    { "label": "Other",    "votes":  6, "pct":  "4.2%" }
  ]
}
```

---

## Recurring Polls

To run a poll on a schedule, use a Bankr automation.

### Example: Weekly Poll (every Monday 9am ET)

**Cron (UTC):** `0 13 * * 1`

**Prompt:**

> Run the twitter-poll skill. Use execute_cli with twitter-api-v2@1.17.2 to create a poll with question "What's your biggest crypto focus this week?" and options "Trading", "Building", "Learning", "HODLing". Use the default 24h duration. Read OAuth credentials from X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET. Output the tweet URL and end time.

---

## Live Example

This poll was created and resolved using this skill:

- **Tweet:** https://x.com/i/web/status/2048058839522509102
- **Question:** "testing my twitter poll skill again 🧪 vote yes if you see this!"
- **Result:** Yes 👍 — 3 votes (100%), No 👎 — 0 votes (0%) — closed after 5 minutes

---

## Example User Prompts

- "Run a 24h poll asking which L2 people prefer, options: Base, Solana, Ethereum, Other"
- "Create a poll: 'Best meme coin?' with options PEPE, DOGE, WIF, Other — run for 48 hours"
- "Check the results on my poll, tweet ID is 1234567890"
- "Set up a weekly Monday poll asking my followers what they're building"
- "How is my poll doing?" *(requires tweet ID from the create step)*

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `403 Forbidden` | App lacks Write permissions — enable in X Developer Portal |
| `401 Unauthorized` | Keys wrong or expired — regenerate in X Developer Portal |
| `429 Too Many Requests` | Rate limited — wait and retry |
| Poll options error | Pass options as plain strings, not objects — `["Yes", "No"]` not `[{label: "Yes"}]` |
| Poll shows 0 votes | Poll may have just been created — votes appear in real-time as they come in |
