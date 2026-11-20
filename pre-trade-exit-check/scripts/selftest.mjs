#!/usr/bin/env node
// Offline fixture tests for pre-trade-exit-check. Add --live for read-only
// Base Mainnet checks (no keys, no writes, no cost).
// Exit 0 = all pass; any failure exits 1 with the failing check named.

import {
  isValidEvmAddress,
  isNonZeroHexWord,
  isPausedFeaturesActive,
  verdictFromPauseReads,
  parseArgs,
  exitCodeForVerdict,
  checkBaseTokenPause,
} from "./check.mjs";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const B20_AAPL = "0xb200000000000000000000C2e324d24d7eEcd1fb";
const ZERO = "0x0000000000000000000000000000000000000000";

const results = [];
function check(name, cond, detail = "") {
  results.push({ name, pass: !!cond, detail });
}

// --- address validation ---
check("valid checksummed USDC", isValidEvmAddress(USDC));
check("valid lowercase", isValidEvmAddress(USDC.toLowerCase()));
check("reject missing 0x", !isValidEvmAddress("833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"));
check("reject short address", !isValidEvmAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA0291"));
check("reject empty", !isValidEvmAddress(""));
check("zero address is syntactically valid", isValidEvmAddress(ZERO));

// --- hex word parsing ---
check("0x is zero", !isNonZeroHexWord("0x"));
check("null is zero", !isNonZeroHexWord(null));
check("32-byte zero is zero", !isNonZeroHexWord("0x" + "00".repeat(32)));
check("bool true is non-zero", isNonZeroHexWord("0x" + "00".repeat(31) + "01"));
check("bitmask is non-zero", isNonZeroHexWord("0x" + "00".repeat(31) + "04"));

// --- pausedFeatures() ABI decoding ---
const emptyFeatures = "0x" + "00".repeat(31) + "20" + "00".repeat(32);
check("empty ABI array is not paused (offset 0x20, length 0)", !isPausedFeaturesActive(emptyFeatures));
check("empty 0x is not paused", !isPausedFeaturesActive("0x"));
check("single zero word is not paused", !isPausedFeaturesActive("0x" + "00".repeat(32)));
check("bool/bitmask true is paused", isPausedFeaturesActive("0x" + "00".repeat(31) + "01"));
const oneFeature = "0x" + "00".repeat(31) + "20" + "00".repeat(31) + "01" + "00".repeat(31) + "01";
check("ABI array length 1 is paused", isPausedFeaturesActive(oneFeature));
check("null features not paused", !isPausedFeaturesActive(null));

// --- verdict mapping (fixtures, no network) ---
const blockedPaused = verdictFromPauseReads({
  isContract: true,
  pausedFeaturesActive: false,
  basicPausedFlag: true,
  pauseReadsFailed: false,
});
check("paused() true -> EXIT_BLOCKED", blockedPaused.verdict === "EXIT_BLOCKED" && blockedPaused.action === "fail_closed" && blockedPaused.paused === true);

const blockedFeatures = verdictFromPauseReads({
  isContract: true,
  pausedFeaturesActive: true,
  basicPausedFlag: false,
  pauseReadsFailed: false,
});
check("pausedFeatures() non-zero -> EXIT_BLOCKED", blockedFeatures.verdict === "EXIT_BLOCKED" && blockedFeatures.paused === true);

const bothBlocked = verdictFromPauseReads({
  isContract: true,
  pausedFeaturesActive: true,
  basicPausedFlag: true,
  pauseReadsFailed: false,
});
check("both pause signals -> EXIT_BLOCKED", bothBlocked.verdict === "EXIT_BLOCKED" && bothBlocked.reasons.length === 2);

const clearErc20 = verdictFromPauseReads({
  isContract: true,
  pausedFeaturesActive: false,
  basicPausedFlag: null,
  pauseReadsFailed: false,
});
check("plain ERC-20 (no paused()) -> PAUSE_CLEAR", clearErc20.verdict === "PAUSE_CLEAR" && clearErc20.paused === false);

const clearBoth = verdictFromPauseReads({
  isContract: true,
  pausedFeaturesActive: false,
  basicPausedFlag: false,
  pauseReadsFailed: false,
});
check("both pause reads zero -> PAUSE_CLEAR", clearBoth.verdict === "PAUSE_CLEAR");

const unknown = verdictFromPauseReads({
  isContract: true,
  pausedFeaturesActive: false,
  basicPausedFlag: null,
  pauseReadsFailed: true,
});
check("both reads failed -> UNKNOWN/warn", unknown.verdict === "UNKNOWN" && unknown.action === "warn");

const noCode = verdictFromPauseReads({
  isContract: false,
  pausedFeaturesActive: false,
  basicPausedFlag: null,
  pauseReadsFailed: false,
});
check("no bytecode -> NOT_CONTRACT/warn", noCode.verdict === "NOT_CONTRACT" && noCode.action === "warn");

// --- CLI parsing and exit codes ---
check("positional token", parseArgs(["node", "check.mjs", USDC]).token === USDC);
check("--token flag", parseArgs(["node", "check.mjs", "--token", USDC]).token === USDC);
check("--side buy recorded", parseArgs(["node", "check.mjs", USDC, "--side", "buy"]).side === "buy");
let threw = false;
try {
  parseArgs(["node", "check.mjs", USDC, "--side", "hold"]);
} catch {
  threw = true;
}
check("invalid --side throws", threw);
check("exit 0 for PAUSE_CLEAR", exitCodeForVerdict("PAUSE_CLEAR") === 0);
check("exit 2 for EXIT_BLOCKED", exitCodeForVerdict("EXIT_BLOCKED") === 2);
check("exit 3 for UNKNOWN", exitCodeForVerdict("UNKNOWN") === 3);
check("exit 3 for NOT_CONTRACT", exitCodeForVerdict("NOT_CONTRACT") === 3);

const live = process.argv.includes("--live");
if (live) {
  const usdc = await checkBaseTokenPause(USDC);
  check("live USDC is a contract", usdc.isContract === true, usdc.rpcEndpointUsed);
  check(
    "live USDC is not EXIT_BLOCKED",
    usdc.verdict === "PAUSE_CLEAR",
    `${usdc.verdict} paused=${usdc.paused}`
  );

  const aapl = await checkBaseTokenPause(B20_AAPL, { side: "sell" });
  check("live B20 AAPL is a contract", aapl.isContract === true, aapl.rpcEndpointUsed);
  check(
    "live B20 AAPL has a known verdict",
    ["PAUSE_CLEAR", "EXIT_BLOCKED", "UNKNOWN"].includes(aapl.verdict),
    `${aapl.verdict} paused=${aapl.paused} features=${aapl.pausedFeaturesActive}`
  );
  check("live B20 AAPL records --side", aapl.side === "sell");
  if (aapl.pausedFeaturesHex) {
    const featuresActive = isPausedFeaturesActive(aapl.pausedFeaturesHex);
    check(
      "live AAPL features flag matches decoder",
      aapl.pausedFeaturesActive === featuresActive,
      aapl.pausedFeaturesHex
    );
    if (!featuresActive && aapl.basicPausedFlag !== true) {
      check("live AAPL empty/clear features is not EXIT_BLOCKED", aapl.verdict === "PAUSE_CLEAR");
    }
  }
  if (aapl.verdict === "EXIT_BLOCKED") {
    check("live paused B20 fail-closes", aapl.action === "fail_closed" && aapl.paused === true);
  }

  const zero = await checkBaseTokenPause(ZERO);
  check("live zero address is not a contract", zero.isContract === false && zero.verdict === "NOT_CONTRACT");
}

const failed = results.filter((r) => !r.pass);
for (const r of results) {
  console.error(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
}
console.log(JSON.stringify({ ok: failed.length === 0, checks: results.length, failed: failed.map((f) => f.name), live }));
process.exit(failed.length === 0 ? 0 : 1);
