---
name: hyperliquid
description: >
  Trade and inspect Hyperliquid through the `hyperliquid` CLI: discover perps,
  spot pairs, HIP-3 dex markets, and outcome markets, read account state, then
  plan, dry-run, and execute orders, transfers, staking, vaults, and
  borrow/lend actions with structured JSON. Use when the user mentions
  Hyperliquid, HYPE, HIP-3 dexes, perp or spot orders, funding rates, open
  interest, staking, vaults, builder fees, or asks you to size, place, cancel,
  or review a Hyperliquid trade, or to check a Hyperliquid account or balance.
tags: [hyperliquid, trading, perps, spot, dex, defi, orders, cli, agents, testnet]
version: 1
visibility: public
metadata:
  homepage: https://github.com/hypurr-inc/hyperliquid-cli
  install: external
---

# Hyperliquid

`hyperliquid` is one binary that speaks the whole Hyperliquid surface — markets,
orders, positions, transfers, staking, vaults, borrow/lend, builder fees,
subaccounts, and WebSocket streams — and it is built for agents: JSON by default
when stdout is not a terminal, a schema for every command, dry-runs that never
prompt, bounded streams, and structured errors with exit codes.

Your job is to use it correctly: read before you mutate, preview before you
sign, and surface the full side effect to the user before you add `--yes`.

## Install

```bash
# Binary (Linux/macOS, SHA-256 verified): installs to ~/.local/bin
curl -fsSLO https://raw.githubusercontent.com/hypurr-inc/hyperliquid-cli/main/install.sh
sh install.sh

# Or from source
cargo install --path . --bin hyperliquid
```

Verify the install:

```bash
hyperliquid --version
hyperliquid --format json status
```

## Pick a signer before trading

Signing is explicit. Pick one source and check it with `wallet show` before any
mutation. Precedence: `--bankr` > `--ows-signer` > `--private-key` / keystore >
`--account` > the default wallet.

| Signer | Set up | Use |
| --- | --- | --- |
| OWS vault (recommended) | `hyperliquid wallet create` or `hyperliquid wallet import` (hidden prompt) | default; `--ows-signer <name>` picks another |
| Bankr hosted wallet | `hyperliquid wallet login` (paste a `bk_...` key) | `hyperliquid --bankr <command>` |
| Local key (automation only) | `HYPERLIQUID_PRIVATE_KEY` env, or `--keystore` | never as an argv secret in machine runs |
| Read-only / preview | no signer needed | `--dry-run`, market data, account reads |

```bash
hyperliquid --format json wallet show     # which signer signs, and its address
hyperliquid --format json wallet address  # just the address
```

### Bankr hosted wallet

`--bankr` signs through Bankr's API, which holds the key. It covers trading
actions — orders, cancels, modifies, leverage, margin, trailing stops, TWAP,
vault and subaccount actions — and spot↔perp USDC moves:

```bash
hyperliquid --bankr --dry-run orders create --coin BTC --side buy --price 96000 --size 0.01
hyperliquid --bankr transfer spot-to-perp --amount 250 --yes
```

Withdrawals, spot/asset sends to another address, staking, agent or builder
approvals, and multisig need a user-signed payload Bankr does not cover: those
exit `13` before any request is sent. Use the OWS vault or a local key for them.
`hyperliquid wallet logout` forgets a stored login; `BANKR_API_KEY` works
without logging in.

## The loop

1. **Discover** the market and its precision.
2. **Read** the account you are about to change.
3. **Plan** with `schema` and `--dry-run`; no prompt, no side effect.
4. **Execute** only after the user approves that exact plan.
5. **Verify** with a read; a mutation whose result is unknown is not a success.

```bash
hyperliquid --format json perps list                 # markets, mark px, funding
hyperliquid --format json spot list
hyperliquid --format json asset search purr          # perp, spot, HIP-3, outcome lookup
hyperliquid --format json search purr                # the same across every market type
hyperliquid --format json book BTC --depth 5         # best bid/ask for sizing
hyperliquid --format json schema orders create       # flags, types, requirements

hyperliquid --format json account portfolio
hyperliquid --format json positions list
hyperliquid --format json orders open
hyperliquid --format json account fills --start 2026-01-01
```

## Mutations: preview, then execute

Every mutating command has a dry-run that returns the resolved asset id, size
precision, builder fee, network, signer and the exact wire action. Dry-runs never
prompt, so they are always safe in an agent loop.

```bash
# 1. Preview (no side effect)
hyperliquid --format json --dry-run orders create \
  --coin BTC --side buy --price 96000 --size 0.01

# 2. Show the user the coin, side, size, price, fee and account, then get approval

# 3. Execute with the same arguments plus --yes
hyperliquid --format json orders create \
  --coin BTC --side buy --price 96000 --size 0.01 --yes
```

Rules that keep you out of trouble:

- **Never** add `--yes` on your own initiative, and never invent a size or price
  the user did not give you.
- A run without a terminal (CI, `HYPERLIQUID_AGENT=1`, JSON output,
  `--non-interactive`, `--payload-file -`) cannot prompt; it fails with exit `2`
  and names the missing flag instead of hanging.
- Prefer limit orders for anything reviewable; market orders take the configured
  slippage bound and print it.
- `orders cancel <OID>` takes no `--yes`; `orders cancel-all` does.
- Rehearse on testnet before a live first run:

```bash
hyperliquid --testnet --format json orders create --coin BTC --side buy --price 1 --size 0.001 --yes
```

## Command map

| Need | Command |
| --- | --- |
| Markets | `perps list`, `perps get <COIN>`, `spot list`, `spot get <PAIR>`, `meta`, `outcomes list`, `outcomes get <NOTATION>` |
| Prices | `mids`, `book <COIN> --depth N`, `candles <COIN> --interval 1h --limit 24`, `spread <COIN>`, `funding <COIN>` |
| Account | `account portfolio`, `account portfolio-history`, `account fills`, `account orders`, `account ledger`, `account funding`, `account fees`, `account rate-limit`, `account subaccounts`, `account twap-history` |
| Positions | `positions list`, `positions update-leverage --coin BTC --leverage 5 [--isolated]`, `positions update-margin` |
| Orders | `orders create`, `orders bracket`, `orders scale`, `orders chase`, `orders trailing-stop`, `orders tpsl`, `orders twap-create`, `orders twap-cancel`, `orders batch-create`, `orders modify`, `orders schedule-cancel`, `orders cancel <OID>`, `orders cancel-all`, `orders open`, `orders status --user 0x...`, `orders history` |
| Shortcuts | `buy`, `sell`, `outcome-buy`, `outcome-sell` |
| Funds | `transfer spot-to-perp`, `transfer perp-to-spot`, `transfer send`, `transfer spot-send`, `transfer send-asset`, `transfer withdraw` |
| Yield | `staking summary\|validators\|delegate\|undelegate\|claim-rewards`, `vault list\|get\|deposit\|withdraw`, `borrowlend rates\|supply\|withdraw` |
| Wiring | `builder approve`, `referral set`, `subaccount create\|transfer`, `api-wallet create\|list\|revoke` |
| Agents | `schema [COMMAND]`, `mcp`, `subscribe <stream>`, `watch risk`, `status`, `update` |

`hyperliquid schema <command>` prints arguments, types, defaults, auth
requirements, risk class, dry-run support, and the confirmation rule. Ask it
instead of guessing a flag.

HIP-3 dex markets are addressed as `<dex>:<coin>` (for example `xyz:GOLD`) or
with `--dex <name>` on the perp commands.

## Output and errors

- Default format is `pretty` for a person at a terminal and `json` otherwise.
  Force it with `--format json`, `--json`, or `HYPERLIQUID_AGENT=1`.
- `--select coin,price` projects JSON fields; `--results-only` drops the
  envelope; `--max-results N` bounds a list.
- Errors are structured: `{error, category, exit_code, reason, retryable, next,
  data}`. Read `next` — it names the recovery command.

| Exit | Meaning | What to do |
| --- | --- | --- |
| `2` | usage / configuration / missing input | fix the flag named in the error |
| `10` | auth required or bad credentials | `wallet show`, `wallet login`, or `setup` |
| `11` | rate limited | honor `retry_after`, back off |
| `12` | network/API failure, or `unknown_outcome` | reads: retry; mutations: check `orders open` and `account fills`, never blind-retry |
| `13` | unsupported input, asset not found, confirmation required | dry-run, fix the parameter, or ask for approval |
| `15` | partial batch results | read every leg; do not assume success |

## Streams

```bash
hyperliquid subscribe all-mids --max-events 5
hyperliquid subscribe trades BTC --max-events 10
hyperliquid subscribe orderbook BTC --max-events 10
hyperliquid subscribe candles BTC --interval 1m --max-events 5
hyperliquid watch risk --user 0x... --max-events 5
```

Streams are bounded with `--max-events` (plus `--idle-timeout-ms` on
`watch risk`); without a bound they run until interrupted. Never attach an
unbounded stream to a step that is supposed to finish.

## Reference

`references/commands.md` holds the compact flag sheet: order types, trigger
semantics, amount-vs-size units, ladder and TWAP flags, and the validation errors
you will hit.
