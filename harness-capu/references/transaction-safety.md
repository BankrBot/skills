# Transaction validation and final confirmation

Apply this gate to every swap, approval, CAP/CAPU stake, mint, unstake,
finalization, burn, and transfer, including the browser handoff. Prepare
transactions without signing or submitting. If Bankr or another execution
tool cannot return an unsigned transaction for inspection, stop; an opaque
natural-language trade command cannot stand in for this gate.

## Build and validate the complete batch

1. Require the signer, RPC, quote, and every transaction to use Base chain ID
   **8453** and the intended owning wallet. Validate all touched contracts
   against the reviewed deployment record in [contracts.md](contracts.md).
   A provider's address label, current ABI, or successful simulation alone
   does not establish trust.
2. Bind the quote to exact input and output token contracts, verified decimals,
   human-readable and raw integer amounts, expected output, minimum output,
   route/pools, slippage, deadline, and quote expiry. Use explicit native ETH
   notation where applicable; do not confuse native ETH with a wrapped-token
   contract. Require the pinned CAPU/CAP addresses for the selected flow.
3. Inspect every transaction's `from`, `to`, `chainId`, raw `data`, four-byte
   selector, fully decoded arguments, native `value` in wei and ETH, nonce,
   gas limit, fee caps, and estimated total cost including Base data fees.
   Validate router, spender, recipient, intermediate token contracts, and all
   nested multicall/router commands and transfers. Decode with reviewed ABIs
   and compare to the quote and user intent. Reject undecodable calldata or
   routes whose complete effects cannot be bounded.
4. Require an explicit allowlist of transaction count and order for this
   batch. Check approvals against the exact input token, approved spender,
   required raw amount, and existing allowance; no unlimited approvals or
   extra permits. Include a required allowance reset as a separate previewed
   transaction. CAPU's own staking needs no approval. The optional CAP stake
   approves only the needed CAP to the pinned ScapStaking address. Reject
   unexpected approvals, transfers, recipients, native value, extra calls,
   changed minimum output, or mismatches with any confirmed parameter.
5. Simulate and run the host's transaction/security scanner before signing.
   Check expected token/native balance changes and allowance changes for the
   complete batch. Stop on any scanner error such as `untrusted_address`,
   failed simulation, unavailable validation, or unexpected effect. Do not
   retry through a different wallet/tool or Flow F to evade a rejection.

For non-swap calls, state that route/slippage/minimum swap output are not
applicable; still show actual contract effects, token units, recipient, and
gas. Minting must enforce the quoted nonzero `minCapuOut`. Protocol calls use
zero native value. Swap value is allowed only for the exact native input and
explicitly reviewed route fees; gas is accounted for separately.

## Preview, confirm, then execute

Show the complete ordered batch with the fields above, raw calldata, decoded
effects, exact maximum spend, applicable cooldowns, and acquisition/staking
risk disclosure from [SKILL.md](../SKILL.md). Require **fresh explicit user confirmation
of that exact batch** before Bankr or another signer signs or submits it.
Earlier setup intent, a budget, or an autopay policy for inference does not
authorize wallet transactions. Store an immutable local copy or digest of the
confirmed unsigned batch and compare the final tool payload against it.

Immediately before signing, revalidate deployment pins, chain, wallet,
quote/deadline, allowances, state, and transaction bytes. If anything changes
that affects the preview (including calldata, amounts, order, fees, or
implementation), stop, rebuild, and obtain a new confirmation. Never silently
replace expired quotes, enlarge allowances, or add retry transactions.

If a later step depends on actual swap/stake output, confirm only the concrete
transactions whose parameters are known. After their receipts, build and
preview the next exact batch and obtain fresh confirmation. Do the same for
cooldown finalizations on a later day; do not preauthorize unknown future
calldata. Check receipts and expected balances after each submission. On a
partial batch or ambiguous timeout, reconcile chain state and pending nonce
before proposing any further transaction; never blindly resubmit.
