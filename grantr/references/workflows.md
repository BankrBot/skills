# Grantr Workflows

These flows apply to any MCP-capable agent. Bankr handling is optional and only applies when Bankr wallet or Bankr session context is provided.

## Open a Savings Position

Use this flow for requests such as "Use my Bankr wallet to open a USDC Savings Position in a Grantr vault."

1. Call `grantr_get_capabilities` and `grantr_get_execution_targets` if the current MCP capabilities or target set are unknown.
2. Call `grantr_resolve_wallet_context`. If account setup is required, send the user to `https://grantr.id/agent/setup?source=bankr` when coming from Bankr.
3. If Bankr context is present, call `grantr_get_bankr_wallet` and treat the confirmed Bankr wallet as the active funding/signing wallet.
4. Call `grantr_list_savings_opportunities` and use only live opportunities returned by MCP.
5. Ask the user to choose or confirm any missing amount, asset, chain, or vault.
6. Call `grantr_get_balances` for the active wallet context.
7. Call `grantr_prepare_savings_deposit`.
8. Present the prepared action: wallet/provider, chain, asset, amount, vault, net APY, requirements, approval transaction, deposit transaction, warnings, and expiry.
9. State that no transaction has been signed or broadcast.
10. Hand signing and broadcast to Bankr or another active wallet provider only after explicit approval.

## Withdraw from a Savings Position

1. Resolve wallet context and confirm account setup.
2. Call `grantr_get_savings_positions`.
3. Ask the user to choose the position and amount if ambiguous.
4. Call `grantr_prepare_savings_withdraw`.
5. Present chain, asset, amount, vault, expected result, transactions, warnings, and expiry.
6. Stop before signing or broadcast until the user approves through the active wallet provider.

## Write Research or Chat to Fileverse

Use this flow for requests such as "Write these research findings to Fileverse" or "Save this chat transcript to my Bankr files."

1. Resolve wallet context and confirm account setup for non-discovery tools.
2. Draft the document from the user's selected chat, notes, or research.
3. Redact secrets, auth challenges, signatures, API tokens, private keys, seed phrases, session cookies, and wallet-auth material.
4. Ask for confirmation before writing if the content is user-owned, sensitive, or consequential.
5. Call `grantr_get_fileverse_connector`.
6. Call `grantr_create_fileverse_document` or `grantr_update_fileverse_document`.
7. If the user asks to share, call `grantr_share_fileverse_document` with the confirmed recipient address.
8. If Bankr is linked and the user asks to sync to Bankr, call `grantr_import_fileverse_document_to_bankr` only after the Fileverse write succeeds.

## Account Setup Handoff

When Grantr MCP reports account setup is required:

1. Stop the private workflow.
2. Build a setup URL starting with `https://grantr.id/agent/setup?source=bankr` for Bankr-originated users, or `https://grantr.id/agent/setup?source=agent` otherwise.
3. Add only non-secret query parameters already present in context, such as `intent=savings`, `intent=fileverse`, `ownerEoa`, `wallet`, or `bankrWallet`.
4. Include `returnTo` only when it was supplied by Bankr or another trusted wallet provider.
5. Ask the user to complete Grantr setup and reconnect or refresh the MCP session before continuing.

Never include API keys, bearer tokens, signed messages, session cookies, raw auth headers, private keys, seed phrases, or raw Fileverse tenant details in the setup URL or saved documents.

## Bankr Context Fallback

If Bankr cannot pass wallet or session context to Grantr MCP:

1. Do not ask the user for a Bankr API key.
2. Do not pass Bankr API keys, bearer tokens, signed messages, or session cookies through MCP.
3. Use only `grantr_get_capabilities` and `grantr_get_execution_targets` until setup is complete.
4. Send the user to `https://grantr.id/agent/setup?source=bankr`, optionally with `intent=savings` or `intent=fileverse`.
5. Have the user create or sign into Grantr and link the Bankr wallet from the Grantr-controlled setup flow.
6. Ask the user to retry the original Bankr prompt after setup.
7. On retry, call `grantr_resolve_wallet_context` and `grantr_get_bankr_wallet` before any private tool or prepared transaction.

This fallback is less automatic than direct Bankr MCP session metadata, but it keeps user approval, wallet linking, and account ownership inside Grantr and Bankr-controlled flows.

## Reporting Prepared Actions

When reporting a prepared financial action, include:

- What will happen.
- Wallet/provider context.
- Chain and execution target.
- Asset, amount, vault, and net APY when relevant.
- Each transaction's label, target address, value, and purpose.
- Requirements, warnings, and expiry.
- A clear statement that the action has not been signed or broadcast.
