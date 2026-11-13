# Hashlock Markets with a Bankr wallet

A Bankr agent trades on Hashlock with its own Bankr wallet: Bankr signs and sends, Hashlock never holds the key.
Trade on the chains both support — **Ethereum (1)**, **Base (8453)** and **Robinhood Chain (4663)**.

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
- **EVM on its own; other chains with a wallet you add.** A Bankr wallet signs in as an EVM account, so it
  trades EVM↔EVM (Ethereum, Base, Robinhood Chain) out of the box. To trade BTC, TRX or SOL, add a wallet you
  hold on that chain with your Bankr wallet's authorisation (`SKILL.md`, "Adding a wallet on another chain";
  sign `authorizationMessage` with `/wallet/sign`). Bankr has no Bitcoin or TRON wallet, so those need a
  wallet of your own.

## One-time setup in Bankr

1. A Bankr API key with **Wallet API enabled** and **read-only off**.
2. In the Bankr wallet's Security settings, turn on **"Enable arbitrary contract calls"** (it needs MFA on
   the Bankr account) — Hashlock's escrow transactions are contract calls, and Bankr refuses them otherwise
   (`403`).
3. No **allowed recipients** on that key: Bankr refuses every raw transaction from such a key. If the
   wallet's **permitted recipients** list is on, a leg in the chain's native coin is refused unless
   Hashlock's factory is on it.
4. Keep some **ETH for gas** on each chain you settle on. Gas is not sponsored.

## Settle with the Hashlock MCP server — it sends through your Bankr wallet

If your agent can start a local process, run Hashlock's own MCP server (`@hashlock-tech/mcp`, 1.12.0 or
later) and give it your Bankr key. It is the same server an agent with a private key runs; only the wallet is Bankr's.

```json
{
  "mcpServers": {
    "hashlock": {
      "command": "npx",
      "args": ["-y", "@hashlock-tech/mcp"],
      "env": {
        "HASHLOCK_API_URL": "https://hashlock.markets/api",
        "HASHLOCK_BANKR_API_KEY": "<your Bankr API key>",
        "HASHLOCK_EVM_RPC_BASE": "<a Base RPC URL>",
        "HASHLOCK_EVM_RPC_ROBINHOOD": "<a Robinhood Chain RPC URL>"
      }
    }
  }
}
```

- **Nothing to mint, nothing to build.** The server signs in to Hashlock as your Bankr wallet (a
  `personal_sign` through Bankr), and that wallet is your account's login wallet: where you are paid and
  what you fund from.
- **It builds every settlement transaction itself**, from the deal it recorded when you agreed it — never
  from a transaction the API hands it. It funds only through the Hashlock contracts and in the assets pinned
  in its release, under a capped fee and timelock; as the counterparty it reads the initiator's escrow on
  chain before funding; before a claim it reads the escrow it claims from, and it keeps the swap secret on
  your machine.
- **Bankr signs and sends.** The server checks on your own RPC that the call would go through, hands Bankr
  that exact call (`POST /wallet/submit`: contract, calldata, value, gas), and follows the transaction on
  your RPC; one that was mined and reverted is reported as a failure. Bankr does not sign a raw transaction
  for you to broadcast, so what goes on chain is Bankr's to send, as with everything else in a Bankr wallet.
- **Your Bankr security settings apply**: the pause, the contract-calls switch, and the per-transaction and
  daily limits on a native-coin leg. A claim and a refund go through Bankr too, so leave the wallet unpaused
  and those settings as they are until every swap is settled or refunded.
- **Get the settings right before you agree a deal.** Once this server has started to fund a swap it does
  not fund that swap again, whatever stopped it — it cannot be certain that nothing left. If Bankr refuses a
  funding, fix the cause, let that deal lapse and agree a new one. A claim or a refund that Bankr refuses
  can simply be repeated.
- **Do the whole deal through this server** — post or quote, negotiate, set addresses, then `fund_leg`,
  `claim_leg` (and `refund_leg` after a timelock). It settles only deals agreed through it. Its tools take
  human amounts (`"0.5"`) and assets as `SYMBOL@chain`; each tool describes itself.
- An RPC URL is needed for every chain you settle on (`HASHLOCK_EVM_RPC` is Ethereum's): the server reads
  escrows, checks each call and follows your transactions through it.

## If your agent cannot run a local server

An agent that can only add a remote MCP server or call HTTP uses the hosted server
(`https://hashlock.markets/mcp`) or the REST API, as `SKILL.md` describes, with a Hashlock API key minted
by the Bankr wallet:

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

A Bankr wallet signs as an ordinary EOA, so Hashlock verifies the signature directly, and the Bankr wallet
becomes the account's login wallet.

To settle on this path, send each transaction that `build_fund`, `build_claim` or `build_refund` returns
(`{ chainId, txs: [{ to, data, value }] }`), in order, through Bankr's `POST /wallet/submit`:
`{ "transaction": { "to", "chainId", "data", "value" }, "waitForConfirmation": true }`.

**Know what this path trusts.** Here nothing checks those transactions but you: you send what Hashlock's
API built, and you take the API's word that the other side's escrow exists. That is the trust a person
places in the hashlock.markets web app. An agent that should not take the API's word — an unattended one,
or one moving size — settles with the MCP server above, which checks every step itself. There is no
shorter set of checks that is safe to copy: a transaction's destination alone does not show whom it pays.

- An ERC-20 leg is an `approve`, then `createSwap`. A `400` "The transaction could not be submitted" on
  `createSwap` right after the `approve` mined means Bankr cannot see the approve yet: wait ~30 seconds and
  submit the same `createSwap` again.
- A transaction that mines and reverts comes back `400` with `status: "reverted"` and its hash: stop and
  re-read `swap_status` before trying anything else.
- After the initiator's claim, the keeper normally settles the counterparty's leg — but check `swap_status`
  and claim it yourself if it is still open once the secret is public.

## Bankr errors you can hit

| Answer | Fix |
|---|---|
| `403` "Arbitrary contract calls disabled" / "MFA required" | Turn on MFA, then the setting, in the Bankr wallet. |
| `403` "Restricted API key" | Remove allowed recipients from the key. |
| `403` `RECIPIENT_NOT_PERMITTED` / `RECIPIENT_COOLDOWN` (a native-coin leg) | Put Hashlock's factory on the permitted-recipients list (a new entry waits out a cooldown), or turn the list off. |
| `403` `PER_TX_LIMIT_EXCEEDED` / `DAILY_LIMIT_EXCEEDED` / `PRICING_UNAVAILABLE` (a native-coin leg) | Raise or turn off the limit in Security settings. |
| `403` "Read-only API key" | Use a key with read-only off. |
| `403` "Wallet paused" | Unpause the wallet. |
| `429` | Bankr allows 10 wallet writes a minute; wait and try again. |
| Not enough ETH for gas | Top up ETH on that chain. |

With the MCP server: after any of these on `claim_leg` or `refund_leg`, fix the cause and call the tool
again. On `fund_leg` the server does not fund the same swap a second time: fix the cause and agree a new
deal. If it says a transaction "may or may not have been sent", Bankr did not say what it did — look at
`deal_status` before anything else.
