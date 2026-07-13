---
name: bankr-index
description: Build and operate the Bankr Index: a Bankr-specific skill + app workflow for analyzing BNKR and Bankr-launched tokens, scoring market regime with market/social signals, setting a USDC budget, and preparing confirmed rebalance actions through Bankr.
---

# Bankr Index

## Purpose

Use this skill when the user wants to create, update, run, share, or test a Bankr Index app/strategy.

The Bankr Index is a Bankr-native market regime and portfolio-control system. It analyzes BNKR plus tokens launched through Bankr-linked launch flows, then produces buy/hold/rebalance recommendations against a configured USDC budget. It should default to recommendation + user-confirmed execution, not autonomous swapping, unless the user explicitly asks to automate trades.

Bankr leads the agentic-economy / AI-agent space on Base. Treat BNKR as the anchor asset and Bankr launches as the higher-beta basket.

## Default user-facing defaults

If the user says “use defaults” or does not specify otherwise:

- Chain: Base
- Budget: 1,000 USDC
- Quote asset: USDC
- Anchor: BNKR at 0x22af33fe49fd1fa80c7149773dde5890d3c76f3b
- Mode: analyze + recommend only; prepare/suggest swaps but require explicit user confirmation before execution
- Refresh cadence: every 6 hours for the app snapshot if scheduling is available
- Universe: BNKR + Bankr-launched tokens discovered from the Bankr Dune dashboard/query set, filtered by liquidity/volume/market-cap quality
- Risk posture: volatile microcaps; cap per-token allocation and keep a cash buffer

## Data source: Bankr launches

Primary discovery source:

- Dashboard: https://dune.com/bankrofficial/bankr-metrics
- Token-list query: https://dune.com/queries/6899023/results
- Query id: 6899023
- Description: materialized Bankr token list; covers BNKR, Clanker v1/v3/v31/v4, Doppler legacy hooks, and Doppler V4 Hook 3.
- Key source logic observed:
  - BNKR hardcoded as 0x22af33fe49fd1fa80c7149773dde5890d3c76f3b
  - Clanker v3 tokens where deployer = 0xb1058c959987e3513600eb5b4fd82aeee2a0e4f9
  - Clanker v31 tokens where metadata contains “Deployed using Bankr”
  - Clanker v4 tokens where tokenContext.interface = “Bankr”
  - Doppler legacy and V4 Hook coverage from Base logs and token metadata

Other useful dashboard/query IDs observed:

- 6954427: daily timeseries with day, clanker_volume, doppler_volume, total_volume, clanker_deploys, doppler_deploys, total_deploys
- 7448936: volume by launchpad over 1w/1m/3m/6m/1y
- 6924915: fee calculation query; clanker fees use buy_volume_usd * 0.01, doppler fees use buy_volume_usd * 0.012

If Dune API access is unavailable, use `bankr.askAgent` from a scheduled app script to refresh a compact snapshot from the Dune dashboard and primary query pages. The iframe should read cached appKV snapshots, not scrape Dune directly.

## Universe construction

Build a tradable universe from the Bankr launch list:

1. Always include BNKR.
2. Pull the latest Bankr launch list from Dune if possible.
3. Filter out obvious junk:
   - missing token address
   - no recent volume
   - very low liquidity
   - extreme one-block pump / no market continuity
   - duplicate symbols where address quality is unclear
4. Rank candidates by:
   - 24h volume
   - 7d volume
   - market cap
   - liquidity depth
   - deploy age
   - fee generation where available
5. Keep a compact basket for v1:
   - BNKR + top 8 to 15 Bankr-launched tokens
   - never overweight a single microcap just because it pumped

## Signal model

Use a regime score from 0 to 100.

Suggested weights:

- 30% BNKR trend: price, volume, market cap, short-term momentum vs recent history
- 25% Bankr launch breadth: percentage of basket tokens up, volume expansion, number of active launches
- 20% liquidity/quality: top-token volume concentration, fee generation, liquidity depth
- 15% social sentiment: X/Farcaster/search sentiment around BNKR, Bankr, and the leading basket tokens
- 10% risk penalty: extreme volatility, concentration, stale data, missing data, or suspicious token behavior

Regime interpretation:

- 75–100: risk-on. Deploy more budget, tilt toward high-quality Bankr launches.
- 55–74: constructive. Maintain core BNKR + selective basket exposure.
- 40–54: neutral/chop. Hold, small rebalance only.
- 20–39: defensive. Reduce microcap exposure, keep more USDC/BNKR.
- 0–19: risk-off. Preserve USDC, no new microcap buys unless explicitly requested.

## Allocation defaults

For a 1,000 USDC budget:

- Risk-on:
  - 35% BNKR
  - 50% top Bankr launch basket
  - 15% USDC reserve
- Constructive:
  - 40% BNKR
  - 35% basket
  - 25% USDC reserve
- Neutral:
  - 35% BNKR
  - 20% basket
  - 45% USDC reserve
- Defensive:
  - 25% BNKR
  - 10% basket
  - 65% USDC reserve
- Risk-off:
  - 10% BNKR
  - 0–5% basket
  - 85–90% USDC reserve

Microcap guardrails:

- Max 10% of budget per non-BNKR token in v1.
- Max 50% combined non-BNKR Bankr-launch basket in v1.
- Do not recommend new buys into a token with missing liquidity/volume data.
- If social sentiment is strongly negative, cap that token at 0–2% unless user overrides.

## App build instructions

When building the Bankr Index app, create a private owner-scoped Bankr app first. Public sharing can come later after the public appKV audit passes.

Recommended app shape:

- Slug: `bankr-index`
- Title: `Bankr Index`
- Frontend identity: `owner`
- Permissions:
  - read:appdata
  - write:appdata
  - invoke:agent
  - fetch:http only if scripts directly call public HTTP APIs
  - read:portfolio only if the app reads the owner portfolio
  - prepare:transaction only if it prepares tx blobs for confirmTransaction
- Scripts:
  - `getIndex`: read cached config/snapshot from appKV and return compact state
  - `refreshIndex`: owner/cron path; refresh Dune + social sentiment using deterministic HTTP where possible or `bankr.askAgent` where needed; write `bankr_index_snapshot`
  - `saveConfig`: store budget/risk parameters in `bankr_index_config`
  - optional `prepareRebalance`: prepare, but do not broadcast, transaction blobs for confirmed swaps
- appKV keys:
  - `bankr_index_snapshot`
  - `bankr_index_config`
  - `bankr_index_history`

UI requirements:

- First screen should be the working dashboard, not a marketing page.
- Show budget, deployed %, USDC reserve, regime score, confidence, last refresh time, top tokens, social summary, and recommended actions.
- Include clear stale/error/empty states.
- Include a “Refresh analysis” action that clearly states if it uses agent credits.
- For execution, prefer a chat handoff like `bankr.askChat('rebalance Bankr Index using the current app recommendation')` or a prepare/confirm flow. Do not silently execute trades.

## Automation instructions

For scheduled refresh:

- Prefer app schedule: `set_app_schedule({ slug: 'bankr-index', schedule: [{ script: 'refreshIndex', cron: '0 */6 * * *', enabled: true }] })`.
- The scheduled script should refresh the cached snapshot and append a compact history point.
- If the user requests alerts or active rebalancing, use Bankr automations only after the command/action is explicit.
- Default automation should analyze/notify, not trade.

Suggested automation command when asked to monitor:

“Refresh the Bankr Index analysis, summarize the current regime, and notify me if the score crosses risk-on above 75 or defensive below 40.”

Trading automations require explicit details: action, budget, rebalance cadence/trigger, max spend, and allowed assets.

## Execution policy

This skill must follow Bankr confirmation rules:

- Reads, analysis, app creation, skill updates: proceed autonomously.
- Swaps/rebalances/transfers/signatures: require explicit current-message imperative with amount/target, or a direct confirmation after a proposed action.
- Never infer a token-transfer amount.
- Never broadcast app-prepared tx blobs without explicit user confirmation in chat.

## Output format when used

When reporting a Bankr Index run, include:

- Regime: label + score
- Budget: configured USDC budget
- Universe: number of Bankr launches considered + source
- Signal drivers: BNKR, basket breadth, liquidity/volume, social sentiment, risk penalty
- Recommendation: buy/hold/rebalance with target allocations
- Execution status: analysis only / prepared tx / executed tx
- Next step: what is already scheduled or what needs confirmation
