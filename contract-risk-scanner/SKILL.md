---
name: contract-risk-scanner
description: Pre-trade smart contract risk scanner for AI agents. Use when users ask whether a token or contract is safe, request honeypot checks, ownership privilege analysis, upgradeability risk, transfer restrictions, tax or fee behavior, blacklist or whitelist controls, or a go/no-go safety recommendation before buying or swapping.
metadata:
  {
    "clawdbot":
      {
        "homepage": "https://github.com/BankrBot/skills"
      }
  }
---

# Contract Risk Scanner

Contract Risk Scanner helps agents evaluate token and contract safety before executing onchain actions.
It performs structured risk analysis and returns a clear recommendation: GO, CAUTION, or AVOID.

## When To Use

Use this skill when the user asks:
- Is this token safe?
- Check if this contract is a honeypot
- Can I buy and sell this token safely?
- Scan this CA before swap
- What are the biggest risks in this contract?

## Core Checks

### 1) Permission and Ownership Risk
- Owner privileges and privileged roles
- Ability to mint, pause, blacklist, freeze, or change fees
- Ownership renounced vs transferable
- Timelock or multisig protection on admin functions

### 2) Upgradeability Risk
- Proxy pattern detection (UUPS, Transparent, Beacon)
- Upgrade authority holder
- Risk if implementation can be swapped instantly

### 3) Transfer Behavior Risk
- Buy or sell transfer tax and hidden fee logic
- Max transaction or max wallet limits
- Cooldown or anti-bot restrictions
- Blacklist or whitelist gating

### 4) Liquidity and Market Risk
- LP lock or burn status (when available)
- Concentration risk (top holder distribution)
- Indicators of potential liquidity drain risk

### 5) Execution Safety Risk
- Simulated buy or sell feasibility (if supported)
- Common revert causes and suspicious patterns
- Mismatch between advertised and actual transfer behavior

## Output Format

Always return:
- Risk score: 0-100
- Severity: low, medium, high, critical
- Confidence: low, medium, high
- Top 5 findings (most actionable first)
- Recommendation:
  - GO: no critical blockers found
  - CAUTION: proceed with strict limits
  - AVOID: critical risk detected
- Suggested execution limits:
  - max position size
  - max slippage
  - minimum liquidity threshold

## Prompt Examples

- Analyze contract risk for 0x...
- Check if this token is honeypot on Base: 0x...
- Can I safely buy this token? Give a GO or AVOID decision.
- Scan this CA and explain owner risks in simple terms.
- Run a pre-trade safety report before I swap 100 USDC.

## Safety Rules

- Never claim absolute safety.
- Always include uncertainty when source data is incomplete.
- If critical checks are missing, return CAUTION or AVOID.
- For high-risk findings, recommend read-only research mode and small test size only.
- Do not suggest bypassing protocol or chain safeguards.

## Error Handling

- If chain is missing: request target network.
- If contract is unverified: set confidence to low and elevate risk.
- If a data source fails: return partial report and list missing fields.
- If address format is invalid: return correction guidance and stop execution recommendation.

## Recommended Agent Workflow

1. Detect buy, swap, or token research intent.
2. Run risk scan first.
3. If AVOID: block execution and explain reasons.
4. If CAUTION: require explicit confirmation and strict limits.
5. If GO: continue to trade planning and execution.

## Resources

- Contract verification and ABI source
- Holder distribution source
- Liquidity and pool analytics source
- Transaction simulation endpoint (optional but recommended)
