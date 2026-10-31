// RPC client, approvals, simulation and the JSON plan every write command
// returns. Nothing here signs or broadcasts: a plan is unsigned calldata for
// the user's wallet (Bankr /wallet/submit, Base MCP send_calls, any wallet).
import { readFileSync } from 'node:fs';
import { createPublicClient, http, encodeFunctionData, decodeErrorResult, numberToHex, formatUnits, BaseError, parseAbi } from 'viem';
import { base } from 'viem/chains';
import * as A from './abis.mjs';
import { K, BASE_TX_GAS_CAP } from './contracts.mjs';
import { isNative } from './encode.mjs';

export const RPC_URL = process.env.FLASH_RPC_URL || 'https://base-rpc.publicnode.com';
export const API_URL = process.env.FLASH_API_URL || 'https://api.tryflash.app';
export const client = createPublicClient({ chain: base, transport: http(RPC_URL, { retryCount: 2, timeout: 30_000 }) });

export const DEADLINE_SECONDS = 20 * 60;
export const now = () => BigInt(Math.floor(Date.now() / 1000));
export const deadline = () => now() + BigInt(DEADLINE_SECONDS);

// Every custom error in the Flash contract sources (built from ecosystem/components/*/src).
const SOURCE_ERRORS = parseAbi(Object.values(JSON.parse(readFileSync(new URL('./errors.json', import.meta.url), 'utf8'))).map((sig) => `error ${sig}`));
const ERRORS = parseErrors();
function parseErrors() {
  const all = [...SOURCE_ERRORS];
  for (const abi of Object.values(A)) if (Array.isArray(abi)) for (const item of abi) if (item.type === 'error') all.push(item);
  return [
    ...all,
    ...[
      'error WrappedError(address target,bytes4 selector,bytes reason,bytes details)',
      'error V4TooLittleReceived(uint256 minAmountOutReceived,uint256 amountReceived)',
      'error V4TooMuchRequested(uint256 maxAmountInRequested,uint256 amountRequested)',
      'error TransactionDeadlinePassed()',
      'error AllowanceExpired(uint256 deadline)',
      'error InsufficientAllowance(uint256 amount)',
      'error NestedSwap()',
      'error GasFloor()',
      'error SwapGasFloor()',
      'error SlippageExceeded()',
      'error WrongPhase()',
      'error InsufficientPosition()',
      'error NothingToClaim()',
      'error InvalidCandidate()',
      'error InsufficientGasForGraduation()',
      'error NotOperator()',
      'error NotPositionOwner()',
      'error NoLattice()',
      'error InvalidConfiguration()',
      'error Error(string)',
    ].map((sig) => ({ type: 'error', name: sig.slice(6, sig.indexOf('(')), inputs: parseInputs(sig) })),
  ];
}
function parseInputs(sig) {
  const inner = sig.slice(sig.indexOf('(') + 1, sig.lastIndexOf(')'));
  if (!inner) return [];
  return inner.split(',').map((part) => { const [type, name] = part.trim().split(' '); return { type, name: name || '' }; });
}

/** The decoded revert reason anywhere in a viem error, unwrapping v4 WrappedError. */
export function revertReason(error) {
  let data;
  if (error instanceof BaseError) {
    const found = error.walk((e) => typeof e?.data === 'string' && /^0x[0-9a-f]{8}/i.test(e.data));
    data = found?.data;
    if (!data) {
      const decoded = error.walk((e) => e?.data?.errorName);
      if (decoded?.data?.errorName) return decoded.data.errorName;
    }
  } else if (typeof error?.data === 'string') data = error.data;
  if (data) return decodeData(data);
  const text = String(error?.shortMessage || error?.message || error);
  if (/insufficient funds/i.test(text)) return 'insufficient ETH for value + gas';
  return text.split('\n')[0].slice(0, 200);
}
function decodeData(data, depth = 0) {
  try {
    const decoded = decodeErrorResult({ abi: ERRORS, data });
    if (decoded.errorName === 'WrappedError' && depth < 3 && decoded.args[2]?.length >= 10) return decodeData(decoded.args[2], depth + 1);
    if (decoded.errorName === 'UnexpectedRevertBytes' && depth < 3 && decoded.args[0]?.length >= 10) return decodeData(decoded.args[0], depth + 1);
    if (decoded.errorName === 'Error') return String(decoded.args[0]);
    return `${decoded.errorName}(${(decoded.args || []).map(String).join(',')})`;
  } catch {
    return `reverted ${data.slice(0, 10)}`;
  }
}

/** One unsigned transaction. `value` and `gas` are decimal wei / gas strings (JSON-safe). */
export function call({ to, abi, functionName, args = [], value = 0n, gas, description }) {
  const data = encodeFunctionData({ abi, functionName, args });
  return { to, data, value, gas, description };
}

/** token.approve(spender, amount) when the allowance is short; EXACT amounts only. */
export async function approval(owner, token, spender, amount, symbol, spenderName) {
  if (isNative(token) || amount === 0n) return [];
  const allowance = await client.readContract({ address: token, abi: A.erc20, functionName: 'allowance', args: [owner, spender] });
  if (allowance >= amount) return [];
  return [call({ to: token, abi: A.erc20, functionName: 'approve', args: [spender, amount], description: `Approve ${symbol} for ${spenderName}` })];
}

/** ERC20 -> Permit2 and Permit2 -> Universal Router (exact amount, 1 day expiry), only where short. */
export async function permit2Approvals(owner, token, amount, symbol) {
  if (isNative(token)) return [];
  const steps = await approval(owner, token, K.uniswap.permit2, amount, symbol, 'Permit2');
  const [permitted, expiration] = await client.readContract({ address: K.uniswap.permit2, abi: A.permit2, functionName: 'allowance', args: [owner, token, K.uniswap.universalRouter] });
  if (permitted < amount || BigInt(expiration) < now() + 300n) {
    steps.push(call({ to: K.uniswap.permit2, abi: A.permit2, functionName: 'approve', args: [token, K.uniswap.universalRouter, amount, Number(now() + 86_400n)], description: `Permit2: allow the Universal Router to pull ${symbol}` }));
  }
  return steps;
}

/**
 * Simulates the ordered transactions from `account` in one block (eth_simulateV1),
 * so approvals are applied before the action. Falls back to eth_call of the
 * last transaction when the node lacks eth_simulateV1 and nothing precedes it.
 */
export async function simulate(account, transactions) {
  try {
    const { results } = await client.simulateCalls({ account, calls: transactions.map(({ to, data, value, gas }) => ({ to, data, value, ...(gas ? { gas } : {}) })) });
    const failed = results.findIndex((entry) => entry.status !== 'success');
    if (failed >= 0) return { method: 'eth_simulateV1', ok: false, failedIndex: failed, reason: revertReason(results[failed].error) };
    return { method: 'eth_simulateV1', ok: true, gasUsed: results.map((entry) => entry.gasUsed.toString()) };
  } catch (error) {
    if (transactions.length !== 1) return { method: 'none', ok: false, unsupported: true, reason: `eth_simulateV1 unavailable: ${revertReason(error)}` };
    const [tx] = transactions;
    try {
      await client.call({ account, to: tx.to, data: tx.data, value: tx.value, gas: BASE_TX_GAS_CAP });
      return { method: 'eth_call', ok: true };
    } catch (inner) {
      return { method: 'eth_call', ok: false, failedIndex: 0, reason: revertReason(inner) };
    }
  }
}

/** eth_estimateGas of one call (only meaningful when nothing precedes it). */
export async function estimate(account, tx) {
  try {
    return await client.estimateGas({ account, to: tx.to, data: tx.data, value: tx.value });
  } catch {
    return undefined;
  }
}

/**
 * Final JSON plan. Agents submit `transactions` in order (Bankr), or pass
 * `sendCalls` to Base MCP send_calls (one atomic approval).
 */
export function plan({ action, summary, transactions, simulation, warnings = [], notes = [] }) {
  const ok = !simulation || simulation.ok || simulation.unsupported;
  return {
    ok,
    status: ok ? 'ready' : 'would-revert',
    action,
    summary,
    warnings: [
      ...warnings,
      ...(simulation?.unsupported ? ['Not simulated: the RPC lacks eth_simulateV1. Simulate before signing.'] : []),
    ],
    ...(ok ? {} : { error: `Simulation failed at transaction ${simulation.failedIndex + 1}: ${simulation.reason}` }),
    transactions: transactions.map((tx) => ({
      to: tx.to,
      data: tx.data,
      value: (tx.value || 0n).toString(),
      ...(tx.gas ? { gas: tx.gas.toString() } : {}),
      description: tx.description,
    })),
    sendCalls: { chain: 'base', calls: transactions.map((tx) => ({ to: tx.to, value: numberToHex(tx.value || 0n), data: tx.data })) },
    simulation,
    notes,
    chainId: 8453,
    expiresAt: new Date(Date.now() + DEADLINE_SECONDS * 1000).toISOString(),
  };
}

export const fmt = (value, decimals = 18, digits = 6) => {
  const text = formatUnits(value, decimals);
  const [whole, frac = ''] = text.split('.');
  const trimmed = frac.slice(0, digits).replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
};

export async function api(path) {
  const response = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`API ${path}: HTTP ${response.status}`);
  return response.json();
}
