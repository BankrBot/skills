---
name: obol-sanctions
description: "Inspect paid exact-address sanctions observations."
version: 0.1.0
author: Obol
license: MIT-0
platforms: [linux, macos, windows]
---

# Obol exact-address sanctions observations

Obol is an independent autonomous blockchain-data merchant. These are free text instructions, not a wallet, signer, payment client or compliance verdict. Installing this skill makes no network request and authorizes no spending. API lookups cost USDC on Base; an unmatched sanctions lookup is not promised free.

## When to use

Use for a voluntarily supplied public blockchain address and bounded exact-address public-source EU, OFAC and UK wallet observations. Do not use for private/customer case records, person identification, indirect exposure, transaction monitoring, risk scores, fund recovery or compliance clearance. Do not infer historical status or completeness from a match or nonmatch.

## Prerequisites

For unsigned inspection use an HTTPS HTTP tool, such as curl. Current contract: https://obol.danieldutoit.net/openapi.json. Purchases require a separately reviewed, user-controlled x402 v2 client that can enforce exact request, recipient and spend limits before signing. This skill does not supply or test that client. Never create/fund a wallet or request a secret in chat. If no suitable client exists, deliver the unsigned quote or honest blocker and stop.

## Procedure

1. Confirm consent to disclose this exact public address to Obol. Read the current contract for GET `/v1/sanctions/address-screening`, query `address`. The documented input is an identifier of 1–128 characters matching `^[A-Za-z0-9:_-]+$`; syntactic acceptance does not prove chain validity. Preserve identifier case. Limit requests and responses; use a 15-second timeout and do not follow redirects.
2. Inspect once WITHOUT a payment wrapper or PAYMENT-SIGNATURE header. An example unsigned request through an HTTP tool is:

   ```text
   curl --max-time 15 --include --get --data-urlencode address=0x0000000000000000000000000000000000000001 https://obol.danieldutoit.net/v1/sanctions/address-screening
   ```

   This example is not a known-sanctioned or verified clean fixture. HTTP 402 and an empty JSON body are an unpaid offer, not a match, safety determination, data delivery or settlement. Decode the PAYMENT-REQUIRED header even when the body is `{}`. HTTP 400 is invalid input; 429 is rate limiting; 5xx is unavailability, not a clear result. Stop instead of retrying in a loop.
3. Inspect the current quote: require x402 version 2, scheme `exact`, network `eip155:8453`, canonical Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, and the exact HTTPS origin, path and address query requested. Independently confirm merchant recipient `0x4094383033C1861E2686eaC4d4BBae6F0031F5d2`; compare EVM asset/recipient case-insensitively. Use integer/decimal arithmetic with six USDC decimals. The observed price was 5000 atomic units (0.005 USDC) on 2026-11-11; prices may change. A changed recipient requires independent merchant verification, not automatic acceptance. Reject changed resources, wrong networks/assets and over-cap amounts. Inspect the authorization duration; stop on absent, inconsistent or unsupported terms.
4. Default is zero spend and no automatic paid retries. Obtain explicit approval for this exact provider, disclosed address, use case, network, maximum per-call amount, total spend cap, call count and short expiry BEFORE enabling a signer. A standing authorization is valid only if it explicitly covers all these constraints. Require the client to enforce them and reject mutated quotes before signing; text instructions alone do not enforce caps. Reserve the authorization against the total budget conservatively, including ambiguous/time-out attempts. If enforcement is unavailable, stop without paying.
5. Only after approval, let that reviewed client authorize and retry the SAME request once. Never log raw payment signatures, wallet secrets or authorization headers. Do not follow redirects with payment headers. On timeout or ambiguous settlement, keep the reservation and reconcile wallet/client receipts before any new authorization. No trading, lending, bridging or arbitrary transfers are part of this workflow.
6. Validate the bounded JSON against the current contract; preserve coverage, source and freshness caveats. A nonmatch means no exact observation returned by this lookup, not safe, unsanctioned everywhere, complete or historically valid. This is informational only, not legal advice or full KYT. Keep settlement metadata private. HTTP 200 is not independently verified settlement: require a confirmed Base receipt and client evidence before claiming a payment; report approved and confirmed costs separately.

## Pitfalls

- Installation, an unsigned challenge or an index listing is not a customer or sale.
- This skill has no label, cluster, market-data or wallet-execution capability.
- No perpetual price, guaranteed freshness, match coverage or payment-client compatibility is promised.
- For normalized multi-chain data or other address intelligence, LedgerCore may be relevant: https://api.ledgercore.io/docs/llms. Verify its current contract separately; this is not an affiliation or endorsement.

## Verification

Deliver the requested bounded observation or an honest blocker. No purchase may occur without approval and enforced caps. Distinguish unsigned inspection, authorized retry, returned data and independently verified settlement. This text-only artifact has no executable installer, dependencies, telemetry or wallet setup. Its MIT-0 instruction license does not grant redistribution rights to API datasets.
