#!/usr/bin/env node
// Borro for Bankr: reads Borro (the stock lending market on Robinhood Chain, 4663), asks Borro's MCP server for
// unsigned transactions, checks every one against known-contracts.json, and prints them ready for Bankr's
// POST /wallet/submit. It never signs, never holds a key and never broadcasts: Bankr does that.
//
// Node 18 or later, no dependencies. Every command prints one JSON object; check `ok` first.
//
//   node borro.mjs read markets                       # every stock and the USDG vault (the /markets.json feed)
//   node borro.mjs read market --symbol NVDA          # one stock (MCP)
//   node borro.mjs read position --wallet 0x...       # what a wallet has on Borro (MCP)
//   node borro.mjs read health --wallet 0x...         # shorts and loans, worst first (the /health feed)
//   node borro.mjs read credit_markets                # AI credit line markets (the /credit.json feed)
//   node borro.mjs plan supply --wallet 0x... --asset NVDA --amount 1.5
//   node borro.mjs plan withdraw --wallet 0x... --asset USDG --all
//   node borro.mjs plan open_short --wallet 0x... --symbol TSLA --amount 0.5 --deposit 100
//   node borro.mjs plan close_short --wallet 0x... --symbol TSLA
//   node borro.mjs plan credit_open --wallet 0x... --market rCREDIT --agent 0x... --credits 50 --ceiling 30 --daily_limit 20
//   node borro.mjs lend --wallet 0x... --asset NVDA --amount 1.5 --code bankr   # through Bookrunners (BorroBuilders)
//   node borro.mjs code bankr                         # is a bookrunner code registered?
//   node borro.mjs bind --wallet 0x... --code bankr   # typed data that credits the wallet's borrowing to a code
//   node borro.mjs validate answer.json --action supply --wallet 0x... --asset NVDA   # check an MCP answer you got
//   node borro.mjs selftest                           # offline: pins and encoders
//
// Environment (all optional):
//   BORRO_RPC_URL  your own Robinhood Chain RPC. Used only by `lend` (previewDeposit and a simulation). There is no
//                  default and the skill never falls back to a public RPC. Without it, `lend` needs --preview-shares.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const K = JSON.parse(readFileSync(join(HERE, "..", "known-contracts.json"), "utf8"));
const MCP_URL = K.endpoints.mcp;
const API = K.endpoints.api;
const RPC = process.env.BORRO_RPC_URL || "";
const CHAIN = K.chainId;
const TAG = K.agentTag.slice(2).toLowerCase(); // "BORROMCP", appended by Borro's MCP to every call it builds
const S = K.selectors;
const MAX = (1n << 256n) - 1n;
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

class SkillError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; this.extra = extra; }
}
const fail = (code, message, extra) => { throw new SkillError(code, message, extra); };

// ------------------------------------------------------------------ small helpers

const lc = (a) => String(a || "").toLowerCase();
const same = (a, b) => lc(a) === lc(b);
const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || ""));
const hex = (d) => lc(d).replace(/^0x/, "");
const pad = (h) => h.padStart(64, "0");
const encAddr = (a) => pad(hex(a));
const encUint = (n) => { const b = BigInt(n); if (b < 0n || b > MAX) fail("BAD_NUMBER", "number out of range"); return pad(b.toString(16)); };
const encCode = (code) => Buffer.from(code, "ascii").toString("hex").padEnd(64, "0");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function units(amount, decimals) {
  const s = String(amount ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(s)) fail("BAD_AMOUNT", `amount must be a plain decimal like "1.5", got "${s}"`);
  const [w, f = ""] = s.split(".");
  if (f.length > decimals) fail("BAD_AMOUNT", `at most ${decimals} decimals`);
  return BigInt(w + f.padEnd(decimals, "0"));
}
function fmt(raw, decimals) {
  const s = BigInt(raw).toString().padStart(decimals + 1, "0");
  const w = s.slice(0, s.length - decimals), f = s.slice(s.length - decimals).replace(/0+$/, "");
  return f ? `${w}.${f}` : w;
}

// The ABI words of a call, with the selector and Borro's 8-byte agent tag taken off.
function call(data) {
  const h = hex(data);
  if (!/^[0-9a-f]*$/.test(h) || h.length < 8) fail("BAD_CALLDATA", "calldata is not hex");
  let body = h.slice(8);
  const tagged = body.length % 64 === 16 && body.endsWith(TAG);
  if (tagged) body = body.slice(0, -16);
  if (body.length % 64 !== 0) fail("BAD_CALLDATA", "calldata is not whole ABI words");
  const word = (i) => { const w = body.slice(i * 64, i * 64 + 64); if (w.length !== 64) fail("BAD_CALLDATA", "calldata too short"); return w; };
  return {
    selector: "0x" + h.slice(0, 8), tagged,
    uint: (i) => BigInt("0x" + word(i)),
    addr: (i) => { const w = word(i); if (!/^0{24}/.test(w)) fail("BAD_CALLDATA", "not an address word"); return "0x" + w.slice(24); },
    word: (i) => "0x" + word(i),
  };
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) out[k] = true; else { out[k] = v; i++; }
    } else out._.push(a);
  }
  return out;
}

// ------------------------------------------------------------------ Borro's MCP server and feeds

let rpcId = 1;
async function mcp(name, a) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method: "tools/call", params: { name, arguments: a } });
  let last;
  // A 5xx (Cloudflare "error code: 1101", a request the Worker runtime cancelled, comes in bursts) is retried three
  // times. These are reads and unsigned builds, so a retry can never send anything.
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(MCP_URL, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body });
      if (r.status >= 500) { last = new SkillError("MCP_UNAVAILABLE", `Borro's MCP answered HTTP ${r.status}`); await sleep(1500 * (i + 1)); continue; }
      const j = await r.json();
      if (j.error) fail("MCP_ERROR", j.error.message || "MCP error");
      const res = j.result || {};
      const text = res.content && res.content[0] && res.content[0].text;
      if (res.isError) fail("BORRO_REFUSED", String(text || "refused"), { tool: name });
      if (res.structuredContent) return res.structuredContent;
      try { return JSON.parse(text); } catch { return text; }
    } catch (e) {
      if (e instanceof SkillError && e.code !== "MCP_UNAVAILABLE") throw e;
      last = e instanceof SkillError ? e : new SkillError("MCP_UNAVAILABLE", String(e.message || e));
      await sleep(1500 * (i + 1));
    }
  }
  throw last;
}

async function feed(path) {
  const r = await fetch(API + path, { headers: { accept: "application/json" } });
  if (!r.ok) fail("FEED_UNAVAILABLE", `${path} answered HTTP ${r.status}`);
  return r.json();
}

// ------------------------------------------------------------------ the user's own RPC (optional, `lend` only)

let rpcChecked = false;
async function rpc(method, params) {
  if (!RPC) fail("NO_RPC", "BORRO_RPC_URL is not set");
  let j;
  try {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }) });
    j = await r.json();
  } catch (e) {
    fail("RPC_ERROR", `BORRO_RPC_URL could not be reached or did not answer JSON-RPC (${String(e.message || e).slice(0, 80)}). Unset it to use --preview-shares instead.`);
  }
  if (j.error) { const e = new SkillError("RPC_ERROR", String(j.error.message || "RPC error").slice(0, 200)); e.rpcCode = j.error.code; throw e; }
  return j.result;
}
async function chainOk() {
  if (rpcChecked) return;
  const id = parseInt(await rpc("eth_chainId", []), 16);
  if (id !== CHAIN) fail("WRONG_CHAIN", `BORRO_RPC_URL is on chain ${id}, not Robinhood Chain ${CHAIN}`);
  rpcChecked = true;
}

// Multicall3 aggregate3 by hand: one eth_call for several reads (allowFailure true on each).
function encAggregate3(calls) {
  const n = calls.length;
  const elems = calls.map((c) => {
    const d = hex(c.data);
    const len = d.length / 2;
    return encAddr(c.to) + encUint(1) + encUint(0x60) + encUint(len) + d.padEnd(Math.ceil(len / 32) * 64, "0");
  });
  let off = n * 32, head = "";
  for (const e of elems) { head += encUint(off); off += e.length / 2; }
  return "0x82ad56cb" + encUint(0x20) + encUint(n) + head + elems.join("");
}
async function aggregate3(calls) {
  return decAggregate3(await rpc("eth_call", [{ to: MULTICALL3, data: encAggregate3(calls) }, "latest"]));
}
function decAggregate3(raw) {
  const ret = hex(raw);
  const at = (byte) => BigInt("0x" + ret.slice(byte * 2, byte * 2 + 64));
  const base = Number(at(0)), count = Number(at(base));
  const out = [];
  for (let i = 0; i < count; i++) {
    const e = base + 32 + Number(at(base + 32 + i * 32));
    const ok = at(e) === 1n;
    const p = e + Number(at(e + 32));
    const len = Number(at(p));
    out.push({ ok, data: "0x" + ret.slice((p + 32) * 2, (p + 32 + len) * 2) });
  }
  return out;
}

// ------------------------------------------------------------------ what each step may be

const ERRORS = {
  "0x5d1c3036": "BadVault: BorroBuilders does not take deposits into this vault",
  "0xaba47339": "NotRegistered: nobody has registered this bookrunner code",
  "0xe2ce129e": "TooFewShares: the vault would give fewer shares than the minimum; build it again",
  "0xf9820cc1": "Nothing: the amount is zero",
  "0xe450d38c": "ERC20InsufficientBalance: the wallet does not hold that much",
  "0xfb8f41b2": "ERC20InsufficientAllowance: the approval is missing or too small",
};
function revertText(data) {
  const h = hex(data);
  const sel = "0x" + h.slice(0, 8);
  if (ERRORS[sel]) return ERRORS[sel];
  if (sel === "0x08c379a0" && h.length >= 136) {
    const len = parseInt(h.slice(72, 136), 16);
    return Buffer.from(h.slice(136, 136 + len * 2), "hex").toString("utf8");
  }
  return h ? `reverted (${sel})` : "reverted";
}

function stock(sym) {
  const s = K.stocks[String(sym || "").toUpperCase()];
  if (!s) fail("UNKNOWN_ASSET", `${sym} is not a Borro stock in this skill (${Object.keys(K.stocks).join(", ")})`);
  return { symbol: String(sym).toUpperCase(), ...s };
}
function asset(sym) {
  if (String(sym || "").toUpperCase() === "USDG") return { symbol: "USDG", token: K.usdg.token, vault: K.usdg.vault, decimals: 6, bookrunner_deposits: K.usdg.bookrunner_deposits };
  return stock(sym);
}
function creditMarket(sym) {
  const name = Object.keys(K.credit_markets).find((k) => same(k, sym || "CREDIT"));
  if (!name) fail("UNKNOWN_MARKET", `${sym} is not a credit market in this skill (${Object.keys(K.credit_markets).join(", ")})`);
  return { symbol: name, ...K.credit_markets[name] };
}
function approval(tx, token, spender) {
  const c = call(tx.data);
  if (c.selector !== S.approve) fail("UNEXPECTED_STEP", `step ${tx.step}: expected an approval`);
  if (!same(tx.to, token)) fail("UNEXPECTED_TARGET", `step ${tx.step}: approval on ${tx.to}, expected ${token}`);
  if (!same(c.addr(0), spender)) fail("UNEXPECTED_SPENDER", `step ${tx.step}: approves ${c.addr(0)}, expected ${spender}`);
  const amount = c.uint(1);
  if (amount === MAX) fail("UNLIMITED_APPROVAL", `step ${tx.step}: unlimited approvals are never sent`);
  return amount;
}
const isApprove = (tx) => hex(tx.data).startsWith(S.approve.slice(2));
function only(cond, msg) { if (!cond) fail("UNEXPECTED_STEP", msg); }
function need(cond, msg) { if (!cond) fail("BAD_ARGS", msg); }

// Checks the MCP's transactions for one action, step by step. Throws on anything not exactly expected.
async function check(action, a, wallet, txs) {
  only(Array.isArray(txs) && txs.length > 0, "the plan has no transactions");
  for (const tx of txs) {
    if (Number(tx.chainId) !== CHAIN) fail("WRONG_CHAIN", `step ${tx.step} is for chain ${tx.chainId}`);
    if (String(tx.value) !== "0") fail("UNEXPECTED_VALUE", `step ${tx.step} sends ETH`);
    if (!isAddr(tx.to)) fail("UNEXPECTED_TARGET", `step ${tx.step} has no valid target`);
    if (!call(tx.data).tagged) fail("NOT_FROM_BORRO", `step ${tx.step} does not carry Borro's MCP tag: it was not built by Borro's MCP or it was edited`);
  }
  const last = txs[txs.length - 1], pre = txs.slice(0, -1);
  const lastCall = call(last.data);
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (action === "supply") {
    only(!a.post, "lend and post is not part of this skill; use the Borro app");
    const x = asset(a.asset);
    only(same(last.to, x.vault) && lastCall.selector === S["vault.deposit"], `the last step must be a deposit into the ${x.symbol} vault`);
    only(same(lastCall.addr(1), wallet), "the deposit must credit the wallet itself");
    const amount = lastCall.uint(0);
    only(pre.length <= 1, "unexpected extra steps");
    if (pre.length) only(approval(pre[0], x.token, x.vault) === amount, "the approval must equal the deposit exactly");
    return { asset: x.symbol, vault: x.vault, token: x.token, units: amount, amount: fmt(amount, x.decimals) };
  }
  if (action === "withdraw") {
    const x = asset(a.asset);
    only(txs.length === 1 && same(last.to, x.vault), `a withdrawal is one call to the ${x.symbol} vault`);
    only(lastCall.selector === S["vault.withdraw"] || lastCall.selector === S["vault.redeem"], "unexpected withdrawal call");
    only(same(lastCall.addr(1), wallet) && same(lastCall.addr(2), wallet), "a withdrawal must pay and debit the wallet itself");
    return { asset: x.symbol, vault: x.vault };
  }
  if (action === "open_short" || action === "close_short") {
    const x = stock(a.symbol);
    only(same(last.to, K.contracts.BorroShort), "the last step must be a BorroShort call");
    const want = action === "open_short" ? S["BorroShort.open"] : S["BorroShort.close"];
    only(lastCall.selector === want, `unexpected BorroShort call for ${action}`);
    only(same(lastCall.word(0), x.short_market_id), `the short must be in ${x.symbol}'s own market`);
    only(pre.length <= 1, "unexpected extra steps");
    if (action === "open_short") {
      only(lastCall.uint(3) > 0n, "the short has no minimum sale price");
      only(lastCall.uint(4) > now, "the short's deadline has passed: build it again");
      if (pre.length) only(approval(pre[0], K.usdg.token, K.contracts.BorroShort) === lastCall.uint(1), "the approval must equal the deposit exactly");
    } else if (pre.length) approval(pre[0], K.usdg.token, K.contracts.BorroShort);
    return { symbol: x.symbol };
  }
  if (action === "credit_open" && !a.account) {
    const m = creditMarket(a.market);
    only(same(last.to, K.contracts.AgentCreditFactory) && lastCall.selector === S["AgentCreditFactory.open"], "the last step must be the factory's open");
    only(same(lastCall.word(0), m.market_id), `the line must open in the ${m.symbol} market`);
    const agent = lastCall.addr(5);
    only(!same(agent, wallet), "the agent can never be the owner's own wallet");
    if (a.agent) only(same(agent, a.agent), "the line names another agent than asked");
    // open(marketId, limits, credits, borrowUsdg, borrowTo): borrowTo is used only when borrowUsdg is not zero.
    if (lastCall.uint(3) > 0n) only(same(lastCall.addr(4), a.to || wallet), "the first borrow would pay someone other than asked");
    else only(!a.borrow || Number(a.borrow) === 0, "the line would open without the borrow asked for");
    if (!a.borrow || Number(a.borrow) === 0) only(lastCall.uint(3) === 0n, "the line would borrow though no borrow was asked for");
    only(pre.length <= 1, "unexpected extra steps");
    if (pre.length) only(approval(pre[0], m.token, K.contracts.AgentCreditFactory) === lastCall.uint(2), "the approval must equal the credits posted exactly");
    return { market: m.symbol, agent };
  }
  if (action === "credit_open" || action === "credit_pay" || action === "credit_repay") {
    // An existing line: it must be a line Borro reads for this wallet (as its owner or its agent).
    need(isAddr(a.account), "account (the line's address) is required");
    const view = await mcp("credit_line", { account: a.account });
    const line = view && (view.line || view);
    const owner = line && (line.owner || (line.roles && line.roles.owner)), agent = line && (line.agent || (line.roles && line.roles.agent));
    only(line && (same(owner, wallet) || same(agent, wallet)), "Borro does not show this line as the wallet's (owner or agent)");
    let market = null;
    for (const [sym, m] of Object.entries(K.credit_markets)) if (same(line.market, sym)) market = { symbol: sym, ...m };
    only(market, "the line is in a market this skill does not know");
    const allowedLine = action === "credit_open" ? [S["line.deposit"], S["line.borrow"]]
      : action === "credit_pay" ? [S["line.borrow"]] : [S["line.repay"], S["line.close"], S["line.sellAndRepay"]];
    for (const tx of txs) {
      if (isApprove(tx)) {
        const tok = action === "credit_repay" ? K.usdg.token : market.token;
        approval(tx, tok, a.account);
        continue;
      }
      only(same(tx.to, a.account), `step ${tx.step} goes to ${tx.to}, not the line`);
      const c = call(tx.data);
      only(allowedLine.includes(c.selector), `step ${tx.step}: a line call this skill does not send`);
      if (c.selector === S["line.borrow"]) only(a.to ? same(c.addr(1), a.to) : same(c.addr(1), wallet) || same(c.addr(1), owner), "the borrow pays someone other than asked");
      if (c.selector === S["line.close"]) only(same(c.addr(0), wallet), "closing must send everything back to the wallet");
    }
    return { account: a.account, market: market.symbol };
  }
  fail("NOT_IN_SKILL", `${action} is not part of this skill`);
}

const PREPARE = ["supply", "withdraw", "open_short", "close_short", "credit_open", "credit_pay", "credit_repay"];

// The exact bodies for Bankr's POST /wallet/submit, in order. `gas` is pinned per call (known-contracts.json "gas"):
// Morpho Vault V2 accrues interest lazily, so a plain estimate can run out of gas.
function bankrBodies(txs) {
  return txs.map((t) => {
    const gas = K.gas["0x" + hex(t.data).slice(0, 8)];
    return { transaction: { to: t.to, data: t.data, value: "0", chainId: CHAIN, ...(gas ? { gas } : {}) }, description: t.description, waitForConfirmation: true };
  });
}

// ------------------------------------------------------------------ commands

async function cmdRead(tool, a) {
  const w = a.wallet;
  switch (tool) {
    case "markets": return feed("/markets.json");
    case "credit_markets": return feed("/credit.json");
    case "prices": return feed("/prices.json");
    case "bookrunners": return feed("/builders.json");
    case "health": need(isAddr(w), "wallet is required"); return feed(`/health/${lc(w)}.json`);
    case "market": return mcp("market", { symbol: String(a.symbol || "").toUpperCase() });
    case "position": need(isAddr(w), "wallet is required"); return mcp("position", { wallet: w });
    case "credit_line": return mcp("credit_line", a.account ? { account: a.account } : { owner: a.owner || w, page: a.page ? Number(a.page) : undefined });
    case "rules": return mcp("rules", {});
    case "trades": return feed("/trades.json");
    default: fail("NOT_IN_SKILL", `read ${tool} is not part of this skill (markets, market, position, health, prices, credit_markets, credit_line, bookrunners, rules, trades)`);
  }
}

function mcpArgs(tool, a) {
  const pick = { supply: ["wallet", "asset", "amount"], withdraw: ["wallet", "asset", "amount", "all"],
    open_short: ["wallet", "symbol", "amount", "deposit"], close_short: ["wallet", "symbol"],
    credit_open: ["wallet", "account", "market", "agent", "credits", "borrow", "to", "ceiling", "daily_limit", "target_ltv", "trigger_ltv", "allow", "gas_station", "keeper"],
    credit_pay: ["wallet", "account", "to", "amount"], credit_repay: ["wallet", "account", "amount", "close"] }[tool];
  const out = {};
  for (const k of pick) if (a[k] !== undefined) out[k] = k === "allow" ? String(a[k]).split(",") : (a[k] === true || a[k] === "true") && ["all", "close", "gas_station"].includes(k) ? true : a[k];
  if (out.asset) out.asset = String(out.asset).toUpperCase();
  if (out.symbol) out.symbol = String(out.symbol).toUpperCase();
  return out;
}

// For an agent that called Borro's MCP itself (a connected MCP server): check the tool's answer, saved as JSON,
// exactly as `plan` would. node borro.mjs validate answer.json --action supply --wallet 0x... --asset NVDA
async function cmdValidate(file, a) {
  need(file, "the saved MCP answer (a file path, or - for stdin) is required");
  need(PREPARE.includes(a.action), `--action must be one of ${PREPARE.join(", ")}`);
  const raw = file === "-" ? readFileSync(0, "utf8") : readFileSync(file, "utf8");
  let r = JSON.parse(raw);
  if (r.result) r = r.result.structuredContent || JSON.parse(r.result.content[0].text);
  else if (r.structuredContent) r = r.structuredContent;
  return finishPlan(a.action, a, r);
}

async function cmdPlan(tool, a) {
  if (!PREPARE.includes(tool)) fail("NOT_IN_SKILL", `plan ${tool} is not part of this skill (${PREPARE.join(", ")})`);
  return finishPlan(tool, a, await mcp(tool, mcpArgs(tool, a)));
}

async function finishPlan(tool, a, r) {
  need(isAddr(a.wallet), "wallet (the Bankr EVM address) is required");
  if (Number(r.chainId) !== CHAIN) fail("WRONG_CHAIN", "Borro answered for another chain");
  if (!same(r.from, a.wallet)) fail("WRONG_WALLET", "Borro built this for another wallet");
  const facts = await check(tool, a, a.wallet, r.transactions);
  const sim = r.simulation || {};
  const base = { action: tool, chainId: CHAIN, wallet: a.wallet, facts: stringify(facts), quote: r.quote || r.line || null, note: r.note || null, closes_parts: r.closes_parts || undefined };
  if (!sim.ok) {
    const why = (sim.steps || []).filter((s) => !s.ok).map((s) => `step ${s.step}: ${s.error || "fails"}`);
    return { ok: false, code: "SIMULATION_FAILED", error: `Borro simulated this from the wallet and it would fail (${why.join("; ") || "unknown"}). Nothing was sent.`, ...base };
  }
  const warnings = [];
  if (tool === "supply" && a.amount !== undefined && facts.units < units(String(a.amount), asset(a.asset).decimals))
    warnings.push(`The wallet holds less than asked: this lends ${facts.amount} ${facts.asset}.`);
  return { ok: true, status: "ready", ...base, warnings, simulated: { by: "Borro's MCP, eth_simulateV1 from the wallet", ok: true },
    expires_at: (r.quote && r.quote.expires_at) || null, summary: r.transactions.map((t) => t.description),
    transactions: r.transactions, bankr_submit: bankrBodies(r.transactions) };
}

function stringify(o) { return JSON.parse(JSON.stringify(o, (k, v) => (typeof v === "bigint" ? v.toString() : v))); }

// Codes are first come, first served and anyone can register one, so the skill credits a code only while BorroBuilders
// shows the payee pinned for it in known-contracts.json (bookrunner). A code with no pinned payee is never used.
function pinnedPayee(code) {
  const b = K.bookrunner || {};
  return b.code === code && isAddr(b.payee) ? b.payee : null;
}

async function codeStatus(code, wallet) {
  if (!/^[a-z0-9_-]{1,31}$/.test(code)) fail("BAD_CODE", "a bookrunner code is lowercase letters, digits, - and _, up to 31 characters");
  const pinned = pinnedPayee(code);
  const statement = await feed("/builders.json").catch(() => null);
  const listed = statement && statement.codes && statement.codes[code];
  if (listed) return { code, registered: true, payee: listed.payee, pinned_payee: pinned, use: !!pinned && same(listed.payee, pinned), source: "/builders.json" };
  // Not in the hourly statement: ask the chain through Borro (bind_builder answers a registered code with typed data,
  // and refuses an unregistered one in words). No signature, nothing stored.
  try {
    await mcp("bind_builder", { wallet: wallet || K.contracts.BorroBuilders, code });
    return { code, registered: true, pinned_payee: pinned, use: false, source: "the chain, through Borro's MCP (payee not shown, so it is not used)" };
  } catch (e) {
    if (e.code === "BORRO_REFUSED" && /no bookrunner has registered/i.test(e.message)) return { code, registered: false, pinned_payee: pinned, use: false, source: "the chain, through Borro's MCP" };
    throw e;
  }
}

async function cmdLend(a) {
  need(isAddr(a.wallet), "wallet (the Bankr EVM address) is required");
  const code = String(a.code || "").toLowerCase();
  const x = asset(a.asset);
  const want = units(a.amount, x.decimals);
  need(want > 0n, "amount must be more than zero");
  if (!x.bookrunner_deposits) fail("VAULT_NOT_LISTED", `BorroBuilders does not take ${x.symbol} deposits yet, so a bookrunner code cannot be credited for ${x.symbol}. Lend it without a code (plan supply) only if the user agrees.`);
  const st = await codeStatus(code, a.wallet);
  if (!st.registered) fail("CODE_NOT_REGISTERED", `the bookrunner code "${code}" is not registered on BorroBuilders, so a deposit with it would revert. Lend without a code (plan supply) only if the user agrees.`);
  if (!st.use) fail("CODE_NOT_PINNED", `the bookrunner code "${code}" does not have the payee this skill pins for it, so it is not used. Lend without a code (plan supply): the user earns the same.`);

  // Borro's own plan for the plain deposit of the same amount: it caps the amount to what the wallet holds and
  // simulates it from the wallet. Its vault, token and amount are checked against the pins, then reused.
  const plain = await mcp("supply", { wallet: a.wallet, asset: x.symbol, amount: String(a.amount) });
  if (!same(plain.from, a.wallet) || Number(plain.chainId) !== CHAIN) fail("WRONG_WALLET", "Borro built this for another wallet or chain");
  const f = await check("supply", { asset: x.symbol }, a.wallet, plain.transactions);
  if (!(plain.simulation && plain.simulation.ok)) fail("SIMULATION_FAILED", "Borro's simulation of this deposit fails from the wallet (does it hold the amount?). Nothing was sent.");
  const warnings = [];
  if (f.units < want) warnings.push(`The wallet holds less than asked: this lends ${f.amount} ${x.symbol}.`);

  let preview, simulated;
  const code32 = "0x" + encCode(code);
  if (RPC) {
    await chainOk();
    const [payee, listed, prev] = await aggregate3([
      { to: K.contracts.BorroBuilders, data: S["BorroBuilders.builders"] + encCode(code) },
      { to: K.contracts.BorroBuilders, data: S["BorroBuilders.vaults"] + encAddr(f.vault) },
      { to: f.vault, data: S["vault.previewDeposit"] + encUint(f.units) },
    ]);
    if (!payee.ok || BigInt(payee.data) === 0n) fail("CODE_NOT_REGISTERED", `the chain shows no payee for "${code}"`);
    if (!same("0x" + hex(payee.data).slice(-40), st.pinned_payee)) fail("CODE_NOT_PINNED", `the chain shows another payee for "${code}" than this skill pins, so it is not used. Lend without a code (plan supply).`);
    if (!listed.ok || BigInt(listed.data) !== 1n) fail("VAULT_NOT_LISTED", `the chain shows BorroBuilders does not take ${x.symbol} deposits`);
    if (!prev.ok) fail("RPC_ERROR", "previewDeposit failed");
    preview = BigInt(prev.data);
  } else if (a["preview-shares"] !== undefined) {
    preview = BigInt(String(a["preview-shares"]));
    warnings.push("The minimum shares come from a previewDeposit read you supplied; the BorroBuilders call itself was not simulated (Borro simulated the plain deposit of the same amount).");
  } else {
    fail("NEED_PREVIEW", "Set BORRO_RPC_URL (your own Robinhood Chain RPC), or read the vault's previewDeposit and pass it as --preview-shares.", {
      read: { chain: "Robinhood Chain (4663)", contract: f.vault, function: "previewDeposit(uint256)", argument: f.units.toString(),
        bankr_prompt: `Read previewDeposit(uint256) on ${f.vault} on Robinhood Chain with ${f.units.toString()}` } });
  }
  if (preview <= 0n) fail("BAD_PREVIEW", "previewDeposit returned nothing");
  const minShares = (preview * 995n) / 1000n;

  const txs = [
    { step: 1, kind: "approve", description: `Approve BorroBuilders to take exactly ${f.amount} ${x.symbol}`, to: f.token,
      data: S.approve + encAddr(K.contracts.BorroBuilders) + encUint(f.units), value: "0", chainId: CHAIN },
    { step: 2, kind: "call", description: `Lend ${f.amount} ${x.symbol} on Borro through Bookrunners (code ${code}); the vault shares go to the wallet`,
      to: K.contracts.BorroBuilders, data: S["BorroBuilders.deposit"] + encAddr(f.vault) + encUint(f.units) + encCode(code) + encUint(minShares), value: "0", chainId: CHAIN },
  ];

  if (RPC) {
    try {
      const res = await rpc("eth_simulateV1", [{ blockStateCalls: [{ calls: txs.map((t) => ({ from: a.wallet, to: t.to, data: t.data })) }], validation: false }, "latest"]);
      const calls = (res && res[0] && res[0].calls) || [];
      if (calls.length !== txs.length) throw new SkillError("RPC_ERROR", "the simulation answered in an unexpected shape");
      const bad = calls.findIndex((c) => c.status !== "0x1");
      if (bad >= 0) {
        const c = calls[bad];
        const why = (c.returnData && hex(c.returnData)) ? revertText(c.returnData) : (c.error && c.error.data) ? revertText(c.error.data) : String((c.error && c.error.message) || "reverted");
        fail("SIMULATION_FAILED", `step ${bad + 1} would fail: ${why}. Nothing was sent.`);
      }
      simulated = { by: "eth_simulateV1 on BORRO_RPC_URL, from the wallet", ok: true };
    } catch (e) {
      if (e.code === "SIMULATION_FAILED") throw e;
      warnings.push(`Your RPC could not simulate it (${e.message}); Borro simulated the plain deposit of the same amount.`);
      simulated = { by: "Borro's MCP (the plain deposit of the same amount)", ok: true, bookrunner_call_simulated: false };
    }
  } else simulated = { by: "Borro's MCP (the plain deposit of the same amount)", ok: true, bookrunner_call_simulated: false };

  return { ok: true, status: "ready", action: "lend_with_code", chainId: CHAIN, wallet: a.wallet, bookrunner_code: code, asset: x.symbol, amount: f.amount,
    vault: f.vault, min_shares: minShares.toString(), preview_shares: preview.toString(), simulated, warnings,
    summary: txs.map((t) => t.description), transactions: txs, bankr_submit: bankrBodies(txs) };
}

async function cmdBind(a) {
  need(isAddr(a.wallet), "wallet is required");
  const code = String(a.code || "").toLowerCase();
  // A binding is permanent (the first one stands), so only the pinned code with its pinned payee.
  const st = await codeStatus(code, a.wallet);
  if (!st.use) fail("CODE_NOT_PINNED", `the bookrunner code "${code}" is not registered with the payee this skill pins for it, so the skill does not bind to it. Trades work the same without a binding.`);
  const p = { wallet: a.wallet, code };
  if (a.signature) { p.signature = String(a.signature); p.timestamp = Number(a.timestamp); }
  const r = await mcp("bind_builder", p);
  if (r.typed_data && !r.bound) {
    return { ok: true, status: "sign", ...r, bankr_sign: { signatureType: "eth_signTypedData_v4", typedData: r.typed_data },
      next: `Sign with POST /wallet/sign, then: node borro.mjs bind --wallet ${a.wallet} --code ${code} --signature <0x...> --timestamp ${r.typed_data.message.timestamp}` };
  }
  return { ok: true, status: r.bound ? "bound" : "unknown", ...r };
}

// Offline checks: the pins are well formed, and the hand encoders give exactly what ethers v6 gives
// (vectors made with ethers.Interface: the Bookrunners page's own 1.5 NVDA / "route" example, and Multicall3).
function selftest() {
  const results = [];
  const t = (name, okv) => results.push({ name, ok: !!okv });
  const addrs = [K.contracts.BorroShort, K.contracts.BorroBuilders, K.contracts.BorroUSDGVault, K.contracts.AgentCreditFactory, K.usdg.token, K.usdg.vault,
    ...Object.values(K.stocks).flatMap((s) => [s.token, s.vault]), ...Object.values(K.credit_markets).map((m) => m.token)];
  t("every pinned address is an address", addrs.every(isAddr));
  t("every stock has a 32-byte short market id", Object.values(K.stocks).every((s) => /^0x[0-9a-fA-F]{64}$/.test(s.short_market_id)));
  t("chain is 4663", CHAIN === 4663);
  t("a code is used only with a pinned payee", pinnedPayee("someone-else") === null && (K.bookrunner.payee === null ? pinnedPayee(K.bookrunner.code) === null : same(pinnedPayee(K.bookrunner.code), K.bookrunner.payee)));
  const sent = ["approve", "vault.deposit", "vault.withdraw", "vault.redeem", "BorroShort.open", "BorroShort.close", "BorroBuilders.deposit", "AgentCreditFactory.open",
    "line.borrow", "line.deposit", "line.repay", "line.close", "line.sellAndRepay"];
  t("every call the skill sends has a pinned gas limit", sent.every((n) => K.gas[S[n]]));
  const dep = S["BorroBuilders.deposit"] + encAddr("0x508E23274C39C60c345e35B1f0188bE180717CB9") + encUint(1500000000000000000n) + encCode("route") + encUint(1489515000000000000n);
  t("BorroBuilders.deposit encodes as ethers does", dep === "0xec2ac54e000000000000000000000000508e23274c39c60c345e35b1f0188be180717cb900000000000000000000000000000000000000000000000014d1120d7b160000726f75746500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014abd2002e9db000");
  const app = S.approve + encAddr(K.contracts.BorroBuilders) + encUint(1500000000000000000n);
  t("approve encodes as ethers does", app === "0x095ea7b3000000000000000000000000082ae609bdc7cceec0c58b2361a21c49dc2ae29100000000000000000000000000000000000000000000000014d1120d7b160000");
  t("code bankr is its bytes32", "0x" + encCode("bankr") === "0x62616e6b72000000000000000000000000000000000000000000000000000000");
  const c = call("0x095ea7b3000000000000000000000000f8e0ab443098c0738489b5baffbd32a1341f228900000000000000000000000000000000000000000000000000000000000493e0424f52524f4d4350");
  t("a tagged MCP approval decodes", c.tagged && same(c.addr(0), K.usdg.vault) && c.uint(1) === 300000n);
  t("units and fmt round trip", units("1.5", 18) === 1500000000000000000n && fmt(300000n, 6) === "0.3");
  let threw = false; try { units("1e5", 18); } catch { threw = true; }
  t("odd amounts are refused", threw);
  const agg = encAggregate3([{ to: K.contracts.BorroBuilders, data: S["BorroBuilders.builders"] + encCode("bankr") }, { to: K.usdg.vault, data: S["vault.previewDeposit"] + encUint(300000n) }]);
  t("Multicall3 aggregate3 encodes as ethers does", agg === "0x82ad56cb0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000100000000000000000000000000082ae609bdc7cceec0c58b2361a21c49dc2ae291000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000024f067eb2162616e6b7200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f8e0ab443098c0738489b5baffbd32a1341f2289000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000024ef8b30f700000000000000000000000000000000000000000000000000000000000493e000000000000000000000000000000000000000000000000000000000");
  const dec = decAggregate3("0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000021234000000000000000000000000000000000000000000000000000000000000");
  t("Multicall3 results decode as ethers encodes them", dec.length === 2 && dec[0].ok && BigInt(dec[0].data) === 1n && !dec[1].ok && dec[1].data === "0x1234");
  return { ok: results.every((r) => r.ok), results };
}

async function main() {
  const [cmd, sub, ...rest] = process.argv.slice(2);
  if (cmd === "selftest") { const r = selftest(); process.stdout.write(JSON.stringify(r, null, 2) + "\n"); if (!r.ok) process.exitCode = 1; return; }
  const a = args(sub && !sub.startsWith("--") ? rest : [sub, ...rest].filter(Boolean));
  let out;
  if (cmd === "read") out = { ok: true, data: await cmdRead(sub, a) };
  else if (cmd === "plan") out = await cmdPlan(sub, a);
  else if (cmd === "validate") out = await cmdValidate(sub, a);
  else if (cmd === "lend") out = await cmdLend(args(process.argv.slice(3)));
  else if (cmd === "code") out = { ok: true, ...(await codeStatus(String(sub || "").toLowerCase(), a.wallet)) };
  else if (cmd === "bind") out = await cmdBind(args(process.argv.slice(3)));
  else if (cmd === "pins") out = { ok: true, ...K };
  else out = { ok: false, code: "USAGE", error: "commands: read <tool>, plan <tool>, lend, code <code>, bind, pins (see the top of this file)" };
  process.stdout.write(JSON.stringify(stringify(out), null, 2) + "\n");
  if (!out.ok) process.exitCode = 1;
}

main().catch((e) => {
  const out = { ok: false, code: e.code || "ERROR", error: String(e.message || e), ...(e.extra || {}) };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.exitCode = 1;
});
