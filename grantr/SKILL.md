---
name: grantr
description: Use Grantr MCP for account-safe Grantr backend workflows: Grantr vaults, Morpho savings, Bankr wallet interop, Fileverse documents, portfolio and balance reads, and agent-safe DeFi action preparation. Trigger when a user asks an agent to inspect or prepare Grantr actions, open or withdraw from savings positions, use Bankr with Grantr, write research or chat output to Fileverse, or connect a Grantr account through an MCP-capable agent.
---

# Grantr

Use the hosted Grantr MCP server as the runtime integration surface.

- MCP endpoint: `https://mcp.grantr.id/mcp`
- Agent account handoff: `https://grantr.id/agent/setup?source=bankr`
- Public contract and deeper docs: `https://github.com/grantr-id/grantr-agent-kit`

Grantr lets agents inspect live state and prepare actions while the account owner and wallet provider retain approval, signing, broadcast, policy, and revocation control.

## Core Rules

- Prefer Grantr MCP tools over raw HTTP calls or backend routes.
- Never invent balances, prices, APYs, vaults, routes, wallet addresses, positions, transaction hashes, Fileverse documents, or Bankr state.
- Never use fallback, demo, mock, sample, static, or hardcoded product data in runtime answers.
- Never execute value-moving actions without a prepared preview and explicit user or wallet-provider approval.
- Stop after returning unsigned transaction payloads unless the active wallet provider has a separate approved signing/broadcast flow.
- Do not request or expose API keys, vault secret paths, private keys, seed phrases, raw Fileverse tenant endpoints, arbitrary signing, arbitrary transaction submission, recovery controls, guardian controls, device-policy mutation, contact mutation, or OneClaw treasury internals.
- Do not use Bankr generic prompt execution as an unconstrained transaction path for Grantr actions.

## MCP Access Model

Use these public discovery tools before account setup:

- `grantr_get_capabilities`
- `grantr_get_execution_targets`

All other tools are non-discovery tools. They require MCP session owner context for a registered Grantr account before wallet, portfolio, savings, Bankr, Fileverse, or transaction receipt access is allowed.

If a tool reports `grantr_account_setup_required` or says account setup is required, stop the private workflow. Send the user to Grantr account setup, then retry only after the MCP session is reconnected or refreshed.

## Account Handoff

For Bankr-originated users, use this setup URL:

```text
https://grantr.id/agent/setup?source=bankr
```

Add only non-secret context when available, such as `intent=savings`, `intent=fileverse`, `ownerEoa`, `wallet`, or `bankrWallet`. Include `returnTo` only when the return target was supplied by Bankr or another trusted wallet provider. Never include auth tokens, API keys, signatures, session cookies, private keys, seed phrases, or raw MCP authorization material in a handoff URL.

## Bankr Context

Bankr is an optional wallet and distribution context, not a requirement. When Bankr wallet context is present in the MCP session or a Grantr tool result:

1. Use `grantr_resolve_wallet_context` to confirm owner, provider, and active wallet.
2. Use `grantr_get_bankr_wallet` to inspect linked Bankr wallet status when needed.
3. Treat the confirmed Bankr wallet as the active funding/signing wallet.
4. Let Bankr sign or broadcast only through its own explicit approval flow.

When Bankr is absent, stay provider-agnostic: use the active wallet context returned by Grantr MCP and return unsigned transactions for the user's wallet provider to approve.

## If Bankr Cannot Pass Context

If Bankr cannot pass wallet or session context into the MCP connection, do not ask for Bankr API keys and do not continue with private Grantr tools. Use this fallback:

1. Call only public discovery tools.
2. Send the user to `https://grantr.id/agent/setup?source=bankr`, adding safe context such as `intent=savings` when useful.
3. Ask the user to create or sign into their Grantr account and link their Bankr wallet inside Grantr.
4. Ask the user to return to Bankr and retry the original prompt after setup is complete.
5. On retry, use `grantr_resolve_wallet_context` and `grantr_get_bankr_wallet` to confirm the link before any private action.

## Financial Action Pattern

1. Discover live opportunities or current positions through Grantr MCP.
2. Confirm the MCP session is tied to a registered Grantr account.
3. Resolve wallet context and inspect balances, execution target, and relevant positions.
4. Prepare unsigned transactions through a `grantr_prepare_*` tool.
5. Present the summary, net APY or relevant economics, requirements, warnings, expiry, and each transaction.
6. Stop before signing or broadcast unless a separate wallet-provider approval flow is available and the user explicitly approved it.

Example for a Bankr user asking to open a Savings Position:

1. Resolve wallet context and confirm the active provider is Bankr.
2. Call `grantr_list_savings_opportunities` and use only live results.
3. Ask the user for missing asset, amount, chain, or vault choices.
4. Call `grantr_get_balances` and `grantr_prepare_savings_deposit`.
5. Present asset, amount, vault, chain, net APY, requirements, approval/deposit transactions, warnings, and expiry.
6. Tell the user no transaction has been signed or broadcast yet.
7. Hand signing and submission to Bankr only after explicit approval.

## Fileverse Action Pattern

Use this when the user asks to write chat output, research findings, notes, or generated content to Fileverse:

1. Draft the document from the chat, notes, or research.
2. Redact secrets, signatures, auth challenges, API tokens, private keys, seed phrases, and wallet-auth material.
3. Ask for confirmation before writing user-owned or consequential content.
4. Use Grantr MCP Fileverse tools to create, update, share, or import documents.
5. If Bankr is linked and the user asks for it, import or sync the Fileverse document into Bankr files only after the Fileverse write succeeds.

## References

- Read `references/mcp-tools.md` for the full public/private tool split and tool groups.
- Read `references/workflows.md` for detailed savings, Fileverse, and Bankr interop flows.
