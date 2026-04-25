#!/usr/bin/env node
/**
 * create-poll.js — Create a Twitter/X poll via OAuth 1.0a
 *
 * Usage:
 *   node scripts/create-poll.js \
 *     --question "Which chain has the best UX?" \
 *     --options "Base" "Solana" "Ethereum" "Other" \
 *     --duration 1440
 *
 * Environment variables (OAuth 1.0a):
 *   X_API_KEY             Consumer Key
 *   X_API_KEY_SECRET      Consumer Secret
 *   X_ACCESS_TOKEN        Access Token
 *   X_ACCESS_TOKEN_SECRET Access Token Secret
 *
 * Output: JSON to stdout
 */

const { TwitterApi } = require('twitter-api-v2');

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

function getFlag(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? idx : -1;
}

function getFlagValue(flag) {
  const idx = getFlag(flag);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function getFlagValues(flag) {
  const idx = getFlag(flag);
  if (idx === -1) return [];
  const values = [];
  for (let i = idx + 1; i < args.length; i++) {
    if (args[i].startsWith('--')) break;
    values.push(args[i]);
  }
  return values;
}

const question = getFlagValue('--question');
const options = getFlagValues('--options');
const durationRaw = getFlagValue('--duration');

// ---------------------------------------------------------------------------
// Validate inputs
// ---------------------------------------------------------------------------
if (!question) {
  console.error('Error: --question is required');
  process.exit(1);
}

if (options.length < 2 || options.length > 4) {
  console.error('Error: --options requires 2–4 values');
  process.exit(1);
}

const DURATION_MIN = 5;
const DURATION_MAX = 10080;
const DURATION_DEFAULT = 1440; // 24 hours

let durationMinutes = durationRaw ? parseInt(durationRaw, 10) : DURATION_DEFAULT;

if (isNaN(durationMinutes)) {
  console.error(`Error: --duration must be a number (got "${durationRaw}")`);
  process.exit(1);
}

if (durationMinutes < DURATION_MIN) {
  console.error(`Warning: duration ${durationMinutes}m is below minimum — clamping to ${DURATION_MIN}m`);
  durationMinutes = DURATION_MIN;
}

if (durationMinutes > DURATION_MAX) {
  console.error(`Warning: duration ${durationMinutes}m exceeds maximum — clamping to ${DURATION_MAX}m (7 days)`);
  durationMinutes = DURATION_MAX;
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
// Create poll
// ---------------------------------------------------------------------------
async function main() {
  const pollOptions = options.map((label) => ({ label }));

  const response = await client.v2.tweet({
    text: question,
    poll: {
      options: pollOptions,
      duration_minutes: durationMinutes,
    },
  });

  const tweetId = response.data.id;
  const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

  const result = {
    tweetId,
    question,
    options,
    durationMinutes,
    endsAt,
    url: `https://x.com/i/web/status/${tweetId}`,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Error creating poll:', err.message || err);
  process.exit(1);
});
