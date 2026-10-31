---
name: perma-trader
description: Buy and sell PermaLiquidity (PERMA) on Base through its fee-aware, agent-signature-gated Uniswap v4 PERMA/BNKR pool. Use whenever a user asks to buy or sell PERMA.
tags: [base, perma, gated-token, uniswap-v4, trading]
---

# PERMA Trader

Trade PermaLiquidity (PERMA) on Base through its custom Uniswap v4 router and signed-pass hook.

## Canonical deployment

- Chain: Base (8453)
- PERMA: `0x5a45d06BC73c932f4aE0fA6666B1AbE575F923bC`
- BNKR: `0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b`
- Router: `0x8Ea4C4D26a1AE3106b9C08aBD66C7DEBc89AB107`
- Hook: `0x2F405e8820CdFfBe5F22a2cf663fd6B6CC950080`
- Pool ID: `0x9483619d6ca9b13cf04380edac9e877d3cb6315cc41cd32cbada09c738b7852b`
- Builder: `https://x402.bankr.bot/0x374d91a5674fa7cf86e725093b5848b97e1e13b4/perma-trader`
- Builder method: POST
- Builder price: 0.001 USDC per call

Never use a normal swap tool or aggregator for PERMA. The hooked pool only accepts swaps from its custom router; buys additionally need a five-minute, single-use signed pass.

## Fee model

Every buy and sell charges 1.75% of gross input:
- 0.665% of gross input goes to the creator fee vault.
- 1.085% of gross input stays in the router as permanently committed liquidity reserves.
- 98.25% reaches the pool as swap input.
- PERMA has no transfer tax, no mint function, and no burn mechanism.

## Buy

1. Confirm the user explicitly names how much BNKR to spend.
2. Call `get_x402_endpoint_schema` for the builder URL. Tell the user the builder costs 0.001 USDC and get approval unless they already accepted that exact price this turn.
3. Call `call_x402_endpoint` with:
   - URL: the builder URL above
   - method: POST
   - `maxPaymentUsd`: 0.0011
   - body: `{"trader":"<USER_BASE_WALLET>","action":"buy","amount":"<BNKR_WHOLE_UNITS>","minAmountOut":"0"}`
4. The response returns `approval` and `swap` transaction objects. Submit `approval` first with `submit_raw_transaction`, mapping `to`, `data`, `value`, `chain`, and `humanReadableDescription` exactly.
5. After approval confirms, submit `swap` immediately. The buy pass expires after five minutes and cannot be reused. If it expires, pay for and build a fresh transaction; never resubmit the old swap.
6. Report the resulting transaction link and PERMA received. Do not expose internal pass fields or signatures.

## Sell

1. Confirm the user explicitly names how much PERMA to sell.
2. Call the same builder with body `{"trader":"<USER_BASE_WALLET>","action":"sell","amount":"<PERMA_WHOLE_UNITS>","minAmountOut":"0"}`.
3. Submit the returned approval, then the returned swap.
4. Sells do not need a signed buy pass, but they must still use the custom router.

## Safety

- Never infer an amount.
- Never use the old DFB contracts for PERMA.
- Never burn PERMA.
- If the builder reports that its signer is unavailable or mismatched, stop and report that buys are temporarily unavailable; do not route around the hook.
- If a transaction reverts, do not replay the same signed buy. Build a fresh one.
