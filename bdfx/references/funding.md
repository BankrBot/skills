# Base ETH payment handoff

Public revision `2026-10-05.4`. The server and helper prepare and track a payment; Bankr's native `transfer_tokens` tool performs the actual send. The helper has no signing or broadcast method. Installing the skill, shipping code, creating an unfunded order, or saying “continue” authorizes no payment.

## Before sending

Use the existing review ID/digest. Run:

```sh
node FUNDING_HELPER prepare-funding --review-id ID --review-digest DIGEST --token-file PRIVATE_PATH
```

`FUNDING_HELPER` is the actual `scripts/funding.mjs` resource path. Pass the private credential file returned by `connect.mjs verify` with `--token-file PRIVATE_PATH` to every funding command. Do not use an operator pilot credential. Preparation checks the stored wallet proof, current registry, fresh provider status/instructions, and public Base RPC. It stores a 120-second funding review with an ID/digest, exact amount/deposit/payout/refund/fee, native Base ETH identity, wallet address, pending nonce and balance, and gas reserve. It creates no exchange and sends nothing. A prepared or inspected response always has `dispatch_allowed:false` and no tool arguments.

Display the exact amount of ETH on **Base**, deposit address, BTC payout, refund and PWYW fee. Report available/required balance and any blockers. A floating quote remains historical; output is determined by the provider when processing. The gas reserve is a balance buffer, not a fee cap or promise of the charged fee. It uses current L2 gas price, the GasPriceOracle L1 fee upper bound for 512 bytes and operator fee, with a fourfold buffer and minimum reserve of 0.0001 ETH. Only plain EOA-to-EOA native transfers are supported initially.

If the balance is insufficient, stop. Do not buy ETH, swap other holdings, bridge funds, acquire gas or call `transfer_tokens`. Query the authenticated Bankr account read-only to confirm the current wallet address matches the reviewed wallet and its exact Base ETH balance covers `required_balance_wei`. A valid verified session needs no new signature. Reconnect off-chain if its credential expires or the temporary file is lost, retaining the original request and attempt. A public RPC balance proves holdings at that address, not the current chat account's identity.

Obtain separate explicit user authorization for this full payment intent and the **existing Base ETH only; no swaps or shortfall funding** policy. Order creation consent does not count as transfer consent. If the user requests preparation only or has no funds, do not claim or send. There is no paid test requirement for deploying this integration.

## Claim, then call the native tool once

After exact user authorization and sufficient balance:

```sh
node FUNDING_HELPER claim-funding --review-id ID --funding-id FUNDING_ID --funding-digest FUNDING_DIGEST --amount AMOUNT --deposit-address DEPOSIT --btc-address BTC --refund-address REFUND --fee-percent PERCENT --confirm-transfer yes --token-file PRIVATE_PATH
```

The server rechecks provider instructions, expiry, current metadata, pending nonce, balance/gas and stored proof. It persists one payment attempt **before** returning permission to dispatch. A repeated claim returns the same attempt with `dispatch_allowed:false`; a restarted process cannot obtain another send authorization. An unresolved payment blocks other handoffs from the same wallet.

Only a NEW successful response with `dispatch_allowed:true`, `can_fund_live:true`, phase `payment_unknown`, and `tool:transfer_tokens` permits the one authorized invocation. Save its payment attempt before calling the tool. Immediately recheck the authenticated Base ETH balance and gas reserve. If insufficient/uncertain, leave the attempt unresolved and stop; do not release/reset it automatically. Use the returned arguments unchanged. There is one transfer: literal address recipient, native ETH on Base, exact human-readable numeric amount. No `skipValidation`, amount percentage, USD amount or other asset is allowed.

Source restriction is agent-side preflight/policy because Bankr's tool has no switch to disable automatic shortfall acquisition. External changes to a wallet are not atomically locked by the BDFX server. Do not claim stronger enforcement. Bankr's own spending limits still apply. The tool sends immediately; there is no prepare-only transfer invocation or cancellable staged transaction.

## Record and reconcile

Once Bankr supplies the Base transaction hash:

```sh
node FUNDING_HELPER record-funding --review-id ID --attempt PAYMENT_ATTEMPT --tx-hash BASE_TX_HASH --token-file PRIVATE_PATH
node FUNDING_HELPER reconcile-funding --review-id ID --token-file PRIVATE_PATH
```

Recording a hash proves nothing by itself. It cannot replace an already recorded hash or attach it to another review. Reconciliation performs read-only RPC/provider/indexer queries. Base evidence must match the saved wallet, recipient, exact wei amount, reserved nonce, empty calldata and canonical successful receipt in a safe block. Provider status/hash alone is insufficient. BTC payout verification checks the provider-reported transaction on Bitcoin mainnet, outputs to the authorized payout address and six canonical confirmations. It reports the actual paid satoshis; the historical floating estimate is not an enforceable output guarantee. `chain_settlement_verified:true` requires both independent chain checks. Provider refund/failure status does not prove a refund receipt.

If the send timed out or supplied no hash, use read-only Bankr transaction history to identify the original transaction, then record and reconcile it. Never send again. If the claim request itself timed out, inspect the funding record; a saved attempt remains blocked even if the original dispatch response was lost. If evidence is unavailable, keep the unresolved state and report it. Do not manufacture receipts or equate a syntactically valid hash with payment. Poll only when requested; do not start a perpetual monitoring job.

```sh
node FUNDING_HELPER inspect-funding --review-id ID --token-file PRIVATE_PATH
```

Public wallet enrollment supplies the owner-scoped `provider:funding` credential. A server/operator pause disables new claims while keeping inspection and receipt reconciliation available. This Base ETH → BTC route does not enable other EVM assets or Solana funding.
