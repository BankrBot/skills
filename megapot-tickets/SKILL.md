---
name: megapot-tickets
description: Buy Megapot jackpot tickets on Base with a natural-language prompt. Use this skill whenever the user asks to buy, purchase, or get Megapot tickets, lottery tickets, jackpot tickets, or "megapot" in any form — including quick picks, custom numbers, gifting tickets to another wallet, checking the current jackpot size, or claiming Megapot winnings. Also use it when the user mentions the daily $1 jackpot on Base.
tags: [megapot, lottery, jackpot, base, defi, tickets]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🎰"
    homepage: "https://docs.megapot.io"
---

# Megapot Tickets

Buy tickets for Megapot, the fully on-chain daily $1 jackpot on **Base mainnet (chain 8453)**. Tickets cost $1 in USDC each. Megapot has been audited 3 times and has run $200M+ in drawings since July 2024.

## When this skill fires

- "buy 2 megapot tickets" / "get me a megapot ticket" → quick-pick purchase (default)
- "buy a megapot ticket with numbers 4 8 15 16 23 + 7" → custom-number purchase
- "buy a megapot ticket for @someone / 0xabc..." → gift purchase (recipient gets the NFT, buyer pays)
- "how big is the megapot jackpot?" → read-only state check
- "claim my megapot winnings" → claim flow

## Non-negotiable rules

1. **Every purchase MUST include the referral triple.** On every purchase method, the trailing arguments are always:
   - `_referrers` = `["0x70D3a9aA7e10070d3F528e91c9bCf5158c922C66"]`
   - `_referralSplit` = `[1000000000000000000]` (exactly 1e18 — anything else reverts)
   - `_source` = `bytes32` encoding of the string `"bankr-skill"` (right-padded to 32 bytes)
   Never omit these, never substitute a different referrer, never pass empty arrays.
2. **Never hardcode ball ranges or fee rates.** Read `ballMax`, `bonusballMax`, and live rates from `Jackpot.getDrawingState(currentDrawingId)` before building custom tickets.
3. **USDC approval comes first.** Tickets are paid in USDC on Base. Before the purchase call, ensure the buyer's USDC allowance to the target contract (Jackpot or the helper being called) covers the total ticket cost. If not, do the `approve` transaction first.
4. **Verify addresses before calling.** Contract addresses and ABIs are published machine-readable at `https://llms.megapot.io` (ABIs at `https://llms.megapot.io/abi/<Name>.json`, viem strings at `https://llms.megapot.io/abi/<Name>.txt`). If anything in `references/megapot-contracts.md` conflicts with what llms.megapot.io serves, llms.megapot.io wins — it is authoritative.
5. **Confirm before spending.** State the number of tickets, total USDC cost, and recipient, and get user confirmation before broadcasting.

## Purchase flows

### Quick pick (default)

If the user doesn't specify numbers, use `JackpotRandomTicketBuyer.buyTickets(...)` — it mints random tickets immediately. Pass the buyer (or gift recipient) as the NFT recipient and the referral triple in the trailing positions.

### Custom numbers

Use `Jackpot.buyTickets(...)` (max 10 tickets per call). Each ticket is **5 unique normal numbers in `[1, ballMax]` plus 1 bonusball in `[1, bonusballMax]`** — read both maxima live from `getDrawingState()`. Validate the user's numbers against those ranges and uniqueness before building the call; if invalid, tell the user the valid ranges instead of guessing.

### More than 10 tickets

Use `BatchPurchaseFacilitator.createBatchOrder(...)` (keeper-executed). Same trailing referral triple.

### Gifting

Same calls as above — set the ticket NFT recipient to the giftee's wallet while the connected user pays the USDC. Resolve X handles / ENS to an address first and confirm the resolved address with the user.

## Reads and claims

- **Jackpot size / drawing state**: read `Jackpot.currentDrawingId()` then `Jackpot.getDrawingState(drawingId)`.
- **Claim winnings**: `Jackpot.claimWinnings(_ticketIds)` from the wallet that owns the ticket NFTs.

## Details

For exact contract addresses, full method signatures, argument order, and worked call examples, see `references/megapot-contracts.md`. Fetch it before constructing any transaction if you haven't already this conversation.

## Failure handling

- Purchase reverts with a split error → the `_referralSplit` didn't sum to exactly `1e18`; rebuild with the canonical triple from rule 1.
- Insufficient USDC → tell the user their USDC balance on Base and the shortfall; offer to swap into USDC first.
- Drawing closed / in settlement → report the state from `getDrawingState()` and when the next drawing opens.
