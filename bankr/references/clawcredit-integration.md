# ClawCredit Integration (Optional)

Use this when your agent combines:
- **Bankr** for wallet operations, trading, transfers, and Bankr LLM Gateway usage, and
- **x402 services** that support deferred credit payments through **ClawCredit**.

This is useful for agents that need both on-chain execution (Bankr) and pay-per-call x402 APIs without keeping crypto funded at all times.

## What each system pays for

| System | Payment model | Typical use |
|--------|---------------|-------------|
| Bankr Agent API | Wallet-funded on-chain execution | swaps, transfers, leverage, NFT ops, token launch |
| Bankr LLM Gateway | Prepaid Bankr LLM credits (USD) | model calls at `llm.bankr.bot` |
| x402 + ClawCredit | Deferred credit line (USD) | paid x402 APIs/services outside Bankr |

> Important: **ClawCredit does not replace Bankr LLM credits.**
> If `llm.bankr.bot` returns HTTP 402, top up with `bankr llm credits add ...`.

## When to use ClawCredit with Bankr

Use ClawCredit only for **non-Bankr x402 endpoints** (for example, external x402 partner APIs).

Examples:
- Use Bankr to trade/transfer on-chain.
- Use ClawCredit to pay an x402 research API in the same workflow.

## Minimal integration pattern

1. Keep Bankr configured normally (`bankr login`, `bankr whoami`, `bankr llm credits`).
2. Register/configure ClawCredit once (with explicit user consent to ClawCredit Privacy Policy).
3. Route requests by endpoint:
   - `api.bankr.bot` / `llm.bankr.bot` → Bankr flow
   - external x402 endpoint → ClawCredit `pay(...)`

## Routing example (Node.js pseudo-code)

```javascript
function isBankrUrl(url) {
  return url.includes('api.bankr.bot') || url.includes('llm.bankr.bot');
}

async function callPaidEndpoint(url, payload) {
  if (isBankrUrl(url)) {
    // Use Bankr auth + Bankr credits/wallet flows
    return callBankr(url, payload);
  }

  // Use ClawCredit for external x402 endpoint
  return credit.pay({
    transaction: {
      recipient: url,
      amount: 0.05,
      chain: 'BASE',
      asset: 'USDC'
    },
    request_body: {
      http: {
        url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout_s: 30
      },
      body: payload
    }
  });
}
```

## Operational notes

- Keep Bankr and ClawCredit credentials separate.
- For ClawCredit, monitor repayment status and reminders to avoid suspension.
- For Bankr LLM Gateway, enable auto top-up to reduce 402 interruptions:

```bash
bankr llm credits auto --enable --amount 25 --threshold 5 --tokens USDC
```

- If a request fails with 402, identify the source first:
  - `llm.bankr.bot` → Bankr credits issue
  - x402 merchant endpoint → payment/underwriting issue (direct wallet or ClawCredit path)

## Security checklist

- Use dedicated agent wallets/keys for autonomous workflows.
- Never hardcode API tokens in source control.
- Restrict scope with read-only keys/IP allowlists when possible.
- Keep ClawCredit consent/repayment communication explicit and auditable.
