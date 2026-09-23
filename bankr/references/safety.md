# Safety & Access Control Reference

Bankr has two independent layers of controls: **wallet-level** settings at [bankr.bot](https://bankr.bot) → Security, which apply to every surface, and **per-API-key** settings at [bankr.bot/api-keys](https://bankr.bot/api-keys), which apply to one key. A transaction must pass both.

## Wallet-Level Security Settings

These are enforced where transactions are signed, so they cover chat, the agent, the Wallet API, the CLI and x402 alike. Changing them needs a signed-in web session, plus a passkey step-up when MFA is on. An API key can't change them, and no API-key endpoint returns them (a swap quote does report your price-impact ceiling).

| Control | Default | Effect |
|---------|---------|--------|
| Pause all transactions | Off | Blocks every outbound transaction until unpaused |
| Enable arbitrary contract calls | On | While off, blocks the agent's `write_contract`, `submit_raw_transaction` and `deploy_contract` tools and raw `/wallet/submit`. Named operations like swaps and transfers still work |
| Daily spending limit | $500 per rolling 24h | Rejects a transaction that would push USD outflow past the limit |
| Per-transaction limit | $500 | Rejects any single transaction priced above the limit |
| Price impact limit | On, 15% | Rejects a swap whose estimated price impact exceeds the limit (adjustable 1–100%) |
| Permitted recipients | Off | Only allowlisted addresses (plus your own) can receive funds; new entries wait out a cooldown |
| Response channels | All on | Per channel (X, Farcaster, Telegram). Bankr stops replying on a disabled channel; Telegram `/start` and wallet linking stay live |

USD limits accept `1` to `1,000,000`. `0` is rejected, so disable the limit instead. The recipient cooldown is `0` to `168` hours (default 24), and re-adding a removed recipient restarts it.

### Spend limits are enforced everywhere

A wallet that has never opened the Security page is still capped at **$500 a day and $500 per transaction**, on every signing path: agent tools, Wallet API swaps (the sell side is priced, cross-chain and Solana legs included) and transfers, raw `/wallet/submit`, x402 paid calls, and direct signer callers. If an integration needs to move more, raise the limit deliberately.

- Each transaction is priced at submission from on-chain quotes (0x on EVM, Jupiter on Solana). If pricing fails while a USD limit is on, the transaction is **rejected**, not waved through.
- Successful transactions count toward the rolling 24h total. The spend log is keyed on transaction hash, so retries can't inflate it.
- Raw `/wallet/submit` has its own rules (the native `value` is priced, calldata counts as $0, and a `403` comes in two shapes). See [sign-submit-api.md](sign-submit-api.md).

### Timed windows

Instead of changing a control indefinitely, you can turn the daily, per-transaction or price-impact limit **off**, or arbitrary contract calls or a response channel **on**, for **10, 30, 60 or 1440 minutes**.

- A deadline only ever resolves toward the safer state. A limit turns itself back on; arbitrary calls and a response channel switch back off.
- Deadlines resolve at read time, so an expired window is already in force at the next transaction.
- Any explicit edit to a control (toggling it or changing its amount) replaces its timer.
- The server computes the deadline from the duration you pick. A client-supplied timestamp is rejected.

A long-running integration shouldn't cache "the limit is off": the window can close without notice.

### Price impact limit

Before a swap is signed, Bankr estimates its price impact and rejects it above your limit. This stops catastrophic fills on thin pools while leaving normal trading alone. If impact can't be estimated, the check fails open, and slippage and minimum-received bounds still protect the fill.

- Over the Wallet API the check uses the quote's fee-exclusive `swapImpactBps`, not `priceImpactBps` (the display figure, which folds in token taxes). The quote also returns your ceiling as `maxPriceImpactBps` (`null` when protection is off), so you can decide before executing.
- A `403` from `/wallet/swap` is your own protection rejecting the fresh execution quote, not an auth or location failure. A `400` with `price_impact_too_high` is the venue refusing a trade its pool can't absorb, so retry smaller.
- **One venue fails closed.** A new Solana token still on its Raydium LaunchLab bonding curve reports no impact figure, so with the limit on, that fallback is refused as no-route. Turn the limit off if you need those fills.

### Token guards

- **Never trade an address copied out of a balance listing.** Airdropped dust that reports a canonical ticker (`USDG`, `USDC`, `USDT`, `EURC`, a native or wrapped symbol) from the wrong address is a standing attack on agents. Bankr treats a negative security verdict on that shape as decisive, so the dust drops out of the portfolio listing. Genuine canonical tokens and tokens you bought through Bankr are never hidden. Name the **ticker** and let Bankr resolve it to the vetted contract.
- The agent refuses to swap a few protected tokens where a swap is almost always a costly mistake, such as staked Avantis (AVNT) on Base. The token stays visible and transferable; exit through its redeem flow.

## API Key Controls

Every key uses the `bk_...` format and carries independent settings, managed at [bankr.bot/api-keys](https://bankr.bot/api-keys). Editing, rotating and revoking a key need a signed-in session (plus a passkey step-up when MFA is on), so an API key can't change its own settings.

| Setting | Gates | New-key default |
|---------|-------|-----------------|
| `walletApiEnabled` | `/wallet/swap-quote`, `/wallet/swap`, `/wallet/transfer`, `/wallet/sign`, `/wallet/submit`, `/wallet/x402-pay` and creator-fee claims. `/wallet/me` and `/wallet/portfolio` work with any key | On |
| `agentApiEnabled` | `/agent/*`: prompt, job status, cancel, project pages | On |
| `tokenLaunchApiEnabled` | `/token-launches/deploy` and the agent's launch tool | On |
| `llmGatewayEnabled` | `llm.bankr.bot` and `/llm/credits/*` | Off |
| `readOnly` | See [Read-only keys](#read-only-keys) | Off (keys from `bankr login siwe` start read-only) |
| `allowedIps` | IP and CIDR allowlist | Empty, so any IP |
| `allowedRecipients` | EVM and Solana send allowlist | Empty, so any address |

One key can serve the Agent API, the Wallet API and the LLM gateway. A separate gateway key (`BANKR_LLM_KEY` or `llmKey`) lets you revoke gateway access on its own; see [llm-gateway.md](llm-gateway.md). Each `bankr login email` mints a new key, and the dashboard and email login stop at 30 active keys per account, so revoke stale keys rather than piling them up.

### Read-only keys

- Wallet API writes (`/wallet/swap`, `/wallet/transfer`, `/wallet/sign`, `/wallet/submit`, `/wallet/x402-pay`), token deploys and fee or vesting claims answer `403`. Reads work, including `/wallet/swap-quote`.
- `/agent/prompt` still works, but the agent session gets only read tools (prices, balances, portfolio, research). Asked to transact, it explains that the key is read-only.
- **Read-only doesn't cover account endpoints.** Bankr Club, LLM credit top-ups, Files, x402 Cloud, Webhooks and project pages don't check it, so a read-only key can still buy a Club subscription or, with the gateway flag, top up credits from the wallet.

### IP allowlist

`allowedIps` takes single IPs and CIDR ranges. IPv4 ranges must be `/8` or narrower and IPv6 `/16` or narrower; broader ranges are rejected. api.bankr.bot checks it at authentication, before any endpoint runs, and a request from elsewhere gets `403 IP address not allowed`. The LLM gateway (llm.bankr.bot) doesn't enforce it, so don't rely on the allowlist to fence a gateway key.

### Recipient allowlist

`allowedRecipients` limits where this key can send: agent tools with a known recipient, `/wallet/transfer` (checked against the EVM list only, since the endpoint is EVM-only; a Solana-only allowlist doesn't restrict it), and a deploy's fee recipient. Your own addresses always pass. It's independent of the wallet's permitted recipients, and when both are set, both must pass.

**A non-empty allowlist on either chain also refuses operations whose recipient can't be checked:**

- Polymarket buys and sells.
- NFT purchases, Seadrop and Manifold mints, listings, accepting offers and creating collection offers.
- Airdrops (both the general and the top-members tool), and scheduled prompt automations.
- Over the Wallet API: every `/wallet/submit`, and `/wallet/sign` for `eth_signTransaction` and `eth_signTypedData_v4` (`personal_sign` still works). These answer `403 Restricted API key`.

The agent's error names the action and points at the key administrator. It isn't transient, so retrying won't help. Swaps are unaffected because their output returns to the wallet. If an agent needs these operations, give it a key without an allowlist and bound it with wallet spend limits and an IP allowlist instead.

### Rotation and revocation

Rotate or revoke keys at [bankr.bot/api-keys](https://bankr.bot/api-keys); there's no key-authenticated endpoint for either. Rotation atomically issues a new key and deactivates the old one. The new key keeps the old one's name, every capability flag, the read-only setting, both allowlists and any custom daily limit, so it needs no re-hardening. Afterwards update wherever the key lives: the host's credential store, `BANKR_API_KEY`, or the CLI config (`bankr login --api-key <new key>`). A rotated or revoked key answers `401 Invalid API key`.

## Rate Limits

### Agent API prompts

`/agent/prompt` has a message quota per account, shared by all its keys, over a rolling 24 hours that starts at the first message:

| Account | Prompts per 24h |
|---------|-----------------|
| Bankr Club | 1,000 |
| No Club, with Max Mode and LLM credit | 100 |
| No Club, no Max Mode | None: `403 subscription_required`, with a `remediation` list |

Max Mode means `maxMode` on the request or a Max Mode model saved on the wallet, with a positive credit balance (see [llm-gateway.md](llm-gateway.md)). A custom daily limit that Bankr sets on a key replaces the 100 or 1,000. An exhausted quota answers `429`:

```json
{
  "error": "Daily limit exceeded",
  "message": "You have reached your daily API limit of 100 messages. Upgrade to Bankr Club for 1000 messages/day. Resets at 2025-01-15T12:00:00.000Z",
  "resetAt": 1736942400000,
  "limit": 100,
  "used": 100
}
```

`resetAt` is a Unix timestamp in milliseconds.

### Other limits

- Wallet API writes (`/wallet/swap`, `/wallet/transfer`, `/wallet/sign`, `/wallet/submit`) are limited to 10 requests per minute per IP.
- Minting keys (the dashboard, `bankr login email`, `bankr login siwe`) is limited to 20 attempts per hour per IP.
- Token launches have their own quotas; see [token-deployment.md](token-deployment.md).

Every limit answers `429`. Back off before retrying, and see [error-handling.md](error-handling.md).

## Credentials

The CLI keeps keys in `~/.bankr/config.json`, which it creates readable by your user only. `bankr logout` deletes the file but doesn't revoke the key. `BANKR_API_KEY` and `BANKR_LLM_KEY` override the file, so prefer them on servers and in CI. Never commit either, and never put a key in client-side code.

The controls above are enforced on the key server-side, so they apply the same way to the CLI and to direct REST calls (the IP allowlist on api.bankr.bot only).

### Host-Managed Credentials (no key on disk)

Sandboxed agents — cloud VMs, hosted assistants, CI runners — do not keep the key
in `~/.bankr/config.json`. The host holds it and supplies it either **in the
process**, as `BANKR_API_KEY`, or **at the network layer**, where an egress proxy
attaches it to outbound requests. Where the value is a stand-in it will not look
like a `bk_...` key; that is correct, not a misconfiguration.

**When `BANKR_API_KEY` is set** — the real key, or a surrogate the host swaps for
the real one at the network boundary — use the CLI as normal. It reads the
variable itself and needs no `bankr login`:

```bash
bankr whoami
bankr wallet portfolio
bankr agent "swap 10 USDC for ETH"
```

**When it is unset and a proxy attaches the credential**, the CLI cannot be used:
it requires a key in the environment or on disk and exits with "Not
authenticated" before any request leaves the process, so the proxy never sees
one. Call the API directly and let the proxy fill the header:

```bash
curl -s https://api.bankr.bot/wallet/portfolio
```

**An unset `BANKR_API_KEY` is not proof that nothing is configured.** Try the call
first: if it succeeds, the host is authenticating you. Never respond to an empty
variable by running `bankr login` or asking the user to paste a key — and do not
send `-H "X-API-Key: "`, since a proxy that only fills absent headers will leave
the empty value in place.

## Running an Agent

Run autonomous agents from a **separate Bankr account** (a different email), so a leaked key or a misbehaving agent can only reach that wallet. Give its key only the flags it needs, turn on read-only unless it must transact, set an IP allowlist for fixed egress, and set a recipient allowlist when it pays a known set of addresses. Keep wallet limits sized to the job. Fund the wallet with only what it needs, including native gas, since raw submissions and contract calls pay their own.

## Incident Response

If you suspect a key is compromised:

1. **Pause** the wallet at [bankr.bot](https://bankr.bot) → Security. This blocks every outbound transaction, including ones from agent jobs and automations already running. Revoking the key alone doesn't stop work already past authentication.
2. **Sign out of all** sessions, from the Active sessions panel under Security, if you suspect the account rather than one key. It ends every live session, including the device you're on, but doesn't touch API keys.
3. **Revoke** the key at [bankr.bot/api-keys](https://bankr.bot/api-keys), or rotate it if a deployment still needs one.
4. **Audit** recent transactions, agent jobs and automations before unpausing. Automations are bound to the wallet, not the key, so revoking a key doesn't stop them.
