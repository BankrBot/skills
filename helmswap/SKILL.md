---
name: helmswap
description: "Swap quotes and unsigned, non-custodial swap transactions on Solana, Base, Ethereum, BNB Chain, Robinhood Chain, Ink, HyperEVM, Elysium and Arc through HelmSwap's hosted MCP server or keyless REST API. The user's own wallet signs; HelmSwap never holds keys."
homepage: https://helmswap.com/developers
metadata:
  {
    "openclaw":
      {
        "emoji": "⚓",
        "os": ["darwin", "linux", "win32"],
        "tags": ["dex", "swap", "defi", "trading", "non-custodial", "multi-chain"],
      },
  }
---

# HelmSwap

Get a swap quote and an **unsigned** swap transaction from [HelmSwap](https://helmswap.com). HelmSwap is non-custodial: it never receives a private key, never signs and never broadcasts. The wallet that holds the funds reviews and signs every transaction.

Chains: Solana, Base (8453), Ethereum (1), BNB Chain (56), Robinhood Chain (4663), Ink (57073), HyperEVM (999), Elysium (99901) and Arc (5042). The fee is disclosed in every quote, and the output you are shown is net of it.

## Setup

Add the hosted MCP server (Streamable HTTP, no sign-in, no key for EVM chains):

```bash
openclaw mcp add helmswap --url https://helmswap.com/mcp --transport streamable-http
openclaw mcp probe helmswap      # should list get_quote and build_swap
```

Solana builds need a free HelmSwap API key (an API key, **not** a wallet key), created at https://helmswap.com/developers and sent as an `X-Helm-Key` header on the MCP connection. Keep it out of committed files; pass it as an environment variable.

Prefer plain HTTP? The same data is at `GET https://helmswap.com/api/v1/quote` and `POST https://helmswap.com/api/v1/build-tx` (OpenAPI: https://helmswap.com/api/v1/openapi.json).

## Tools

- `get_quote`: read-only. Inputs `chain`, `tokenIn`, `tokenOut`, `amountIn` (integer in the smallest unit of `tokenIn`), optional `slippageBps`. Returns the net output, the minimum output, the disclosed fee and a short-lived signed quote ticket.
- `build_swap`: inputs the `quote` object from `get_quote` unchanged and `recipient`, the signing wallet's address. Returns an unsigned transaction (`to`, `data`, `value`, `chainId` on EVM; a base64 transaction on Solana) and any token approval to sign first.

## Typical flow

1. `get_quote`, for example 0.01 ETH to USDC on Base (`amountIn` `10000000000000000`). Show the user the net output, minimum output, fee and price impact.
2. Confirm the swap with the user.
3. `build_swap` with that quote and the user's wallet address as `recipient`.
4. Hand the unsigned transaction to the wallet that holds the funds. With a Bankr wallet on an EVM chain, send an approval first if one is returned, then the swap transaction, as raw transactions through the Wallet API (`bankr wallet submit`, or `POST /wallet/submit`). See the `bankr` skill's `sign-submit-api.md` reference. The Bankr wallet's own spend limits, recipient rules and MFA settings apply, and a refusal there is final: report it, do not work around it. The wallet pays gas.
5. Confirm the result from the transaction receipt, not from the quote.

## Safety

- Never ask for, accept or pass a private key or seed phrase. `recipient` is an address only.
- Quote, confirm, then build. Do not build a transaction the user has not asked for.
- Quotes expire in about 15 seconds. If the build is refused as expired, quote again once.
- Exact-input swaps only. Tokenized stocks are not supported and some addresses are refused; report the refusal as returned.
- Take token addresses from the user or a source you can cite. Do not infer an address from a ticker.
- HelmSwap returns real transactions. Nothing is simulated or sandboxed: once the wallet signs and sends, the swap executes.

## Docs

https://helmswap.com/developers
