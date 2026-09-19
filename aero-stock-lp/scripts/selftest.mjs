#!/usr/bin/env node
// aero-stock-lp selftest: offline math/encoding vectors, plus --live for
// read-only checks against Base mainnet (no keys, no writes, no cost).
// Exit 0 = all pass; any failure exits 1 with the failing check named.

import { MARKETS, SEL } from "./lib/markets.mjs";
import { tearsheetUrl, parseTearsheet, buildLedger, renderLedger, TEARSHEET_PRICE_ATOMIC } from "./lib/ledger.mjs";
import { CHAIN as LEDGER_CHAIN, COVERED as LEDGER_COVERED } from "./lib/ledger-coverage.mjs";
import { intWord, uintWord, addrWord, toInt, multicall, wordAt, toBigInt, strip0x, tx } from "./lib/chain.mjs";
import {
  priceFromSqrtX96,
  tickFromPrice,
  priceFromTick,
  ticksForBand,
  buildBand,
  stockShare,
  wFromIV,
} from "./lib/math.mjs";

const results = [];
function check(name, cond, detail = "") {
  results.push({ name, pass: !!cond, detail });
}
function approx(a, b, tolPct = 0.01) {
  return Math.abs(a / b - 1) < tolPct;
}

// --- encoding ---
check("int24 -100 two's complement", intWord(-100).endsWith("ff9c") && /^f+/.test(intWord(-100)));
check("int24 +10 plain", intWord(10) === uintWord(10));
check("sign-extend decode", toInt("f".repeat(62) + "9c") === -100n);
check("addr padding", addrWord("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913").length === 64);

// --- price math (dec 8 equities: USD/share = 100 / (sqrtP/2^96)^2) ---
// vector: price $300 -> sqrtP = 2^96 * sqrt(100/300)
const sqrtP300 = BigInt(Math.round(2 ** 96 * Math.sqrt(100 / 300)));
check("price from sqrtX96 (equity $300)", approx(priceFromSqrtX96(sqrtP300, 8), 300, 0.001));
// AERO (dec 18): USD/AERO = 1e12 / (sqrtP/2^96)^2 ; $1.20
const sqrtAero = BigInt(Math.round(2 ** 96 * Math.sqrt(1e12 / 1.2)));
check("price from sqrtX96 (AERO $1.20)", approx(priceFromSqrtX96(sqrtAero, 18), 1.2, 0.001));

// --- tick <-> price round trips ---
for (const [p, dec] of [[300, 8], [311.2, 8], [1.2, 18], [0.85, 18]]) {
  const t = Math.round(tickFromPrice(p, dec));
  check(`tick/price roundtrip ${p} (dec ${dec})`, approx(priceFromTick(t, dec), p, 0.001));
}

// --- band inversion + snapping ---
// tick and human price move in OPPOSITE directions: low price -> upper tick.
const band = ticksForBand(300, 322, 8, 10);
check("band tickLower < tickUpper", band.tickLower < band.tickUpper);
check("band ticks snapped to spacing", band.tickLower % 10 === 0 && band.tickUpper % 10 === 0);
check("band prices preserved-ish", band.bandLow <= 300.5 && band.bandHigh >= 321.4);
check(
  "inversion: high price -> lower tick",
  approx(priceFromTick(band.tickLower, 8), band.bandHigh, 0.001) &&
    approx(priceFromTick(band.tickUpper, 8), band.bandLow, 0.001)
);
// degenerate band gets the 1-spacing floor
const tiny = ticksForBand(310.0, 310.01, 8, 10);
check("1-spacing floor", tiny.tickUpper - tiny.tickLower === 10);

// --- band construction ---
const b2 = buildBand(310, 312, 0.035, "standard", 8, 10);
check("buildBand centers between pool and quote", b2.bandLow < 311 && b2.bandHigh > 311);
const b3 = buildBand(310, 312, 5.0, "wide", 8, 10); // absurd vol -> capped
check("buildBand caps at ±35%", b3.bandHigh / 311 < 1.36);
let threw = false;
try {
  buildBand(310, 312, 0, "standard", 8, 10);
} catch {
  threw = true;
}
check("no vol input -> throws (fail closed)", threw);

// --- stock share ---
check("share at center ~0.4-0.6", stockShare(311, 300, 322) > 0.4 && stockShare(311, 300, 322) < 0.6);
check("share below band = 1", stockShare(290, 300, 322) === 1);
check("share above band = 0", stockShare(330, 300, 322) === 0);
check("wFromIV(0.28) ~ 3.9%", approx(wFromIV(0.28), 0.0394, 0.02));

// --- calldata shape (static tuples: selector + N words) ---
const mintData =
  SEL.mint +
  addrWord("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") +
  addrWord(MARKETS.AAPL.token) +
  intWord(10) +
  intWord(-115000) +
  intWord(-114000) +
  uintWord(50000000n) +
  uintWord(16000000n) +
  uintWord(0) +
  uintWord(0) +
  addrWord("0x" + "11".repeat(20)) +
  uintWord(1755800000) +
  uintWord(0);
check("mint calldata = 4 + 12*32 bytes", mintData.length === 2 + (4 + 12 * 32) * 2);
const swapData =
  SEL.exactInputSingle +
  addrWord("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") +
  addrWord(MARKETS.AAPL.token) +
  intWord(10) +
  addrWord("0x" + "11".repeat(20)) +
  uintWord(1755800000) +
  uintWord(11000000n) +
  uintWord(3400000n) +
  uintWord(0);
check("exactInputSingle calldata = 4 + 8*32 bytes", swapData.length === 2 + (4 + 8 * 32) * 2);

// --- unsigned tx hygiene (REGRESSION: SEL selectors carry 0x; a blind
// "0x" + data in tx() once emitted 0x0x… calldata that failed on submission) ---
const t1 = tx(MARKETS.AAPL.gauge, SEL.getReward + uintWord(123n), "claim vector");
check("tx() exactly one 0x prefix", t1.data.startsWith("0x") && !t1.data.startsWith("0x0x"));
check("tx() clean hex payload", /^0x(?:[0-9a-f]{2})+$/.test(t1.data));
check("tx() selector at head", t1.data.slice(0, 10) === SEL.getReward);
check("tx() word-aligned length", (t1.data.length - 10) % 64 === 0);
check("tx() to is 42 chars", t1.to.length === 42);
check("tx() value/chainId shape", t1.value === "0" && t1.chainId === 8453);
const t2 = tx(MARKETS.AAPL.gauge, strip0x(SEL.gaugeDeposit) + uintWord(1n), "unprefixed vector");
check("tx() normalizes unprefixed data too", t2.data.slice(0, 10) === SEL.gaugeDeposit);
const mintTx = tx(MARKETS.AAPL.npm, mintData, "mint vector");
check("tx() mint calldata single-prefixed", !mintTx.data.startsWith("0x0x") && mintTx.data.length === mintData.length);
let badDataThrew = false;
try { tx(MARKETS.AAPL.gauge, "0xZZ123", "bad calldata"); } catch { badDataThrew = true; }
check("tx() malformed calldata throws (fail closed)", badDataThrew);
let badToThrew = false;
try { tx("0x1234", SEL.getReward + uintWord(1n), "bad to"); } catch { badToThrew = true; }
check("tx() malformed to-address throws (fail closed)", badToThrew);

// --- ledger (DeltaDesk tearsheet -> fees + AERO vs informed flow vs IL, per $1k) ---
// Synthetic fixture in the tearsheet's shape (numbers chosen to be checkable
// by hand, not market data).
{
  const W = "0x2222222222222222222222222222222222222222";
  const fixture = {
    owner: W,
    chain: "base",
    role: "owner",
    generated_utc: "2026-09-19T00:00:00+00:00",
    summary: {},
    positions: [
      // staked: fees kept ~0, paid in AERO, its fee share went to voters
      { pool: "NVDAc/USDC", token_id: "101", status: "closed", avg_notional_usd: 1000, active_days: 2, fees_usd: 0,
        aero_usd: 80, fees_to_voters_usd: 40, lvr_hl_1h_usd: 50, il_usd: -30, gas_usd: 1, vs_hodl_usd: 49,
        price_pnl_usd: 10, net_usd: 59, residual_bp: 0.001 },
      // unstaked: keeps fees minus the pool's cut
      { pool: "NVDAc/USDC", token_id: "202", status: "open", avg_notional_usd: 500, active_days: 1, fees_usd: 9,
        aero_usd: 0, fees_to_voters_usd: 1, lvr_hl_1h_usd: 4, il_usd: -2, gas_usd: 0.5, vs_hodl_usd: 6.5,
        price_pnl_usd: 0, net_usd: 6.5, residual_bp: null },
      { pool: "SOME/OTHER", token_id: "303", status: "open", avg_notional_usd: 100, active_days: 1, fees_usd: 1,
        lvr_hl_1h_usd: 1, il_usd: 0, gas_usd: 0, vs_hodl_usd: 1, price_pnl_usd: 0, net_usd: 1, residual_bp: null },
    ],
  };
  const covered = Object.fromEntries(Object.entries(LEDGER_COVERED).map(([k, v]) => [k, v.market]));
  for (const [key, c] of Object.entries(LEDGER_COVERED)) {
    check(`ledger coverage ${key} is market ${c.market} with the same pool`, !!MARKETS[c.market] && MARKETS[c.market].pool.toLowerCase() === c.pool);
  }
  const url = tearsheetUrl(W, { chain: LEDGER_CHAIN });
  check("ledger url: x402 tearsheet on chain=base", url.includes("/tearsheet?") && url.includes("chain=base") && url.includes(`wallet=${W}`));
  let threw = 0;
  for (const bad of [() => tearsheetUrl("0x123", { chain: LEDGER_CHAIN }), () => tearsheetUrl(W, { chain: LEDGER_CHAIN, role: "x" })]) {
    try { bad(); } catch { threw++; }
  }
  check("ledger url: bad wallet / role throw (fail closed)", threw === 2);
  const L = buildLedger(parseTearsheet(JSON.stringify(fixture), { wallet: W, chain: LEDGER_CHAIN }), { covered });
  const t = L.totals;
  check("ledger selects covered markets only", t.positions === 2 && t.open === 1 && L.otherPools.join() === "SOME/OTHER");
  check("ledger totals: fees, AERO, voters' share, informed flow, vs holding",
    t.feesUsd === 9 && t.aeroUsd === 80 && t.feesToVotersUsd === 41 && t.informedFlowUsd === 54 && t.vsHoldUsd === 55.5);
  check("ledger edge counts AERO: (fees + AERO) / informed flow", approx(t.edge, 89 / 54, 1e-9));
  check("ledger per $1k·day = total x 1000 / capital-days", approx(t.per1kPerDay.aero, 32, 1e-9));
  const st = L.rows.find((r) => r.tokenId === "101");
  check("ledger per $1k deployed per position", st.per1k.aero === 80 && st.per1k.informedFlow === 50);
  check("ledger --token-id / --open / --all", buildLedger(fixture, { covered, tokenIds: ["101"] }).rows.length === 1 &&
    buildLedger(fixture, { covered, openOnly: true }).rows.length === 1 && buildLedger(fixture, { covered, all: true }).rows.length === 3);
  const lines = renderLedger(L, { wallet: W, venueName: "Aerodrome (Base)", coveredMarkets: ["NVDA"], uncoveredHeld: ["AAPL"], notYetListed: [] });
  check("ledger report leads with the result vs holding", lines[0].includes("result vs simply holding +$55.50"));
  check("ledger report shows fees + AERO vs informed flow", lines[1].includes("Fees +$9.00 + AERO +$80.00 against informed flow −$54.00 (edge 1.65 incl. AERO)"));
  check("ledger report names the voters' share and uncovered markets",
    lines.some((l) => l.startsWith("$41.00 of the fee share went to veAERO voters")) && lines.some((l) => l.includes("Not in the ledger yet: AAPL")));
  const gain = renderLedger(buildLedger({ positions: [{ pool: "NVDAc/USDC", token_id: "9", status: "open", avg_notional_usd: 100,
    active_days: 1, fees_usd: 1, lvr_hl_1h_usd: -5, il_usd: 0, gas_usd: 0, vs_hodl_usd: 1 }] }, { covered }),
    { wallet: W, venueName: "Aerodrome (Base)", coveredMarkets: ["NVDA"] });
  check("ledger: flow that lost on price prints as a gain, no edge", gain[1].includes("informed flow +$5.00;"));
  let rejected = 0;
  for (const [txt, ctx] of [
    [JSON.stringify(fixture), { wallet: "0x3333333333333333333333333333333333333333", chain: LEDGER_CHAIN }],
    [JSON.stringify({ ...fixture, chain: "robinhood" }), { wallet: W, chain: LEDGER_CHAIN }],
    [JSON.stringify({ error: "upstream 502" }), { wallet: W, chain: LEDGER_CHAIN }],
    ["not json", { wallet: W, chain: LEDGER_CHAIN }],
  ]) {
    try { parseTearsheet(txt, ctx); } catch { rejected++; }
  }
  check("ledger rejects wrong wallet, wrong chain, error body, non-JSON", rejected === 4);
}

// --- live (read-only) ---
if (process.argv.includes("--live")) {
  const names = Object.keys(MARKETS);
  const res = await multicall(
    names.flatMap((m) => [
      { to: MARKETS[m].pool, data: SEL.slot0 },
      { to: MARKETS[m].pool, data: SEL.gauge },
      { to: MARKETS[m].pool, data: SEL.tickSpacingCall },
      { to: MARKETS[m].gauge, data: SEL.rewardToken },
    ])
  );
  names.forEach((m, i) => {
    const [slot0, gauge, spacing, rewardToken] = res.slice(i * 4, i * 4 + 4);
    const price = slot0.ok ? priceFromSqrtX96(toBigInt(wordAt(slot0.data, 0)), MARKETS[m].decimals) : 0;
    const tick = slot0.ok ? Number(toInt(wordAt(slot0.data, 1))) : null;
    check(`live ${m} slot0 sane price`, price > 0 && price < 100000, `$${price.toFixed(2)}`);
    check(
      `live ${m} tick matches price`,
      tick !== null && approx(priceFromTick(tick, MARKETS[m].decimals), price, 0.001)
    );
    check(
      `live ${m} pool.gauge() matches table`,
      gauge.ok && ("0x" + gauge.data.slice(24)).toLowerCase() === MARKETS[m].gauge.toLowerCase()
    );
    check(
      `live ${m} tickSpacing matches table`,
      spacing.ok && Number(toInt(wordAt(spacing.data, 0))) === MARKETS[m].tickSpacing
    );
    check(
      `live ${m} gauge pays AERO`,
      rewardToken.ok &&
        ("0x" + rewardToken.data.slice(24)).toLowerCase() ===
          "0x940181a94a35a4569e4529a3cdfb74e38fd98631"
    );
  });
}

// --- live ledger endpoint (read-only, free: an unpaid call must answer 402 at the documented price) ---
if (process.argv.includes("--live")) {
  try {
    const res = await fetch(tearsheetUrl("0x0000000000000000000000000000000000000001", { chain: LEDGER_CHAIN }), { signal: AbortSignal.timeout(20_000) });
    const body = await res.json().catch(() => ({}));
    const a = (body.accepts || [])[0] || {};
    check("live ledger endpoint asks for x402 payment (402)", res.status === 402, `HTTP ${res.status}`);
    check("live ledger price = $0.05 USDC on Base", a.amount === TEARSHEET_PRICE_ATOMIC && a.network === "eip155:8453", `${a.amount} on ${a.network}`);
  } catch (e) {
    check("live ledger endpoint reachable", false, String(e.message).slice(0, 80));
  }
}

// --- report ---
const failed = results.filter((r) => !r.pass);
for (const r of results) {
  console.error(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
}
console.log(JSON.stringify({ ok: failed.length === 0, checks: results.length, failed: failed.map((f) => f.name) }));
process.exit(failed.length === 0 ? 0 : 1);
