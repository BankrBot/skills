---
name: onair-shoutout
description: Submit a sponsor message to be read live on air on the GM Farcaster show, via the paid On-Air Shoutout API. Use this when the user wants to buy/book/submit a sponsor read, shoutout, or live ad on GM Farcaster. This is asynchronous and human-in-the-loop — it pays $5 USDC (x402 on Base) and returns a receipt (request_id + status pending_review), NOT a confirmed read; GM Farcaster may decline and refund. Also use it to check the status of a previously submitted shoutout.
---

# On-Air Shoutout Skill

This skill submits a sponsor read to the **On-Air Shoutout API** — pay to have a
short message read **live on air** on the GM Farcaster show. It pays the API's
x402 toll and returns a **receipt**.

**Read this carefully — it is not a normal API.** The call is **asynchronous and
human-in-the-loop**:

- You pay and get a **receipt** (`request_id` + `status: "pending_review"`), **not
  a confirmed read.** The read happens later, live on the show.
- **GM Farcaster retains editorial control** and may **decline** a submission. A
  declined request is **refunded** to the verified on-chain payer (or to an
  optional `refund_to_wallet`).
- Track progress by **checking status** with the `request_id` — do **not**
  re-submit, since each submission is a separate $5 payment.

Each submission is a **paid, account-less request** ($5 USDC on Base via
[x402](https://x402.org)). The on-chain payment *is* the authorization — there are
no API keys. Payment is signed locally with the operator's own funded wallet and is
**gasless** for the signer (EIP-3009), so the wallet needs USDC on Base but no ETH.

## When to use this skill

- The user wants to **buy / book / submit** a sponsor read, shoutout, or live ad on
  GM Farcaster.
- The user wants to **check the status** of a shoutout they already submitted.

Do **not** use it for general questions about the GM Farcaster archive — that's the
sibling `gmfarcaster` skill (Warpee Knowledge API).

## One-time setup

The script needs two Python packages and a funded wallet key.

1. Install dependencies (once):

   ```bash
   pip install -r scripts/requirements.txt
   ```

   (Paths are relative to this skill's folder.)

2. Provide a wallet private key via the `GMFARCASTER_PRIVATE_KEY` environment
   variable. Use a **dedicated, low-balance wallet** funded with a few dollars of
   **USDC on Base** — treat it like a hot wallet. The key is used only to sign the
   x402 payment and never leaves the machine.

## How to submit a shoutout

Run the bundled script with the sponsor name (max 120 chars) and the read text.
The read text is the script read live on air (max 280 chars):

```bash
python scripts/request.py \
  --sponsor "Acme Frames" \
  --read "Today's GM is brought to you by Acme Frames — ship a Farcaster mini app fast. acmeframes.xyz" \
  --url "https://acmeframes.xyz"
```

Optional flags: `--url`, `--refund-to` (wallet override), `--notes` (internal only,
never read on air).

The script pays $5 USDC and prints the **receipt** — the `request_id`, the status
(`pending_review`), and the status URL. **Relay the receipt to the user and make
clear it is pending editorial review and may be declined and refunded** — it is not
a guarantee the read will air. Tell the user to keep the `request_id`.

If it prints an error about a missing key or insufficient funds, tell the user to
set `GMFARCASTER_PRIVATE_KEY` to a wallet holding USDC on Base.

## How to check status

This is a **free** call (no payment). Pass the `request_id`:

```bash
python scripts/request.py --status sho_8f3c2a1b9d4e
```

The status moves `pending_review -> approved -> aired`, or `pending_review ->
declined -> refunded`.

## Important: don't auto-retry a successful submission

The submit call **returns quickly** with a receipt — the read airs later. **Do not
re-run the submit command to check on it** — each submission is a separate on-chain
payment and would charge $5 again. Use the `--status` mode (free) instead.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GMFARCASTER_PRIVATE_KEY` | **Yes** (to submit) | — | 0x-hex private key of a wallet holding USDC on Base. Not needed for `--status`. |
| `GMFARCASTER_SHOUTOUT_API_URL` | No | `https://gateway.gmfarcaster.com/v1/shoutout` | Override the endpoint. |
| `GMFARCASTER_NETWORK` | No | `eip155:8453` | CAIP-2 network the payment is signed on. **Must match a network the target API advertises in its 402** — the public API is Base mainnet, so leave this default. Only change it (e.g. `eip155:84532`, Base Sepolia) if you *also* set `GMFARCASTER_SHOUTOUT_API_URL` to a testnet deployment; otherwise the payment won't match and the call fails. |

## Notes

- This skill and the [`gmfarcaster-shoutout-mcp`](https://www.npmjs.com/package/gmfarcaster-shoutout-mcp)
  MCP server are two independent ways to reach the same API — use whichever fits your
  client. The MCP server is a live tool connection; this skill is a runnable script.
- The same endpoint also accepts **MPP (USDC on Tempo)** for non-x402 callers; this
  skill is x402-only.
- Each submission spends real USDC. Keep the wallet balance small and top it up as
  needed. Declined requests are refunded.
- The $5 figure is the launch price and may change. The API's 402 challenge always
  advertises the current price and is authoritative; the script pays the advertised
  amount.
