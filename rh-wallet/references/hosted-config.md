# Hosted gateway (public)

Pinned in `known-gateway.json`. Intentionally public — not Robinhood credentials.

| Setting | Value |
|---------|--------|
| Gateway URL | `https://rh-wallet-production.up.railway.app` |
| Gateway secret | `uniqueissomethingimtesting` |

Skill `rh()` defaults both if Bankr env vars unset.

Users **must** still supply their own `RH_API_KEY` + `RH_PRIVATE_KEY_BASE64`.

Source / self-host: https://github.com/anondevv69/RH-Wallet
