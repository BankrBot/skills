# Hashlock Markets with a Bankr wallet

A Bankr agent trades on Hashlock with its own Bankr wallet: Bankr signs, Hashlock never holds the key.
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

## One-time setup

1. A Bankr API key with **Wallet API enabled** and **read-only off** (`X-API-Key` header on every call below).
2. In the Bankr wallet settings, turn on **"Enable arbitrary contract calls"** — Hashlock's escrow
   transactions are contract calls, and `/wallet/submit` refuses them otherwise (`403`).
3. Do **not** set "allowed recipients" on that key: it blocks every raw `/wallet/submit`. Keep the
   allowlist in your own code instead — the pinned factories in the recipe below.
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
// The ONLY contracts a settlement may call — Hashlock's HTLCFactory per chain id. Keep this list in your
// own code: the API names the factory, and an agent that sends wherever it is told trusts the API with
// its money. A rotated factory is announced with a release of @hashlock-tech/mcp (src/pinned.ts).
const FACTORIES = {
  1: '0x0b43c409b89515e279f651883837d4eb4ead3f4d',      // Ethereum
  8453: '0x0b43c409b89515e279f651883837d4eb4ead3f4d',   // Base
  4663: '0x0b43c409b89515e279f651883837d4eb4ead3f4d',   // Robinhood Chain
};
// Every factory whose escrows are Hashlock's: the current one, and the one before it, which still settles the
// deals funded before 2026-11-05. Read escrows through either; send new money only to FACTORIES.
const KNOWN_FACTORIES = ['0x0b43c409b89515e279f651883837d4eb4ead3f4d', '0xa9b6a64837259034e949787b5d17bfa46304ff71'];
const factory = FACTORIES[built.chainId];
if (!factory) throw new Error(`no pinned Hashlock factory on chain ${built.chainId}`);
// The escrow accepts funding only from `built.from` — stop if that is not this Bankr wallet.
if (built.from && built.from.toLowerCase() !== BANKR_WALLET.toLowerCase()) throw new Error(`fund must be sent from ${built.from}`);
for (const tx of built.txs) {                       // an ERC-20 leg is approve, then createSwap
  const to = tx.to.toLowerCase();
  // approve(spender, amount) = 0x095ea7b3: the spender must be the factory (the token is the leg's asset).
  const approvesFactory = tx.data.startsWith('0x095ea7b3') && tx.data.slice(34, 74).toLowerCase() === factory.slice(2);
  if (to !== factory && !approvesFactory) throw new Error(`refusing: ${tx.to} is not the pinned Hashlock factory`);
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

A claim or refund calls the swap's own escrow (a clone the factory created), so for those the allowlist is
the escrow address you checked (see the next section), not the factory.

- The escrow factory accepts funding **only from the builder's `from`** — your refund address on that leg.
  Leave it as your Bankr wallet (the default), which is exactly what `/wallet/submit` signs with.
- A transaction that mines and reverts comes back `400` with `status: "reverted"` and its hash: stop and
  re-read `swap_status` before trying anything else.
- A `400` "The transaction could not be submitted" on `createSwap` right after its `approve` mined means
  Bankr cannot see the approve yet: wait ~30 seconds and submit the same `createSwap` again.
- After the initiator's claim, the keeper normally settles the counterparty's leg — but check `swap_status`
  and claim it yourself (same `/wallet/submit` flow) if it is still open once the secret is public.

## Check the initiator's escrow yourself before you fund

If you are the counterparty (you fund second), `swap_status` saying `initiator_funded` is the API's word.
Read the initiator's escrow on chain first and fund only if it pays **your** wallet, under the swap's
hashlock, the agreed token and amount, with a timelock at least 2 hours past your own leg's:

```javascript
import { createPublicClient, http, keccak256, toHex, parseAbi } from 'viem';
const pub = createPublicClient({ transport: http(RPC_FOR_THAT_CHAIN) });
const clone = initiatorLeg.htlcAddress;          // from swap_status
const abi = parseAbi(['function hashlock() view returns (bytes32)', 'function recipient() view returns (address)',
  'function token() view returns (address)', 'function amount() view returns (uint256)', 'function timelock() view returns (uint256)',
  'function initiator() view returns (address)', 'function claimed() view returns (bool)', 'function refunded() view returns (bool)',
  'function computeAddress(bytes32,bytes32,address,address,uint256,uint256,address,uint256) view returns (address)']);
const get = (functionName) => pub.readContract({ address: clone, abi, functionName });
const [h, rcpt, tok, amt, tl, ini, claimed, refunded] = await Promise.all(
  ['hashlock', 'recipient', 'token', 'amount', 'timelock', 'initiator', 'claimed', 'refunded'].map(get));
// It is a Hashlock escrow only if a pinned factory derives this very address from these terms.
// allSettled: one factory's RPC hiccup must not hide a match from the other.
const ats = (await Promise.allSettled(KNOWN_FACTORIES.map((address) => pub.readContract({ address, abi, functionName: 'computeAddress',
  args: [keccak256(toHex(swap.id)), h, rcpt, tok, amt, tl, ini, initiatorLegFee /* the swap's feeAmount if that leg's asset is the fee asset, else 0 */] }))))
  .flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
if (!ats.some((at) => at.toLowerCase() === clone.toLowerCase()) || claimed || refunded || h.toLowerCase() !== swap.hashlock.toLowerCase()
  || rcpt.toLowerCase() !== BANKR_WALLET.toLowerCase() || BigInt(amt) < BigInt(initiatorLeg.amount)
  || Number(tl) < myLegTimelockUnix + 7200) throw new Error('the initiator escrow is not the agreed one — do not fund');
// The agreed asset (0x000…0 = the native coin), and the escrow really holds the amount.
// `initiatorLeg.amount` is in base units (wei / the token's smallest unit), as every swap amount is.
const ZERO = '0x0000000000000000000000000000000000000000';
const held = tok.toLowerCase() === ZERO ? await pub.getBalance({ address: clone })
  : await pub.readContract({ address: tok, abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [clone] });
// AGREED_TOKEN: the contract address you matched the asset by when you agreed (ZERO for the native coin).
if (tok.toLowerCase() !== AGREED_TOKEN.toLowerCase() || held < BigInt(amt))
  throw new Error('the initiator escrow holds another asset or less than agreed — do not fund');
```

## Bankr errors you can hit

| Answer | Fix |
|---|---|
| `403` "Arbitrary contract calls" | Turn the setting on in the Bankr wallet. |
| `403` "Read-only API key" | Use a key with read-only off. |
| `403` "Wallet paused" | Unpause the wallet. |
| `400 insufficient_funds_for_gas` | Top up ETH on that chain. |
