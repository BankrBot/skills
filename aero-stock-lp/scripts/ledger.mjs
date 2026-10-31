#!/usr/bin/env node
// aero-stock-lp ledger: what the user's Aerodrome Slipstream positions on
// Base actually earned, split the way a market maker's books split it: fees
// kept + AERO emissions vs value taken by informed flow vs impermanent loss
// vs gas, per $1k. Staked and unstaked positions both count (staked liquidity
// is paid in AERO; its fees go to veAERO voters). Answers "I made $80 in
// fees, but how much did informed flow take back?"
//
// Two phases, because the data is paid per call over x402 and only Bankr can
// pay (the script holds no keys and makes no paid call):
//
//   ledger.mjs url    --wallet 0x… [--role auto|owner|operator]
//       -> {ok, call:{method,url,priceUsd}, report[], next}
//       Call `url` with Bankr's x402 capability ($0.05 USDC on Base; a failed
//       call is not charged) and save the JSON body to a file.
//   ledger.mjs report --wallet 0x… [--in tearsheet.json] [--token-id 1,2]
//                     [--open] [--all] [--state-path p]
//       -> {ok, totals, positions[], report[]}   (stdin works instead of --in)
//
// Data: DeltaDesk's tearsheet (https://web-production-10951.up.railway.app).
// It covers this skill's NVDA market (NVDAc/USDC); AAPL, GOOGL, META and AERO
// are reported as not covered yet, never silently dropped.

import fs from "node:fs";
import { MARKETS } from "./lib/markets.mjs";
import { loadState } from "./lib/positions.mjs";
import {
  TEARSHEET_PRICE_USD,
  METHOD_NOTE,
  REFRESH_NOTE,
  tearsheetUrl,
  parseTearsheet,
  buildLedger,
  renderLedger,
} from "./lib/ledger.mjs";
import { CHAIN, VENUE, COVERED } from "./lib/ledger-coverage.mjs";

const rest = process.argv.slice(2);
const cmd = rest[0] && !rest[0].startsWith("--") ? rest.shift() : null;
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const key = rest[i].slice(2);
    const next = rest[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else args[key] = true;
  }
}

function out(obj, code = 0) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(code);
}

const coveredMarkets = Object.values(COVERED).map((c) => c.market);
const coveredMap = Object.fromEntries(Object.entries(COVERED).map(([k, v]) => [k, v.market]));

function main() {
  if (cmd !== "url" && cmd !== "report") {
    out({ ok: false, gate: "args", detail: "usage: ledger.mjs url|report --wallet 0x… (see the header of this file)" }, 1);
  }
  const wallet = args.wallet;
  if (!wallet || wallet === true) out({ ok: false, gate: "args", detail: "--wallet required" }, 1);
  const role = typeof args.role === "string" ? args.role : "auto";

  let url;
  try {
    url = tearsheetUrl(wallet, { chain: CHAIN, role });
  } catch (e) {
    out({ ok: false, gate: "args", detail: e.message }, 1);
  }

  if (cmd === "url") {
    out({
      ok: true,
      call: { method: "GET", url, priceUsd: TEARSHEET_PRICE_USD, network: "base", asset: "USDC" },
      report: [`Pulling your DeltaDesk ledger: $${TEARSHEET_PRICE_USD.toFixed(2)} in USDC on Base, not charged if the call fails.`],
      next: `Call the url with Bankr's x402 capability (CLI: bankr x402 call '${url}' --max-payment ${TEARSHEET_PRICE_USD}), save the JSON body, then: node scripts/ledger.mjs report --wallet ${wallet} --in <file>`,
    });
  }

  // report
  let text;
  try {
    if (typeof args.in === "string") text = fs.readFileSync(args.in, "utf8");
    else if (!process.stdin.isTTY) text = fs.readFileSync(0, "utf8");
    else throw new Error("pass --in <saved response.json> or pipe the response on stdin");
  } catch (e) {
    out({ ok: false, gate: "input", detail: e.message }, 1);
  }
  let ts;
  try {
    ts = parseTearsheet(text, { wallet, chain: CHAIN });
  } catch (e) {
    out({ ok: false, gate: "tearsheet", detail: e.message, next: "Relay the detail in one line and stop; do not re-call in a loop." }, 1);
  }

  const tokenIds = typeof args["token-id"] === "string" ? args["token-id"].split(",").map((s) => s.trim()).filter(Boolean) : null;
  const ledger = buildLedger(ts, { covered: coveredMap, tokenIds, openOnly: args.open === true, all: args.all === true });

  // The skill's own book (state file): markets DeltaDesk does not cover yet,
  // and covered positions the tearsheet does not list yet (fresh mints).
  const state = loadState(args["state-path"]);
  const book = (state.positions || []).filter((p) => p && p.tokenId != null);
  const uncoveredHeld = [...new Set(book.map((p) => p.market).filter((m) => m && MARKETS[m] && !coveredMarkets.includes(m)))];
  const listed = new Set((ts.positions || []).map((p) => String(p.token_id)));
  const notYetListed = book
    .filter((p) => coveredMarkets.includes(p.market) && !listed.has(String(p.tokenId)))
    .map((p) => String(p.tokenId));

  const report = renderLedger(ledger, { wallet, venueName: VENUE, coveredMarkets, uncoveredHeld, notYetListed });
  out({
    ok: true,
    wallet: wallet.toLowerCase(),
    chain: CHAIN,
    source: { service: "DeltaDesk tearsheet (x402)", url, generatedUtc: ts.generated_utc ?? null, role: ts.role ?? role },
    coverage: { markets: coveredMarkets, otherPoolsInTearsheet: ledger.otherPools },
    totals: ledger.totals,
    positions: ledger.rows,
    report,
    notes: [METHOD_NOTE, REFRESH_NOTE],
    disclaimer: ts.disclaimer ?? "Informational analytics, not investment advice.",
  });
}

main();
