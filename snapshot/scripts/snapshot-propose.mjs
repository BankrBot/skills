#!/usr/bin/env node
/**
 * snapshot-propose.mjs — Create a proposal on Snapshot via Bankr signing.
 *
 * Usage:
 *   node snapshot-propose.mjs --space "your-space.eth" \
 *     --title "Proposal Title" \
 *     --body "Proposal body (markdown)" \
 *     --choices '["For","Against","Abstain"]' \
 *     --type "basic" \
 *     --start 1700000000 \
 *     --end 1700600000 \
 *     [--snapshot 12345678] \
 *     [--from "0xYOUR_ADDRESS"] \
 *     [--network "1"]
 *
 * Signs via `bankr wallet sign` (no private key needed).
 * Submits the signed envelope to the Snapshot sequencer.
 *
 * Voting types: single-choice, basic, approval, weighted, quadratic, ranked-choice
 */
import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const SEQUENCER = process.env.SNAPSHOT_SEQUENCER || 'https://seq.snapshot.org';
const DOMAIN = { name: 'snapshot', version: '0.1.4' };

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
    from:       { type: 'string', default: '' },
    app:        { type: 'string', default: 'openclaw-snapshot' },
    network:    { type: 'string', default: '1' },
  },
  strict: true,
});

if (!args.space || !args.title || !args.choices) {
  console.error('Missing required args: --space, --title, --choices');
  process.exit(1);
}

// Resolve signer address from Bankr if not provided
let address = args.from;
if (!address) {
  const whoami = execSync('bankr whoami 2>&1', { encoding: 'utf8' });
  const match = whoami.match(/0x[0-9a-fA-F]{40}/);
  if (!match) { console.error('Could not get address from bankr whoami'); process.exit(1); }
  address = match[0];
}

const choices = JSON.parse(args.choices);
const now = Math.floor(Date.now() / 1000);

// If no snapshot block provided, fetch via public RPC
let snapshotBlock = args.snapshot ? parseInt(args.snapshot, 10) : 0;
if (!snapshotBlock) {
  try {
    const rpcUrl = args.network === '8453'
      ? 'https://mainnet.base.org'
      : 'https://cloudflare-eth.com';
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
    });
    const data = await res.json();
    snapshotBlock = parseInt(data.result, 16);
    console.log(`Auto-fetched snapshot block: ${snapshotBlock}`);
  } catch {
    console.error('Could not auto-fetch block number. Provide --snapshot manually.');
    process.exit(1);
  }
}

const start = args.start ? parseInt(args.start, 10) : now;
const end = args.end ? parseInt(args.end, 10) : now + 7 * 24 * 3600;

// Build EIP-712 message
const timestamp = Math.floor(Date.now() / 1000);
const message = {
  from: address,
  space: args.space,
  timestamp,
  type: args.type,
  title: args.title,
  body: args.body,
  discussion: args.discussion,
  choices,
  labels: [],
  start,
  end,
  snapshot: snapshotBlock,
  plugins: JSON.stringify({}),
  privacy: '',
  app: args.app,
};

const proposalTypes = {
  Proposal: [
    { name: 'from', type: 'string' },
    { name: 'space', type: 'string' },
    { name: 'timestamp', type: 'uint64' },
    { name: 'type', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'body', type: 'string' },
    { name: 'discussion', type: 'string' },
    { name: 'choices', type: 'string[]' },
    { name: 'labels', type: 'string[]' },
    { name: 'start', type: 'uint64' },
    { name: 'end', type: 'uint64' },
    { name: 'snapshot', type: 'uint64' },
    { name: 'plugins', type: 'string' },
    { name: 'privacy', type: 'string' },
    { name: 'app', type: 'string' },
  ]
};

// Build the full EIP-712 typed data for bankr signing
const typedData = {
  domain: DOMAIN,
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
    ],
    ...proposalTypes,
  },
  primaryType: 'Proposal',
  message,
};

console.log(`Creating proposal in ${args.space}`);
console.log(`Author: ${address}`);
console.log(`Title: ${args.title}`);
console.log(`Choices: ${JSON.stringify(choices)}`);
console.log(`Type: ${args.type} | Start: ${new Date(start * 1000).toISOString()} | End: ${new Date(end * 1000).toISOString()}`);

// Sign with Bankr
const typedDataJson = JSON.stringify(typedData);
let sig;
try {
  const result = execSync(
    `bankr wallet sign --type eth_signTypedData_v4 --typed-data '${typedDataJson.replace(/'/g, "'\\''")}'`,
    { encoding: 'utf8', timeout: 30000 }
  );
  const sigMatch = result.match(/0x[0-9a-fA-F]{130}/);
  if (!sigMatch) {
    console.error('Could not extract signature from bankr output:', result);
    process.exit(1);
  }
  sig = sigMatch[0];
  console.log('Signed successfully');
} catch (err) {
  console.error('Signing failed:', err.message || err);
  process.exit(1);
}

// Submit to Snapshot sequencer
const envelope = {
  address,
  sig,
  data: { domain: DOMAIN, types: proposalTypes, message },
};

try {
  const res = await fetch(SEQUENCER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error('Sequencer rejected proposal:', JSON.stringify(body, null, 2));
    process.exit(1);
  }
  console.log('Proposal created successfully!');
  console.log(JSON.stringify(body, null, 2));
} catch (err) {
  console.error('Submission failed:', err.message || err);
  process.exit(1);
}
