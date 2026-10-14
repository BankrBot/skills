# Hashlock Markets with a Bankr wallet

A Bankr agent trades on Hashlock with its own Bankr wallet: Bankr signs, Hashlock never holds the key.
Trade on the chains both support — **Base (8453)** and **Robinhood Chain (4663)**.

## Why a Bankr agent uses Hashlock

- **Sell a block of a token without dumping it on its pool.** A token launched through Bankr usually has one
  thin pool; selling a large share there moves the price against you. On Hashlock you post an RFQ, buyers
  quote, and the whole block changes hands at the agreed price.
- **Your Bankr launch gets listed by itself.** Hashlock watches Bankr launches on Base and Robinhood Chain
  and lists one once it passes the safety and traction bar; a token that misses its first week can be
  requested — see `SKILL.md` §2b for the bar and the request.
- **Trade with another agent without trusting it.** Both legs are hash-time-locked: either both settle or
  both refund. Bankr signs every transaction; neither Hashlock nor the counterparty ever holds your funds.
- **Earn as a maker.** Quote other agents' RFQs from the same wallet. Makers pay no protocol fee.
- **Stay on EVM unless a human links more.** A Bankr wallet signs in as an EVM account, so on its own it
  trades EVM↔EVM (Base, Robinhood Chain). To be paid in BTC, TRX or SOL, a human must link that wallet in a
  signed-in session at hashlock.markets first; a `prove_wallet` proof is not enough (see `SKILL.md`).

## One-time setup

1. A Bankr API key with **Wallet API enabled** and **read-only off** (`X-API-Key` header on every call below).
2. In the Bankr wallet settings, turn on **"Enable arbitrary contract calls"** — Hashlock's escrow
   transactions are contract calls, and `/wallet/submit` refuses them otherwise (`403`).
3. Do **not** set "allowed recipients" on that key: it blocks every raw `/wallet/submit`.
4. Keep some **ETH for gas** on each chain you fund from. Gas is not sponsored on `/wallet/submit`; a wallet
   without it gets `400 insufficient_funds_for_gas`.

## Mint the Hashlock API key with the Bankr wallet

```bash
NONCE=$(curl -s https://api.hashlock.markets/v1/keys/nonce | jq -r .nonce)
ADDR=0xYourBankrWallet   # the `signer` Bankr returns; check it on the first call
MSG=$(printf 'Hashlock Markets — create an API key.\n\nAddress: %s\nKey name: bankr-agent\nScopes: read, taker, maker\nNonce: %s' "$ADDR" "$NONCE")

SIG=$(curl -s -X POST https://api.bankr.bot/wallet/sign \
  -H "X-API-Key: $BANKR_API_KEY" -H "content-type: application/json" \
  -d "$(jq -n --arg m "$MSG" '{signatureType:"personal_sign", message:$m}')" | jq -r .signature)

curl -s -X POST https://api.hashlock.markets/v1/keys -H "content-type: application/json" \
  -d "$(jq -n --arg a "$ADDR" --arg m "$MSG" --arg s "$SIG" '{rail:"evm", address:$a, message:$m, signature:$s}')"
# → { "key": "hk_live_…" }  store it as a secret; it is shown once
```

A Bankr wallet signs as an ordinary EOA, so Hashlock verifies the signature directly. The Bankr wallet becomes
the Hashlock account's **login wallet** — the address you are paid at and fund from.

## Talk to Hashlock

Use the hosted MCP server (`https://hashlock.markets/mcp`, header `Authorization: Bearer hk_live_…`) if your
agent setup can add MCP servers, or the REST API at `https://api.hashlock.markets/v1` with the same header.
Everything in `SKILL.md` applies unchanged.

## Settle through Bankr — sign AND send with `/wallet/submit`

`build_fund`, `build_claim` and `build_refund` return `{ chainId, txs: [{ to, data, value }] }` with
`value` as **hex wei**. Send each transaction, in order, through Bankr — it signs and broadcasts, so you do
not need Hashlock's `broadcast_tx`:

```javascript
const BANKR_WALLET = '0xYourBankrWallet';        // your Bankr EVM address (GET /wallet/me)
// The escrow accepts funding only from `built.from` — stop if that is not this Bankr wallet.
if (built.from && built.from.toLowerCase() !== BANKR_WALLET.toLowerCase()) throw new Error(`fund must be sent from ${built.from}`);
for (const tx of built.txs) {                       // an ERC-20 leg is approve, then createSwap
  const r = await fetch('https://api.bankr.bot/wallet/submit', {
    method: 'POST',
    headers: { 'X-API-Key': process.env.BANKR_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      transaction: {
        to: tx.to,
        chainId: built.chainId,
        data: tx.data,
        value: BigInt(tx.value).toString(),      // Bankr wants DECIMAL wei; Hashlock gives hex
      },
      description: 'Hashlock HTLC settlement',
      waitForConfirmation: true,                  // the next tx (createSwap) needs the approve mined
    }),
  });
  const out = await r.json();
  if (!out.success) throw new Error(`${out.status ?? r.status}: ${out.error ?? 'submit failed'}`);
}
```

- The escrow factory accepts funding **only from the builder's `from`** — your refund address on that leg.
  Leave it as your Bankr wallet (the default), which is exactly what `/wallet/submit` signs with.
- A transaction that mines and reverts comes back `400` with `status: "reverted"` and its hash: stop and
  re-read `swap_status` before trying anything else.
- A `400` "The transaction could not be submitted" on `createSwap` right after its `approve` mined means
  Bankr cannot see the approve yet: wait ~30 seconds and submit the same `createSwap` again.
- After the initiator's claim, the keeper normally settles the counterparty's leg — but check `swap_status`
  and claim it yourself (same `/wallet/submit` flow) if it is still open once the secret is public.

## Bankr errors you can hit

| Answer | Fix |
|---|---|
| `403` "Arbitrary contract calls" | Turn the setting on in the Bankr wallet. |
| `403` "Read-only API key" | Use a key with read-only off. |
| `403` "Wallet paused" | Unpause the wallet. |
| `400 insufficient_funds_for_gas` | Top up ETH on that chain. |
