# Setup — RH Wallet + Bankr (stateless)

**Hosted gateway:** see [hosted-config.md](hosted-config.md) and `known-gateway.json`.

## 1. Create Robinhood API credentials

From [RH-Wallet repo](https://github.com/anondevv69/RH-Wallet):

```bash
pip install pynacl   # or: python3 -m pip install --user pynacl
python3 scripts/generate_rh_keypair.py
```

1. Register the **public** key in Robinhood crypto settings (web classic)
2. Copy the **API key** (`rh-api-...`) from the **same** session
3. Keep the **private** key for Bankr env only — **never chat or X**

**Signature errors?** API key and private key must be a matched pair.

## 2. Bankr Agent tool environment

**Gear → Agent tool environment** (not x402):

| Variable | Required? | Value |
|----------|-----------|--------|
| `RH_API_KEY` | **Yes** | Your `rh-api-...` |
| `RH_PRIVATE_KEY_BASE64` | **Yes** | Your private key |
| `RH_GATEWAY_SECRET` | No | Default in [hosted-config.md](hosted-config.md) |
| `RH_WALLET_API_URL` | No | Default in [hosted-config.md](hosted-config.md) |
| `RH_MAX_ORDER_USD` | No | e.g. `25` (≤ host $50) |
| `RH_REQUIRE_CONFIRMATION` | No | `true` |

## 3. Install skill

```text
install the rh-wallet skill from https://github.com/BankrBot/skills/tree/main/rh-wallet
```

## 4. Test

- “What's my Robinhood Crypto buying power?”
- “Robinhood price of BTC-USD”

## Self-hosting (optional)

Override `RH_WALLET_API_URL` only if host is allowlisted in `known-gateway.json`. See [RH-Wallet RAILWAY.md](https://github.com/anondevv69/RH-Wallet/blob/main/RAILWAY.md).
