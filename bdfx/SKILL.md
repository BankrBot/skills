---
name: bdfx
description: Exchange through BDFX from a Bankr wallet with the user's PWYW fee, discover cross-chain routes, or continue a BDFX website request. The first execution route is native Base ETH to Bitcoin.
metadata:
  clawdbot:
    requires:
      bins: [node]
---

# BDFX exchanges in Bankr

Public revision `2026-10-05.4`. BDFX extends Bankr's exchange reach to provider-supported assets/networks, with the website's current PWYW choices including a 0% BDFX fee tier. Discover quotes broadly; execution currently supports **native Base ETH → mainnet BTC, floating rate**, with no additional markup. Other assets/chains require their own execution adapters.

Use the packaged `scripts/connect.mjs`, `review.mjs`, `funding.mjs` and `bdfx.mjs` together under Node 18+. Read [references/connect.md](references/connect.md) for connection and [references/funding.md](references/funding.md) before a payment. If installation from this direct URL did not include scripts, download the exact files listed in [references/resources.md](references/resources.md), verify their SHA-256 hashes, and keep their relative paths together. Stop if the runtime cannot execute the helpers; never invent a replacement exchange or wallet client.

For a website request, preserve its `bankr-request-...` ID. For a direct chat exchange, discover fees with `node CONNECT_HELPER fee-options`, then create an intent using `start --amount AMOUNT --btc-address BTC --fee-percent PERCENT`. This stores a draft only. Quoting/catalog discovery needs no wallet or credential; `bdfx.mjs` public estimates retain a legacy 0.10% requested tier, so use the authenticated request review for the chosen PWYW tier.

Confirm the current authenticated Bankr EVM wallet read-only. Use `begin --request-id ID --wallet-address ADDRESS` for the exact BDFX off-chain sign-in message. Obtain user authorization to connect that wallet; a website handoff explicitly requesting connection may supply it. Sign the unchanged message with Bankr's personal-sign tool, never a transaction, token approval or spending intent. Verify through `connect.mjs` with the signature on stdin and the `--token-file` path returned by begin. Pass the returned private path to every subsequent connect/review/funding command. It saves a short-lived credential in a private temporary file and prints only its path. Never print, inspect, place in chat/arguments, or upload the token. Do not use another user's credential or the operator pilot token. Temporary files can disappear between independent containers; reconnect off-chain when missing/expired, preserving the request ID and any original review/payment attempt.

`review-request --request-id ID` preserves the stored amount, payout and PWYW choice, derives the refund from the verified wallet and uses the request ID as its stable key. It links the review to the website status page. Show its estimate, minimum, fee, timestamp/expiry and complete intent. Do not create an order merely to quote. The website's continuation button and connection signature authorize no order or payment.

Before order approval/creation, obtain explicit user consent to one exact ETH amount on Base, Bitcoin payout, verified refund wallet, floating rate and PWYW percentage. Use `review.mjs approve-review` and `create-order` with the full matching fields, digest, private token-file path and `--confirm-order yes`. Never change the key or create a replacement to resolve an unknown result. Inspect and recover the same review through read-only requests. Quotes expire after 120 seconds; a stale unattempted quote requires an explicitly requested fresh intent.

Before payment, follow [references/funding.md](references/funding.md). Obtain separate authorization for the exact Base ETH amount, verified provider deposit address, payout/refund/fee and **existing Base ETH only, no swaps or shortfall funding**. Only a NEW successful durable claim with `dispatch_allowed:true` permits one native `transfer_tokens` invocation using its exact arguments. Recheck the authenticated wallet and sufficient ETH plus gas immediately before sending. Other wallet activity cannot be atomically locked; the tool has no disable-shortfall switch. Insufficient or uncertain funds stop the run.

After unknown claim/transfer responses, inspect the same attempt, recover its original hash read-only, and record/reconcile. Never send again. Only the independent Base receipt plus Bitcoin payout checks establish settlement. Return a browser status link with `connect.mjs status-link`; direct-chat links are one-time, read-only and expire after 20 minutes. Browser-originated requests use the original browser's status session.

Installation, connection and deployment authorize no funded test. Never request a private key, seed phrase, Bankr API key or operator credential. Do not publish private account information or substitute simulated receipts for chain evidence.
