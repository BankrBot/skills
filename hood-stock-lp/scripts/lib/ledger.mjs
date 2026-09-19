// The DeltaDesk ledger: what an LP position actually earned, split the way a
// market maker's books split it (fees vs value taken by informed flow vs
// impermanent loss vs gas, per $1k).
//
// The numbers come from DeltaDesk's tearsheet endpoint, sold per call over
// x402 ($0.05 USDC on Base, paid by Bankr's x402 capability; a failed call is
// not charged). DeltaDesk rebuilds every position in its covered pools from
// chain logs, marks every swap against Hyperliquid's 24/7 price, and
// reconciles fees to on-chain collects. Method and source:
// https://web-production-10951.up.railway.app (Study, Tearsheet, League).
//
// Pure functions only (no network, no keys): ledger.mjs builds the URL, the
// agent pays for and saves the response, this module turns it into the
// ledger. Zero dependencies.

export const DELTADESK_X402 =
  "https://x402.bankr.bot/0xd8d5b9389721258bcdfa7ac1306af6330e5634cd/";
export const TEARSHEET_PRICE_USD = 0.05;
export const TEARSHEET_PRICE_ATOMIC = "50000"; // USDC, 6 decimals
export const REFRESH_NOTE =
  "DeltaDesk rebuilds positions about once an hour, so a position opened in the last hour may not show yet.";
export const METHOD_NOTE =
  "Informed flow = value picked off by traders who knew better, marked against Hyperliquid's price 1 hour after each swap. It explains the result; it is not an extra cost on top of it.";

const ADDR = /^0x[0-9a-fA-F]{40}$/;
const ROLES = ["auto", "owner", "operator"];

export function tearsheetUrl(wallet, { chain, role = "auto" }) {
  if (!ADDR.test(String(wallet))) throw new Error("wallet must be a 0x address (40 hex chars)");
  if (!ROLES.includes(role)) throw new Error(`role must be one of ${ROLES.join(", ")}`);
  const q = new URLSearchParams({ wallet: wallet.toLowerCase(), chain, role });
  return `${DELTADESK_X402}tearsheet?${q}`;
}

// Throws with a plain-language message when the saved response is not a
// tearsheet for this wallet and chain (wrong file, an error body, …).
export function parseTearsheet(text, { wallet, chain }) {
  let ts;
  try {
    ts = typeof text === "string" ? JSON.parse(text) : text;
  } catch {
    throw new Error("the saved response is not JSON; save the x402 response body as returned");
  }
  if (!ts || typeof ts !== "object") throw new Error("the saved response is empty");
  if (ts.error) {
    throw new Error(`DeltaDesk returned an error (${ts.error}); x402 does not charge failed calls`);
  }
  if (typeof ts.owner !== "string" || !("summary" in ts) || !Array.isArray(ts.positions)) {
    throw new Error("the saved response is not a DeltaDesk tearsheet (no owner/summary/positions)");
  }
  if (ts.owner.toLowerCase() !== String(wallet).toLowerCase()) {
    throw new Error(`the tearsheet is for ${ts.owner}, not ${wallet}`);
  }
  if (ts.chain && ts.chain !== chain) {
    throw new Error(`the tearsheet is for chain ${ts.chain}, this skill reads ${chain}`);
  }
  return ts;
}

const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
const numOrNull = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const ratio = (a, b) => (b > 0 ? a / b : null);

// One ledger row per tearsheet position.
export function ledgerRow(p, market) {
  const informedHl = numOrNull(p.lvr_hl_1h_usd);
  const informed = informedHl ?? num(p.lvr_self_1h_usd);
  const aero = num(p.aero_usd);
  const notional = num(p.avg_notional_usd);
  const days = numOrNull(p.active_days) ?? numOrNull(p.lifetime_days) ?? 0;
  const k = notional > 0 ? 1000 / notional : null;
  const row = {
    market,
    pool: p.pool,
    tokenId: p.token_id ?? null,
    status: p.status,
    openedUtc: p.opened_utc ?? null,
    closedUtc: p.closed_utc ?? null,
    days,
    avgNotionalUsd: notional,
    feesUsd: num(p.fees_usd),
    aeroUsd: aero,
    feesToVotersUsd: num(p.fees_to_voters_usd),
    informedFlowUsd: informed,
    informedFlowReference: informedHl !== null ? "hyperliquid-1h" : "self-1h",
    ilUsd: num(p.il_usd),
    gasUsd: num(p.gas_usd),
    vsHoldUsd: num(p.vs_hodl_usd),
    pricePnlUsd: num(p.price_pnl_usd),
    netUsd: num(p.net_usd),
    edge: ratio(num(p.fees_usd) + aero, informed),
    residualBp: numOrNull(p.residual_bp),
  };
  row.per1k =
    k === null
      ? null
      : {
          fees: row.feesUsd * k,
          aero: row.aeroUsd * k,
          informedFlow: row.informedFlowUsd * k,
          il: row.ilUsd * k,
          gas: row.gasUsd * k,
          vsHold: row.vsHoldUsd * k,
        };
  return row;
}

// Select the positions this skill covers and total them.
//   covered   { tearsheet pool key -> market symbol }
//   tokenIds  optional list: only these positions
//   openOnly  only positions still open
//   all       every position in the tearsheet, covered by this skill or not
export function buildLedger(ts, { covered, tokenIds = null, openOnly = false, all = false }) {
  const want = tokenIds && tokenIds.length ? new Set(tokenIds.map(String)) : null;
  const rows = [];
  const otherPools = new Set();
  for (const p of ts.positions || []) {
    const market = covered[p.pool] ?? (all ? p.pool : null);
    if (!market) {
      otherPools.add(p.pool);
      continue;
    }
    if (want && !want.has(String(p.token_id))) continue;
    if (openOnly && p.status !== "open") continue;
    rows.push(ledgerRow(p, market));
  }
  rows.sort((a, b) => (a.status === b.status ? b.feesUsd - a.feesUsd : a.status === "open" ? -1 : 1));
  const sum = (f) => rows.reduce((s, r) => s + r[f], 0);
  const capitalDays = rows.reduce((s, r) => s + r.avgNotionalUsd * r.days, 0);
  const kd = capitalDays > 0 ? 1000 / capitalDays : null;
  const totals = {
    positions: rows.length,
    open: rows.filter((r) => r.status === "open").length,
    feesUsd: sum("feesUsd"),
    aeroUsd: sum("aeroUsd"),
    feesToVotersUsd: sum("feesToVotersUsd"),
    informedFlowUsd: sum("informedFlowUsd"),
    ilUsd: sum("ilUsd"),
    gasUsd: sum("gasUsd"),
    vsHoldUsd: sum("vsHoldUsd"),
    pricePnlUsd: sum("pricePnlUsd"),
    netUsd: sum("netUsd"),
    capitalDaysUsd: capitalDays,
  };
  totals.edge = ratio(totals.feesUsd + totals.aeroUsd, totals.informedFlowUsd);
  totals.per1kPerDay =
    kd === null
      ? null
      : {
          fees: totals.feesUsd * kd,
          aero: totals.aeroUsd * kd,
          informedFlow: totals.informedFlowUsd * kd,
          vsHold: totals.vsHoldUsd * kd,
        };
  const reconciled = rows.filter((r) => r.status === "closed" && r.residualBp !== null);
  totals.reconciled = {
    positions: reconciled.length,
    maxAbsResidualBp: reconciled.length ? Math.max(...reconciled.map((r) => Math.abs(r.residualBp))) : null,
  };
  return { rows, totals, otherPools: [...otherPools].sort() };
}

// ---------- the few lines the agent relays ----------

export function usd(x, dp = 2) {
  const v = num(x);
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return `${v < 0 ? "−" : "+"}$${s}`;
}
const cost = (x) => usd(-Math.abs(num(x))); // a cost line always prints as −$x
// Value picked off BY informed flow prints as a loss; negative means takers lost on
// price (the flow paid the LP), which prints as a gain.
const flow = (x) => usd(-num(x));
const edgeText = (e, aero) => (e === null ? "" : ` (edge ${e.toFixed(2)}${aero ? " incl. AERO" : ""})`);
const idText = (r) => (r.tokenId ? `#${r.tokenId}` : "(direct position)");
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function renderLedger(ledger, { wallet, venueName, coveredMarkets, uncoveredHeld = [], notYetListed = [], maxRows = 3 }) {
  const { rows, totals: t } = ledger;
  const aero = t.aeroUsd > 0;
  const lines = [];
  if (!rows.length) {
    lines.push(
      `No ${coveredMarkets.join("/")} LP positions for ${short(wallet)} in DeltaDesk's ${venueName} data yet. ${REFRESH_NOTE}`
    );
  } else {
    lines.push(
      `Ledger for ${short(wallet)} on ${venueName}: ${t.positions} position${t.positions === 1 ? "" : "s"}${t.open ? ` (${t.open} open)` : ""}, result vs simply holding ${usd(t.vsHoldUsd)}.`
    );
    lines.push(
      `Fees ${usd(t.feesUsd)}${aero ? ` + AERO ${usd(t.aeroUsd)}` : ""} against informed flow ${flow(t.informedFlowUsd)}${edgeText(t.edge, aero)}; impermanent loss vs holding ${usd(t.ilUsd)}, gas ${cost(t.gasUsd)}.`
    );
    if (t.per1kPerDay) {
      const k = t.per1kPerDay;
      lines.push(
        `Per $1k of capital per day: fees ${usd(k.fees)}${aero ? `, AERO ${usd(k.aero)}` : ""}, informed flow ${flow(k.informedFlow)}, result vs holding ${usd(k.vsHold)}.`
      );
    }
    for (const r of rows.slice(0, maxRows)) {
      const per = r.per1k ? ` Per $1k deployed: ${usd(r.per1k.vsHold)} vs holding.` : "";
      lines.push(
        `${r.market} ${idText(r)} ${r.status}: fees ${usd(r.feesUsd)}${r.aeroUsd ? `, AERO ${usd(r.aeroUsd)}` : ""}, informed flow ${flow(r.informedFlowUsd)}${edgeText(r.edge, r.aeroUsd > 0)}, vs holding ${usd(r.vsHoldUsd)}.${per}`
      );
    }
    if (rows.length > maxRows) lines.push(`…and ${rows.length - maxRows} more (every position is in "positions").`);
    if (t.feesToVotersUsd > 0) {
      lines.push(
        `${usd(t.feesToVotersUsd).slice(1)} of the fee share went to veAERO voters (all fees earned while staked, which is paid in AERO instead, plus the pool's cut of unstaked fees).`
      );
    }
    if (t.reconciled.positions) {
      lines.push(
        `${t.reconciled.positions} closed position${t.reconciled.positions === 1 ? "" : "s"} reconcile${t.reconciled.positions === 1 ? "s" : ""} to on-chain collected fees within ${t.reconciled.maxAbsResidualBp.toFixed(4)} bp.`
      );
    }
  }
  if (uncoveredHeld.length) {
    lines.push(
      `Not in the ledger yet: ${uncoveredHeld.join(", ")} (DeltaDesk covers ${coveredMarkets.join(", ")} on ${venueName} today).`
    );
  }
  if (notYetListed.length && rows.length) {
    lines.push(`Not listed yet: ${notYetListed.map((x) => `#${x}`).join(", ")}. ${REFRESH_NOTE}`);
  }
  return lines;
}
