#!/usr/bin/env node
// Deterministic formatter for lp-truth responses: `node scripts/report.mjs <service> < response.json`.
// Prints the short report the agent relays nearly verbatim. Zero dependencies.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const bp = (x) => (num(x) === null ? "–" : `${x >= 0 ? "+" : ""}${x.toFixed(1)} bp`);
const px = (x, dp = 4) => (num(x) === null ? "–" : x.toFixed(dp));
const usd = (x, dp = 2) => {
  const v = num(x) ?? 0;
  return `${v < 0 ? "−" : "+"}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
};
// Value picked off BY informed flow is a loss to LPs; a negative figure means the flow lost on price (paid the LPs).
const flow = (x) => usd(-(num(x) ?? 0));
const pct = (x) => (num(x) === null ? "–" : `${(100 * x).toFixed(0)}%`);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const SERVICES = ["safe-to-lp", "fair-value", "pool-toxicity", "tearsheet", "lp-league"];

export function report(service, r) {
  if (!SERVICES.includes(service)) return null;
  const out = [];
  if (!r || typeof r !== "object") return [`Couldn't read the ${service} response. You were not charged for a failed call.`];
  if (r.error) return [`Couldn't get ${service}: ${r.error}. You were not charged.`];
  if (service === "safe-to-lp") {
    const top = r.reasons?.find((x) => x.level === r.verdict) ?? r.reasons?.[0];
    out.push(`${r.verdict} — ${r.pool}: ${top?.reason ?? "no issues"}.`);
    out.push(`Pool ${px(r.pool_mid)} vs fair ${px(r.fair_value)} (${bp(r.gap_bps)}), regime ${r.regime}.`);
    if (r.verdict !== "ALLOW" && r.next_regime_change?.at) {
      const at = new Date(r.next_regime_change.at * 1000).toLocaleString("en-US", {
        timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit",
      });
      out.push(`Conditions change ${at} ET (${r.next_regime_change.reopen_window ? "reopen window starts" : r.next_regime_change.regime}).`);
    }
  } else if (service === "fair-value") {
    out.push(`${r.pool}: fair ${px(r.fair_value)} (Hyperliquid ${r.hl_price} × ${px(r.basis_k, 5)}), pool ${px(r.pool_mid)} (${bp(r.gap_bps)}).`);
    const cl = r.chainlink;
    if (cl && num(cl.price) !== null && num(cl.age_s) !== null) {
      out.push(`Chainlink ${cl.price.toFixed(2)}, last updated ${(cl.age_s / 3600).toFixed(1)} h ago${cl.age_s > 3600 ? " (frozen while the market is closed)" : ""}.`);
    }
  } else if (service === "pool-toxicity") {
    const worst = (r.worst_hours_of_week ?? []).slice(0, 3).map((h) => {
      const d = DAYS[Math.floor(h.how / 24)];
      return `${d} ${String(h.how % 24).padStart(2, "0")}:00 ET (edge ${num(h.edge_1h) === null ? "–" : h.edge_1h.toFixed(2)})`;
    });
    out.push(`${r.pool} worst hours for LPs: ${worst.join(", ") || "none recorded"}.`);
    if (num(r.current_hour?.edge_1h) !== null) out.push(`This hour historically: edge ${r.current_hour.edge_1h.toFixed(2)} (fees ÷ value picked off).`);
  } else if (service === "tearsheet") {
    const s = r.summary;
    if (!s) {
      out.push(`No LP positions found for ${r.owner} on ${r.chain ?? "robinhood"}. Positions opened in the last hour may not be rebuilt yet.`);
    } else {
      const a = s.aerodrome;
      const aero = a && num(a.aero_usd) > 0;
      out.push(`Result vs simply holding the tokens: ${usd(s.vs_hodl_usd)} (${usd(s.per_1k_per_day?.vs_hodl)} per $1k per day), ${plural(s.n_positions, "position")}${s.n_open ? ` (${s.n_open} open)` : ""}.`);
      out.push(`Fees ${usd(s.fees_usd)}${aero ? ` + AERO ${usd(a.aero_usd)}` : ""} against informed flow ${flow(s.lvr_hl_1h_usd)} (picked off within 1h, vs Hyperliquid); impermanent loss vs holding ${usd(s.il_usd)}, gas ${usd(-Math.abs(num(s.gas_usd) ?? 0))}. Net including stock price moves ${usd(s.net_usd)}.`);
      const k = s.per_1k;
      if (k) out.push(`Per $1k of average capital: fees ${usd(k.fees)}${aero ? `, AERO ${usd(k.aero)}` : ""}, informed flow ${flow(k.lvr_hl_1h)}, result vs holding ${usd(k.vs_hodl)}.`);
      const e = a ? a.edge_hl_1h_incl_aero : s.edge_hl_1h;
      if (num(e) !== null) out.push(`LP edge ${e.toFixed(2)}${aero ? " incl. AERO" : ""} (income ÷ value picked off; above 1 = earned more than informed flow took).`);
      if (a && num(a.fees_to_voters_usd) > 0) {
        out.push(`Staked ${pct(a.staked_share)} of the time: ${usd(a.fees_to_voters_usd).slice(1)} of the fee share went to veAERO voters${num(a.aero_forfeited) > 0 ? `, ${a.aero_forfeited.toFixed(1)} AERO forfeited by withdrawing within 5 minutes of staking` : ""}.`);
      }
      const res = s.residual;
      if (res?.reconciled_positions && num(res.max_abs_residual_bp) !== null) {
        out.push(`${plural(res.reconciled_positions, "closed position")} reconcile${res.reconciled_positions === 1 ? "s" : ""} to on-chain collected fees within ${res.max_abs_residual_bp.toFixed(4)} bp.`);
      }
    }
  } else if (service === "lp-league") {
    for (const row of (r.rows ?? []).slice(0, 5)) {
      out.push(`${row.rank}. ${String(row.manager).slice(0, 10)}…  ${usd(row.vs_hodl_per_1k_day)} per $1k·day vs holding, edge ${num(row.edge_hl) === null ? "–" : row.edge_hl.toFixed(2)}, ${plural(row.positions, "position")} (${row.pools})`);
    }
    if (!out.length) out.push("The LP League is empty right now.");
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const service = process.argv[2];
  let r;
  try {
    r = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    r = null;
  }
  const lines = report(service, r);
  if (lines === null) {
    console.log(`unknown service ${service}`);
    process.exitCode = 2;
  } else {
    console.log(lines.join("\n"));
  }
}
