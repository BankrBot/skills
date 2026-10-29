# Transaction validation (before every Bankr submit)

`scripts/borro.mjs` runs every check below on every plan. Check again by hand when a plan came from a connected MCP
server and Node is not available. **Reject the whole plan if any check fails.** Never edit a transaction to make it
pass; build it again.

## 1. Every transaction

- `chainId` is `4663`.
- `value` is `"0"`. Nothing in this skill sends ETH.
- `to` is an address from `known-contracts.json`, as the table below allows for that step.
- Built by Borro's MCP: `data` ends with Borro's agent tag `424f52524f4d4350`. (The two BorroBuilders steps that
  `lend` builds itself carry no tag.)
- An `approve` is never for `0xffff...ffff`.

## 2. Allowed steps

| Action | Step | `to` | Selector | Arguments that must match |
| --- | --- | --- | --- | --- |
| supply (lend) | approve, if missing | the asset's token (USDG or the stock) | `0x095ea7b3` | spender = the asset's Borro vault; amount = the deposit's assets |
| | deposit | the asset's vault | `0x6e553f65` `deposit(uint256,address)` | receiver = the wallet |
| lend with a code | approve | the asset's token | `0x095ea7b3` | spender = BorroBuilders `0x082Ae609bdC7ccEec0C58B2361a21c49dc2aE291`; amount = assets |
| | deposit | BorroBuilders | `0xec2ac54e` `deposit(address,uint256,bytes32,uint256)` | vault = the asset's vault; code = bytes32 of the code; minShares > 0 |
| withdraw | one call | the asset's vault | `0xb460af94` `withdraw(uint256,address,address)` or `0xba087652` `redeem(uint256,address,address)` | receiver = owner = the wallet |
| open_short | approve, if missing | USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | `0x095ea7b3` | spender = BorroShort `0xd2D686cEdf225c5C9815187A08812783904E62Eb`; amount = the deposit |
| | open | BorroShort | `0x57ec2fac` `open(bytes32,uint256,uint256,uint256,uint256)` | marketId = the stock's `short_market_id`; minimum sale > 0; deadline in the future |
| close_short | approve, if under water | USDG | `0x095ea7b3` | spender = BorroShort |
| | close | BorroShort | `0xcc9e82fb` `close(bytes32,uint256,uint256,uint256,uint256,uint256)` | marketId = the stock's `short_market_id` |
| credit_open (new line) | approve, if missing | the market's credit token (rCREDIT `0xab35...8Ac6`, CREDIT `0xE333...004C`) | `0x095ea7b3` | spender = AgentCreditFactory `0xdD218B1BBE9a3F6f379eBF960B9592Eb29774535`; amount = credits posted |
| | open | AgentCreditFactory | `0x35936809` `open(bytes32,(...),uint256,uint256,address)` | marketId = the market's `market_id`; agent is not the wallet |
| credit_open (existing line) | approve / post / borrow | the credit token / the line | `0x095ea7b3` / `0xb6b55f25` `deposit(uint256)` / `0x4b3fd148` `borrow(uint256,address)` | the line is the wallet's (`credit_line` shows it as owner or agent); approval spender = the line |
| credit_pay | borrow | the line | `0x4b3fd148` | `to` = the payee asked for |
| credit_repay | approve, then repay / close / sellAndRepay | USDG, then the line | `0x095ea7b3`, `0x371fd8e6` `repay(uint256)`, `0xc74073a1` `close(address)`, `0x2c3f5aef` `sellAndRepay(uint256,uint256)` | approval spender = the line; `close` sends to the wallet |

Any other `to` or selector: reject.

## 3. Simulation

`simulation.ok` must be `true` (Borro ran every step in order from the wallet with `eth_simulateV1`). A failed step
comes with its reason in words ("insufficient collateral", "the wallet holds no NVDA"). For `lend`, the BorroBuilders
call is simulated on the user's own RPC when `BORRO_RPC_URL` is set; otherwise Borro's simulation of the plain deposit
of the same amount stands in, and the plan says `bookrunner_call_simulated: false`.

## 4. Preview

Show the user before submitting: the action, the asset and amount, every `summary` line, the quote, `note`, every
`warnings` entry, and chain 4663. Then submit `bankr_submit` in order.
