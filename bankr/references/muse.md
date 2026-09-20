# Meta Muse & Cloud-VM Agents Reference

How to connect Bankr correctly when the host agent runs on a cloud VM with a secure credential store — Meta Muse today, and any agent with the same shape. Muse builds its own "custom connector" from this skill, the CLI and the public docs, so this file is what it reads to get the credential flow and the call pattern right.

**Public docs**: [Connect Bankr to Muse](https://docs.bankr.bot/guides/connect-bankr-to-muse) | [OpenAPI spec](https://docs.bankr.bot/openapi/bankr-api.yaml) | [llms.txt](https://docs.bankr.bot/llms.txt)

## When This Applies

Muse runs each user's agent on a cloud Linux VM, not on the user's machine. Three facts drive everything below:

| Fact | Consequence |
|------|-------------|
| Credentials live in Muse's **Secure credentials store** (a card in chat). Muse swaps a surrogate for the real key at the network boundary | The real key must never be pasted into chat or left on the VM disk. Store it under the name `BANKR_API_KEY` |
| Muse asks the human to approve consequential actions before executing them | Anything that moves funds goes through that approval step, with the quote or amount in front of the user |
| The VM cannot reach `localhost` or the user's machine | Nothing in this skill that assumes a local browser, local service, or local file on the user's computer applies |

If the host is not a cloud-VM agent with a credential store, follow the standard [SKILL.md](../SKILL.md) login flow instead.

## Credential Handling in Muse

### The store, and the rotate rule

The key belongs in the secure store as `BANKR_API_KEY`, and it should get there without ever passing through the chat or through the agent's context. **Rotation** is how: bankr.bot/api-keys has a **Rotate Key** action (web session, passkey step-up if MFA is on) that issues a replacement with the same name and permissions and deactivates the old key atomically. Whatever copy existed before, on a laptop, in a config file, in a transcript, stops working the moment the store's copy starts.

**Never mint a second key "with the same permissions" for the store.** Rotate the one that exists. A duplicate doubles the revocation surface and leaves the original live wherever it was.

### User already has a key (most common)

Skip login entirely. Ask the user to open [bankr.bot/api-keys](https://bankr.bot/api-keys), rotate the key they want Muse to use (or add it as is if it was created for Muse and has never lived anywhere else), and add the new key through the credentials card as `BANKR_API_KEY`. Then verify:

```bash
bankr whoami
```

Never run `bankr login --api-key` on the VM just to check a key: that writes it to disk again.

### Creating the key from inside Muse

`bankr login email` works headless on the VM but saves the key to `~/.bankr/config.json`. Do not read that file to copy the key into the store. Rotate instead:

```bash
# 1. Headless login (see SKILL.md "Headless email login" for the Terms of Service step)
bankr login email user@example.com
bankr login email user@example.com --code 123456 --key-name "Muse Agent" --no-token-launch

# 2. Ask the user to rotate the "Muse Agent" key at bankr.bot/api-keys and add the
#    NEW key to the secure store as BANKR_API_KEY (through the credentials card)

# 3. Delete the stale on-disk copy, then verify from the store alone.
#    The CLI reads BANKR_API_KEY over the config file.
bankr logout
bankr whoami
```

REST equivalent of the check if the CLI is not the calling path:

```bash
curl "https://api.bankr.bot/wallet/me" -H "X-API-Key: $BANKR_API_KEY"
```

### Rotation and leaks

There is no API-key-authenticated rotate endpoint, so the agent cannot rotate its own key; rotation is a dashboard action the user takes. That is deliberate: a leaked key must not be able to mint its successor. If a key was ever pasted into chat, treat it as leaked: ask the user to pause the wallet at bankr.bot (Security), rotate the key, and update the store entry; then re-run `bankr whoami`.

## Recommended Key Setup

Key defaults are broad: Wallet API, Agent API and Token Launch all on, read-write. Narrow them for an agent that runs unattended on someone else's VM.

| Setting | Recommendation | Flag / where |
|---------|----------------|--------------|
| Account | A dedicated Bankr account and wallet for the agent, funded with small amounts | Sign up with a separate email; see [safety.md](safety.md) "Dedicated Agent Wallet" |
| Read-only | On, unless the user explicitly wants Muse to trade or transfer | `--read-only` |
| Token launch | Off | `--no-token-launch` |
| Recipients | Allowlist the user's own addresses if transfers are wanted | `--allowed-recipients 0x...,...` |
| IP allowlist | Optional; only if the VM's egress IP is stable | `--allowed-ips <cidr>` |
| Preset | `--preset agent`, `--preset trading-agent` or `--preset full` bundle the above | Available from @bankr/cli versions that list `--preset` in `bankr login email --help`; otherwise use the explicit flags |

Wallet-level limits ($500/day, $500 per transaction, 15% price impact, all surfaces) still apply on top of the key flags and can only be changed at bankr.bot with web login — see [safety.md](safety.md).

## How to Call Bankr from Muse

**Typed commands first.** They are deterministic, fast and easy for Muse to show the user before running. Use them for prices, balances, quotes, swaps and transfers:

```bash
bankr wallet portfolio --chain base
bankr tokens info ETH
bankr wallet swap --from ETH --to USDC --amount 0.1 --chain base --quote-only
bankr wallet swap --from ETH --to USDC --amount 0.1 --chain base
bankr wallet transfer --to vitalik.eth --token USDC --amount 50 --chain base
```

**`bankr agent` as the fallback** for what typed commands don't cover: automations, Polymarket, research, cross-chain or Solana swaps, and multi-step asks. It returns a job; poll it:

```bash
bankr agent prompt "Create an automation: buy $10 of ETH every Monday"
bankr agent status <jobId>
```

**REST equivalent** when Muse calls the API directly rather than through the CLI — `POST /agent/prompt` returns `202` with a `jobId`; poll `GET /agent/job/{jobId}` every 2 seconds until `completed` or `failed`. Full pattern in [api-workflow.md](api-workflow.md). Wallet endpoints (`/wallet/*`) are synchronous and need no polling.

## Approvals

Muse's approval step is the last line of defence, so feed it something reviewable:

- **Quote before swap.** Run `--quote-only` first, show the user what they pay, what they receive and the minimum received, then run the real swap only after approval.
- **Surface every fund-moving action.** Typed `swap` and `transfer` commands are obvious; less obvious are `bankr agent` prompts that trade, transfer, place Polymarket bets or create automations that will spend later. Route those through the approval step too, with the prompt text shown verbatim.
- **Keep reads unapproved.** Portfolio, prices, token info and `agent status` never move funds; asking for approval on them trains the user to click through.
- **One action per approval.** Don't batch a quote and its execution, or several transfers, behind one approval.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401` | Key missing, wrong, revoked or rotated away; often the store entry is not named `BANKR_API_KEY`, or it still holds the pre-rotation key | Check the store entry name, then `bankr whoami`; recreate the key if it was revoked |
| `403` | Key is valid but lacks the capability: read-only key on a write, Agent API off, Token Launch off | Adjust the key at [bankr.bot/api-keys](https://bankr.bot/api-keys) or mint a correctly scoped one (and retire the old one) |
| Key visible in the chat transcript | It was pasted instead of entered via the credentials card | Rotate at bankr.bot/api-keys (old key dies with it), add the new key through the card |
| `bankr whoami` works before `logout` and fails after | Store not populated, not injected into the CLI's environment, or the key was rotated but the store still holds the old one | Re-add the current `BANKR_API_KEY` to the store, then retry; `bankr login --api-key` is the last resort and re-creates the on-disk copy |
| `ECONNREFUSED localhost:*` or "open this URL in your browser" | Something assumed the user's machine | Use the hosted URL (`bankr.bot/...`) and ask the user to open it themselves; MFA approval links work this way |
| Key still on disk | `bankr logout` was skipped | Run `bankr logout`, then confirm `~/.bankr/config.json` has no `apiKey` |

For the rest of the error catalogue, see [error-handling.md](error-handling.md).
