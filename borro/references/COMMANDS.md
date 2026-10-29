# Commands, and what Borro answers

Run from `borro/scripts`: `node borro.mjs <command> [--flag value ...]`. Every command prints one JSON object. `ok: false`
always carries `code` and `error`; relay `error` and stop.

The shapes below were checked against the live server on 2026-10-23 (MCP protocol 2025-06-18, server `borro` 1.0.0,
44 tools). Borro's own OpenAPI document (`https://borro.markets/openapi.json`) and `tools/list` are the reference; fields
are only ever added.

## Reads

| Command | Source | What comes back |
| --- | --- | --- |
| `read markets` | `/markets.json` (cached 30 s) | `stocks[]`: `symbol`, `price_usd`, `lend` (`apr`, `text`, `includes_borro`, `lent`, `borrowed`, `free_to_short`, `vault_cap`), `short` (`yearly`, `text`, `open_fee` 0.001, `closed_for_you_past` the LLTV), `borrow_usdg`, `contracts` (`token`, `vault`, `market_id`); `usdg` (the USDG vault); `drip` ($BORRO a day, `your_apr_on_1000_usd`, `note`); `market_clock` |
| `read market --symbol NVDA` | MCP `market` | One stock's line, the same fields plus Morpho market params |
| `read position --wallet W` | MCP `position` | `wallet_balances` (`eth`, `usdg`), `stocks` lent, `usdg_lent`, shorts, `borro` (`in_wallet`, `to_claim_now`), `rebates` |
| `read health --wallet W` | `/health/<wallet>.json` | `positions[]` worst first: `kind` (short or loan), `owed_stock`, `collateral_usdg`, `limit_used` (1 = liquidatable), `liquidation_price_usd`, `price_move_to_liquidation_pct`, `status` (ok, warn, danger, liquidatable) |
| `read prices` | `/prices.json` | Each token's buy and sell price on chain against the stock's own price |
| `read credit_markets` | `/credit.json` | `markets[]`: `symbol` (CREDIT, rCREDIT), `new_lines_open`, `price_usdg`, `borrow_apr_text`, `lltv`, `max_target_and_trigger_ltv`, `defaults`, `lending_cap`, `paused`, `write_off` |
| `read credit_line --account LINE` or `--owner W` | MCP `credit_line` | One line, or a wallet's lines five a call: `market`, `owner`, `agent`, `keeper`, `credits`, `debt_usdg`, `ltv`, `health`, `limits`, `today` (`out_usdg`, `left_usdg`), `can_borrow_usdg`, `liquidation_price_usdg` |
| `read bookrunners` | `/builders.json` | The Bookrunners statement: every registered code, its payee, what it brought and was paid |
| `read rules` | MCP `rules` | House rules, limits, what can go wrong, every contract address |

Prefer the cached feeds (`markets`, `health`, `credit_markets`, `prices`) for anything repeated: they cost Borro no
chain reads. Never poll faster than once a minute.

Rates: `text` is the one number to show. Before the first $BORRO payout `includes_borro` is false and `rates_note` says
so; the Drip is shown apart under `drip`. Say "today's rate"; it moves with demand and with the $BORRO price.

## Plans (unsigned transactions)

`plan <tool>` calls the MCP tool of that name, checks the answer (references/TX-VALIDATION.md) and returns:

```json
{
  "ok": true, "status": "ready", "action": "open_short", "chainId": 4663, "wallet": "0x...",
  "quote": { "sale_usdg": "...", "deposit_usdg": "100", "deposit_at_least_usdg": 0.14, "held_usdg": 0.41,
             "closed_for_you_at_price": 257.67, "expires_at": "2026-10-23T15:31:07.000Z" },
  "simulated": { "by": "Borro's MCP, eth_simulateV1 from the wallet", "ok": true },
  "summary": ["Approve 0xd2D6... to take exactly what this needs", "Short 0.001 NVDA: borrow it, sell it, hold the money"],
  "transactions": [ { "step": 1, "kind": "approve", "to": "0x5fc5...", "data": "0x095ea7b3...424f52524f4d4350", "value": "0", "chainId": 4663 } ],
  "bankr_submit": [ { "transaction": { "to": "...", "data": "...", "value": "0", "chainId": 4663, "gas": "100000" }, "description": "...", "waitForConfirmation": true } ]
}
```

Approvals come first and only when missing, always for the exact amount. Every MCP-built call ends with Borro's 8-byte
agent tag `424f52524f4d4350` ("BORROMCP"); Solidity ignores bytes past a function's arguments, so it changes nothing.

| Command | Flags | Notes |
| --- | --- | --- |
| `plan supply` | `--wallet --asset (USDG or a stock) --amount` | Approve the vault, then `deposit(assets, wallet)`. The amount is cut to what the wallet holds; `facts.amount` says what is lent. A wallet holding none is refused: "the wallet holds no NVDA". |
| `plan withdraw` | `--wallet --asset --amount` or `--all` | `withdraw(assets, wallet, wallet)`, or `redeem(all shares, wallet, wallet)` with `--all` |
| `plan open_short` | `--wallet --symbol --amount [--deposit USDG]` | Approve USDG to BorroShort, then `open`. Without enough deposit the simulation fails with "insufficient collateral" and `quote.deposit_at_least_usdg` gives the least deposit that works. 0.10% open fee. |
| `plan close_short` | `--wallet --symbol` | Buys back what is owed, returns it, pays out the money held; a USDG top-up approval first if the short is under water. Closes every part of that stock's short (`closes_parts`). "this wallet has no TSLA short open" if none. |
| `plan credit_open` | `--wallet (owner) --agent --credits [--market CREDIT or rCREDIT] [--borrow] [--to] [--ceiling] [--daily_limit] [--target_ltv] [--trigger_ltv] [--allow a,b] [--gas_station true]`; with `--account LINE`: post more credits and/or borrow | references/CREDIT-LINES.md |
| `plan credit_pay` | `--wallet (agent or owner) --account --to --amount` | One borrow from the line straight to an allowlisted payee or the owner |
| `plan credit_repay` | `--wallet --account --amount (or all) [--close]` | Exact USDG approval to the line, then repay; `--close` (owner) repays everything and takes every credit back |

## Bookrunners

| Command | What it does |
| --- | --- |
| `code bankr` | `registered`, `payee`, `pinned_payee` and `use` (true only when the payee is the pinned one), from `/builders.json`, else from the chain through the MCP's `bind_builder` (no signature, nothing stored; payee unknown, so `use: false`) |
| `lend --wallet --asset --amount --code bankr [--preview-shares N]` | references/BOOKRUNNERS.md |
| `bind --wallet --code bankr` | EIP-712 typed data to credit the wallet's borrowing to the code, plus the `/wallet/sign` body. Then `bind --wallet --code bankr --signature 0x... --timestamp T` submits it within 10 minutes. |

## Other

- `validate <saved answer.json> --action <tool> --wallet W [the tool's arguments]`: the same checks as `plan`, for an
  answer the agent got from a connected Borro MCP server. Accepts the raw JSON-RPC answer, `structuredContent`, or the
  tool's JSON.
- `selftest`: offline; checks the pins and that the encoders match ethers v6 byte for byte.
- `pins`: prints known-contracts.json.

## Errors the script returns

| `code` | Meaning | What to do |
| --- | --- | --- |
| `BORRO_REFUSED` | Borro refused in words (no balance, no short open, a line rule) | Tell the user the sentence |
| `SIMULATION_FAILED` | Borro (or the user's RPC) ran it from the wallet and it would fail | Tell the user why; for a short, offer `deposit_at_least_usdg` |
| `NOT_FROM_BORRO`, `UNEXPECTED_*`, `UNLIMITED_APPROVAL`, `WRONG_CHAIN`, `WRONG_WALLET` | The answer does not match the pins | Stop. Do not edit or resend. Tell the user nothing was sent |
| `CODE_NOT_REGISTERED`, `VAULT_NOT_LISTED` | The bookrunner path cannot be used | Lend with `plan supply` |
| `NEED_PREVIEW` | `lend` needs `previewDeposit` | Make the read in `read.bankr_prompt` through Bankr, pass `--preview-shares` |
| `MCP_UNAVAILABLE` | Borro's server answered 5xx three times | Wait a minute and try again; nothing was sent |
| `NOT_IN_SKILL` | A Borro action this skill does not send | Point the user to https://borro.markets |
