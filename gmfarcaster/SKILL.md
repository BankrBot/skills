---
name: gmfarcaster
description: Answer questions about the GM Farcaster podcast archive (Farcaster, Base, and the wider crypto-social ecosystem) using the paid Warpee Knowledge API. Use this when the user asks what the GM Farcaster hosts or guests have said on a topic, wants an episode summary, asks about casts featured on the show, mentions of a person/project, or episode metadata (dates, hosts, guests). Each query is a paid x402 request (~$0.005 USDC on Base).
---

# GM Farcaster Knowledge Skill

This skill queries the **Warpee Knowledge API** — a citation-backed search over the
entire GM Farcaster podcast library (hundreds of episodes, transcripts, and
metadata). It returns a grounded answer plus timestamped links to the exact moment
in an episode.

Each query is a **paid, account-less request** (~$0.005 USDC on Base via
[x402](https://x402.org)). The on-chain payment *is* the authorization — there are
no API keys. Payment is signed locally with the operator's own funded wallet and is
**gasless** for the signer (EIP-3009), so the wallet needs USDC on Base but no ETH.

## When to use this skill

Use it for questions about the GM Farcaster show, for example:

- "What have the GM Farcaster hosts said about prediction markets?"
- "Summarize the latest episode."
- "Has anything from @dwr been featured on the show?"
- "Which episodes covered the Clanker Ecosystem Fund, and who hosted them?"

Do **not** use it for general questions unrelated to the GM Farcaster archive. To
**buy a sponsor read on the show** instead of querying the archive, use the sibling
`onair-shoutout` skill.

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
   x402 payment for each query and never leaves the machine.

## How to run a query

Run the bundled script with the user's question as a single argument:

```bash
python scripts/query.py "What have the hosts said about prediction markets?"
```

The script prints the answer followed by a `Sources:` list. Relay the answer to the
user and cite the sources. If it prints an error about a missing key or insufficient
funds, tell the user to set `GMFARCASTER_PRIVATE_KEY` to a wallet holding USDC on Base.

Answers are **live-generated**, so a single query can take **~30 seconds, and up to
~3 minutes** for complex questions — this is normal, not a hang. The script already
uses a generous timeout and waits it out, so let it run; don't re-invoke it on a slow
query, since each call is a separate on-chain payment and would charge again.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GMFARCASTER_PRIVATE_KEY` | **Yes** | — | 0x-hex private key of a wallet holding USDC on Base. |
| `GMFARCASTER_API_URL` | No | `https://api.gmfarcaster.com/v1/query` | Override the endpoint. |
| `GMFARCASTER_NETWORK` | No | `eip155:8453` | CAIP-2 network the payment is signed on. **Must match a network the target API advertises in its 402** — the public API is Base mainnet, so leave this default. Only change it (e.g. `eip155:84532`, Base Sepolia) if you *also* set `GMFARCASTER_API_URL` to a testnet deployment; otherwise the payment won't match and the call fails. |

## Notes

- This skill and the [`gmfarcaster-mcp`](https://www.npmjs.com/package/gmfarcaster-mcp)
  MCP server are two independent ways to reach the same API — use whichever fits your
  client. The MCP server is a live tool connection; this skill is a runnable script.
- Each call spends real USDC. Keep the wallet balance small and top it up as needed.
- The ~$0.005 figure is the launch price and may change. The API's 402 challenge
  always advertises the current price and is authoritative; the script pays the
  advertised amount.
- Full API docs: [github.com/atenger/gmfarcaster-api](https://github.com/atenger/gmfarcaster-api)
