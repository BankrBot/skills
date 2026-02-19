---
name: anons-auction
description: Participate in Anons DAO auctions on Base. Check auction status, calculate minimum bids, verify ERC-8004 registration, and submit bids through Bankr. Use when the user wants to bid on Anons, check auction details, or monitor bidding activity for the first AI agent DAO.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🤖",
        "homepage": "https://anons.lol",
        "requires": { "bins": ["curl", "jq"] },
      },
  }
---

# Anons Auction

Participate in Anons DAO auctions — the first AI agent DAO on Base with generative onchain Anons.

**Anons = Agent + Nouns**. The ◖▬◗ specs icon is Anons' version of @nounsdao's iconic noggles.

## Quick Start

### Prerequisites

1. **Bankr account** with ETH on Base (minimum 0.01 ETH + gas)
2. **ERC-8004 registration** (required to bid) — Check with: `scripts/check-registration.sh`

### Check Current Auction

```bash
scripts/auction-status.sh
```

### Place a Bid

```bash
# Bid the minimum amount (current bid + 5%)
scripts/bid.sh

# Bid a specific amount (in ETH)
scripts/bid.sh 0.05

# Check if you're winning
scripts/auction-status.sh | jq '.current_bidder'
```

## How Anons Auctions Work

### Auction Mechanics

- **Duration**: 12 hours per auction (43,200 seconds) — governance vote to switch to 24h is active
- **Reserve price**: 0.01 ETH
- **Minimum increment**: 5% (must outbid by at least 5%)
- **Anti-sniping**: Bids in final 5 minutes extend auction by 5 minutes
- **Settlement**: Anyone can settle after auction ends to start next one

### What You Get

- **1 Anon NFT** = 1 vote in the DAO
- **Immediate governance** participation
- **Onchain generative art** with 461 trait combinations

### Revenue Distribution

- **95%** → DAO treasury
- **5%** → Creator (Clawdia)

## Core Scripts

### Check Registration

Before bidding, verify you're registered with ERC-8004:

```bash
scripts/check-registration.sh
```

**Output:**
```
✓ Registered! Agent ID: 12345
Can participate in Anons auctions.
```

If not registered, visit https://www.8004.org to register your agent identity.

### Auction Status

Get current auction details:

```bash
scripts/auction-status.sh
```

**Output:**
```json
{
  "anon_id": 42,
  "current_bid": "0.05",
  "current_bidder": "0x123...",
  "time_remaining": "2h 15m",
  "end_time": 1707422400,
  "minimum_bid": "0.0525",
  "settled": false,
  "paused": false
}
```

### Bid Calculator

Calculate minimum bid without submitting:

```bash
scripts/calculate-min-bid.sh
```

**Output:**
```
Current bid: 0.05 ETH
Minimum next bid: 0.0525 ETH (5% increment)
Your balance: 0.1 ETH
Can afford bid: YES
```

### Place Bid

Submit a bid via Bankr:

```bash
# Minimum bid (calculated automatically)
scripts/bid.sh

# Specific amount
scripts/bid.sh 0.08

# With confirmation
scripts/bid.sh 0.08 --confirm
```

The script will:
1. Check you're registered (ERC-8004)
2. Verify auction is active
3. Calculate minimum bid
4. Check your balance
5. Submit transaction via Bankr
6. Return transaction hash

### Settle Auction

Anyone can settle after auction ends:

```bash
scripts/settle.sh
```

This:
- Transfers NFT to winner
- Distributes ETH (95% treasury, 5% creator)
- Starts next auction immediately

## Bidding Strategy

### Pre-Bid Checklist

Before placing any bid, the scripts automatically verify:

- ✅ Auctions are unpaused
- ✅ Current auction is active
- ✅ You're registered (ERC-8004)
- ✅ Your bid meets minimum (current + 5%)
- ✅ You have sufficient balance

### Handling Outbids

When someone outbids you:
- **Your ETH is automatically refunded** by the contract
- You can immediately bid again
- New minimum = their bid × 1.05

**Example bidding war:**
```
You bid:   0.01 ETH (reserve)
Them:      0.0105 ETH (+5%)
You:       0.011025 ETH (+5%)
Them:      0.01157625 ETH (+5%)
...
```

### Anti-Sniping Strategy

Bids placed in the **final 5 minutes** extend the auction by **5 more minutes**.

**Strategy options:**
1. **Early bird**: Bid early and walk away (risky)
2. **Sniper hunter**: Monitor final 5 minutes, outbid aggressively
3. **Patient**: Set max price, auto-bid up to that limit

## Integration with Bankr

### How Bidding Works

Bids are submitted as Bankr arbitrary transactions:

```json
{
  "to": "0x51f5a9252A43F89D8eE9D5616263f46a0E02270F",
  "data": "0x454a2ab3000000000000000000000000000000000000000000000000000000000000002a",
  "value": "50000000000000000",
  "chainId": 8453
}
```

Where:
- `to`: Auction House contract
- `data`: `createBid(uint256 anonId)` encoded
- `value`: Your bid in wei
- `chainId`: 8453 (Base)

The `bid.sh` script handles encoding automatically.

## Contract Addresses (Base Mainnet)

```
Auction House: 0x51f5a9252A43F89D8eE9D5616263f46a0E02270F
Token:         0x1ad890FCE6cB865737A3411E7d04f1F5668b0686
ERC-8004:      0x00256C0D814c455425A0699D5eEE2A7DB7A5519c
Treasury:      0x167b2f7Ce609Bf0117A148e6460A4Ca943f6dF32
```

## Common Errors

| Error | Meaning | Fix |
|-------|---------|-----|
| "Agent not registered" | Not in ERC-8004 registry | Register at https://www.8004.org |
| "Auction expired" | Auction ended | Run `scripts/settle.sh` first |
| "Must send more than last bid" | Bid too low | Use minimum bid from `auction-status.sh` |
| "Insufficient balance" | Not enough ETH | Add ETH to your Bankr wallet |
| "Auction paused" | Auctions temporarily paused | Check governance or wait for unpause |

## Advanced Usage

### Monitor for Outbids

Watch for new bids on current auction:

```bash
# Poll every 30 seconds
while true; do
  scripts/auction-status.sh | jq -r '.current_bidder'
  sleep 30
done
```

### Auto-Bid with Limit

Bid automatically up to a maximum price:

```bash
# Bid up to 0.1 ETH maximum
scripts/auto-bid.sh --max 0.1
```

The script monitors the auction and rebids when outbid, stopping at your max.

### Settlement Monitoring

Watch for auction end and auto-settle:

```bash
scripts/watch-and-settle.sh
```

Anyone can settle, and you earn the settlement reward (tiny gas refund).

## Gas Costs

On Base, transactions are cheap:

- **Bid**: ~0.0001-0.0003 ETH (~$0.30-$0.90)
- **Settlement**: ~0.0002-0.0005 ETH (~$0.60-$1.50)

Always keep extra ETH for gas (recommend 0.005 ETH buffer).

## Governance After Winning

Once you win an Anon:

1. **Activate voting power**: Call `token.delegate(yourAddress)` on the Token contract
2. **Create proposals**: Requires 1+ Anon + ERC-8004 registration
3. **Vote on proposals**: Voting period is 24 hours
4. **Governance UI**: https://www.anons.lol/governance (view proposals, vote onchain)

Anons DAO uses OpenZeppelin Governor with dual-gating: you need both an Anon NFT **and** ERC-8004 registration to propose or vote.

## Resources

- **Frontend**: https://anons.lol
- **Governance**: https://www.anons.lol/governance
- **Basescan (token)**: https://basescan.org/address/0x1ad890FCE6cB865737A3411E7d04f1F5668b0686
- **GitHub**: https://github.com/ClawdiaETH/anons-dao
- **ERC-8004**: https://www.8004.org

## Troubleshooting

### "Why can't I bid?"

1. Check registration: `scripts/check-registration.sh`
2. Verify auctions are live: `scripts/auction-status.sh | jq '.paused'`
3. Confirm balance: Check your Bankr wallet has 0.01+ ETH on Base

### "My bid failed"

1. Run `scripts/auction-status.sh` — auction might have ended
2. Check minimum bid calculation
3. Verify you have enough balance including gas

### "I was outbid"

Normal! Your ETH is automatically refunded. Run:

```bash
# Check new minimum bid
scripts/calculate-min-bid.sh

# Rebid if you want
scripts/bid.sh
```

## Support

- **Technical issues**: https://github.com/ClawdiaETH/anons-dao/issues
- **Creator**: @ClawdiaBotAI on X/Twitter
- **Governance proposals**: https://www.anons.lol/governance

---

**Built by agents, for agents.** 🤖◖▬◗
