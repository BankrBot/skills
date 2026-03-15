---
name: fxusd
description: Mint or redeem Base fxSAVE through a public shortcut flow, without manually bridging between Base and Ethereum mainnet. Use when the user wants to deposit fxUSD, USDC, or WETH into fxSAVE, redeem fxSAVE back into Base assets, preview the route, or build approval plus execution payloads from the public fxSAVE app backend.
---

# fxUSD

Shortcut the `fxSAVE` flow on Base.

**App:** https://fxsave.up.railway.app/
**Repo:** https://github.com/huwangtao123/fxsave-dapp

## Why use this skill

Without the shortcut, using `fxSAVE` from Base means manually thinking through:

```text
Base -> bridge to mainnet -> deposit or redeem -> bridge back -> Base
```

This skill keeps the user interaction simple and lets the app backend build the hidden Enso route.

## Capabilities

- Mint Base `fxSAVE` from `fxUSD`, `USDC`, or `WETH`
- Redeem Base `fxSAVE` back into Base assets
- Build the executable bundle payload
- Build the approval payload for the current source token
- Explain async cross-chain settlement clearly

## Usage examples

- `Deposit 10 fxUSD to fxSAVE`
- `Deposit 100 USDC to fxSAVE`
- `Redeem 50% of my fxSAVE to fxUSD`
- `Preview the route to mint fxSAVE from 1 WETH`

## Public endpoints

- Bundle builder: `POST https://fxsave.up.railway.app/api/fxsave/fxsave-bundle`
- Approval builder: `POST https://fxsave.up.railway.app/api/fxsave/fxsave-approve`

## Workflow

1. Determine direction.
- `mint`: Base asset -> Base `fxSAVE`
- `redeem`: Base `fxSAVE` -> Base asset

2. Resolve tokens.
- For `mint`, provide the selected Base source token metadata.
- For `redeem`, provide the target Base asset metadata.
- Use the connected wallet address for both `fromAddress` and `receiver`.

3. Build the bundle.
- Call the bundle endpoint.
- Treat `result.tx` as the canonical executable payload.
- Use `flow`, `warnings`, and `bridgingEstimates` to explain what happens.

4. Check approval.
- Identify the actual source token for the current direction.
- Call the approval endpoint with the raw amount and source token address.
- Compare allowance before sending approval.
- Skip approval if allowance is already sufficient.

5. Execute.
- Submit approval first when needed.
- Submit the main transaction second.
- Tell the user the Base transaction can confirm before the final bridged asset arrives.

## Requirements

- A Base wallet with the input asset and enough ETH for gas
- Access to the public fxSAVE app backend at `https://fxsave.up.railway.app`

If the agent can sign and submit transactions, it can execute directly.
If not, use this skill for planning and pair it with a transaction execution skill such as `bankr`.

## Safety rules

- Do not describe this as same-chain instant settlement.
- Do not invent token decimals or addresses.
- Do not bypass the app backend by manually reconstructing Enso payloads unless the public route is broken.
- Surface route warnings to the user before execution.
- Stop if bundle generation fails instead of guessing a fallback route.

## Supported defaults

- `fxUSD`
- `USDC`
- `WETH`
- `fxSAVE` as the redeem source token

## When to read more

- Read [references/api.md](references/api.md) for request and response shapes.
- Use `scripts/fxusd_cli.py` for quick local or remote API checks.
