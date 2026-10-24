# Common reverts

The CLI decodes reverts with the ABIs plus `scripts/lib/errors.json`, which maps the selector of every custom error in the Flash contract sources (256 entries). V4 Quoter failures arrive wrapped as `UnexpectedRevertBytes(bytes)`, and hook failures inside a swap as `WrappedError(target, selector, reason, details)`. The CLI unwraps both.

| Error | Where | Meaning, and what to do |
| --- | --- | --- |
| `GasFloor()` / `SwapGasFloor()` | Any hook swap | The gas limit is below the hook's `gasleft()` floor. Use the plan's gas or `eth_estimateGas x 1.1`. |
| `V4TooLittleReceived` / `V4TooMuchRequested` | Universal Router | The price moved past the slippage limit. Re-quote. |
| `TransactionDeadlinePassed()` | Universal Router | The plan expired. Rebuild it. |
| `AllowanceExpired` / `InsufficientAllowance` | Permit2 | Re-run: the plan adds the Permit2 approval. |
| `NotEnoughLiquidity(poolId)` (`0x7a5ed734`) | Quoter | The pool cannot fill the whole size. Lower the amount. (The hooks never refuse by size; this is pool depth.) |
| `NestedSwap()` | RC hook | Swaps cannot nest. Send one swap per transaction. |
| `AlreadyBound()` / `SelfReferral()` / `InvalidCode()` | Referral bind | Already referred (permanent) / your own code / unknown code |
| `InvalidSignature()` / `SignatureExpired()` / `NotDeployed()` / `ForbiddenFactory()` | `bindWithSig` or in-swap bind | Bad or expired EIP-712 signature (include `EIP712Domain` in `types`) / undeployed smart wallet (bind with an EOA tx, or deploy first) / wallet factory not allowed |
| `NotExpired()` | `koth.settle()` | The round is still running. |
| `InvalidMarket()` | churn `claim` / `claimLevels` | Nothing to claim (the CLI checks the preview first). |
| `ZeroShares()` | churn withdraw | The share amount rounds to zero. |
| `NotOperator()` | `openLattice` | Only operators, openers, the churn owner, or the market creator / treasury can open Lattices. Use `depositLevels`. |
| `NotPositionOwner()` / `NoLattice()` | Lattice manage | Not the Lattice owner / no such Lattice |
| `WrongPhase()` | Curve / war | The action does not fit the current phase (e.g. claim before LAUNCHED, open while a war is TRADING). |
| `InsufficientGasForGraduation()` | Curve / war buy | A locking buy needs at least 9M gas left. Use `eth_estimateGas`. |
| `SlippageExceeded()` | Curve | Tokens out below `minTokens`, or FLASH out below `minFlashOut`. Re-quote. |
| `InsufficientPosition()` / `NothingToClaim()` | Curve | Selling more than you hold / nothing to claim |
| `AlreadyEntered()` | Token War | One candidate per wallet per war |
| `InvalidCandidate()` | Token War | Wrong candidate id, or the war is not trading. |
| `BelowGoal(requiredUsd18, realisedUsd18)` | `launchpad.finalize` | Graduation waits for ETH depth on the FLASH/ETH pool. |
| `PermanentOwnerStake()` | Revenue Share | The protocol owner's locked stake. Never hit by users. |
| `ExitBelowMinimum` / `BuyBelowMinimum` / `UnknownToken` / `BadV5Market` | Perps migrator | One migration leg missed its minimum, or the token has no route |
| `Slippage(got, min)` | `issuer.unwind` | USDC out below the minimum |
| `BelowMinimum(valueUsdc, minUsdc)` | Perps `place` / `placePair` / `update` | `qty x triggerNav` is under `minOrderUsdc()` ($10 today). |
| `InvalidParam()` | Perps orders | Zero qty or trigger, an expiry in the past, `slNav >= tpNav` in a pair, or a stop-loss `minOut` above `qty x stop`. |
| `NotOrderOwner()` / `NotOpen()` | Perps `update` / `cancel` | Not your order / already filled or cancelled |
| `Paused()` | Perps orders | Listing is paused. `cancel` always works. |

API errors (HTTP JSON `error`) on the token-profile step (`POST /v1/launch-v2/prepare`):

| Code | HTTP | Meaning |
| --- | --- | --- |
| `TOKEN_IMAGE_REQUIRED` | 400 | No `imageUrl`. Upload the art with `POST /v1/uploads` first. |
| `TOKEN_PROFILE_SIGNATURE_REQUIRED` | 401 | No (or malformed) `profileAuth { nonce, issuedAt, signature }`. |
| `TOKEN_PROFILE_SIGNATURE_EXPIRED` | 401 | `issuedAt` older than 10 minutes (or > 2 min in the future). Sign again. |
| `TOKEN_PROFILE_SIGNATURE_INVALID` | 401 | The signature does not match the `x-flash-uploader` wallet and these exact fields. |
| `TOKEN_PROFILE_SIGNATURE_REPLAYED` | 409 | Nonce reused, or an older signature than the stored profile. Sign again with a new nonce. |
| `TOKEN_CONTENT_REJECTED` | 422 | Name, ticker or description failed moderation. |
