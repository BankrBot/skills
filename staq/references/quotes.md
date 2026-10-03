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

`amount` is a decimal string in USDC **base units**, already converted. 20000000
is $20, because USDC has six decimals. Check it as an integer. Never parse it
into a float, and never re-derive it from `allocUsdMicros` yourself.

**It is not the number you hand to Bankr.** `POST /wallet/transfer` takes a
human-readable amount, where `"100"` means 100 USDC, so `"20000000"` passed
through unchanged asks for twenty million dollars. Convert once, at the
transfer, with string arithmetic: pad to at least 7 digits, put the point before
the last 6, drop trailing zeros. `"20000000"` is `"20"`, `"10000"` is `"0.01"`,
`"1"` is `"0.000001"`. Convert it back and require the same integer before you
send. `SKILL.md` has the exact request.

Both fields are checked before anything moves, and they check each other.
USDC has six decimals and micro-dollars have six decimals, so for a stablecoin at
par **these two integers are equal**. If they are not, the quote is refused: one
of the two has been changed without the other.

Then run the rest of the checks in `SKILL.md`, which is the destination against
the reserve you derived on chain, the token against pinned USDC, the amount
against the signed rule, the ceiling, and whether this transaction has already
been saved for. `to` matching a recorded address is not enough on its own if that
address came from a response.

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
| `not_deployed` | The reserve has no contract yet, so nothing is saved into it | **Yes**, once: saving resumes after the one-time setup |

For `insufficient_balance`, say something specific and useful: "your wallet
doesn't have enough USDC for this save", not "something went wrong".

The save itself is always USDC, so `insufficient_balance` means exactly one
thing: not enough USDC to cover the whole save. There is no second asset to fall
back to, which is what makes this skip worth mentioning to the user.

`not_deployed` on a save means STAQ will not quote a save into a reserve that
cannot yet pay out. A plain transfer would arrive there happily, which is
exactly the problem: the money would sit behind a contract that does not exist.
Say it once, not on every trade: "Your savings need their one-time setup before
they can continue. Want me to do it now?" On a claim or a deposit it means the
same thing. The fix is `POST /v1/wallets/:addr/activate`; see `claiming.md`.

## Idempotency: the quote is idempotent, the money is not

`ref` is `keccak256(chainId, txHash)`, so the same trade always produces the same
ref and the same decision. Asking twice is harmless and returns the original
answer rather than recomputing at a new price.

Never generate a ref yourself, and never make one from a timestamp.

**None of that stops a second transfer.** A save is a plain ERC-20 transfer and
carries no `ref` at all. The hub's replay guard sits inside `allocate`, which the
save path deliberately never calls, so nothing on chain will refuse the same save
twice: sent again under a new wallet nonce, it simply moves the money again. A
repeated completion event, two workers, or a restart part-way through is
therefore enough to save twice, and "do not retry a reverted transaction" does
not address any of those.

So there are two records, and both exist before the transfer does:

1. **Your own record.** Write
   **`/.staq/saves/<chainId>-<sourceTxHash>.json`**, marked `claiming`, with a
   fresh claimant (32 random lowercase hex characters). The wallet's root
   filesystem is permanent and shared across every surface the agent runs on, so
   the next run sees it. Not `/runs`, which is scoped to a conversation and
   expires.
2. **The claim.** A file is not a compare-and-swap: two concurrent runs can both
   find nothing and both write. So claim the save with a signed `STAQ save v1`
   message at `POST /v1/wallets/:addr/saves`. It is one database row per source
   transaction, so exactly one run gets `200`; every other run gets `409
   save_claimed` and stops. Only the holder goes on. If the endpoint cannot be
   reached, save nothing.
3. Mark your record `attempted`, broadcast, then update it to `pending` with the
   save's own transaction hash, and to `confirmed` or `failed` when you know.
4. **Any existing record refuses a new attempt**, `failed` included. A save is
   never retried and never collected later, so a record existing at all is the
   answer.
5. **On an ambiguous result**, a timeout or a lost receipt, reconcile the record
   you already have. Look up the hash you stored, or look for the transfer on
   chain. Never resolve uncertainty by sending a second one.
6. **If you cannot keep such a record, do not save automatically.** Saving with
   no memory of what you already sent is the one failure mode here that costs the
   user money twice.

## Supported assets on Base

**A save is funded from USDC. Nothing else.** One asset, one address, pinned in
`SKILL.md`. A quote naming any other token is refused rather than sent.

Three reasons, and the first is the one that decided it:

- **Native ETH would need a non-zero transaction value.** `value` has no agreed
  unit across agent runtimes, and one that reads `"1"` as ether rather than wei
  moves a whole ETH instead of a wei. STAQ removed `allocateNative` from
  activation for exactly this reason, and a native save is the same hazard by
  another route. The hub's `minGasBuffer` cannot help: it lives inside
  `allocateNative`, and a plain transfer never goes near it.
- **USDC is the only asset that earns**, because it is what the single pinned
  vault takes. Funding from anything else would guarantee an idle balance.
- **One funding asset means one address to check a quote against.** An agent
  that has to predict which of four assets a save will land in cannot refuse a
  wrong one with any confidence.

The coin being traded is **never** touched. If someone buys a new token with ETH,
the save comes out of their existing USDC and the purchase settles in full. There
is no splitting across assets, no swapping, and no bridging, because each of
those turns a save into a trade the user did not ask for, with its own slippage,
fee and tax consequences.

A wallet holding no USDC cannot save, and the quote skips with
`insufficient_balance`. That is one of the few skips worth speaking up about, so
the user can decide what to do rather than quietly never saving.

A reserve can still **hold and claim** USDC, USDT, WETH and ETH. It is an address,
so anyone can send anything to it, and saves made under an earlier version of
this skill were funded from those assets and are still sitting there. Only USDC
earns.

Base USDG is deliberately not supported.

## Valuing a percent rule without trusting the answer

A fixed rule needs no valuation: the signed amount is the expected amount, and
anything else is refused.

A percent rule needs the value of the trade, and the figure in the quote is the
API's claim about it, not evidence. You executed the trade, so you can usually
check it yourself:

- **A USDC leg is the whole answer.** If the user spent or received the pinned
  USDC, that leg is worth its face value and `rate x` it is the ceiling. No price
  source needed.
- **An ETH-priced leg can be read from the pinned Chainlink feed**, and it is
  only evidence if all four of these hold: `answer` is positive, `updatedAt` is
  not zero, `answeredInRound` is not behind `roundId`, and the answer is no older
  than 1,200 seconds. Those are the same four refusals the backend applies, and
  each of them has been a real exploit somewhere.

```bash
# latestRoundData() on the pinned ETH/USD feed. Selector 0xfeaf968c.
curl -s -X POST https://mainnet.base.org \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{
        "to":"0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
        "data":"0xfeaf968c"},"latest"]}'
```

**If you cannot value the trade either way, save nothing.** Fail closed. A save
skipped is a missed dollar; a save taken on an unverifiable number is the user's
money moving on someone else's word.

## The asset traded does not have to be supported

Buying or selling an unsupported token still saves, as long as the transaction
has a determinable value. The save is funded from a supported asset the user
already holds on the same chain.

Selling a memecoin for USDC is worth the USDC received. Sending a memecoin with
nothing received back cannot be valued, and skips as `unpriceable`.

## Source chain only

The save comes from the chain the transaction originated on. STAQ never bridges
or swaps to find something to save with.
