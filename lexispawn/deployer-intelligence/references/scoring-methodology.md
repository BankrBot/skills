# Deployer Intelligence Scoring Methodology

## Purpose

The deployer score (0-100) quantifies a wallet's historical track record of token deployments. It answers: **Has this deployer launched tokens that survived, or is this a pattern of failure?**

## Why This Matters

Base 2026 has thousands of new token launches daily. Most fail within 72 hours. Knowing whether a deployer has a history of:
- Building tokens that hold liquidity past 30 days
- Serial launching with 0% survival rate
- First-time deployment (unknown risk)

...provides edge that market cap and volume alone don't reveal.

## Scoring Formula

### Base Score
Start at **50** (neutral, no prior data)

### Positive Signals

**+10** if any token survived 30+ days
- Proves the deployer has launched at least one project with staying power
- Single-flag bonus (doesn't stack)

**+5** per token survived 7+ days (max +20)
- Each token that made it past the first week adds credibility
- Capped at 4 tokens to prevent infinite stacking

**+10** if average peak mcap > $500K
- High mcaps indicate legitimate market interest in deployer's projects
- Uses average across all tokens with market data

### Negative Signals

**-10** per token dead <72h (max -30)
- Each token that died within 3 days is a red flag
- Capped at 3 tokens to prevent score going below floor

**-20** if 5+ tokens deployed with 0 survivors past 7 days
- Serial deployer with 100% failure rate = major red flag
- Applied once if condition met

**-15** if >10 contracts deployed but <30% have market data
- Most deployed contracts never got liquidity = likely test tokens or abandoned launches
- Indicates high deploy volume with low follow-through

### Range
**Min:** 0  
**Max:** 100

Enforced via `Math.max(0, Math.min(100, score))`

## Interpretation Guide

| Score Range | Interpretation | Action |
|-------------|----------------|--------|
| **0-30** | Red flag. Proven failure pattern or serial rugger. High risk. | Avoid. Use as veto filter. |
| **30-50** | Neutral/unknown. First-time deployer or mixed track record. | Proceed with caution. Cross-reference other signals. |
| **50-70** | Moderate credibility. Some survivors, not all failures. | Acceptable risk if other signals align. |
| **70-100** | Strong track record. Consistent survival rates, proven builder. | Green light from deployer perspective. |

## Example Scores

### Score 15: Serial Failure
- 16 contracts deployed
- 0 have market data (never got liquidity)
- Result: **Base 50 - 20 (serial failure) - 15 (no data) = 15**

### Score 50: First-Time Deployer
- 1 contract deployed
- Token is 10 days old, still active
- Result: **Base 50 + 0 (no 30d survival yet) = 50**

### Score 65: Proven with Low Success Rate
- 11 contracts deployed
- 1 survived 30+ days with $29M peak mcap
- Result: **Base 50 + 10 (30d survivor) + 10 (high mcap) - 5 (multiple dead <72h) = 65**

### Score 85: Strong Track Record
- 8 contracts deployed
- 4 survived 7+ days (3 past 30 days)
- Average peak mcap $1.2M
- Result: **Base 50 + 10 (30d survivors) + 20 (four 7d survivors) + 10 (high avg mcap) - 5 (one dead <72h) = 85**

## Data Sources

### Contract Creation History
**Source:** Routescan API (`txlistinternal` endpoint)
**Method:** Filter for `type === "create" || type === "create2"` and non-empty `contractAddress`
**Coverage:** Works for traditional factory contracts and EOA deployers

**Limitation:** ERC-4337 Account Abstraction wallets embed deployments in UserOp initCode. These are invisible to `txlistinternal` without decoding the UserOp data. Most 2026 Base tokens use AA wallets, resulting in many deployers showing 0 history even if they've deployed multiple tokens.

### Token Market Data
**Source:** DexScreener API (`/token-pairs/v1/base/{address}`)
**Fields:** mcap (fdv), liquidity, volume, price, age (from pairCreatedAt)
**Coverage:** Only tokens with active trading pairs

**Limitation:** Tokens that launched but never got liquidity (dead on arrival) won't appear in DexScreener and therefore won't be counted in history.

## Status Classification

Tokens in history are classified as:

| Status | Criteria |
|--------|----------|
| **active** | Liquidity > $1K, mcap > 0, price > 0 |
| **low_liquidity** | Liquidity $1-$1K |
| **dead** | Liquidity = 0 OR mcap = 0 OR price = 0 |

## Time Windows

- **<72h (dead):** Token died within 3 days of launch (negative signal)
- **7+ days (survived):** Token maintained liquidity for at least a week (positive signal)
- **30+ days (survivor):** Token has staying power beyond the initial hype cycle (strong positive signal)

Time is calculated from `pairCreatedAt` (when liquidity was first added), not contract deployment.

## Future Improvements

### Planned
1. **Time-weighted penalties:** Recent failures penalized more than old ones
2. **Survivor quality weighting:** Token that hit $10M peak scores higher than one that peaked at $100K
3. **Deployer clustering:** Identify when multiple "different" deployers are actually the same entity
4. **AA wallet support:** Decode UserOp initCode to surface ERC-4337 deployment history

### Under Consideration
1. **Liquidity lock detection:** Bonus for deployers who lock LP tokens
2. **Team wallet analysis:** Track whether deployer sold early or held long-term
3. **Multi-chain aggregation:** Combine track record across Base + Ethereum + other chains

## Validation

Scoring logic validated against:
- **CLANKER factory** (0x250c9fb2b411b48273f69879007803790a6aea47): 11 deploys, 1 survivor → Score 65 ✅
- **Unproven AA wallet**: 16 deploys, 0 market data → Score 15 ✅
- **First-time deployer**: 1 deploy, active → Score 50 ✅

## Usage in 15 MINDS Pipeline

Deployer intelligence is one input into the 15 MINDS trading system:
1. **DexScreener trending tokens** → filter by mcap/age/liquidity
2. **Deployer scanner** → identify red flags (score <30 = veto)
3. **15 MINDS analysis** → query 15 frontier models for conviction
4. **Execute** → if deployer score >30 AND 3+ models say BUY → trade

Deployer score is a **veto filter**, not a buy signal. A score of 85 doesn't mean buy — it means the deployer isn't a known failure pattern. The 15 MINDS verdict determines entry.

---

**Built by Lexispawn** | Part of the 15 MINDS intelligence system
