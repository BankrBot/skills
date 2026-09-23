---
name: bankr
description: Bankr is an AI crypto agent with its own wallets, a direct Wallet API and a pay-as-you-go LLM gateway, driven by the `bankr` CLI or the REST API. Use it when the user wants to trade or swap crypto or tokenized stocks, check balances, send tokens, trade perps or prediction markets, launch a token or claim its fees, automate orders, sign or submit transactions, call or deploy x402 paid endpoints, store files on their wallet, or use and pay for LLMs through Bankr. Chains: Base, Ethereum, Polygon, Solana, Unichain, World Chain, Arbitrum, BNB Chain, Robinhood Chain and Arc.
metadata:
  {
    "clawdbot":
      {
        "emoji": "📺",
        "homepage": "https://bankr.bot",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# Bankr

Bankr is an AI crypto agent that holds its own wallets. Two ways in, both using the same `bk_...` API key:

- **Bankr CLI** (`@bankr/cli`, recommended). It handles login, job polling and confirmations for you.
- **REST API** at `https://api.bankr.bot`. Use `/agent/*` for natural-language prompts (async jobs) and `/wallet/*` for direct, synchronous wallet operations.

This file is the entry point. Topic detail lives in [references/](references/) (read the one for your task before acting), in the docs at [docs.bankr.bot](https://docs.bankr.bot), and in the OpenAPI spec at `https://docs.bankr.bot/openapi/api.yaml`. **Fetch the spec instead of guessing a route or payload.** It is the authoritative request/response schema and can be newer than this skill.

## Get an API key

**Check whether you're already authenticated.** The host may supply the key, either as `BANKR_API_KEY` or through an egress proxy that attaches it to requests. Try `bankr whoami`, or make a request, before logging in, and never ask the user to paste a key just because the variable is empty. See [host-managed credentials](references/safety.md#host-managed-credentials-no-key-on-disk).

Signing up provisions an EVM wallet (one address on every EVM chain) and a Solana wallet, so there is nothing to set up by hand.

### Headless email login (recommended for agents)

Run `bankr update` first. The flow below works on @bankr/cli 0.3.38 and later. Pass `--accept-terms` and `--key-name` explicitly: from 0.3.39 a headless login accepts the Terms by itself and picks a unique key name, but on 0.3.38 a headless login without `--accept-terms` fails after the one-time code has been used, and an omitted key name defaults to `CLI-<date>`, which collides with a key created earlier that day.

1. `bankr login email <email>` sends a one-time code.
2. Ask the user for everything in **one** message:
   - the **code** from their email;
   - their go-ahead on the **[Terms of Service](https://bankr.bot/terms)**. Share the link and say plainly that step 3 accepts the Terms on their behalf. **If they decline, stop.**
   - any changes to the key defaults below, and a **key name** (an active key can't reuse a name).
3. Run `bankr login email <email> --code <otp> --accept-terms --key-name "<name>" [flags]`.

| New-key default | Flag to change it |
| --- | --- |
| Wallet API on | `--no-wallet-api` |
| Agent API on | `--no-agent-api` |
| Token Launch API on | `--no-token-launch` |
| Read-write | `--read-only` (for research or monitoring keys that must never transact) |
| LLM gateway off | `--llm` |

Optional hardening flags: `--allowed-ips <ips>` (IP/CIDR allowlist) and `--allowed-recipients <addresses>` (EVM/Solana send allowlist). After login, the `Features:` line shows what the key actually got.

- **The code is single-use.** From 0.3.39 the CLI retries dropped connections during login by itself. If step 3 fails, restart from step 1 for a fresh code; never re-run it with the same code.
- **Accounts with MFA on:** step 3 prints a `https://bankr.bot/mfa/confirm/...` link and waits up to five minutes for the user to approve with their passkey in a browser. Show the user the link, keep the command running and don't retry. If the link expires, fall back to an existing key (below).

### Other ways in

- **Existing key:** `bankr login --api-key bk_...`. Add `--llm-key <key>` if the user has a separate gateway key. To mint a key in the browser, `bankr login --url` prints the [bankr.bot/api-keys](https://bankr.bot/api-keys) link.
- **Sign-In with Ethereum:** `bankr login siwe --private-key 0x...`. These keys start **read-only**; pass `--read-write` to allow transactions.
- Confirm the login with `bankr whoami`.

## Bankr CLI

Install with `bun install -g @bankr/cli` (or `npm install -g @bankr/cli`), and update with `bankr update`.

**`bankr --help` and `bankr <command> --help` are the command reference**, and [docs.bankr.bot/cli](https://docs.bankr.bot/cli) has the full guide. Command groups: `wallet` (portfolio, transfer, swap, sign, submit), `agent` (prompt, status, cancel, skills), `tokens`, `launch`, `fees`, `project` (0.3.39+), `files`, `club`, `llm`, `x402`, `webhooks`, `config`, plus `login`, `logout` and `whoami`.

Behavior that `--help` doesn't spell out:

- **Anything that isn't a command is a prompt.** `bankr what is the price of ETH?` is the same as `bankr agent "what is the price of ETH?"`. Named commands take precedence, so a prompt that starts with a command word (`claude`, `launch`, …) has to go through `bankr agent "..."`.
- **The shell expands `$`.** In `"Buy $50 of ETH"`, `$5` expands to nothing and the agent sees `Buy 0 of ETH`. Use single quotes, pipe the prompt (`echo 'Buy $50 of ETH on Base' | bankr agent prompt`), or run `bankr agent prompt` with no argument for an interactive input.
- **Threads.** Every prompt runs in a thread. `-c`/`--continue` reuses the last thread and `--thread <id>` picks one.
- **Progress.** While a prompt runs, the CLI prints the agent's status lines to stderr (0.3.40+), so piped stdout carries only the response. `bankr agent status <jobId> --wait` (0.3.40+) follows an existing job.
- **Max Mode.** `-m`/`--model <id>` runs the prompt on a model from the Max Mode lineup, billed from LLM credits. An ID outside the lineup is rejected with the accepted list (see [LLM gateway](#llm-gateway)).
- **Non-interactive mode** (`--ni`, or `BANKR_NOT_INTERACTIVE=1`) implies `--yes` and fails fast instead of prompting. Commands that normally prompt then need their inputs as flags:
  - `login`: `--api-key`, `email … --code`, or `siwe --private-key`;
  - `launch`: `--name`;
  - `fees claim-wallet`: `--all`, plus `--private-key` or `BANKR_PRIVATE_KEY`;
  - `agent`: the prompt as an argument or on stdin.
- **Config** lives in `~/.bankr/config.json`; override the path with `--config <path>` or `BANKR_CONFIG`. Environment variables win over the file: `BANKR_API_KEY`, `BANKR_API_URL`, `BANKR_LLM_KEY` (falls back to the API key) and `BANKR_LLM_URL`. Read and write values with `bankr config get|set apiKey|apiUrl|llmKey|llmUrl`.
- **Deprecated aliases** still work but print a warning: `prompt`, `status`, `cancel`, `balances`, `sign`, `submit`, and `profile` / `agent profile` (now `bankr project`, 0.3.39+). On older versions `bankr project …` isn't a command, so the prompt fallthrough sends it to the agent as text; use `bankr agent profile` there.

## REST API

Base URL: `https://api.bankr.bot`. Send `X-API-Key: bk_...` on every request.

### Agent API: prompts (async)

1. `POST /agent/prompt` answers `202` with `{ jobId, threadId }`. Any other status means no job was created; read the body instead of polling.
2. Poll `GET /agent/job/{jobId}` every ~2 s until `status` is `completed`, `failed` or `cancelled`.
3. `POST /agent/job/{jobId}/cancel` stops a running job.

To continue a conversation, send the returned `threadId` with the next prompt.

Prompts need **Bankr Club**, or **Max Mode** with LLM credits (a `maxMode` model on the request, or one saved on the wallet). Without either, the request gets `403 subscription_required` with a `remediation` list. Club allows 1,000 prompts per rolling 24 hours; Max Mode without Club allows 100.

```bash
RESP=$(curl -s -X POST https://api.bankr.bot/agent/prompt \
  -H "X-API-Key: $BANKR_API_KEY" -H "Content-Type: application/json" \
  -d '{"prompt": "What is my ETH balance?"}')
JOB_ID=$(echo "$RESP" | jq -r '.jobId // empty')
if [ -z "$JOB_ID" ]; then echo "$RESP"; exit 1; fi   # no job: the body says why (403 subscription_required, 429, ...)
for _ in $(seq 150); do                               # 150 x 2 s = 5 min, the CLI's own cap
  R=$(curl -s "https://api.bankr.bot/agent/job/$JOB_ID" -H "X-API-Key: $BANKR_API_KEY")
  case $(echo "$R" | jq -r .status) in completed|failed|cancelled) break ;; esac
  sleep 2
done
echo "$R" | jq -r '.response // .error // .status'
```

Never poll without a `jobId`: `GET /agent/job/null` answers `404 Job not found` on every call, so an unguarded loop never ends. A job still running after five minutes keeps running; keep its `jobId` and poll again later, or cancel it.

[references/agent-api.md](references/agent-api.md) covers job fields, status updates, rich data and failure handling.

### Wallet API: direct, synchronous

| Endpoint | What it does |
| --- | --- |
| `GET /wallet/me` | Wallet addresses and account info. This is also the quickest way to check that a key works |
| `GET /wallet/portfolio` | Balances, with `?include=pnl,nfts` and `?chains=base,solana` |
| `POST /wallet/swap-quote` | Quotes a swap: same-chain EVM, cross-chain or Solana |
| `POST /wallet/swap` | Executes a swap. The output always goes to your own wallet |
| `POST /wallet/transfer` | Sends a token (by contract address) to a 0x address. Resolve an ENS name or social handle first with `GET /addresses/resolve` |
| `POST /wallet/sign` | Signs a message, EIP-712 typed data or a transaction |
| `POST /wallet/submit` | Broadcasts a raw transaction |

- Reads (`me`, `portfolio`, `swap-quote`) work with read-only keys. `swap-quote` still needs `walletApiEnabled`.
- Writes (`swap`, `transfer`, `sign`, `submit`) need `walletApiEnabled` on a read-write key.
- `transfer` enforces the key's recipient allowlist. `swap` has no recipient to check, because its output returns to you.
- `submit` is also checked against the wallet's security settings: spend limits, permitted recipients and the arbitrary-contract-calls switch. Its `403` comes either with a machine-readable `errorCode` or with a plain message and no code, so handle both shapes.
- These endpoints need no key: `GET /addresses/resolve`, `GET /users/search`, `GET /token-launches` and `GET /token-launches/quote-tokens?chain=<chain>`.

For details, see [docs.bankr.bot/wallet-api/overview](https://docs.bankr.bot/wallet-api/overview) and [references/sign-submit-api.md](references/sign-submit-api.md). Swaps are covered in [references/token-trading.md](references/token-trading.md).

## Capabilities: where to look

Most of these work by asking the agent (`bankr agent "..."` or `POST /agent/prompt`). Before anything non-trivial, read the reference for that area.

| Area | Reference | Docs |
| --- | --- | --- |
| Swaps and bridging, including the direct swap API | [token-trading.md](references/token-trading.md) | [Swaps](https://docs.bankr.bot/features/trading/swaps), [Wallet API swap](https://docs.bankr.bot/wallet-api/swap) |
| Limit, stop, DCA and TWAP orders; scheduled prompts | [automation.md](references/automation.md) | [Automations](https://docs.bankr.bot/agent/automations) |
| Tokenized stocks and ETFs (Robinhood Chain, Base, Solana) | [tokenized-stocks.md](references/tokenized-stocks.md) | [Tokenized stocks](https://docs.bankr.bot/features/trading/tokenized-stocks) |
| Balances, PnL, held NFTs | [portfolio.md](references/portfolio.md) | [Portfolio](https://docs.bankr.bot/features/portfolio) |
| Transfers: ENS, social handles, bulk sends | [transfers.md](references/transfers.md) | [Transfers](https://docs.bankr.bot/features/transfers) |
| Prices, analysis, holder lists | [market-research.md](references/market-research.md) | |
| NFTs: buys, mints, offers | [nft-operations.md](references/nft-operations.md) | [NFTs](https://docs.bankr.bot/features/nfts) |
| Perps on Hyperliquid and Avantis | [hyperliquid.md](references/hyperliquid.md), [leverage-trading.md](references/leverage-trading.md) | [Hyperliquid](https://docs.bankr.bot/features/hyperliquid) |
| Polymarket | [polymarket.md](references/polymarket.md) | [Polymarket](https://docs.bankr.bot/features/polymarket) |
| Token launches, creator fees, vesting | [token-deployment.md](references/token-deployment.md) | [Token launching](https://docs.bankr.bot/token-launching/overview) |
| Project pages (`bankr project`, 0.3.39+) | [projects.md](references/projects.md) | [Projects](https://docs.bankr.bot/projects/overview) |
| Wallet file storage and run outputs | [files.md](references/files.md) | [Files](https://docs.bankr.bot/agent/files) |
| x402: calling and deploying paid endpoints | [x402-cloud.md](references/x402-cloud.md) | [x402 Cloud](https://docs.bankr.bot/x402-cloud/overview) |
| LLM gateway, credits, Max Mode | [llm-gateway.md](references/llm-gateway.md) | [LLM gateway](https://docs.bankr.bot/llm-gateway/overview) |
| Raw transactions and contract calls | [arbitrary-transaction.md](references/arbitrary-transaction.md), [sign-submit-api.md](references/sign-submit-api.md) | [Submit](https://docs.bankr.bot/wallet-api/submit) |
| Security settings, key controls, rate limits | [safety.md](references/safety.md) | [Security](https://docs.bankr.bot/security/overview) |
| Errors and troubleshooting | [error-handling.md](references/error-handling.md) | |

Capabilities without a reference file:

- **Merkl rewards** on Base and Robinhood Chain: the agent can check what the user has earned, claim it (embedded Bankr wallets only), and list live campaigns by APR. For example: `bankr agent "Do I have any Merkl rewards to claim?"`.
- **Web browsing:** for Bankr Club members, the agent can drive a headless browser from the web terminal or a private Telegram or Farcaster chat. It isn't available over the Agent API or in public posts ([docs](https://docs.bankr.bot/browser/overview)).
- **Webhooks:** `bankr webhooks` deploys endpoints that trigger the agent from external events ([docs](https://docs.bankr.bot/webhooks/overview)).
- **Questions about Bankr itself:** the agent answers from Bankr's own documentation (official links, channels, how features work) and abstains instead of guessing.

## Rules that are easy to get wrong

- **Name the chain**, or paste the contract address, whenever a token exists on more than one chain. Launch defaults also differ by surface: the CLI and the web form preselect Base, while the agent and the deploy API fall back to Robinhood Chain.
- **Spend limits are real.** Every wallet starts with a $500 daily limit and a $500 per-transaction limit. They are enforced on every path (agent, Wallet API, raw submit, x402) and fail closed when a price is unavailable. Only the user can change them, at bankr.bot → Security; an API key can't. See [safety.md](references/safety.md).
- **Keys can be narrowed.** A read-only key keeps reads and prompts but gets `403` on every write: wallet writes, deploys and claims. A non-empty recipient allowlist also refuses anything whose recipient can't be checked: Polymarket trades, NFT buys, mints and listings, airdrops, scheduled prompts, and raw `/wallet/submit`. See [safety.md](references/safety.md).
- **Never retry a swap under a new key after it may have broadcast.** Send an `idempotencyKey` with every `/wallet/swap` and retry only with the same one. After a `504 receipt_pending`, `502 fill_unconfirmed` or `502 fill_failed`, check the wallet's activity first. See [error-handling.md](references/error-handling.md#retrying-swaps-safely).
- **Creating an automation isn't idempotent.** If a create seemed to fail, list the existing automations before sending it again.
- **Tokenized-stock trades need a one-time location verification** in the Bankr web app, which isn't available in the US, the UK or sanctioned regions. Quotes aren't gated; execution is.
- **LLM credits are separate from the trading wallet** and start at $0. Top up (`bankr llm credits add 25`) before using the gateway or Max Mode, or calls fail with `402`.
- **Token launches:** every wallet gets 3 counted launch attempts per rolling 24 hours, and Bankr Club doesn't raise that. Simulations (`--simulate` / `simulateOnly`) don't count. See [token-deployment.md](references/token-deployment.md).
- **BNKR staking is withdraw-only.** It accepts no new deposits.

## Chains

Bankr supports Base, Ethereum, Polygon, Unichain, World Chain, Arbitrum, BNB Chain, Robinhood Chain, Arc and Solana:

- **Robinhood Chain** (chainId 4663) settles in USDG and hosts Robinhood's tokenized stocks.
- **Arc** (chainId 5042) is Circle's L1, where USDC is the gas token. It has no aggregator swaps yet, and its gas isn't sponsored.
- **Base** also hosts the B20 tokenized equities.

More in [docs.bankr.bot/getting-started/supported-chains](https://docs.bankr.bot/getting-started/supported-chains).

## LLM gateway

`https://llm.bankr.bot` is an OpenAI- and Anthropic-compatible API that serves Claude, GPT, Gemini, Grok and open-weight models, billed per token from LLM credits (1 credit = $1). A key needs the LLM gateway capability (`--llm` at login).

- `bankr llm models` lists the live model IDs; add `--zdr` or `--private` to filter by privacy tier. Use bare IDs in API calls and `bankr/<id>` in OpenClaw.
- `bankr llm credits` shows the balance. `bankr llm credits add <usd> [--token <symbol-or-address>]` tops up from the wallet, and `bankr llm credits auto` configures automatic top-ups.
- `bankr claude` (alias of `bankr llm claude`) and `bankr llm opencode` launch those tools through the gateway. `bankr llm setup openclaw|opencode|claude|cursor` prints or installs their config.
- Requests run at a privacy tier: `standard` (the default), `zdr` (zero data retention) or `private` (TEE). If no provider can serve the requested tier, the request fails rather than falling back to a weaker one.
- **Max Mode** runs the Bankr agent itself on a model you pick from the frontier, flagship and balanced lines, billed from the same credits. Use `bankr agent -m <id> "..."`, or pick Max in the web terminal's mode menu.

Setup paths, SDK examples, credit transfers, spend budgets and deprecations are in [references/llm-gateway.md](references/llm-gateway.md).

## Bankr Club

Commands: `bankr club` (status), `bankr club signup [--yearly] [--token <USDC|BNKR|ETH|Base ERC-20>]` and `bankr club cancel`. It costs $20 a month or $198 a year, paid as the USD equivalent in the chosen token.

- AI prompts work without Max Mode. Terminal messages go from 5 a day to unlimited, and Agent API prompts are capped at 1,000 a day instead of Max Mode's 100.
- File storage grows from 1 GB to 10 GB.
- It doesn't raise the token-launch cap.

Club needs an embedded Bankr wallet. Max Mode, paid per request from LLM credits, is the alternative for external wallets. Full perks: [docs.bankr.bot/faq/bankr-club](https://docs.bankr.bot/faq/bankr-club).

## Skills inside Bankr

This skill teaches your agent to use Bankr. It also works the other way: users can install skills **into** their Bankr agent by pasting a GitHub link to a `SKILL.md`, or a bankr.bot Discover or partner link. Reinstalling from the same source updates the skill. See [docs.bankr.bot/skills/overview](https://docs.bankr.bot/skills/overview).

## Troubleshooting

- `bankr whoami` checks CLI auth. Over REST, call `GET /wallet/me` with the key: a `401` means the key is wrong or revoked.
- If `bankr` isn't found, reinstall `@bankr/cli`.
- For everything else, see [references/error-handling.md](references/error-handling.md).
