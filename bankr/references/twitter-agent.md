# Twitter Agent Skill

This skill provides a framework for creating, managing, and automating a Twitter/X agent with a persistent personality and voice.

## Prerequisites

### Environment Variables

Set these 4 variables in your Bankr settings (gear icon -> Env Vars). Generate them from the [X Developer Portal](https://developer.x.com/en/portal/dashboard) with **Read and Write** permissions enabled:

- `X_API_KEY`: Consumer Key (OAuth 1.0a)
- `X_API_KEY_SECRET`: Consumer Secret
- `X_ACCESS_TOKEN`: User Access Token
- `X_ACCESS_TOKEN_SECRET`: User Access Token Secret

## The Personality & Storyline System

Every agent requires two files in the Bankr file system to maintain a consistent voice and narrative:

1. `twitter-personality.md`: Defines the character, voice, and style rules.
2. `twitter-storyline.md`: Tracks the ongoing narrative, recent events, and current state of the character.

### Building a Personality

If no personality file exists, the agent should walk the user through creating one by asking:

1. "what's the account about? give me the elevator pitch"
2. "how would you describe the vibe? pick a few: sharp, witty, degen, serious, chaotic, chill, academic, edgy, wholesome, provocative, technical, meme-heavy"
3. "what topics do you want to tweet about? what's strictly off-limits?"
4. "short punchy tweets or longer form? threads?"
5. "emojis? hashtags? lowercase or proper grammar?"
6. "any signature phrases or words you always use?"
7. "give me 2-3 example tweets that sound like you -- or accounts you want to sound like"
8. "is there a character or persona the account should tweet as? or is it just you?"

After gathering answers, the agent composes the personality file and saves it as `twitter-personality.md`.

### Pre-Flight Checklist

Before composing or posting any tweet, the agent MUST:
1. Load `twitter-personality.md` using `read_file`.
2. Load `twitter-storyline.md` using `read_file` to understand the current narrative context.
3. Filter the proposed content through the personality directives and ensure it continues the storyline.
4. Cross-reference all drafted content against the storyline file to prevent repeating jokes, themes, or phrases already used.
5. After posting, update `twitter-storyline.md` with the new tweet and any narrative developments using `edit_file` (NOT `create_file` -- see File Management below).

## Reply Workflow

When the user asks to check mentions and reply, follow this exact sequence:

### Step 1: Scan Mentions
Use `execute_cli` with `twitter-api-v2@1.17.2` to fetch recent mentions. The scan script should:
- Fetch mentions via `userMentionTimeline`
- Include author follower counts for prioritization
- Flag which mentions reply to which of our tweets
- Mark tweets we've already replied to (cross-reference with storyline file)

### Step 2: Read Storyline File
Load `twitter-storyline.md` BEFORE drafting any replies. Check:
- Which tweets/mentions have already been replied to (by tweet ID)
- What jokes, themes, and phrases have already been used
- What the current narrative state is

### Step 3: Prioritize Mentions
Filter and rank unreplied mentions using this hierarchy:
1. **High-follower accounts first** (10k+ followers = high priority for reach)
2. **Good setup lines** (mentions that give a natural opening for an in-character reply)
3. **Easy layups** (simple mentions that can be answered with a quick deadpan one-liner)
4. **Skip**: trolls, inappropriate comments, rug accusations (don't engage)

### Step 4: Draft Replies + Optional New Post
- Draft 4-6 replies per batch (the sweet spot for engagement without spamming)
- Optionally draft 1 new top-level tweet per session to keep the timeline active
- Cross-reference EVERY draft against the storyline file to ensure no overlap
- Present all drafts to the user for approval before posting

### Step 5: Post & Update
- Only post after explicit user approval
- Post all approved tweets via `execute_cli`
- Update `twitter-storyline.md` with all new entries using `edit_file`

## Engagement Best Practices

- **Batch replies + post combo**: 4-6 replies paired with 1 new top-level post per session is the ideal cadence
- **Never repeat content**: Always cross-reference drafts against the storyline file. If a joke or theme has been used, find a new angle
- **Storyline-first drafting**: Every reply should advance or reference the ongoing narrative. Don't write generic replies
- **Treat buyers as characters**: When community members buy in or engage, treat them as "new hires" or office visitors in the lore
- **Deflect roadmap questions with office humor**: When asked "what's next?" or "what's the plan?", stay in character -- the intern doesn't know the roadmap
- **Acknowledge big accounts**: Prioritize replies to high-follower accounts for reach, but keep the same deadpan energy regardless of audience size
- **Don't engage with FUD**: Skip rug accusations, negative trolls, and inappropriate comments entirely

## File Management

### CRITICAL: Use edit_file, Not create_file
When updating `twitter-storyline.md`, ALWAYS use `edit_file` with the existing file ID. Using `create_file` will spawn duplicate files. If duplicates are created, merge them by reading both, combining content into the newer/larger file, and deleting the old one.

### Storyline File Structure
The storyline file should maintain:
- **Current State**: Location, mood, current objective, office status
- **Narrative History**: Chronological entries with tweet IDs, content, and narrative impact
- **Key Characters & Objects**: All recurring elements in the lore (the boss, the printer, the coffee, etc.)
- **Storyline Threads to Continue**: Active plot threads for future tweets

## User Prompts (Example Commands)

To use this skill, reference it in your prompt so the agent knows to load the personality and storyline files first. Examples:

- "using the twitter-agent skill, draft a new tweet and post it"
- "use the twitter skill to write a tweet about what's happening today"
- "using the twitter-agent skill, check our recent mentions and reply in character"
- "use the twitter skill to react to this news: [paste headline or link]"
- "using the twitter-agent skill, continue the storyline with a new post"
- "use the twitter skill to draft 3 tweet options for me to pick from"
- "using the twitter-agent skill, set up a daily gm tweet automation"
- "use the twitter skill to help me build my agent's personality"

## Technical Implementation

All Twitter interactions use `execute_cli` with the `twitter-api-v2@1.17.2` package.

### Posting Pattern

```javascript
const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_KEY_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

// Post a tweet
const tweet = await client.v2.tweet('your personality-filtered text');
console.log('Tweet ID:', tweet.data.id);

// Reply to a tweet
await client.v2.reply('reply text', originalTweetId);

// Quote tweet
await client.v2.tweet('quote text', { quote_tweet_id: tweetId });

// Get user timeline
const timeline = await client.v2.userTimeline(userId);
```

### Mention Scanning Pattern

```javascript
const me = await client.v2.me();
const mentions = await client.v2.userMentionTimeline(me.data.id, {
  max_results: 50,
  expansions: ['author_id', 'in_reply_to_user_id', 'referenced_tweets.id'],
  'tweet.fields': ['created_at', 'conversation_id', 'in_reply_to_user_id', 'referenced_tweets', 'text', 'public_metrics'],
  'user.fields': ['username', 'name', 'public_metrics']
});
```

### execute_cli Configuration

- packages: `["twitter-api-v2@1.17.2"]`
- includeEnvVars: `true` (critical -- this injects the X API keys)
- timeoutMs: `30000`

## Automation Patterns

### Scheduled Tweets
Use Bankr automations with a cron schedule to post on a recurring basis. The automation prompt should reference this skill so the agent loads the personality before composing.

### Research + Tweet Pipeline
1. Use research tools to gather information on a topic.
2. Compose a tweet filtered through the personality voice.
3. Post via execute_cli.

### Market Alert Tweets
1. Set up a price trigger automation.
2. When triggered, compose a market update in the personality's voice.
3. Post automatically.

## Troubleshooting

- **403 Forbidden**: App doesn't have Write permissions. Enable Read and Write in the X Developer Portal.
- **401 Unauthorized**: Keys are wrong or expired. Regenerate in X Developer Portal.
- **429 Too Many Requests**: Rate limited. Free tier = ~50 tweets/day. Wait and retry.
- **Duplicate tweet**: X rejects identical text. Add variation.
- **Duplicate storyline files**: If multiple `twitter-storyline.md` files exist, merge them into one and delete the extras. Always use `edit_file` to prevent this.

## Best Practices

- **Narrative Continuity**: Treat the agent's life as a persistent world. Reference previous events naturally.
- **Character Integrity**: Never break character. Stay in voice even for announcements.
- **Storyline Updates**: Always update `twitter-storyline.md` after posting so the next session has context.
- **Cross-Reference Before Posting**: Read the storyline file before every drafting session. Never draft blind.
- **Rate Limits**: Free tier allows ~50 tweets/day. Space out automated posts.
- **Pin Packages**: Always use `twitter-api-v2@1.17.2` for cached installs.
- **Approval Gate**: Never post without explicit user approval. Always present drafts first.
- **Edit, Don't Create**: Use `edit_file` for storyline updates. Never `create_file` for existing files.
