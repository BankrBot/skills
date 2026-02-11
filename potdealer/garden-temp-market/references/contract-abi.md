# GTM Contract ABI Reference

## Contract Address
`0xA3F09E6792351e95d1fd9d966447504B5668daF6` on Base (chainId 8453)

## Betting Functions

### betHigher()
Bet that today's temp will be HIGHER than yesterday's.

```solidity
function betHigher() external payable
```
- **Selector**: `0xb3dd0f5a`
- **Value**: Amount to bet (min 0.001 ETH)

### betLower()
Bet that today's temp will be LOWER or equal to yesterday's.

```solidity
function betLower() external payable
```
- **Selector**: `0x7a5ce755`
- **Value**: Amount to bet (min 0.001 ETH)

## Read Functions

### getMarketState()
Get full market state.

```solidity
function getMarketState() external view returns (
    uint256 round,
    int256 baseline,      // divide by 100 for °C
    uint256 higherTotal,  // wei
    uint256 lowerTotal,   // wei
    uint256 rollover,     // wei
    bool isBettingOpen,
    uint256 secondsUntilClose,
    uint256 secondsUntilSettle
)
```

### bettingOpen()
Check if betting is currently open.

```solidity
function bettingOpen() external view returns (bool)
```

### yesterdayTemp()
Get yesterday's baseline temperature.

```solidity
function yesterdayTemp() external view returns (int256)
```
Returns temperature with 2 decimal places (e.g., 1210 = 12.10°C)

## Events

```solidity
event BetPlaced(uint256 indexed round, address indexed bettor, bool isHigher, uint256 amount, int256 baseline);
event RoundSettled(uint256 indexed round, int256 todayTemp, int256 yesterdayTemp, bool higherWon, bool wasTie, uint256 totalPot, uint256 houseFee);
```
