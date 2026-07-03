# Grantr MCP Tools

Use the hosted Grantr MCP server as the only normal runtime integration surface.

- Endpoint: `https://mcp.grantr.id/mcp`
- Public Grantr account handoff: `https://grantr.id/agent/setup?source=bankr`
- Do not call raw Grantr backend routes from an end-user agent workflow.

## Discovery vs Non-Discovery

Discovery tools are safe, read-only tools that can be called before the user has completed Grantr account setup:

- `grantr_get_capabilities`
- `grantr_get_execution_targets`

Non-discovery tools are every other Grantr MCP tool. They require MCP session owner context for a registered Grantr account before access to wallet, portfolio, savings, Bankr, Fileverse, or transaction receipt data.

If a non-discovery tool returns `grantr_account_setup_required`, stop and use the account handoff URL. Do not keep retrying private tools until the account is set up and the MCP session has been refreshed.

## Tool Groups

### Capability and Target Reads

- `grantr_get_capabilities`: Return Grantr MCP version, endpoint, tool names, and safety policy.
- `grantr_get_execution_targets`: Read Grantr-supported execution targets. Treat the backend response as authoritative for visibility and defaults.

### Wallet and Portfolio Reads

- `grantr_resolve_wallet_context`: Resolve owner, active wallet provider, active wallet address, and optional Bankr context from MCP session metadata.
- `grantr_get_balances`: Read live balances for the context owner wallet.
- `grantr_get_portfolio_snapshot`: Read a small live portfolio snapshot for the context owner wallet. Do not poll.

### Savings

- `grantr_list_savings_opportunities`: Discover live Grantr/Morpho savings opportunities.
- `grantr_get_savings_positions`: Read current Grantr/Morpho savings positions for the context owner wallet.
- `grantr_prepare_savings_deposit`: Prepare unsigned approval/deposit transactions. This tool never signs or broadcasts.
- `grantr_prepare_savings_withdraw`: Prepare unsigned withdraw/redeem transactions. This tool never signs or broadcasts.
- `grantr_get_transaction_receipt`: Read transaction inclusion status for a prepared or submitted Grantr savings transaction.

### Bankr

- `grantr_get_bankr_wallet`: Inspect linked Bankr wallet status for the context owner.
- `grantr_link_bankr_wallet`: Complete a Grantr-issued Bankr link session with explicit owner auth. Never pass raw Bankr API keys through MCP.

### Fileverse

- `grantr_get_fileverse_connector`: Inspect Fileverse connector status.
- `grantr_list_fileverse_documents`: List documents available to the Grantr account.
- `grantr_get_fileverse_document`: Read one document.
- `grantr_create_fileverse_document`: Create a document after redaction and confirmation.
- `grantr_update_fileverse_document`: Update a document after redaction and confirmation.
- `grantr_share_fileverse_document`: Share a document with another EVM address.
- `grantr_import_fileverse_document_to_bankr`: Import a selected Fileverse document into Bankr files when Bankr is linked.

## Do Not Expose

- Raw backend HTTP proxy access.
- API keys, vault secret paths, environment config, database state, or private backend URLs.
- Arbitrary signing, arbitrary transaction submission, `signDigest`, private key export, or OneClaw treasury internals.
- Recovery, guardian, device policy, contact mutation, or key rotation by default.
- Bankr generic prompt execution as an unconstrained transaction path.
- Fileverse backend API keys or raw Fileverse tenant endpoints.
- Portfolio or history polling loops.
- Fallback, mock, demo, sample, static, or hardcoded product values.
