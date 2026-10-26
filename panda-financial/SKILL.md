---
name: panda-financial
description: Use Panda Financial on Base from an agent - deposit USDC into automated Aerodrome liquidity vaults that earn AERO, check, claim, withdraw or move positions, swap any two tokens through 0x, bridge tokens from Base to other chains through LI.FI, earn USDC interest in the Steakhouse Prime vault or lend and borrow on Morpho, buy and stake BNKR with Bankr's own staking contract, and earn referrals like a person. Builds unsigned, pre-simulated transactions for the agent's wallet to sign.
---

# Panda Financial

Panda Financial (https://pandafinancial.org) runs automated liquidity vaults on Aerodrome (Base): deposit USDC, the vault opens a
concentrated-liquidity position in your wallet's name, stakes it for AERO rewards, and Panda's bot moves the range
when the price leaves it. It also offers BNKR staking through Bankr's own contract (0x88470240FF0663Faefa68B1D7621b472DdD9584A).

Agents are customers here like people. Every tool builds exactly the transaction the website sends.

## Connect

- MCP (Streamable HTTP): `https://pandafinancial.org/mcp`
- REST: `POST https://pandafinancial.org/api/agent/tools/{tool}` with a JSON body of the arguments; `GET https://pandafinancial.org/api/agent/tools` lists them
- OpenAPI: `https://pandafinancial.org/api/agent/openapi.json`

No sign-up and no key.

## What it costs

- Every `build_*` call is free, always, for everyone: Panda earns its fee when the transaction lands. A wallet that is
  not a customer yet gets 10 builds an hour.
- Reads are free for customers: a wallet with a deposit, top-up, claim, withdrawal or range move in the last 30 days,
  named in the call's `wallet`.
- Everyone else gets 10 free reads an hour (per wallet, or per address for tools without one); `get_panda_overview` and `list_vaults` are
  always free. Past that a read costs $0.002 ($0.01 for a heavy one) in USDC on Base through x402: the call answers
  402 with `accepts`, you call again with an `X-PAYMENT` header (any x402 client), and a call that fails is never charged.
  Or buy a day pass: `POST https://pandafinancial.org/api/agent/pass` (x402, $0.25) returns a token; send it as
  `Authorization: Bearer <pass>` and every call is free for 24 hours.
- `GET https://pandafinancial.org/api/agent/pricing` has the current numbers. While it says `"enabled": false`, everything is free.

## How acting works

1. Read first: `get_panda_overview`, then `list_vaults` or a wallet's positions.
2. Call a `build_*` tool with your wallet. It returns:
   - `steps`: unsigned transactions `{to, data, value, chainId: 8453}` to send in order, each after the previous one lands (an approval, then the action);
   - `batch`: the same steps as one EIP-5792 `wallet_sendCalls` (one signature, all or nothing) for wallets that support it;
   - `simulation`: the whole sequence already run from your wallet on the latest block. If `ok` is false, do not send: read `reason`;
   - `sign_url`: a page where a human owner reviews and signs in a browser wallet;
   - `fees`, `summary` and `notes`.
3. Sign and send within 10 minutes; after that, build again. With Bankr, submit each step as a raw transaction.
4. Check with `get_transaction_status`.

Panda never signs, never holds funds and never asks for a private key. Before signing, check that every `to` is one of
the contracts `get_panda_overview` lists. You pay gas in ETH on Base.

## Read tools

- `get_panda_overview` (no arguments): Start here. What Panda offers on Base, which tool does what, fees, minimums, how signing works and every contract a transaction may touch.
- `list_vaults` (`wallet` (optional)): The automated liquidity vaults: pair, whether deposits are open, fee rates (for a wallet when given), deposited value, depositors, rewards paid so far and the pool's reward stream.
- `get_wallet_positions` (`wallet`): Every open position a wallet has in the automated vaults: value, tokens held, price range, whether it is earning, rewards ready to claim, lifetime earnings, deposits, net result and live APR (the figures the website shows).
- `get_old_vault_positions` (`wallet`): Positions a wallet still has in Panda's OLD vault (withdraw-only since 2026-10-04): value, tokens, rewards ready.
- `get_bankr_position` (`wallet`): A wallet's stake in Bankr's BNKR staking contract: staked, rewards ready, multiplier, unstaking queue, withdrawable now, BNKR and USDC in the wallet, BNKR price.
- `get_wallet_balances` (`wallet`): ETH (for gas), USDC, WETH, AERO and BNKR on Base for a wallet, with dollar values.
- `get_transaction_status` (`hash`): Whether a Base transaction succeeded, the token changes for its sender and the Panda vault or staking events it emitted (new position id, rewards paid, withdrawals).
- `get_swap_price` (`sell_token`, `buy_token`, `amount`, `slippage_bps` (optional)): What swapping one token for another on Base would return right now through 0x (the route the website uses): amount out, the fees (Panda 0.15% in the sold token + 0x 0.15%) and the sources. No wallet needed.
- `get_defi_positions` (`wallet`): A wallet's deposit in the Curated Vault (Steakhouse Prime USDC on Morpho) and its position in the Morpho WETH/USDC market (USDC lent, WETH collateral, USDC borrowed, health factor, liquidation price), with today's rates and the wallet's USDC and WETH.
- `get_referral_code` (`wallet`): The wallet's own Panda referral code and link (created on first use), its tier, referrals, and what it has earned and been paid. Agents earn referrals exactly like people: a share of Panda's fee on their referees' rewards, paid in USDC every two weeks.
- `check_referral_eligibility` (`wallet`, `code`): Whether a wallet may accept a referral code: it must never have deposited in any Panda vault, never have accepted a referral, and not be the code's owner.
- `referral_accept_message` (`wallet`, `code`): The exact sign-in message (EIP-4361) a wallet signs to accept a referral code, with a fresh 10-minute nonce. Sign it as plain text with the wallet, then call accept_referral. Do this before the wallet's first deposit.
- `accept_referral` (`message`, `signature`): Records the acceptance from the signed message (from referral_accept_message) and its signature. Nothing is sent on chain. After this, the wallet's first deposit counts for the referrer.

## Build tools

- `build_vault_deposit` (`wallet`, `amount_usdc`, `amount_weth` (optional), `vault` (optional), `auto_compound` (optional)): Open a new position in an automated vault with USDC (about half is swapped to WETH in the same transaction), or with both WETH and USDC. Minimum $5 (or $2.50 a side). Includes the USDC approval when needed.
- `build_vault_top_up` (`wallet`, `token_id`, `amount_usdc`, `vault` (optional)): Add USDC to an existing position, in its current range (minimum $1).
- `build_vault_claim` (`wallet`, `token_id`, `receive` (optional), `vault` (optional)): Claim a position's AERO rewards, as USDC (swapped, default) or as AERO. The position keeps earning.
- `build_vault_withdraw` (`wallet`, `token_id`, `receive` (optional), `rewards` (optional), `vault` (optional)): Withdraw a whole position: back as USDC (default; its WETH is swapped) or as both WETH and USDC, with its rewards as USDC (default) or AERO. A closed position's leftovers are collected instead.
- `build_vault_set_auto_compound` (`wallet`, `token_id`, `enabled`, `vault` (optional)): Turn auto-compound on (rewards are added back into the position at each range move) or off (rewards are paid out).
- `build_vault_move` (`wallet`, `token_id`, `vault` (optional), `to_vault` (optional)): Move a position to another open Panda vault for the same pair in one transaction, with no Panda fee (only when such a vault exists).
- `build_old_vault_withdraw` (`wallet`, `token_id`): Withdraw a position from Panda's old vault (no fee).
- `build_old_vault_migrate` (`wallet`, `token_id`, `auto_compound` (optional)): Withdraw an old-vault position and deposit it into the new vault, best as one batch (the website's Migrate button). Positions under $5 should be withdrawn instead.
- `build_bnkr_buy` (`wallet`, `amount_usdc`): Buy BNKR with USDC through 0x (Panda 0.15% + 0x 0.15%). Minimum 0.10 USDC. Then stake it with build_bnkr_stake.
- `build_bnkr_stake` (`wallet`, `amount_bnkr`): Stake BNKR in Bankr's own staking contract for the wallet (rewards in BNKR; unstaking takes 48 hours). No Panda fee.
- `build_bnkr_restake` (`wallet`): Add the wallet's BNKR staking rewards to its stake.
- `build_bnkr_request_unstake` (`wallet`, `amount_bnkr`): Start Bankr's 48-hour unstaking wait for some or all of the stake (it stops earning now).
- `build_bnkr_withdraw` (`wallet`): Send BNKR whose 48-hour wait is over back to the wallet.
- `build_swap` (`wallet`, `sell_token`, `buy_token`, `amount`, `slippage_bps` (optional)): Swap any two ERC-20 tokens on Base through 0x for the wallet: an approval of 0x's AllowanceHolder if needed, then the swap exactly as 0x built it. Fees: Panda 0.15% in the sold token (paid inside the swap) + 0x 0.15%. Native ETH is not swapped (wrap it first).
- `build_bridge` (`wallet`, `from_chain`, `to_chain`, `token`, `amount`, `to_token` (optional), `to_wallet` (optional)): Send USDC, WETH, ETH or any token from Base to another chain (ethereum, arbitrum, optimism, polygon, bsc, avalanche, linea, scroll, zksync, or a chain id) through the LI.FI route the website's Bridge uses: an exact approval of the route's spender if needed, then the bridge transaction exactly as LI.FI built it. Fees: LI.FI 0.25% + Panda 0.15%, paid inside the transaction, plus the route's own costs; all are returned. From Base only (a bridge into Base starts on the other chain).
- `build_curated_vault_deposit` (`wallet`, `amount_usdc`): Deposit USDC into Steakhouse Prime USDC, a Morpho vault curated by Steakhouse Financial (about 4% a year, changes daily, compounds in the share price). Panda's fee: 0.05% once, inside the transaction. Withdraw any time.
- `build_curated_vault_withdraw` (`wallet`, `amount_usdc`): Withdraw USDC from Steakhouse Prime USDC to the wallet. No Panda fee; subject to the vault's liquidity.
- `build_lend_supply` (`wallet`, `amount_usdc`): Lend USDC in the Morpho WETH/USDC market (interest accrues as it is borrowed). Panda's fee: 0.05% once, inside the transaction.
- `build_lend_withdraw` (`wallet`, `amount_usdc`): Withdraw USDC lent in the Morpho WETH/USDC market. No Panda fee; subject to the market's liquidity.
- `build_borrow` (`wallet`, `collateral_weth` (optional), `borrow_usdc` (optional)): Add WETH as collateral and/or borrow USDC in the Morpho WETH/USDC market (liquidation at 86% loan-to-value; the tool refuses anything past it and reports the health factor). No Panda fee. The first borrow includes a one-time bundler authorization.
- `build_repay` (`wallet`, `amount_usdc`): Repay part or all of the USDC owed in the Morpho WETH/USDC market. No Panda fee.
- `build_withdraw_collateral` (`wallet`, `amount_weth`): Withdraw WETH collateral from the Morpho WETH/USDC market (refused if it would leave the loan past 86% loan-to-value). No Panda fee.

Amounts are strings in whole tokens ("25", "0.5"); BNKR amounts may be "all".

## Examples

- Deposit $25: `build_vault_deposit {"wallet":"0x...","amount_usdc":"25"}`, then send the steps.
- Bridge 20 USDC from Base to Arbitrum: `build_bridge {"wallet":"0x...","from_chain":"base","to_chain":"arbitrum","token":"USDC","amount":"20"}`, then send the steps on Base.
- Earn USDC interest: `build_curated_vault_deposit {"wallet":"0x...","amount_usdc":"50"}` (Steakhouse Prime USDC on Morpho), or lend in the market with `build_lend_supply`; check with `get_defi_positions`.
- Swap 0.01 WETH to USDC: `get_swap_price {"sell_token":"WETH","buy_token":"USDC","amount":"0.01"}`, then `build_swap {"wallet":"0x...","sell_token":"WETH","buy_token":"USDC","amount":"0.01"}`.
- Earn referrals: `get_referral_code {"wallet":"0x..."}` gives the code to share; a new wallet accepts one with `referral_accept_message` (sign it) and `accept_referral` before its first deposit.
- Take everything out as USDC: `get_wallet_positions`, then `build_vault_withdraw {"wallet":"0x...","token_id":"<id>"}`.
- Stake $10 of BNKR: `build_bnkr_buy {"wallet":"0x...","amount_usdc":"10"}`, send it, then `build_bnkr_stake {"wallet":"0x...","amount_bnkr":"all"}`.

## Risks

A liquidity position moves with the price of ETH and can be worth less than what went in. BNKR can rise or fall a lot.
Rewards depend on the pool's AERO emissions and the price of AERO. Nothing here is financial advice. Terms: https://pandafinancial.org/docs/terms/

## Live copy

This file is a snapshot. The live version, generated from the running tool list, is https://pandafinancial.org/skill.md; the
tool list itself is `GET https://pandafinancial.org/api/agent/tools` and the prices are `GET https://pandafinancial.org/api/agent/pricing`.
