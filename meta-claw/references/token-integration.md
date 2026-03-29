# $MCLAW Token Integration — Meta Claw Reference

$MCLAW is the native token of the Meta Claw ecosystem, deployed on Base via Clawncher.
Holding $MCLAW unlocks higher bounty reward tiers and LP fee earnings.

> Token address TBA — follow @MetaClawBot on Twitter for launch announcement.

---

## Token Details

| Property | Value |
|----------|-------|
| Name | Meta Claw |
| Symbol | $MCLAW |
| Chain | Base (EVM, chain ID 8453) |
| Standard | ERC-20 |
| Infrastructure | Clawncher + Uniswap V4 |
| LP Fee | 1% on every swap |
| Status | TBA — awaiting launch |

---

## Read Token Info

```typescript
import { ClawnchReader } from '@clawnch/clawncher-sdk';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({ chain: base, transport: http() });
const reader = new ClawnchReader({ publicClient, network: 'mainnet' });

const MCLAW = '0x...'; // TBA at launch

const details = await reader.getTokenDetails(MCLAW);
console.log('Name:', details.name, '| Supply:', details.totalSupply);

const isVerified = await reader.isClawnchToken(MCLAW);
console.log('Verified Clawncher token:', isVerified);
```

---

## Buy $MCLAW

```typescript
import { ClawnchSwapper, NATIVE_TOKEN_ADDRESS } from '@clawnch/clawncher-sdk';
import { parseEther } from 'viem';

const swapper = new ClawnchSwapper({ wallet, publicClient });

// Check price first
const price = await swapper.getPrice({
  sellToken: NATIVE_TOKEN_ADDRESS,
    buyToken: MCLAW,
      sellAmount: parseEther('0.01'),
      });
      console.log('Expected $MCLAW:', price.buyAmount);

      // Execute swap
      const result = await swapper.swap({
        sellToken: NATIVE_TOKEN_ADDRESS,
          buyToken: MCLAW,
            sellAmount: parseEther('0.01'),
              slippageBps: 100,
              });
              console.log('Bought $MCLAW! Tx:', result.txHash);
              ```

              ---

              ## Check Balance

              ```typescript
              const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

              const mclawBal = await swapper.getBalance(MCLAW, account.address);
              const usdcBal  = await swapper.getBalance(USDC, account.address);

              console.log('$MCLAW:', mclawBal);
              console.log('USDC:', usdcBal);
              ```

              ---

              ## Claim LP Fees

              ```typescript
              import { ClawncherClaimer } from '@clawnch/clawncher-sdk';

              const claimer = new ClawncherClaimer({ wallet, publicClient, network: 'mainnet' });

              const available = await reader.getAvailableFees(account.address, MCLAW);
              console.log('Claimable fees:', available);

              await claimer.claimAll(MCLAW, account.address);
              console.log('Fees claimed!');
              ```

              ---

              ## Reward Tiers

              | Tier | $MCLAW Held | Bounty Multiplier |
              |------|-------------|:-----------------:|
              | Crab | 0+ | 1x |
              | Lobster | 100+ | 1.5x |
              | King Claw | 1,000+ | 2x |
              | Ultra Claw | Top 10 hunters | 3x |

              Example: 50 USDC bounty x 2x King Claw = 100 USDC payout

              ---

              ## MEV Protection at Launch

              - 80% starting fee at t=0
              - Decays linearly to 1% over 30 seconds
              - Prevents sandwich attacks at launch
              - After decay: normal 1% LP fee only

              ---

              ## Contract Addresses (Base Mainnet)

              | Contract | Address |
              |----------|---------|
              | $MCLAW Token | TBA |
              | Clawncher Factory | 0xE85A59c628F7d27878ACeB4bf3b35733630083a9 |
              | FeeLocker | 0xF3622742b1E446D92e45E22923Ef11C2fcD55D68 |
              | USDC Base | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |

              ---

              ## Resources

              - Meta Claw: https://metaclaw.online
              - Twitter: https://twitter.com/MetaClawBot
              - Clawncher SDK: https://www.npmjs.com/package/@clawnch/clawncher-sdk
              - Clawnchpad: https://clawn.ch/pad/
              - Clawncher Docs: https://clawn.ch/er/docs
