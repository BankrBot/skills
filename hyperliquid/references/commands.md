# Command and flag sheet

Every command below is verified against `hyperliquid --help`. `--format json` is
implied when stdout is not a terminal or `HYPERLIQUID_AGENT=1`; pass it
explicitly in scripts. `hyperliquid schema <command>` is the authoritative spec.

## Global flags

| Flag | Effect |
| --- | --- |
| `-f, --format pretty\|table\|json` | output shape; `--json` is a shortcut |
| `--select a,b` | keep only these JSON fields (aliases like `px`/`sz` work) |
| `--results-only` | strip the envelope, return only data |
| `--max-results N` | bound a list |
| `--dry-run` | preview a mutating command; never prompts, no side effect |
| `-y, --yes` | satisfy confirmation (only after a human approves) |
| `--testnet` | use the testnet API |
| `--non-interactive` | never prompt; fail with the missing input named |
| `--no-color`, `--no-update-check` | plain output; skip the release check |
| `--account <NAME\|ID\|ADDRESS>` | pick a stored signer |
| `--ows-signer <NAME\|ID\|ADDRESS>` | pick an OWS vault signer |
| `--bankr` | sign with the Bankr hosted wallet (requires `wallet login` or `BANKR_API_KEY`) |
| `--private-key`, `--keystore` | local signers (automation only) |
| `--payload-json`, `--payload-file` | raw wire body for a mutation (`-` reads stdin) |

## Market data

```bash
hyperliquid perps list
hyperliquid perps get BTC
hyperliquid spot list
hyperliquid spot get PURR/USDC
hyperliquid meta                                      # raw perp + asset contexts
hyperliquid mids [--select BTC,ETH]
hyperliquid book BTC
hyperliquid candles BTC --interval 1h --limit 24      # 1m 3m 5m 15m 30m 1h 2h 4h 8h 12h 1d 3d 1w 1M
hyperliquid spread BTC
hyperliquid funding BTC
hyperliquid outcomes list
hyperliquid outcomes get <NOTATION>
hyperliquid search <TEXT>                             # perps, HIP-3, spot, outcomes
hyperliquid asset search <TEXT|ID>
hyperliquid asset decode <ID>
```

## Account reads

```bash
hyperliquid account portfolio [ADDRESS]
hyperliquid account portfolio-history [ADDRESS]
hyperliquid account fills [--start RFC3339|ms] [--end ...] [--aggregate-by-time]
hyperliquid account orders [ADDRESS]
hyperliquid account ledger
hyperliquid account funding
hyperliquid account fees
hyperliquid account rate-limit
hyperliquid account subaccounts
hyperliquid account twap-history
hyperliquid account twap-fills
hyperliquid positions list
hyperliquid orders open
hyperliquid orders status --user 0x... [--oid <OID> | --cloid 0x...]
hyperliquid orders history
```

## Orders

`orders create` takes `--type limit|market|stop-loss|take-profit|stop-limit|take-limit`
and `--tif gtc|alo|ioc`.

```bash
# Limit and market
hyperliquid orders create --coin BTC --side buy --price 96000 --size 0.01
hyperliquid orders create --coin BTC --side sell --amount 100            # market, quote amount
hyperliquid orders create --coin BTC --side buy --size 0.01 --reduce-only --type market

# Triggers: market triggers take --trigger-price; *-limit triggers also need --price
hyperliquid orders create --coin BTC --side sell --size 0.01 \
  --type stop-loss --trigger-price 90000
hyperliquid orders create --coin BTC --side sell --size 0.01 \
  --type take-limit --trigger-price 90000 --price 89900

# Parent-attached TP/SL (children are reduce-only)
hyperliquid orders create --coin BTC --side buy --size 0.01 --price 96000 \
  --type limit --take-profit 102000 --stop-loss 94000 --grouping normal-tpsl
hyperliquid orders tpsl --coin BTC --take-profit 102000 --stop-loss 94000

# Protection, ladders, execution helpers
hyperliquid orders bracket --coin ETH --side buy --size 0.5 --entry limit --price 3000 \
  --take-profit +5% --stop-loss -2% --entry-timeout 300s
hyperliquid orders scale --coin BTC --side buy --start-price 94000 --end-price 96000 \
  --total-size 0.05 --orders 5 --tif gtc
hyperliquid orders trailing-stop --coin BTC --side sell --size 0.01 \
  --retracement-pct 1.5 [--activation-price 100000] [--reduce-only]
hyperliquid orders chase --coin BTC --side buy --size 0.01 \
  --offset 5 --timeout 300 --interval 2s --max-chase 10     # offset is basis points
hyperliquid orders twap-create --coin BTC --side buy --size 0.1 --duration 30m [--randomize]
hyperliquid orders twap-cancel --coin BTC <TWAP_ID>
hyperliquid orders batch-create --orders-file orders.json  # see tests/fixtures for the shape
hyperliquid orders modify <ORDER_ID> --price 95500 [--size 0.02] [--always-place]
hyperliquid orders modify --cloid 0x... --price 95500
hyperliquid orders cancel <OID>
hyperliquid orders cancel-all [--coin BTC] [--dex <DEX>] [--yes]
hyperliquid orders schedule-cancel [--time <ms>]          # cancel everything at a time
```

Units and rounding, all shown by the dry-run:

- `--size` is base-asset units; `--amount` is quote/collateral units and only for
  market entries.
- Prices and sizes round to the market tick and size precision.
- `--reduce-only` is perps-only; spot and outcome markets reject it before
  submission.
- `--max-slippage-bps` defaults to 500 (5%) on market orders.
- Builder fee and referral defaults from the config appear in the preview.

## Funds

```bash
hyperliquid transfer spot-to-perp --amount 250
hyperliquid transfer perp-to-spot --amount 250
hyperliquid transfer send --to 0x... --amount 25
hyperliquid transfer spot-send --to 0x... --token USDC --amount 10
hyperliquid transfer send-asset --to 0x... --asset <TOKEN> --amount 10
hyperliquid transfer withdraw --to 0x... --amount 100
```

Destinations must be literal `0x` addresses; stored aliases are not resolved for
transfers, so a typo cannot silently pay the wrong account.

## Yield and protocol

```bash
hyperliquid staking summary
hyperliquid staking validators
hyperliquid staking rewards
hyperliquid staking history
hyperliquid staking delegate --validator 0x... --amount 100
hyperliquid staking undelegate --validator 0x... --amount 100
hyperliquid staking deposit --amount 100
hyperliquid staking withdraw --amount 50
hyperliquid staking claim-rewards

hyperliquid vault list
hyperliquid vault search <TEXT>
hyperliquid vault get <VAULT_ADDRESS>
hyperliquid vault positions
hyperliquid vault deposit --vault <VAULT_ADDRESS> --amount 100
hyperliquid vault withdraw --vault <VAULT_ADDRESS> --amount 50

hyperliquid borrowlend rates
hyperliquid borrowlend get <TOKEN>
hyperliquid borrowlend user
hyperliquid borrowlend supply <TOKEN> --amount 100      # or --max
hyperliquid borrowlend withdraw <TOKEN> --amount 50     # or --max
```

## Wiring and agents

```bash
hyperliquid builder max-fee
hyperliquid builder approved
hyperliquid builder approve --builder 0x... --max-fee-rate 0.01%
hyperliquid referral status
hyperliquid referral set [--code CODE]
hyperliquid subaccount create --name desk
hyperliquid subaccount transfer --subaccount <ADDRESS> --amount 100
hyperliquid api-wallet create --name trading-agent [--expires-in 30d] [--generate]
hyperliquid api-wallet list [MASTER_ADDRESS]
hyperliquid api-wallet revoke --name trading-agent
hyperliquid positions update-leverage --coin BTC --leverage 5 [--isolated]
hyperliquid positions update-margin --coin BTC --amount 100 [--isolated]
hyperliquid schema orders create
hyperliquid mcp                                        # stdio MCP server, every command as a tool
hyperliquid subscribe all-mids --max-events 5
hyperliquid subscribe trades BTC --max-events 10
hyperliquid subscribe orderbook BTC --max-events 10
hyperliquid subscribe candles BTC --interval 1m --max-events 5
hyperliquid subscribe order-updates --max-events 5
hyperliquid subscribe fills --max-events 5
hyperliquid watch risk --user 0x... [--min-severity info|warning|critical] [--max-events 5]
hyperliquid status
hyperliquid setup [-y]
hyperliquid update [--dry-run]
hyperliquid feedback / hyperliquid report-incident
```

## Validation errors you will see

| Error | Meaning |
| --- | --- |
| `asset not found` (exit 13) | wrong symbol; the error carries one suggestion and `asset search` resolves it |
| size precision / tick (exit 2) | the dry-run shows the market precision; round the value |
| `--amount` with `--price` (exit 2) | amount is quote-denominated and only valid for market orders |
| trigger flag mismatch (exit 2) | market triggers take no `--price`; `*-limit` variants require it |
| `confirmation required` (exit 13) | a machine run needs `--yes` after approval, or `--dry-run` to preview |
| `unknown_outcome` (exit 12) | the mutation may have landed: read `orders open` and `account fills`, never resend |
