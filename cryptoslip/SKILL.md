---
name: cryptoslip
description: "Non-custodial Base (8453) payment slips, 1-tx Multicall3 batch payouts (1..500 links), PocketSlip bounded agent wallets, and HTTP 402 middleware via CryptoSlipVaultV32, @cryptoslip/sdk, or @cryptoslip/mcp. Use when an agent or user wants to send 1-tap USDC/cbBTC/ETH/NARA payout links over Telegram/X/SMS (revocable or irrevocable No take-back), batch-mint up to 500 payout links in one Base transaction, rotate an inbound slip via Keep (0% 1st rotation fee) for 1:1 non-commingled wallet privacy, reclaim unclaimed DM links at 0% fee, gate an HTTP 402 route straight to a watch-only Safe, or claim 0.25% lifetime on-chain referrerOf credits."
tags: [payments, base, payouts, x402, mcp, multicall3, usdc, agents]
version: 1
visibility: public
metadata:
  clawdbot:
    homepage: "https://slip.naraprotocol.io"
    requires:
      bins: [node, npx]
      packages: ["viem@^2.23.0", "@cryptoslip/sdk", "@cryptoslip/mcp"]
---

# CryptoSLIP on Base (`8453`)

CryptoSLIP (`https://slip.naraprotocol.io`, ENS `https://cryptoslip.eth.limo`, Telegram Mini App `https://t.me/cryptoslip_bot/SLIP`) is a non-custodial settlement protocol on **Base (`8453`)** for `USDC`, `cbBTC`, `ETH`, and `NARA`. Every slip is an isolated `1:1` on-chain position on `CryptoSlipVaultV32` controlled by an ephemeral `claimSigner` key carried strictly inside the `#` URL fragment (or derived from a 12-character `scrypt` code) — never inside HTTP query parameters or server databases.

## Division of Labor with Bankr

A Bankr agent can operate CryptoSLIP in two complementary ways:

1. **Direct Bankr Wallet Execution (`POST /wallet/sign` + `POST /wallet/submit` on `chainId: 8453`):** Your Bankr wallet signs offline EIP-3009 `ReceiveWithAuthorization` + `MintPermit` payloads and submits **1 `Multicall3` transaction** to mint `1..500` human bounty or contributor links, reclaims unclaimed revocable DM links via `0%`-fee `refundSlip`, and withdraws `0.25%` lifetime `referralCredits`.
   - **Bankr security settings required for signing/submitting:** A read-write `BANKR_API_KEY` with Wallet API enabled. Because `MintPermit` is custom EIP-712 typed data and `Multicall3` / `CryptoSlipVaultV32` are contract calls, switch on **Enable arbitrary contract calls** in Bankr security settings (a short timer is fine). If **permitted recipients** is active, temporarily disable it while signing `MintPermit` (custom typed data without a standard ERC-2612/EIP-3009 recipient field returns `403 RECIPIENT_NOT_PERMITTED`) and permit `0x3f80aa68Fb4834d6E119EE1cf932C14419Cf63EB` + `0xcA11bde05977b3631167028862bE2a173976CA11` for `/wallet/submit`. Native ETH on Base (`8453`) is required in the Bankr wallet when broadcasting via `/wallet/submit`.
2. **Bounded `PocketSlip` Sub-Agent Isolation (`@cryptoslip/mcp`):** Instead of handing `BANKR_API_KEY` or a raw wallet private key to an untrusted tool runner or sub-agent, mint a `$5.00 USDC` slip and pass `CRYPTOSLIP_URL="<YOUR_SLIP_URL>"` to `npx -y @cryptoslip/mcp`. On boot, `PocketSlipVault` immediately executes an on-chain `Keep` (`0%` fee), rotating `claimSigner` to a local `0600` key in `<1s` and enforcing a deterministic out-of-context `BoundedAgentPolicy` firewall (`maxPerCallUsdMicro`, sliding-window rate limits, contract destination denylist, and output secret scrubbing). Worst-case prompt-injection blast radius is strictly bounded to that single slip.

---

## Canonical Base (`8453`) Protocol Constants

| Component | Address / Value | Notes |
|---|---|---|
| **`CryptoSlipVaultV32` (`v33`)** | `0x3f80aa68Fb4834d6E119EE1cf932C14419Cf63EB` | Active production issuance vault (`ISSUE_VAULT = 'v33'`, EIP-712 `name: "Crypto Slip Protocol"`, `version: "3"`) |
| **`CryptoSlipNFTV32` (`v33`)** | `0x356a701DABDeabe61F7Fc79D730617CEcbd7B94f` | Synchronized 1-of-1 position NFT |
| **`CryptoSlipTradeRouterV32` (`v33`)** | `0x2069CA17D45d3421D28f15F20262575333CECF51` | Slip-to-slip swaps (`name: "Crypto Slip Trade Router"`, `version: "3.2"`) |
| **`Multicall3`** | `0xcA11bde05977b3631167028862bE2a173976CA11` | Atomic 1-tx batching (`aggregate3`) |
| **`USDC` (`Base 8453`)** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 decimals, `v33` minimum `0.10 USDC` (`100_000n`), EIP-3009 (`"USD Coin"`, `"2"`) |
| **`cbBTC` (`Base 8453`)** | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` | 8 decimals, `v33` minimum `100 sats` (`100n`), EIP-3009 (`"Coinbase Wrapped BTC"`, `"2"`) |
| **`ETH` (`Base 8453`)** | `0x0000000000000000000000000000000000000000` | 18 decimals, `v33` minimum `0.000001 ETH` (`10^12` wei) |
| **`NARA` (`Base 8453`)** | `0x91FB78A9F46B67f54BbD4489941d19666b2fAe0f` | 18 decimals, `v33` minimum `0.000001 NARA` (`10^12` wei), EIP-2612 (`"NARA Token"`, `"1"`) |
| **`NARALiquidityHookV5`** | `0x07d8F2Dfd121B10dE3176DeAb6A8C0eaa2646aCC` | Mandatory Uniswap V4 Hook for 100% of `NARA` swap legs |
| **Circle `TokenPaymasterV08`** | `0x0578cFB241215b77442a541325d6A4E6dFE700Ec` | Self-funded `USDC` network fee settlement (`EntryPoint v0.8`) |
| **Base Builder Code (`ERC-8021`)** | `bc_ea68lz8s` | Appended as Schema 0 calldata suffix (`0x62635f656136386c7a38730b0080218021802180218021802180218021`) |

### Fee Schedule, Finality Modes & Referral Economics

- **Protocol Fees (`FEE_BPS = 50n`):**
  - `0%` on slip creation (`mintSlip*`)
  - `0%` on 1st `Keep in Slips` (`acceptWithPermit` / `keepSlip` when `nonces(slipId) == 0`)
  - `0%` on direct creator reclaim (`refundSlip`)
  - `0.50%` ceiling-rounded (`(gross * 50n + 9999n) / 10000n`) on external wallet claim, `splitAndPayWithPermit`, combine, or 2nd+ re-transfer. Use `grossUpForExactNet(targetNet)` (`@cryptoslip/sdk/constants`) when recipients must net an exact integer amount on external wallet exit.
- **Two `cancelLockedUntil` Finality Modes (Solidity Law #3 — strictly `0` or `9_999_999_999`):**
  - **`No take-back` (`9_999_999_999`):** Irrevocable on-chain from block inclusion; the creator can never call `refundSlip`. Use for verified human task completions, tournament prizes, and merchant settlements.
  - **Revocable DM Link (`0`):** Slips never have an on-chain end date, so recipients never lose funds to a countdown timer. If a DM recipient never opens the link (`nonces(slipId) == 0`), the creator can reclaim `100%` of principal at `0%` fee via `refundSlip(slipId)` (for example, on a scheduled 7-day sweep).
- **`0.25%` Lifetime On-Chain `referrerOf` Revenue Share (`50/50` Split):**
  - When your Bankr or partner wallet mints payout slips with `creator = yourWallet`, any unreferred recipient (`referrerOf[recipient] == address(0)`) who claims a qualifying slip (`>= 0.10 USDC`, `100 sats` `cbBTC`, `0.000001 ETH` / `NARA`) permanently binds `referrerOf[recipient] = yourWallet` on Base. Half of the `0.50%` settlement fee (**`0.25%` of that user's lifetime settlement volume** across `USDC`, `cbBTC`, `ETH`, and `NARA`) accrues directly to `referralCredits[yourWallet][asset]`.

---

## 1. Zero-Install Direct Base (`8453`) `Multicall3` Batch Payouts (`viem` + Bankr Wallet API)

To mint `1..500` `USDC` (or `cbBTC`) payout links in **one Base transaction** with **zero `ERC20.approve`**, sign an offline EIP-3009 `ReceiveWithAuthorization` + EIP-712 `MintPermit` (`relayer = address(0)`) per item and pack `mintSlipERC20WithAuthorization` calls into `Multicall3.aggregate3`. Using `mintSlipERC20WithAuthorization` inside `Multicall3` preserves `slip.creator = bankrWallet` (unlike `mintSlipERC20`, where `msg.sender` would be `Multicall3`), keeping both `0%` `refundSlip` rights and `0.25%` `referrerOf` attribution intact.

```ts
import { randomBytes } from 'node:crypto';
import {
  bytesToHex,
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const VAULT_V33 = '0x3f80aa68Fb4834d6E119EE1cf932C14419Cf63EB' as const;
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as const;
const NO_TAKE_BACK = 9_999_999_999n; // Or 0n for revocable DM links
const ERC8021_SUFFIX = '62635f656136386c7a38730b0080218021802180218021802180218021'; // bc_ea68lz8s

const VAULT_ABI = parseAbi([
  'struct MintPermit { address creator; address token; uint256 amount; address claimSigner; address referrer; uint48 cancelLockedUntil; bytes32 nonce; uint256 validAfter; uint256 validBefore; address relayer; }',
  'function mintSlipERC20WithAuthorization(MintPermit p, bytes mintSignature, bytes receiveSignature) external returns (uint256 slipId)',
  'event SlipMinted(uint256 indexed slipId, address indexed creator, address indexed asset, uint256 amount, address claimSigner, uint48 lockedUntil)',
]);

const MULTICALL3_ABI = parseAbi([
  'struct Call3 { address target; bool allowFailure; bytes callData; }',
  'struct Result { bool success; bytes returnData; }',
  'function aggregate3(Call3[] calls) payable returns (Result[] returnData)',
]);

async function bankrSignTypedData(apiKey: string, typedData: Record<string, unknown>): Promise<Hex> {
  const res = await fetch('https://api.bankr.bot/wallet/sign', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ signatureType: 'eth_signTypedData_v4', typedData }),
  });
  const json = (await res.json()) as { success: boolean; signature?: Hex; error?: string };
  if (!res.ok || !json.success || !json.signature) {
    throw new Error(`Bankr /wallet/sign failed (${res.status}): ${json.error ?? 'unknown'}`);
  }
  return json.signature;
}

export async function mintBatchSlipsViaBankr(params: {
  bankrApiKey: string;
  creatorAddress: Address;
  amountsUsdcUnits: bigint[]; // e.g. [5_000_000n, 10_000_000n] ($5, $10 USDC)
  noTakeBack: boolean;
}) {
  const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
  const headBlock = await publicClient.getBlock();
  const validBefore = headBlock.timestamp + 3600n; // Anchor to Base block timestamp, validAfter MUST be 0n
  const lockUntil = params.noTakeBack ? NO_TAKE_BACK : 0n;

  const prepared: Array<{ claimKeyHex: Hex; amountUsdc: number; callData: Hex }> = [];

  for (const amount of params.amountsUsdcUnits) {
    if (amount < 100_000n) throw new Error('Below v33 minimum (0.10 USDC = 100_000n)');
    const claimKeyHex = bytesToHex(randomBytes(32));
    const claimAccount = privateKeyToAccount(claimKeyHex);
    const nonce = bytesToHex(randomBytes(32));

    // 1. Sign EIP-3009 ReceiveWithAuthorization (USDC -> CryptoSlipVaultV32)
    const receiveSignature = await bankrSignTypedData(params.bankrApiKey, {
      domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: USDC_BASE },
      primaryType: 'ReceiveWithAuthorization',
      types: {
        ReceiveWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      message: {
        from: params.creatorAddress,
        to: VAULT_V33,
        value: amount.toString(),
        validAfter: '0',
        validBefore: validBefore.toString(),
        nonce,
      },
    });

    // 2. Sign CryptoSlipVaultV32 MintPermit (open relayer = address(0))
    const mintSignature = await bankrSignTypedData(params.bankrApiKey, {
      domain: { name: 'Crypto Slip Protocol', version: '3', chainId: 8453, verifyingContract: VAULT_V33 },
      primaryType: 'MintPermit',
      types: {
        MintPermit: [
          { name: 'creator', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'claimSigner', type: 'address' },
          { name: 'referrer', type: 'address' },
          { name: 'cancelLockedUntil', type: 'uint48' },
          { name: 'nonce', type: 'bytes32' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'relayer', type: 'address' },
        ],
      },
      message: {
        creator: params.creatorAddress,
        token: USDC_BASE,
        amount: amount.toString(),
        claimSigner: claimAccount.address,
        referrer: ZERO_ADDR,
        cancelLockedUntil: Number(lockUntil),
        nonce,
        validAfter: '0',
        validBefore: validBefore.toString(),
        relayer: ZERO_ADDR,
      },
    });

    const callData = encodeFunctionData({
      abi: VAULT_ABI,
      functionName: 'mintSlipERC20WithAuthorization',
      args: [
        {
          creator: params.creatorAddress,
          token: USDC_BASE,
          amount,
          claimSigner: claimAccount.address,
          referrer: ZERO_ADDR,
          cancelLockedUntil: Number(lockUntil),
          nonce,
          validAfter: 0n,
          validBefore,
          relayer: ZERO_ADDR,
        },
        mintSignature,
        receiveSignature,
      ],
    });

    prepared.push({ claimKeyHex, amountUsdc: Number(amount) / 1e6, callData });
  }

  // 3. Pack all mints into 1 Multicall3 transaction with ERC-8021 Base Builder Code bc_ea68lz8s
  const multicallData = encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    args: [prepared.map((item) => ({ target: VAULT_V33, allowFailure: false, callData: item.callData }))],
  });
  const attributedData = `${multicallData}${ERC8021_SUFFIX}` as Hex;

  const submitRes = await fetch('https://api.bankr.bot/wallet/submit', {
    method: 'POST',
    headers: { 'X-API-Key': params.bankrApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transaction: { to: MULTICALL3, chainId: 8453, value: '0', data: attributedData },
      description: `Mint ${prepared.length} CryptoSLIP payout links on Base`,
      waitForConfirmation: true,
    }),
  });
  const submitJson = (await submitRes.json()) as { success: boolean; transactionHash?: Hex; error?: string };
  if (!submitRes.ok || !submitJson.success || !submitJson.transactionHash) {
    throw new Error(`Bankr /wallet/submit failed (${submitRes.status}): ${submitJson.error ?? 'unknown'}`);
  }

  // 4. Verify on-chain receipt & construct # fragment links (claim keys NEVER enter query strings)
  const receipt = await publicClient.waitForTransactionReceipt({ hash: submitJson.transactionHash });
  const mintedIds: bigint[] = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== VAULT_V33.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: VAULT_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName === 'SlipMinted') mintedIds.push(decoded.args.slipId);
    } catch {
      // Non-SlipMinted log
    }
  }

  return prepared.map((item, idx) => {
    const slipId = mintedIds[idx]!;
    const amtToken =
      item.amountUsdc % 1 === 0 ? item.amountUsdc.toFixed(0) : item.amountUsdc.toFixed(2).replace('.', '-');
    const lockSegment = params.noTakeBack ? '_cl9999999999' : '';
    const keyNoPrefix = item.claimKeyHex.slice(2);
    return {
      slipId: slipId.toString(),
      txHash: submitJson.transactionHash,
      url: `https://slip.naraprotocol.io/#startapp=slip_${slipId}_${amtToken}_open_v33${lockSegment}_k${keyNoPrefix}`,
    };
  });
}
```

---

## 2. Official `@cryptoslip/sdk` & `@cryptoslip/mcp` (`PocketSlip`) Usage

For TypeScript backends, Hono APIs, or MCP-compatible agents, install `@cryptoslip/sdk` or run `@cryptoslip/mcp`:

```bash
npm install @cryptoslip/sdk viem
```

### One-Call `1..500` Batch Payouts (`@cryptoslip/sdk/batch`)

```ts
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { executeBatchPayoutSlips } from '@cryptoslip/sdk/batch';

const signer = privateKeyToAccount(process.env.PAYOUT_SIGNER_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
const walletClient = createWalletClient({ account: signer, chain: base, transport: http('https://mainnet.base.org') });

const batch = await executeBatchPayoutSlips({
  publicClient,
  walletClient,
  signer,
  items: [
    { amount: 5_000_000n, asset: 'USDC', noTakeBack: true, grossUpForExitFee: true, note: 'Bounty #1' },
    { amount: 10_000_000n, asset: 'USDC', noTakeBack: false, note: 'DM Review Invite' },
  ],
});
// Deliver batch.mintedSlips[i].url strictly over private DM
```

### Bounded `PocketSlip` MCP Server (`@cryptoslip/mcp`)

```json
{
  "mcpServers": {
    "cryptoslip": {
      "command": "npx",
      "args": ["-y", "@cryptoslip/mcp"],
      "env": {
        "CRYPTOSLIP_URL": "<YOUR_SLIP_URL>",
        "CRYPTOSLIP_MAX_PER_CALL_USD": "0.50",
        "CRYPTOSLIP_MAX_DAILY_USD": "5.00",
        "CRYPTOSLIP_MAX_SPENDS_PER_MIN": "3"
      }
    }
  }
}
```

Exposes 7 policy-guarded stdio tools: `cryptoslip_status`, `cryptoslip_pay_human`, `cryptoslip_batch_payout`, `cryptoslip_pay_x402_or_merchant`, `cryptoslip_verify_or_export_receipt`, `cryptoslip_reclaim_unclaimed`, and `cryptoslip_withdraw_referrals`.

### Zero-Key HTTP `402` Middleware (`@cryptoslip/sdk/middleware`)

Gate paid inference or data endpoints straight into a watch-only merchant Safe with concurrent `slipId` replay protection and `X-Payment-Refund-Slip` overcharge refund headers:

```ts
import { Hono } from 'hono';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { withCryptoSlip } from '@cryptoslip/sdk/middleware';

const app = new Hono();
const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });

app.post(
  '/v1/task',
  withCryptoSlip({
    publicClient,
    merchantAddress: '0xe320C281c86079eA85f2Bc67864E873A61D551E3', // Watch-only Safe
    asset: 'USDC',
    minNetAmount: 250_000n, // 0.25 USDC net minimum
    requireNoTakeBack: true,
    merchantLabel: 'Agent Task API',
  }),
  (c) => c.json({ ok: true, txHash: c.get('cryptoSlip').receipt.txHash }),
);
```

---

## 3. `0%` 1st `Keep in Slips` (`1:1` Non-Commingled Wallet Privacy)

When an agent or human receives an open `#` payout link, calling `keepSlip` (`acceptWithPermit` on `CryptoSlipVaultV32` while `nonces(slipId) == 0`) rotates `claimSigner` on-chain to a fresh local key at **`0%` protocol fee**:

- The original `#` link shared in chat is immediately invalidated on-chain (`nonces(slipId)` increments from `0` to `1`).
- Funds remain in an isolated `1:1` non-commingled vault slip rather than landing on a public trading wallet, preventing copy-trading and wallet-graph clustering when later paying merchants via `splitAndPay`.

```ts
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { parseSlipUrl } from '@cryptoslip/sdk/link';
import { keepSlip, splitAndPay } from '@cryptoslip/sdk/operations';
import { RelayGatewayClient } from '@cryptoslip/sdk/paymaster';

const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
const relayClient = new RelayGatewayClient();

const parsed = parseSlipUrl('<YOUR_SLIP_URL>');
if (!parsed?.claimKey) throw new Error('Expected open slip URL');

// 1. Rotate claimSigner on-chain at 0% fee (invalidates original link)
const kept = await keepSlip({
  publicClient,
  relayClient,
  slipId: parsed.id,
  vault: parsed.vault,
  claimSigner: parsed.claimKey,
});

// 2. Spend 2.50 USDC to a merchant; remaining change stays in a new rotated 1:1 child slip
// Pre-check: remainder must be 0n or >= minSlipAmount (0.10 USDC on v33) to avoid DustCliffError
const settled = await splitAndPay({
  publicClient,
  relayClient,
  slipId: kept.slipId,
  vault: kept.vault,
  claimSigner: kept.newClaimPrivateKey,
  paymentAmount: 2_500_000n,
  merchant: '0x1111111111111111111111111111111111111199',
});
```

---

## 4. 7-Day `0%`-Fee `refundSlip` Reclaim & `0.25%` `referrerOf` Withdrawal

For revocable DM payouts (`cancelLockedUntil == 0`), run a periodic 7-day sweep on Base (`8453`) to reclaim unclaimed slips at `0%` fee, and withdraw accumulated `0.25%` lifetime `referralCredits`:

```ts
import { createPublicClient, encodeFunctionData, http, parseAbi, type Address, type Hex } from 'viem';
import { base } from 'viem/chains';

const VAULT_V33 = '0x3f80aa68Fb4834d6E119EE1cf932C14419Cf63EB' as const;
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

const SWEEP_ABI = parseAbi([
  'function isRefundable(uint256 slipId) view returns (bool)',
  'function nonces(uint256 slipId) view returns (uint256)',
  'function refundSlip(uint256 slipId) external',
  'function referralCredits(address referrer, address asset) view returns (uint256)',
  'function referrerOf(address user) view returns (address)',
  'function withdrawReferralCredits(address asset, address to) external',
]);

export async function buildReclaimAndReferralCalls(params: {
  candidateSlipIds: bigint[];
  referrerWallet: Address;
}) {
  const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
  const txPayloads: Array<{ to: Address; chainId: 8453; value: '0'; data: Hex; description: string }> = [];

  // 1. Check unclaimed revocable DM links (isRefundable && nonces == 0 -> 0% fee full reclaim)
  for (const slipId of params.candidateSlipIds) {
    const [refundable, nonce] = await Promise.all([
      publicClient.readContract({ address: VAULT_V33, abi: SWEEP_ABI, functionName: 'isRefundable', args: [slipId] }),
      publicClient.readContract({ address: VAULT_V33, abi: SWEEP_ABI, functionName: 'nonces', args: [slipId] }),
    ]);
    if (refundable && nonce === 0n) {
      txPayloads.push({
        to: VAULT_V33,
        chainId: 8453,
        value: '0',
        data: encodeFunctionData({ abi: SWEEP_ABI, functionName: 'refundSlip', args: [slipId] }),
        description: `Reclaim unclaimed CryptoSLIP #${slipId.toString()} (0% fee)`,
      });
    }
  }

  // 2. Check accrued 0.25% lifetime referral credits in USDC
  const pendingUsdc = await publicClient.readContract({
    address: VAULT_V33,
    abi: SWEEP_ABI,
    functionName: 'referralCredits',
    args: [params.referrerWallet, USDC_BASE],
  });
  if (pendingUsdc > 0n) {
    txPayloads.push({
      to: VAULT_V33,
      chainId: 8453,
      value: '0',
      data: encodeFunctionData({
        abi: SWEEP_ABI,
        functionName: 'withdrawReferralCredits',
        args: [USDC_BASE, params.referrerWallet],
      }),
      description: `Withdraw ${Number(pendingUsdc) / 1e6} USDC CryptoSLIP referral credits`,
    });
  }

  // Submit each payload via POST https://api.bankr.bot/wallet/submit or Multicall3
  return txPayloads;
}
```

---

## Safety & Verification Rules (`Do NOT`)

- **Never put `_k<64hex>`, `&vk=`, `&seal=`, or `&code=` in HTTP query parameters, `t.me` URLs, logs, or public posts.** Claim keys travel strictly inside `#` URL fragments over private DMs (`https://slip.naraprotocol.io/#startapp=slip_...` or `https://cryptoslip.eth.limo/#startapp=slip_...`), or as two-part 12-character `scrypt` codes.
- **Never set `cancelLockedUntil` to anything other than `0` or `9_999_999_999`.** Any intermediate timestamp fails Solidity Law #3 (`CancelLockTooLong` / `InvalidCancelLock`).
- **Never set `validAfter` > `0` on `MintPermit` / EIP-3009 authorizations.** Always anchor `validBefore` to Base `getBlock().timestamp` and keep `validAfter = 0n`.
- **Never split a slip leaving non-zero change below `v33` minimums** (`0.10 USDC` / `100_000n`, `100 sats` `cbBTC` / `100n`, `0.000001 ETH` or `NARA` / `10^12` wei). Spend the full slip or adjust `paymentAmount` so remainder >= `minSlipAmount`.
- **Never route `NARA` swaps through secondary pools or third-party aggregators.** Every `NARA` swap leg must route exclusively through Uniswap V4 `NARALiquidityHookV5` (`0x07d8F2Dfd121B10dE3176DeAb6A8C0eaa2646aCC`).
- **Never claim an unclaimed link is settled, and never bypass Bankr security refusals.** Confirm `TransactionReceipt.status === 'success'` on Base (`8453`) before reporting settlement; if `/wallet/sign` or `/wallet/submit` returns `403` (`MFA_REQUIRED`, `RECIPIENT_NOT_PERMITTED`, or arbitrary contract calls disabled), surface the exact setting to the user and stop.
