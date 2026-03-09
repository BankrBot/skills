---
name: varrd
description: Statistical edge discovery engine — test any trading idea with real market data. Use when the user wants to validate a trading hypothesis, find edges, scan live signals, or generate trade setups.
version: 1.0.0
tools: ["Bash"]
homepage: https://varrd.com
metadata: {"openclaw": {"requires": {"bins": ["varrd"]}, "emoji": "📊"}}
---

# VARRD — Statistical Edge Discovery

Turn any trading idea into a statistically validated trade setup.

## Install



## What It Does

VARRD is a quant-in-a-box. You bring a trading idea in plain English, VARRD loads real market data, charts the pattern, runs rigorous statistical tests, and tells you definitively whether there’s an edge — with exact entry, stop-loss, and take-profit prices.

## Commands



## Statistical Guardrails

Every test enforces institutional-grade controls automatically:

- **K-tracking** — significance bar rises with each test
- **Bonferroni correction** — multiple comparison penalty
- **OOS lock** — out-of-sample is one-shot, no re-running
- **Fingerprint dedup** — can’t retest same formula/market/horizon
- **Lookahead detection** — catches formulas using future data

## Also Works As

- **Python SDK:** 
- **MCP server:**  (Claude Desktop, Cursor, OpenBB)
- **Trading bot integrations:**  and  generate ready-to-run strategy files

## Cost

 free on signup. ~/usr/bin/bash.25 per idea tested. Scan/search always free.
