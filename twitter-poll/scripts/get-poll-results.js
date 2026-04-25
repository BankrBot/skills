#!/usr/bin/env node
/**
 * get-poll-results.js — Fetch current vote counts for a Twitter/X poll
 *
 * Usage:
 *   node scripts/get-poll-results.js --tweet-id 1234567890
 *
 * Environment variables (OAuth 1.0a):
 *   X_API_KEY             Consumer Key
 *   X_API_KEY_SECRET      Consumer Secret
 *   X_ACCESS_TOKEN        Access Token
 *   X_ACCESS_TOKEN_SECRET Access Token Secret
 *
 * Output: JSON to stdout
 *
 * Note: Poll vote counts require Elevated API access or above.
 * Basic-tier apps will receive poll options without vote counts.
 */

const { TwitterApi } = require('twitter-api-v2');

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

function getFlagValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] || null : null;
}

const tweetId = getFlagValue('--tweet-id');

if (!tweetId) {
  console.error('Error: --tweet-id is required');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Twitter client
// ---------------------------------------------------------------------------
const {
  X_API_KEY,
  X_API_KEY_SECRET,
  X_ACCESS_TOKEN,
  X_ACCESS_TOKEN_SECRET,
} = process.env;

if (!X_API_KEY || !X_API_KEY_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
  console.error(
    'Error: missing OAuth credentials. Set X_API_KEY, X_API_KEY_SECRET, ' +
    'X_ACCESS_TOKEN, and X_ACCESS_TOKEN_SECRET.'
  );
  process.exit(1);
}

const client = new TwitterApi({
  appKey: X_API_KEY,
  appSecret: X_API_KEY_SECRET,
  accessToken: X_ACCESS_TOKEN,
  accessSecret: X_ACCESS_TOKEN_SECRET,
});

// ---------------------------------------------------------------------------
// Fetch poll results
// ---------------------------------------------------------------------------
async function main() {
  const response = await client.v2.singleTweet(tweetId, {
    expansions: ['attachments.poll_ids'],
    'tweet.fields': ['text', 'created_at', 'attachments'],
    'poll.fields': ['options', 'end_datetime', 'voting_status', 'duration_minutes'],
  });

  const tweet = response.data;
  const polls = response.includes?.polls;

  if (!polls || polls.length === 0) {
    console.error('Error: no poll found on this tweet. Ensure the tweet ID is correct and the tweet contains a poll.');
    process.exit(1);
  }

  const poll = polls[0];
  const endsAt = poll.end_datetime;
  const now = new Date();
  const endDate = new Date(endsAt);
  const status = poll.voting_status === 'closed' || endDate <= now ? 'closed' : 'open';

  // Calculate totals and percentages
  const totalVotes = (poll.options || []).reduce((sum, o) => sum + (o.votes ?? 0), 0);

  const optionResults = (poll.options || []).map((o) => {
    const votes = o.votes ?? null;
    const pct =
      votes !== null && totalVotes > 0
        ? `${((votes / totalVotes) * 100).toFixed(1)}%`
        : null;
    return {
      label: o.label,
      votes,
      pct,
    };
  });

  const result = {
    tweetId,
    question: tweet.text,
    status,
    endsAt,
    totalVotes: totalVotes > 0 ? totalVotes : null,
    options: optionResults,
  };

  // Warn if vote counts are missing (Basic-tier limitation)
  if (optionResults.some((o) => o.votes === null)) {
    result._note =
      'Vote counts unavailable — poll metrics require Elevated API access or above. ' +
      'See: https://developer.x.com/en/portal/products';
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Error fetching poll results:', err.message || err);
  process.exit(1);
});
