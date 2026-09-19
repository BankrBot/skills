# Quotes: the save decision

One source transaction produces at most one save. Ask once, act on the answer,
move on.

```bash
curl -s -X POST "https://api.agentstaq.xyz/v1/quotes" \
  -H 'content-type: application/json' \
  -d '{"chainId":8453,"txHash":"0xTHE_TRADE","wallet":"0xYOURWALLET","intent":"buy"}'
```

## An allocation

```json
{
  "decision": "allocate",
  "ref": "0x…",
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "amount": "20000000",
  "to": "0xYOUR_RESERVE",
  "txType": "buy",
  "allocUsdMicros": "20000000"
}
```

`amount` is a decimal string in the token's **base units**, already converted.
20000000 of USDC is $20, because USDC has six decimals. Pass it through
untouched. Never parse it into a float, and never re-derive it from
`allocUsdMicros` yourself.

Check `to` against the reserve you recorded at enable time, then transfer.

If the wallet asks the user to approve that transfer, say what it is before
they answer: the amount, and that it is moving into their own STAQ savings,
which only they can withdraw from. A prompt reading "send 0.05 USDC to 0xE03b…"
and nothing else is asking someone to approve what looks like money leaving for
a stranger. Approving those without explanation is the habit that empties
wallets, and this skill should not be the one teaching it.

## A skip

```json
{ "decision": "skip", "ref": "0x…", "reason": "insufficient_balance" }
```

Every skip is silent. None of them is an error, and none is retried.

| Reason | Meaning | Say something? |
|---|---|---|
| `no_rule` | STAQ is not enabled for this wallet | Only if they just tried to enable it |
| `disabled` | The rule is paused | No |
| `ineligible_type` | This type is not in their rule | No |
| `dust` | The save works out below $0.01 | No |
| `insufficient_balance` | No single supported asset covers it | **Yes**, they can act on this |
| `unpriceable` | The trade's value could not be established | No |
| `tx_failed` | The source transaction reverted | No |
| `tx_pending` | No receipt within the wait window | No |
| `not_wallet_tx` | The sender is not this wallet | No |
| `staq_tx` | This was a STAQ transaction, not a trade | No |
| `unsupported_chain` | Not Base | No |
| `not_deployed` | The reserve holds funds but its contract is not deployed | **Yes**, on a claim: it needs activating first |

For `insufficient_balance`, say something specific and useful: "your wallet
doesn't have enough USDC for this save", not "something went wrong".

The save itself can land in USDC, USDT, WETH or native ETH, whichever the
wallet can cover first. Only USDC has a pinned vault, so a save in any other
asset sits idle in the reserve rather than earning.

`not_deployed` never appears on a save, only on a claim or a deposit: saving is
a plain transfer and works whether or not the contract exists. It means the
money is there and the contract that pays it out is not, which is fixed once
per reserve by `POST /v1/wallets/:addr/activate`. See `claiming.md`.

## Idempotency

`ref` is `keccak256(chainId, txHash)`, so the same trade always produces the
same ref and the same decision. Asking twice is harmless and returns the
original answer rather than recomputing at a new price.

Never generate a ref yourself, and never make one from a timestamp.

## Supported assets on Base

A save is funded from **USDC, USDT, WETH, then native ETH**, tried in that
order. The first one that covers the **whole** amount funds it.

Stablecoins come first on purpose, so a save keeps the dollar amount the user
agreed to: $20 set aside in a volatile asset can be $14 later. WETH and ETH
follow so that a wallet holding no stablecoin can still save rather than
skipping forever. Native ETH is last, and needs the save **plus a gas buffer**,
so a save can never leave a wallet unable to pay for its next transaction.

The coin being traded is **never** touched. If someone buys a new token with
ETH, the save comes out of their existing USDC or USDT balance and the purchase
settles in full. There is no splitting across assets, no swapping, and no
bridging, because each of those turns a save into a trade the user did not ask
for, with its own slippage, fee and tax consequences.

A wallet holding no stablecoin cannot save, and the quote skips with
`insufficient_balance`. That is one of the few skips worth speaking up about,
so the user can decide what to do rather than quietly never saving.

A reserve can still **hold and claim** USDC, USDT, WETH and ETH, since earlier
saves or plain transfers may have put them there. Only USDC earns.

Base USDG is deliberately not supported.

Native ETH must leave a gas buffer behind, so a save can never strand the user
without gas for their next transaction.

## The asset traded does not have to be supported

Buying or selling an unsupported token still saves, as long as the transaction
has a determinable value. The save is funded from a supported asset the user
already holds on the same chain.

Selling a memecoin for USDC is worth the USDC received. Sending a memecoin with
nothing received back cannot be valued, and skips as `unpriceable`.

## Source chain only

The save comes from the chain the transaction originated on. STAQ never bridges
or swaps to find something to save with.
