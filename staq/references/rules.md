# Savings rules

A rule is what the user signed. It is stored as a new version each time, and the
signature is kept alongside it, so there is always an answer to "who asked for
this rate and when".

## Modes

| Mode | Example | Behaviour |
|---|---|---|
| Percent | "STAQ 10% of every buy, sell and send" | `value x rate`, rounded down |
| Fixed | "STAQ $1 on every trade" | The same amount regardless of trade size |

## Bounds

| | Minimum | Maximum |
|---|---|---|
| Percent | 0.01% (`1` bps) | 50% (`5000` bps) |
| Fixed | $0.01 | $1,000 |

Above **25%** (`2500` bps) you must take a second, explicit confirmation from
the user, echoing the exact rate, before signing. A misheard "fifty" for
"fifteen" costs them real money on every trade.

`types` is a non-empty subset of `buy`, `sell`, `send`.

A save below $0.01 is dust and is skipped rather than transferred.

## The signed message

Exact format. Line order matters, unknown lines are rejected, and a duplicated
field is rejected rather than last-one-wins.

```
STAQ rule update v1
Wallet: 0xYOURWALLET
Chain: 8453
Enabled: true
Mode: percent
Rate: 1000 bps
Types: buy,sell,send
Nonce: <64 hex chars from /v1/auth/nonce>
Issued: 2026-09-18T10:00:00.000Z
```

A fixed rule replaces the `Rate` line with an amount in micro-dollars, and
carrying both lines is rejected:

```
Mode: fixed
Amount: 1000000 usd-micros
```

`1000000 usd-micros` is $1.00. Micro-dollars are integers with six decimal
places, so money never passes through a float.

## Flow

```bash
# 1. Challenge
NONCE=$(curl -s -X POST "https://api.agentstaq.xyz/v1/auth/nonce" \
  -H 'content-type: application/json' \
  -d '{"wallet":"0xYOURWALLET"}' | jq -r .nonce)

# 2. Build the message above with that nonce, and the current UTC time.
# 3. Sign it with the user's wallet (personal_sign).
# 4. Submit.
curl -s -X PUT "https://api.agentstaq.xyz/v1/wallets/0xYOURWALLET/rule" \
  -H 'content-type: application/json' \
  -d '{"message":"...","signature":"0x..."}'
```

The response carries the new `version` and the user's `reserve` address.
**Record that reserve address.** Every later save is checked against it.

The nonce is spent in the same database transaction that writes the rule, so a
replayed message cannot produce a second version. A message older than five
minutes is refused.

## Pausing

A pause is a normal rule update with `Enabled: false`. It stops future
allocations and touches nothing else: existing savings stay in the reserve,
still earning, and the reserve address never changes. Re-enabling later is
another signed version.

Disabling STAQ does **not** claim. If the user wants their money back, that is a
separate, explicit claim.
