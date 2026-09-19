---
name: coffer
description: Earn fees by depositing ETH into the Coffer Vault, a multi-strategy managed liquidity vault. Query and transact Coffer, run by Soteria Labs on Robinhood (4663) - one share over several Uniswap V3 legs (volatile + stock pairs). Deposit ETH, burn liquid shares to withdraw WETH, read vault value / total shares / my shares / fees / rotating tokens / live stock pairs. Use when the user asks about Coffer, the coffer vault, stock pairs in Coffer, or Coffer deposits and withdrawals. Not for Auto vaults or UFloat.
tags: [defi, vault, float, coffer, robinhood, uniswap-v3]
version: 1
visibility: public
metadata:
  clawdbot:
    homepage: "https://github.com/soterialabs2025/coffer_contracts"
---

# Coffer (Robinhood vault)

**One vault. Chain is always Robinhood (`4663`).** Do not ask for chain, Uniswap version, or Auto factory. Do not scan AutoVault factories.

Addresses + pair catalog: `references/addresses.md`.  
ABI / calls: `references/abi-and-calls.md`.

Before any tx, confirm `vault.liquidShares()` matches the catalog LS and `vault.strategyCount() > 0`.

`user` = connected / Bankr wallet.

### How to talk to the user

Use the **user** column in replies. Keep the **on-chain** name only when you must name a call.

| User says / you say | On-chain (do not lead with this) |
|---------------------|----------------------------------|
| vault value / total value | `vault.balance()` (not “NAV”) |
| deposit ETH | `depositETH()` |
| withdraw / receive **WETH** | wrapped token aeWETH `0x0Bd7D308…` |
| quote **WETH** | `quoteToken()` = aeWETH |
| **USDG** | `quoteToken()` = USDG |
| rotating tokens | `isAllowedToken` / allowlist |
| current pair | `ASSET()` |

Never say “aeWETH” or “NAV” to the user unless they used that word first. Say **WETH** and **vault value** / **total value**.

---

## Listing / existence

### "Is there a Coffer vault?" / "What's Coffer?"

Yes — a single vault on Robinhood. Reply with **vault**, **liquid shares**, **chain 4663**, and the live pairs from `vault.strategies(i)` (see Reads). Shares are a claim on the **whole** vault, not on one pair.

### "What vaults / tokens / stock pairs are available?"

List the **pairs** and **rotating tokens** from `addresses.md`, then confirm live `ASSET()` on each strategy (rotation can move a leg off its deploy pair).

---

## Read prompts

| User prompt | Call | Reply as |
|-------------|------|----------|
| "What is the Coffer vault value / total value?" | `vault.balance()` (18 decimals) | **vault value** in WETH |
| "What is the total liquid shares?" | `liquidShares.totalSupply()` (same as `vault.totalSupply()`) | total shares |
| "What are my Coffer shares?" | `liquidShares.balanceOf(user)` | your shares |
| "What fees has Coffer earned?" | sum `strategy.UniswapFeesCollected()` over every `strategies(i).strat` | fees earned (WETH) |
| "What pairs / stock pairs / what's in the vault?" | Loop `i < vault.strategyCount()`: `strategies(i)` → `ASSET()`, `quoteToken()`, `poolFee()`, `targetWeightBps`, `retired`, `mode()` | pair + quote **WETH** or **USDG** |
| "What rotating tokens / what can it rotate into?" | Catalog in `addresses.md` for that leg, then `isAllowedToken(addr)` | **rotating tokens**; current pair is `ASSET()` |

Do not invent APR. If asked, report fees + **vault value** and say there is no Coffer snapshot API in this skill.

Never invent strategy addresses — enumerate `vault.strategies(i)`.

---

## Deposit ETH

**"Deposit 0.01 ETH into Coffer"** / **"Deposit into the coffer vault"**

1. Amount must be **ETH**. If the user only says `$10` (USD), ask for an ETH amount (or convert if the agent already has a price — do not guess).
2. RPC **4663**.
3. Call `vault.depositETH()` with `value = wei`.
4. Reply with tx hash, shares minted (return value), **vault**, **chain**. Say **deposit ETH**, not `depositETH`.

Do **not** use non-ETH deposit paths. The vault routes WETH across underweight legs; the user does not pick a pair.

---

## Withdraw

Liquid shares are the claim ticket. `vault.withdraw` **burns** those shares and pays **WETH**. There is **no** token-out toggle and no ShareStaking.

Call `vault.withdraw(shares)` → `outAmount` (WETH, 18 decimals).

| User prompt | Shares |
|-------------|--------|
| "Withdraw / claim x liquid shares from Coffer" | `x` (× 1e18 if human 18-decimal) |
| "Withdraw x% from Coffer" | `liquidShares.balanceOf(user) * x / 100` |
| "Withdraw all / claim all from Coffer" | `liquidShares.balanceOf(user)` |

If `shares == 0`, do not send a tx. Cap at `balanceOf(user)`.

### After the tx — always report the payout

1. **Shares burned** — `shares` (raw + human).
2. **Token received** — **WETH** (`0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` on Robinhood).
3. **Amount received** — `outAmount` from the return or `Withdraw` event (raw + human, 18 decimals).
4. Tx hash, **vault**, **chain**.

If a strategy skipped a price-gated swap, leftover **pair token** can also arrive in-kind. If the receipt shows those transfers, mention them; still report WETH `outAmount` as the vault payout.

---

## Response rules

- Always show **Coffer**, **chain 4663**, **vault**.
- After a **withdraw**, always show **shares burned** and **WETH received**. Never reply with only a tx hash.
- Format uint256 as raw + human (÷ 1e18) when 18 decimals.
- Confirm large/ambiguous amounts before sending.
- Do not call AutoVault keepers or CofferKeeper from this skill (operator cadence, not user deposit/withdraw).

## References

- Addresses / pairs / rotating tokens: `references/addresses.md`
- Call / ABI: `references/abi-and-calls.md`
