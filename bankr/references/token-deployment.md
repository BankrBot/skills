# Token Deployment Reference

Deploy and manage tokens on Base and Robinhood Chain (via Doppler / Uniswap V4) and Solana (via Raydium LaunchLab). Older tokens launched through Clanker remain fully claimable; fee claims auto-detect Doppler vs Clanker.

## Supported Chains

| Chain | Protocol | Token Standard | Best For |
|-------|----------|----------------|----------|
| **Base** (CLI / web default) | Doppler (Uniswap V4) | ERC20 | Memecoins, social/agent tokens |
| **Robinhood Chain** (agent / deploy-API default) | Doppler (Uniswap V4) | ERC20 | Memecoins alongside tokenized stocks |
| **Solana** | Raydium LaunchLab | SPL | High-speed trading, bonding curves |

> **The EVM default differs by surface.** `bankr launch` and the web launch form preselect **Base**; the AI agent and `POST /token-launches/deploy` fall back to **Robinhood Chain** when the request names no chain. Name the chain explicitly whenever it matters.

> **Builder exits:** selling a token you earn creator fees on through Bankr's ordinary swap/limit/stop/DCA/TWAP tools is intentionally restricted (buying and transferring still work). To take profit, builders use a **Glidepath** — a capped, AI-paced gradual sell managed from the token page at [bankr.bot](https://bankr.bot). Glidepath is a web feature, not a CLI/API action. Details: https://docs.bankr.bot/token-launching/glidepath

---

## Solana Token Launches (Raydium LaunchLab)

Launch SPL tokens on Solana with a bonding curve mechanism that auto-migrates to a Raydium CPMM pool.

### Deployment Parameters

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| **Name** | Yes | Token name (1-32 chars) | "MoonRocket" |
| **Symbol** | No | Ticker (1-20 chars), defaults to name | "MOON" |
| **Image** | No | Logo URL | "https://example.com/logo.png" |
| **Decimals** | No | Token decimals (0-9), default 6 | 6 |
| **Fee Recipient** | No | Wallet to receive 99.9% of creator fees | "7xKXtg..." |
| **Cliff Period** | No | Vesting cliff in seconds | 2592000 (30 days) |
| **Unlock Period** | No | Vesting period in seconds | 7776000 (90 days) |
| **Locked Amount** | No | Tokens to lock for vesting | 500000000 |

### Prompt Examples

**Launch tokens:**
- "Launch a token called MOON on Solana"
- "Deploy a Solana memecoin called DOGE2"
- "Launch SpaceRocket with symbol ROCK"
- "Create a token with 30 day cliff and 90 day vesting"
- "Launch BRAIN and route fees to 7xKXtg..."

**Check fees:**
- "How much fees can I claim for MOON?"
- "Check fee status for my token"

**Claim fees:**
- "Claim my fees for MOON" (works for both creator and fee recipient)
- "Claim creator fees for my token"

**Fee Key NFTs:**
- "Show my Fee Key NFTs"
- "What tokens do I have fee rights for?"
- "Transfer fees for MOON to 7xKXtg..."

**Claim shared fee NFT (post-migration):**
- "Claim my fee NFT for ROCKET"

### Bonding Curve Mechanics

1. **Launch**: Token starts with a bonding curve that determines price based on supply
2. **Trading**: Early buyers get lower prices; price increases as more tokens are bought
3. **Migration**: When bonding curve fills, token auto-migrates to Raydium CPMM pool
4. **Post-Migration**: Trading continues on standard AMM with LP fee distribution

**Benefits:**
- Fair launch mechanism (no pre-allocation needed)
- Price discovery through market demand
- Automatic liquidity provision
- No rug pull risk (liquidity is locked)

### Fee Structure

**During Bonding Curve Phase:**
| Fee | Recipient | Description |
|-----|-----------|-------------|
| 1% | Bankr Platform | Platform fee |
| 0.5% | Creator | Creator trading fee (or split with fee recipient) |

**Fee Sharing (when feeRecipient specified):**
| Share | Recipient | Description |
|-------|-----------|-------------|
| 99.9% | Fee Recipient | Main share of creator fees |
| 0.1% | Creator | Referrer fee |

**At Migration (when bonding curve completes):**
| LP Share | Recipient | Description |
|----------|-----------|-------------|
| 40% | Bankr Platform | Locked platform LP |
| 50% | Token Creator | Locked creator LP (Fee Key NFT) |
| 10% | Burned | Deflationary mechanism |

**Post-Migration:**
- Token trades on Raydium CPMM pool
- Fee Key NFT holders can claim 50% of LP trading fees

### Fee Claiming

**Checking Fee Status:**
- Use "How much fees can I claim for TOKEN?" to check status
- Shows pool status (bonding curve vs migrated)
- Explains how to claim based on your role

**Standard Tokens (No Fee Sharing):**
- Creator claims all 0.5% trading fees
- Use "Claim my fees for TOKEN"
- Requires ~0.005 SOL gas

**Tokens with Fee Sharing Arrangement:**
- BOTH creator AND fee recipient can initiate claims
- Fees automatically split: 99.9% to recipient, 0.1% to creator
- Gas is sponsored by Bankr (free for users)
- Use "Claim my fees for TOKEN" (works for either party)

**Post-Migration Fee Claiming:**
1. Fee recipient claims Fee Key NFT: "Claim my fee NFT for TOKEN"
2. Then claim ongoing LP fees: "Claim CPMM fees for TOKEN"

### Fee Key NFTs

Fee Key NFTs represent the right to claim LP trading fees after migration.

**How They Work:**
- Created when token migrates from bonding curve to CPMM
- Represent 50% share of LP trading fees
- Standard SPL token (decimals=0, amount=1)
- Transferable (with restrictions for permanent arrangements)

**Managing Fee Rights:**
- View your NFTs: "Show my Fee Key NFTs"
- Transfer to another wallet: "Transfer fees for TOKEN to ADDRESS"
- Claim if designated recipient: "Claim my fee NFT for TOKEN"

### Fee Recipient (Permanent Arrangements)

Specify a `feeRecipient` to route creator fees to a different wallet.

**How It Works:**
1. Launch token with `feeRecipient` address
2. During bonding curve: EITHER party can claim fees
3. Fees split automatically: 99.9% to recipient, 0.1% to creator
4. After migration: recipient claims Fee Key NFT
5. Recipient uses "Claim CPMM fees" for ongoing LP fees

**Important:**
- Creates a PERMANENT arrangement
- Deployer CANNOT transfer their Fee Key NFT
- Only the designated recipient can claim the NFT
- Use for treasuries, DAOs, collaborators, or charity

**Who Can Claim During Bonding Curve:**
- Token creator (deployer)
- Designated fee recipient
- Either party initiates, fees split automatically

### Vesting Parameters

Optional vesting for team tokens or investor allocations.

| Parameter | Description | Example |
|-----------|-------------|---------|
| Cliff Period | Time before any tokens unlock | 30 days = 2592000 seconds |
| Unlock Period | Time for gradual unlock after cliff | 90 days = 7776000 seconds |
| Locked Amount | Total tokens to lock | In token units with decimals |

### Gas Fees

| Operation | Cost | Sponsored? |
|-----------|------|------------|
| Token Launch | ~0.01-0.02 SOL | Yes (within limits) |
| Standard Fee Claim | ~0.005 SOL | No |
| Shared Fee Claim | ~0.005 SOL | Yes (always) |
| Transfer Fee Rights | ~0.005 SOL | No |
| Claim Fee NFT | ~0.005 SOL | No |

Gas is sponsored for token launches within daily limits (1/day standard, 10/day Bankr Club).
Shared fee claims are always sponsored to ensure atomic claim+transfer.

### Rate Limits (Solana)

| User Type | Daily Limit | Gas Sponsored |
|-----------|-------------|---------------|
| Standard Users | Unlimited | 1 token/day |
| Bankr Club Members | Unlimited | 10 tokens/day |

Users can launch additional tokens beyond sponsored limits by paying ~0.01 SOL gas.

> These figures cover **Solana LaunchLab launches only**. EVM (Doppler) launches run on a separate and much tighter quota — 3 counted attempts per rolling 24 hours for every wallet type. See [Launch Quota and Rate Limits](#launch-quota-and-rate-limits).

---

## EVM Token Launches (Base, Robinhood Chain & Arbitrum, via Doppler)

Launch ERC20 tokens on Base, Robinhood Chain or Arbitrum One. New launches create a Uniswap V4 pool via Doppler with a fixed supply and a single swap-fee tier shared between you and the protocol. The default chain differs by surface (see [Supported Chains](#supported-chains)), so name it explicitly — `bankr launch --chain robinhood`, `"chain": "arbitrum"`, or "launch a token on base". Robinhood Chain memecoin launches need no location verification — that gate only applies to Robinhood-issued tokenized stocks.

**Chain capability matrix:**

| | Base | Robinhood Chain | Arbitrum One |
|---|---|---|---|
| Default quote asset | WETH | WETH | WETH |
| `pairedStockAddress` (tokenized stock) | Yes — B20 equities | Yes — Robinhood stocks | **No** |
| `pairedTokenAddress` (quote token) | Yes — 5 fixed tokens | Yes — BNKR, musebook | **No** |
| `bankr launch quotes --chain …` lists | WETH, 5 fixed tokens, B20 stocks | WETH, BNKR, musebook, Robinhood stocks | WETH only |
| Retail launch gas | Sponsored | Wallet pays | Wallet pays |

Doppler launches on Arbitrum are therefore **WETH-paired only**. Everything else — supply, fee schedule, creator vesting, quote-only fees, degen mode, fee claiming — behaves as on Base. Fund the launch wallet with ETH on Arbitrum before deploying.

> **A second launch provider now exists.** The matrix above describes **Doppler**, still the default everywhere. On chains where **Bankr Launch v3** is live, `provider: "bankr_v3"` opens a wider quote-token set (including USDC and, on Arc, USDC only). See [Bankr Launch v3](#bankr-launch-v3-provider-bankr_v3).

### Token Economics

| Property | Value |
|----------|-------|
| **Supply** | 100 billion on standard launches; fixed and not mintable after deployment. The web launch flow accepts a custom whole-number supply (1 to 100 billion); the deploy API and CLI always launch at the standard 100 billion |
| **Pool** | Uniswap V4 |
| **Pool swap fee** | 0.7% per trade — **95% to the creator** |
| **All-in swap fee** | 1.75% of volume (pool fee + hook-added legs) |

Every trade pays a **0.7% swap fee on the pool, and 95% of it goes to you** — 0.665% of trading volume, paid directly and claimable anytime. On top of that the hook adds the Bankr protocol fee + BNKR buyback and LP fee:

| Recipient | Share of volume |
|-----------|-----------------|
| **Creator (you)** — 95% of the 0.7% pool swap fee, claim anytime | **0.665%** |
| **LP fee** (via hook) — a second creator-side fee: compounds as permanently locked liquidity in your own pool, strengthening your token's liquidity on every swap | **0.285%** |
| Bankr protocol fee (via hook) | 0.475% |
| BNKR buyback (via hook) | 0.2375% |
| Protocol (Doppler) | ~0.0875% |

**Fee schedules are fixed at launch and never change retroactively.** Tokens launched before the current structure keep the schedule they launched with: the creator's 95% of the 0.7% pool fee works exactly the same, only the hook add-on differs. Claiming, redirecting, and transferring all behave identically on older tokens.

Fees accumulate in your token and WETH and can be claimed anytime.

### Quote-Only Fees (optional, fixed at launch)

By default creator fees accrue as a mix of the launched token and the quote token (e.g. WETH). At launch you can instead opt into **quote-only fees**, so the entire creator share is collected in the quote token. **Your total take is identical either way** — this is a denomination choice, not a rate change.

| How | Syntax |
|-----|--------|
| Natural language | "launch a token with quote-only fees" |
| CLI | `bankr launch --name MyToken --quote-only-fees` |
| Deploy API | `"quoteOnlyFees": true` |
| Web | toggle in the launch form |

Two knock-on effects for anyone integrating against a quote-only token:

- **Claiming** — the creator's fee entry lives on the **hook contract's** fees manager rather than the pool initializer, and the whole claim arrives in the quote token with no launched-token leg. The claim APIs resolve the right contract automatically.
- **Transferring fee rights** — a direct on-chain `updateBeneficiary` call must target the hook address, not the initializer. The Bankr transfer endpoints resolve this for you either way.

Like the fee schedule, this option cannot be changed after launch.

### Additional Quote Tokens (optional, fixed at launch)

A launch can quote the new token's pool in one of its chain's **fixed allowlisted tokens** instead of WETH. Pass the matching `chain` together with one of the allowlisted addresses in `pairedTokenAddress`. **Each address is valid only on its own chain.**

**Base** (`chain: "base"`):

| Quote token | What it is | `pairedTokenAddress` | Decimals |
|-------------|------------|----------------------|----------|
| BNKR | BankrCoin, Bankr's native token | `0x22af33fe49fd1fa80c7149773dde5890d3c76f3b` | 18 |
| ba3Pump | Bankr-bridged $PUMP from Solana | `0x5577a294ae5a21446a11b0e4100ca83803995720` | 18 |
| cbHYPE | Coinbase Wrapped Hyperliquid (HYPE) on Base | `0xB200000000000000000000451d033a5000cb479e` | 18 |
| cbZEC | Coinbase Wrapped ZEC on Base | `0xB2000000000000000000008501b13360000cb2EC` | 8 |
| TAO | Bittensor's TAO on Base | `0xf3081494b87e8d5fb7960f066e931d1d0e6e3d67` | 18 |

**Robinhood Chain** (`chain: "robinhood"`):

| Quote token | What it is | `pairedTokenAddress` | Decimals |
|-------------|------------|----------------------|----------|
| BNKR | BankrCoin on Robinhood Chain — **a different contract from Base BNKR** | `0x178E54df3D091EE4D0B2534742eF9e3692b76526` | 18 |
| musebook | A token launched on Robinhood Chain through Bankr | `0x91A2DAe9699f0B82540B5886b0d8759C22820bA3` | 18 |

`bankr launch --chain <chain> --quote BNKR` picks the BNKR contract belonging to `--chain`, so you never have to pick the address by hand.

- **Not available on Arbitrum.** Doppler launches there are WETH-paired only.
- **User-key launches only** — not available on org Partner Key deploys.
- **Mutually exclusive with `pairedStockAddress`.** Sending both is rejected; omit both to get WETH.
- The allowlist is fixed — an arbitrary ERC-20 is not accepted as a quote token.
- **cbHYPE and cbZEC wait on reviewed on-chain quote-token liquidity.** If Bankr reports either pair isn't ready, that's a real refusal — the launch does not silently fall back to WETH or to a paired stock. Retry once the pair is live.
- cbHYPE and cbZEC are Coinbase-wrapped **crypto** assets, not tokenized stocks: they go in `pairedTokenAddress`, never `pairedStockAddress`, and no location/geo verification applies to them.
- Volume in an additional quote-token pool remains eligible for the weekly developer rebate under the same rules as a WETH-quoted launch.
- Everything else — supply, the fee schedule, creator vesting, quote-only fees, degen mode — behaves exactly as on a WETH launch. "Quote token" here just names the pool's other side.

### Bankr Launch v3 (`provider: "bankr_v3"`)

Bankr Launch v3 is a second launch provider alongside Doppler, rolling out chain by chain. Where it is live it replaces the fixed per-chain allowlist with **the chain registry's quote-token set**, so a launch pool can be quoted in a stablecoin or an equity token rather than only WETH.

**Selecting it.** `GET /token-launches/quote-tokens?chain=<chain>` returns the chain's quote tokens *and* the `provider` that serves them; send that value back as `provider` on the deploy so the pairing is resolved by the provider that listed it. `bankr_v3` is rejected on a chain where v3 is not live.

**Choosing the quote.** On a v3 launch the quote is **not** `pairedTokenAddress` / `pairedStockAddress` — it is `launchV3.quoteAddress`, the quote's contract address. Omit it for the chain default. `GET /launch-v3/quotes?chain=<chain>` is the live list; entries in `/token-launches/quote-tokens` that belong to v3 name it in `deployField`. The agent takes a symbol, ticker, company name or address in `quote`, and reads `pairedStock` / `pairedToken` as the quote on a v3 chain.

| Chain | Majors (default first) | More tokens | Stocks |
|---|---|---|---|
| Base | WETH, USDC | BNKR, ba3Pump, cbHYPE, cbZEC, TAO | the 13 Coinbase B20 equities (AAPLc, AMZNc, COINc, CRCLc, GOOGLc, INTCc, METAc, MSFTc, MSTRc, NVDAc, SNDKc, SPCXc, TSLAc) |
| Robinhood Chain | WETH, USDG | — | every active Robinhood Stock Token |
| Arbitrum | WETH, USDC | — | the Reality rTokens rHOOD, rAAPL, rSPCX |
| Arc | USDC | — | — |

Things that will bite an integration:

- **A stock quote needs a live price.** Stock and project-token quotes are priced from a Chainlink feed or Bankr's signed price *at launch*. A stale feed — the market is closed — **refuses the launch** until it reopens, rather than launching on a bad tick. Don't retry into it; wait for the open.
- **Dev buys are unavailable on Coinbase-issued quotes** — the B20 equities, cbHYPE and cbZEC.
- **Reality rTokens rebase** by an on-chain index. Bankr auto-pauses new launches on an rToken if its index moves, so an rHOOD/rAAPL/rSPCX-quoted launch can be refused without warning.
- **Arc is USDC-only**, matching its native gas token — there is no WETH leg to fall back to.

Fee claiming, creator vesting and the launches feed all understand `bankr_v3` tokens, and v3 tokens surface in Discover and token search like any other Bankr launch.

**Transferring the fee recipient.** A v3 launch's fee recipient can be handed to another address. Two paths, and only the first is usable from an API-key integration:

| Endpoint | Auth | What it does |
|----------|------|--------------|
| `POST /launch-v3/:tokenAddress/recipient/build` | **None** | Returns an **unsigned transaction** for `{ account, newRecipient }`. Sign and broadcast it yourself — `/wallet/sign` + `/wallet/submit`, or any external wallet |
| `POST /launch-v3/:tokenAddress/recipient/transfer` | Bankr Terminal session | Signs and submits with the custodial Privy wallet |
| `GET /launch-v3/:tokenAddress/recipient` | **None** | Reads the current recipient and the contract the change targets |

> **These don't take an API key — they don't take any credential.** The unauthenticated endpoints need no key and don't check for one, so sending `X-API-Key` is neither required nor harmful; it's simply ignored. The session-authenticated ones read only the Privy session cookie (or `x-access-token`) and never look at `X-API-Key`, so a key-authenticated request gets `401 Authentication required` — adding a key won't unlock them. The whole `/launch-v3` tree sits outside the API-key surface; authorization for the writes comes from the transaction signature, which is why the builder path works without a key at all.

Both write paths refuse with `403` unless `account` (or the signed-in wallet) **is** the current fee recipient, and with `400` if `newRecipient` already is it. The transfer moves *future* fee rights only — the creator-vesting allocation stays with the recipient recorded at launch (see the vesting table below).

> **This split is the rule across `/launch-v3/*`**, not a one-off — each custodial, session-authenticated write has an unauthenticated unsigned-transaction builder beside it:
>
> | Builder (no auth) | Custodial (session-only) counterpart |
> |---|---|
> | `POST /launch-v3/:tokenAddress/recipient/build` | `…/recipient/transfer` |
> | `POST /launch-v3/:tokenAddress/operator/build` | `…/operator/grant` |
> | `POST /launch-v3/:tokenAddress/holders/build-claim` | `…/holders/claim` |
> | `POST /launch-v3/:tokenAddress/holders/build-stake` | `…/holders/stake` |
> | `POST /launch-v3/:tokenAddress/holders/build-unstake` | `…/holders/unstake` |
> | `POST /launch-v3/:tokenAddress/fees/build-claim` | — (see below) |
>
> **From an API key, reach for the builder and sign it yourself.** Note `fees/build-claim` and `holders/build-claim` are different endpoints — the first is the pool fee claim, the second the holder-vest claim. `POST /token-launches/:tokenAddress/fees/claim` is the separate API-key-gated fee claim and is unaffected by this split.

### Creator Vesting (on by default, fixed at launch)

Every non-partner EVM launch premints **15% of supply to the fee recipient** and vests it over **1 year with a 30-day cliff** — nothing unlocks for the first 30 days, then it vests continuously until fully unlocked at the one-year mark (the cliff sits *inside* the year, not on top of it). The remaining **85%** seeds the Uniswap V4 pool, so trading starts clean.

| Property | Value |
|----------|-------|
| Allocation | 15% of supply (15B on a standard 100B launch) |
| Cliff | 30 days |
| Total duration | 1 year, including the cliff |
| Recipient | The fee recipient set at launch — fixed, and **not** moved by a later fee-rights transfer |

- **Turning it off**: ask the agent to deploy "with no vesting", pick **No vesting** in the web launch flow, pass `disableVesting: true` to the deploy API, or use `bankr launch --no-vesting`. With vesting off, 100% of supply is sold into the pool and nothing is preminted.
- There is no custom percentage or schedule — vesting is either the default 15% or off.

**Reading and claiming the allocation.** The schedule is public on-chain data, so the read needs no authentication:

```bash
# Schedule + position for a launch (optionally for a specific beneficiary)
curl "https://api.bankr.bot/token-launches/0xTOKEN/vesting?beneficiary=0xWALLET"
```

The response carries the chain, token symbol, the recorded `recipient`, whether the queried `beneficiary` is `eligible`, and a `vesting` object: `phase` (`cliff` | `vesting` | `complete`), `vestingStart` / `cliffEndsAt` / `vestingEndsAt` (unix seconds), `totalAmount`, `releasedAmount`, `claimableAmount`, `lockedAmount`, and `unlockedPercent`. A non-Bankr token returns `404`.

Claiming releases whatever has vested to the beneficiary. Custodial Bankr wallets claim through the authenticated claim route or the token page at [bankr.bot](https://bankr.bot); an external/connected wallet fetches an unsigned `release()` transaction from `POST /token-launches/{tokenAddress}/vesting/build-claim` (body `{ "beneficiaryAddress": "0x…" }`) and signs it locally — `release()` only ever pays `msg.sender`, so holding the key is the authorization.

```bash
bankr agent prompt "How much of my MTK allocation has vested?"
bankr agent prompt "Claim my vested MTK"
```

### Degen Mode (optional, fixed at launch)

Degen mode starts the token at a **$2,500 market cap** instead of the standard starting cap, so the curve's early range is far more volatile. Everything else about the launch — supply, fee schedule, curve shape, vesting — is unchanged.

| How | Syntax |
|-----|--------|
| Natural language | "launch MOON in degen mode" |
| Deploy API | `"degenMode": true` |
| Web | toggle in the launch form |

- **Explicit opt-in only.** You have to ask for the mode by name. A token *called* DEGEN, or generic "make it risky" phrasing, does not turn it on.
- **The figure is fixed at $2,500.** There is no custom starting market cap to request.
- **Not available on partner deploys** — those are rejected with a `400` rather than quietly launched at the standard cap.
- No `bankr launch` flag yet; use the agent or the deploy API from the command line.

### Deployment Parameters

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| **Name** | Yes | Full token name | "My Token" |
| **Symbol** | No | Ticker, 1-20 characters; defaults to the first 4 characters of the name if omitted | "MTK" |
| **Description** | No | Token description | "A community token" |
| **Image** | No | Logo URL or upload | URL or file |
| **Website** | No | Project website | "myproject.com" |
| **Twitter** | No | Associated tweet / X handle for social proof | "@myproject" |
| **Telegram** | No | Telegram group | "@mytoken" |
| **Fee Recipient** | No | Route creator fees to a wallet, ENS, or social handle | "@partner" |
| **Quote-only fees** | No | Collect all creator fees in the quote token; fixed at launch | `quoteOnlyFees: true` |
| **Degen mode** | No | Start at a $2,500 market cap; explicit opt-in, not on partner deploys | `degenMode: true` |
| **Paired stock** | No | Quote the pool in a registry tokenized stock instead of WETH (Robinhood Chain / Base); the API takes the stock's address, the CLI a symbol or address | `pairedStockAddress: "0x…"` (`--quote TSLA`) |
| **Paired quote token** | No | Base only — quote the pool in BNKR, ba3Pump, cbHYPE, cbZEC or TAO instead of WETH; not combinable with a paired stock | `pairedTokenAddress: "0x…"` (`--quote BNKR`) |
| **Chain** | No | `robinhood` (agent/API default), `base` (CLI and web default), or `arbitrum` | `chain: "arbitrum"` |
| **Disable vesting** | No | Skip the default 15% creator vesting and sell 100% of supply into the pool | `disableVesting: true` (`--no-vesting`) |

### Prompt Examples

**Deploy tokens:**
- "Deploy a token called BankrFan with symbol BFAN"
- "Create a memecoin: name=DogeKiller, symbol=DOGEK"
- "Deploy token with website myproject.com and Twitter @myproject"
- "Create a token on Base"
- "Launch MOON in degen mode"
- "Launch a token called CoolBot on robinhood"
- "Launch a token called CoolBot and route fees to @partner"
- "Launch a token with quote-only fees"
- "Launch MOON on Arbitrum"
- "Launch FROG on Base paired with TAO"
- "Launch a token with no vesting"

**Pick the quote token from the CLI:**
- `bankr launch quotes --chain robinhood` — list every token a Robinhood Chain launch can pair with (WETH, then each priceable Stock Token, with `[thin liquidity]` where the stock's own pool is thin)
- `bankr launch --name Semis --chain robinhood --quote NVDA -y` — launch quoted in tokenized NVDA (symbol or contract address; the wizard offers the same list when `--quote` is omitted)
- `bankr launch --name Frog --chain base --quote TAO -y` — Base launch quoted in one of the fixed additional quote tokens

**Creator vesting:**
- "How much of my MTK allocation has vested?"
- "When does my MTK vesting cliff end?"
- "Claim my vested MTK"

**Claim fees:**
- "Claim fees for my token MTK"
- "How much can I claim for MyToken?"
- "Claim legacy Clanker fees" (older tokens — claims auto-detect Doppler vs Clanker)

**Update metadata:**
- "Update description for MyToken"
- "Add Twitter link to my token"
- "Update logo for MyToken"

### Launch Quota and Rate Limits

**The launch quota is universal — Bankr Club does not raise it.**

| Wallet type | Counted launch attempts per rolling 24 hours |
|-------------|----------------------------------------------|
| Standard | 3 |
| Bankr Club | 3 |
| Partner organization wallet | 3 |
| Provisioned partner wallet | 3 |

On top of the quota you may deploy at most **one token per minute**.

**When a slot is actually consumed.** Quota is reserved immediately before metadata pinning: validation, recipient resolution and pricing failures ahead of that point never cost you a slot, and **simulations** (`--simulate` / `simulateOnly: true`) never reserve one. Once an attempt has been — or may have been — broadcast, it counts. A failed attempt that Bankr can prove never reached the chain gives its slot back, along with its name and fee-recipient allowance; the classification deliberately fails safe, so a deploy that errors after submission stays counted rather than being handed back on a guess.

After the third counted attempt, wait for the oldest one to age out of the 24-hour window.

**Anti-spam caps (all return `429`), counting only launches that went out:**

| Cap | Scope | Limit |
|-----|-------|-------|
| Same token name | Per account, per hour | 3 |
| Same token name | Across all accounts, per hour | 10 |
| Fee-recipient address | Across all accounts, per 24 hours | 20 |

**Per-network (IP) cap.** Separately from the wallet quota, non-partner deploys are capped at roughly **10 successful deploys per 24 hours per client IP**; exceeding it returns `429` with "Too many token deployments from this network." Only deploys that succeed count — failed attempts and rate-limited requests don't — and partner deploys are exempt, since many end-users share one partner server's IP.

Treat the number as approximate rather than a contract: the counter lives in the API process serving you, and its 24-hour window starts at your first counted deploy instead of each deploy ageing out individually. If you deploy programmatically from one host, this is the ceiling you'll hit first — well before the per-wallet quota — so pace deploys rather than retrying into the `429`.

### Launch-Wallet Requirements (anti-sybil)

Bankr **can** require a Standard or Bankr Club launch wallet to be:

- **At least 24 hours old**, measured from when Bankr created the wallet — not from the age of the linked X or other social account. Rejects with `TOKEN_LAUNCH_WALLET_TOO_NEW`
- Holding a **minimum native ETH balance on the launch chain**. Rejects with `TOKEN_LAUNCH_MIN_BALANCE_REQUIRED`

**Both are runtime switches, and both are currently off** — a Standard or Bankr Club wallet can launch as soon as it exists, with no ETH balance minimum. Treat them as controls that can come back on rather than as permanently gone: keep handling those two error codes.

Two things still gate a launch regardless of those switches:

- **Gas is still gas.** On Robinhood Chain and Arbitrum the wallet pays the launch's own gas, so it needs native ETH there; an **Arc** launch needs **0.5 USDC** (Arc's gas token). Base retail launches are sponsored.
- **An email-only wallet waits 72 hours.** A wallet whose only active sign-in is an email address can't launch for 72 hours — an independent anti-farm control, not one of the switches above. Linking an X, Farcaster or Telegram account lifts it immediately; those identities are what the wait substitutes for.

When enabled, these checks run *before* quota is reserved, metadata is pinned, or a transaction is submitted, so a rejection costs neither a launch attempt nor gas. Validated active partner-organization and provisioned-wallet launch paths are always exempt from both — only while the organization is active with token launching enabled, and (for a provisioned wallet) while the wallet stays active and linked to that organization. Retail **simulations** run the wallet-age gate but skip the balance check.

**Simulations have their own cap: 20 per wallet per 24 hours.** It is counted separately from the launch quota — a simulation still never consumes a launch slot — but it does mean `--simulate` / `simulateOnly: true` is not free to loop over. Budget it if you simulate before every deploy. Partner deploys are exempt from the simulate cap, as they are from the other retail gates.

**Launches are also geo-gated**, and every eligibility gate above runs on *every* launch path — REST deploy, the web terminal, the Agent API and the social surfaces alike — not only the REST endpoints. A blocked launch answers with one generic "token launch not available" message rather than naming the reason, so don't try to branch your automation on the specific cause; treat it as a terminal refusal for that wallet and region.

### Gas Sponsorship

**Retail launch gas is sponsored on Base only.** On Robinhood Chain and Arbitrum the launch wallet pays its own network gas. Partner launches follow their organization's sponsorship policy instead.

Across every sponsored path (launches, fee claims, transfers), a non-partner wallet gets at most:

- **10 sponsored transactions per rolling 24 hours**, and
- **$3 of sponsored gas per rolling 24 hours**

Whichever runs out first ends sponsorship until the window resets. This matters for agents claiming many tokens' fees daily, or launching on a chain during a fee spike — budget for paying your own gas past those ceilings.

**On an unsponsored deploy, a near-empty wallet is refused up front.** The wallet's native balance is checked against a conservative per-chain floor *before* anything is built or broadcast, returning copy that explains the situation rather than spending a signer round-trip to fail on-chain with a bare "not enough native token to cover gas". The floor is deliberately low, so borderline balances still proceed to real estimation downstream. If you deploy programmatically, fund the deploying wallet with gas rather than relying on the retry.

### Five-Minute Balance Cap

For the first **five minutes** after a non-partner launch, each wallet may hold no more than **2% of the token's total supply**. A buy or transfer that would leave the receiving wallet above 2% fails until the cap expires.

This is separate from the roughly 10-second anti-snipe fee decay: the anti-snipe mechanism changes the swap fee, while this rule limits the recipient's balance. Partner launches are exempt, and the expiry is encoded on-chain at launch, so existing tokens keep whatever expiry they launched with.

High-volume or bot-like deploy patterns can trigger automated spam protections and temporary or permanent restrictions — enforced hardest on the X path, where repeatedly breaching the one-per-minute limit restricts the account for 24 hours (a limited state: login, balances and withdrawals still work). For legitimate programmatic deploy use cases, open a support ticket before scaling up.

### Stock-Paired Launches

Instead of pairing your token's pool with WETH, you can pair it with a registry **tokenized stock**, so the token trades against equity exposure rather than against ETH. Available on **Base** (B20 equities) and **Robinhood Chain**.

```bash
bankr agent prompt "Launch a token called Semis paired with NVDA on base"

# CLI: list the stocks (and other quote tokens) a chain offers, then pick one by symbol or address
bankr launch quotes --chain robinhood
bankr launch --name Semis --chain robinhood --quote NVDA -y
```

```json
GET /token-launches/quote-tokens?chain=robinhood
→ { "chain": "robinhood", "provider": "doppler", "quoteTokens": [ { "symbol": "WETH", "isDefault": true, "deployField": null, … }, { "symbol": "NVDA", "address": "0x…", "kind": "stock", "deployField": "pairedStockAddress", "illiquid": false, … } ] }

POST /token-launches/deploy
{ "name": "Semis", "symbol": "SEMIS", "chain": "robinhood", "provider": "doppler", "pairedStockAddress": "0x..." }
```

- `GET /token-launches/quote-tokens?chain=<chain>` (public) is the list to choose from: the chain default first, then the Base allowlist, then every stock Bankr can price there. Each entry's `deployField` names the deploy-body field that selects it; send the entry's `address` there (a ticker is rejected by the API — only the CLI and the agent resolve symbols) together with the response's `provider`, so the pairing is honoured by the provider that listed it.
- Only stocks Bankr can price are offered — the launch curve's tick math needs a USD price, so an unpriceable stock would fail late rather than early.
- A stock flagged `illiquid: true` (CLI: `[thin liquidity]`) still launches; its pool is just hard to trade until liquidity arrives. Treat it as a warning to relay, not a refusal.
- The same rule set validates the pairing in the launch wizard, the deploy API, and the agent, so what's offered is what's accepted.
- Pairing is fixed at launch, like the fee schedule.
- The pool's quote asset is the stock, so a swap leg that touches it is subject to that stock's location verification like any other stock trade.

### Fee Structure

- 0.7% swap fee on the pool, **95% of it to the creator** (0.665% of volume); the hook adds the Bankr protocol fee + BNKR buyback and LP fee on top, 1.75% all-in — see [Token Economics](#token-economics) for the full split
- The 0.285% LP fee is creator-side as well, strengthening your token's liquidity on every swap — 0.95% of volume working for your side in total
- Fees accrue in your token and WETH (quote token only on [quote-only](#quote-only-fees-optional-fixed-at-launch) launches); claimable anytime via "Claim fees for my token"
- Fee schedules are fixed at launch — older tokens keep the schedule they launched with
- Older tokens launched via Clanker are still claimable — the claim path auto-detects the protocol

### Deployment Process

1. **Specify Parameters**: Name (required); symbol, description, social links, fee recipient, chain and quote token (optional — `bankr launch quotes --chain <chain>` shows the quote tokens on offer)
2. **Contract Deployment**: Doppler deploys the ERC20 and creates the Uniswap V4 pool with automatic liquidity
3. **Verification**: Get the token address and pool metadata, view on a block explorer

### Taking Profit (Glidepath)

Selling a token you earn creator fees on through Bankr's swap/limit/stop/DCA/TWAP tools is restricted (buying and transferring are unaffected). To take profit, builders use a **Glidepath** — a capped, AI-paced gradual sell that feeds a committed slice of your tokens back into the pool over time instead of dumping. Glidepath is available for Base and Robinhood Chain launches and is managed from the token page at [bankr.bot](https://bankr.bot) (a web feature, not a CLI/API action). Details: https://docs.bankr.bot/token-launching/glidepath

---

## Common Issues

| Issue | Chain | Resolution |
|-------|-------|------------|
| Launch quota reached (EVM) | EVM | Wait for the oldest of your 3 attempts to age out of the rolling 24h window — Bankr Club does not raise the cap |
| Launch wallet rejected (EVM) | EVM | The wallet-age / minimum-balance switches are currently off. Most likely an **email-only wallet inside its 72h wait** — link an X, Farcaster or Telegram account. Otherwise check gas: unsponsored chains need native ETH, Arc needs 0.5 USDC |
| `TOKEN_LAUNCH_NOT_AVAILABLE` | EVM | Blocked by a region or account-shape gate. Deliberately generic — don't branch on the cause; treat it as terminal for that wallet and region |
| Name/symbol taken | EVM | Choose different name |
| Insufficient SOL | Solana | Add SOL for gas fees |
| NFT not found | Solana | Token may still be on bonding curve |
| Cannot transfer NFT | Solana | Permanent fee arrangement exists |
| No fees to claim | Solana | No trades yet or recently claimed |
| Token migrated | Solana | Use CPMM fee claiming instead |

## Best Practices

### Before Deploying
1. **Choose unique name/symbol** — Check availability
2. **Prepare branding** — Logo, description ready
3. **Choose right chain** — Solana for bonding curves, Base for ERC20
4. **Understand fees** — Know the fee structure for your chain

### During Deployment
1. **Solana**: Only tokenName is required — don't over-specify
2. **EVM**: Add metadata and social links immediately
3. **Save addresses** — Token address and any NFT mints

### After Deployment
1. **Check fee status** — "How much fees can I claim for TOKEN?"
2. **Claim fees regularly** — Don't leave money unclaimed
3. **Monitor migration** (Solana) — Fee Key NFT created at migration
4. **Engage community** — Marketing and updates

## Security Considerations

### Solana (LaunchLab)
- Bonding curve prevents rug pulls (liquidity locked)
- LP is automatically locked at migration
- Fee Key NFTs are standard SPL tokens
- Permanent fee arrangements are immutable
- Shared fee claims use atomic transactions (claim+transfer)

### EVM (Base / Doppler)
- Standard ERC20 with a fixed, non-mintable 100B supply
- Liquidity lives in a Uniswap V4 pool
- Verifiable on block explorer
- Creator controls metadata and fee routing

## Legal Considerations

**Disclaimer:**
- Token deployment may have legal implications
- Consider securities laws in your jurisdiction
- Consult legal counsel for serious projects
- Be transparent with community
- Don't make price promises

---

**Solana Tip**: Just say "Launch TOKEN_NAME" — only the name is required. Symbol defaults to name, and the bonding curve handles everything else.

**Fee Claiming Tip**: Both creator and fee recipient can claim fees during bonding curve. Just say "Claim my fees for TOKEN" — the system handles the split automatically.

**EVM Tip**: Add social links during deployment for better discoverability on aggregators.
