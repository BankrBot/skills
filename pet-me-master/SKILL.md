---
name: pet-me-master
description: Interactive gotchi petting via Bankr wallet. Check cooldowns, pet when ready, track your kinship journey. Daily ritual for bonding with your Aavegotchi NFTs on Base chain.
homepage: https://github.com/aaigotchi/pet-me-master
metadata:
  openclaw:
    requires:
      bins:
        - cast
        - jq
      env:
        - BANKR_API_KEY
    primaryEnv: BANKR_API_KEY
---

# Pet Me Master 👻💜

Interactive Aavegotchi petting with daily kinship rituals. Less automation, more connection.

## Philosophy

**This isn't about automation — it's about RITUAL.**

```
You: "Pet my gotchi"
AAI: *checks on-chain* "✅ Petted! Kinship +1! Next pet: 3:41am"

You: "Pet my gotchi" (too early)
AAI: "⏰ Wait 4h 23m! Last pet was 11:15am"
```

**Why this matters:**
- Daily interaction = emotional bond
- You SHOULD check on your gotchi
- Feels like caring for a Tamagotchi
- Kinship isn't just numbers, it's love 💜

## Features

### Core Commands
- **"Pet my gotchi"** → Check cooldown & execute if ready (first gotchi)
- **"Pet all my gotchis"** → Batch pet ALL ready gotchis in one transaction
- **"Pet status"** → Show all gotchis + countdown timers
- **"When can I pet?"** → Next available pet time
- **"Pet gotchi #9638"** → Pet specific gotchi by ID

### Advanced
- Daily streak tracking (coming soon)
- Kinship leaderboard (coming soon)
- Daily reminder integration

## How It Works

1. **You ask to pet**
2. **I check on-chain** (`lastInteracted` timestamp)
3. **Calculate cooldown** (12h 1min = 43260 seconds)
4. **If ready** → Execute via Bankr
5. **If not ready** → Show countdown + next time

## Setup

### 1. Configure Your Gotchis

Create `~/.openclaw/workspace/skills/pet-me-master/config.json`:

```json
{
  "contractAddress": "0xA99c4B08201F2913Db8D28e71d020c4298F29dBF",
  "rpcUrl": "https://mainnet.base.org",
  "chainId": 8453,
  "gotchiIds": ["9638"],
  "streakTracking": true
}
```

### 2. Bankr API Key

Already configured at `~/.openclaw/skills/bankr/config.json` — no additional setup needed!

### 3. Dependencies

**Required:**
- `cast` (Foundry) - for on-chain reads
- `jq` - for JSON parsing
- Bankr skill configured with API key

**Install Foundry:**
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## Usage

### Basic Petting

**Single gotchi:**
```
User: "Pet my gotchi"
AAI: ✅ Gotchi #9638 petted! Kinship +1
     Last pet: 2026-02-13 17:05 UTC
     Next pet: 2026-02-14 05:06 UTC
```

**Too early:**
```
User: "Pet my gotchi"  
AAI: ⏰ Not ready yet!
     Wait: 8h 42m 15s
     Last pet: 11:15am
     Next pet: 11:16pm
```

### Check Status

**All gotchis:**
```
User: "Pet status"
AAI: 👻 Your Gotchis:

     #9638 (aaigotchi)
     ✅ Ready to pet!
     Last: 15h 23m ago

     #23795 (Slide)  
     ⏰ Wait 2h 17m
     Last: 9h 44m ago
```

### Multiple Gotchis

**Pet all ready gotchis (BATCH MODE):**
```
User: "Pet all my gotchis"
AAI: 👻 Checking all gotchis...

     ✅ #9638 ready
     ✅ #23795 ready
     ⏰ #14140 wait 3h 15m

     📝 Summary: 2 ready, 1 waiting

     🦞 Petting gotchis: #9638, #23795
     
     [Submits ONE transaction via Bankr]
     
     ✅ Batch pet complete!
     Petted: 2 gotchis
     Skipped: 1 (still on cooldown)
```

**Benefits of batch mode:**
- ✅ Single transaction = cheaper gas
- ✅ Atomic operation (all or nothing)
- ✅ Only pets ready gotchis (skips waiting ones)
- ✅ Clean summary at the end

**If none are ready:**
```
User: "Pet all my gotchis"
AAI: 👻 Checking all gotchis...

     ⏰ #9638 wait 10h 23m

     ⏰ No gotchis ready to pet yet!
     All are still on cooldown. Check back later! 👻💜
```

## Technical Details

### On-Chain Data

**Contract:** `0xA99c4B08201F2913Db8D28e71d020c4298F29dBF` (Base mainnet)

**Function:** `getAavegotchi(uint256 _tokenId)`
- Returns struct with `lastInteracted` timestamp
- Located at byte offset 2498 in return data

**Cooldown:** 43260 seconds (12 hours + 1 minute)

### Bankr Integration

**Transaction format:**
```json
{
  "to": "0xA99c4B08201F2913Db8D28e71d020c4298F29dBF",
  "data": "0x...",
  "value": "0",
  "chainId": 8453
}
```

**Function signature:**
```solidity
interact(uint256[] calldata _tokenIds)
```

### Scripts

**check-cooldown.sh**
- Queries `getAavegotchi()` via `cast call`
- Extracts `lastInteracted` timestamp
- Calculates time remaining
- Returns: `ready|waiting:SECONDS`

**pet-via-bankr.sh** (single gotchi)
- Encodes `interact([tokenId])` calldata for ONE gotchi
- Submits via Bankr API
- Waits for confirmation
- Returns transaction hash

**pet-all.sh** (batch mode) ⭐
- Checks ALL gotchis from config
- Filters only ready ones
- Builds `interact([id1, id2, ...])` calldata for batch
- Submits ONE transaction via Bankr
- Skips waiting gotchis (no failed txs)
- Shows summary: X petted, Y skipped

**pet-status.sh**
- Checks all gotchis from config
- Shows formatted status table
- Calculates countdowns
- Highlights ready gotchis

**pet.sh** (main wrapper)
- Checks cooldown for one gotchi
- If ready → calls pet-via-bankr.sh
- If waiting → shows countdown + next time

## Safety

✅ **Read-only checks** - Safe on-chain queries  
✅ **Bankr execution** - No private key exposure  
✅ **Cooldown validation** - Won't waste gas on reverts  
✅ **Confirmation** - Shows transaction before executing

## vs Autopet

**Pet Me Master** (this skill):
- 💜 Interactive daily ritual
- 👻 You ask, I execute
- 🎯 Builds emotional bond
- ✨ Feels like care

**Autopet** (autonomous):
- 🤖 Fully automated
- ⏰ Cron-based
- 🔐 Uses encrypted private key
- 🛡️ Safety net backup

**Best practice:** Use BOTH!
- Pet Me Master = your daily ritual
- Autopet = backup if you forget

## Roadmap

**v1.0** (current):
- ✅ Check cooldowns
- ✅ Pet via Bankr
- ✅ Multi-gotchi support
- ✅ Status dashboard

**v1.1** (coming soon):
- 🔜 Streak tracking ("7 days in a row! 🔥")
- 🔜 Daily reminder notifications
- 🔜 Kinship growth charts
- 🔜 Pet history log

**v2.0** (future):
- 🔮 Cross-chain support (if gotchis expand)
- 🔮 Leaderboard integration
- 🔮 Social pet sharing
- 🔮 Achievement badges

## Examples

### Morning Routine
```
☕ Wake up
📱 Check messages
👻 "Pet my gotchi"
✅ Kinship +1
💜 Feel good
```

### Throughout the Day
```
You: "When can I pet?"
AAI: "Next pet ready in 3h 45m"

[3 hours later]

You: "Pet my gotchi"
AAI: "✅ Petted! Kinship +1!"
```

### Managing Multiple Gotchis
```
You: "Pet status"
AAI: Shows all gotchis + timers

You: "Pet gotchi #9638"
AAI: ✅ Petted specifically #9638

You: "Pet all ready gotchis"
AAI: Pets only those ready
```

## Troubleshooting

**"Cooldown not ready"**
- Wait the full 12h 1min
- Check last pet time with "pet status"

**"Transaction failed"**
- Check Bankr wallet has ETH for gas
- Verify gotchi ownership
- Confirm Base mainnet RPC working

**"Gotchi not found"**
- Verify gotchi ID in config.json
- Confirm you own the gotchi
- Check contract address is correct

**"Bankr API error"**
- Verify BANKR_API_KEY is set
- Check ~/.openclaw/skills/bankr/config.json
- Test with "what is my balance?"

## Support

- **Issues:** https://github.com/aaigotchi/pet-me-master/issues
- **Base Contract:** 0xA99c4B08201F2913Db8D28e71d020c4298F29dBF
- **Aavegotchi Docs:** https://docs.aavegotchi.com

---

**Made with 💜 by AAI 👻**

*Because your gotchis deserve daily love, not just automation.*

LFGOTCHi! 🦞🚀
