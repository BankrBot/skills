# Transfers Reference

Send tokens to addresses, ENS names or social handles. The agent accepts every recipient format; the CLI and Wallet API take addresses (the CLI also resolves ENS).

## Recipient formats

| Format | Example | Agent | `bankr wallet transfer` | `POST /wallet/transfer` |
|--------|---------|:-----:|:-----------------------:|:-----------------------:|
| EVM address | `0x1234…abcd` | ✓ | ✓ | ✓ |
| Solana address | `9xKc…abc` | ✓ | — | — |
| ENS / Basename / cb.id | `vitalik.eth`, `name.base.eth`, `name.cb.id` | ✓ | ✓ (resolved first) | — (resolve first) |
| X / Farcaster / Telegram | `@handle` | ✓ | — | — |

**Social handles** (agent): pass the bare username — no `.eth` suffix, even if the display name has one.

- An **X or Farcaster** username resolves to that account's Bankr wallet. If the account has never used Bankr, a wallet is created for it and its owner claims the funds by signing in with that account.
- A **Telegram** username resolves only if that user already has a Bankr wallet with that username.
- Resolution is per platform: an X handle resolves through the X account, never through a Farcaster link, and vice versa.
- When you're talking to Bankr on X, Farcaster or Telegram, only that platform's handles resolve.
- ENS doesn't apply to Solana sends; use a Solana address or a handle.

## Agent

```bash
bankr agent prompt "Send 0.5 ETH to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb on base"
bankr agent prompt "Send \$20 of USDC to vitalik.eth"
bankr agent prompt "Send 10% of my BNKR to @friend on Farcaster"
bankr agent prompt "Send 1 SOL to 9xKc...abc"
```

- **Amounts:** exact (`0.1 ETH`), USD (`$50`) or a percentage of the balance (`50%`, "all").
- **Chain:** name it to be sure. Otherwise the agent sends a token from a chain where you hold it (it won't send a ticker you don't hold), and a native token from Base when that wallet has gas there, else from the chain with the largest native balance.
- **Many recipients:** "send 5 USDC each to 0xAAA…, 0xBBB… and @carol" batches same-chain ERC-20 sends into **one atomic transaction** (every leg pays or none does); native sends and other chains go one transaction at a time. Your wallet's spend limits apply to the batch's total USD value.
- Bankr Club members can also airdrop a token, from the web terminal, X or Farcaster, to Club members who replied to a post (up to 100, with follower, repost, comment and random-sample filters) or to the top Club members by rank.

## CLI

```bash
bankr wallet transfer --to 0x1234... --token USDC --amount 50
bankr wallet transfer --to vitalik.eth --token USDC --amount 50 --chain base
bankr wallet transfer --to name.base.eth --native --amount 0.01
```

`--to` takes a 0x address or an ENS-style name (`.eth`, `.base.eth`, `.cb.id`), resolved via `/addresses/resolve` before anything is sent — without a chain, so a name's Base record wins even with `--chain polygon`; pass a 0x address when that matters. Handles are rejected; use the agent for those. `--token` takes a symbol or contract address; `--native` sends the chain's gas token. `--chain` defaults to `base` and takes any EVM chain — there is no Solana support.

## Wallet API

```bash
curl -X POST "https://api.bankr.bot/wallet/transfer" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tokenAddress": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "recipientAddress": "0x1234...", "amount": "50", "isNativeToken": false, "chain": "base"}'
```

- The body takes a **0x `recipientAddress` and a token contract address** — no ENS names, handles or symbols. For a native send, set `isNativeToken: true` (with the zero address as `tokenAddress`). `chain` defaults to `base`; EVM chains only. Full reference: [transfer docs](https://docs.bankr.bot/wallet-api/transfer).
- Needs a key with Wallet API access that isn't read-only. A key's `allowedRecipients` list and the wallet's own security settings (spend limits, permitted recipients, pause) are enforced: an allowlist or pause rejection is `403`, a spend-limit or permitted-recipient rejection comes back as `400` with the reason.

**Resolving a name yourself** — `GET /addresses/resolve` is public (no API key):

```bash
curl "https://api.bankr.bot/addresses/resolve?value=vitalik.eth&type=ens&chain=polygon"
# → { "resolved": true, "address": "0x...", "displayName": "vitalik.eth" }
```

`type` is `address`, `ens`, `twitter` or `farcaster`. Pass the destination `chain` for ENS — records are chain-aware, and a name's Base record can be a Base-only smart wallet; without it, the Base record wins. X and Farcaster lookups resolve (and create) the account's Bankr wallet, as above. A miss answers `200` with `resolved: false`. `GET /users/search?query=<prefix>` autocompletes Bankr users by X or Farcaster username.
