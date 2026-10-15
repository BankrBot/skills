---
name: chipx
description: Mint and redeem CHIPX at NAV directly against the Chip Index contracts on Base using USDC or ETH, and check NAV, supply, and basket composition.
tags: [trading, defi, index, base, tokenized-stocks]
---

# CHIPX — Chip Index

Mint and redeem CHIPX at NAV directly via the IndexRouter on Base using USDC or ETH.

## Contracts (Base)

- IndexVault (CHIPX token): 0x8d6bbB52171499bC9e01954B8F9A74697848E9a2
- IndexRouter: 0xffAA57A3bAcf1C2E672c36eAf0dD778bf9267903
- BasketRegistry: 0x653B2cC8eC8E576B0C2bFc30D100A4A6f3CC004e
- USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- WETH: 0x4200000000000000000000000000000000000006

## Rules and Constraints

1. Direct router execution: Always interact directly with IndexRouter (0xffAA57A3bAcf1C2E672c36eAf0dD778bf9267903). Never route through secondary liquidity pools. Minting and redeeming at NAV is the product.
2. Market-hours and Feed Freshness:
   Call router.band(false) on Base.
   If band.fresh is true: feeds are live and within market hours.
   If band.fresh is false: US equity markets are closed (weekend, night, or holiday). The skill MUST explicitly tell the user: "US markets closed — transaction uses last closing prices with your limit protection."
3. Slippage Discipline:
   - Mint with USDC: maxUsdcIn must be calculated as NAV + 100 bps + 15 bps buffer = NAV * 1.0115 (115 bps ceiling). Unspent USDC is automatically refunded by the router contract.
   - Mint with ETH: calculate required ETH from NAV / ETH price, apply the 115 bps buffer to msg.value. Unspent ETH is automatically refunded.
   - Redeem to USDC: minUsdcOut must enforce a strict 1% floor (NAV * 0.99, 100 bps discount), NEVER 0.
   - Redeem to ETH: minEthOut must enforce a strict 1% floor (NAV in ETH * 0.99), NEVER 0.
4. Response Format:
   Every successful mint or redeem execution response MUST include:
   - Action summary with exact CHIPX shares and spent/received amounts
   - Basescan transaction link: https://basescan.org/tx/{txHash}
   - Current CHIPX wallet balance after the transaction
   - Market hours / stale feed notice if band.fresh is false

## Workflows

### 1. CHIPX Info
Trigger: "chipx info", "chipx price", "chipx nav", "chipx basket"

Steps:
1. Batch read on Base:
   - IndexVault (0x8d6bbB52171499bC9e01954B8F9A74697848E9a2):
     navPerShare() view returns (uint256)
     navUsd() view returns (uint256)
     totalSupply() view returns (uint256)
   - IndexRouter (0xffAA57A3bAcf1C2E672c36eAf0dD778bf9267903):
     band(bool) view returns ((uint16 bps, uint256 stockAge, uint256 ethAge, bool fresh) b) with arg [false]
   - BasketRegistry (0x653B2cC8eC8E576B0C2bFc30D100A4A6f3CC004e):
     assets() view returns ((address token, address feed, uint16 weightBps, uint8 tokenDecimals, uint8 feedDecimals)[])
2. Format NAV per share (18 decimals to USD), total NAV USD, total CHIPX supply, feed freshness status, and basket components with their percentage weights.

### 2. Mint with USDC
Trigger: "mint $X of CHIPX", "mint X CHIPX with USDC"

Steps:
1. Check market freshness via IndexRouter.band(false).
2. Fetch current navPerShare() from IndexVault.
3. Calculate target shares (18 decimals):
   - If user specified USD amount ($X): shares = (X * 1e18) / (navPerShare / 1e18)
   - If user specified shares (N CHIPX): shares = N * 1e18
4. Calculate gross NAV cost in USDC (6 decimals): grossUsdc = (shares * navPerShare) / 1e30
5. Calculate maxUsdcIn with 115 bps buffer: maxUsdcIn = (grossUsdc * 10115) / 10000
6. Check user's USDC balance. If insufficient, inform user.
7. Check user's USDC allowance to IndexRouter (0xffAA57A3bAcf1C2E672c36eAf0dD778bf9267903). If allowance < maxUsdcIn, submit approve(0xffAA57A3bAcf1C2E672c36eAf0dD778bf9267903, maxUsdcIn) on USDC contract (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).
8. Call mintWithUsdc on IndexRouter:
   Function: mintWithUsdc(uint256 shares, uint256 maxUsdcIn, address to, uint256 deadline)
   Args: [shares, maxUsdcIn, userWallet, block.timestamp + 1200]
9. Check final CHIPX balance of user wallet via IndexVault.balanceOf(userWallet).
10. Reply with mint details, Basescan link, post-mint CHIPX balance, and stale market disclaimer if applicable.

### 3. Mint with ETH
Trigger: "mint $X of CHIPX with ETH", "mint X CHIPX with ETH"

Steps:
1. Check market freshness via IndexRouter.band(true).
2. Fetch navPerShare() and eth price (via router.ethUsdFeed or turn asset price).
3. Compute target shares and expected ETH cost.
4. Add 115 bps buffer to msg.value: ethToSend = expectedEth * 10115 / 10000.
5. Call mintWithEth on IndexRouter:
   Function: mintWithEth(uint256 shares, address to, uint256 deadline)
   Value: ethToSend
   Args: [shares, userWallet, block.timestamp + 1200]
6. Check final CHIPX balance and reply with tx link, balance, and feed freshness note if applicable.

### 4. Redeem to USDC
Trigger: "redeem X CHIPX to USDC", "redeem all CHIPX to USDC"

Steps:
1. Check market freshness via IndexRouter.band(false).
2. Fetch navPerShare() from IndexVault.
3. Determine shares to redeem (18 decimals).
4. Compute gross value in USDC: grossUsdc = (shares * navPerShare) / 1e30.
5. Compute minUsdcOut with strict 100 bps floor (1% max slippage):
   minUsdcOut = (grossUsdc * 9900) / 10000. NEVER zero.
6. Check user's CHIPX allowance to IndexRouter (0xffAA57A3bAcf1C2E672c36eAf0dD778bf9267903). If allowance < shares, submit approve(0xffAA57A3bAcf1C2E672c36eAf0dD778bf9267903, shares) on IndexVault (0x8d6bbB52171499bC9e01954B8F9A74697848E9a2).
7. Call redeemToUsdc on IndexRouter:
   Function: redeemToUsdc(uint256 shares, uint256 minUsdcOut, address to, uint256 deadline)
   Args: [shares, minUsdcOut, userWallet, block.timestamp + 1200]
8. Check final CHIPX balance.
9. Reply with redemption details, received USDC, Basescan tx link, remaining CHIPX balance, and stale market note if applicable.

### 5. Redeem to ETH
Trigger: "redeem X CHIPX to ETH"

Steps:
1. Check market freshness via IndexRouter.band(true).
2. Compute gross value in ETH from navPerShare() and eth price.
3. Compute minEthOut with strict 100 bps floor (NAV in ETH * 0.99). NEVER zero.
4. Ensure CHIPX allowance to router is sufficient.
5. Call redeemToEth on IndexRouter:
   Function: redeemToEth(uint256 shares, uint256 minEthOut, address to, uint256 deadline)
   Args: [shares, minEthOut, userWallet, block.timestamp + 1200]
6. Check remaining CHIPX balance and reply with tx link and final balances.
