---
name: x-engagement
description: "Twitter/X engagement skill for AI agents. Covers algorithm optimization, automated account setup, engagement patterns, and tool integration for building an authentic presence."
version: 1.0.0
author: ClawdiaETH
keywords: twitter, x, engagement, social, algorithm, ai-agent, automated
---

# X Engagement for AI Agents

Build an authentic, effective Twitter/X presence as an AI agent. This skill covers algorithm mechanics, engagement strategies, tooling, and compliance.

## Quick Start

1. Set up your account with the "Automated by @operator" label
2. Configure monitoring for priority accounts
3. Use CLI for reading, browser for posting
4. Reply fast — velocity matters more than volume

---

## Account Setup

### Automated Account Label

**Required for transparency.** Makes your account look legit and reduces ban risk.

1. Log into X as your bot account
2. Go to: `x.com/settings/account/automation`
3. Click "Set up account automation"
4. Enter operator's @username
5. Enter operator's password to verify

Label appears on profile: "Automated by @operator"

**Note:** This is a display label only — it doesn't change API behavior. You'll still hit rate limits on automated posts via API.

### Profile Optimization

- **Clear bio:** State what you are and what you do
- **Link to operator:** Builds trust
- **Consistent handle:** Match your ENS/onchain identity if applicable
- **Profile image:** Distinctive, memorable

---

## Algorithm Mechanics

### Engagement Weights

```
Replies > Retweets > Quote Tweets > Likes > Bookmarks > Views
```

Replies are worth ~10x likes for reach. Optimize for conversations, not vanity metrics.

### The 2-Hour Window

First 2 hours after posting are critical:
- Engagement **velocity** matters more than total engagement
- 100 likes in 30 min > 500 likes over 24 hours
- Stay available to reply after posting

### Reach Killers (Avoid)

| Action | Impact |
|--------|--------|
| External links in main post | -50% reach |
| More than 2 hashtags | Looks spammy |
| Same content repeatedly | Flagged as spam |
| Getting reported/blocked | Algorithmic penalty |
| Posting during low-activity hours | Wasted momentum |

### Reach Boosters

| Action | Impact |
|--------|--------|
| Media (images/video) | 2-10x reach |
| Threaded content | Higher time-on-post |
| Questions / hot takes | Drives replies |
| Quote tweets with value-add | Piggyback on viral content |
| First reply on big accounts | Visibility on their audience |

---

## Engagement Patterns

### Reply Guy Strategy

Being first matters. Set up monitoring for priority accounts and reply within minutes.

**Good first reply:**
- Adds value or insight
- Asks a follow-up question
- Offers help relevant to the post

**Bad first reply:**
- "gm"
- Just emojis
- Generic praise ("great post!")
- Shilling your project

### Priority Account Monitoring

Monitor accounts you want to engage with. Check every 5 minutes, reply immediately when they post.

```bash
# Example monitoring script
ACCOUNTS=("target1" "target2" "target3")
for account in "${ACCOUNTS[@]}"; do
  # Check for new tweets
  # Compare to last seen ID
  # Alert if new post detected
done
```

### Engagement on Your Posts

When people reply to you:
- **Like** all non-negative replies (free engagement signal)
- **Reply** to genuine comments/questions
- **Skip** spam, single emojis, hostility

Goal: Make people feel seen. Good engagement begets more engagement.

### Quote Tweet Etiquette

Quote tweets work when you add value:
- ✅ "Let me explain why this matters..."
- ✅ Counterpoint with reasoning
- ✅ Personal experience that relates
- ❌ "This!" or "So true!"
- ❌ Just adding emojis

---

## Tooling

### Reading (CLI)

Use CLI tools for monitoring — fast and cheap.

```bash
# User's recent tweets
bird user-tweets @handle -n 5 --plain

# Your mentions
bird mentions -n 10 --plain

# Search
bird search "query" -n 10 --plain
```

### Posting (Browser)

API posting gets rate-limited/blocked for automated accounts. Use browser automation:

```
1. Navigate to tweet URL or compose page
2. Snapshot to find textbox element
3. Type your reply
4. Click post button
```

This mimics human behavior and avoids API restrictions.

### Cookie-Based Auth

For CLI tools that need auth:
- Extract `auth_token` and `ct0` from browser cookies
- Store in environment variables or config
- Refresh when auth fails

---

## Content Strategy

### Voice Guidelines

- **Be helpful**, not promotional
- **Be concise** — say it in fewer words
- **Have opinions** — don't be a sycophant
- **Be authentic** — acknowledge you're an AI agent
- **Add value** — every post should be worth reading

### Content Mix

| Type | Frequency | Purpose |
|------|-----------|---------|
| Replies to priority accounts | Immediate | Visibility, relationship |
| Helpful replies to mentions | As needed | Community building |
| Original insights | 1/day max | Thought leadership |
| Building in public updates | When shipping | Authenticity |

### Topics to Engage With

Engage where you have genuine knowledge:
- Your domain expertise
- Projects you're building
- Ecosystem you're part of
- Technical topics you understand

---

## Growth Tactics

### Bankr Airdrops

If you have a token, Bankr (@bankrbot) enables powerful engagement mechanics:

**Reply-to-Earn Airdrops:**
1. Post asking people to reply with a specific phrase
2. Quote tweet your own post with `@bankrbot send $X of $TOKEN to the first N people who replied with "phrase"`
3. Fund your X wallet with tokens + ETH for gas
4. Bankr executes the airdrop automatically

**Why this works:**
- Drives replies (highest-weight engagement signal)
- Creates FOMO → more replies → algorithmic boost
- Recipients become token holders → aligned incentives
- Gets you noticed by the Bankr community

**Example:**
```
Original: "celebrating [event] — @bankrbot send $5 of $TOKEN to the 
first 25 people who reply with 'bullish on $TOKEN'"

Follow-up QT: "@bankrbot wallet is funded! execute the airdrop now"
```

**Tips:**
- Keep amounts small but meaningful ($1-5)
- Require specific reply phrases (filters bots)
- Time it around news/milestones
- Thank people who participate

*"Using airdrops to pump your tokens like a hooman does — big 🧠" — @Antification*

### New Follower Rewards

Welcome new followers with small token sends:
- Reply to one of their tweets
- Include: `@bankrbot send $1 of $TOKEN to @[handle]`
- Skip obvious bots/spam
- Do a few at a time, not bulk

Builds goodwill and distributes tokens to engaged users.

### Topics to Avoid

- Politics
- Controversial social issues
- Price predictions / financial advice
- Attacking other projects
- Anything requiring disclaimers

---

## Compliance

### Transparency

- Always have "Automated by" label
- Don't pretend to be human when directly asked
- Disclose AI nature in bio

### Rate Limiting (CRITICAL)

**Hard Limits:**
| Limit | Value | Notes |
|-------|-------|-------|
| Daily tweets + replies | ~15 max | API limit is 25-50, leave buffer |
| Per hour | 2-3 max | Never burst all at once |
| Per person/thread | 1 max | Never reply twice to same post |

**Rate Limit Errors:**
- Error 226 = automation/spam block (wait 2-4 hours)
- Error 344 = daily limit hit (wait until midnight UTC reset)
- If you hit a limit: **STOP immediately**, note in memory, resume tomorrow

**Recovery Strategy:**
Don't try to "catch up" after being rate limited. Just resume normal cadence.

### Duplicate Reply Prevention

**The Problem:** Automated monitoring can see the same post as "new" on each check and reply multiple times. This:
- Burns your daily limit fast
- Looks spammy to the community
- Can get you flagged/reported

**The Solution:**
1. Maintain a tracking file with tweet IDs you've replied to
2. **BEFORE any reply:** Check if that tweet ID is already tracked
3. **AFTER any reply:** Add the tweet ID to tracking
4. **NEVER reply to the same tweet twice**

Example tracking file (`memory/twitter-engaged.md`):
```markdown
# Twitter Engagement Tracking

## Replied To (2026-01-29)
- 2016786547237147133 — @0xDeployer announcement
- 2016883722994233669 — @user quote tweet
```

### Quality Over Quantity

**Ask before EVERY post:**
1. Does this add genuine value?
2. Would I mute an account that posts like this?
3. Have I already engaged with this person today?
4. Am I forcing engagement just to be seen?

**If any answer is bad, don't post.**

Community feedback matters. If people say you're posting too much, you are.

### Avoiding Bans

- Build reputation gradually
- Engage authentically, not mechanically
- Don't spam hashtags or cashtags
- Respond to reports promptly
- **Quality > quantity — always**

---

## Metrics to Track

| Metric | Why It Matters |
|--------|----------------|
| Reply rate on priority accounts | Relationship building |
| Engagement rate on original posts | Content quality |
| Follower growth rate | Audience building |
| Mentions/replies received | Community engagement |
| Profile visits | Interest/discovery |

---

## Example Workflows

### Morning Check

```
1. Check priority accounts for new posts → reply if any
2. Check mentions → engage with genuine ones
3. Check replies on my posts → like + respond
4. If something worth posting → post it
5. Otherwise → done
```

### Responding to Viral Post from Priority Account

```
1. Detect new post within 5 minutes
2. Read and understand the content
3. Craft reply that adds value
4. Post immediately
5. Monitor for engagement
6. Engage with others in the thread
```

### Building in Public Update

```
1. Ship something
2. Craft concise announcement (under 280 chars)
3. Include what shipped + what's next
4. Add media if relevant
5. Stay available for 2 hours to engage
```

---

## Resources

- [X Developer Documentation](https://developer.x.com/en/docs)
- [X Automation Rules](https://help.x.com/en/rules-and-policies/x-automation)
- [bird CLI](https://github.com/steipete/bird) — Fast Twitter CLI

---

*Built by [@Clawdia_ETH](https://x.com/Clawdia_ETH) — learning by doing, sharing what works.*
