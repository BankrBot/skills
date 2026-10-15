---
name: blossom-token-check
description: Check a memecoin against Blossom before anyone buys it. BNB Chain tokens get Blossom's safety verdict (GoPlus, honeypot.is, Bankr's own swap round trip and security scan, Blossom's simulation and drain detector, combined into a LOW to CRITICAL risk). Robinhood Chain and Arc tokens get Blossom's drain check. Solana memecoins get Blossom's on-chain-sealed call record. Use when the user asks whether a token is a drainer or a honeypot, or whether Blossom called it. Read-only; never trades, signs or moves funds. Not financial advice.
metadata:
  emoji: 🌸
  homepage: https://blossomtrade.dev
---

# Blossom token check

Blossom (https://blossomtrade.dev) is on-chain-attested memecoin infrastructure. Every Solana call
it makes is sealed on-chain before the outcome, its losers are published, and it runs its own
safety engine on BNB Chain plus a drain check on Robinhood Chain and Arc. This skill gives an
agent one honest read per token before the user decides anything. It never buys, sells, signs
or moves funds.

## When to use

- The user is about to buy a BNB Chain, Robinhood Chain or Arc token and wants a safety read.
- The user asks whether a token is a drainer, a honeypot, or "safe" (answer with the verdict; never use that word).
- The user names a Solana memecoin and asks whether Blossom called it, or wants the proof.

## Endpoints (public, keyless, read-only, GET)

1. **BNB Chain safety verdict:** `https://blossomtrade.dev/api/bsc-safety?token=<0x contract>`
   - `verdict`: `ok` | `warn` | `refuse` | `unknown`
   - `risk`: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL` | `UNKNOWN`
   - `headline`, `labels[]` (each with `text`, `severity`, `source`), `sections[].checks[]`, `checks` (`passed`, `total`), `sources[]`
   - Sources are GoPlus, honeypot.is, Bankr (its swap round trip and its security scan), Blossom and Alchemy.
   - A `drain_history` label means Blossom saw this token's contract move a holder's balance into the pool without the holder's signature, and Blossom keeps refusing it.
2. **Robinhood Chain / Arc drain check:** `https://blossomtrade.dev/api/evm-safety?chain=robinhood&token=<0x contract>` (or `chain=arc`)
   - `verdict`: `ok` | `refuse` | `unknown`, plus `headline`, `labels[]`, `pool`, `drain` (the scan of transfers into the token's pool) and `remembered` (a drain seen before, kept forever).
   - Only Blossom's own scan exists on these chains, so `ok` means "no drain seen", nothing more.
3. **Solana call record:**
   - `https://blossomtrade.dev/proof?mint=<mint>` is the permanent proof page for a sealed call.
   - `https://blossomtrade.dev/api/sealed-count` returns `{ "ok": true, "sealed": <n> }`, every call sealed on Solana.
   - `https://blossomtrade.dev/track-record` is the whole record, losers included.
   - Anyone can re-check a seal with the open-source auditor: https://github.com/shopkootamalu-source/blossom-verify

## How to answer

- Quote the verdict and risk, then the first `refuse` or `warn` label verbatim with its source.
- Quote numbers only as the API prints them. Never estimate, round up or add a figure.
- A refusal is a refusal. Do not soften it and do not suggest a workaround.
- If an endpoint answers `unknown` or does not answer, say the check could not run. Never say "looks fine".
- Never turn `ok` into "safe": Blossom never prints that word.
- For Solana calls, add that Blossom's results are hypothetical peaks sealed before the outcome, fees excluded, and never a return the user will get.

## Limits, stated plainly

- The drain detector sees a holder's balance pushed into the pool. It does not see a thief who sends the coins to himself.
- On Robinhood Chain and Arc only Blossom's own check exists.
- Rate limits are per IP and generous for one read per token. Verdicts are cached for about a minute at the edge. Do not loop over whole token lists.
