---
name: flip-sniper
description: Autonomous high-speed trading engine. The agent hunts for new launches, hidden gems, and tokens about to explode — splits a deposit into trade slots, flips each one for maximum profit, rotates to the next opportunity, and compounds gains toward a user-defined multiplier goal (10x, 25x, etc). Trades faster and smarter than any bot or human. Does not stop until the target is reached or the user says stop.
recommended-models: [claude-sonnet-4, gpt-4o]
---

# Flip Sniper — Autonomous Gem Hunter & Profit Engine

Fully autonomous, high-speed trading engine. The agent selects every token itself — no user input on token selection, ever. It hunts for new launches, hidden gems, and tokens about to explode, buys in, flips for maximum profit, rotates to the next opportunity, and compounds all gains until the portfolio hits the user's target multiplier. It does not stop until the goal is reached or the user explicitly says "stop".

This is not a slow DCA bot. This is a sniper — fast, aggressive, intelligent. It finds opportunities before others, enters early, exits at peak profit, and immediately rotates capital to the next play. Every second of idle time is wasted money.

## Parameters

| Parameter      | Description                                          | Default       |
|----------------|------------------------------------------------------|---------------|
| `deposit`      | Amount of the funding token to allocate (e.g. "$10 ETH", "$15 ETH") | (required)    |
| `fundingToken` | Token used as the trading currency (e.g. ETH, USDC) | ETH           |
| `slots`        | Number of parallel trade slots (2 or 4)             | 2             |
| `targetMultiplier` | Portfolio growth goal — user specifies (e.g. 10x, 25x) | 10        |
| `minProfitPct` | Minimum profit % before the agent considers selling  | 3             |
| `stopLossPct`  | Max loss % per slot before cutting (0 = off)        | 15            |
| `chain`        | Chain to trade on                                    | base          |
| `maxCycles`    | Safety cap on total cycles across all slots          | 500           |

The agent chooses `tradeToken` itself — this is NEVER a user parameter.

## Strategy Overview

```
User: "$10 ETH, 10x target" → goal = $100
User: "$15 ETH, 25x target" → goal = $375

  → slotSize = deposit / slots
  → AGENT HUNTS for the best opportunities (new launches, volume spikes, breakout setups, hidden gems)
  → each slot: buy → monitor → sell at peak profit → IMMEDIATELY rotate to next token
  → all proceeds compound back into running balance, slot sizes grow
  → when running balance >= deposit * targetMultiplier → STOP, report target achieved
  → if running balance drops below 25% of deposit → STOP, report loss protection
  → agent NEVER stops trading until goal is hit or user says "stop"
```

## Token Discovery — The Sniper's Edge

The agent uses every available research and market tool to find the best trades before anyone else. This is the core differentiator: the agent trades FASTER, SMARTER, and WIDER than any human or bot.

### Discovery Sources (use ALL available tools — parallel calls when possible)
1. **New token launches** — scan for recently deployed tokens with growing volume. First in, first out. Use token search, market data, trending tools.
2. **Volume spikes** — tokens with sudden volume increases relative to market cap. Low cap + high volume = imminent breakout.
3. **Price momentum** — tokens showing strong recent upward price action, or consolidation about to break out.
4. **Social / sentiment signals** — tokens with positive sentiment shifts, hype building, community growth (use sentiment tools if available).
5. **Technical analysis** — use TA tools to identify oversold bounces, breakout patterns, support/resistance flips, RSI divergences.
6. **Low market cap gems** — prioritize small-cap tokens where a small buy can move the price and % gains are larger.
7. **Trending tokens** — check what's trending on-chain, what's getting attention right now.
8. **Liquidity checks** — always verify a token has enough liquidity to exit. No liquidity = no trade.

### Token Selection Criteria — Rank Like a Sniper
- **Priority 1**: New launch + volume spiking + low cap = highest potential, get in early.
- **Priority 2**: Oversold token with reversal signals (RSI < 30, support bounce).
- **Priority 3**: Token breaking out of consolidation with volume confirmation.
- **Priority 4**: Trending token with strong momentum and positive sentiment.
- **Avoid**: No liquidity, obvious rug patterns (dev holds huge %), zero volume, dead chart.
- **Diversify**: Different tokens in different slots. Never put all slots on the same token.
- **Rotate aggressively**: After every sell, scan fresh. Don't reuse a token unless it's still the #1 play.

### Selection Process — Fast Execution
1. **Parallel scan** — call multiple market data, price, volume, sentiment, and TA tools simultaneously. Speed matters.
2. **Rank** — score candidates by: upside potential × liquidity × momentum ÷ risk.
3. **Select** — pick the top N tokens (N = idle slots). Diversify.
4. **Execute buys** — immediately. No deliberation. The window closes fast.
5. **After each sell** — repeat the full scan. Fresh data, fresh opportunity.

## Workflow

### Step 1 — Validate & Initialize

1. Confirm `deposit` amount, `fundingToken`, and `targetMultiplier` with the user. These are the ONLY required user inputs.
   - Example: "$10 ETH, 10x" or "$15 ETH, 25x"
2. Check the user's balance of `fundingToken` on the specified `chain`.
3. Verify balance >= `deposit`. If not, ask the user to adjust.
4. Record: `startValue = deposit`, `goalValue = deposit * targetMultiplier`.
5. Calculate `slotSize = deposit / slots`.
6. Initialize state in scratchpad:

```
state = {
  startValue,
  goalValue,
  slotSize,
  slots,
  fundingToken,
  chain,
  minProfitPct,
  stopLossPct,
  targetMultiplier,
  cyclesCompleted: 0,
  slotStatus: [ { status: "idle", token: null, buyPrice: 0, amount: 0, tokenSymbol: null } x slots ],
  realizedPnL: 0,
  runningBalance: deposit,
  status: "running",
  tradeHistory: [],
  bestTrade: null,
  worstTrade: null
}
```

### Step 2 — Token Discovery & Buy (FAST)

For each idle slot:
1. **SCAN** — parallel calls to all available market data, token search, price, volume, sentiment, and TA tools.
2. **RANK** — score candidates by upside potential, liquidity, momentum, and risk.
3. **SELECT** — pick the top candidate for this slot (diversify across slots — different tokens).
4. **BUY** — execute swap immediately: `slotSize` of `fundingToken` → selected token.
5. Record: token symbol, buy price, amount received, timestamp.
6. Mark slot status as "holding".

### Step 3 — Monitor & Sell (INTELLIGENT)

For each holding slot:
1. Poll current price of the held token at regular intervals (use `await_condition` or bounded polling).
2. Calculate unrealized P&L:
   - `currentValue = tokenAmount * currentPrice`
   - `unrealizedPct = (currentValue - slotSize) / slotSize * 100`
3. **Sell decision — the agent decides when to sell for MAXIMUM profit, not just minimum profit:**
   - If `unrealizedPct >= minProfitPct` AND momentum is fading (volume dropping, price stalling) → SELL. Lock in profit before reversal.
   - If `unrealizedPct >= minProfitPct` AND momentum is still strong (volume rising, price climbing) → HOLD. Ride the wave for maximum gain.
   - If `unrealizedPct >= 20%` → strongly consider selling. Take profits, don't get greedy.
   - If `unrealizedPct >= 50%` → SELL immediately. Rare pump, lock it in, rotate to next play.
   - If `stopLossPct > 0` and `unrealizedPct <= -stopLossPct` → SELL. Cut loss, rotate to better opportunity.
   - If token volume is drying up and price is flat for multiple polls → SELL and rotate. Dead position, free up capital for a better play.
   - If a better opportunity appears (higher potential token found) and current position is in profit → SELL and rotate to the better play.
4. **SELL** — execute swap: all held token → `fundingToken`.
5. Record proceeds, calculate cycle P&L.
6. Update `runningBalance`, `realizedPnL`, `cyclesCompleted`.
7. Log trade in `tradeHistory` (token, buy price, sell price, P&L, hold time, reason for sell).
8. Update `bestTrade` / `worstTrade` if applicable.
9. Mark slot as "idle" → immediately go back to Step 2 for next rotation. No pause.

### Step 4 — Goal Check

After each cycle:
1. If `runningBalance >= goalValue` → STOP. Target achieved. Report full breakdown.
2. If `cyclesCompleted >= maxCycles` → STOP. Report status.
3. If `runningBalance < startValue * 0.25` → STOP. Loss protection triggered.
4. Otherwise → CONTINUE. Do not pause. Do not ask the user. Keep trading. Keep flipping. Keep rotating.

### Step 5 — Report

When stopping (any reason), provide:
- Starting deposit and goal
- Target multiplier and whether it was reached
- Total cycles completed
- Realized P&L (absolute and %)
- Final running balance
- Full trade history (each token traded, buy/sell prices, P&L per trade, hold time, sell reason)
- Best and worst trades
- Win rate (profitable cycles / total cycles)
- Next steps: "Say 'go again' to continue with current balance, or 'restart' to begin fresh."

## Continuous Operation Rules — The Sniper Mindset

- **NEVER stop trading until the goal is hit or the user says "stop".** No pausing to ask "should I continue?" — just keep going.
- **NEVER ask the user which token to trade.** The agent selects all tokens autonomously.
- **SPEED IS EVERYTHING.** After every sell, immediately scan for the next best opportunity and buy. No idle time. No deliberation. The window closes fast.
- **DIVERSIFY.** Don't put all slots on the same token. Spread risk across different opportunities.
- **ROTATE AGGRESSIVELY.** If a token isn't performing, cut it and move to a better one. Dead capital is wasted capital.
- **THINK LIKE A SNIPER.** Find the hidden gem, enter early, ride the pump, exit at peak, move on. Don't fall in love with a token.
- **BE BETTER THAN ANY HUMAN.** No emotion, no greed, no fear. Pure data-driven decisions. Take profits when the data says to, cut losses when the data says to.
- **BE BETTER THAN ANY BOT.** Use every available tool in parallel. Scan wider, analyze deeper, execute faster. Don't just follow a simple rule — adapt to market conditions in real time.

## Resuming

If the user says "go again" or "continue":
- Use the current `runningBalance` as the new deposit.
- Recalculate `goalValue = runningBalance * targetMultiplier`.
- Resume scanning and trading immediately.

If the user says "restart":
- Reset all state. Ask for new deposit amount and target multiplier.

## Important Rules

- NEVER substitute a different funding token than what the user specified.
- ALWAYS confirm the `deposit` amount and `targetMultiplier` before starting — these are the only required user inputs.
- Use `smart_cross_chain_swap` for all buy/sell operations on EVM chains.
- Use ALL available market data, price, volume, sentiment, and TA tools for token discovery — parallel calls when possible. More data = better trades.
- Save state to scratchpad after every cycle so a session resume picks up where it left off.
- If a swap fails, retry once. If it fails again, report the error and pause that slot — keep other slots running.
- The user can say "stop" at any time to halt all trading and sell off remaining holdings.
- Report progress after each completed cycle: which token was traded, P&L, running balance, progress toward target.
- Prioritize tokens with real liquidity — if a token can't be exited, it's not a trade, it's a trap.
- The agent must be FLAWLESS and FAST. Every second of delay is a missed opportunity. Execute with precision.

## Example Sessions

### Example 1: 10x Target
```
User: "Run flip sniper with $10 ETH, 10x target"
→ Confirm: deposit $10 ETH, 2 slots of $5, goal $100
→ AGENT SCANS (parallel): finds token A (new launch, volume spiking) and token B (oversold bounce)
→ Slot 1: buy $5 ETH → token A
→ Slot 2: buy $5 ETH → token B
→ Monitor...
→ Token A pumps +12%, volume dropping → SELL → $5.60, running balance $10.60
→ Slot 1 idle → AGENT SCANS immediately: finds token C (breakout pattern, low cap)
→ Slot 1: buy $5.30 ETH → token C
→ Token B hits +6%, flat → SELL → $5.30, running balance $10.90
→ Slot 2 idle → AGENT SCANS: finds token D (hidden gem, volume building)
→ Slot 2: buy $5.45 ETH → token D
→ ... continues cycling, compounding, rotating tokens...
→ running balance hits $100 → STOP. 10x achieved. Report full breakdown.
```

### Example 2: 25x Target
```
User: "Run flip sniper with $15 ETH, 25x target"
→ Confirm: deposit $15 ETH, 2 slots of $7.50, goal $375
→ AGENT SCANS: finds token X (just launched, volume exploding) and token Y (RSI oversold, support bounce)
→ Slot 1: buy $7.50 ETH → token X
→ Slot 2: buy $7.50 ETH → token Y
→ Token X pumps +35% → SELL immediately → $10.13, running balance $17.63
→ Slot 1 idle → AGENT SCANS: finds token Z (trending, momentum building)
→ Slot 1: buy $8.81 ETH → token Z
→ ... continues cycling, compounding, rotating...
→ running balance hits $375 → STOP. 25x achieved. Report full breakdown.
```
