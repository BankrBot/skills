---
name: varrd
description: AI-powered trading research — validate any idea with real statistical testing. Use when the user wants to test a trading hypothesis, find edges, scan live signals, or generate trade setups.
version: 0.3.1
tools: ["Bash"]
homepage: https://varrd.com
metadata: {"openclaw": {"requires": {"bins": ["varrd"]}, "emoji": "📊"}}
---

# VARRD — Statistical Edge Discovery

Turn any trading idea into a statistically validated edge — or find out it doesn't work — in about 3 minutes.

## What it does

Ask a question in plain English:

- "Does buying BTC after a 5% weekly drop actually work?"
- "Is there a seasonal pattern in crude oil before OPEC meetings?"
- "When VIX spikes above 30, is there a bounce in ES futures?"

VARRD loads real market data, runs event studies with Bonferroni correction, tests across multiple markets, validates out-of-sample, and returns a proven trade setup with entries, exits, stops, and targets. Or tells you there's no edge — which is just as valuable.

## Autonomous edge discovery

Point it at any market and say "find me what works." It scans, tests, discards noise, and surfaces only what survives real statistical rigor. Then monitors your edges live and alerts you when setups are firing with fresh levels.

## Coverage

- **Futures (CME):** ES, NQ, CL, GC, SI, ZW, ZC, ZS + 20 more
- **Stocks/ETFs:** Any US equity (15,000+ instruments)
- **Crypto (Binance):** BTC, ETH, SOL + more

## Install

```bash
pip install varrd
```

The agent connects to VARRD's MCP server at `https://app.varrd.com/mcp`. $2 free credits on signup — enough for 6-8 research sessions.

## Commands

```bash
varrd research "When crude oil drops 5% in a week, what happens next?"
varrd discover "Find edges in gold futures"
varrd scan  # Scan all your validated edges against live data
varrd search "momentum"  # Search saved strategies
varrd hypothesis <id>  # Load a specific strategy
varrd balance  # Check remaining credits
```

Or use the Python SDK:

```python
from varrd import VARRD

v = VARRD()
result = v.research("Does buying SPY after a 3-day losing streak work?")
print(result.context.edge_verdict)  # "STRONG EDGE" or "NO EDGE"
```

## Bot integrations

VARRD generates ready-to-deploy strategy files for trading bots:

```python
from varrd.freqtrade import generate_strategy
from varrd.jesse import generate_strategy as jesse_strategy
```

Validate first, deploy second. Works with Freqtrade, Jesse, Hummingbot, OctoBot, and NautilusTrader.

## Guardrails (all infrastructure-enforced)

Every test runs through 18 categories of automated guardrails. You can't turn them off.

### Statistical rigor
| Guardrail | What it prevents |
|-----------|-----------------|
| K-Tracking | Multiple comparison abuse |
| Bonferroni Correction | P-hacking |
| OOS Lock | Re-running out-of-sample after seeing results |
| Fingerprint Dedup | Retesting the same thing twice |
| Lookahead Detection | Using future data in formulas |
| Similarity Detection | Testing near-duplicate hypotheses |

### Returns & risk
| Guardrail | What it prevents |
|-----------|-----------------|
| ATR-Normalized Returns | Cross-market comparisons on raw returns |
| Beats-Market Validation | Claiming edge when it doesn't beat buy-and-hold |
| Edge Decay Tracking | Trading edges that no longer hold on recent data |
| Max Drawdown Tracking | Ignoring worst-case equity decline |
| Sharpe & Sortino | Ignoring risk-adjusted performance |

### Execution & portfolio
| Guardrail | What it prevents |
|-----------|-----------------|
| SL/TP Optimization | Unoptimized or overfit stop-loss and take-profit levels |
| Slippage Modeling | Fantasy fills that ignore real market impact |
| Volatility-Based Sizing | Position sizes that ignore current volatility |
| Gap Handling | Unrealistic fill assumptions on price gaps |

### Workflow enforcement
| Guardrail | What it prevents |
|-----------|-----------------|
| State Machine | Skipping steps in the research process |
| Sandbox Guardrail | AI doing its own math instead of using tested tools |
| Tools Calculate, AI Interprets | Fabricated statistics or edge claims |

## Links

- **Web app:** [app.varrd.com](https://app.varrd.com)
- **GitHub:** [github.com/augiemazza/varrd](https://github.com/augiemazza/varrd)
- **PyPI:** [pypi.org/project/varrd](https://pypi.org/project/varrd/)
- **MCP endpoint:** `https://app.varrd.com/mcp`
