#!/usr/bin/env node
/**
 * snapshot-vote.mjs — Cast a vote on a Snapshot proposal using snapshot.js
 *
 * Usage:
 *   node snapshot-vote.mjs --space "ens.eth" \
 *     --proposal "0xabc..." \
 *     --choice 1 \
 *     --type "single-choice" \
 *     [--reason "My rationale"] \
 *     [--pk "$PRIVATE_KEY"]
 *
 * Env:
 *   PRIVATE_KEY        — hex private key (0x-prefixed or raw)
 *   SNAPSHOT_HUB       — hub URL (default: https://hub.snapshot.org)
 *
 * Choice format by voting type:
 *   single-choice / basic : integer (1-indexed)
 *   approval              : JSON array of ints, e.g. [1,3]
 *   ranked-choice         : JSON array of ints in rank order, e.g. [2,1,3]
 *   weighted / quadratic  : JSON object, e.g. {"1":60,"2":40}
 */
import snapshot from '@snapshot-labs/snapshot.js';
import { Wallet } from '@ethersproject/wallet';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    space:    { type: 'string' },
    proposal: { type: 'string' },
    choice:   { type: 'string' },
    type:     { type: 'string', default: 'single-choice' },
    reason:   { type: 'string', default: '' },
    pk:       { type: 'string', default: process.env.PRIVATE_KEY || '' },
    hub:      { type: 'string', default: process.env.SNAPSHOT_HUB || 'https://hub.snapshot.org' },
    app:      { type: 'string', default: 'openclaw-snapshot' },
  },
  strict: true,
});

if (!args.space || !args.proposal || !args.choice || !args.pk) {
  console.error('Missing required args. Run with --help for usage.');
  process.exit(1);
}

// Parse choice based on type
let choice;
const t = args.type;
if (t === 'single-choice' || t === 'basic') {
  choice = parseInt(args.choice, 10);
} else {
  // approval, ranked-choice, weighted, quadratic — parse as JSON
  choice = JSON.parse(args.choice);
}

const hub = args.hub.replace(/\/graphql\/?$/, '');
const client = new snapshot.Client712(hub);
const wallet = new Wallet(args.pk);
const address = await wallet.getAddress();

console.log(`Voting on proposal ${args.proposal} in space ${args.space}`);
console.log(`Voter: ${address} | Type: ${args.type} | Choice: ${JSON.stringify(choice)}`);

try {
  const receipt = await client.vote(wallet, address, {
    space: args.space,
    proposal: args.proposal,
    type: args.type,
    choice,
    reason: args.reason,
    app: args.app,
  });
  console.log('Vote submitted successfully!');
  console.log(JSON.stringify(receipt, null, 2));
} catch (err) {
  console.error('Vote failed:', err?.error_description || err?.message || err);
  process.exit(1);
}
