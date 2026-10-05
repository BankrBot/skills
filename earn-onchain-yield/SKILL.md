---
name: earn-onchain-yield
description: Discover EARN automated vaults and Omnipools on Robinhood Chain, compare live yield, and prepare deposits, one-asset zaps, withdrawals and EARN reward claims for confirmed execution through a Bankr wallet. Use for EARN protocol positions, not generic yield searches or token launches.
metadata:
  homepage: https://earnonhood.com/agent
---

# EARN on Bankr

EARN puts assets into liquidity strategies on **Robinhood Chain (4663)**:

- **Auto vaults:** Steer-managed Uniswap liquidity positions. Deposit the pair or zap from a supported asset; receive a vault share. Yield comes from trading fees and active rewards.
- **Omnipools:** weighted baskets of assets represented by one pool-share token. Deposit the basket or use an available one-asset zap; withdraw back to underlying tokens.

This skill supplies protocol instructions; Bankr supplies the authenticated wallet and transaction submission. Installing it does not grant spending authority, guarantee a swap route, or make EARN APIs into a transaction-building service.

## Start here

1. For discovery and APRs, read the **Live discovery endpoints** and **APR resolution** sections of [the protocol reference](references/protocol.md). Public reads need no EARN API key.
2. Before preparing any transaction, read [Bankr execution](references/bankr-execution.md) and the relevant deposit, zap, withdrawal or claim section in [the protocol reference](references/protocol.md).
3. Use the authenticated Bankr EVM wallet, not an address guessed from the conversation. Require chain **4663**, sufficient asset balances and ETH for gas.
4. Show the exact action, input amounts, output/share token, protected minimums, approvals/spenders, destination, quote age, deadline and risks. Obtain explicit user confirmation of this bounded sequence before submission.
5. Verify each receipt and the resulting balances. A prepared payload, transaction hash or HTTP 200 is not proof of a successful deposit.

Do not request private keys or seed phrases. Keep Bankr credentials inside the existing Bankr integration; never send them to EARN, an RPC endpoint or a quote provider. Do not create accounts, change wallet security settings or enable broader permissions automatically.

## Discover and choose

Read-only examples:

```bash
curl --fail --silent --show-error --max-time 30 https://earnonhood.com/api/steer/metrics
curl --fail --silent --show-error --max-time 30 https://earnonhood.com/api/steer-apr
curl --fail --silent --show-error --max-time 30 https://earnonhood.com/api/omni/pools
curl --fail --silent --show-error --max-time 30 https://earnonhood.com/api/omni/rewards
```

Join Auto metrics to the pinned vault catalog and APR entries by address; use the exact `id` for vault-specific API requests. Never send display text such as `SPY/QQQ` as a vault ID. Match an Omnipool by full pool address in the live registry, not its name alone; ask the user to choose if names are ambiguous. Include initialized non-featured pools in discovery too.

Show fee APR and reward APR separately, with a total only when supported by the returned data. Preserve unavailable values; never interpret an unresolved zero as a measured zero. Label annualized estimates and time-stamp the data. APR is variable, incentives expire, and liquidity positions can lose value relative to holding their assets.

Use `/api/omni/pools?lite=1` for quick address discovery, **not** fee APR: the lightweight response omits it. Pool weights in the API are percentages, not fractions; for transaction amounts read and normalize the onchain weights as described in the reference.

## Actions and boundaries

| User intent | Procedure |
| --- | --- |
| Deposit both Auto assets | Read the live ratio; disclose that token-use minima are not minimum shares and there is no onchain expiry; stop if those protections are required. Otherwise confirm, approve exact amounts and simulate the deposit. |
| Zap into an Auto vault | Resolve the runtime Auto executor; confirm vault registration; quote the required pair legs; simulate the complete `zap`. |
| Deposit an Omnipool basket | Preserve onchain token order; query proportional shares; check both ERC-20 and Permit2 allowances; simulate the Router call. |
| Zap into an Omnipool | Use ETH, WETH or USDG; verify the runtime executor's protocol wiring; query protected pool shares and simulate the complete `zap`. |
| Withdraw | Use the exact wallet-held share amount and nonzero protected minimums for nonzero outputs; return underlying assets to the same wallet. |
| Claim EARN | Fetch current Merkl proofs for this wallet; claim cumulative proof amounts through the pinned Distributor; verify settlement. |

Auto zap funding is ETH, WETH, USDG or either token of the selected vault's pair, subject to live routing. Omnipool zaps require supported routes for every needed output token; a registered pool is not a guarantee that a one-asset zap is available. Where a quote cannot be obtained, explain the limitation and offer the ordinary basket/pair deposit if supported. Do not substitute an arbitrary swap target for an EARN executor.

Only transact with cataloged vaults or initialized pools in the EARN registry, after verifying their contracts and tokens onchain. For a new Auto vault absent from the bundled catalog, compare the latest public `https://earnonhood.com/SKILL.md` with live metrics and onchain token addresses before using it. If they cannot be reconciled, stop execution and report the missing integration; do not guess from a ticker.

The agent must have HTTPS, RPC reads, an ABI encoder, simulation and Bankr submission available to execute these procedures. If any capability is missing, provide discovery and the relevant EARN product link without claiming to have prepared an executable transaction. If **Bankr blocks a transaction for security reasons**, stop; do not route around that decision using a different wallet, API or venue.

This version covers Auto and Omnipools. Leveraged LOOP, lending, pool creation and protocol administration are outside its execution scope. Wallet-held shares and shares posted as lending collateral are different balances; do not attempt to withdraw collateralized shares through the basic vault flow.

## Example requests

- “Compare current SPY/QQQ Auto yield with EARN ETF Omnipool yield.” → live fee/reward breakdown and risks; no transaction.
- “Put 25 USDG into the CASHCAT Auto vault.” → resolve the live vault and route, read the Bankr wallet balance, prepare protected quotes, then show the complete confirmation before approvals.
- “Deposit 0.01 ETH into this EARN Omnipool: [pool address].” → verify the registry entry and executor, preview pool shares and gas, then request confirmation.
- “Withdraw half my SPY/QQQ vault position.” → read the wallet's actual share balance; preview and protect both outputs; confirm and submit.
- “Claim my EARN rewards.” → fetch fresh wallet-specific proofs, deduplicate claims and confirm the Distributor transaction.

## Integration checks

From this skill's folder, run `node scripts/check.mjs` to check packaging and reference links, and `node --test scripts/execution-guards.test.mjs` for quote/slippage/freshness and direct-deposit protection regressions. Before preparing transactions, use [the pure execution guards](scripts/execution-guards.mjs) as directed in the protocol reference. They do not build, sign or submit transactions and do not replace complete simulation. `node scripts/check.mjs --live` additionally performs public, read-only endpoint/chain checks. None of these commands asks for a key or proves Bankr wallet execution end to end.

Public interfaces: [Auto](https://earnonhood.com/auto), [Omnipools](https://earnonhood.com/omni/pools), [documentation](https://earnonhood.com/docs).
