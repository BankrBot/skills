---
name: bankr-moonbag
description: Bankr trading companion that automatically slices a configurable moonbag off each token buy and moves it to a separate moonbag wallet. Normal exits only sell the trading-wallet position; selling the vaulted moonbag requires an explicit emergency/rug override. Supports percentage and USD-minimum moonbag rules globally or per token.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🌙",
        "homepage": "https://bankr.bot",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# Bankr Moonbag

Use Bankr for execution, but apply this skill whenever buying or selling tokens.

The core design is **buy -> split -> vault**.

A moonbag is not merely remembered inside the trading wallet. It is physically transferred to a separate configured moonbag wallet as soon as practical after each successful buy.

## Wallet model

Maintain two roles:

- **Trading wallet** — normal Bankr buys and sells happen here.
- **Moonbag wallet** — receives protected token slices and is not included in ordinary exit instructions.

Persist only routing/configuration data and public addresses. Do not generate, expose, log, or persist private keys or seed phrases inside this skill.

Example config:

```json
{
  "version": 2,
  "tradingWallet": "0xTradingWallet",
  "moonbagWallet": "0xMoonbagWallet",
  "defaults": {
    "reservePct": 10,
    "reserveUsdMinimum": 50
  },
  "tokens": {}
}
```

Use separate chain-compatible moonbag addresses where necessary. Resolve EVM vs Solana destinations correctly before transferring.

## Default moonbag rule

Default:

- **10% of each buy**, OR
- **$50 worth of the purchased token**

Whichever results in **more tokens being vaulted**, capped at the actual amount purchased.

The user may change either value globally or per token.

Examples:

- "Keep 20% of every buy as a moonbag."
- "Make the minimum $100."
- "For TOKEN keep 25% or $250, whichever is larger."
- "For this token, percentage only."
- "Disable moonbagging for TOKEN."
- "Make all future buys 5% with no dollar minimum."

## Buy flow: split immediately

For every successful token purchase:

1. Identify the exact chain and token contract/mint.
2. Determine the quantity actually received from the buy, not merely the quoted amount.
3. Resolve a current USD price or derive the effective execution price from the completed buy when possible.
4. Load global defaults and any token-specific overrides.
5. Calculate:
   - `pctTokens = purchasedTokens * reservePct / 100`
   - `usdTokens = reserveUsdMinimum / tokenPriceUsd` when the USD minimum is enabled
   - `moonbagTokens = max(pctTokens, usdTokens)`
   - `moonbagTokens = min(purchasedTokens, moonbagTokens)`
6. Transfer `moonbagTokens` from the trading wallet to the configured moonbag wallet.
7. Verify the transfer when practical.
8. Report both the trading amount and vaulted amount.

Example:

```text
Bought 1,000,000 TOKEN.
Moved 100,000 TOKEN to your moonbag wallet.
900,000 TOKEN remains in the trading wallet.
```

### Important edge cases

- If the whole purchase is smaller than the configured USD minimum, vaulting may consume the entire buy. Make that clear before or immediately after execution depending on what Bankr's execution flow allows.
- If a reliable price cannot be determined, use the percentage rule and do not invent a USD conversion. If the USD minimum would materially change the amount, resolve a Bankr quote/price before sweeping.
- If the moonbag transfer fails, do not pretend the tokens are protected. Report that they remain in the trading wallet and retry only when appropriate.
- Repeated buys each generate their own moonbag slice. The moonbag wallet therefore accumulates protected tokens over time.

## Normal sell flow

Ordinary exits apply to the **trading wallet only**.

These phrases are normal exits, not moonbag overrides:

- "sell"
- "sell all"
- "sell everything"
- "I'm ready to exit"
- "close the position"
- "take profit"
- "dump it"
- "get me out"

When the user says "sell all", sell all of the applicable token held in the trading wallet. Do **not** pull tokens back from the moonbag wallet.

This makes "sell all" truthful: it means 100% of the actively tradable bag, while the vaulted moonbag remains physically separate.

## Emergency moonbag liquidation

Selling the moonbag is a separate intent class from taking profit or deciding to exit.

The user must clearly indicate that the token itself is compromised, rugged, malicious, broken, or that they explicitly want to liquidate the protected moonbag too.

Examples that qualify:

- "Fuck, it was a rug — sell the moonbag too."
- "This token rugged. Emergency exit everything including the moonbag."
- "The contract is compromised; liquidate the vaulted TOKEN."
- "Override moonbag protection and sell the moonbag."
- "Sell from the moonbag wallet too."

Examples that do **not** qualify:

- "I'm ready to exit."
- "Sell everything."
- "I'm done with this one."
- "Take me out completely."
- "No, really, sell all."

Do not infer a rug or compromise merely from price movement. The user may explicitly characterize the situation as a rug/emergency, or separately instruct the skill to liquidate the moonbag.

### Emergency flow

When emergency intent is explicit:

1. Resolve the exact token and chain.
2. Read both trading-wallet and moonbag-wallet balances.
3. Tell the user that the protected moonbag is included in this liquidation.
4. Execute the trading-wallet sale.
5. Execute or route the moonbag-wallet liquidation using the wallet/signer capabilities available to Bankr.
6. Verify resulting balances when practical.
7. Report exactly what was sold from each wallet.

If Bankr cannot transact from the configured moonbag wallet, do not silently transfer the moonbag back to the trading wallet unless the user explicitly approves that route. Report the limitation and the safest available execution path.

## Configuration and overrides

Global defaults:

```json
{
  "reservePct": 10,
  "reserveUsdMinimum": 50
}
```

Per-token overrides are keyed by chain + contract/mint:

```json
{
  "tokens": {
    "base:0xTokenAddress": {
      "reservePct": 20,
      "reserveUsdMinimum": 250
    },
    "solana:MintAddress": {
      "reservePct": 5,
      "reserveUsdMinimum": 0
    }
  }
}
```

Token-specific configuration wins over global defaults.

A user may reduce, increase, or disable future moonbag slicing explicitly. Changes apply to future buys unless they specifically ask to move existing moonbag assets.

Changing a rule does not automatically move tokens already in the moonbag wallet back to the trading wallet.

## Setting up the moonbag wallet

Before the first protected buy, ensure a moonbag destination exists for that chain.

The skill should prefer an existing user-controlled secondary Bankr-compatible wallet/address when available.

Store only the public address and wallet role in configuration.

Never:
- create home-grown key storage,
- write seed phrases to the state file,
- print private keys into chat,
- assume one address works across incompatible chain families.

If no suitable moonbag wallet is configured, do not silently fall back to same-wallet bookkeeping. Tell the user that the buy can execute but physical moonbag separation requires a destination wallet, or complete Bankr-supported secondary-wallet setup if available.

## Bankr execution patterns

Typical flow:

```bash
# Buy normally into trading wallet
bankr agent prompt "Buy $500 of TOKEN on Base"

# Read resulting portfolio/balance
bankr wallet portfolio

# Sweep calculated moonbag slice to separate wallet
bankr agent prompt "Send exactly <MOONBAG_TOKENS> TOKEN on Base to <MOONBAG_ADDRESS>"
```

For normal exits:

```bash
bankr agent prompt "Sell all TOKEN held in my trading wallet on Base"
```

Do not include the moonbag wallet in ordinary sell prompts.

## Response style

Keep routine output compact.

After a buy:

```text
Bought 1,000,000 TOKEN. Vaulted 100,000 (10%) to your moonbag wallet; 900,000 remains tradable.
```

Normal exit:

```text
Sold the trading bag. Your vaulted moonbag is untouched.
```

Emergency exit:

```text
Emergency exit: sold the trading bag and the protected moonbag.
```

Do not describe the moonbag as guaranteed profit, expected upside, or investment advice. It is an execution preference and wallet-separation mechanism.

## Safety invariants

1. **Slice the moonbag on buys, not on ordinary sells.**
2. **Move the protected slice to a separate configured wallet whenever supported.**
3. **"Sell all" and "I'm ready to exit" never imply selling the moonbag wallet.**
4. **Moonbag liquidation requires explicit emergency/rug intent or an explicit instruction to sell protected assets.**
5. **Never infer a rug solely from price action.**
6. **Never expose or persist private keys or seed phrases.**
7. **Identify tokens by contract/mint when possible, not symbol alone.**
8. **If the physical sweep fails, clearly state that the moonbag remains in the trading wallet and is not yet protected by wallet separation.**
