# Automation Reference

Limit, stop, DCA and TWAP orders, plus agent commands that run on a schedule or when a price trigger hits. Docs: https://docs.bankr.bot/agent/automations

## Types

| Type | What it does | Example prompt |
|------|--------------|----------------|
| Limit | Buy when the price drops to a target, sell when it rises to one | "Buy $100 of ETH if it drops to $3,000" |
| Stop | Sell when the price falls (stop loss) or buy when it rises (breakout); EVM stops can trail the price | "Stop loss: sell 50% of my BNKR if it drops 20%" |
| DCA | A fixed amount on a schedule | "DCA $100 into ETH every Monday for 12 weeks" |
| TWAP | A total amount split into equal chunks over a period | "TWAP: buy $2,000 of ETH over the next 24 hours" |
| Scheduled command | Any agent prompt on a schedule, or once when a price trigger hits | "Every day at 9am, check my portfolio" · "Alert me when BNKR pumps 20%" |

- A trigger is a percentage move from the current price or an exact price, and can watch a different asset than the one traded ("Sell my DEGEN if ETH drops 10%").
- A price-triggered command runs once and then completes. A scheduled command stops at its run count or expiry.
- Prefer the order types for plain buys and sells — "buy X every day" is a DCA, "buy X if it dips" is a limit order. Commands are for multi-step or conditional work (leverage, Polymarket, analysis, alerts). A command can place orders when it runs, but it can't create another scheduled command, launch tokens, send airdrops or copy-trade.

## Chains

| | EVM chains (default Base) | Solana |
|---|---|---|
| Limit, stop | Yes (trailing stops EVM only) | Yes, via Jupiter Trigger, with a 0.5% fee on fills |
| DCA, TWAP | Yes | No |
| Scheduled commands | Yes | Yes (price triggers can watch Solana tokens) |

## Limits

| | |
|---|---|
| Active orders per wallet | 50 limit/stop · 20 DCA + TWAP combined (paused orders count) |
| Scheduled commands | Bankr Club: 20 active (paused ones count). Without Club: one per Telegram or Farcaster direct-cast conversation. Creating one from the API, the terminal or a public post requires Club |
| Minimum interval | DCA 1 hour · TWAP 3 minutes · command 10 minutes |
| Max runs | DCA 100 · TWAP 1,000 · command 1,000 |
| Max runs per rolling 24h | DCA 24 · TWAP 480 · command 100 |
| Defaults | Limit/stop orders expire after 7 days (Solana too). DCA and TWAP default to 10 runs and expire after 30 days — state a duration or run count for longer schedules |
| Minimum size (the agent declines smaller) | DCA $10 a run · TWAP $300 total and at least 10 chunks · $10 for a command that trades |

The wallet must already hold the spend when an order is created: the full amount for a limit or stop order, one run for a DCA, the first chunk for a TWAP. Later runs can be funded by top-ups.

## Managing Automations

- "Show my automations" · "What limit orders do I have?" — lists open, running and paused automations, including each run's result
- "Cancel my ETH limit order" · "Cancel all my stop losses" — takes effect immediately; a run that is executing right now can't be cancelled
- To change an automation, cancel it and create a new one. Pausing, resuming and editing a command are done in the Bankr terminal ([bankr.bot/terminal](https://bankr.bot/terminal)).
- A scheduled command's results are kept in its run history (last 10 runs). One created in a Telegram or Farcaster DM also replies in that conversation; add "notify me on Telegram" to have results sent to your linked Telegram account.

## Creating Automations from the API

There is no REST endpoint for your wallet's automations. Send the same phrasing you'd type in the terminal through `/agent/prompt` (or `bankr agent prompt`):

```bash
curl -X POST "https://api.bankr.bot/agent/prompt" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "DCA $50 into ETH on Base every Monday"}'
```

```bash
bankr agent prompt "Show my automations"
bankr agent prompt "Cancel my ETH limit order"
```

**An API key can create automations on its own** — no web-terminal step is required first. The automation binds to the wallet behind the API key at creation, and every later run executes against that same wallet.

> **Creating an automation is not idempotent — never retry it blind.** The same prompt sent twice can leave two live schedules on the same wallet, so a duplicated DCA spends twice. If a create appears to fail, **list your automations first** (`bankr agent prompt "Show my automations"`) and only re-send if the automation genuinely isn't there.

The `/user/automation/*` REST endpoints you may see referenced are **Bankr Terminal session endpoints**, not part of the API-key surface — an `X-API-Key` request to them will not authenticate.

## Refusals

| Message / symptom | Cause |
|---|---|
| "Automations are only available for Bankr Club members" | A scheduled command created from the API, terminal or a public post without Club |
| "... Limit Reached" | An order or command cap above; cancel one first (paused ones count) |
| "Automations are not supported when trusted recipient restrictions are configured" | The API key carries a recipient allowlist; scheduled commands run unattended and can't be checked against it. Orders are unaffected |
| "The minimum allowed schedule interval is N minutes" | Schedule faster than the minimum interval |
| "You don't hold enough [token] to place this order" | The creation-time balance check above |
| Automated orders for a connected (external) wallet | Set up from the Bankr terminal's Trade page; the agent places orders for the Bankr wallet only |
| Selling a Base launch token you earn creator fees on | Can be refused for limit/stop/DCA/TWAP; exit through Glidepath on the token page instead |
