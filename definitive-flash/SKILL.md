---
name: definitive-flash
description: Place, list, and cancel limit, stop-loss, and take-profit orders on Base via the Definitive Flash API. Designed for EIP-7702 smart wallets with ZeroDev Kernel v3.3 delegation — handles the Kernel signature wrapping that isValidSignature requires.
tags: ["defi", "trading", "base", "orders", "stop-loss", "limit", "definitive"]
version: 1
visibility: public
metadata:
  {
    "clawdbot":
      {
        "emoji": "📈",
        "homepage": "https://definitive.fi",
        "requires": { "bins": ["bankr", "python3"] },
      },
  }
---

# Definitive Flash

Place programmatic limit, stop-loss, and take-profit orders on Base via the [Definitive Flash API](https://definitive.fi). Orders execute when the on-chain price hits the trigger — no keeper required on your end.

## Credentials

Two keys are required:

| Key | Purpose | How to get |
|-----|---------|------------|
| `DEFINITIVE_API_KEY` | Authenticate API requests (`dpka_*` prefix) | https://app.definitive.fi → Settings → API Keys |
| `BANKR_API_KEY` | Sign order typed data via `bankr wallet sign` | Your Bankr API key (unrestricted scope) |

Set both as environment variables before running scripts:
```bash
export DEFINITIVE_API_KEY="dpka_..."
export BANKR_API_KEY="bk_usr_..."
```

## Wallet Requirement

Your Bankr wallet must be the `funderAddress` that holds the tokens to sell. For **EIP-7702 wallets with ZeroDev Kernel v3.3 delegation** (the standard Bankr smart wallet on Base), all signatures must be Kernel-wrapped — see `references/kernel-signing.md` for why, and how the scripts handle it automatically.

## Place a Stop-Loss or Take-Profit

```bash
python3 scripts/place_order.py \
  --wallet   0xYOUR_WALLET \
  --token    0xTOKEN_ADDRESS \
  --qty      1000000 \
  --type     stop-loss \
  --price    0.00025 \
  --symbol   TOKEN
```

| Flag | Description |
|------|-------------|
| `--wallet` | Your Bankr wallet address (funderAddress) |
| `--token` | Token contract address on Base |
| `--qty` | Token quantity to sell (decimal units, e.g. `1000000` for 1M tokens) |
| `--type` | `stop-loss` (sell when price drops to trigger) or `take-profit` (sell when price rises to trigger) |
| `--price` | Trigger price in USD per token |
| `--symbol` | Human-readable ticker (for logging only) |

**Token precision note:** Pass the token amount with at most 6 decimal places (e.g. `1234567.891234`). Definitive's float→wei conversion can exceed your on-chain balance if you use more precision than what's held.

On success the script prints the `orderId` and exits 0.

## List Active Orders

```bash
python3 scripts/list_orders.py --wallet 0xYOUR_WALLET
```

Prints all `PENDING`, `ACCEPTED`, and `PARTIALLY_FILLED` orders grouped by token.

## Cancel an Order

```bash
python3 scripts/cancel_order.py \
  --wallet  0xYOUR_WALLET \
  --orderid 12345678-abcd-...
```

Cancel uses the same Kernel-wrapped signing as placement. Without the wrapper the cancel endpoint returns `404 NOT_FOUND` (Definitive hides the order when auth fails).

## Order Types

| `--type` | Trigger | Use case |
|----------|---------|----------|
| `stop-loss` | Price drops **to or below** `--price` | Protect against downside |
| `take-profit` | Price rises **to or above** `--price` | Lock in upside at a target |

For a full position exit strategy: place one `stop-loss` for the full quantity, and multiple `take-profit` orders for portions of the position (40% at 1.2x, 35% at 1.5x, 25% at 2x, etc.).

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| HTTP 403 signature verification failed | Wrong signature format for Kernel wallet | Ensure you're using the Kernel-wrapped typed data path (scripts handle this automatically) |
| HTTP 422 insufficient source asset balance | Token qty exceeds on-chain balance due to float precision | Floor qty to 6 decimal places before passing |
| HTTP 422 flash order cap exceeded (100/100) | Too many open orders + quote attempts | Cancel unused orders; wait for the rolling quota to decay before retrying |
| HTTP 404 on cancel | Kernel-wrapped signature not used for cancel | Use `cancel_order.py` which wraps the personal_sign hash correctly |

## References

- `references/kernel-signing.md` — Deep-dive on why Kernel v3.3 requires wrapped signatures and how the wrapping works
- `references/api.md` — Raw Definitive Flash API endpoint reference
