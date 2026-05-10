---
name: snapshot
description: Interact with the Snapshot governance platform — query spaces, proposals, and votes via the Hub GraphQL API, cast votes, create proposals, check voting power, and review delegation. Use when user says "vote on snapshot", "snapshot proposal", "governance vote", "check proposals", "create proposal", "snapshot space", "voting power", "delegate votes", "governance status", "DAO proposal", "cast vote", or mentions Snapshot, DAO governance, or off-chain voting.
---

# Snapshot Governance

Query, vote, and create proposals on Snapshot — the leading off-chain governance platform for DAOs.

## Setup

### Dependencies

Install snapshot.js (required for vote/propose scripts):

```bash
npm ls @snapshot-labs/snapshot.js 2>/dev/null || npm i @snapshot-labs/snapshot.js @ethersproject/wallet @ethersproject/providers
```

### Authentication

- **Reading (GraphQL queries):** No auth needed. Optional `SNAPSHOT_API_KEY` header for higher rate limits.
- **Writing (vote/propose):** Requires a private key with EIP-712 signing. Set `PRIVATE_KEY` env var or pass `--pk`.
- If using Bankr wallet, export the private key: `bankr wallet export-key`

## Quick Reference

| Action | Tool |
|--------|------|
| Query spaces/proposals/votes | `scripts/snapshot-query.sh` |
| Cast a vote | `scripts/snapshot-vote.mjs` |
| Create a proposal | `scripts/snapshot-propose.mjs` |
| Detailed query patterns | `references/graphql-api.md` |
| Voting type formats | `references/voting-types.md` |

## Workflows

### 1. Query Proposals in a Space

```bash
bash scripts/snapshot-query.sh '{
  proposals(first: 10, where: {space_in: ["ens.eth"], state: "active"},
    orderBy: "created", orderDirection: desc) {
    id title choices start end state scores scores_total type
    space { id name }
  }
}'
```

### 2. Get Proposal Details

```bash
bash scripts/snapshot-query.sh '{
  proposal(id: "0x...") {
    id title body choices start end snapshot state type
    author scores scores_total scores_by_strategy
    space { id name }
  }
}'
```

### 3. Check Voting Power

Before voting, verify the user has voting power on the proposal:

```bash
bash scripts/snapshot-query.sh '{
  vp(voter: "0xYOUR_ADDRESS", space: "ens.eth", proposal: "0x...") {
    vp vp_by_strategy vp_state
  }
}'
```

If `vp` is 0, the address had no qualifying tokens at the proposal's snapshot block.

### 4. Check Existing Vote

```bash
bash scripts/snapshot-query.sh '{
  votes(where: {proposal: "0x...", voter: "0xYOUR_ADDRESS"}) {
    id choice vp created
  }
}'
```

### 5. Cast a Vote

Read `references/voting-types.md` to determine the correct choice format for the proposal type.

```bash
node scripts/snapshot-vote.mjs \
  --space "ens.eth" \
  --proposal "0xabc123..." \
  --choice 1 \
  --type "single-choice" \
  --reason "Agree with the proposal rationale" \
  --pk "$PRIVATE_KEY"
```

For weighted/quadratic: `--choice '{"1":70,"2":30}'`
For approval: `--choice '[1,3]'`
For ranked-choice: `--choice '[2,1,3]'`

### 6. Create a Proposal

```bash
node scripts/snapshot-propose.mjs \
  --space "your-space.eth" \
  --title "Proposal Title" \
  --body "Full proposal body in **markdown**." \
  --choices '["For","Against","Abstain"]' \
  --type "basic" \
  --start $(date -d '+1 hour' +%s) \
  --end $(date -d '+7 days' +%s) \
  --pk "$PRIVATE_KEY"
```

The script auto-fetches the latest block for the snapshot parameter if omitted.

### 7. Get Space Info

```bash
bash scripts/snapshot-query.sh '{
  space(id: "ens.eth") {
    id name about network symbol
    members admins
    strategies { name params }
    voting { delay period quorum type }
    filters { minScore onlyMembers }
  }
}'
```

### 8. Get Vote Results

```bash
bash scripts/snapshot-query.sh '{
  votes(first: 1000, where: {proposal: "0x..."},
    orderBy: "vp", orderDirection: desc) {
    voter choice vp reason created
  }
}'
```

### 9. Check Follows / Subscriptions

```bash
bash scripts/snapshot-query.sh '{
  follows(first: 50, where: {follower: "0xYOUR_ADDRESS"}) {
    space { id name } created
  }
}'
```

## Presentation Guidelines

When presenting proposal or vote data to the user:

- Show proposal status prominently: 🟢 Active, 🟡 Pending, 🔴 Closed
- Format timestamps as human-readable dates
- Show vote tallies as percentages alongside raw scores
- For active proposals, show time remaining until end
- Choices are **1-indexed** — choice 1 is the first option listed
- Always check voting power before attempting to vote
- Always check for existing votes before casting (Snapshot allows changing votes on active proposals but it's good to confirm)

## Important Notes

- Snapshot voting is **off-chain** (gasless) — no transaction fees
- Votes are signed messages (EIP-712) submitted to the Snapshot hub sequencer
- Voting power is calculated at the **snapshot block** when the proposal was created — tokens acquired after are not counted
- Rate limit: 100 req/min without API key, 2M/month with key
- Snapshot hub URL: `https://hub.snapshot.org/graphql`
- Testnet hub: `https://testnet.hub.snapshot.org/graphql`

## Delegation

Snapshot supports vote delegation via the Gnosis Delegate Registry contract (`0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446`) deployed on multiple networks including Base. Delegation is an on-chain transaction (not gasless). Spaces must include a `with-delegation` voting strategy for delegated power to count.

To check delegation status, query the delegate registry subgraph or use `snapshot.js` `follow`/`unfollow` methods.
