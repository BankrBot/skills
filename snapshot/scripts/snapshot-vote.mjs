#!/usr/bin/env node
/**
 * snapshot-vote.mjs — Cast a vote on a Snapshot proposal via Bankr signing.
 *
 * Usage:
 *   node snapshot-vote.mjs --space "ens.eth" \
 *     --proposal "0xabc..." \
 *     --choice 1 \
 *     --type "single-choice" \
 *     [--reason "My rationale"] \
 *     [--from "0xYOUR_ADDRESS"]
 *
 * Choice format by voting type:
 *   single-choice / basic : integer (1-indexed)
 *   approval              : JSON array of ints, e.g. [1,3]
 *   ranked-choice         : JSON array of ints in rank order, e.g. [2,1,3]
 *   weighted / quadratic  : JSON object, e.g. {"1":60,"2":40}
 *
 * Signs via `bankr wallet sign` (no private key needed).
 * Submits the signed envelope to the Snapshot sequencer.
 */
import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const SEQUENCER = process.env.SNAPSHOT_SEQUENCER || 'https://seq.snapshot.org';
const DOMAIN = { name: 'snapshot', version: '0.1.4' };

const { values: args } = parseArgs({
  options: {
    space:    { type: 'string' },
    proposal: { type: 'string' },
    choice:   { type: 'string' },
    type:     { type: 'string', default: 'single-choice' },
    reason:   { type: 'string', default: '' },
    from:     { type: 'string', default: '' },
    app:      { type: 'string', default: 'openclaw-snapshot' },
  },
  strict: true,
});

if (!args.space || !args.proposal || !args.choice) {
  console.error('Missing required args: --space, --proposal, --choice');
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

// Parse choice based on type
let choice;
const t = args.type;
if (t === 'single-choice' || t === 'basic') {
  choice = parseInt(args.choice, 10);
} else {
  choice = JSON.parse(args.choice);
}

// Build EIP-712 message
const timestamp = Math.floor(Date.now() / 1000);
const message = {
  from: address,
  space: args.space,
  timestamp,
  proposal: args.proposal,
  choice,
  reason: args.reason,
  app: args.app,
  metadata: '{}',
};

// Determine the correct EIP-712 types based on voting type
let voteTypes;
if (t === 'single-choice' || t === 'basic') {
  voteTypes = {
    Vote: [
      { name: 'from', type: 'string' },
      { name: 'space', type: 'string' },
      { name: 'timestamp', type: 'uint64' },
      { name: 'proposal', type: 'string' },
      { name: 'choice', type: 'uint32' },
      { name: 'reason', type: 'string' },
      { name: 'app', type: 'string' },
      { name: 'metadata', type: 'string' },
    ]
  };
} else if (['approval', 'ranked-choice'].includes(t)) {
  voteTypes = {
    Vote: [
      { name: 'from', type: 'string' },
      { name: 'space', type: 'string' },
      { name: 'timestamp', type: 'uint64' },
      { name: 'proposal', type: 'string' },
      { name: 'choice', type: 'uint32[]' },
      { name: 'reason', type: 'string' },
      { name: 'app', type: 'string' },
      { name: 'metadata', type: 'string' },
    ]
  };
} else {
  // weighted, quadratic — choice is stringified JSON
  message.choice = JSON.stringify(choice);
  voteTypes = {
    Vote: [
      { name: 'from', type: 'string' },
      { name: 'space', type: 'string' },
      { name: 'timestamp', type: 'uint64' },
      { name: 'proposal', type: 'string' },
      { name: 'choice', type: 'string' },
      { name: 'reason', type: 'string' },
      { name: 'app', type: 'string' },
      { name: 'metadata', type: 'string' },
    ]
  };
}

// Build the full EIP-712 typed data for bankr signing
const typedData = {
  domain: DOMAIN,
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
    ],
    ...voteTypes,
  },
  primaryType: 'Vote',
  message,
};

console.log(`Voting on proposal ${args.proposal} in space ${args.space}`);
console.log(`Voter: ${address} | Type: ${args.type} | Choice: ${JSON.stringify(choice)}`);

// Sign with Bankr
const typedDataJson = JSON.stringify(typedData);
let sig;
try {
  const result = execSync(
    `bankr wallet sign --type eth_signTypedData_v4 --typed-data '${typedDataJson.replace(/'/g, "'\\''")}'`,
    { encoding: 'utf8', timeout: 30000 }
  );
  // Extract signature from output
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
  data: { domain: DOMAIN, types: voteTypes, message },
};

try {
  const res = await fetch(SEQUENCER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error('Sequencer rejected vote:', JSON.stringify(body, null, 2));
    process.exit(1);
  }
  console.log('Vote submitted successfully!');
  console.log(JSON.stringify(body, null, 2));
} catch (err) {
  console.error('Submission failed:', err.message || err);
  process.exit(1);
}
