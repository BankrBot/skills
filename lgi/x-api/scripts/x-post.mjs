#!/usr/bin/env node
// Post to X using official API (OAuth 1.0a)
// Credentials: env vars (X_API_KEY, etc.) or ~/.clawdbot/secrets/x-api.json

import { TwitterApi } from 'twitter-api-v2';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Load credentials from env vars or config file
function loadCredentials() {
  // Try environment variables first
  if (process.env.X_API_KEY && process.env.X_ACCESS_TOKEN) {
    return {
      consumerKey: process.env.X_API_KEY,
      consumerSecret: process.env.X_API_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessTokenSecret: process.env.X_ACCESS_SECRET,
    };
  }

  // Fall back to config file
  const configPaths = [
    join(homedir(), '.clawdbot', 'secrets', 'x-api.json'),
    join(process.cwd(), '.x-api.json'),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        return JSON.parse(readFileSync(configPath, 'utf8'));
      } catch (e) {
        console.error(`❌ Failed to parse ${configPath}:`, e.message);
      }
    }
  }

  return null;
}

const credentials = loadCredentials();

if (!credentials) {
  console.error(`❌ No credentials found.

Set environment variables:
  export X_API_KEY="..."
  export X_API_SECRET="..."
  export X_ACCESS_TOKEN="..."
  export X_ACCESS_SECRET="..."

Or create ~/.clawdbot/secrets/x-api.json:
  {
    "consumerKey": "...",
    "consumerSecret": "...",
    "accessToken": "...",
    "accessTokenSecret": "..."
  }
`);
  process.exit(1);
}

const client = new TwitterApi({
  appKey: credentials.consumerKey,
  appSecret: credentials.consumerSecret,
  accessToken: credentials.accessToken,
  accessSecret: credentials.accessTokenSecret,
});

const text = process.argv.slice(2).join(' ');

if (!text) {
  console.error('Usage: x-post <tweet text>');
  process.exit(1);
}

try {
  const { data } = await client.v2.tweet(text);
  // Get username from the access token (first part before the dash is user ID)
  const userId = credentials.accessToken.split('-')[0];
  console.log(`✅ Posted: https://x.com/i/status/${data.id}`);
} catch (err) {
  console.error('❌ Failed:', err.message);
  if (err.data) console.error(JSON.stringify(err.data, null, 2));
  process.exit(1);
}
