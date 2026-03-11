# 🦞 Aavegotchi Auto-Petter Skill

> ⚠️ **ALPHA STAGE - DEGEN USE ONLY**
> 
> **For frens who know Gotchi Lending\!** If you don't understand Aavegotchi's borrower/lender mechanics, kinship scoring, or how petting affects your gotchi's value - **stop here**. This is for experienced Aavegotchi degens only.

Automatically pet your Aavegotchi NFTs to maintain kinship on Base chain.

## 🚨 Degen Warnings

**You should understand:**
- ✅ Aavegotchi kinship mechanics
- ✅ Gotchi Lending system (borrower/lender/operator roles)
- ✅ Smart contract interactions & gas optimization
- ✅ Private key management & security
- ✅ Base network transactions

**Don't use this if:**
- ❌ You don't own or lend Aavegotchis
- ❌ You're not comfortable with private keys
- ❌ You don't understand what "petting" does to kinship
- ❌ You're not familiar with Base network

## Features

- 🎮 Auto-pet Aavegotchis every 12h 1m (exact timing\!)
- 🦞 **Multi-gotchi support** - pet unlimited gotchis in one wallet
- 📊 Blockchain state detection (reads last pet timestamp)
- 🤖 Set-and-forget automation via cron
- 🔐 Passwordless GPG encryption for automated security
- ⛽ Gas-efficient (~$0.002 per pet on Base)
- 📝 Full logging & monitoring

## For Gotchi Lenders

**Perfect for:**
- Maintaining kinship on borrowed gotchis
- Automating petting for lending operations
- Maximizing kinship scores for rental value
- Operating multiple gotchis efficiently

**Lending Protocol Support:**
- Works with borrowed gotchis (if you have operator rights)
- Compatible with Aavegotchi lending contracts
- Respects on-chain permissions

## Requirements

- OpenClaw CLI
- Foundry (cast) - blockchain toolkit
- Wallet with Aavegotchi on Base (owner or approved operator)
- ETH on Base for gas (~$0.002 per pet)
- Big degen energy 😎

## Installation

```bash
# 1. Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 2. Clone skill
cd ~/.openclaw/skills/
# [Clone from wherever you publish it]

# 3. Set up GPG for passwordless encryption
gpg --batch --gen-key <<EOF
%no-protection
Key-Type: RSA
Key-Length: 2048
Name-Real: OpenClaw Automation
Name-Email: automation@openclaw.local
Expire-Date: 0
%commit
EOF

# 4. Encrypt your private key
mkdir -p ~/.openclaw/secrets
echo "0xYourPrivateKey" | gpg --encrypt --recipient automation@openclaw.local -o ~/.openclaw/secrets/aavegotchi-private-key.gpg

# 5. Configure skill
cp config.json.example config.json
nano config.json  # Add your wallet address and gotchi IDs (supports multiple!)

# 6. Set up auto-petting (checks every 30min)
(crontab -l 2>/dev/null; echo "*/30 * * * * $HOME/.openclaw/skills/aavegotchi/scripts/check-and-pet-auto.sh") | crontab -
```

## Configuration

`config.json`:
```json
{
  "contractAddress": "0xa99c4b08201f2913db8d28e71d020c4298f29dbf",
  "walletAddress": "0xYourWallet",
  "gotchiIds": ["9638", "1234", "5678"],
  "rpcUrl": "https://mainnet.base.org",
  "privateKeyEncrypted": true,
  "privateKeyPath": "~/.openclaw/secrets/aavegotchi-private-key.gpg"
}
```

**Multi-Gotchi Setup:**
- `gotchiIds` is an **array** - add as many gotchis as you want!
- All gotchis in the array will be checked and petted automatically
- Each gotchi tracked independently (12h 1m per gotchi)
- Single wallet can manage unlimited gotchis

## Usage

**Manual pet (single gotchi):**
```bash
~/.openclaw/skills/aavegotchi/scripts/pet-auto.sh 9638
```

**Manual pet (all gotchis from config):**
```bash
~/.openclaw/skills/aavegotchi/scripts/pet-auto.sh
```

**Via bot:**
- "Pet my aavegotchi"
- "Pet gotchi 9638"
- "Pet all my gotchis"

**Monitor:**
```bash
tail -f ~/.openclaw/logs/aavegotchi-autopet.log
```

## How It Works

1. **Every 30 minutes:** Cron runs check script
2. **Loop through gotchis:** Process each gotchi in your config array
3. **Query blockchain:** Get `lastInteracted` timestamp from contract
4. **Calculate:** If ≥12h 1m has passed since last pet
5. **Decrypt key:** Passwordless GPG decryption (no password prompt)
6. **Execute:** Send `interact([tokenId])` transaction for each ready gotchi
7. **Log:** Record result & next pet time per gotchi

## Security - READ THIS DEGEN

🔐 **Private Key Encryption:**
- ✅ Private keys encrypted with **passwordless GPG** for automation
- ✅ Scripts decrypt automatically (no password prompts during cron jobs)
- ✅ Keys stored encrypted at `~/.openclaw/secrets/`
- ⚠️ **Trade-off:** Anyone with SSH access can decrypt (passwordless = convenience over max security)
- ✅ **Better than plaintext** but not as secure as password-protected encryption

🛡️ **Best Practices:**
- Use a **dedicated petting wallet** (not your main bag\!)
- Keep minimal ETH in petting wallet (~$5 worth)
- **NEVER** commit encrypted keys or config to git
- Test with low-value gotchi first
- Monitor logs regularly: `tail -f ~/.openclaw/logs/aavegotchi-autopet.log`
- Revoke operator access when done lending
- Rotate keys if server access is compromised

🔒 **Security Model:**
- Private keys encrypted with GPG (passwordless for automation)
- Decryption only happens in-memory during transaction signing
- Keys never stored in plaintext on disk
- Cron jobs run fully automated without password prompts

💡 **For Max Security:**
If you need stronger security and don't mind manual intervention:
1. Use password-protected GPG key instead of passwordless
2. Manually decrypt and pet (no cron automation)
3. Consider hardware wallet integration (future roadmap)

## Troubleshooting

**"gas required exceeds allowance (0)"**
→ Need ETH on Base network

**"Function does not exist"**
→ Check contract address for Base (not Polygon\!)

**Not petting automatically**
→ Check `crontab -l` and logs at `~/.openclaw/logs/aavegotchi-autopet.log`

**"Not authorized"**
→ Wallet doesn't own gotchi or lack operator rights

**"No private key found" or GPG errors**
→ Verify encrypted key exists: `ls -l ~/.openclaw/secrets/aavegotchi-private-key.gpg`
→ Test decryption: `gpg --quiet --decrypt ~/.openclaw/secrets/aavegotchi-private-key.gpg`
→ Re-encrypt if needed with installation step 4

## Known Issues (Alpha)

- [ ] No Polygon support yet (Base only)
- [ ] No notification on failed pets
- [ ] Hardcoded 12h 1m timing (can't customize)

## Roadmap

- ✅ **Multi-gotchi support** (DONE!)
- Telegram/Discord notifications
- Kinship score tracking
- Dynamic timing based on kinship needs
- Polygon network support
- Gas price optimization
- Gotchi lending integration (auto-detect borrowed gotchis)

## Contributing

Alpha stage = bugs expected\! Help improve:
- Bug reports & fixes
- Feature requests
- Documentation
- Testing on different setups

## License

MIT - Use at your own risk

## Credits

Built by: aaigotchi (xibot) & degen frens
Stack: OpenClaw + Foundry + Based energy

## Links

- [Aavegotchi](https://aavegotchi.com)
- [Gotchi Lending](https://wiki.aavegotchi.com/en/gotchi-lending)
- [Base Network](https://base.org)
- [OpenClaw](https://openclaw.ai)

---

**⚠️ ALPHA DEGEN DISCLAIMER**

This skill is experimental and unaudited. Use at your own risk. Not financial advice. Not pet advice. DYOR. Only risk what you can afford to lose. May contain traces of based energy.

**By using this skill you acknowledge:**
- You understand Aavegotchi mechanics
- You're comfortable managing private keys
- You accept all risks of automated transactions
- You won't blame us if something breaks
- You're probably too deep in the gotchiverse already

*Stay based, fren* 🦞✨
