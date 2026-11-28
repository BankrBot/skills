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

A save below $0.01 is dust and is skipped rather than saved.

## The signed message

Exact format. Line order matters, unknown lines are rejected, and a duplicated
field is rejected rather than last-one-wins.

```
STAQ rule update v2
Wallet: 0xYOURWALLET
Chain: 8453
Enabled: true
Mode: percent
Rate: 1000 bps
Types: buy,sell,send
Split: morpho=10000,stocks=0
Nonce: <64 hex chars from /v1/auth/nonce>
Issued: 2026-09-18T10:00:00.000Z
```

`/v1/auth/nonce` returns this message filled in as `template`, starting from the
user's current rule. **Never sign the template as it came.** Build every line
yourself:

- `Nonce` and `Issued` are the only lines you take from the template.
- `Wallet` is the user's wallet and `Chain` is `8453`.
- Every other line comes from the rule you hold in `/.staq/rule.json`, with
  only the change the user asked for.
- Then compare. Before the user's change, your lines must match the template's
  line for line. If one differs, the rule was changed somewhere you did not
  see: sign nothing until you have settled it with "When your copy of the rule
  is out of date" in `SKILL.md`, then build again.
- With no rule yet there is nothing to compare: build from the user's choices,
  with `Types: buy,sell,send` and `Split: morpho=10000,stocks=0` unless they
  chose otherwise.

The template is a cross-check, never a source. Signed as it came, a template
that widened the rate, the types or the stocks share would change the rule
without the user asking.

**`Split` is how much of each save goes into stocks**, in basis points of the
save: `morpho=` the USDC part, `stocks=` the stocks part. The two must add up
to `10000`. `morpho=10000,stocks=0` is all USDC, the default; "half in stocks"
is `morpho=5000,stocks=5000`. It splits the save, not the trade: the rate still
decides how much is saved. A stocks share is only ever set because the user
asked for stocks, after the offer in `SKILL.md`, "Buying stocks".

A `STAQ rule update v1` message, which has no `Split` line, is still accepted,
and means all USDC.

A fixed rule replaces the `Rate` line with an amount in micro-dollars, and
carrying both lines is rejected:

```
Mode: fixed
Amount: 1000000 usd-micros
```

`1000000 usd-micros` is $1.00. Micro-dollars are integers with six decimal
places, so money never passes through a float.

## Flow

**On a first enable, sign the rule first, then run the one-time setup.** The
rule moves no money: every quote for a reserve with no code is a skip, so a
rule with no contract behind it saves nothing. After the rule, derive the
reserve (below) and `eth_getCode` it. If it is empty, run the setup in
`claiming.md`, then read `owner()`. If the setup does not complete, saving has
not started: tell the user, and nothing is saved until it does.

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

The response carries the new `version` and a `reserve` address.

**Do not record that address as the reserve.** Derive the reserve from the pinned
hub on chain and record *that*, then treat the response's field as one more thing
to check against it. Storing what the API sent and comparing later saves to it
means comparing the API against itself, which agrees with a wrong address instead
of catching it.

```bash
# reserveOf(address) on the pinned hub. Selector 0x9fa77b20.
WALLET=ee478415cc7a4576E6E03150223044127Eb4D6B2   # no 0x prefix
curl -s -X POST https://mainnet.base.org \
  -H 'content-type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_call\",\"params\":[{
        \"to\":\"0xBAd52264820F196258728ddBd2B6eE9076042b5A\",
        \"data\":\"0x9fa77b20000000000000000000000000$WALLET\"},\"latest\"]}"
```

Take the last 40 hex characters of the result. Persist it in
**`/.staq/reserve.json`** on the wallet's permanent filesystem, together with the
wallet, the chain id, the hub address it came from, and the `owner()` you read
once it had code, so a later save can tell whose reserve it is and that it is
ready to receive. Compare case-insensitively.

Also persist **the rule itself** in **`/.staq/rule.json`**: the exact message
text, the signature, the version, and the terms. Every later quote is checked
against it. The API is not the record of what the user agreed to; the signed
message is, and you are the one holding it. Keeping the message and signature
rather than only the terms means a later run can confirm this wallet signed it,
instead of trusting its own notes.

`SKILL.md` has the full layout, including why the save ledger belongs on the root
filesystem and not in `/runs`.

If the derived address and the response disagree, stop and tell the user. Do not
pick one.

The nonce is spent in the same database transaction that writes the rule, so a
replayed message cannot produce a second version. A message older than five
minutes is refused.

## Pausing

A pause is a normal rule update with `Enabled: false`. It stops future
allocations and touches nothing else: existing savings stay in the reserve,
still earning, and the reserve address never changes. Re-enabling later is
another signed version.

**A pause must survive a stale copy.** If the version you hold says enabled and
the API says paused, the pause wins: being told to do less needs no signature.
The reverse is not true, and re-enabling on the API's word alone is refused.
`SKILL.md` has the full asymmetry, which is that the API may narrow what you are
authorised to do and may never widen it.

Disabling STAQ does **not** claim. If the user wants their money back, that is a
separate, explicit claim.
