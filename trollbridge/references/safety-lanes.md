# TrollBridge pre-trade safety lanes — reference

Base URL: `https://mini-tollbooth.onrender.com`

Every lane is a pay-per-call x402 endpoint: call it, get `HTTP 402` with payment instructions, pay the quoted USDC on Base or Solana, retry with the payment header.

All five lanes are read-only heuristic screens. None of them executes a trade, approves a spend, or submits a transaction. None of them predicts price. None of them is an audit.

## Lane notes

### `/contract-check` — $0.10/call

Heuristic contract safety screen for a Base token contract. Returns a 0–100 `risk_score` (higher = riskier) and a `flags` array naming the patterns found.

**Labeled NOT an audit.** A low score reduces risk but never proves the contract is safe. A high score or any red flag means do not buy.

### `/honeypot` — $0.02/call

Screens whether a token can be bought and sold freely or traps sellers. Use before any first buy of an unfamiliar token.

### `/rug-score` — $0.02/call

Scores common rug-pull risk factors such as liquidity depth, ownership concentration, and mint controls. Use alongside `/contract-check` and `/honeypot` before a first buy.

### `/approval-screen` — $0.10/call

Screens a pending token approval before the agent signs it. Flags unlimited allowances and risky spender contracts. Use every time an approval is about to be signed — approvals persist and outlive the trade that requested them.

### `/tx-dryrun` — $0.02/call

Simulates a transaction before submission to catch reverts and unexpected state changes. Use before submitting any onchain transaction the agent composed.

## Decision guidance

- High risk scores or red flags from any lane → do not buy, do not approve, do not submit.
- A clean screen reduces risk but never proves safety. Screens are heuristic — they cannot detect every scam.
- Never treat an error (`4xx`/`5xx`) as "safe". Retry `5xx` later; fix the request on `4xx`.
- Lane prices are set by the TrollBridge operator and can change; the `402` response always quotes the current price.
