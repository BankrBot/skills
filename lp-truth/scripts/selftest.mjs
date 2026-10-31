#!/usr/bin/env node
// lp-truth selftest: the formatter against fixtures (offline), plus --live for
// free read-only checks that every endpoint is up and asks for its documented
// x402 price (an unpaid call answers 402; nothing is paid).
// Exit 0 = all pass; any failure exits 1 with the failing check named.

import { report } from "./report.mjs";
import { BASE, POOLS, PRICES, url } from "./lib/endpoints.mjs";

const results = [];
const check = (name, cond, detail = "") => results.push({ name, pass: !!cond, detail });
const has = (lines, s) => Array.isArray(lines) && lines.some((l) => l.includes(s));

// A real safe-to-lp response (the first settled call, a self-test from the DeltaDesk wallet, Sat 2026-09-19 06:20 UTC;
// Base tx 0x309ddc0c…6708).
const safe = {
  pool: "NVDA/USDG", verdict: "CAUTION",
  reasons: [{ level: "CAUTION", reason: "US market closed: fair value is Hyperliquid's internal price, Chainlink is frozen" }],
  gap_bps: -9.517210563957606, fair_value: 222.23669929198303, pool_mid: 222.4483073181378, regime: "WEEKEND_DARK",
  reopen_window: false, next_regime_change: { at: 1789948205.7188716, regime: "WEEKEND_DARK", reopen_window: true, in_s: 149400 },
};
const s1 = report("safe-to-lp", safe);
check("safe-to-lp leads with verdict and reason", s1[0] === "CAUTION — NVDA/USDG: US market closed: fair value is Hyperliquid's internal price, Chainlink is frozen.");
check("safe-to-lp shows pool vs fair and the gap", has(s1, "Pool 222.4483 vs fair 222.2367 (-9.5 bp), regime WEEKEND_DARK."));
check("safe-to-lp says when conditions change (ET)", has(s1, "Conditions change Sun") && has(s1, "reopen window starts"));
check("safe-to-lp survives missing prices", has(report("safe-to-lp", { ...safe, pool_mid: null }), "Pool – vs fair"));

// Synthetic tearsheet summary (checkable by hand, not market data).
const summary = {
  n_positions: 2, n_open: 1, fees_usd: 80, lvr_hl_1h_usd: 50, il_usd: -30, gas_usd: 1, net_usd: 59, vs_hodl_usd: 49, edge_hl_1h: 1.6,
  per_1k: { fees: 8, lvr_hl_1h: 5, vs_hodl: 4.9 }, per_1k_per_day: { vs_hodl: 0.49 },
  residual: { reconciled_positions: 1, max_abs_residual_bp: 0.0011 },
};
const t1 = report("tearsheet", { owner: "0x2222222222222222222222222222222222222222", chain: "robinhood", summary });
check("tearsheet leads with the result vs holding", t1[0] === "Result vs simply holding the tokens: +$49.00 (+$0.49 per $1k per day), 2 positions (1 open).");
check("tearsheet: fees against informed flow", has(t1, "Fees +$80.00 against informed flow −$50.00"));
check("tearsheet: per $1k line", has(t1, "Per $1k of average capital: fees +$8.00, informed flow −$5.00, result vs holding +$4.90."));
check("tearsheet: edge and reconciliation", has(t1, "LP edge 1.60") && has(t1, "1 closed position reconciles to on-chain collected fees within 0.0011 bp."));
const t2 = report("tearsheet", { owner: "0x2", chain: "base", summary: { ...summary, lvr_hl_1h_usd: -5,
  aerodrome: { aero_usd: 20, fees_to_voters_usd: 3, staked_share: 0.5, aero_forfeited: 0, edge_hl_1h_incl_aero: null } } });
check("tearsheet: AERO shown on Base", has(t2, "Fees +$80.00 + AERO +$20.00"));
check("tearsheet: flow that lost on price prints as a gain", has(t2, "informed flow +$5.00"));
check("tearsheet: voters' share on Base", has(t2, "$3.00 of the fee share went to veAERO voters"));
check("tearsheet: no positions", has(report("tearsheet", { owner: "0x1", summary: null, positions: [] }), "No LP positions found"));

const tox = report("pool-toxicity", { pool: "NVDA/USDG", worst_hours_of_week: [{ how: 9, edge_1h: 0.25 }, { how: 57, edge_1h: 0.35 }], current_hour: { edge_1h: 1.5 } });
check("pool-toxicity names the worst hours in ET", tox[0] === "NVDA/USDG worst hours for LPs: Mon 09:00 ET (edge 0.25), Wed 09:00 ET (edge 0.35).");
const fv = report("fair-value", { pool: "NVDA/USDG", fair_value: 222.2, hl_price: 222.1, basis_k: 1.0005, pool_mid: 222.3, gap_bps: -2.1, chainlink: { price: 222.45, age_s: 67000 } });
check("fair-value flags a frozen Chainlink", has(fv, "(frozen while the market is closed)"));
const lg = report("lp-league", { rows: [{ rank: 1, manager: "0xabcdef0123456789", vs_hodl_per_1k_day: 193.2, edge_hl: 2.45, positions: 3, pools: "NVDA/USDG" }] });
check("lp-league row", lg[0].startsWith("1. 0xabcdef01…  +$193.20 per $1k·day vs holding, edge 2.45, 3 positions"));
check("error bodies say the caller was not charged", has(report("tearsheet", { error: "upstream 502" }), "You were not charged"));
check("unknown service is refused", report("nope", {}) === null);
check("endpoint URLs", url("safe-to-lp", { pool: "NVDA" }) === `${BASE}safe-to-lp?pool=NVDA` && POOLS.length === 4);

if (process.argv.includes("--live")) {
  const probes = {
    "safe-to-lp": { pool: "NVDA" }, "fair-value": { pool: "SPY" }, "pool-toxicity": { pool: "TSLA" },
    tearsheet: { wallet: "0x0000000000000000000000000000000000000001", chain: "base" }, "lp-league": { limit: "5" },
  };
  for (const [svc, params] of Object.entries(probes)) {
    try {
      const res = await fetch(url(svc, params), { signal: AbortSignal.timeout(20_000) });
      const a = ((await res.json().catch(() => ({}))).accepts || [])[0] || {};
      const want = String(Math.round(PRICES[svc] * 1e6));
      check(`live ${svc} asks for x402 payment at $${PRICES[svc]} USDC on Base`, res.status === 402 && a.amount === want && a.network === "eip155:8453", `HTTP ${res.status}, ${a.amount} on ${a.network}`);
    } catch (e) {
      check(`live ${svc} reachable`, false, String(e.message).slice(0, 80));
    }
  }
}

const failed = results.filter((r) => !r.pass);
for (const r of results) console.error(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
console.log(JSON.stringify({ ok: failed.length === 0, checks: results.length, failed: failed.map((f) => f.name) }));
process.exit(failed.length === 0 ? 0 : 1);
