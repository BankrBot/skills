---
name: onchainhoodies
description: Inspect OnChainHoodies NFTs and HoodOS token-bound HoodWallets on Robinhood Chain, check NFT ownership, wallet activation, OCH cost and approval, and complete owner-authorized Hoodie activation with an optional ETH-to-OCH swap when needed. Use for requests such as "show my Hoodies", "inspect Hoodie #351", "what is my HoodWallet", "check activation", or "activate my Hoodie".
---

# OnChainHoodies for Bankr

Use the current Bankr user's wallet context. **Never use a fixed address as the user's wallet**, infer ownership from an X handle, or request private keys. The target chain is **Robinhood Chain mainnet (4663)**. Consult `references/contracts.md` before crafting contract interactions.

## Read-only discovery

1. Resolve the user's *currently authenticated Bankr EVM wallet address* using the host's supported wallet/portfolio context. If unavailable, ask the user to supply a **public address**; do not pretend it is automatically available. The X account and a local development address are not proof of NFT ownership.
2. For a particular Hoodie ID, read `ownerOf(tokenId)` on the NFT contract. Compare to the actual wallet executing any future transaction. If these differ, explain that `activate` cannot be submitted from the wrong owner. NFT ownership may be a smart contract and require a different execution route.
3. Read `walletOf(tokenId)`, `isActive(tokenId)`, `activationEnabled()`, `activationCost()`, and `paymentToken()` from HoodOS. Note: `walletOf` is a deterministic address and is **not proof of deployment**.
4. Check ERC-20 `balanceOf(owner)` and `allowance(owner, HoodOS)` on the token returned by `paymentToken()`, plus native ETH for gas.
5. Provide the owner, wallet, active/inactive status, **live** cost (not a hardcoded 2,500 OCH), payment-token contract, required allowance, and any blocker. If token ownership has moved, activation may have reset.

For a local, independent read-only diagnostic (requires Node.js 20+ and `npm install`), run `node scripts/hoodie-info.mjs <tokenId> [walletAddress]`. The script does **not** access Bankr accounts or sign transactions. `RH_RPC_URL` may override the official public RPC.

For "show my Hoodies", use Bankr's NFT portfolio if available, filter by exact collection contract **and chain ID**, and cross-check each `ownerOf`. Do not claim that enumerating wallet holdings via the collection contract is universally supported. If the host has no reliable NFT inventory source, request token IDs rather than guess.

## Primary command: activate my Hoodie

**Treat the single command `@bankrbot activate my Hoodie #<id>` as an actionable request for the FULL workflow** (quote swap if short of OCH, swap if sufficiently funded, exact token approval if needed, contract activation, final on-chain verification). It is **not** merely a request to inspect status or explain prerequisites. Do not respond "you have 0 OCH, let me know if you want to acquire OCH" when Bankr can obtain it with the owner's available ETH. Begin the funding preflight and attempt the available swap workflow within the same request. The invocation expresses intent to activate, including the required OCH acquisition; it does NOT override any Bankr security confirmation, spending limits, quote protections, or transaction permissions.

**Decision table:**

- Already active -> return active status. No swap.
- Inactive, OCH balance >= current fee -> skip swap and continue to approval/activation.
- Inactive, OCH balance < current fee, ETH sufficient for safe quote plus gas -> attempt quote, swap, approval, activation in sequence using the installed Bankr tools and required permissions; do not ask for a *second* natural-language instruction to acquire OCH.
- Inactive, OCH shortfall, ETH too low / no safe swap quote -> stop and state the specific deficit, without a purchase.
- Bankr wallet policy explicitly blocks or requires user confirmation -> obey the host policy and describe the blocked or approval-pending action; never bypass it.

## Activate a Hoodie (one natural-language request)

Interpret **"Bankrbot, activate my Hoodie #351"** (or equivalent) as a request to complete the activation workflow, **including acquiring the missing OCH using a supported swap** if necessary. Do not force the user to request each intermediate step separately. Follow Bankr's own approval, transaction-signing and spending-policy safeguards; this skill cannot waive or override them.

1. **Preflight:** Resolve the currently authenticated Bankr signing wallet. Confirm chain ID **4663**, `ownerOf(tokenId) == signer`, and fresh HoodOS state (`activationEnabled()`, `isActive(tokenId)`, `activationCost()`, `paymentToken()`, `walletOf(tokenId)`). If already active, return the wallet details without swapping or spending. If owner mismatch or activation disabled, stop.
2. **Check funding:** Read signer OCH balance, allowance to HoodOS and native ETH for gas. Compute the exact shortfall as `max(0, activationCost - tokenBalance)` in token base units. **Do not buy extra OCH if enough is already held**. Keep sufficient ETH for the swap, any required approval, activation, and a gas buffer.
3. **Acquire shortfall when needed:** Use Bankr's supported swap/quote tools for **Robinhood Chain (4663)**, checking exact token contract addresses and the actual **minimum output after slippage**. Request an exact-output swap of the missing OCH when available; otherwise quote an exact-input swap whose guaranteed minimum output covers the shortfall, with fees and gas included. If the available ETH cannot safely cover the route and gas, there is no supported liquid route, the minimum output is too low, or slippage/price impact exceeds the user's stated limits or Bankr's protections, **do not execute**; explain what is missing. Do not invent a price, use cross-chain assets without explicit authorization, or choose an unrestricted swap. Have Bankr apply its normal spend authorization; never bypass a confirmation required by its wallet tools.
4. **Wait and recheck:** After the swap is confirmed, reread OCH balance and activation conditions. Do not continue if the balance is below the **live** activation cost or if signer/owner changed.
5. **Approve only if necessary:** If `allowance(owner, HoodOS) < activationCost`, call the live payment token's `approve(HoodOS, activationCost)` from the owner wallet via Bankr's supported transaction tool. Use **exact amount**, not unlimited approval. Respect any required authorization, await confirmation, and reread allowance. If already sufficient, skip this step.
6. **Activate:** Recheck ownership and live cost, then call `HoodOS.activate(tokenId)` from the same owner wallet, subject to Bankr's required transaction authorization. Wait for a confirmed receipt. Stop if any transaction fails; do not retry financial actions blindly.
7. **Verify:** Reread `isActive(tokenId)` and `walletOf(tokenId)`. Report verified result, final wallet address and observed transaction hashes. Say "activation pending" if chain confirmation has not occurred; never say "activated" on an unverified submit.

**Conversation style:** Keep user prompts simple. Prefer a single brief readiness/cost summary when Bankr requires confirmation; otherwise run supported sequential steps after the user's activation request. If funding is insufficient, say how much ETH/OCH is missing rather than requesting a series of manual commands. Do not claim autonomous execution is available in every Bankr surface.

**Bankr compatibility:** An installed skill provides instructions, not permission to spend. Only use the Bankr tools available in the active agent/runtime. Installation in an individual account does not automatically enable this skill for all public @bankrbot replies on X.

## References

- `references/contracts.md`: addresses, ABI signatures, source-backed authorization and fees
- `references/bankr.md`: installation, host-wallet limitations, transaction checks
- `scripts/hoodie-info.mjs`: read-only local inspect tool
