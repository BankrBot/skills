# Token Deployment Reference

Deploy and manage ERC20 tokens using Clanker.

## Supported Chains

- **Base**: Primary deployment chain, full Clanker support
- **Unichain**: Secondary option

## Deployment Parameters

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| **Name** | Yes | Full token name | "My Token" |
| **Symbol** | Yes | Ticker, 3-5 chars | "MTK" |
| **Description** | No | Token description | "A community token" |
| **Image** | No | Logo URL or upload | URL or file |
| **Website** | No | Project website | "myproject.com" |
| **Twitter** | No | Twitter/X handle | "@myproject" |
| **Telegram** | No | Telegram group | "@mytoken" |

## Prompt Examples

**Deploy tokens:**
- "Deploy a token called BankrFan with symbol BFAN"
- "Create a memecoin: name=DogeKiller, symbol=DOGEK"
- "Deploy token with website myproject.com and Twitter @myproject"
- "Create a token on Base"
- "Launch new token on Unichain"

**Claim fees:**
- "Claim fees for my token MTK"
- "Check my Clanker fees"
- "Claim legacy Clanker fees"

**Update metadata:**
- "Update description for MyToken"
- "Add Twitter link to my token"
- "Update logo for MyToken"

## Rate Limits

| User Type | Daily Limit |
|-----------|-------------|
| Standard Users | 1 token/day |
| Bankr Club Members | 10 tokens/day |

## Fee Structure

- Small fee on each trade, accumulated for token creator
- Claimable anytime via "Claim fees for my token"
- Legacy fees (older Clanker versions) claimed separately

## Chain Selection

### Base (Recommended)
- Primary Clanker support
- Low deployment cost
- Growing ecosystem
- Easy liquidity provision
- Fast transactions

### Unichain
- Secondary option
- Low cost
- Newer ecosystem
- Less liquidity

## Deployment Process

### 1. Parameter Specification
Define token details:
- Name and symbol (required)
- Description and social links (optional)
- Logo image (optional)

### 2. Contract Deployment
Clanker deploys the ERC20 contract:
- Standard implementation
- Secure and audited
- Compatible with DEXes
- Automatic liquidity

### 3. Verification
Contract is deployed:
- Get contract address
- View on block explorer
- Confirm ownership

## Post-Deployment

### Fee Management
- Creator fees accumulate on trades
- Claim regularly via Bankr
- Check fee balance anytime

### Marketing
- Announce on Twitter/X
- Create Telegram group
- Post on Reddit
- List on token aggregators

### Listings
- Appears automatically on DEX aggregators
- Submit to CoinGecko/CMC
- Add to DexTools/DexScreener

## Common Issues

| Issue | Resolution |
|-------|------------|
| Rate limit reached | Wait 24 hours or upgrade to Bankr Club |
| Name taken | Choose different name |
| Symbol exists | Use unique symbol |
| Image upload failed | Check format/size |

## Best Practices

### Before Deploying
1. **Choose unique name/symbol** — Ensure not taken
2. **Prepare branding** — Logo, description, social links
3. **Choose right chain** — Base (recommended) or Unichain
4. **Have a plan** — Marketing and utility

### During Deployment
1. **Add metadata** — Description and social links immediately
2. **Upload quality logo** — First impressions matter
3. **Save contract address** — Need it for everything
4. **Test trading** — Buy small amount to confirm

### After Deployment
1. **Announce immediately** — Build momentum
2. **Create socials** — Twitter, Telegram, etc.
3. **Submit to aggregators** — Visibility
4. **Engage community** — Regular updates
5. **Claim fees regularly** — Don't leave money on table

## Security Considerations

### Smart Contract
- Uses audited Clanker contracts
- Standard ERC20 implementation
- No hidden functions
- Verifiable on block explorer

### Ownership
- You control the contract
- Can update metadata
- Fee claiming tied to creator

## Legal Considerations

⚠️ **Disclaimer**
- Token deployment may have legal implications
- Consider securities laws in your jurisdiction
- Consult legal counsel for serious projects
- Be transparent with community
- Don't make price promises

---

**Remember**: Creating a token is easy. Creating a successful token requires work, community, and utility. Don't expect overnight success.
