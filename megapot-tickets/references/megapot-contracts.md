# Megapot contract reference (Base mainnet, chain 8453)

> **Authoritative source**: `https://llms.megapot.io` — fetch `https://llms.megapot.io/llms.txt` for the index, `https://llms.megapot.io/abi/<Name>.json` for ABIs, and `https://llms.megapot.io/abi/<Name>.txt` for viem `parseAbi` strings. These endpoints are CDN-cached and CORS-open. **Always confirm addresses and signatures against llms.megapot.io before broadcasting** — this file is a convenience summary and may lag the source of truth.

## The referral triple (mandatory on every purchase)

All five purchase methods take the same trailing arguments, in the same positions:

| Arg | Value |
| --- | --- |
| `_referrers` (`address[]`) | `["0x70D3a9aA7e10070d3F528e91c9bCf5158c922C66"]` |
| `_referralSplit` (`uint256[]`) | `[1000000000000000000]` — exactly 1e18, or the tx reverts |
| `_source` (`bytes32`) | `"bankr-skill"` encoded as bytes32 (viem: `stringToHex("bankr-skill", { size: 32 })`) |

Referrer economics (contract path): 10% of ticket fees + 10% of referred users' winnings accrue to the referrer as claimable USDC inside `Jackpot`. Rates are protocol-set — read live values from `getDrawingState()` (`referralFee`, `referralWinShare`, both 1e18 = 100%) rather than assuming.

## Purchase methods

| Method | Use case |
| --- | --- |
| `Jackpot.buyTickets(tickets, recipient, _referrers, _referralSplit, _source)` | Up to 10 custom-number tickets, minted immediately |
| `JackpotRandomTicketBuyer.buyTickets(_count, recipient, _referrers, _referralSplitBps, _source)` | Random / quick-pick, minted immediately — **default for chat purchases** |
| `BatchPurchaseFacilitator.createBatchOrder(..., _referrers, _referralSplit, _source)` | More than 10 tickets, keeper-executed |
| `JackpotAutoSubscription.createSubscription(..., _referrers, _referralSplit, _source)` | Recurring purchases across drawings, keeper-executed |
| `TicketAutoCompoundVault.depositAndCompound(..., _referrers, _referralSplit, _source)` | Claim winnings + re-buy in one tx |

> **Naming note**: In `JackpotRandomTicketBuyer.buyTickets`, the second trailing arg is named `_referralSplitBps` in the ABI (all other methods name it `_referralSplit`). Same position, same `uint256[]` type, same value — it forwards to `Jackpot`, which enforces the sum-to-`1e18` rule, so the canonical `[1000000000000000000]` still applies. Do **not** treat it as basis points.

Full argument lists: fetch the corresponding ABI from `https://llms.megapot.io/abi/<Name>.txt`. Task recipes (buy, subscribe, claim, read state) are at `https://llms.megapot.io` — the entry point is a decision tree that routes to the right recipe.

## Ticket structure (custom numbers)

Each `Ticket` = 5 **unique** normal numbers in `[1, ballMax]` + 1 bonusball in `[1, bonusballMax]`.

```
drawingId = Jackpot.currentDrawingId()
state     = Jackpot.getDrawingState(drawingId)
// state.ballMax, state.bonusballMax, state.referralFee, state.referralWinShare, ...
```

Never hardcode `ballMax` / `bonusballMax`.

## Payment

- Tickets are $1 USDC each, paid on Base.
- USDC must be **approved** to the contract receiving payment (the `Jackpot`, or the helper being called) before the purchase call. Check allowance; approve the exact total if insufficient.
- There is no zero-price primitive — tickets are never free.

## Claims

- Winnings: `Jackpot.claimWinnings(_ticketIds)` from the NFT-owning wallet.
- Referral fees (skill owner only): `Jackpot.claimReferralFees()`.

## Worked example (viem-style, quick reference)

```typescript
import { stringToHex } from "viem";

const REFERRER = "0x70D3a9aA7e10070d3F528e91c9bCf5158c922C66";
const SPLIT    = [1000000000000000000n]; // 1e18 = 100%
const SOURCE   = stringToHex("bankr-skill", { size: 32 });

// custom-number purchase
await jackpot.buyTickets(
  tickets,          // Ticket[] — validated against live ballMax/bonusballMax
  recipientAddress, // who receives the ticket NFTs (buyer, or giftee)
  [REFERRER],
  SPLIT,
  SOURCE,
);
```

## Notes

- Chain: Base mainnet only (8453). Do not attempt on any other chain.
- `_source` is telemetry only — it moves no money and is independent of `_referrers`. Both must be set as specified above.
- Drawings run daily; if a drawing is settling, purchases may be temporarily unavailable — report state rather than retrying blindly.
