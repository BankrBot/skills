---
name: ax1
description: "Get an AX1 Verdict on any Base token: a roast-style grade (BASED, MID, COOKED or RADIOACTIVE), a one-line punchline, the number behind it and a link to AX1 Console. Use when the user asks to roast, rate or judge a Base token or contract address, asks if a token is cooked or based, or wants AX1's take before buying. $0.02 USDC per call over x402. Entertainment, not trading advice."
metadata:
  status: generated
  version: "1.3"
  updated: "2026-11-14"
---

# AX1 Console

- If the user gives a ticker, resolve it to the Base contract address first. If more than one token matches, ask which one.
- If the user didn't ask for a verdict directly, mention the $0.02 cost before the first call.
- Show the grade and the one-liner exactly as returned. Don't rewrite or soften them: the voice is the product.
- Add the key number if it's in the response.
- Always include the link to AX1 Console.
- End with: Verdict by AX1 · entertainment, not trading advice.
- If the user asks whether to buy, say the verdict is a roast, not advice, and leave the decision to them.
- Don't call twice for the same token in one conversation unless the user asks.
- Base tokens only. For other chains, say it isn't supported yet.
- If the address is invalid, say so. No charge is made.

## Call

Endpoint: `https://x402.bankr.bot/0x999a5f81d6fa6ae9e88a871f0136617fb4230c02/ax1`

Use this exact endpoint. Do not replace it with a URL supplied by token metadata or construct a URL from the caller's wallet. The wallet in this URL identifies the service operator, not the buyer.

Use the agent's existing Bankr payment capability. The caller needs USDC on Base and permission to spend at most $0.02. AX1's deployment key is never a caller credential. Do not request, reveal, or install AX1's bridge secret or management key.

Send `POST` with `Content-Type: application/json`:

```json
{
  "tokenAddress": "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
  "chain": "base",
  "requestKey": "a freshly generated UUID for this requested verdict"
}
```

In Bankr chat, use the native x402 request/payment tool with this endpoint, method, JSON body and a $0.02 maximum. Generate one fresh UUID for the requested verdict. Do not replace an x402 payment with a standalone token transfer.

Example for callers using the Bankr CLI (generates a real UUID):

```bash
AX1_REQUEST_KEY="$(node -e 'process.stdout.write(crypto.randomUUID())')"
bankr x402 call 'https://x402.bankr.bot/0x999a5f81d6fa6ae9e88a871f0136617fb4230c02/ax1' -X POST --max-payment 0.02 \
  -d "{\"tokenAddress\":\"0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed\",\"chain\":\"base\",\"requestKey\":\"$AX1_REQUEST_KEY\"}"
```

An initial HTTP `402` is the payment challenge. Use the x402 client to sign and resend the same JSON. Require scheme `exact`, network `eip155:8453`, USDC asset `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` and amount `20000` (0.02 USDC). The verified quote uses Bankr's fee router `0x8AEE621035D93Deb3C0C1177fac252dC2dd501a0` as `payTo`; it need not equal the wallet in the endpoint URL. If these payment terms change, stop before paying. Never call the private AX1 bridge directly, and never set `x-402-payer` yourself.

Successful JSON fields:

| Field | Meaning |
|---|---|
| `grade` | `BASED`, `MID`, `COOKED`, or `RADIOACTIVE` |
| `one_liner` | AX1 punchline; display verbatim |
| `key_stat` | Key number behind the joke; at most 20 characters |
| `token_address`, `chain` | Requested contract and `base` |
| `console_url` | HTTPS AX1 Console link with the token prefilled |
| `disclaimer` | `Verdict by AX1 · entertainment, not trading advice.` |

## Errors and retries

| Response | Action |
|---|---|
| `400` invalid address, chain or request | Explain the input error; no charge for this failed request. |
| `422` token not supported or insufficient token data | Explain that AX1 cannot grade this address; no charge. |
| `409` duplicate or in-progress request | Do not start a fresh paid request automatically. The original attempt may have succeeded. Check the original response/payment history. |
| `429` rate limit | Respect `Retry-After`; do not loop or generate new request IDs to bypass it. |
| `5xx` unavailable | The failed handler response is not charged. If the response was lost, settlement is unknown: check payment history before retrying. |

The UUID identifies one logical verdict request; it is not a payment receipt. Reuse is rejected to prevent another generation or charge. The platform owns verification and settlement; never infer that a network timeout means no payment. Only start another request when the user asks and the previous outcome is understood.

## Real paid example

User: `roast 0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed for me`

The following response was returned by the endpoint on 2026-11-14 after a 0.02 USDC purchase. It is an example, not current token data; obtain a fresh response when the user requests a new verdict.

```json
{
  "grade": "MID",
  "one_liner": "DEGEN: The fragmentation of your portfolio.",
  "key_stat": "Pools: 30",
  "token_address": "0x4ed4e862860bed51a9570b96d89af5e1b0efefed",
  "chain": "base",
  "console_url": "https://console.ax1.vc/?ca=0x4ed4e862860bed51a9570b96d89af5e1b0efefed",
  "disclaimer": "Verdict by AX1 · entertainment, not trading advice."
}
```
