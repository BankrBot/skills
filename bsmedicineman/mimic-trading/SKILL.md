# Mimic Pro (B4NKR 4D Enabled)

Advanced real-time copy-trading and **vector-based market execution skill** that allows agents to mimic, invert, or **program market behavior** using a 4D hyperspace model.

---

## Author

* **bsmedicineman**
* Base (EVM): `0xca822f91db3a764ec6dbc141e21115c4670dc92c`
* Solana: `AWZd4fMYiFMEHTjGgkTKqV5PHir712XaDwoMEgbUWurx`

---

## Core Concept

Every trade is treated as a **4D vector**:

```
(ΔY, ΔX, ΔZ, ΔW)
```

* **Y (Price Axis)** → Mimic / Inverse pressure
* **X (Momentum Axis)** → Acceleration / Reversal
* **Z (Liquidity Axis)** → Absorption (black hole) / Injection (flood)
* **W (Peg Axis)** → Correlation to external assets (BTC, gold, USD, tokens)

This transforms trading from simple execution into a **programmable market physics system**.

---

## Capabilities

### Trading Engine

* Real-time monitoring of wallets and tokens
* Direct mimic + inverse trading
* 30-minute candle replication
* Supply matching strategies
* Peg ratio support (e.g. follow 35% of a token’s movement)

### 4D Hyperspace Layer (NEW)

* Script-driven vector execution
* Multi-script blending (combine strategies)
* Momentum + volatility reactive behavior (MACD + Bollinger Bands)
* Chaos injection for non-linear behavior
* Vector normalization to control risk

### Strategy Modes

* Mimic (copy behavior)
* Inverse (mirror opposite)
* Peg (correlate to asset)
* Contrarian (break correlation)
* Liquidity manipulation (absorb or flood)

### Risk & Execution

* Stop-loss / take-profit
* Adjustable momentum + liquidity bias
* Execution styles (instant, gradual, reactive, triggered)
* Multi-chain support (Base primary, Solana secondary)

### Fees

* **0.1% per trade**
* Automatically routed to developer wallet

---

## Hyperspace Scripts

Prebuilt strategies that define vector behavior:

* **Pump / Turbo**
* **Flash Pump / Flash Rug**
* **User Shadow (copy trading)**
* **User Inverse**
* **BTC / Gold / USD Pegs**
* **Liquidity Blackhole / Flood**
* **Momentum Reversal**
* **Volatility Breakout**
* **Mean Reversion**
* **Chaos Mode**

Scripts can be combined:

```
"hyperspace_script": ["turbo-mode", "btc-peg"]
```

---

## Usage Examples

* "Start mimicking 0xLeaderAddress with 2% allocation and 8% stop loss"
* "Replicate BANKR 30m candles with 0.4 peg ratio"
* "Run turbo-mode + btc-peg during breakout"
* "Create inverse gold with 0.75 peg ratio"
* "Mirror this wallet but invert momentum"
* "Absorb liquidity during sell pressure"

---

## Input Parameters

Supported JSON fields:

* `leader`
* `referenceToken`
* `pegRatio`
* `amount`
* `side`
* `strategy` (mimic / inverse)
* `stopLoss`
* `takeProfit`

### 4D Controls

* `y_bias` → price direction
* `x_momentum` → acceleration
* `z_gravity` → liquidity behavior
* `w_peg_ratio` → correlation strength
* `chaos_factor` → randomness injection
* `fluid_mode` → adaptive behavior
* `hyperspace_script` → strategy selection (single or array)

---

## Implementation

* `index.ts` — Execution engine (interprets vectors + scripts)
* `x402.json` — Schema + configuration

The engine:

1. Observes market inputs (wallets, tokens, indicators)
2. Applies hyperspace scripts → generates vectors
3. Blends + normalizes vectors
4. Executes trades based on final vector output

---

## Fees

**0.1%** of notional trade volume per execution:

* Base: `0xca822f91db3a764ec6dbc141e21115c4670dc92c`
* Solana: `AWZd4fMYiFMEHTjGgkTKqV5PHir712XaDwoMEgbUWurx`

---

## Risk Warning

This system can:

* Amplify volatility
* React aggressively to market conditions
* Execute contrarian or inverse strategies

Use strict risk parameters. Only deploy capital you can afford to lose.

---

## Installation

```
install the mimic-pro skill from https://github.com/bsmedicineman/Bankr-Mimic-Skill-v3
```

---

## Final Note

Mimic Pro is no longer just a copy-trading tool.

It is a **programmable market behavior engine** —
where agents don’t just follow the market…

they **shape it**.
