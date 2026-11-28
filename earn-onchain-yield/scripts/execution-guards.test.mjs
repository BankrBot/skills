import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuote, assertAutoDirectRequirements } from './execution-guards.mjs';

const nowMs = 1800000000000;
const quote = { amountIn: '25000000', quotedAmountOut: '10000', minimumAmountOut: '9800', quotedAt: nowMs };
const context = { amountIn: '25000000', slippageBps: 200, nowMs };
const check = (changes = {}, options = {}) => validateQuote({ ...quote, ...changes }, { ...context, ...options });

test('accepts exactly the approved slippage boundary and stronger protection', () => {
  assert.equal(check().requiredMinimum, 9800n);
  assert.equal(check({ minimumAmountOut: '9900' }).minimum, 9900n);
});
test('rejects the audited 10000-to-1 weak-minimum counterexample', () => {
  assert.throws(() => check({ minimumAmountOut: '1' }), /slippage/);
});
test('rejects one unit below the minimum and output above the quote', () => {
  assert.throws(() => check({ minimumAmountOut: '9799' }), /slippage/);
  assert.throws(() => check({ minimumAmountOut: '10001' }), /slippage/);
});
test('uses integer arithmetic and an explicit raw-unit rounding floor', () => {
  assert.equal(check({ quotedAmountOut: '10001' }).requiredMinimum, 9800n);
  const output = 10n ** 30n + 123n;
  const minimum = output * 9800n / 10000n;
  assert.equal(check({ quotedAmountOut: String(output), minimumAmountOut: String(minimum) }).minimum, minimum);
});
test('rejects malformed, zero, negative, numeric and overflowing amounts', () => {
  for (const field of ['amountIn', 'quotedAmountOut', 'minimumAmountOut']) {
    for (const bad of [undefined, 1, '0', '-1', '1.1', '1e18', String(1n << 256n)]) {
      assert.throws(() => check({ [field]: bad }));
    }
  }
  assert.throws(() => check({ quotedAmountOut: '1', minimumAmountOut: '1' }), /too small/);
});
test('binds returned input amount to the requested leg', () => {
  assert.throws(() => check({ amountIn: '25000001' }), /changed input/);
});
test('rejects invalid or silently widened slippage settings', () => {
  for (const slippageBps of [undefined, '200', 9, 501, -1, 200.5, NaN]) assert.throws(() => check({}, { slippageBps }));
  assert.throws(() => check({ minimumAmountOut: '9700' }), /slippage/);
});
test('accepts age 0 and 30000ms but rejects expired and future quotes', () => {
  assert.equal(check().ageMs, 0);
  assert.equal(check({ quotedAt: nowMs - 30000 }).ageMs, 30000);
  for (const quotedAt of [nowMs - 30001, nowMs + 1, nowMs + 3600000]) assert.throws(() => check({ quotedAt }), /expired/);
});
test('rejects malformed timestamps, seconds instead of milliseconds, and invalid clocks', () => {
  for (const quotedAt of [undefined, null, String(nowMs), NaN, Infinity, 0, -1, nowMs + 0.5, nowMs / 1000]) {
    assert.throws(() => check({ quotedAt }));
  }
  assert.throws(() => check({}, { nowMs: NaN }));
});
test('rechecking after approval/simulation catches a quote that expired meanwhile', () => {
  assert.doesNotThrow(() => check({}, { nowMs: nowMs + 29000 }));
  assert.throws(() => check({}, { nowMs: nowMs + 31000 }), /expired/);
});
test('allows direct deposit only when unavailable protections are not required', () => {
  assert.doesNotThrow(() => assertAutoDirectRequirements({ requiresMinimumShares: false, requiresOnchainDeadline: false }));
  for (const requirements of [
    { requiresMinimumShares: true, requiresOnchainDeadline: false },
    { requiresMinimumShares: false, requiresOnchainDeadline: true },
    { requiresMinimumShares: true, requiresOnchainDeadline: true },
    {},
  ]) assert.throws(() => assertAutoDirectRequirements(requirements));
});
