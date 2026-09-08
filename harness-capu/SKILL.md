---
name: harness-capu
description: Fund OpenCAP inference from Capminal with staked CAPU on Base. Buy or mint CAPU, stake it for daily inference credit, create a wallet-owned OpenCAP API key through Ethereum sign-in, check quota, and recover or rotate the key. Use when the user wants CAPU-funded AI compute or OpenCAP key setup; Capminal trading-wallet credentials and Harness account management are separate workflows.
metadata:
  clawdbot:
    emoji: "⚡"
    homepage: https://www.capminal.ai/gateway
  capu:
    api_base: https://gw.capminal.ai/api/inference/v1
    account_base: https://gw.capminal.ai/api/account
    capu_token: "0x67558d3D990EA40b64fD37FBd5c4860d1f9B3a9F"
    cap_token: "0xbfa733702305280F066D470afDFA784fA70e2649"
    scap_staking_contract: "0x92ee42A61CF55642949B4fE74bB4796978ddB47a"
    chain: base
    chain_id: 8453
---

# Capu / OpenCAP inference

Stake CAPU to fund OpenCAP inference, then create a key for the wallet that
owns the stake. The documented allocation is **$1 of inference per staked
CAPU per day**, renewed at **00:00 UTC**, with **no rollover**. Unstaked CAPU
does not earn credit. This is inference capacity, not withdrawable dollars.

Buying CAPU directly and staking it is the short setup path. CAP → sCAP →
CAPU minting is optional; do not add a CAP purchase or sCAP stake just to
create a key. No sCAP key-creation prerequisite is stated in OpenCAP's docs.

Read [references/opencap-api.md](references/opencap-api.md) when signing in,
creating or managing keys, or reading quota. It contains the exact dashboard
request shapes and their verification status. For minting from CAP or exiting
back to CAP, read [references/contracts.md](references/contracts.md).

## Wallet and credential ownership

- The signing wallet, staking wallet, and intended OpenCAP account must
  match. An agent wallet creates its own wallet-linked account; it does not
  fund the human's other wallet or personal account.
- `OPENCAP_API_KEY` is the inference key. `OPENCAP_ACCOUNT_TOKEN` is a local
  secret-store name for the wallet sign-in session used to manage keys and
  quota. Give apps the inference key only.
- **`CAP_API_KEY` is different:** it controls Capminal's Agentic Wallet. Do
  not request it or substitute it for an OpenCAP credential.
- Use the host's existing EVM wallet signer and transaction tools (for
  example, Bankr's wallet signing and transaction capabilities). Do not export
  the wallet private key to authenticate.
- Send OpenCAP credentials only to `https://gw.capminal.ai`, with no
  cross-host redirects. The sign-in domain is `www.capminal.ai`; the API host
  is different by design. Never send these keys to Venice or upstream model
  providers.

## A. Preflight

1. Identify the wallet that should own the compute. If the user has not
   selected another wallet, use the current agent wallet and state that
   ownership. If they want their own browser wallet, use Flow F.
2. Establish wallet sign-in using the nonce and SIWE flow in the API
   reference. Check that `walletAddress` in the response matches the intended
   address. Do this before buying or staking for a new setup. If signing is
   unavailable, use Flow F; if the service fails, resolve authentication
   before committing funds for the setup.
3. Read Base ETH, the intended payment-token balance, and CAPU's
   `balanceOf(address)`, `stakedOf(address)`, `cooldownOf(address)`,
   `decimals()`, `cooldownDuration()`, and `paused()`. Read account quota and
   existing key metadata when authenticated. Reuse existing funding and a
   usable stored inference key when that satisfies the request.
4. Verify the deployed CAPU proxy's current implementation and ABI using
   Base explorer/RPC data. CAPU staking is on the CAPU token contract itself.
   Its source uses `stake(uint256)` with an internal token transfer: **no
   CAPU approval is needed**. Do not assume a source repository's latest
   revision is the deployed implementation.

## B. Setup — acquire, stake, create the key

1. **Acquire only what is needed.** For a purchase, obtain a fresh Base swap
   quote for the pinned CAPU address and stay within the user's authorized
   budget and slippage. State the input amount, expected CAPU, minimum output,
   and gas cost; obtain any missing amount or limits before execution. A
   dollar purchase budget is not a daily compute amount: allocation depends
   on the actual number of CAPU received. Skip buying when the wallet already
   has sufficient CAPU. If the user chooses CAP minting, use the contract
   reference instead.
2. **Stake CAPU.** Call `stake(amount)` on
   `0x67558d3D990EA40b64fD37FBd5c4860d1f9B3a9F` from the owning wallet, using
   integer base units derived from `decimals()`. Send zero native value.
   Never replace this call with a raw token `transfer` to the contract: that
   would not record the user's stake. Wait for a successful receipt and
   confirm the change in `stakedOf(wallet)`.
3. **Create an inference key.** With the account token from Flow A, call
   `POST /api/account/keys` on the gateway. Name it for the app or agent, and
   include the user's requested `dailyBudgetUSD` and `expiresAt` if supplied.
   Do not use Venice's `generate_web3_key`, `apiKeyType`, `consumptionLimit`,
   or `limitPeriod` fields. The returned full secret is **`key`**, not
   `apiKey`. Capture the response without printing it to tool logs.
4. **Save and hand off.** Store the key as `OPENCAP_API_KEY` in the host's
   approved secret store before reporting success. Record its key ID from
   returned metadata or the key list, account ID, wallet address, and limits
   separately. Show the full inference key once only if the user needs to
   copy it and the surface is a private 1:1 conversation. On a public or
   shared surface, save without revealing and direct the user to secure
   configuration or a private handoff. Never reveal the account token.
   Thereafter show at most the inference key's last four characters.
5. **Verify readiness.** Read gateway quota and make an authenticated
   `GET /api/inference/v1/models` request with the inference key. A key that
   authenticates does not by itself prove that staking credit is available.
   If the gateway has not indexed the stake yet, report the confirmed onchain
   stake and the pending quota separately; do not buy or stake again to fix
   indexer lag. Retry quota a few times with bounded backoff, then report the
   pending state. For an authorized inference smoke test, use a current model
   ID and a small output limit; it consumes credit.
6. Report wallet ownership, actual CAPU staked, observed daily quota and
   remaining credit, reset time, key storage/handoff status, per-key limits,
   and the client base URL `https://gw.capminal.ai/api/inference/v1`.

An ambiguous transaction or key-creation timeout is not a failure receipt.
Inspect the transaction or key list before retrying. If a key was created
but its one-time secret was lost, revoke that identified key before creating
a replacement; do not accumulate unknown active keys.

## C. Check balance / allowance

Read CAPU's liquid balance, active stake, and cooldown separately. Use
`stakedOf(wallet)` for the wallet's active stake; `totalStakedCapu` is a
protocol total and includes CAPU still in cooldown in the reviewed source.

With the account session, read `GET /api/account/quota` and report:

- `dailyQuotaUSD`: the gateway's allocated daily total.
- `spentTodayUSD`: billed usage today.
- `reservedTodayUSD`: credit held for requests in progress, if returned.
- `remainingUSD`: gateway-reported available quota. Preserve null/missing
  values instead of treating them as zero.

Read key metadata/usage when diagnosing a per-key cap or expiration. Multiple
keys spend the same account pool; creating another key adds no credit.
Published billing order is daily staking credit first, then any prepaid
USDC balance. A daily key budget is a spending cap, not a documented
"staking-credit-only" switch. Never initiate a top-up without the user's
authorization.

If only an inference key is available, model access can be checked, but
account quota needs wallet sign-in or the dashboard. Do not send the
inference key to account endpoints and claim a successful quota check.

## D. Rotate / revoke

1. Authenticate as the owning wallet and identify the old key by its
   recorded ID or authenticated key metadata; do not revoke unrelated keys.
2. For an exposed key, revoke it promptly using
   `DELETE /api/account/keys/{id}`. For a planned app migration, create and
   securely install the replacement first, then revoke the old key.
3. Create the replacement with the intended budget and expiry, save it as
   `OPENCAP_API_KEY`, and apply the one-time private handoff in Flow B.
4. Verify the old key is inactive and the replacement authenticates. Report
   any revocation failure explicitly; a newly created key does not disable
   the previous one. The dashboard at `https://www.capminal.ai/gateway` also
   supports creation, budget/expiry changes, and revocation.

## E. Stake more / unstake

For more compute, check existing quota and wallet balances first. Use only
the additional amount the user authorized, then repeat Flow B's acquisition,
staking, and quota verification. Reuse the current inference key.

For an authorized CAPU unstake, check `cooldownOf(wallet)` first. Finalizing
an already-ready cooldown avoids extending it with a new request. Call
`initiateUnstake(amount)`, then wait until the returned onchain `readyAt`
before calling `unstake()`. The published cooldown is one day, but the live
`cooldownDuration()` and recorded timestamp govern. A second initiation
resets the cooldown for the **entire pending amount**. Active stake falls at
initiation; recheck gateway quota rather than promising unchanged credit.

Buying CAPU does not give the buyer another wallet's locked CAP. Burning to
unlock sCAP is only for the wallet's own recorded mint position; see the
contract reference if the user requests that exit.

## F. Human-wallet / browser handoff

Use when the user wants their own wallet's account or the agent cannot sign.
If an agent-funded transfer is requested, send only liquid CAPU to the
user-selected wallet on Base, with the destination and amount established
before execution. Do not transfer tokens unless requested.

The human connects that same wallet at `https://www.capminal.ai/capu` to
stake CAPU, then at `https://www.capminal.ai/gateway` to sign in and select
**API Keys → Create Key**. They choose a name and any daily budget/expiry,
copy the key when shown, and place it directly into the app's secure
configuration as `OPENCAP_API_KEY`. Never solve a signing limitation by
asking for a wallet private key. Credit staked under the agent's wallet
does not automatically follow a key created under the human's wallet.

## G. Recover a lost key

On the user's explicit request, recover a safely stored `OPENCAP_API_KEY`
through secure configuration or a private one-time reveal. If exposure is
suspected or uncertain, use Flow D; clarify exposure only when the user has
not already established it. Public/shared conversations never receive the
full key. If the secret store has no copy, the key list cannot recover the
full secret: create a replacement and revoke the identified lost key.

## Sources and maintenance

Research checked 2026-09-06. Official [OpenCAP documentation](https://github.com/Capminal/capminal-gitbook/blob/main/capminal/opencap.md)
documents dashboard setup, credit accounting, and the inference API.
Official [CAPU documentation](https://github.com/Capminal/capminal-gitbook/blob/main/capminal/product-features/mint-capu.md)
provides the Base addresses and funding paths. The API reference distinguishes
deployed dashboard observations from live unauthenticated checks; authenticated
creation, revocation, inference, and staking still require validation with an
authorized wallet during setup.
