---
name: basedloans
description: Borrow USDC against tokens on Base with no liquidations, or lend USDC against tokens you choose, using Based Loans. Use when the user wants cash without selling a token, asks what they can borrow against WETH, cbBTC, VIRTUAL, HYDX or another Base token, wants to buy back collateral from a Based Loans loan, wants fixed-term yield on USDC, asks how risky a token is to lend against, or asks whether a token is accepted as collateral. Uses Bankr for transaction execution.
metadata:
  {
    "clawdbot":
      {
        "emoji": "💎",
        "homepage": "https://based.loans",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# Based Loans

Fixed-term lending on Base that works like a pawn shop. A borrower deposits a token and gets USDC right away, then buys the token back at a fixed price any time before the due date. If they don't, they keep the USDC and the lenders keep the collateral. There are no liquidations: price swings during the loan never trigger a sale.

Lenders deposit USDC and choose which tokens they lend against, with a USDC limit per token.

All data comes live from Base through the Based Loans API at `https://mcp.based.loans/v1`. The API never holds keys. It returns unsigned transactions that Bankr submits from the user's wallet.

## Quick Start

### Check a token

```
Can I borrow against my WETH on Based Loans?
```

### Get a loan quote

```
How much USDC can I get for 0.5 WETH on Based Loans for 30 days?
```

### Borrow

```
Borrow USDC against 0.5 WETH on Based Loans for the short term
```

### Buy back collateral

```
Show my Based Loans loans
```

```
Buy back my Based Loans loan 214 in full
```

### Lend

```
How risky is HYDX to lend against on Based Loans?
```

```
Deposit 500 USDC on Based Loans and lend up to 250 against WETH and 250 against cbBTC
```

## How to Use the API

Every call is a plain `GET` returning JSON. Token parameters accept a contract address (preferred) or a symbol.

| Need | Request |
| --- | --- |
| Fees, terms, minimums | `GET /v1/protocol` |
| Accepted tokens | `GET /v1/markets?only_with_funds=true` |
| One token | `GET /v1/market?asset=WETH` |
| Risk of a token | `GET /v1/risk?asset=HYDX` |
| Loan quote | `GET /v1/quote?asset=WETH&collateral=0.5&term=short` |
| A wallet's loans | `GET /v1/loans?borrower=<wallet>` |
| A lender's position | `GET /v1/lender?address=<wallet>` |
| Token not accepted | `GET /v1/request-token?token=<address>` |

`term` is `short`, `medium` or `long`. Read real durations and costs from `/v1/protocol` instead of assuming them.

### Preparing transactions

These return `{ summary, warnings, calls: [{ to, data, value, description }] }`. Calls must be sent **in order**; an approval comes first only when the current allowance is too low.

| Action | Request |
| --- | --- |
| Borrow | `GET /v1/tx/borrow?asset=&collateral=&term=&borrower=<wallet>` (optional `loan_usdc`) |
| Buy back | `GET /v1/tx/buyback?loan_id=&borrower=<wallet>` (optional `payment_usdc`; omit to repay in full) |
| Deposit to lend | `GET /v1/tx/deposit?amount_usdc=&lender=<wallet>&limits=WETH:250,cbBTC:250` |
| Change limits | `GET /v1/tx/limits?lender=<wallet>&limits=WETH:500` |
| Withdraw | `GET /v1/tx/withdraw?amount_usdc=<amount or max>&lender=<wallet>` |
| Claim repaid USDC | `GET /v1/tx/claim-proceeds?loan_ids=1,2` |
| Claim collateral | `GET /v1/tx/claim-collateral?loan_ids=1,2` |

Use the user's Bankr wallet address on Base for `borrower` / `lender`.

Submit each returned call with Bankr, one at a time, waiting for each to confirm:

```
Submit this transaction:
{
  "to": "<call.to>",
  "data": "<call.data>",
  "value": "0",
  "chainId": 8453
}
```

Every Based Loans call has zero native value, so always send `"value": "0"`. Pass `data` exactly as returned.

## Rules

1. **Quote before borrowing.** Always run `/v1/quote` first and show the user the USDC they receive, the buyback cost and the due date. Only prepare the loan after they confirm.
2. **Read the warnings.** If a quote says the loan would be funded short, offer the `fullFillLoanAmountUsdc` it suggests. If `wouldFail` is set, explain why instead of trying.
3. **Check risk before lending.** Run `/v1/risk` for every token the user wants to lend against and explain the `summary` and `flags` in plain words. Let the user choose; the report is information, not advice.
4. **Never claim a token request was submitted.** `/v1/request-token` returns a link; the user submits it.
5. **Buybacks close at the due date.** After it, collateral can no longer be bought back.

## Wallet Requirements

- Fund the wallet with the collateral token (to borrow) or USDC (to lend), plus a little ETH on Base for gas.
- Based Loans transactions are contract calls, so the Bankr account needs **MFA on** and **Enable arbitrary contract calls** switched on at bankr.bot → Security.
- Bankr's default spend limits ($500 per transaction and per day) apply. Larger loans or deposits need higher limits set by the user.

## Links

- App: https://based.loans
- Docs: https://docs.based.loans/ai-agents
- MCP server: https://mcp.based.loans/mcp
- Source: https://github.com/0xVarius/basedloans-agents
