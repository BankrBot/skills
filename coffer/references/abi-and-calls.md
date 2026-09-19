# Coffer — ABI and call details

Always RPC **Robinhood `4663`**. Vault + LS from `addresses.md`.

Shares live on **CofferLiquidShares**. `vault.totalSupply()` / `vault.balanceOf(user)` forward there, so either is fine.

User-facing: `balance()` is **vault value** / **total value**; payouts and WETH-quote are **WETH**; USDG-quote is **USDG**; `isAllowedToken` is **rotating tokens**. Call the Solidity names below; do not say them to the user.

The only write selectors this skill may use are `depositETH()` and `withdraw(uint256)` on the vault. Everything else here is `view`.

---

## CofferVault

```solidity
function liquidShares() external view returns (address);
function strategyCount() external view returns (uint256);
function strategies(uint256 index) external view returns (
    address strat,
    uint16 targetWeightBps,
    bool retired
);

function balance() external view returns (uint256); // vault value, WETH-notional (18 decimals)
function totalSupply() external view returns (uint256);
function balanceOf(address account) external view returns (uint256);

function depositETH() external payable returns (uint256 shares); // user: deposit ETH
function withdraw(uint256 shares) external returns (uint256 received); // user: WETH out (see caveats)

event Deposit(address indexed user, uint256 wethNotional, uint256 shares, uint256 acc);
event Withdraw(address indexed user, uint256 shares, uint256 outAmount, uint256 acc);
```

### `depositETH()`

Wraps native ETH to WETH and routes it toward underweight strategies. User does not pick a pair. Say **deposit ETH**.

- **No caller parameters.** There is no minimum-shares or deadline argument. If the user needs one, stop.
- Shares are priced at `min(spot value, TWAP-gated value)` and credit is capped at the WETH deposited, so shares can be lower than a naive `wei × supply / balance` estimate.
- Reverts `TwapUnavailable` when the TWAP gate on any active strategy is closed; simulation will show this.
- No deposit fee. Fees the user will meet later: `withdrawalFeeBps` on exit, `protocolFeeBps` on LP fees earned (see strategy getters).

### `withdraw(uint256 shares)`

Burns liquid shares and pulls the same fraction from **every** strategy, **retired included**. One strategy reverting reverts the whole call; there are no partial burns.

- **Clamp / sweep.** `shares > balanceOf(user)` is clamped to the balance. `balanceOf(user) - shares < 1e10` (raw) is treated as a **full exit**. The `Withdraw` event carries the shares actually burned, which can differ from the input.
- **Fee first.** Each strategy takes `withdrawalFeeBps` of the user's slice (pair token and quote token alike) **before** any conversion.
- **Two conversion hops, each with an in-kind fallback.** Per strategy: pair token → quote token, then quote token → WETH (stock legs only; their quote is USDG). Each hop is a swap behind a TWAP floor widened for exits. If a hop's floor is refused, that leg is transferred to the user **in kind** and the shares still burn. Possible payouts: WETH only; WETH + USDG; WETH + pair tokens; or zero WETH with only in-kind tokens.
- **`outAmount` / `received` is the WETH delta only.** It does not include in-kind tokens. Never treat it as the full economic payout.
- **No caller parameters.** No minimum output, no slippage limit, no deadline. The exit floor is the contract's own per-swap protection, not a user-settable guarantee. If the user needs WETH-only or a bound, stop.

---

## CofferStrategy (per `strategies(i).strat`)

```solidity
function vault() external view returns (address);       // must equal the pinned vault
function ASSET() external view returns (address);       // current pair token
function quoteToken() external view returns (address);  // WETH (aeWETH) or USDG
function poolFee() external view returns (uint24);
function isAllowedToken(address token) external view returns (bool); // rotating tokens
function UniswapFeesCollected() external view returns (uint256); // cumulative, WETH-notional
function mode() external view returns (uint8);          // 0 ACTIVE, 1 IDLE
function poolValue() external view returns (uint256);   // this leg's value (WETH)

// Fee / execution config — read live before every preview.
function withdrawalFeeBps() external view returns (uint256);   // taken from the user's slice on exit (100 = 1%)
function protocolFeeBps() external view returns (uint256);     // taken from LP fees earned, not principal (300 = 3%)
function protocolFeeOn() external view returns (bool);         // false → protocol fee skipped
function swapSlippageBps() external view returns (uint16);     // floor haircut; exits use min(×3, 1000)
function maxTwapDeviationBps() external view returns (uint256);// spot-vs-TWAP gate; exits use ×3
function twapSeconds() external view returns (uint32);         // TWAP window (1800 = 30 min)

event AllowedTokenSet(address indexed token, bool allowed);
```

Fees for the vault = sum of `UniswapFeesCollected()` across all strategies.

When showing a pair, quote is **WETH** if `quoteToken` is aeWETH, **USDG** if USDG.

**Retired** (`strategies(i).retired == true`): the vault sends it no new deposits. Its assets remain in `balance()` and are paid out on every `withdraw`. Do not exclude it from value or exit accounting.

**IDLE** (`mode() == 1`): the operator has exited the LP position (rotation in progress) and the keeper skips it. It usually holds quote token, but an `exitToQuote` whose swap was refused leaves unsold pair token behind, so do not assume it is quote-only. It still counts in value and withdrawals.

---

## CofferLiquidShares

```solidity
function totalSupply() external view returns (uint256);
function balanceOf(address account) external view returns (uint256);
function decimals() external view returns (uint8); // 18
```

---

## Preview recipes (all read-only)

Run these before asking for authorization. Use the connected wallet as `from`.

| Purpose | Call | Notes |
| --- | --- | --- |
| Chain check | `eth_chainId` | Must be `0x1237` (4663) |
| Code check | `eth_getCode(vault)`, `eth_getCode(liquidShares)`, `eth_getCode(WETH)` | All non-empty |
| Wiring check | `vault.liquidShares()`, `strategies(i).strat.vault()` for each `i` | Match catalog / pinned vault |
| Deposit share estimate | `wei × liquidShares.totalSupply() / vault.balance()` | Estimate only; 1:1 if supply is 0 |
| Deposit simulation | `eth_call { from: user, to: vault, data: depositETH(), value: wei }` | Must succeed |
| Deposit gas | `eth_estimateGas` with the same fields | |
| Withdraw WETH estimate | `eth_call { from: user, to: vault, data: withdraw(shares) }` → `received` | Estimate; excludes in-kind legs |
| Withdraw gas | `eth_estimateGas` with the same fields | |
| Fees | `withdrawalFeeBps()`, `protocolFeeBps()`, `protocolFeeOn()` on each strategy | Show the live values |
| Exit floor params | `maxTwapDeviationBps()`, `swapSlippageBps()`, `twapSeconds()` | Exits: deviation ×3, haircut min(×3, 1000) |

Selectors: `depositETH()` = `0xf6326fb3`; `withdraw(uint256)` = `0x2e1a7d4d`. Verify the calldata selector matches before signing.

---

## Decoding results from the receipt

Report only from a mined receipt with `status == 1` on chain 4663. A transaction hash is `pending`; a receipt with `status == 0` is `reverted`. Solidity return values are **not** in a receipt, and an `eth_call` result is a simulation, not the outcome.

Topic hashes:

| Event | topic0 |
| --- | --- |
| `Deposit(address,uint256,uint256,uint256)` | `0x36af321ec8d3c75236829c5317affd40ddb308863a1236d2d277a4025cccee1e` |
| `Withdraw(address,uint256,uint256,uint256)` | `0x02f25270a4d87bea75db541cdfe559334a275b4a233520ed6c0a2429667cca94` |
| ERC-20 `Transfer(address,address,uint256)` | `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` |

### Deposit

Find the log with `address == vault`, topic0 = the `Deposit` hash, topic1 = the user (left-padded). Data (non-indexed, in order): `wethNotional`, `shares`, `acc`. Report `shares` and `wethNotional` (both 18 decimals).

### Withdraw

1. Find the log with `address == vault`, topic0 = the `Withdraw` hash, topic1 = the user. Data: `shares` (actually burned), `outAmount` (WETH delta), `acc`. Report both; report `outAmount` even when it is `0`.
2. Enumerate every log with topic0 = the `Transfer` hash and topic2 = the user. Group by `address` (the token). For each token that is **not** WETH, report token address, symbol from `addresses.md` if known, raw amount, and the amount scaled by that token's `decimals()` read live (USDG = **6**; WETH and shares = 18).
3. If the `Withdraw` log is missing, report that the outcome could not be verified. Do not infer amounts.

---

## Withdraw share sizing

Human `x` shares → `x * 1e18` if the user spoke in whole shares.  
Percent → `balanceOf(user) * x / 100`, require `0 < x ≤ 100`.  
All → `balanceOf(user)`.  
Parse as decimal strings into integers; never floating point. Cap at balance; skip tx if 0; disclose the full-exit sweep when the remainder would be `< 1e10` raw.

---

## Do not call from this skill

- AutoVault factories / keepers / `withdraw(shares, asAsset)`
- `CofferKeeper.performUpkeep` / `performHarvest` (operator cadence)
- `changeAsset` / `exitToQuote` / `setBandParams` and any other owner / operator setter
- ERC-20 `approve` / permit — neither user flow needs one
- ShareStaking (Coffer has none)
