# Reading a Lorg Check answer

## The fields

| Field | What it is |
|---|---|
| `verdict` | `allow`, `caution` or `block` |
| `action` | What to do: `proceed`, `limit_exposure` or `do_not_proceed`. Read this one |
| `summary` | One sentence to show the user |
| `risk_score` | 0 to 100: caution from 30, block from 70 |
| `confidence` | `high`, `medium` or `low`: how complete the evidence was |
| `reasons` | Each finding, most serious first: `code`, `severity` (critical, high, medium, low, info) and a sentence |
| `token` | For a token: name, symbol, age in days, its main pool and liquidity, and the simulated buy and sell (taxes, whether it sold) |
| `wallet` | For an address: transactions sent, first seen, age in days |
| `checks_run`, `checks_failed` | What was checked; a failed check never counts in the token's favour |
| `cached` | Whether the answer was given moments earlier |
| `signature` | Ed25519 over the answer; public keys at https://api.lorglabs.com/v1/keys |

## Reason codes that block

`SANCTIONED` (OFAC list or the Chainalysis oracle) · `KNOWN_SCAM` (scam, drainer, phishing or exploiter label) · `SELL_BLOCKED` (a simulated sell reverted: a honeypot) · `HONEYPOT_HOOK` (a Uniswap V4 hook copied from a known honeypot) · `HIDDEN_MINT` (the creator can move more tokens than exist) · `COUNTERFEIT_TOKEN` (a fake of a major token or of money: USDC, USDT, ETH) · `COMPROMISED_WALLET` (an EIP-7702 sweeper: anything sent is forwarded to a thief) · `ADDRESS_POISONER` (imitates an address the payer really dealt with) · `TX_REVERTS`.

## Common warnings

`HIGH_SELL_TAX` (over 10%; over 50% blocks) · `OWNER_CAN_MINT` · `OWNER_CAN_BLACKLIST` · `OWNER_CAN_SET_FEES` · `UPGRADEABLE_BY_EOA` (one wallet can replace the code) · `LP_NOT_LOCKED` (one wallet can pull the liquidity) · `NO_MARKET` (under $1,000 in the main pool) · `LOW_LIQUIDITY` · `EXIT_LIQUIDITY_INSUFFICIENT` (your trade size is too big to get out) · `UNKNOWN_HOOK` · `DEPLOYER_PRIOR_RUG` · `DEPLOYER_RUG_FUNDED` (the creator was paid by a wallet behind earlier rugs) · `COPYCAT_TOKEN` · `NEW_TOKEN` · `NEW_WALLET`.

## Reassuring notes

`KNOWN_GOOD_TOKEN`, `ESTABLISHED_TOKEN`, `ISSUER_CONTROLLED` (for example USDC can freeze: expected), `ADMIN_SAFEGUARDED` (admin powers behind a multisig or timelock), `OWNER_RENOUNCED`.

The full list, always current: https://api.lorglabs.com/v1/reasons
