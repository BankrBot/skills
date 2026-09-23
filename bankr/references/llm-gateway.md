# LLM Gateway Reference

The Bankr LLM Gateway is one OpenAI- and Anthropic-compatible API for Claude, GPT, Gemini, Grok and open-weight models (DeepSeek, Qwen, Kimi, MiniMax, GLM), billed per token from LLM credits. Docs: [docs.bankr.bot/llm-gateway/overview](https://docs.bankr.bot/llm-gateway/overview).

- **Base URL:** `https://llm.bankr.bot`. Paths are normalized, so a base URL with or without `/v1` works for both SDK conventions.
- **Endpoints:** `POST /v1/chat/completions` (OpenAI), `POST /v1/messages` (Anthropic), `POST /v1/images/generations`, `GET /v1/models`, `GET /v1/credits`, `GET /v1/usage`.
- **Auth:** a Bankr API key with the **LLM Gateway** capability, sent as `X-API-Key` or `Authorization: Bearer`.
- **Dashboard:** [bankr.bot/llm](https://bankr.bot/llm) for usage, models, credits and settings. Keys live at [bankr.bot/api-keys](https://bankr.bot/api-keys).

## Keys

Any `bk_...` key works once LLM Gateway is enabled on it: pass `--llm` when logging in (see [SKILL.md → Get an API key](../SKILL.md#get-an-api-key)) or switch it on at bankr.bot/api-keys. A key without it gets `403`.

The CLI resolves the gateway key as `BANKR_LLM_KEY`, then `llmKey` in `~/.bankr/config.json`, then the regular API key. To use a separate gateway key, run `bankr login --api-key bk_... --llm-key bk_...` or `bankr config set llmKey bk_...`, and check it with `bankr config get llmKey`. Key capability flags are covered in [safety.md](safety.md).

## Models

Use bare, dotted IDs (`claude-opus-5.5`) in API calls and `bankr/<id>` in OpenClaw and OpenCode. The catalog changes often, so list it rather than guessing. `bankr llm models` prints the live IDs with the privacy tiers each supports (`--zdr` / `--private` filter the list). `GET /v1/models` adds context window, modalities and pricing, and the Models tab at bankr.bot/llm shows pricing too. Some current IDs:

| Provider | Examples |
|----------|----------|
| Anthropic | `claude-fable-5.1`, `claude-opus-5.5`, `claude-sonnet-5`, `claude-haiku-4.5` |
| Google | `gemini-3.8-flash` (the Bankr agent's default model), `gemini-3.1-pro`, `gemma-4-31b-it` |
| OpenAI | `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` |
| xAI | `grok-4.7`, `grok-4.20` |
| DeepSeek | `deepseek-v4-pro-0813`, `deepseek-v4.1-flash` |
| Alibaba | `qwen3.8-max`, `qwen3.8-flash`, `qwen3-coder` |
| Moonshot AI | `kimi-k3`, `kimi-k2.7-code` |
| MiniMax | `minimax-m3`, `minimax-m2.7-highspeed` |
| Z.ai | `glm-5.3`, `glm-5.3-flash`, `glm-5.3-flashx` (a faster, pricier sibling of Flash, not its successor) |

- Anthropic-style IDs work too: `claude-opus-4-8` and date-suffixed IDs map to the dotted form, and Claude Code's `[1m]` suffix is stripped.
- An unknown ID returns `400 unsupported_model`. Deprecated IDs leave the listing but keep working until removed (see [Model deprecation](#model-deprecation)).
- **Per-model discounts** (some for everyone, some for Bankr Club or partner wallets) are time-limited and applied automatically at billing. `GET /v1/models` shows a discount when one applies to you.

## Privacy Tiers

Every request runs at one of three nested tiers, and each includes the guarantees of the one below it.

| Tier | Guarantee | Coverage |
|------|-----------|----------|
| `standard` (default) | Never routed to a provider that trains on your prompts. Providers may still **retain** them. | Every model |
| `zdr` | Only providers with a zero-retention verdict for that model. | Subset: `bankr llm models --zdr` |
| `private` | TEE (hardware enclave) compute, attestation verified per request. Zero retention by construction. | Some open-weight models: `bankr llm models --private` |

**Every tier fails closed.** If no provider can serve the model at the requested tier, the request is rejected, never downgraded. There are four ways to ask:

1. **The `privacy` body field** (`"standard"`, `"zdr"` or `"private"`) on `/v1/chat/completions`, `/v1/messages` and `/v1/images/generations`:
   ```bash
   curl -X POST https://llm.bankr.bot/v1/chat/completions \
     -H "X-API-Key: $BANKR_LLM_KEY" -H "Content-Type: application/json" \
     -d '{"model": "glm-5.3-flash", "privacy": "zdr", "messages": [{"role": "user", "content": "Hello"}]}'
   ```
2. **A base-path prefix**, for tools that only take a base URL, key and model: `OPENAI_BASE_URL=https://llm.bankr.bot/zdr/v1` for OpenAI-compatible clients, `ANTHROPIC_BASE_URL=https://llm.bankr.bot/zdr` for Anthropic-compatible ones (Claude Code, OpenClaw). `/private` works the same way.
3. **A model-ID suffix:** `glm-5.3-flash:zdr`, `glm-5.3-flash:private`. Only a trailing tier token counts, matched case-insensitively, and it is stripped before model lookup.
4. **Account-wide:** turn ZDR on under **Settings** in the web terminal. Every request from the account then runs at that tier or stronger.

How the effective tier is decided:

- **The account setting and the request combine, and the strongest wins.** Nothing in a request, and no choice of base URL, can go below the account setting.
- **A tier endpoint is authoritative.** A request naming a *different* tier from the `/zdr` or `/private` path it was sent to is rejected in either direction. To mix tiers, send the `privacy` field to the default endpoint.
- **The `X-Privacy-Tier` response header** reports the tier actually applied, and it is set even when the request then fails. `private` responses also carry `X-Confidential-Verified` and the attested-identity headers. Image generation has no `private` tier.

| Status | Code | Meaning |
|--------|------|---------|
| `422` | `zdr_unavailable` | No zero-retention provider serves the model. Pick one from `bankr llm models --zdr`. |
| `422` | `confidential_unavailable` | No TEE provider serves the model at `private`. |
| `503` | `attestation_unverified` | The enclave's attestation couldn't be verified. It is never a silent downgrade. |
| `400` | `privacy_conflict` | The request named a different tier than its tier endpoint. |
| `400` | `invalid_privacy` | An unreadable `privacy` value, or a non-boolean legacy `zdr`/`private` flag. It is rejected rather than served at `standard`. |

## Max Mode

Max Mode runs the Bankr agent itself on a gateway model instead of its default (`gemini-3.8-flash`), billed per token from LLM credits. It is the pay-per-use alternative to Bankr Club for agent access, and it works with external/connected wallets, which Club checkout doesn't. Docs: [Max Mode](https://docs.bankr.bot/llm-gateway/max-mode).

- **Only frontier, flagship and balanced lines are offered.** Light models such as `claude-haiku-4.5`, `gpt-5.6-luna` or `glm-5.3-flash` stay available on the gateway API, but the Agent API answers `400` if you ask for one in Max Mode.
- **Per request:** `bankr agent "analyze my portfolio" --model claude-opus-5.5` (or `-m`), or `maxMode: { "enabled": true, "model": "<id>" }` on `POST /agent/prompt`. The CLI accepts only the two newest releases of each offered line and rejects other IDs before sending. The API also accepts an older release of an offered line while the gateway still serves it.
- **Wallet-wide:** choosing **Max** in the web terminal's composer mode menu, and a model in its picker, saves the choice on the wallet. It then applies everywhere: web, X, Farcaster, Telegram, automations, and CLI or API prompts sent without `--model`. If the gateway later removes the saved model, the saved choice moves to its replacement or the newest model in the same line; if Max Mode stops offering it, Max Mode is switched off. A removed model named explicitly in a request gets the `410` instead.
- **Credits are enforced per LLM call.** Your effective balance (spendable credit minus usage metered but not yet deducted) must be positive to start, and it becomes the run's budget, re-checked before every model call. When it runs out, the turn stops with its progress saved. The daily spend budget stops runs the same way.
- **Out of credits at the start:** the agent asks you to top up rather than answer. On X it quietly uses the default model instead of posting a public top-up reply.
- **Deduction is all-or-nothing.** A batch the balance can't fully cover leaves the balance untouched and the usage owed, and a later top-up settles it.
- On the Agent API, a wallet without Bankr Club needs Max Mode and credits to prompt, and is capped at 100 requests a day.

## Credits

LLM credits are a USD balance (1 credit = $1), separate from the trading wallet: holding crypto gives you no credits. **New wallets start at $0**, and every gateway request, reads included, returns `402 insufficient_credits` until you top up.

```bash
bankr llm credits                          # balance
bankr llm credits add 25                   # $1 to $1,000; defaults to USDC on Base
bankr llm credits add 25 --token USDT      # symbol or 0x address; the chain holding the most of it pays
bankr llm credits add 50 --token ETH -y    # native tokens work; -y skips the confirmation
bankr llm credits auto                     # show auto top-up
bankr llm credits auto --enable --amount 25 --threshold 5 --tokens USDC,USDT
bankr llm credits auto --disable
```

- The CLI pays on Base, Polygon, Ethereum, Arbitrum or BNB Chain. USDC and USDT are sent directly where the chain accepts them. Any other token is swapped to the chain's preferred stablecoin (USDC, or USDT on BNB) with a 5% slippage floor.
- The agent can do the same in chat ("Top up my LLM credits with $25 using USDT on Polygon") and reports the balance, including grants and when they expire ("How many LLM credits do I have left?"). On the web, use [bankr.bot/terminal/llm?tab=credits](https://bankr.bot/terminal/llm?tab=credits).
- **Expiring grants:** promotional or developer grants can carry an expiry. What you can spend is the purchased pool plus unexpired grants. Usage draws on grants first, soonest-expiring first, then the pool, and expired grants drop off on their own.

### Sending credits to another Bankr user

Ask the agent ("Send $20 of LLM credits to @alice"), use **Send Credits** on the web Credits tab, or call the API:

```bash
curl -X POST "https://api.bankr.bot/llm/credits/transfer" \
  -H "X-API-Key: $BANKR_API_KEY" -H "Content-Type: application/json" \
  -d '{"recipientAddress": "0xRecipient", "amountUsd": 20, "transferId": "my-unique-id"}'
```

The `/llm/credits/*` endpoints accept a key with LLM Gateway access or a signed-in web session. A transfer is a write, so read-only keys get `403`. It is atomic and final.

| Rule | Detail |
|------|--------|
| Recipient | Must already be a Bankr user. The agent takes an X username or a `0x` address, and the API takes the address. ENS names don't work here. |
| Amount | $1 to $500 per transfer, and at most $500 of principal per wallet per trailing 24 hours. |
| Default funding | Purchased credit only, minus usage that is metered but not yet deducted. |
| `useGrantedCredits: true` | Also spends granted credit (promos, operator grants, expiring grants). Granted credit is spent **first**, soonest-expiring first, and that portion carries a **10% burn fee charged on top**. The recipient gets exactly the amount, you are debited amount plus fee (`feeUsd` in the response), and the fee is credited to no one. Purchased credit covers any remainder for free. |
| Budget | Transfers and their fees count against your daily spend budget. |
| Wallet controls | A paused wallet can't send. The wallet's permitted-recipients list and a key's recipient allowlist apply as they do to on-chain sends. |
| Idempotency | Pass your own `transferId` (8 to 100 characters). A replay returns `status: "already-transferred"` with the original fee. The same ID with a different recipient or amount is a conflict. |

Errors carry a `code`:

- `400`: `self-transfer`. An amount outside $1–$500, or not a finite number, fails request validation first and answers `400` with `error.type` `VALIDATION_ERROR` and no `code`.
- `402`: `insufficient-credit`.
- `403`: `wallet-paused`, `recipient-not-permitted`.
- `404`: `recipient-not-found`, `recipient-invalid`.
- `409`: `transfer-conflict`, or `grant-confirmation-required`, which means purchased credit can't cover the send but granted credit can. The message quotes the fee, so resend with `useGrantedCredits` only if the user accepts it.
- `429`: `daily-cap-exceeded`, `daily-budget-exceeded`.

### Reading credit state

`GET /llm/credits/state` is the canonical read. It returns `creditBalanceUsd` (the purchased pool), `creditGrantsUsd` and `creditGrants[]` (live grants with `grantId`, `source`, `note`, `amountUsd`, `remainingUsd`, `expiresAt`), `totalCreditsUsd`, and `dailyBudget` (`limitUsd`, `spentUsd`, `remainingUsd`; a `limitUsd` of `null` means uncapped). `GET /llm/usage` holds usage history only. On the gateway, `GET /v1/credits` returns `balanceUsd`, `effectiveBalanceUsd` (net of unsettled usage) and, when a budget is set, a `dailyBudget` block with `exceeded`.

**Balance and budget are two different ceilings, and the smaller one binds.** Quote both. A wallet holding $265 that the rolling window has gated to $10 reads as missing money if you show only the budget, and as a timer if you name the budget as the binding limit. The $500-per-24-hours transfer cap applies on top of both.

### Daily spend budget

An optional cap on what the account can spend over a **trailing 24 hours**. Nothing resets at midnight: capacity returns as charges age out. It counts gateway usage from every key, Max Mode and app-invoked agent runs, and credit transfers you send, fees included.

- It is set or cleared under **Settings** at bankr.bot/llm, from a signed-in web session only. An API key can read it (through `/llm/credits/state` or `/v1/credits`) but can't change it. Changes take effect within about a minute.
- Over budget, spending requests get `402` with `type: daily_budget_exceeded`, which is different from `insufficient_credits`, so topping up won't help. `GET` endpoints keep working: poll `/v1/credits` for `dailyBudget.exceeded`, and use `/v1/usage` to see what used the budget.

## Coding Tools

**OpenClaw.** `bankr llm setup openclaw --install` writes a `bankr` provider into `~/.openclaw/openclaw.json`: every chat model, plus `:zdr` and `:private` variants where a model supports them, with Claude models on the Anthropic Messages API. Without `--install` it prints the config. `--images` also routes OpenClaw's image tool through the gateway (`gpt-image-2.5-flare`) by taking over its `openai` provider. Then set the default model and restart (`openclaw gateway restart`):

```json
{ "agents": { "defaults": { "model": { "primary": "bankr/claude-sonnet-5" } } } }
```

Before first use, check `bankr llm credits` shows more than $0. The step-by-step guide for every starting point is at [docs.bankr.bot/llm-gateway/openclaw](https://docs.bankr.bot/llm-gateway/openclaw).

**Claude Code.** `bankr claude [args]` (the top-level alias needs @bankr/cli 0.3.18+; `bankr llm claude` works on every version) launches Claude Code with `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` set from your config. Every argument is passed through, including `-h`/`--help`, which prints Claude Code's help without needing a login; use `bankr --help` for the CLI's own. Named commands win over the prompt fallthrough, so a prompt that starts with "claude" has to go through `bankr agent "..."`.

- **Model IDs:** Claude Code expects dashed IDs (`claude-opus-4-8`). `bankr claude` converts dotted ones for you. If you set the variables yourself instead (`bankr llm setup claude` prints the two `export` lines), pass dashed IDs, because a dotted `--model` makes Claude Code quietly fall back to its default model.
- **`[1m]`:** the suffix is optional through the gateway, since the 1M window comes from the model's own context window. If you do use it, quote it (`--model "claude-opus-5[1m]"`): zsh treats `[1m]` as a glob and aborts with `no matches found`. Inside `~/.claude/settings.json` it is already a string and needs no escaping.

**OpenCode.** `bankr llm opencode [args]` installs the Bankr provider into `~/.config/opencode/opencode.json` if it is missing, then launches OpenCode. `bankr llm setup opencode [--install]` prints or writes the config on its own. Models are `bankr/<id>`.

**Cursor.** `bankr llm setup cursor` prints the steps: your key as the OpenAI API key, `https://llm.bankr.bot/v1` as the base-URL override, then add model IDs. While the override is on, every Cursor model request goes through the gateway.

The launchers need the tool installed first. If it is missing, they print where to get it.

## Direct API and SDKs

Standard OpenAI and Anthropic SDKs work after a base-URL change:

```bash
# OpenAI format
curl -X POST https://llm.bankr.bot/v1/chat/completions \
  -H "Authorization: Bearer $BANKR_LLM_KEY" -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-5", "messages": [{"role": "user", "content": "Hello"}]}'

# Anthropic format
curl -X POST https://llm.bankr.bot/v1/messages \
  -H "x-api-key: $BANKR_LLM_KEY" -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-5", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello"}]}'
```

```python
from openai import OpenAI
client = OpenAI(base_url="https://llm.bankr.bot/v1", api_key="bk_...")
client.chat.completions.create(model="gemini-3.8-flash", messages=[{"role": "user", "content": "Hello"}])

from anthropic import Anthropic
client = Anthropic(base_url="https://llm.bankr.bot", api_key="bk_...")
client.messages.create(model="claude-sonnet-5", max_tokens=1024, messages=[{"role": "user", "content": "Hello"}])
```

Request and response formats: [API reference](https://docs.bankr.bot/llm-gateway/api-reference).

## Image Generation

`POST /v1/images/generations` mirrors OpenAI's Images API, so `images.generate()` in the OpenAI SDK works with only the base URL changed. The current models are `gpt-image-2.5-flare` (speed and volume, the usual choice), `gpt-image-2.5-sunburst` (precision) and the previous `gpt-image-2`, all priced the same.

```bash
curl -X POST https://llm.bankr.bot/v1/images/generations \
  -H "Authorization: Bearer $BANKR_LLM_KEY" -H "Content-Type: application/json" \
  -d '{"model": "gpt-image-2.5-flare", "prompt": "a neon city skyline at dusk"}'
```

- Generation only: there is no `/v1/images/edits`, so Sunburst's editing strengths aren't reachable yet. Streaming isn't supported, and `n` is capped at 4.
- Images are billed per image from the same credit balance. Image models advertise `output_modalities` and `pricing.image_output` in `GET /v1/models`.

## Model Deprecation

- **Soft-deprecated:** the request is served by the replacement model, and the response carries `X-Model-Deprecated: true` and `X-Model-Replacement: <id>`. The old ID no longer appears in the model listing.
- **Removed** (past its removal date): `410` with `type: model_deprecated` and `code: model_removed`. The error message names the replacement.
- Currently redirected: `gemini-2.5-pro` to `gemini-3.1-pro` and `gemini-2.5-flash` to `gemini-3.8-flash` until both are removed on 2026-10-20, and the Flash Lite IDs (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`) to `gemini-3.8-flash`.

## Troubleshooting

| Status | Cause and fix |
|--------|---------------|
| `401` | Missing, mistyped or revoked key. Check `bankr config get llmKey` or `$BANKR_LLM_KEY` for stray spaces. |
| `403` | The key doesn't have LLM Gateway access. Enable it at bankr.bot/api-keys. |
| `402 insufficient_credits` | The balance, after unsettled usage, is $0. Run `bankr llm credits add 25` or enable auto top-up. |
| `402 daily_budget_exceeded` | The daily spend budget is used up. Wait for the window or raise the cap; a top-up won't help. |
| `400 unsupported_model` | Unknown model ID. Check `bankr llm models`. |
| `410 model_removed` | Switch to the replacement named in the message. |
| `429 rate_limit_error` | More than 60 requests a minute from one key or one IP. |
| `503 provider_unavailable` | No provider is serving the model right now. Retry, or use another model. |

Privacy-tier errors are listed under [Privacy Tiers](#privacy-tiers).
