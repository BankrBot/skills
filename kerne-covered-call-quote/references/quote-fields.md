# Fields in the Kerne quote response

`GET https://kerne-stock-quote.r4woutreach.workers.dev/api/quote` returns one JSON object.
Everything outside `_meta` is the signed document. `_meta` is unsigned and computed when you read.

## Signature fields

| Field | Meaning |
| --- | --- |
| `signed_payload_canonical` | The exact string that was signed: JSON with sorted keys and no spaces. |
| `attestation_hash` | SHA-256 of that string. |
| `signature` | EIP-191 signature over the 32 hash bytes. |
| `signer` | Must be `0x9653Bf177239C979921DC8C0639eD00409F4Db88`. |
| `onchain_quote.message` | The compact quote a contract could check: vault, feed, roundId, spot, strike, premiumBps, saleWindow, expiry, validUntil. |
| `onchain_quote.signature` | EIP-712 signature over that message (domain `KerneStockQuote`, version `1`, chain 8453). |
| `previous_attestation_hash`, `sequence` | Hash chain to the record before this one. |

## Status

| `status` | Meaning |
| --- | --- |
| `QUOTE_OK` | A quote was priced. `quote` and `onchain_quote` are present. |
| `NO_QUOTE_FEED_STALE` | The feed's last price is older than the vault accepts. Normal on weekends. |
| `NO_QUOTE_INSUFFICIENT_HISTORY` | Too few feed rounds in the 14 day window. |
| `NO_QUOTE_OUT_OF_VAULT_BOUNDS` | The tenor or premium falls outside what the vault accepts. |
| `NO_QUOTE_BAD_FEED_DATA` | The feed returned a non-positive answer. |
| `NO_QUOTE_READ_FAILED` | No public Base RPC answered that cycle. |
| `NO_QUOTE_INTERNAL_ERROR` | The cycle hit an unexpected error. `status_reason` says what. |

For every status other than `QUOTE_OK`, `quote` and `onchain_quote` are `null`.

## Quote

| Field | Meaning |
| --- | --- |
| `spot.price` | Chainlink "Coinbase TSLA" price in dollars (8 decimals in `price_raw`). |
| `spot.age_seconds` | How old the feed price was when the quote was signed. |
| `quote.strike` | Strike in dollars. `quote.strike_otm_bps` is its distance above spot. |
| `quote.premium_bps` | Premium in basis points of the position, paid in the stock. |
| `quote.premium_per_1_stock` | The same premium as a fraction of one share. |
| `quote.expiry_time` | When the option expires (a Friday 16:00 UTC). |
| `quote.valid_until_time` | When this quote stops being valid (15 minutes after its block). |
| `quote.sellable_now` | Whether the feed price is fresh enough for the vault to sell at that moment. |
| `quote.priced_vol_pct` | The volatility used for pricing (1.10 times realized, clamped to 20% and 200%). |
| `realized_vol.annualized_vol_pct` | 14 day realized volatility. `realized_vol.returns` is the sample count. |

## Vault

| Field | Meaning |
| --- | --- |
| `market.vault` | `0xc6180E9af7Cb4c6D47A230a6c5047fA615Bd0956` on Base. |
| `market.stock_token` | The TSLAc token, `0xb2000000000000000000001e800a7f5189430cD0`. |
| `vault_bounds.deposit_cap_raw` | `"0"` means the vault is closed to deposits. |
| `vault_bounds.total_assets_raw` | Stock held by the vault. |
| `vault_bounds.current_epoch`, `epoch_live` | `0` and `false` mean no epoch has ever opened. |
| `vault_bounds.open_blockers` | Why an epoch could not open right now. |

## Unsigned read-time metadata (`_meta`)

| Field | Meaning |
| --- | --- |
| `_meta.verified` | With `?verify=1`: the server recovered both signatures and they match the expected signer. |
| `_meta.age_seconds`, `_meta.is_fresh` | Age of the record. Fresh means under 45 minutes. |
| `_meta.quote_expired` | Whether `valid_until` has passed. |

Other endpoints on the same host: `/api/signer` (the signer record), `/api/quote/history?limit=24`
(recent signed records, newest first), `/healthz`, `/verify.py` (independent verifier).
