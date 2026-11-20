#!/usr/bin/env node
// Read-only Base Mainnet (chainId 8453) pre-trade pause checker.
// Pure global `fetch` JSON-RPC to mainnet.base.org, with failover to
// base-rpc.publicnode.com. Optional BASE_RPC_URL is tried first.
// No npm dependencies, no private keys, no payments.

import { pathToFileURL } from "node:url";

const DEFAULT_RPCS = [
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
];

// keccak256("pausedFeatures()") -> 0xde9997e3
// keccak256("paused()")         -> 0x5c975abb
const SELECTOR_PAUSED_FEATURES = "0xde9997e3";
const SELECTOR_PAUSED = "0x5c975abb";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function rpcEndpoints() {
  const extra = process.env.BASE_RPC_URL?.trim();
  return extra ? [extra, ...DEFAULT_RPCS.filter((u) => u !== extra)] : [...DEFAULT_RPCS];
}

export function isValidEvmAddress(addr) {
  return ADDRESS_RE.test(addr);
}

export function isNonZeroHexWord(hex) {
  if (!hex || hex === "0x") return false;
  return hex.replace(/^0x/i, "").replace(/^0+/, "").length > 0;
}

function hexWords(hex) {
  const raw = hex.replace(/^0x/i, "");
  if (!raw) return [];
  const padded = raw.length % 64 === 0 ? raw : raw.padEnd(Math.ceil(raw.length / 64) * 64, "0");
  const words = [];
  for (let i = 0; i < padded.length; i += 64) {
    words.push(BigInt("0x" + padded.slice(i, i + 64)));
  }
  return words;
}

// pausedFeatures() may return a uint256/bytes32 bitmask or an ABI-encoded
// dynamic array / bytes. An empty array is encoded as offset (0x20) + length 0
// and must not be treated as paused. Treating the raw blob as a single hex
// word would false-positive because the offset word is non-zero.
export function isPausedFeaturesActive(hex) {
  if (!hex || hex === "0x") return false;
  const words = hexWords(hex);
  if (words.length === 0) return false;
  if (words.length === 1) return words[0] !== 0n;
  const offsetBytes = words[0];
  if (offsetBytes % 32n === 0n) {
    const index = Number(offsetBytes / 32n);
    if (index >= 1 && index < words.length) {
      const length = words[index];
      return length > 0n;
    }
  }
  return words.some((w) => w !== 0n);
}

export function verdictFromPauseReads({ isContract, pausedFeaturesActive, basicPausedFlag, pauseReadsFailed }) {
  if (!isContract) {
    return {
      verdict: "NOT_CONTRACT",
      action: "warn",
      paused: false,
      reasons: ["No contract bytecode at this address on Base Mainnet."],
    };
  }
  if (pauseReadsFailed) {
    return {
      verdict: "UNKNOWN",
      action: "warn",
      paused: false,
      reasons: ["paused() and pausedFeatures() could not be read; pause state is unknown."],
    };
  }
  const paused = pausedFeaturesActive || basicPausedFlag === true;
  if (paused) {
    const reasons = [];
    if (pausedFeaturesActive) reasons.push("pausedFeatures() returned a non-zero value.");
    if (basicPausedFlag === true) reasons.push("paused() returned true.");
    return { verdict: "EXIT_BLOCKED", action: "fail_closed", paused: true, reasons };
  }
  const reasons = ["Contract is not paused via paused() or pausedFeatures()."];
  if (basicPausedFlag === null) reasons.push("paused() is unimplemented or reverted; pause state comes from pausedFeatures() only.");
  if (pausedFeaturesActive === false && basicPausedFlag === null) {
    // pausedFeatures was readable and zero; paused() missing — still clear.
  }
  return { verdict: "PAUSE_CLEAR", action: "report", paused: false, reasons };
}

async function jsonRpcWithFailover(method, params) {
  let lastError = null;
  for (const endpoint of rpcEndpoints()) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${endpoint}`);
      const payload = await response.json();
      if (payload.error) {
        throw new Error(`JSON-RPC ${payload.error.code}: ${payload.error.message}`);
      }
      if (typeof payload.result !== "string") {
        throw new Error(`Missing string result from ${endpoint}`);
      }
      return { result: payload.result, endpoint };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error("All Base Mainnet RPC endpoints failed");
}

async function ethCallSafe(to, data) {
  try {
    const res = await jsonRpcWithFailover("eth_call", [{ to, data }, "latest"]);
    return { result: res.result, endpoint: res.endpoint, ok: true };
  } catch {
    return { result: null, endpoint: null, ok: false };
  }
}

export async function checkBaseTokenPause(tokenAddress, options = {}) {
  if (!isValidEvmAddress(tokenAddress)) {
    throw new Error(`Invalid Base EVM address: ${tokenAddress}`);
  }

  const codeRes = await jsonRpcWithFailover("eth_getCode", [tokenAddress, "latest"]);
  const isContract = codeRes.result.length > 2;

  if (!isContract) {
    const mapped = verdictFromPauseReads({
      isContract: false,
      pausedFeaturesActive: false,
      basicPausedFlag: null,
      pauseReadsFailed: false,
    });
    return {
      tier: 0,
      network: "eip155:8453",
      chainId: 8453,
      token: tokenAddress,
      side: options.side ?? null,
      isContract: false,
      paused: false,
      pausedFeaturesActive: false,
      pausedFeaturesHex: null,
      basicPausedFlag: null,
      verdict: mapped.verdict,
      action: mapped.action,
      reasons: mapped.reasons,
      rpcEndpointUsed: codeRes.endpoint,
      checkedAt: new Date().toISOString(),
    };
  }

  const [pfCall, pCall] = await Promise.all([
    ethCallSafe(tokenAddress, SELECTOR_PAUSED_FEATURES),
    ethCallSafe(tokenAddress, SELECTOR_PAUSED),
  ]);

  const pausedFeaturesActive = pfCall.ok ? isPausedFeaturesActive(pfCall.result) : false;
  const basicPausedFlag = pCall.ok ? isNonZeroHexWord(pCall.result) : null;
  const pauseReadsFailed = !pfCall.ok && !pCall.ok;
  const mapped = verdictFromPauseReads({
    isContract: true,
    pausedFeaturesActive,
    basicPausedFlag,
    pauseReadsFailed,
  });

  return {
    tier: 0,
    network: "eip155:8453",
    chainId: 8453,
    token: tokenAddress,
    side: options.side ?? null,
    isContract: true,
    paused: mapped.paused,
    pausedFeaturesActive,
    pausedFeaturesHex: pfCall.result,
    basicPausedFlag,
    verdict: mapped.verdict,
    action: mapped.action,
    reasons: mapped.reasons,
    rpcEndpointUsed: pfCall.endpoint || pCall.endpoint || codeRes.endpoint,
    checkedAt: new Date().toISOString(),
  };
}

export function parseArgs(argv) {
  const args = { token: null, side: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--token") {
      args.token = argv[++i];
    } else if (arg === "--side") {
      args.side = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (!args.token && !arg.startsWith("-")) {
      args.token = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (args.side && args.side !== "buy" && args.side !== "sell") {
    throw new Error("Invalid --side. Use buy or sell.");
  }
  return args;
}

export function exitCodeForVerdict(verdict) {
  switch (verdict) {
    case "PAUSE_CLEAR":
      return 0;
    case "EXIT_BLOCKED":
      return 2;
    case "UNKNOWN":
    case "NOT_CONTRACT":
      return 3;
    default:
      return 1;
  }
}

function isMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isMain()) {
  try {
    const args = parseArgs(process.argv);
    if (args.help || !args.token) {
      console.error("Usage: node scripts/check.mjs <0xTokenAddress> [--side buy|sell]");
      console.error("   or: node scripts/check.mjs --token <0xTokenAddress> [--side buy|sell]");
      process.exit(args.help ? 0 : 1);
    }
    const result = await checkBaseTokenPause(args.token, { side: args.side });
    console.log(JSON.stringify(result, null, 2));
    process.exit(exitCodeForVerdict(result.verdict));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
