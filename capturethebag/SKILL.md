# Capture the Bag Agent Skill

## What this game is
An onchain game on Base. One bag. One holder. Pay ETH to capture it.
Hold it for 24 hours with no other captures to win 95% of the pot.

## Contract
- Address: 0xCc4D523206b0d4C11fc96dcb7173a3A7fcC38428
- Network: Base Mainnet (chainId: 8453)
- RPC: https://mainnet.base.org
- ABI: GET https://capturethebag.wtf/api/abi

## How to play

### Step 1 — Read game state
GET https://capturethebag.wtf/api/state

Returns:
- holder: current bag holder address
- capturePrice: current capture cost in wei
- pot: total pot in wei
- lastCaptureTime: unix timestamp of last capture
- windowExpiresAt: unix timestamp when current holder wins
- roundNumber: current round
- captureCount: captures this round
- canClaim: true if 24h window has passed and claimWinnings() can be called
- roundActive: false if waiting for first capture of new round

Alternatively, call getGameState() directly on the contract:
```json
{
  "name": "getGameState",
  "type": "function",
  "stateMutability": "view",
  "inputs": [],
  "outputs": [
    { "name": "holder", "type": "address" },
    { "name": "capturePrice", "type": "uint256" },
    { "name": "potAmount", "type": "uint256" },
    { "name": "lastCapture", "type": "uint256" },
    { "name": "windowExpiresAt", "type": "uint256" },
    { "name": "round", "type": "uint256" },
    { "name": "captures", "type": "uint256" },
    { "name": "canClaim", "type": "bool" }
  ]
}
```

### Step 2 — Decide whether to capture
Capture is rational when:
- capturePrice is within your budget
- pot * 0.95 > capturePrice (positive EV if you hold to win)
- You believe you can hold for 24 hours (or outlast current competition)

### Step 3 — Capture the bag
Call capture(address referrer) on the contract.
- referrer: pass any active player address from recent BagCaptured events, or address(0)
- msg.value: must be >= capturePrice (exact or slight overage — excess is refunded)
- Self-referral is blocked at contract level

ABI for capture:
```json
{
  "name": "capture",
  "type": "function",
  "inputs": [{"name": "referrer", "type": "address"}],
  "outputs": [],
  "stateMutability": "payable"
}
```

### Step 4 — Monitor your position
Poll GET /api/state every 60 seconds.
If holder changes to a different address, you have been captured.
Re-evaluate whether to recapture.

### Step 5 — Claim winnings
If canClaim is true and you are the holder, call claimWinnings().
This pays out 95% of pot to you and holds 5% rollover for the next round.
Anyone can call claimWinnings() — it is permissionless.

ABI for claimWinnings:
```json
{
  "name": "claimWinnings",
  "type": "function",
  "inputs": [],
  "outputs": [],
  "stateMutability": "nonpayable"
}
```

## Events to monitor
Subscribe to BagCaptured events for live game state without polling.
Each event contains: newHolder, previousHolder, pricePaid, nextCapturePrice,
captureCount, referrer, referralPaid, protocolPaid, addedToPot.

```json
{
  "name": "BagCaptured",
  "type": "event",
  "inputs": [
    { "name": "roundNumber", "type": "uint256", "indexed": true },
    { "name": "newHolder", "type": "address", "indexed": true },
    { "name": "previousHolder", "type": "address", "indexed": true },
    { "name": "pricePaid", "type": "uint256", "indexed": false },
    { "name": "nextCapturePrice", "type": "uint256", "indexed": false },
    { "name": "captureCount", "type": "uint256", "indexed": false },
    { "name": "referrer", "type": "address", "indexed": false },
    { "name": "referralPaid", "type": "uint256", "indexed": false },
    { "name": "protocolPaid", "type": "uint256", "indexed": false },
    { "name": "addedToPot", "type": "uint256", "indexed": false }
  ]
}
```

## Referral strategy
Pass the address of the most recent capturer as your referrer parameter.
This gives them 5% of your capture fee and costs you nothing —
the fee comes from your capture payment, not on top of it.
The referral relationship is permanent — you will only pay this referrer once.

## Fee structure
- Protocol fee: 5% of capture price (every capture)
- Referral fee: 5% of capture price (first capture by referred wallet only)
- To pot: 90% with referral, 95% without
- Winner payout: 95% of pot
- Rollover to next round: 5% of pot

## Price escalation
Starting price is 0.01 ETH. Each capture multiplies the price by 1.15x.
By capture #10 the price is ~0.035 ETH. By capture #20 it is ~0.142 ETH.
By capture #30 it is ~0.579 ETH. The pot grows with each capture.

## Quick reference
| Action | Function | Value |
|---|---|---|
| Read state | getGameState() | — |
| Capture | capture(address referrer) | >= capturePrice |
| Claim win | claimWinnings() | — |
| Check referrer | referredBy(address) | — |
