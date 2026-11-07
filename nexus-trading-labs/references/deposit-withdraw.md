# Deposit & Withdraw Reference

## Deposit USDC Collateral (Trading Account)

All collateral lives in the Orderly Network vault on Arbitrum — non-custodial, withdraw anytime.

**⚠️ State the destination clearly when depositing.** A deposit goes into the user's **Nexus
trading balance** (perpetual collateral — spendable immediately, withdrawable on demand, NO lockup).
This is NOT a yield or managed vault. Always confirm it back, e.g.:

> "Depositing 14.58 USDC into your **Nexus trading balance** (perp collateral on Arbitrum —
> withdraw anytime, no lockup). This is not a yield/managed vault."

This preempts confusion with OmniVault (a separate managed-fund product with a redemption window —
see the OmniVault section below). The skill can ONLY deposit to the trading balance.

### Automated path (recommended)

```
POST https://og.nexustradinglabs.com/proxy/bankr-deposit
{
  "walletAddress": "<wallet>",
  "bankrApiKey":   "<user's Bankr API key>",
  "amount":        20
}
```

Server: fetches accountId → builds USDC approve calldata → submits via Bankr /wallet/submit → waits for confirmation → builds vault.deposit() calldata → submits deposit tx.

Returns `{ ok: true, amount, accountId, approveTxHash, depositTxHash }`. Funds live in Nexus within ~4s.

**Requirements:** Wallet & Agent API enabled on bankrApiKey, wallet has USDC on Arbitrum, wallet has ~0.00001 ETH for LayerZero fee.

**allowedRecipients blocker:** If the key has `allowedRecipients` set, server returns 403 (the restriction blocks raw tx submission). ⚠️ **Do NOT tell the user to permanently clear `allowedRecipients` on their main key** — that removes a real safety boundary. Instead recommend a **dedicated, temporary Bankr key** (Wallet & Agent API enabled, no `allowedRecipients`) created just for the deposit/withdraw, then **revoked right after** at bankr.bot/api-keys. Use it transiently per call, never persist it.

**When to ask for Bankr API key:** "I need your Bankr API key to submit the deposit. Find it at bankr.bot/api-keys — same key used for trading."

### Prepare-only path (returns calldata for manual signing)

```
POST https://og.nexustradinglabs.com/deposit/prepare
{ "wallet": "0x...", "amount": 20 }
```

accountId is fetched automatically — do NOT pass it. Returns two ready-to-sign txs:

```json
{
  "chainId": 42161,
  "steps": [
    { "step": 1, "description": "Approve 20 USDC to Orderly vault", "to": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "data": "0x...", "value": "0x0" },
    { "step": 2, "description": "Deposit 20 USDC to Nexus trading account", "to": "0x816f722424B49Cf1275cc86DA9840Fbd5a6167e9", "data": "0x...", "value": "0x2386F26FC10000", "note": "~0.00001 ETH LayerZero fee" }
  ]
}
```

Sign and submit step 1, wait for confirmation, then step 2.

### Contract addresses (Arbitrum One, chainId 42161)

| Contract | Address |
|---|---|
| Orderly Vault | `0x816f722424B49Cf1275cc86DA9840Fbd5a6167e9` |
| USDC (Arbitrum) | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| brokerHash | `0x69729be60357fd58653e988388922e200193543b4328eda1b9b9bdaaef2f1a70` |
| tokenHash | `0xd6aca1be9729c13d677335161321649cccae6a591554772516700f986f942eaa` |

---

## Check Balance

```
POST https://og.nexustradinglabs.com/balance
{ "walletAddress": "<wallet>", "session": { … } }
```

Look for `free_collateral` — this is the amount available to withdraw (not total balance). `total_collateral` includes locked margin.

---

## Withdraw USDC

```
POST https://og.nexustradinglabs.com/proxy/bankr-withdraw
{
  "walletAddress": "<wallet>",
  "bankrApiKey":   "<Bankr API key — REQUIRED>",
  "amount":        20
}
```

**`bankrApiKey` is MANDATORY.** Omitting it returns 401. Always ask the user for it before withdrawal: "I need your Bankr API key to sign the withdrawal. Find it at bankr.bot/api-keys — Wallet & Agent API must be enabled."

Server: loads the wallet's registered trading key → settles PnL if needed → fetches the withdrawal nonce → builds the EIP-712 Withdraw (receiver = the wallet) → Bankr signs it as the wallet (eth_signTypedData_v4) → submits to Orderly /v1/withdraw_request. The trading key alone can't withdraw; the Withdraw must recover to the wallet. Funds arrive on Arbitrum.

> 🔒 **Withdrawal destination — receiver binding.** In this proxy flow the backend builds the EIP-712 `Withdraw` message (with `receiver` = the caller's wallet) before Bankr signs it, and the backend is *intended* to bind `receiver` to the caller. Note this is enforced by the Nexus backend, **not** independently by Bankr or Orderly — so it relies on backend integrity. For high-value withdrawals, prefer confirming the destination explicitly with the user, and treat the backend host as trusted infrastructure (pin it; reject responses from any other origin).

Returns `{ ok: true, amount, withdrawNonce, withdrawnAmount }`. `withdrawnAmount` is what Orderly
accepted — quote that number, not the amount asked.

### Withdrawal blocked (code 78, or nothing free)

The server settles PnL first, re-reads `free_collateral` from Orderly and retries with that (never the
raw holding). If it still can't withdraw, it answers `insufficient_free_collateral` with a `hint` naming
why: an open position, an unsettled loss, or open orders. Read the hint to the user in plain words:

- open position → offer to close it first, then withdraw;
- unsettled loss → run Settle PnL (below), then `POST /balance` and withdraw `free_collateral`;
- open orders → offer to cancel them, then retry.

A loss that has been settled is gone from the balance: if `free_collateral` is 0 after settling, there is
nothing to withdraw. Say so plainly.

`502 settle_failed` → Orderly refused the settle; nothing was withdrawn. Retry once, then stop and tell the user.

---

## Settle PnL

Books realised gains or losses into the balance. Moves no funds out. One call with Bankr:

```
POST https://og.nexustradinglabs.com/settle-pnl
{
  "walletAddress": "<wallet>",
  "session":       { … },
  "bankrApiKey":   "<user's Bankr API key>"
}
```

Server: reads the settle nonce (signed by the trading key) → Bankr signs Orderly's EIP-712 `SettlePnl` as
the wallet → posts it. Returns `{ ok: true, … }` once Orderly accepts it, or `502 settle_failed` with a
`stage` and `hint`. Wait ~5 s, then `POST /balance` for the new `free_collateral`.

Without `bankrApiKey` the route answers `{ settled: false, step: "sign", typedData, … }`: that is NOT a
settle. Never report it as settled.

---

## OmniVault — different product, NOT reachable via the skill

OmniVault is Orderly's **managed-fund** product, distinct from the trading balance:

- **Trading balance** (what this skill deposits to): perp collateral, withdraw on demand, no lockup.
- **OmniVault**: a managed fund with a **redemption/withdrawal window** (funds are not instantly
  liquid — the manager unwinds positions first).

External brokers cannot deposit into OmniVault, so the skill **cannot** route funds there — every
skill deposit goes to the trading balance. If a user specifically wants OmniVault or a community
vault, direct them to the web app: https://app.orderly.network/vaults (or the Vaults page at
https://trade.nexustradinglabs.com). Do NOT imply the skill can manage vault deposits/redemptions.

