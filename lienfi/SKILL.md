---
name: lienfi
description: Research and buy tokenized US tax lien certificates on LienFi (Base, USDC) — screen the live book by NET yield with no credential, then, once your operator has authorized your wallet in a browser, register and run the prepare → sign → confirm → submit → report purchase loop from the wallet you control. LienFi signs only the price; every transaction leaves your wallet.
emoji: 🏛️
tags: [lienfi, tax-liens, real-estate, base, usdc, mcp, investing]
visibility: public
---

# LienFi Skill

LienFi is a marketplace for tokenized US tax lien certificates and redeemable tax deeds,
settled onchain in USDC on Base (chain id 8453). This skill teaches you to research the
book, get authorized by your operator, and buy from the wallet you control.

Three facts before anything else:

- **LienFi never holds your key and never submits a transaction for you.** It signs the
  price quote; you sign an acknowledgment and submit the transactions it hands back.
- **Purchases are final.** A lien you buy belongs to your operator. The exit is redemption
  by the property owner or relisting it — there is no undo.
- **One human step exists, and it cannot be skipped or retried around.** Your operator
  signs an authorization in a browser at https://app.lienfi.com/agents/authorize and
  hands you what that page prints. When a tool answers `not_registered` with a
  `handoff_url` — and your call carried the bearer — surface the link to your
  operator and STOP.

## Prerequisites

### Your wallet

Two ways to hold a Bankr wallet, and every step below works either way:

- **You are Bankr's own agent** (the terminal, X or Telegram). There is nothing to
  create: you sign typed data and submit transactions with your own wallet tools.
  Verified 2026-09-08 — a key proof and two consents were signed with
  `eth_signTypedData_v4` and registered while the account's only Wallet API key was
  revoked. Wherever a step shows a `curl` to `api.bankr.bot`, do the same thing with
  your wallet tool instead.
- **You run somewhere else and hold a Bankr wallet through the Wallet API** (Claude
  Code, OpenClaw, a bot of your own). Create a key at https://bankr.bot/api-keys and
  keep it as `BANKR_API_KEY`. The key MUST have `walletApiEnabled` on (the default);
  `readOnly` OFF — it is ON by default, and a read-only key answers 403 to signing and
  submitting; and `allowedRecipients` EMPTY — a non-empty list blocks
  `eth_signTypedData_v4` on `/wallet/sign` and every raw submission on
  `/wallet/submit`, and this skill needs both. Use `allowedIps` for restriction
  instead.

In both cases, in the Bankr security settings leave **arbitrary contract calls** ON (its
default); off, raw submissions are blocked. Bankr's per-transaction and rolling-24-hour
limits (defaults of $500 each, re-read 2026-09-07) apply on every surface and must cover
what one purchase moves: an `approve` and a `buyNFT`, each for the lien's total. Whether
both count against the daily limit is undocumented, so have your operator set it to at
least twice the lien price. Only your operator can change these, in the Bankr web app.
On X, Bankr answers only Bankr Club members.

Fund the wallet with USDC on Base — and no more than your operator is willing to commit,
because LienFi records but does not enforce the cumulative cap. Gas on Base is
sponsored for Bankr embedded wallets.

### Your wallet address

Inside Bankr, it is the wallet your portfolio shows. Over the Wallet API:

```bash
curl -s https://api.bankr.bot/wallet/me -H "X-API-Key: $BANKR_API_KEY"
```

The address that holds the funds is the one your operator must name as the agent wallet.
Give it to them exactly as returned. Verified 2026-09-07: Bankr signs with this same
address (see "Verified and unverified" at the end).

## Endpoints

- **LienFi MCP** — JSON-RPC 2.0 over stateless HTTP, nothing to install, no session:
  `POST https://api.lienfi.com/api/v1/mcp` with `content-type: application/json`.
  Every LienFi call in this skill is one `curl` to it. Research tools take no header;
  wallet and purchase tools take `Authorization: Bearer $LIENFI_BEARER`.
- **Research REST, no credential** — `https://api.lienfi.com/api/public/liens/{id}`
  (one lien, flat, carrying the NET per-year rate) and
  `https://api.lienfi.com/api/v1/liens?...` (the book with filters).
- **Read before your first call** — https://app.lienfi.com/llms.txt (the money
  conventions), https://app.lienfi.com/docs/api#mcp-walkthrough (the loop below with a
  request body for every step), https://app.lienfi.com/docs/api#mcp-refusals (every
  refusal code with what to do). Trust `tools/list` over any document, including this one.

Keep the operator's bearer from the moment you have it, and send it on every wallet and
purchase call for as long as the authorization lasts — `$LIENFI_BEARER` below stands for
wherever your runtime keeps a credential; LienFi does not care where, only that it
arrives. Registering opens no session: a later call without the header is answered as
`not_registered` even though you are. Never print the bearer and never send it anywhere
but `api.lienfi.com`. (Bankr's own agent carried it across sessions unaided in testing on
2026-09-08; an agent whose memory does not persist secrets keeps it as an env var.)

## Money rules that are not guessable from the field names

- Every yield LienFi's API returns is **gross**. LienFi takes a share of the GAIN over the
  purchase price when a lien redeems (currently 10%, read the live rate from
  `fee_config`), never of the redemption value. Rank on `net_apy`, which `search_liens`
  computes with the same arithmetic the site displays.
- A buyer pays `listing_price`. Most listings (`deal_type: par`) are priced AT the live
  redemptive value, so the price climbs with accrual and a redemption on the day of
  purchase returns the basis and no gain.
- Liens under 30 days from maturity carry **no per-year rate**; `search_liens` returns
  them in a separate `maturing_soon` list. Do not annualize them yourself.
- `redemptive_value`, `accrued_interest` and `listing_price` on a raw row are frozen
  snapshots; read the `calculated` block, which is recomputed live.
- `redemption_deadline` is the statutory deadline and is immutable onchain. Never
  recompute it.

## Step 1 — Research (no credential)

List what the server serves, then screen:

```bash
MCP=https://api.lienfi.com/api/v1/mcp
curl -s -X POST $MCP -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

curl -s -X POST $MCP -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call",
       "params":{"name":"market_overview","arguments":{}}}'

curl -s -X POST $MCP -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call",
       "params":{"name":"search_liens","arguments":{"budget_usd": 2000, "states": "FL", "limit": 5}}}'

curl -s -X POST $MCP -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call",
       "params":{"name":"get_lien","arguments":{"lien_id": "<lien-uuid>"}}}'
```

Every result is a text content block whose `text` is JSON. `search_liens` answers
`liens` ranked on `net_apy`, plus `maturing_soon`, `dropped` (what could not be scored,
counted rather than hidden), `fee_config` and `apy_labels`. Keep the `lien_id` you want.

## Step 2 — Get authorized (the human step)

First, check whether this step is already done. If you hold a bearer for this wallet from
an earlier conversation, skip to Step 5: the authorization lasts until its `expires_at`,
and a new conversation does not end it. If you are not sure whether the wallet is
registered, ask LienFi, with no credential:

```bash
curl -s https://api.lienfi.com/api/v1/agents/<agent-wallet-address>
```

It answers `registered`, `expiresAt` and `revokedAt`. `registered: true` while you hold no
bearer means the blob is lost to you, and a second authorization does NOT replace the
first: your operator must press **Revoke** on the existing one at
https://app.lienfi.com/agents/authorize before signing again, or registration is refused
(`registration_refused`, "already has a different active authorization"). Say so before
they sign, not after the refusal.

Then tell your operator, in these words: go to https://app.lienfi.com/agents/authorize,
enter the agent wallet address from *Your wallet address* above exactly, choose the most
the agent may spend on one lien, a cumulative total, and an expiry of at most 90 days, and
sign. The page then opens a handoff with a **Copy the prompt** button; ask them to paste
that whole block to you. The block carries a credential, so it has to reach you privately:
if this conversation is public — a reply on X, a group chat — ask them to paste it in the
Bankr terminal or a direct message instead, never in the open. It carries all four of:

1. the **bearer** — the authorization blob, base64url-encoded, ready for an
   `Authorization: Bearer` header;
2. the **key-proof typed data**, with the authorization digest filled in;
3. one **consent typed data** per required agreement;
4. the ready **registration call**, over MCP and over REST.

If they hand you the envelopes individually instead — the page still renders each one,
under *Raw envelopes* — the steps below are the same.

Wait. Do not poll LienFi for it, and do not retry a refused tool while you wait.

## Step 3 — Sign the key proof and the consents (your wallet)

For the key proof and for EACH consent envelope: set `message.timestamp` to now in unix
seconds (LienFi refuses one more than 600 seconds off its clock), change nothing else,
and sign. Inside Bankr: your wallet tool's `eth_signTypedData_v4` over the envelope. Over
the Wallet API:

```bash
curl -s -X POST https://api.bankr.bot/wallet/sign \
  -H "X-API-Key: $BANKR_API_KEY" -H 'content-type: application/json' \
  -d '{"signatureType":"eth_signTypedData_v4","typedData":<the envelope, with timestamp set>}'
```

Either way you get a `signature` (the Wallet API answers
`{ "success": true, "signature": "0x…", "signer": "0x…" }`). Keep each `signature` with
the `timestamp` you signed. The envelopes are described field by field
in `references/typed-data.md`; the sentence in each `agreement` is hashed, so it must be
byte-identical to what the page printed.

## Step 4 — Register

Over MCP, with the bearer:

```bash
curl -s -X POST $MCP -H 'content-type: application/json' \
  -H "Authorization: Bearer $LIENFI_BEARER" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call",
       "params":{"name":"register_agent","arguments":{
         "agent_key_proof": {"specVersion":"agent-keyproof-v1","signature":"0x…","timestamp":1756800000},
         "agent_consents": [
           {"specVersion":"consent-v2","documentType":"terms-and-conditions","version":3,"signature":"0x…","timestamp":1756800000},
           {"specVersion":"consent-v2","documentType":"wallet-connection-consent","version":1,"signature":"0x…","timestamp":1756800000}
         ]}}}'
```

Use the `documentType` and `version` values the page printed — they are the versions
LienFi currently publishes. The answer is `registered: true`. The same body also works
as `POST https://api.lienfi.com/api/v1/agents/register` with the printed
`operatorAuthorization` included. Registering again with the same bearer is idempotent
and tops up any consent that lapsed after a document was republished.

From now on send the bearer on every LienFi call.

## Step 5 — Check yourself, then price

```bash
curl -s -X POST $MCP -H 'content-type: application/json' -H "Authorization: Bearer $LIENFI_BEARER" \
  -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"agent_status","arguments":{}}}'

curl -s -X POST $MCP -H 'content-type: application/json' -H "Authorization: Bearer $LIENFI_BEARER" \
  -d '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"quote_lien","arguments":{"lien_id":"<lien-uuid>"}}}'
```

`agent_status` is the first call to make when anything refuses: `registered`,
`expires_at`, `balances`, and `spend` (what settled and what is live beside the caps
your operator signed, with `enforced: false` on the cumulative). `quote_lien` is
indicative — `lien_price_usdc`, `total_to_approve_usdc`, `affordable`,
`shortfall_usdc` — and reserves nothing, so ask as often as you like.

## Step 6 — Buy, one purchase at a time

**6a. Prepare.** Runs every gate (authorization, the signed per-lien cap, consents,
sanctions, your ceiling, the wallet's balance), then RESERVES for ten minutes and returns
the acknowledgment typed data. Set `max_total_usdc` to `quote_lien`'s
`total_to_approve_usdc` plus a small margin (1% covers accrual between calls); it is a
stale-quote guard, not a budget, and never higher than the operator's per-lien cap.

```bash
curl -s -X POST $MCP -H 'content-type: application/json' -H "Authorization: Bearer $LIENFI_BEARER" \
  -d '{"jsonrpc":"2.0","id":8,"method":"tools/call",
       "params":{"name":"prepare_purchase","arguments":{"lien_id":"<lien-uuid>","max_total_usdc":1515}}}'
```

Returns `reservation_id`, `acknowledgment.typed_data`, `total_to_approve_usdc`,
`expires_at` and `spend`. A refusal here leaves nothing behind. Calling it again for the
same lien is safe: same reservation, same typed data while at least five of the ten
minutes remain (`acknowledgment.reused: true`).

**6b. Sign the acknowledgment** exactly as in Step 3, over
`acknowledgment.typed_data` as returned — do NOT change its `timestamp`.

**6c. Confirm.** Records the acknowledgment, THEN mints LienFi's price signature — bound
to your wallet, valid 300 seconds from this moment — and returns the transactions,
unsigned:

```bash
curl -s -X POST $MCP -H 'content-type: application/json' -H "Authorization: Bearer $LIENFI_BEARER" \
  -d '{"jsonrpc":"2.0","id":9,"method":"tools/call",
       "params":{"name":"confirm_purchase","arguments":{"reservation_id":"<reservation-uuid>","acknowledgment_signature":"0x…"}}}'
```

Returns `transactions[]` — each `{ step, name, to, data, value, chainId, why }`:
`approve` (USDC, for exactly the total, never unlimited), `buyNFT` (carries the price
signature), and `setApprovalForAll` (present unless the vault is already approved;
WITHOUT it the lien is owned but cannot be redeemed) — plus `data_suffix`,
`expires_at` and `consent_id`. If the live price moved above your ceiling, the
reservation is released and the signature discarded (`quote_above_ceiling`): prepare
again with a higher ceiling or skip the lien.

**6d. Submit, in order, from your wallet.** Each one only after the previous is mined
with `status: "success"`. Append `data_suffix` without its `0x` prefix to each `data` (it
is Base Builder Code attribution — ignored by every contract, and omitting it only loses
attribution). All three inside the 300 seconds. Inside Bankr: your wallet's raw
transaction tool, with `to`, `data` and `value` exactly as returned, on chain 8453,
waiting for the receipt each time. Over the Wallet API, which takes `value` in wei as a
decimal string (send `"0"` for LienFi's `"0x0"`):

```bash
curl -s -X POST https://api.bankr.bot/wallet/submit \
  -H "X-API-Key: $BANKR_API_KEY" -H 'content-type: application/json' \
  -d '{"transaction":{"to":"<tx.to>","chainId":8453,"data":"<tx.data + data_suffix without 0x>","value":"0"},
       "description":"LienFi approve","waitForConfirmation":true}'
```

Either way, read the receipt (the Wallet API answers `transactionHash`, `status` and
`blockNumber`). A reverted
transaction is mined too: a `buyNFT` sent after a reverted `approve` fails on allowance,
one step removed from the cause. Check `status` every time. The `buyNFT` hash is the one
you report.

**6e. Report.**

```bash
curl -s -X POST $MCP -H 'content-type: application/json' -H "Authorization: Bearer $LIENFI_BEARER" \
  -d '{"jsonrpc":"2.0","id":10,"method":"tools/call",
       "params":{"name":"report_purchase","arguments":{"reservation_id":"<reservation-uuid>","tx_hash":"<buyNFT hash>"}}}'
```

LienFi reads the receipt: a success with the purchase event answers `settled: true`,
`paid_usdc` and `vault_approval`; a revert releases the reservation; an unmined hash is
`receipt_pending` — retry once it confirms. If you never submitted, report
`{"reservation_id":"…","failed":true,"reason":"…"}` so the wallet can buy again.
`vault_approval` must read `approved`, or submit `setApprovalForAll` again — it is
idempotent.

**6f. Verify** with `my_positions`: `confirmed_on_chain` is what the wallet holds,
valued live. A purchase completed a moment ago may take the indexer a little while.

## Hard rules

- **One purchase in flight per wallet.** `purchase_in_flight` names the live one; finish
  and report it, or report it failed. Never retry around it: ERC-20 `approve` SETS the
  allowance, so a second live quote would let one approve overwrite the other's.
- **Never approve more than `total_to_approve_usdc`, and never an unlimited amount.**
- **Never park a quote.** Confirm, then submit within 300 seconds; a quote that sat while
  you deliberated reverts on chain as expired.
- **A timeout or network failure after a submit is not a revert.** The transaction MAY
  have landed. Call `my_positions` before retrying anything.
- **The operator's per-lien cap is enforced by LienFi; the cumulative is recorded, not
  enforced.** The wallet balance is your operator's backstop — never move funds into it
  on your own initiative.
- **Stop on anything that needs a human**: `not_registered`, `authorization_expired`,
  `authorization_revoked`, `consent_required`, `cap_exceeded_per_purchase`. Surface the
  message and, where present, the `handoff_url`.
- **Never present a listing as an investment recommendation** without the risk
  disclosures in https://app.lienfi.com/legal/terms-and-conditions, sections 4 and 5.

## Refusals

Every refusal is a normal result with `isError: true` and a stable `error.code` beside a
sentence written for you. The full table with what to do about each is
`references/refusal-codes.md` and, live, https://app.lienfi.com/docs/api#mcp-refusals.
The ones you will meet most: `purchase_in_flight` (finish or report the live one),
`insufficient_funds` (tell your operator the `shortfall_usdc`), `quote_above_ceiling`
(prepare again or skip), `receipt_pending` (retry the report once it confirms),
`agent_consent_required` (re-sign the consents and register again), and the `*_unavailable`
codes (transient — retry shortly, and never treat "could not check" as "fine").

## Verified and unverified — read before the first real purchase

LienFi ran a compatibility check against a real Bankr wallet on 2026-09-07 (every
agent-side signature from Bankr's `/wallet/sign`, nothing submitted). What it settled:

- **Bankr signs with the funded address.** `/wallet/sign` returns `signer` equal to the
  EVM address `/wallet/me` reports, and the signature is plain ECDSA from that address.
  On Base a Bankr wallet is an EOA with an EIP-7702 delegation, not a separate smart
  wallet, so LienFi's verifier accepts the signature directly; its on-chain fallback
  passes too. Name the `/wallet/me` address as the agent wallet and nothing else.
- **Our envelopes verify as Bankr signs them.** A Bankr-signed key proof and consents
  registered against LienFi, a Bankr-signed acknowledgment recorded, and
  `confirm_purchase` returned the `approve`, `buyNFT` and `setApprovalForAll`
  transactions for that wallet.
- **Bankr's own agent signs without a Wallet API key** (2026-09-08). Registered from the
  Bankr terminal with a fresh key proof and consents after the account's only API key
  had been revoked, and carried the operator's bearer into a later call without being
  told to store it anywhere.

What is still unverified, and what to do if it bites:

- Whether Bankr's preflight accepts LienFi's `approve` and `buyNFT` calldata unchanged —
  from the agent's own submission tool or from `/wallet/submit` — and how Bankr's $500
  limits treat an ERC-20 `approve`. If a submission is refused, report the exact response
  to your operator; do not edit the calldata and do not retry with a different amount.

## Troubleshooting

- **`not_registered` after you registered** — you are not sending the bearer, or you are
  sending a different one. Registering opens no session: the header goes on every call,
  starting with the very next one. Send exactly the blob the page printed. (The message
  says which case it is: "carried no Authorization header" or "No agent registration
  exists for <wallet>".)
- **`acknowledgment_invalid`** — you signed an edited or re-timestamped envelope, or with
  a different wallet. Prepare again and sign the returned typed data verbatim.
- **`authorization_required` on a REST quote** — the REST route needs the same bearer
  for a signed quote; the MCP path does this for you.
- **`receipt_mismatch`** — you reported the `approve` hash. Report the `buyNFT` hash.
- **Every `*_unavailable` code** — transient on LienFi's side; wait and retry. Nothing was
  reserved or moved.

## Links

- Walkthrough with every request body: https://app.lienfi.com/docs/api#mcp-walkthrough
- Refusal codes: https://app.lienfi.com/docs/api#mcp-refusals
- Conventions for machines: https://app.lienfi.com/llms.txt
- Operator setup and authorization: https://app.lienfi.com/agents
- OpenAPI: https://api.lienfi.com/api/v1/openapi.json
