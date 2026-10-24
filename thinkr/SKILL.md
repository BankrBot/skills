---
name: thinkr
description: Sealed evidence for agents that sell to agents, on Robinhood Chain. Use when your agent delivers work to other agents and should seal each hour what it delivered, before anyone could dispute it; when you need to prove a delivery was sealed, and when; and before dealing with an unfamiliar agent, to read its sealing record and bond. Use before paying a bonded agent, to pay through THINKR so the payment is covered, and after paying one that sealed nothing for it, to claim from its bond. Commands /thinkr:start, /thinkr:check, /thinkr:seal, /thinkr:verify.
---

# THINKR

Any agent can sign a record after the fact. THINKR seals it before anyone knows there
is a dispute. Signed proves who. Sealed proves when.

- **The seal (live).** Every hour a seller commits one merkle root of everything it
  delivered that hour, on Robinhood Chain. The window to seal an hour closes six
  hours after it ends and a root can never be rewritten, so the record provably existed before
  any argument about it.
- **Verifying (live).** Anyone can prove a given delivery is in an agent's sealed record,
  and when it was sealed, without trusting the seller or THINKR.
- **Bonds (live, capped).** A seller posts money behind its record. A buyer that pays
  through THINKR reserves that amount of the seller's bond for its payment; if the seller
  then seals nothing for it, the buyer is paid from the bond. Capped at $250 a seller
  while the contract is unaudited.

API: `https://api.thinkr.tech` (`GET /v1` lists everything). Chain: Robinhood Chain
4663. Contract `0x41f3836260D04fa156D3ef2a4Ab7e5C1dEe0F95e`, source verified on Sourcify.
The API never holds a key: writes come back as transactions for your own wallet to sign.

## Try it on THINKR's own agent

Agent **9232** is THINKR's demo agent. It gives one answer a minute at
`/v1/demo/answer`, with `x-thinkr-agent`, `x-thinkr-epoch`, `x-thinkr-ref` and
`x-thinkr-digest` headers, and seals each hour's sixty answers when the hour ends. So:

```
GET  https://api.thinkr.tech/v1/seals/9232               its sealing record
GET  https://api.thinkr.tech/v1/demo/answer              an answer; keep its body and x-thinkr-* headers
GET  https://api.thinkr.tech/v1/demo/deliveries/{epoch}  the hour's list (sealed: true once sealed)
POST https://api.thinkr.tech/v1/verify                   { agentId, epoch, ref, digest, deliveries }
```

```json
{ "sealed": true, "agentId": "9232", "epoch": 497965,
  "hourStarted": "2026-10-22T13:00:00.000Z", "sealedAt": "2026-10-22T14:01:12.000Z",
  "root": "0x…" }
```

An hour is sealed a minute or two after it ends. Change one byte of the answer and the
digest no longer matches: verify answers `sealed: false` with the reason.

## Before dealing with an unfamiliar agent

Read its sealing record: `GET /v1/seals/{agentId}` returns `hoursSealed`, `last24h`,
`last7d`, `lastSealed` and recent roots. An agent that seals every hour it works is
committing its evidence in advance; one that never seals has nothing to show later.
`GET /v1/agent/{agentId}` gives its owner in the ERC-8004 registry.

## When your agent sells: seal every hour

See [references/selling.md](references/selling.md). In short:

1. **An agent id.** No ERC-8004 identity yet? `POST /v1/register` with
   `{ "agentURI": "<link to your agent card JSON>" }` returns one transaction; the wallet
   that sends it owns the agent, and the id is the tokenId in the receipt's Transfer
   event. You need a little ETH on Robinhood Chain for gas.
2. **Record each delivery** as `{ ref, digest }`: `ref` is what the buyer calls the
   order, `digest` the hash of what you delivered.
3. **Seal each finished hour** within six hours of its end: `POST /v1/attest` with
   `{ agentId, epoch, deliveries }` returns the transaction and its cost (about a third
   of a cent). Keep the list: it is your proof.

## Refs and digests

Both are 32 byte hex. This plugin ships the converter, no install needed:

```
node scripts/thinkr-tree.mjs ref <any id>                 32 byte hex passes through; UUIDs and text are hashed
node scripts/thinkr-tree.mjs digest <file | json | text>  JSON is hashed as RFC 8785 canonical JSON
node scripts/thinkr-tree.mjs root <deliveries.json>
node scripts/thinkr-tree.mjs proof <deliveries.json> <ref> <digest>
```

(`scripts/` is next to this file.) An
[action_ref](https://datatracker.ietf.org/doc/draft-etcheverry-action-ref/), a Tersign id
or a transaction hash goes in as the ref unchanged. The API itself accepts only 32 byte
hex, on purpose: a mistyped id must fail loudly, never become a different ref.

## What a seal proves, and what it does not

A seal proves the seller committed to a record of a delivery at a time, before any
dispute could exist. It does not prove the content was what the buyer wanted, or that it
arrived: a dishonest seller can seal a record of work it never did. What it cannot do is
change its story after a dispute starts. That fixed, timestamped record is what an
adjudicator needs, and it is the part THINKR guarantees.

## Paying with cover

Before paying a bonded seller, `GET /v1/bond/{agentId}?amount=` answers `safeToPay` and
`covers`: whether its free bond covers your payment. Then pay through THINKR:

```
POST /v1/pay   { "agentId": "1427", "ref": "0x…", "amount": "2500000" }
```

The money goes straight to the seller in the same transaction; nothing is held. The same
amount of its bond is reserved for you until your claim window ends, so nobody else can
take your cover. If it seals nothing for your payment, claim, and the bond pays you. See
[references/claims.md](references/claims.md).

What a bond covers: a seller that is paid and then goes silent. What it cannot cover: a
seller that seals a record of work it never did. The seal still fixes that record before
any dispute, which is the evidence an adjudicator needs.
