# SlateFund — verified read and exit signatures

Checked against the deployed funds on Base (chain id 8453) by calling each function.

```solidity
// state
function totalNAV() view returns (uint256);                   // USDC, 6 decimals
function navPerShare() view returns (uint256);                // USDC, 6 decimals
function currentWeights() view returns (uint16[] memory);     // bps
function scaledHoldings() view returns (uint256[] memory);
function feedsHealthy() view returns (bool healthy, address staleFeed);
function rebalanceStatus() view returns (bool possible, string memory reason, uint256 nextEligibleAt, uint256 maxDriftBps);
function depositsPaused() view returns (bool);
function maxPositionPerWallet() view returns (uint256);
function maxFundValue() view returns (uint256);
function driftThresholdBps() view returns (uint16);
function minRebalanceInterval() view returns (uint32);
function lastRebalanceAt() view returns (uint256);
function callerRewardBps() view returns (uint16);
function componentsLength() view returns (uint256);
function components(uint256) view returns (address token, address feed, uint16 targetWeightBps, uint8 tokenDecimals, uint8 feedDecimals, address pool);
function SHARE() view returns (address);
function USDC() view returns (address);

// exit with no swaps and no oracle; needs approve(fund, shareAmount) on the share token first
// redeemInKindSkippingBlocked forfeits any component that cannot be transferred
function redeemInKind(uint256 shareAmount) external;
function redeemInKindSkippingBlocked(uint256 shareAmount) external;

// need off-chain 0x AllowanceHolder calldata, use the app
function deposit(uint256 usdcAmount, uint256[] calldata sellAmounts, bytes[] calldata swapCalldata) external;
function redeem(uint256 shareAmount, bytes[] calldata swapCalldata) external;
function rebalance(int256[] calldata amounts, bytes[] calldata swapCalldata) external;
```

Events: `Deposited`, `Redeemed`, `RedeemedInKind`, `RedeemedInKindPartial`, `Rebalanced`.
