#!/usr/bin/env node
/**
 * snapshot-propose.mjs — Create a proposal on Snapshot using snapshot.js
 *
 * Usage:
 *   node snapshot-propose.mjs --space "your-space.eth" \
 *     --title "Proposal Title" \
 *     --body "Proposal body (markdown)" \
 *     --choices '["For","Against","Abstain"]' \
 *     --type "basic" \
 *     --start 1700000000 \
 *     --end 1700600000 \
 *     --snapshot 12345678 \
 *     [--pk "$PRIVATE_KEY"]
 *
 * Env:
 *   PRIVATE_KEY   — hex private key
 *   SNAPSHOT_HUB  — hub URL (default: https://hub.snapshot.org)
 *
 * Voting types: single-choice, basic, approval, weighted, quadratic, ranked-choice
 */
import snapshot from '@snapshot-labs/snapshot.js';
import { Wallet } from '@ethersproject/wallet';
import { JsonRpcProvider } from '@ethersproject/providers';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    space:      { type: 'string' },
    title:      { type: 'string' },
    body:       { type: 'string', default: '' },
    choices:    { type: 'string' },
    type:       { type: 'string', default: 'basic' },
    start:      { type: 'string', default: '' },
    end:        { type: 'string', default: '' },
    snapshot:   { type: 'string', default: '' },
    discussion: { type: 'string', default: '' },
    pk:         { type: 'string', default: process.env.PRIVATE_KEY || '' },
    hub:        { type: 'string', default: process.env.SNAPSHOT_HUB || 'https://hub.snapshot.org' },
    app:        { type: 'string', default: 'openclaw-snapshot' },
    network:    { type: 'string', default: '1' },
  },
  strict: true,
});

if (!args.space || !args.title || !args.choices || !args.pk) {
  console.error('Missing required args: --space, --title, --choices, --pk');
  process.exit(1);
}

const hub = args.hub.replace(/\/graphql\/?$/, '');
const client = new snapshot.Client712(hub);
const wallet = new Wallet(args.pk);
const address = await wallet.getAddress();

const choices = JSON.parse(args.choices);
const now = Math.floor(Date.now() / 1000);

// If no snapshot block provided, fetch latest
let snapshotBlock = args.snapshot ? parseInt(args.snapshot, 10) : 0;
if (!snapshotBlock) {
  try {
    const provider = snapshot.utils.getProvider(args.network);
    snapshotBlock = await provider.getBlockNumber();
    console.log(`Auto-fetched snapshot block: ${snapshotBlock}`);
  } catch {
    console.error('Could not auto-fetch block number. Provide --snapshot manually.');
    process.exit(1);
  }
}

const start = args.start ? parseInt(args.start, 10) : now;
const end = args.end ? parseInt(args.end, 10) : now + 7 * 24 * 3600; // default 7 days

const message = {
  space: args.space,
  type: args.type,
  title: args.title,
  body: args.body,
  choices,
  start,
  end,
  snapshot: snapshotBlock,
  plugins: JSON.stringify({}),
  labels: [],
  discussion: args.discussion,
  app: args.app,
};

console.log(`Creating proposal in ${args.space}`);
console.log(`Author: ${address}`);
console.log(`Title: ${args.title}`);
console.log(`Choices: ${JSON.stringify(choices)}`);
console.log(`Type: ${args.type} | Start: ${new Date(start * 1000).toISOString()} | End: ${new Date(end * 1000).toISOString()}`);

try {
  const receipt = await client.proposal(wallet, address, message);
  console.log('Proposal created successfully!');
  console.log(JSON.stringify(receipt, null, 2));
} catch (err) {
  console.error('Proposal creation failed:', err?.error_description || err?.message || err);
  process.exit(1);
}
