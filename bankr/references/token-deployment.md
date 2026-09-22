# Token Deployment Reference

Launch ERC-20 tokens on **Base**, **Robinhood Chain** and **Arbitrum One** (Doppler, a Uniswap V4 pool) or on **Arc** (Bankr Launch v3). **Solana token launches are not supported.** Older Clanker tokens stay claimable — fee claims auto-detect Doppler, Clanker and Launch v3.

The deploy, quote-token and fee endpoints are in the [OpenAPI spec](https://docs.bankr.bot/openapi/api.yaml); the narrative guide is the [token launching overview](https://docs.bankr.bot/token-launching/overview).

## Chains and providers

| Chain | Provider | Default quote | Other quotes | Retail launch gas |
|---|---|---|---|---|
| Base | Doppler | WETH | BNKR, ba3Pump, cbHYPE, cbZEC, TAO; Coinbase B20 stocks | Sponsored |
| Robinhood Chain | Doppler | WETH | BNKR, musebook; Robinhood stocks | Wallet pays (ETH) |
| Arbitrum One | Doppler | WETH | — | Wallet pays (ETH) |
| Arc | Launch v3 only | USDC | — | Wallet pays (USDC; hold at least 0.5 USDC) |

- **The default chain differs by surface.** `bankr launch` and the web launch form preselect **Base**; the agent and `POST /token-launches/deploy` fall back to **Robinhood Chain**. Name the chain whenever it matters.
- `bankr launch --chain` takes `base`, `robinhood` or `arbitrum`. Launch on Arc through the agent ("launch X on arc"), the web form or the deploy API (`"chain": "arc"`).
- Launching needs no tokenized-stock location verification — not for a Robinhood Chain memecoin, not for a stock-paired pool; only trading the stock itself does. Launches have their own region gate (see [Limits](#limits-and-eligibility)).

## Launching

```bash
bankr agent prompt "Launch a token called MOON on base"
bankr launch                                   # interactive wizard
bankr launch --name MOON --chain base -y       # headless
bankr launch --name MOON --simulate            # dry run: predicted address and fee split, nothing broadcast
```

| Field (API / CLI) | Notes |
|---|---|
| `tokenName` / `--name` | Required |
| `tokenSymbol` / `--symbol` | 1–20 characters; defaults to the first 4 characters of the name, uppercased |
| `image` / `--image` | A direct raster image URL. An SVG or a web page (e.g. an x.com post link) is not pinned — the token launches without a logo |
| `tweetUrl` / `--tweet`, `websiteUrl` / `--website`, `description` | Optional metadata; the tweet URL must be on x.com or twitter.com |
| `feeRecipient` / `--fee` + `--fee-type` | `{ "type": "wallet" \| "x" \| "farcaster" \| "ens", "value": "…" }`; the CLI's type defaults to `x`. An X or Farcaster username resolves to that account's Bankr wallet, created if the account has none |
| `simulateOnly` / `--simulate` | Dry run (see [Limits](#limits-and-eligibility)) |
| Doppler options | `disableVesting` / `--no-vesting`, `quoteOnlyFees` / `--quote-only-fees`, `degenMode` (no CLI flag), `pairedTokenAddress` / `pairedStockAddress` (`--quote`) |
| `provider` | Send the value `GET /token-launches/quote-tokens?chain=<chain>` reports: `doppler` on Base, Robinhood Chain and Arbitrum, `bankr_v3` on Arc |
| Launch v3 options | `launchV3` (see [Bankr Launch v3](#bankr-launch-v3-arc)) |

With `--ni`, `bankr launch` needs `--name`; everything else falls back to Base, 15% vesting, in-kind fees and WETH.

## Doppler launches (Base, Robinhood Chain, Arbitrum)

### Economics (fixed at launch)

**Supply is 100 billion, non-mintable.** Every trade pays a **0.7% swap fee on the pool, 95% of it to the creator**; the hook adds the Bankr protocol fee, the BNKR buyback and an LP fee on top, **1.75% of volume all-in**:

| Recipient | Share of volume |
|-----------|-----------------|
| **Creator** — 95% of the 0.7% pool fee, claimable anytime | **0.665%** |
| **LP fee** (via hook) — compounds as permanently locked liquidity in your own pool | **0.285%** |
| Bankr protocol fee (via hook) | 0.475% |
| BNKR buyback (via hook) | 0.2375% |
| Protocol (Doppler) | ~0.0875% |

Creator fees accrue in your token and the quote token (e.g. WETH). Fee schedules never change retroactively: older tokens keep the schedule they launched with — the creator's 95% of the 0.7% pool fee is the same, only the hook add-on differs.

### Creator vesting (on by default)

Every non-partner Doppler launch premints **15% of supply to the fee recipient** and vests it over **1 year, including a 30-day cliff** (nothing unlocks for 30 days, then it vests continuously). The other 85% seeds the pool.

- Turn it off with "deploy with no vesting", `disableVesting: true`, `bankr launch --no-vesting` or **No vesting** in the web form — 100% of supply then goes into the pool. There is no custom percentage.
- The vesting recipient is fixed at launch; a later fee-rights transfer does **not** move the allocation.
- Org Partner Key launches never vest.

Read and claim the allocation (the vesting endpoints serve Launch v3 escrows too):

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /token-launches/{tokenAddress}/vesting?beneficiary=0x…` | None | Schedule and position: `phase` (`cliff` \| `vesting` \| `complete`), `cliffEndsAt`, `vestingEndsAt`, `claimableAmount`, `lockedAmount`, `unlockedPercent`, and whether `beneficiary` is `eligible`. `404` for a non-Bankr token |
| `POST /token-launches/{tokenAddress}/vesting/build-claim` | None | Unsigned `release()` for an external wallet (body `{ "beneficiaryAddress": "0x…" }`); `release()` pays only `msg.sender`, so holding the key is the authorization |
| `POST /token-launches/{tokenAddress}/vesting/claim` | Same as fee claims | Custodial claim from your Bankr wallet |

A claim releases everything vested at the moment it mines. Agent: "How much of my MTK allocation has vested?", "Claim my vested MTK".

### Quote-only fees

Opt in at launch ("launch with quote-only fees", `quoteOnlyFees: true`, `--quote-only-fees`, or the web toggle) to collect the whole creator share in the quote token instead of a token + quote mix. The total take is identical. On these tokens the creator's fee entry lives on the **hook contract's** fees manager, not the pool initializer — a direct on-chain `updateBeneficiary` must target the hook; Bankr's claim and transfer endpoints resolve it for you. Not available on partner deploys.

### Degen mode

`degenMode: true` (or asking for "degen mode" by name) starts the token at a **$2,500 market cap**; supply, fees and vesting are unchanged. It is explicit opt-in only — a token *named* DEGEN or "make it risky" phrasing does not enable it. The figure is fixed, there is no CLI flag, and partner deploys that ask for it get a `400`.

### Pairing the pool with another quote token

`GET /token-launches/quote-tokens?chain=<chain>` (public; also `bankr launch quotes --chain <chain> [--json]`) lists what a launch can pair with: the chain default first, then the fixed allowlist, then every tokenized stock Bankr can price there. Each entry names its `deployField` — the deploy-body field that selects it — and the response names the `provider`.

- **Send the entry's `address` in that field, together with the response's `provider`.** The API rejects a ticker; the CLI (`--quote <symbol|address>`) and the agent ("paired with TSLA") resolve symbols for you.
- Stocks can carry `illiquid: true` (CLI: `[thin liquidity]`) — the launch still goes through, the pool is just hard to trade. Allowlist entries carry `readiness`; cbHYPE and cbZEC wait on reviewed quote-token liquidity, and a pair that isn't `live` is refused with `409` rather than falling back to WETH.
- One pairing per launch: `pairedTokenAddress` and `pairedStockAddress` are mutually exclusive; omit both for WETH. Neither is available on Arbitrum or on partner deploys. An arbitrary ERC-20 is never accepted.

Fixed allowlist (each address is valid only on its own chain; `--quote BNKR` picks the right one for `--chain`):

| Chain | Token | `pairedTokenAddress` | Decimals |
|---|---|---|---|
| Base | BNKR | `0x22af33fe49fd1fa80c7149773dde5890d3c76f3b` | 18 |
| Base | ba3Pump (Bankr-bridged $PUMP) | `0x5577a294ae5a21446a11b0e4100ca83803995720` | 18 |
| Base | cbHYPE (Coinbase-wrapped HYPE) | `0xB200000000000000000000451d033a5000cb479e` | 18 |
| Base | cbZEC (Coinbase-wrapped ZEC) | `0xB2000000000000000000008501b13360000cb2EC` | 8 |
| Base | TAO (Bittensor) | `0xf3081494b87e8d5fb7960f066e931d1d0e6e3d67` | 18 |
| Robinhood Chain | BNKR (a different contract from Base BNKR) | `0x178E54df3D091EE4D0B2534742eF9e3692b76526` | 18 |
| Robinhood Chain | musebook (a Bankr-launched token) | `0x91A2DAe9699f0B82540B5886b0d8759C22820bA3` | 18 |

cbHYPE and cbZEC are crypto wrappers, not stocks — they go in `pairedTokenAddress`. Stocks go in `pairedStockAddress`: Robinhood Stock Tokens on Robinhood Chain, Coinbase B20 equities on Base.

```json
GET /token-launches/quote-tokens?chain=robinhood
→ { "chain": "robinhood", "provider": "doppler", "quoteTokens": [ { "symbol": "WETH", "isDefault": true, "deployField": null, … }, { "symbol": "NVDA", "address": "0x…", "kind": "stock", "deployField": "pairedStockAddress", "illiquid": false, … } ] }

POST /token-launches/deploy
{ "tokenName": "Semis", "chain": "robinhood", "provider": "doppler", "pairedStockAddress": "0x…" }
```

### Five-minute balance cap

For the first five minutes after a non-partner Doppler launch, no wallet may hold more than **2% of total supply** — a buy or transfer that would push a recipient over 2% fails until the cap expires. This is separate from the 14-second anti-snipe fee decay at launch. The expiry is encoded on-chain.

## Bankr Launch v3 (Arc)

Arc launches always use Bankr Launch v3 (`provider: "bankr_v3"`), quoted in USDC. A `bankr_v3` pick on a chain where v3 isn't open is refused with `400 LAUNCH_PROVIDER_UNAVAILABLE`; the deploy response's `provider` field says which provider served a launch.

**Economics:** one v3 pool at the 1% fee tier, LP fees split **creator 70% / Bankr 30%**, **1 billion** supply, no Bankr launch fee. **Vesting is off by default.**

On a v3 launch, options go in the deploy body's `launchV3` object (the agent takes them as plain fields):

| Field | Meaning |
|---|---|
| `vestPercent` | 0–50, default **0**; 15 = the standard 15% / 1 year / 30-day cliff |
| `devBuy: { amount }` | A buy in the quote token's units (USDC on Arc), executed as the pool's first swap; `POST /launch-v3/dev-buy-quote` prices it |
| `holderSharePercent`, `holderMode` | Stream 1–100% of the creator fee leg to token holders, paid in `token`, `paired` (the quote) or `both` |
| `holderVestPercent` | Stream part of the vested slice to holders (needs `vestPercent`, `holderSharePercent` and a `token` or `both` holder mode) |
| `creatorFeeMode` | `quote` (default: Bankr's keeper converts the token-side fees into the quote, at most 5% price impact per fill), `both` (each leg in kind) or `token` |

- **Doppler options don't apply.** On a v3 launch the deploy API ignores `pairedTokenAddress`, `pairedStockAddress`, `disableVesting`, `quoteOnlyFees` and `degenMode` (the agent rejects them). Vesting is set with `vestPercent`, and the quote with `launchV3.quoteAddress` from `GET /launch-v3/quotes?chain=<chain>` — on Arc that list is USDC only.
- **Fund gas and the dev buy up front.** A wallet that can't cover them is refused before signing, with the amounts.
- `GET /launch-v3/{tokenAddress}/fees?account=0x…` reads a v3 token's claimable fees.

**Writes come in pairs** — an unauthenticated builder that returns an unsigned transaction (sign it yourself: `/wallet/sign` + `/wallet/submit`, or any wallet) and a custodial route that needs a signed-in Bankr Terminal session:

| Builder (no auth) | Custodial (session) | Does |
|---|---|---|
| `POST /launch-v3/{token}/recipient/build` `{ account, newRecipient }` | `…/recipient/transfer` | Hands the fee recipient role to another address |
| `POST /launch-v3/{token}/operator/build` | `…/operator/grant` | Lets an operator claim on your behalf (payout stays yours) |
| `POST /launch-v3/{token}/holders/build-claim` | `…/holders/claim` | Holder-reward claim |
| `POST /launch-v3/{token}/fees/build-claim` | — | Creator fee claim |

The builders take no credential (an `X-API-Key` is simply ignored); the transaction signature authorizes the write. The custodial routes never read `X-API-Key`, so a key-only request gets `401`. From an API key, use the builder — or `POST /token-launches/{tokenAddress}/fees/claim` for fees. Both recipient paths answer `403` unless the signer is the current recipient and `400` when `newRecipient` already is. Claim accrued fees first if they should stay with the old address; the creator-vesting allocation stays with the recipient recorded at launch.

## Limits and eligibility

Both providers share these; the gates run on every launch path (API, web, agent and social).

| Rule | Value |
|---|---|
| Launch quota | **3 counted launches per wallet per rolling 24 h** — Standard, Bankr Club, partner-organization and provisioned wallets alike |
| Rate | One deploy per minute per account, one in flight at a time |
| Simulations | 20 per wallet per 24 h. They never consume a launch slot, but are refused once the wallet's 3 launches are used |
| Same token name | 3 per account per hour; 10 across all accounts per hour |
| Fee-recipient address | 20 launches per 24 h across all accounts |
| Per network (IP) | About 10 successful non-partner deploys per client IP per 24 h (`429` "Too many token deployments from this network") — the ceiling a single deploying host hits first, so pace deploys |
| Email-only wallet | Can't launch until 72 h old; linking an X, Farcaster or Telegram account lifts the wait |
| Region | Launches are geo-gated |
| Wallet age / minimum ETH | Runtime switches that may be on (24 h wallet age, a minimum native balance) — handle `TOKEN_LAUNCH_WALLET_TOO_NEW` and `TOKEN_LAUNCH_MIN_BALANCE_REQUIRED`. Arc's 0.5 USDC minimum always applies |

- **Only launches that went out consume budget.** Quota is reserved just before metadata pinning; validation, recipient-resolution and pricing failures before that never cost a slot. A launch that may have been broadcast keeps its slot (and its name and fee-recipient allowance) — never assume a failed deploy was free.
- **A deploy request can time out while the launch completes.** Don't resubmit: while it runs, new deploys answer `429` "Deploy already in progress"; then check your recent launches.
- Partner deploys are exempt from the IP cap, the simulation cap, the per-account name cap and the region / wallet gates — not from the 3-per-24h quota.
- On X, repeatedly breaching the one-per-minute limit restricts the account for 24 hours (login, balances and withdrawals still work). For legitimate high-volume deploying, open a support ticket first.

| Response | Meaning | Do |
|---|---|---|
| `429` | A quota, rate, name, fee-recipient, IP, simulation or in-flight limit | Wait for the window; don't retry into it |
| `403 TOKEN_LAUNCH_NOT_AVAILABLE` | Deliberately generic: a region block, or an email-only wallet inside its 72 h wait | Link X, Farcaster or Telegram if the wallet is email-only; otherwise treat as terminal |
| `403 TOKEN_LAUNCH_MIN_BALANCE_REQUIRED` | Below the chain's minimum native balance | Fund the wallet |
| `403` Restricted API key | The key has a recipient allowlist and the fee recipient is neither the key's wallet nor on it | Use an allowed fee recipient |
| `409` | Selected quote token not ready (cbHYPE / cbZEC) | Retry once it is `live` |
| `503 TOKEN_LAUNCH_PRICE_UNAVAILABLE`, `TOKEN_LAUNCH_ELIGIBILITY_UNAVAILABLE`, `TOKEN_LAUNCH_MAINTENANCE` | Nothing was launched | Retry after ~60 s |

## Gas sponsorship

Retail launch gas is sponsored on **Base only**; on Robinhood Chain, Arbitrum and Arc the launch wallet pays. Partner launches follow their organization's policy. Across every sponsored path (launches, fee claims, transfers) a non-partner wallet gets at most **10 sponsored transactions and $3 of sponsored gas per 24-hour window** — past either, it pays its own gas.

## After launch

- **Claim fees:** "Claim fees for my token MTK", `bankr fees` / `bankr fees claim <tokenAddress>`, or `POST /token-launches/{tokenAddress}/fees/claim` (auto-detects Doppler, Clanker or Launch v3). "Claim legacy Clanker fees" covers older tokens.
- **Transfer fee rights (Doppler):** see [Transferring fees](https://docs.bankr.bot/token-launching/transferring-fees). Fees not yet claimed go to whoever is the beneficiary at claim time, so claim first; the vesting allocation stays with the original recipient.
- **Name and logo:** the fee recipient can set a Bankr-only display name and logo (Discover, the token page) from the web terminal's token drawer or `PATCH /token-launches/{tokenAddress}/metadata` with `name` and/or `imageUri` (`null` clears). The on-chain name, symbol and launch metadata are immutable. Legacy Clanker tokens can still have their image and metadata updated through the agent.
- **Taking profit (Glidepath):** builders exit gradually with a **Glidepath** — a capped, AI-paced sell set up from the token page at [bankr.bot](https://bankr.bot) for Base and Robinhood Chain launches; a web feature, not a CLI/API action ([Glidepath docs](https://docs.bankr.bot/token-launching/glidepath)). On Base, Bankr may refuse to sell a token you earn fees on through its swap and order tools and point you to Glidepath instead; buying and transferring are never affected.
