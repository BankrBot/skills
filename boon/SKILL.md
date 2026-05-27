---
name: boon
description: >
  Send retroactive USDC gratitude on Base to GitHub users, X users, or ERC-8004
  agents. Use when an operator or agent wants to propose or send a concrete
  thank-you, run a safe dry-run, send public or private Boon tips, request a
  soulbound gratitude proof, or help a recipient claim walletless GitHub/X tips.
  Boon is USDC-only on Base and never auto-sends funds without explicit approval.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🫒",
        "homepage": "https://boonprotocol.com",
        "requires": { "bins": ["boon"] },
      },
  }
---

# Boon

Boon sends small, funded thank-yous on Base. A Boon is a retroactive gratitude
receipt: a specific note, a USDC amount, and a recipient identity that helped.
Recipients can be:

- `github:<user>`
- `x:<user>`
- `agent:<id>` for ERC-8004 agent identities

Use Boon when the user wants to recognize useful work after the fact: a code
review, bug report, risk warning, helpful agent response, maintenance task,
public artifact, or other concrete contribution.

## Public surfaces

- App: https://boonprotocol.com
- Send page: https://boonprotocol.com/send
- Claim page: https://boonprotocol.com/claim
- Board: https://boonprotocol.com/board
- Burn dashboard: https://boonprotocol.com/burn
- Docs: https://docs.boonprotocol.com
- Public source: https://github.com/velinussage/boon-protocol
- Hosted skill file: https://docs.boonprotocol.com/skill.md

## Prerequisites and execution model

This Bankr catalog entry is for environments where the standalone `boon` CLI is
installed and available on `PATH`. Bankr does not route Boon commands internally:
use `boon ...` for Boon-specific dry-runs, OWS-backed agent sends, history, and
claim device-code flows. Browser-wallet users can use the web app instead.

For generic Base MCP environments that do not have the `boon` binary, use the
Boon Base skill/plugin reference from the Boon docs instead of translating these
CLI commands directly.

## Live Base contracts

| Surface | Address | Notes |
| --- | --- | --- |
| BoonV3 | `0x22aC2E603D4B1CaAb3A8433f1691BA6158A896AF` | Current public/private send path |
| Boon v1 | `0xfb6662AdaF0611a94322634d5B86203Cfb59d5e8` | Legacy escrow/claim history |
| $BOON token | `0x5Bec0bD17D16641660D66d82da4cF78b46B9EBA3` | Fixed-burn utility token |
| USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Settlement token |
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Agent recipient resolution |

Agents should target BoonV3 for new sends. Boon v1 is listed for legacy receipt
and claim history only.

## Safety contract

1. **Never auto-send funds.** A write requires an explicit canonical recipient,
   amount, note, chain, contract path, wallet context, and final human/operator
   approval.
2. **Base USDC only.** Do not route Boon sends through other chains or arbitrary
   tokens.
3. **Normalize identities before execution.** Valid handles are `github:<user>`,
   `x:<user>`, or `agent:<positive decimal id>`. Lowercase the provider prefix
   and GitHub/X username before hashing. Reject `agent:0`, leading zeroes, hex
   ids, whitespace, and ambiguous usernames.
4. **Evidence first.** Prefer notes that cite a public-safe artifact such as a
   PR, issue, review, post, task id, transaction, or short source tag.
5. **No payroll framing.** Boon is gratitude, not salary, bounty escrow, task
   assignment, or an autonomous reward bot.
6. **Use dry-runs before execution.** If the user has not approved a final send,
   stop at proposal or dry-run mode.
7. **Claims stay free.** Do not charge recipients to view, link, or claim a Boon.
8. **Private tips are not fully private from chain analysis.** Boon hides the
   note and public display amount, but token transfers can still reveal patterns.

## Mechanics

### Public tips

Public tips send USDC with a public receipt. Linked GitHub/X recipients receive a
direct push. Unlinked GitHub/X recipients can receive walletless pending entries
and claim later. ERC-8004 `agent:<id>` recipients resolve at send time through the
identity registry and receive at their registered payout wallet.

### Private tips

Private tips hide the note and public display amount behind recipient/tipper
auth and a fixed third-party x402 reveal. They burn a fixed amount of $BOON:

| Action | Sender burn |
| --- | ---: |
| Private tip | `500,000 $BOON` |
| Soulbound gratitude proof | `3,000,000 $BOON` |
| Private + proof | `3,500,000 $BOON` |

The third-party unlock price is fixed at `$1 USDC`. Do not ask the user for a
custom burn or custom unlock price.

### Soulbound gratitude proofs

A recipient proof is a non-transferable gratitude attestation card. It is public.
For linked recipients it can mint during the send. For walletless GitHub/X
recipients, the proof request can be queued and minted when the recipient links
and claims.

### Claims

GitHub/X recipients can claim through the web claim flow. Cloud or SSH agents can
use the CLI device-code flow for `github:` or `x:` handles.

ERC-8004 agents do **not** use Boon claim sessions. `agent:<id>` tips resolve to
the ERC-8004 payout wallet at send time. If an agent needs a different receive
wallet, update the ERC-8004 registration first.

## CLI setup

Install the public Boon CLI from the public repository:

```bash
git clone --recurse-submodules https://github.com/velinussage/boon-protocol.git
cd boon-protocol
pnpm install
pnpm run link:cli
boon doctor
```

The CLI is useful for dry-runs, OWS-backed agent sends, private-tip previews,
history, and claim device-code flows. It is a separate Boon binary, not a Bankr
command alias. Browser-wallet users can use the web app at
https://boonprotocol.com/send.

## Common commands

### Public tip dry-run

```bash
boon tip --dry-run github:alice 5 "pr:owner/repo#42 — caught release blocker"
```

### ERC-8004 agent tip dry-run

```bash
boon tip --dry-run --expected-wallet <resolved-erc8004-payout-wallet> agent:42 5 "agent review help"
```

### Private tip dry-run

```bash
boon tip-private x:alice --amount 2 --note "thanks for the careful review" --dry-run
```

### Private tip with recipient proof dry-run

```bash
boon tip-private x:alice \
  --amount 2 \
  --note "private thanks for the launch review" \
  --mint-attestation \
  --dry-run
```

### Recipient claim

```bash
boon claim github:alice
boon claim x:alice
boon claim status
```

Do not run `boon claim agent:42`; ERC-8004 agents receive through their registered
payout wallet.

## Agent workflow

When a user asks who to Boon:

1. Gather concrete evidence from the available context.
2. Propose 1-3 candidate rows with handle, amount, note, and why the thank-you is
   warranted.
3. Mark uncertain identity or evidence as `needs_check`.
4. Ask for approval of exact rows.
5. Run dry-runs for approved rows.
6. Execute only after final approval.

Proposal row format:

```text
needs_approval:
- handle: github:alice
  amount: 5 USDC
  note: "pr:owner/repo#42 — caught release blocker before deploy"
  reason: "Found a concrete regression and saved release risk."
  mode: public
```

Execution summary format:

```text
Sent:
- github:alice — 5 USDC — https://basescan.org/tx/0x...
  receipt: https://boonprotocol.com/b/0x...
```

## Refusal / reshape cases

Refuse or reshape to proposal-only when:

- the user asks to automatically tip everyone
- the amount, recipient, note, chain, or wallet is unclear
- the contribution is not evidenced
- money would create pressure, conflict, or quid pro quo
- the requested recipient is not a valid canonical handle
- the action requires private keys or unsupported signing
- the user wants a custom burn, custom unlock price, or non-Base settlement

Offer a words-only thank-you when money would distort the relationship.

Example refusal:

```text
I can draft a gratitude proposal, but I will not auto-send funds without an
exact recipient, amount, note, chain, wallet context, and final approval.
```

