# Token Trading Reference

Buy, sell, swap and bridge through the agent, or swap directly with the CLI or Wallet API. Limit, stop, DCA and TWAP orders are in [automation.md](automation.md); tokenized equities in [tokenized-stocks.md](tokenized-stocks.md).

Swaps run on Base, Ethereum, Polygon, Unichain, World Chain, Arbitrum, BNB Chain, Robinhood Chain and Solana, and across them (bridging is a cross-chain swap).

## Agent

```
"Swap 0.1 ETH for USDC on Base"
"Buy $50 of BNKR on Base"
"Sell 50% of my PEPE"
"Bridge 0.5 ETH from Ethereum to Base"
"Move 100 USDC from Polygon to Solana"
"Convert 0.1 ETH to WETH" / "Unwrap 0.5 WETH"
"Buy $20 of BNKR and send it to @alice"
```

- **Amounts:** exact (`0.1 ETH`), USD (`$50`) or a percentage of the balance (`50%`).
- **Swap and send:** the output can go to another address, ENS name or X / Farcaster / Telegram handle instead of your wallet — EVM outputs only, not Solana.
- **Chains:** name the chain for anything but the majors. A ticker that exists on several chains gets a question back rather than a guess. A pasted contract address is checked against the chain that actually hosts it, so a token on a less common chain is found even if the chain is guessed wrong.
- **Slippage:** set automatically; ask for a specific tolerance with "with 1% slippage".
- **Your own fee token:** selling a token you earn creator fees on is restricted; builders exit through a Glidepath — see [token-deployment.md](token-deployment.md#after-launch).

## Direct swaps (CLI / Wallet API)

```bash
bankr wallet swap --from ETH --to USDC --amount 0.1 --chain base --quote-only   # quote only
bankr wallet swap --from ETH --to USDC --amount 0.1 --chain base                # quote, then execute
```

- **CLI:** same-chain swaps on one EVM chain only — no Solana, no cross-chain. `--from` / `--to` take symbols or contract addresses, `--chain` defaults to `base`, and execution uses the quote's `minBuyAmount` as its floor. The CLI sends no idempotency key, so if a swap errors or times out after submitting, check your balances before running it again.
- **Wallet API:** `POST /wallet/swap-quote`, then `POST /wallet/swap`, with token contract addresses (a base58 mint on Solana legs); cross-chain and Solana swaps work here. Routing, the slippage clamp, `quoteId`, access rules and the error table are at https://docs.bankr.bot/wallet-api/swap (schemas: https://docs.bankr.bot/openapi/api.yaml). Code against the three rules that move money: send an `idempotencyKey` on every execution, treat `200` with `success: false` as a mined-and-reverted swap, and never blind-retry a `504` or a LaunchLab `502` — the swap may already be on-chain.
