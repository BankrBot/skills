---
name: token-verdict
description: Fast pre-trade safety gate for Base tokens — one paid API call ($0.02 via x402) returns a verdict (clean / caution / rug_risk / exit_trap), a 0-100 score, and the cited facts behind it (liquidity, holder concentration, honeypot / mint / tax flags). Use BEFORE any buy, swap, or trade execution, or when the user asks "is this token safe", "quick check this token", "should I buy this", or provides a Base token address ahead of a trade. This is the fast automated gate, not a forensic deep-dive.
emoji: 🛡️
tags: [token-safety, pre-trade, rug-check, x402, base, trading, risk]
visibility: public
---

# Token Verdict Skill — the pre-trade gate

Token Verdict is a live pay-per-call endpoint built for the moment
*before* a trade fires:

```
POST https://crypto-intel-agent.vercel.app/api/token-verdict
Body: { "address": "0x<token contract on Base>", "chain": "base" }
Price: $0.02/call, USDC on Base, paid via x402 — no API key
```

One call returns one verdict card:

```json
{
  "verdict": "clean | caution | rug_risk | exit_trap",
  "score": 85,
  "reasons": ["Liquidity is deep: $… across … pool(s) on Base.", "…"],
  "facts": {
    "liquidityUsd": 0, "top10HolderPct": 0,
    "isHoneypot": false, "isMintable": false
  }
}
```

Scoring is deterministic over live data (DexScreener / GeckoTerminal
liquidity + GoPlus token-security flags): same facts in, same verdict
out. Every score cites its facts — liquidity, top-holder %, pool depth,
honeypot / mint / freeze / tax flags — never a black-box number.

## When to use this skill

- Immediately before executing any buy / swap of a Base token the
  user has not already verified.
- When the user asks for a quick safety check on a token address.
- As an automated gate inside a trading workflow: check first, then
  decide.

## When NOT to use it

- For a forensic deep-dive (deployer history, migration narratives,
  off-chain intel, a written report) — that is a different, slower
  analysis. This skill is the seconds-fast gate, not the investigation.
- For non-Base chains (v1 is Base only).

## The gate rule (follow it exactly)

```
card = check(token)
verdict == "clean"     -> proceed with the trade
verdict == "caution"   -> tell the user the risk reasons; proceed only
                          small, or skip — do not proceed silently
verdict == "rug_risk"  -> DO NOT TRADE. Show the user the reasons.
verdict == "exit_trap" -> DO NOT TRADE. Show the user the reasons.
```

## How to run the check

Option A — helper script (from this skill's folder):

```bash
npm i @x402/fetch @x402/evm viem
EVM_PRIVATE_KEY=0x... node scripts/check-token.mjs 0x<token-address>
```

With no `EVM_PRIVATE_KEY` set, the script runs a free dry-run: it
prints the endpoint's 402 payment challenge (price, network, payTo)
and pays nothing.

Option B — call it from your own code with any x402 client
(`@x402/fetch` + `registerExactEvmScheme`, a viem signer holding USDC
on Base, `wrapFetchWithPayment(fetch, client)`, then POST the body
above). A ready-made client is in `scripts/check-token.mjs`
(`getTokenVerdict(address, signer)` + `isTradeAllowed(card)`).

## Cost & failure behaviour

- Exactly $0.02 per successful check, settled in USDC on Base.
- If the endpoint cannot produce a verdict (data sources down or the
  token is unknown), it returns HTTP 502 and the x402 payment is
  **never settled** — a failed check costs nothing.
- Keep only a small USDC float in the paying wallet.

## Reporting back to the user

Show: the verdict, the score, and the top reasons from the card —
in plain language, e.g.:

> 🛡️ Token Verdict: **caution — 58/100**
> • Liquidity is thin at $32.1k — expect heavy slippage
> • Top 10 holders control 47.2% of supply
> • Sell tax is 6%
> Gate: trade small or skip.

## Links

- Endpoint: https://crypto-intel-agent.vercel.app/api/token-verdict
- Discovery: https://crypto-intel-agent.vercel.app/.well-known/x402
- Integration examples (AgentKit, ElizaOS, plain client):
  https://github.com/Spacemandomains/token-verdict-integrations
- Listed in the Coinbase Bazaar; also on Agent402 and
  agent-tools.cloud (#3249).
