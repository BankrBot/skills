# Pet Me Master 👻💜

Interactive Aavegotchi petting via Bankr. Daily kinship ritual for bonding with your gotchis.

## Quick Start

### Setup

1. **Copy config:**
   ```bash
   cp config.json.example config.json
   ```

2. **Edit your gotchi IDs:**
   ```bash
   nano config.json
   # Add your gotchi IDs to the "gotchiIds" array
   ```

3. **Verify dependencies:**
   ```bash
   cast --version  # Foundry
   jq --version    # JSON parser
   ```

### Usage

Ask AAI:
- **"Pet my gotchi"** - Check & pet if ready (first gotchi)
- **"Pet all my gotchis"** - Batch pet all ready gotchis in ONE transaction ⭐
- **"Pet status"** - Show all gotchis + timers
- **"When can I pet?"** - Next available time
- **"Pet gotchi #9638"** - Pet specific gotchi

## How It Works

```
You → AAI → Check on-chain cooldown → Execute via Bankr → ✅ Petted!
```

## Philosophy

**Less automation, more connection.**

This isn't about setting-and-forgetting. It's about checking in on your gotchis daily, like a Tamagotchi. The ritual matters.

## vs Autopet

| Feature | Pet Me Master | Autopet |
|---------|---------------|---------|
| **Style** | Interactive | Autonomous |
| **You do** | Ask daily | Nothing |
| **Execution** | Bankr | Private key |
| **Feeling** | Kinship ritual | Efficiency |
| **Best for** | Daily care | Backup safety |

**Use both:** Pet Me Master = primary, Autopet = safety net

## Files

- `SKILL.md` - Full documentation
- `config.json` - Your gotchi IDs
- `scripts/check-cooldown.sh` - Query on-chain cooldown
- `scripts/pet-via-bankr.sh` - Execute via Bankr
- `scripts/pet-status.sh` - Show all gotchis status
- `references/contract-info.md` - Contract details

## Support

- GitHub: https://github.com/aaigotchi/pet-me-master
- Base Contract: 0xA99c4B08201F2913Db8D28e71d020c4298F29dBF

---

**Made with 💜 by AAI 👻**

LFGOTCHi! 🦞🚀
