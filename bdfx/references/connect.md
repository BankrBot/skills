# BDFX public connection

`CONNECT_HELPER` means the installed `scripts/connect.mjs` path. The original private operator skill remains separate; this public skill enrolls the current user's own wallet.

```sh
node CONNECT_HELPER fee-options
node CONNECT_HELPER start --amount AMOUNT --btc-address BTC --fee-percent PERCENT
node CONNECT_HELPER begin --request-id REQUEST_ID --wallet-address BANKR_EVM_ADDRESS
```

Skip `start` when the website supplied the request ID. `begin` returns a ten-minute EIP-4361 message for bdfx.io/Base, with a random nonce and binding to the request/intent. Read the exact statement: it authorizes wallet connection, not any exchange or spending. After user connection authorization, ask the native Bankr off-chain personal-sign tool to sign that exact UTF-8 message. Never hash/rewrite it or sign a transaction instead.

```sh
node CONNECT_HELPER verify --request-id REQUEST_ID --challenge-id CHALLENGE_ID --wallet-address BANKR_EVM_ADDRESS --token-file PATH_RETURNED_BY_BEGIN <<'PROOF'
{"signature":"RETURNED_PUBLIC_SIGNATURE"}
PROOF
node CONNECT_HELPER review-request --request-id REQUEST_ID --token-file PATH_RETURNED_BY_VERIFY
node CONNECT_HELPER inspect-request --request-id REQUEST_ID --token-file PATH_RETURNED_BY_VERIFY
node CONNECT_HELPER status-link --request-id REQUEST_ID --token-file PATH_RETURNED_BY_VERIFY
```

Verify saves a 24-hour credential to a mode-0600 file in a mode-0700 temporary directory owned by the process user. It never prints the token or reads an injected pilot credential. An optional `--token-file PRIVATE_PATH` must use a private directory and is never overwritten. Begin returns a fresh filename when a previous default credential already exists. Always pass the returned path to verify and every subsequent connect/review/funding command using `--token-file`; only the path appears in arguments. The native tool signs, not this helper.

The request ID is the immutable review key. Repeating `review-request` retains its original fee, amount, destination, expiry and review. A linked or attempted order is never reset during reconnect. If verification fails/was interrupted, preserve the same request; a fresh connection challenge authorizes no new order. If the file expired/disappeared, reconnect off-chain for that same request and inspect any saved review/attempt first.

Approve/create commands are documented in `review.mjs help`; each requires the full approved intent. For funding use [funding.md](funding.md). The read-only status link grants browser status access only, not agent API access or payment rights. Disconnecting the browser session revokes that handoff's credentials without cancelling orders/payments. The user must reconnect to inspect/reconcile through Bankr; unresolved attempts remain stored.
