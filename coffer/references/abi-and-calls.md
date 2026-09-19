# Coffer — ABI and call details

Always RPC **Robinhood `4663`**. Vault + LS from `addresses.md`.

Shares live on **CofferLiquidShares**. `vault.totalSupply()` / `vault.balanceOf(user)` forward there, so either is fine.

User-facing: `balance()` is **vault value** / **total value**; payouts and WETH-quote are **WETH**; USDG-quote is **USDG**; `isAllowedToken` is **rotating tokens**. Call the Solidity names below; do not say them to the user.

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
function withdraw(uint256 shares) external returns (uint256 outAmount); // user: WETH out

event Withdraw(address indexed user, uint256 shares, uint256 outAmount, uint256 acc);
event Deposit(address indexed user, uint256 wethNotional, uint256 shares, uint256 acc);
```

`depositETH` wraps native ETH to WETH and routes it toward underweight strategies. User does not pick a pair. Say **deposit ETH**.

`withdraw` burns liquid shares and pulls the same fraction from **every** strategy (retired included), paid as **WETH**. No token-out toggle. One strategy reverting reverts the whole withdrawal.

`outAmount` is the user’s WETH delta. After a withdraw, report it as WETH received. Do not describe this as transferring shares.

---

## CofferStrategy (per `strategies(i).strat`)

```solidity
function ASSET() external view returns (address);       // current pair token
function quoteToken() external view returns (address);  // WETH (aeWETH) or USDG
function poolFee() external view returns (uint24);
function isAllowedToken(address token) external view returns (bool); // rotating tokens
function UniswapFeesCollected() external view returns (uint256); // cumulative
function mode() external view returns (uint8);          // 0 ACTIVE, 1 IDLE
function poolValue() external view returns (uint256);   // this leg’s value (WETH)

event AllowedTokenSet(address indexed token, bool allowed);
```

Fees for the vault = sum of `UniswapFeesCollected()` across all strategies.

When showing a pair, quote is **WETH** if `quoteToken` is aeWETH, **USDG** if USDG.

`mode == 1` (`IDLE`) means that leg is sitting in quote (WETH or USDG) during a rotation; the keeper skips it. Still counts in vault value / withdrawals unless `retired`.

---

## CofferLiquidShares

```solidity
function totalSupply() external view returns (uint256);
function balanceOf(address account) external view returns (uint256);
```

18 decimals.

---

## Withdraw share sizing

Human `x` shares → `x * 1e18` if the user spoke in whole shares.  
Percent → `balanceOf(user) * x / 100`.  
All → `balanceOf(user)`.  
Cap at balance; skip tx if 0.

---

## Do not call from this skill

- AutoVault factories / keepers / `withdraw(shares, asAsset)`
- `CofferKeeper.performUpkeep` / `performHarvest` (EC2 operator cadence)
- `changeAsset` / `exitToQuote` / `setBandParams` (operator/owner admin)
- ShareStaking (Coffer has none)
