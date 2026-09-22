# Bankr execution adapter

Use this with the [EARN protocol reference](protocol.md). Bankr's current authoritative transport reference is [Sign and Submit](https://github.com/BankrBot/skills/blob/main/bankr/references/sign-submit-api.md). Protocol calculations and transaction checks are still required: the submission endpoint is a signer, not a validator of EARN economic intent.

## Account and capability checks

Use the existing authenticated Bankr integration to resolve the EVM sender via `GET https://api.bankr.bot/wallet/me` (or `bankr whoami`). Do not accept a conversation-provided address as proof of wallet ownership. Confirm Robinhood Chain support and require `eth_chainId == 0x1237` from `https://rpc.mainnet.chain.robinhood.com`.

Read asset balances and allowances on chain 4663 even if Bankr's portfolio display omits a small balance. Use token decimals from the verified contracts. Maintain raw integer amounts with bigint; native ETH uses 18 decimals, USDG uses 6. Leave ETH for gas.

Public EARN GET requests and quote POSTs need no Bankr key. Authenticate only requests to the exact `https://api.bankr.bot` host through Bankr's existing credential handling. Never print keys, include them in calldata, attach them to EARN/RPC requests, or forward them across redirects.

Bankr writes require a non-read-only key with Wallet API permission and an account that permits arbitrary contract calls. Do not switch these protections off or widen settings yourself. A 401/403, paused wallet, restricted key, blocked address or security rejection is a stopping condition. Explain the block without bypassing it.

## Build, preview, confirm, execute

1. Resolve the exact vault/pool and tokens from the EARN catalog plus live chain state. Resolve a zap executor from the relevant Rialto **GET** endpoint; the Omnipool `launchRouter` is not the deposit executor. Verify bytecode and the protocol-specific registration/wiring checks in the reference.
2. Read current accounting and make fresh queries/quotes. ABI-encode the documented call locally using an available encoder such as viem. EARN does **not** provide a public generic `prepare_action` endpoint; do not invent one or call a private chat route.
3. Decode the constructed call back and check selector, target, pool/vault, funding asset, amount, recipient, minima, deadline and ordered swap legs against the requested action. Require the authenticated Bankr wallet as recipient. For native funding, `value == amountIn`, funding token is WETH and `fundedWithEth == true`; for ERC-20 funding, `value == 0` and `fundedWithEth == false`. Never submit an embedded Rialto swap directly from the user wallet.
4. Show the full plan, including **every** approval transaction, spender, cap, Permit2 expiry, estimated gas, intended principal and minimum output. Ask the user to confirm this bounded plan. A yield question or skill installation alone is not permission to spend. A quote refresh may proceed within the confirmed bounds; changes to the product, amount, spender or a less protective minimum require renewed confirmation.
5. If allowances are missing, simulate and submit only the confirmed exact approvals, one at a time, then verify their successful receipts and read the new allowances. For nonzero-to-nonzero approval restrictions, show and confirm a zero-reset approval if needed. Stop after a rejected or reverted step; do not submit dependent calls.
6. Refresh quotes after approvals. Reject any quote older than **30 seconds** or final deadline more than **10 minutes** away. Recheck wallet balances and simulate the **complete final transaction** with `eth_call` from the Bankr wallet with actual allowances in place. A quote marked `simulationIncomplete` cannot replace this check. Estimate gas for that same calldata. Never ignore a failed final simulation.
7. Submit the reviewed transaction using the Wallet API below. Track the returned transaction hash, await a successful receipt and check the post-action receipt-token/underlying balances. Do not claim success for a pending or reverted transaction.

For approvals already submitted but a final action not submitted, say exactly that: the principal has not been deposited, and allowances may remain. Offer revocation only as a separately confirmed action. An allowance is not a deposit.

## Submission shape

Use `POST https://api.bankr.bot/wallet/submit`, not the removed `/agent/submit` endpoint. The example below is a **template**, not executable calldata:

```json
{
  "transaction": {
    "to": "<verified EARN destination>",
    "chainId": 4663,
    "value": "<native wei as a decimal integer string; usually 0>",
    "data": "<locally encoded, decoded and simulated 0x calldata>"
  },
  "description": "EARN: user-confirmed deposit",
  "waitForConfirmation": true
}
```

Bankr's existing integration sends `X-API-Key` and `Content-Type: application/json`. It signs for its authenticated wallet; no separate browser-wallet signing prompt should be promised. Do not set a guessed nonce or gas price.

Check `success`, `status`, `transactionHash`, `signer` and `chainId`, then independently read the onchain receipt. Where fields are missing, resolve the transaction by hash rather than assuming the sender or chain. Check the mined transaction's sender, destination, input and value match the reviewed payload; then verify the intended balance changes. Report the explorer link only for a real hash.

If a POST times out, do **not** automatically resubmit: it may have broadcast. Reconcile any returned hash and the sender's recent/pending transactions against the reviewed call before retrying. If status remains uncertain, stop and say confirmation is pending.

Bankr's raw-call spending controls cannot fully decode arbitrary ERC-20 calldata; native-value checks alone do not protect ERC-20 principal. The amount, destination, spender and decoded-call checks above must not be omitted.

## Exact approval boundaries

| Action | Approval destination and spender |
| --- | --- |
| Auto pair deposit | Each underlying ERC-20 `approve(selectedVault, exactAmount)`. |
| Auto or Omni zap | Funding ERC-20 `approve(runtimeZapExecutor, exactAmountIn)`; no ERC-20 approval for native ETH. |
| Omni basket deposit | Underlying ERC-20 `approve(Permit2, exactCap)` plus Permit2 `approve(token, pinnedOmniRouter, exactCap, shortExpiry)` when needed. Cap fits uint160; expiry fits uint48 and the reviewed deadline. |
| Omni proportional withdrawal | Pool-share token `approve(pinnedOmniRouter, exactShares)` when needed. |
| Auto withdrawal / Merkl claim | No additional token-spending approval. |

Only a confirmed, successful approval permits the next dependent transaction. Never approve a quote's embedded spender from the user wallet merely because it appeared in a quote response.

## Unsupported execution

If the runtime lacks ABI encoding, simulation, authenticated Bankr signing or chain support, provide read-only information and the relevant public EARN page. Clearly distinguish this capability limitation from a security rejection: a security rejection must not be bypassed through the website or another signer.

These instructions are not evidence of an end-to-end Bankr execution test. Integration checks in this contribution are read-only; a real funded, user-authorized transaction must be separately tested before claiming full wallet execution validation.
