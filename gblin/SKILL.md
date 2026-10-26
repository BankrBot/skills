---
name: gblin
description: |
  Hold cbBTC, WETH and USDC on Base as one token. GBLIN is a
  collateral-backed basket vault that mints and redeems at net asset value,
  moves target weight toward USDC when a basket asset falls sharply, and can
  always be redeemed in kind. Free read endpoints, no API key, no signup.
  Transactions come back unsigned and are sent from the user's own Bankr
  wallet after the user confirms.

  Triggers: "park my idle USDC", "put my USDC into BTC and ETH", "buy GBLIN",
  "what is GBLIN worth", "plan my agent treasury", "redeem my GBLIN",
  "sell GBLIN for USDC".
tags: [defi, base, vault, basket, treasury, usdc, cbbtc, weth]
visibility: public
credentials:
  - name: GBLIN_API_URL
    description: API origin. Defaults to https://gblin.digital.
    required: false
    storage: env
metadata:
  openclaw:
    requires:
      bins:
        - curl
        - jq
---

# GBLIN

One ERC-20 on Base backed by a basket of cbBTC, WETH and USDC held in the
vault contract. Shares are minted and redeemed at net asset value (NAV) read
from Chainlink feeds. When a basket asset falls sharply from its peak, the
contract cuts that asset's target weight; a Dutch auction then rebalances the
reserves. Redemption in kind needs no price and charges no fee.

| Contract | Address (Base, chain ID 8453) |
|---|---|
| GBLIN vault (the token) | `0xc2181d975c05c8c724b334bcED0764c0b86B1D53` |
| GBLINZap (USDC and ETH routes) | `0x0E9D6Ceb6D313b021622C121Cda9C62e86e60200` |
| GBLINLens (read-only views) | `0xfCFea8027019E8551A1f09AD91532471F5D26f61` |

Source code, documentation and review record:
https://github.com/gblinproject/GBLIN-Protocol

## Rules for the agent

1. **Read before you act.** Call `treasury-state` (and `plan` when the user
   has a wallet) first. Quote numbers only from the responses, never from this
   file: weights, fees and the shield state change on-chain.
2. **Confirm with the user before every submission.** Show the amount in, the
   expected and minimum amount out, the fee, and that the value of GBLIN moves
   with BTC and ETH. Wait for an explicit yes. Do not describe GBLIN as advice,
   a savings account or a yield product.
3. **Submit prepared steps in order and promptly.** Every prepared transaction
   carries minimum outputs set from current prices. Send the steps one after
   the other within about a minute; if a step fails or time passes, prepare
   again instead of resending old calldata.
4. **Keep the gas limit a step carries.** Steps that include a `gas` field must
   be sent with that limit (the vault reserves gas for capped transfers, so an
   automatic estimate can run out of gas).
5. **Never resend blindly.** A failed submission that returned a transaction
   hash was broadcast; look the hash up before trying again.
6. **Arbitrary contract calls must be enabled** in the Bankr wallet's Security
   settings for the raw steps below. Named swaps are not affected.

## Base URL

```bash
: "${GBLIN_API_URL:=https://gblin.digital}"
```

## Read (free)

```bash
# NAV, basket weights, shield state
curl -sS "$GBLIN_API_URL/api/x402/treasury-state" | jq .

# Treasury plan for a wallet: operating cash, surplus, mint simulation with
# live fees, exit cost today, blockers. Nothing is executed or advised.
curl -sS "$GBLIN_API_URL/api/x402/plan?wallet=$WALLET&daily_burn=5&days=7&reserve=50&trial=20" | jq .

# Quote a mint with ETH (amount in ETH) or a sale (amount in GBLIN)
curl -sS "$GBLIN_API_URL/api/x402/quote?direction=buy&amount=0.01" | jq .

# Governance: owner, timelock delay, fee recipient
curl -sS "$GBLIN_API_URL/api/x402/governance" | jq .
```

`plan` returns `wallet_state.cooldown`: redemption is blocked for a few
seconds after a wallet mints for itself (currently 20 seconds, read live).

## Mint with USDC (two transactions)

```bash
curl -sS "$GBLIN_API_URL/api/x402/invest?wallet=$WALLET&usdc=25" | jq .
```

The response holds `steps[]`, each with `to`, `data`, `value` and `chainId`:

1. approve USDC to GBLINZap;
2. `GBLINZap.buyGBLINWithToken`: swap USDC to WETH and mint at NAV in one
   transaction, with both minimums set. This step carries `gas`.

Send each step from the Bankr wallet:

```bash
bankr wallet submit json '{"to":"<to>","chainId":8453,"value":"<value>","data":"<data>","gas":"<gas, when present>"}'
```

`expected.gblin_min` is the least the user can receive; show it before
confirming.

## Mint with ETH (one transaction)

Get `safe_min_gblin_out` from `quote?direction=buy&amount=<ETH>`, convert it to
18-decimal units, then call the vault directly:

> Call `buyGBLIN(uint256)` on `0xc2181d975c05c8c724b334bcED0764c0b86B1D53` on
> Base with `<minOut in wei>` and send `<amount> ETH` with it.

## Exit

### In kind: no fee, no price needed

`sellGBLIN(uint256)` burns shares and sends the holder's pro rata share of every
asset: the WETH portion as ETH, plus cbBTC and USDC.

> Call `sellGBLIN(uint256)` on `0xc2181d975c05c8c724b334bcED0764c0b86B1D53` on
> Base with `<shares in wei>`.

If a token transfer cannot complete, the amount is credited to the holder and
can be collected later with `claimPending(address token)`.

### To USDC (three transactions)

```bash
curl -sS "$GBLIN_API_URL/api/x402/jit?wallet=$WALLET&usdc=10" | jq .
```

1. approve the shares to GBLINZap;
2. `GBLINZap.sellGBLINForEth`: redeem in kind and sell the legs for ETH, all or
   nothing. This step carries `gas`;
3. swap the ETH to USDC on Uniswap V3 (this step carries a native `value`).

If step 2 reverts with `PriceOffTwap`, a market price is too far from its
time-weighted average: wait and prepare again, or exit in kind.

## Fees and risks

- Mint: 0.10% in total today, half to the fee recipient and half kept in the
  vault for existing holders. Management: 0.50% a year, minted as shares.
  Redemption in kind: no fee. Read the live values from `plan`.
- The value of GBLIN follows BTC and ETH. The crash shield reduces target
  weights after large falls; it does not guarantee any outcome.
- The vault is owned by a 48-hour timelock that can change parameters only
  within bounds written in the contract. Check it live with `governance`.
- No paid third-party audit and no formal verification. Unit, fuzz, invariant
  and fork tests, static analysis, symbolic execution and line-by-line reviews
  are listed in `audits/README.md` of GBLIN-Protocol.

## Links

- App: https://gblin.digital
- Agent API reference: https://gblin.digital/api/x402/llms.txt
- MCP server: `npx -y @gblin-protocol/mcp-server` or https://mcp.gblin.digital/mcp
- Security contact: info@gblin.digital
