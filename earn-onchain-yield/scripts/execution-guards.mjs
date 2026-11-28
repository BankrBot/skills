// Pure validation only. No network, signing, credentials or transaction submission.
function positiveUint(value, label) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error(`${label} must be an unsigned decimal string`);
  const amount = BigInt(value);
  if (amount <= 0n || amount >= 1n << 256n) throw new Error(`${label} is outside uint256`);
  return amount;
}

// Call with the user's confirmed tolerance and this leg's exact requested amount.
// This validates amount/slippage/time only; the protocol's other checks still apply.
export function validateQuote(quote, { amountIn, slippageBps, nowMs = Date.now() }) {
  if (!quote || typeof quote !== 'object') throw new Error('Quote is missing');
  if (!Number.isInteger(slippageBps) || slippageBps < 10 || slippageBps > 500) throw new Error('Invalid approved slippage');
  const expected = positiveUint(amountIn, 'Requested input');
  if (positiveUint(quote.amountIn, 'Quoted input') !== expected) throw new Error('Quote changed input amount');
  const output = positiveUint(quote.quotedAmountOut, 'Quoted output');
  const minimum = positiveUint(quote.minimumAmountOut, 'Minimum output');
  const requiredMinimum = output * BigInt(10000 - slippageBps) / 10000n;
  if (requiredMinimum === 0n) throw new Error('Output is too small to protect');
  if (minimum < requiredMinimum || minimum > output) throw new Error('Minimum output violates approved slippage');
  if (!Number.isSafeInteger(nowMs) || nowMs <= 0
    || !Number.isSafeInteger(quote.quotedAt) || quote.quotedAt <= 0) throw new Error('Invalid quote timestamp');
  const ageMs = nowMs - quote.quotedAt;
  if (ageMs < 0 || ageMs > 30000) throw new Error('Quote is future-dated or expired');
  return { requiredMinimum, minimum, ageMs };
}

// Set these flags from the user's requirements, not from available ABI arguments.
export function assertAutoDirectRequirements({ requiresMinimumShares, requiresOnchainDeadline }) {
  if (typeof requiresMinimumShares !== 'boolean' || typeof requiresOnchainDeadline !== 'boolean') {
    throw new Error('Resolve the requested protections before a direct deposit');
  }
  if (requiresMinimumShares || requiresOnchainDeadline) {
    throw new Error('Auto direct deposit cannot enforce minimum receipt shares or an onchain deadline');
  }
}
