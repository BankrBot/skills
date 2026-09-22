# x402 Cloud Reference

x402 Cloud hosts paid API endpoints. You write a `Request → Response` handler and set a price; callers pay per request on Base through the [x402 protocol](https://x402.org). Bankr runs the handler, verifies and settles each payment, and pays you directly.

- **Endpoint URL:** `https://x402.bankr.bot/<walletAddress>/<serviceName>[/path]`, where the wallet is the deployer's and any sub-path is passed to the handler.
- **Dashboard:** [bankr.bot/x402](https://bankr.bot/x402) for requests, logs, revenue and settings.
- **Docs:** [docs.bankr.bot/x402-cloud/overview](https://docs.bankr.bot/x402-cloud/overview).

## Pricing

The first 1,000 settled requests each month, across a wallet's endpoints, carry no platform fee; after that a flat 5% applies (Enterprise: 3%, contact sales). There is no subscription and no card.

- Only settled requests count. A 402 challenge is free, and payment settles only when the handler returns a status below 400, so failed requests are never charged.
- The free allowance applies to endpoints priced in USDC or EURC. An endpoint priced in another token pays the 5% fee from its first request.
- Payments settle on Base in the endpoint's token, and your share goes straight to your wallet (or the payout address set on the endpoint). Revenue is also reported in USD at the price when each payment settled.

## Deploying

**Through the agent**, with no local setup: "Deploy an x402 endpoint called price-feed that returns crypto prices for $0.001 per request". The agent writes the handler, sets the price and deploys. It can also update the code or price, pause, resume or delete an endpoint, list your endpoints with their revenue, and show recent request logs. Endpoints deployed from chat and from the CLI are the same thing and can be managed from either.

**Through the CLI:**

```bash
bankr x402 init                       # scaffold x402/ and bankr.x402.json
bankr x402 add <name>                 # new service at x402/<name>/index.ts
bankr x402 configure <name>           # interactive price, network and payment scheme
bankr x402 deploy [name]              # deploy every service, or one
bankr x402 list                       # your endpoints
bankr x402 pause <name> | resume <name> | delete <name>
bankr x402 revenue [name]             # earnings
bankr x402 env set KEY=VALUE | env list | env unset KEY
```

The CLI has no logs command: request logs are in the dashboard, or ask the agent.

### Writing a handler

```typescript
// x402/<service-name>/index.ts
export default async function handler(req: Request): Promise<Response> {
  const city = new URL(req.url).searchParams.get("city");
  const payer = req.headers.get("x-402-payer"); // verified payer address, lowercase
  return Response.json({ city, payer });
}
```

Handlers use the standard Fetch `Request` and `Response`, within the [limits](#limits) below. The platform adds these rules:

- **npm packages:** list them in `x402/<name>/package.json`, which `bankr x402 add` can scaffold. They are installed at deploy time with install scripts skipped.
- **Response headers:** only `content-type`, `cache-control`, `etag`, `last-modified` and `x-request-id` reach the caller.
- **Secrets:** `bankr x402 env set KEY=VALUE` makes the value available as `process.env.KEY` in every service on the wallet. Names starting with `BANKR_`, `AWS_`, `LAMBDA_` or `X402_RUNTIME_` are reserved: setting one fails, and they read as `undefined` in the handler. Store a Bankr key under another name, for example `LLM_GATEWAY_KEY` for calls to the [LLM gateway](llm-gateway.md).
- **Network:** outbound `fetch` to private or internal addresses is blocked.

**Handler context.** Three optional bridges arrive as the handler's second argument, `ctx`, each enabled per service in `bankr.x402.json`:

- `ctx.files` (`files` block) reads and writes the wallet's [file storage](files.md): `readText`, `readJson`, `readBytes`, `writeText`, `writeJson`, `writeBytes`, `list`, `delete` and `getDownloadUrl`. By default it is scoped to `/x402/<name>`, with read and write on and delete off.
- `ctx.appKV` (`appKV` block) offers `get`, `set`, `list` and `delete` on the key-value store of Bankr apps owned by the same wallet.
- `ctx.askAgent(prompt)` (`agent` block) hands a prompt to your own Bankr agent, for example to message you on Telegram after a payment. Don't await it: agent runs outlast the 30-second limit, and a timed-out request isn't charged. Runs are limited to 5 a minute per wallet. Free runs are also limited to 2 a day (5 with Bankr Club) and stop entirely after 14 days without signed-in activity on the wallet. Setting a Max Mode model on the block bills your LLM credits and lifts the daily cap.

A deploy whose source calls a `ctx` method that doesn't exist is rejected. Worked examples: [docs.bankr.bot/x402-cloud/examples](https://docs.bankr.bot/x402-cloud/examples).

## Configuration

`bankr.x402.json` sits at the project root:

```json
{
  "network": "base",
  "services": {
    "weather": {
      "description": "Current weather for a city",
      "price": "0.001",
      "methods": ["GET"],
      "category": "data",
      "tags": ["weather", "forecast"],
      "schema": {
        "input": { "type": "object", "properties": { "city": { "type": "string" } }, "required": ["city"] },
        "output": { "type": "object", "properties": { "tempC": { "type": "number" } } }
      }
    }
  }
}
```

- **`price`:** the per-request price in the payment token. It is USD for the default USDC and token units otherwise, so `"100"` of a custom token means 100 tokens, not $100. The minimum is `0.000001`.
- **`tokenAddress`** (per service or top level): price in any ERC-20 on Base instead of USDC. Symbol and decimals are resolved server-side. USDC and EURC settle gaslessly (EIP-3009); other tokens use Permit2, so a payer's first payment needs a one-time Permit2 approval. See [custom tokens](https://docs.bankr.bot/x402-cloud/custom-tokens).
- **`paymentScheme`:** `exact` charges the price. With `upto`, the price is a cap and the handler reports the actual charge, in the token's smallest units, in an `X-402-Settle-Amount` response header; a missing or out-of-range value settles the full price. The default is `exact` for USDC and EURC and `upto` for other tokens.
- **`methods`:** the accepted HTTP methods. The default is `["GET", "POST"]`.
- **`schema`:** JSON Schema `input` (query parameters for GET, the JSON body for POST) and `output`. Agents use it to call the endpoint.
- **`category`** and **`tags`:** used for discovery. Tags are lowercased, stripped to letters, digits and hyphens, and capped at 5 tags of 32 characters.
- **`files`**, **`appKV`** and **`agent`:** the opt-in handler bridges described above.

Every field: [config file reference](https://docs.bankr.bot/x402-cloud/config-file).

### The marketplace listing is public

The public marketplace at [bankr.bot/terminal/x402/discover](https://bankr.bot/terminal/x402/discover), agent discovery and `bankr x402 search` all read the same catalogue, built from `description`, `category`, `tags` (the first four show on the card) and `schema`. Treat those fields as published content, and keep internal notes and hostnames out of them. A new endpoint can be called at its URL straight away, but it appears in the catalogue only once Bankr marks it discoverable (the `discoverable` field in `GET /x402/endpoints`).

## Calling x402 Endpoints

**Through the agent:** "Find x402 endpoints for sentiment analysis", "What does the x402 weather endpoint cost?", "Call the weather endpoint on x402 with city London". The agent confirms the price before paying and caps a single call at $10. It pays in whatever token the endpoint asks for, on Base, Ethereum, Polygon or Robinhood Chain, and works with Bankr-hosted and external endpoints on x402 v1 or v2.

**Through the CLI:**

```bash
bankr x402 search <query>                           # search the catalogue (no auth)
bankr x402 schema <url>                             # price and input/output schema (no auth)
bankr x402 call <url>                               # GET with automatic payment
bankr x402 call <url> -X POST -d '{"text":"hi"}'    # method and JSON body
bankr x402 call <url> -i                            # prompt for inputs from the schema
bankr x402 call <url> --max-payment 0.50            # your cap in USD (default 1, maximum 10)
```

`--max-payment` is a hard ceiling. The price an endpoint advertises can only lower what you authorize, never raise it, and a call priced above your cap fails instead of paying. `-y` or `--ni` skips both the price check and the confirmation.

**Any x402 client** (for example `x402-fetch`): an unpaid request returns `402` with the payment requirements (`x402Version: 2`, and `accepts: [{ scheme, network, amount, maxAmountRequired, asset, payTo, extra }]`), also sent base64-encoded in the `PAYMENT-REQUIRED` header. Retry with the signed payment in `PAYMENT-SIGNATURE` (v2) or `X-PAYMENT` (v1).

### How payment is handled

- **Verification and settlement are Bankr's.** The router verifies the payment, runs the handler, and settles only on a response below 400. Neither payers nor handlers call a facilitator: the `facilitator` URL in a 402 is informational, and the payout goes to the address on the endpoint's record, not to anything in the request.
- **Payer wallets:** plain EOAs, deployed smart accounts (ERC-1271) and EIP-7702 delegated wallets such as Bankr's all verify. Counterfactual ERC-6492 signatures from an undeployed account are rejected, so deploy the account first.
- **Failures:** a reused payment gets `402` with `Payment already used`. A failed verification gets `402` with a machine-readable `reason` such as `permit2_allowance_required` or `insufficient_balance`. More than 60 paid requests a minute from one payer to one endpoint gets `429` with `retry-after`. A paused or deleted endpoint returns `404`.

## Limits

| Resource | Limit |
|----------|-------|
| Execution time | 30 seconds |
| Memory | 256 MB |
| Handler source | 1 MB per service |
| Services per deploy | 25 |
| Deploys | 20 per hour per IP |
| Env vars | 4 KB total, names and values, per wallet |
| Service name | Up to 47 characters: letters, digits, `-` and `_` |
| Paid requests | 60 per minute per payer per endpoint |
