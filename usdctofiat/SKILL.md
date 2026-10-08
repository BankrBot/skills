---
name: usdctofiat
description: Cash out Base USDC to fiat payment apps through USDCtoFiat by Galleon. Fast is 0% spread. Best delegates pricing (10 bps). Use when a Bankr user asks to convert Base USDC to fiat, estimate fiat received, create or inspect a cash-out, withdraw unmatched funds, or add funds to a live Fast order.
metadata:
  homepage: https://usdctofiat.xyz
  requires:
    env:
      - BANKR_API_KEY
---

# USDCtoFiat

USDCtoFiat by Galleon turns Base USDC into a non-custodial cash-out. The user is the maker: USDC stays in escrow until a buyer proves payment, or the user withdraws unmatched funds.

Call the published package, do not vendor it:

```ts
import { cashout, createOfframp } from "@usdctofiat/offramp";

await cashout({
  mode: "fast", // or "best"
  signer,       // Bankr-backed WalletClient; never a private key
  amount: "100",
  currency: "EUR",
  platform: "revolut",
  payee: "alice",
});
```

Attribution is handled by `@usdctofiat/offramp`.

## Modes

| Mode | Rate | What Galleon earns | Resume key |
| --- | --- | --- | --- |
| `fast` | Live market, **0% spread** | TOFIAT integration share | Composite deposit id for `createOfframp().watch()` / `.withdraw()` |
| `best` | Delegate strategy | **10 bps** on fill, taken from USDC released to the taker | Numeric EscrowV2 id **and returned escrowAddress** for `deposits()` / `close()` |

Mode is required. Do not default it or describe Fast as "free"; it uses 0% spread.

## Hard rules

1. Run `capabilities` before naming supported platforms or currencies. Use the selected mode's catalog under `modes.fast` or `modes.best`; never hardcode it. Catalog support does not prove provider permission or live deposit readiness.
2. An estimate is not a locked quote. Say `approximately`.
3. Before every `cashout`, `withdraw`, or `top-up`, show the exact action, mode, amount, destination/payee, and consequence. Wait for an explicit confirmation in a later user turn. Only then add `--confirm`.
4. Never retry an unknown or failed transaction blindly. Inspect the returned hash and Base wallet activity first.
5. Persist the `depositId` returned by `cashout` and, for Best, its `escrowAddress`. Best status/withdraw now require `--escrow` to bind the exact pair; a bare numeric id can collide across escrows. Fast ids already encode the escrow. Numeric Best ids cannot be topped up or partially withdrawn with this CLI.
6. Never ask for or handle a private key. Writes use the user's Bankr wallet through `BANKR_API_KEY` and `/wallet/submit`.
7. Do not offer Wise while its published P2P crypto-sale prohibition holds. `PLATFORMS.*` is technical support, not provider permission.
8. Do not import `@zkp2p/cash`. Depend on `@usdctofiat/offramp@9.0.0` only.
9. Do not offer Cash App. SDK 9's `isPaymentPlatformDisabled` removes it from discovery and rejects all display-name/separator aliases before wallet access.
10. Do not request a fresh private OTC cash-out. SDK 9 rejects fresh `otcTaker`; the CLI does not expose OTC or the removed partial cash-out preparation/policy methods.

## Amounts and fill ranges

CLI amounts are positive human-readable USDC decimals with at most six fractional digits; excess precision and exponent notation are rejected rather than rounded. `cashout()` receives the original string; estimates, Fast top-ups and partial withdrawals use exact six-decimal bigint base units through `usdc()`.

- The hard Fast floor is `MIN_CASHOUT_AMOUNT` (`0.01` USDC). The practical floor is `RECOMMENDED_MIN_CASHOUT_AMOUNT` (`1` USDC). Ask for a larger amount below the practical floor: a smaller Fast deposit can be created but matching may stall. The preview discloses this.
- Fast per-order bounds are `min(amount, 1)` to `amount` USDC.
- Best requires at least `1` USDC and caps each buyer order at `min(amount, 1500)` USDC. A larger Best deposit needs multiple fills; explain that before confirmation or let the user choose Fast.
- `perOrderUsdc` and warnings appear in the cash-out preview. These are fill bounds, not a promised payout or completion time.

## Setup

```bash
cd usdctofiat
npm ci
export BANKR_API_KEY=<write-enabled-bankr-key>
```

The Bankr key must have Wallet API access and must not be read-only. The wallet needs Base USDC plus a small Base ETH balance for gas.

## Commands

```bash
# Installed SDK's mode-specific platform/currency catalogs. No wallet access.
node scripts/usdctofiat.mjs capabilities

# Oracle estimate plus recent-fill ETA. No wallet access.
node scripts/usdctofiat.mjs estimate 100 USD

# Preview first: omit --confirm and relay the exact preview to the user.
node scripts/usdctofiat.mjs cashout \
  --mode fast --amount 100 --platform revolut --currency EUR --payee alice

# Only after the user confirms in a later turn.
node scripts/usdctofiat.mjs cashout \
  --mode fast --amount 100 --platform revolut --currency EUR --payee alice --confirm

node scripts/usdctofiat.mjs cashout \
  --mode best --amount 100 --platform monzo --currency GBP --payee alice --confirm

node scripts/usdctofiat.mjs status <depositId>
# For numeric Best ids, use the escrowAddress returned at creation.
node scripts/usdctofiat.mjs status <numericBestId> --escrow <escrowAddress>
node scripts/usdctofiat.mjs orders

# Preview, then rerun with --confirm after a later-turn confirmation.
node scripts/usdctofiat.mjs withdraw <depositId>
node scripts/usdctofiat.mjs withdraw <depositId> --confirm
node scripts/usdctofiat.mjs withdraw <numericBestId> --escrow <escrowAddress>
node scripts/usdctofiat.mjs withdraw <numericBestId> --escrow <escrowAddress> --confirm

node scripts/usdctofiat.mjs top-up <depositId> --amount 25
node scripts/usdctofiat.mjs top-up <depositId> --amount 25 --confirm
```

`cashout` builds a Bankr-backed viem `WalletClient` and calls `cashout({ mode })`. Fast and Best both submit Base transactions through `/wallet/submit`.

## Conversation flow

1. Discover with `capabilities`, selecting the mode-specific catalog and respecting `providerPolicy`.
2. Ask the user to choose **Fast** or **Best**. Do not pick a mode for them.
3. Estimate with `estimate` and label the result approximate.
4. Run the requested write without `--confirm` to generate a deterministic preview.
5. Ask the user to confirm that exact preview. Do not treat the original request as confirmation.
6. After a later-turn yes, rerun the unchanged command with `--confirm`.
7. Return the `depositId`, every accepted Bankr transaction hash in `transactionHashes`, the mode, and the next action. Approval/policy hashes and an optimistic creation snapshot do not prove fiat payment. If creation returns no order state, read `status`.
8. Use `status` or `orders`; do not infer state from elapsed time. `deposits()` scans at most 100 depositor rows, so Best history is bounded: absence is not proof that a deposit never existed. Best recovery fails closed unless the exact owned escrow/id appears once in that snapshot. Reconcile missing or duplicate rows from wallet/chain history before any write. Reconcile terminal order state and wallet/position evidence before claiming withdrawal or cash-out settlement.

## Platform caveats

- Technical catalog support is not payment-provider permission.
- Do not create a Wise cash-out while Wise prohibits receiving P2P crypto-sale payments.
- PayPal may require preapproval for cryptocurrency-related payments and a verified-payee handshake.
- Payee format and currency rules come from the selected SDK platform entry; format validation does not prove ownership or receipt of fiat. Required extension/payee verification can still block creation.
- Cash App is disabled for new SDK 9 creation even though its technical platform entry still exists. Do not use that entry to bypass the kill-switch.
- `ORDER_NOT_FOUND` immediately after creation is usually indexer lag. Retry the read, never the deposit transaction.
- A live buyer intent can temporarily block a full withdrawal. Surface the remediation and retry only after the intent expires.

## Failure boundaries

The script emits structured error fields: `code`, `retryable`, `remediation`, and recovery evidence. Follow them exactly.

- `TRANSACTION_SUBMISSION_UNKNOWN` or a Bankr success response without a hash: inspect Base activity and existing orders before any resubmission.
- `TRANSACTION_STATUS_UNKNOWN`: inspect the named transaction hash first.
- `CASHOUT_FINALIZATION_FAILED` with `inspect-created-cashout` recovery: a Fast deposit already exists. Inspect that exact deposit and transaction; never create a duplicate or reconstruct the removed partial policy lifecycle. SDK 9 sanitizes the predecessor access-policy error into this public shape.
- `EXTENSION_REGISTRATION_REQUIRED` / `PAYEE_VERIFICATION_REQUIRED`: stop. Direct the user to finish verified-payee setup; do not submit another cash-out.
- `INDEXER_UNAVAILABLE` or `ORACLE_READ_FAILED`: retry only the read.
- Bankr `untrusted_address`: stop. Do not route around the wallet scanner or suggest another submission path.

The CLI reads SDK 9's explicit public error fields; it does not call the removed `CashError.toJSON()` or dump the error's cause, stack, signer, or raw upstream payload. Accepted hashes are retained on a later failure. Missing transaction hashes are unknown outcomes, never proof of failure or permission to repeat the write.

## Validation

Run `npm test` for offline SDK-contract and Bankr adapter tests, then `npm run smoke` for wallet-free capability discovery. These tests use mock signing/submission responses and prove no live financial execution.

## References

- Product: https://usdctofiat.xyz
- Developers: https://usdctofiat.xyz/developers
- Agents: https://usdctofiat.xyz/developers/agents/
- Package: https://www.npmjs.com/package/@usdctofiat/offramp
- Maintained skill: https://github.com/ADWilkinson/usdctofiat-skills/blob/main/skills/cashout/SKILL.md
- Machine reference: https://usdctofiat.xyz/llms.txt
