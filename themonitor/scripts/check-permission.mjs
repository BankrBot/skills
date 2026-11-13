// Strict check of a permission (EIP-712 Delegation) before the Bankr wallet signs it. No dependencies.
//
//   node check-permission.mjs KIND typedData.json 0xME 0xACCOUNT [amount_hype ticket_hype]
//
// KIND is swap | approve | withdraw | feegas. typedData.json holds the `typedData` object returned by /api/live/prepare.
// Every caveat is identified by its pinned enforcer address on Elysium and its terms are compared byte for byte with the
// only encoding Monitor uses. The set of caveats must be exactly the expected one: nothing missing, nothing extra.
// On success prints {ok:true, kind, limits, expires} with the decoded limits in HYPE; the agent must show those exact
// numbers to the user. On any mismatch prints "STOP: ..." and exits 1: do not sign.
import fs from "fs";

const DM = "0xdb9b1e94b5b69df7e401ddbede43491141047db3";            // DelegationManager
const EXECUTOR = "0x7fea74c5eb9acaefd7fc2f9c627b5d286e134940";      // Monitor's server key (typed-data delegate)
const GUARD = "0x795f8ff1d458a168b78e3c37c028fb834d1146d5";         // guarded swap contract
const FEE_TO = "0x509c3978687c9fb3e94a11b84703796f75f51588";        // fee address
const E = {                                                          // caveat enforcers deployed on Elysium (99901)
  AllowedTargets: "0xdfe60a21e595610b8635fb390689d44d9939a2e5",
  AllowedMethods: "0x5a980c2d7f587db4ce0fe12b1e32b091284320cb",
  AllowedCalldata: "0xbc953f445001ece145d7284f2b95c3208ebec001",
  ExactCalldata: "0xd7f8a78b16cf8eb6e74c6c4a0acddaf78ca7fda7",
  ValueLte: "0x55a7f648783ebc8c3a10389fa696cc5608d35bed",
  NativeTokenTransferAmount: "0xe2b87a8a05870bb97119271011afee33e2e06b16",
  NativeTokenPeriodTransfer: "0xe194d3e0f167a2319b23c6843019973640218b00",
  LimitedCalls: "0x04658b29f6b82ed55274221a06fc97d318e25416",
  Timestamp: "0x1046bb45c8d673d4ea75321280db34899413c069",
};
const EXPECT = {                                                     // exact caveat set per kind
  swap: ["AllowedTargets", "AllowedMethods", "ValueLte", "Timestamp", "NativeTokenPeriodTransfer", "LimitedCalls"],
  approve: ["AllowedMethods", "AllowedCalldata", "ValueLte", "Timestamp"],
  withdraw: ["ExactCalldata", "NativeTokenTransferAmount", "AllowedTargets", "Timestamp"],
  feegas: ["ExactCalldata", "NativeTokenTransferAmount", "AllowedTargets", "Timestamp"],
};
const MAX_TERM_DAYS = 400;

const die = (m) => { console.log("STOP: " + m); process.exit(1); };
const lc = (s) => String(s || "").toLowerCase();
const isAddr = (s) => /^0x[0-9a-f]{40}$/.test(lc(s));
const hex = (t) => { const h = lc(t); if (!/^0x([0-9a-f]{2})*$/.test(h)) die("caveat terms are not hex bytes"); return h.slice(2); };
const word = (n) => BigInt(n).toString(16).padStart(64, "0");
const pad32 = (a) => lc(a).slice(2).padStart(64, "0");
const hype = (wei) => { const s = wei.toString().padStart(19, "0"); return (s.slice(0, -18) + "." + s.slice(-18)).replace(/\.?0+$/, "") || "0"; };

const [, , kind, file, meArg, accArg, amountArg, ticketArg] = process.argv;
if (!EXPECT[kind]) die("usage: node check-permission.mjs swap|approve|withdraw|feegas typedData.json 0xME 0xACCOUNT [amount ticket]");
if (!isAddr(meArg) || !isAddr(accArg)) die("ME and ACCOUNT must be addresses");
const ME = lc(meArg), ACCOUNT = lc(accArg);
let td = JSON.parse(fs.readFileSync(file, "utf8"));
if (td.typedData) td = td.typedData;
const m = td.message || {};

if (td.primaryType !== "Delegation") die("primaryType is not Delegation");
if (Number(td.domain?.chainId) !== 99901) die("domain chainId is not 99901");
if (lc(td.domain?.verifyingContract) !== DM) die("domain verifyingContract is not the delegation manager");
if (td.domain?.name !== "DelegationManager" || String(td.domain?.version) !== "1") die("domain name/version is not DelegationManager v1");
if (lc(m.delegator) !== ACCOUNT) die("delegator is not the user's account");
if (lc(m.delegate) !== EXECUTOR) die("delegate is not Monitor's executor key");
if (lc(m.authority) !== "0x" + "f".repeat(64)) die("authority is not root (0xff..ff)");
const cavs = Array.isArray(m.caveats) ? m.caveats : die("no caveats");

const byName = {};
for (const c of cavs) {
  const name = Object.keys(E).find((k) => E[k] === lc(c.enforcer));
  if (!name) die(`unknown caveat enforcer ${c.enforcer}`);
  if (byName[name]) die(`caveat ${name} appears twice`);
  if (c.args && lc(c.args) !== "0x") die(`caveat ${name} carries args`);
  byName[name] = hex(c.terms);
}
const want = EXPECT[kind];
if (Object.keys(byName).length !== want.length || !want.every((n) => n in byName))
  die(`caveats must be exactly [${want.join(", ")}], got [${Object.keys(byName).join(", ")}]`);

// Timestamp: uint128 after = 0, uint128 before = expiry, within MAX_TERM_DAYS
const ts = byName.Timestamp;
if (ts.length !== 64 || BigInt("0x" + ts.slice(0, 32)) !== 0n) die("timestamp caveat is not 'valid until a date'");
const until = Number(BigInt("0x" + ts.slice(32)));
const now = Math.floor(Date.now() / 1000);
if (until <= now || until > now + MAX_TERM_DAYS * 86400) die("expiry is in the past or more than 400 days away");

const limits = {};
const exactWord = (name, n, what) => { if (byName[name] !== word(n)) die(`${what} must be exactly ${n}`); };

if (kind === "swap") {
  if (byName.AllowedTargets !== GUARD.slice(2)) die("swap target is not exactly the guarded swap contract");
  const sels = byName.AllowedMethods;
  if (sels.length !== 16 || [sels.slice(0, 8), sels.slice(8)].sort().join() !== ["3581f5bb", "f496a610"].join()) die("swap methods are not exactly buy and sell");
  if (byName.ValueLte.length !== 64) die("per-buy cap term is not 32 bytes");
  const perBuy = BigInt("0x" + byName.ValueLte);
  const p = byName.NativeTokenPeriodTransfer;
  if (p.length !== 192) die("24-hour cap term is not 96 bytes");
  const perDay = BigInt("0x" + p.slice(0, 64)), period = BigInt("0x" + p.slice(64, 128));
  if (period !== 86400n) die("spending period is not 24 hours");
  if (byName.LimitedCalls.length !== 64) die("call limit term is not 32 bytes");
  const calls = BigInt("0x" + byName.LimitedCalls);
  if (perBuy === 0n || perDay === 0n || calls === 0n) die("a swap limit is zero");
  limits.max_per_buy_hype = hype(perBuy);
  limits.max_per_24h_hype = hype(perDay);
  limits.max_calls = Number(calls);
  if (amountArg && ticketArg) {
    const toWei = (x) => BigInt(Math.round(Number(x) * 1e6)) * 10n ** 12n;
    const amount = toWei(amountArg), ticket = toWei(ticketArg);
    limits.agreed_amount_hype = hype(amount);
    limits.agreed_per_buy_hype = hype(ticket);
    limits.per_buy_cap_vs_agreed = ticket > 0n ? Number(perBuy * 100n / ticket) / 100 : null;
    limits.per_buy_cap_covers_whole_deposit = perBuy >= amount;
    if (perBuy < ticket) die("the per-buy cap is below the agreed per-buy size; ask for a new swap permission");
  }
} else if (kind === "approve") {
  if (byName.AllowedMethods !== "095ea7b3") die("approve permission must allow only approve(address,uint256)");
  if (byName.AllowedCalldata !== word(4) + pad32(GUARD)) die("approve calldata rule must be exactly: offset 4, spender = guarded swap contract");
  exactWord("ValueLte", 0, "approve value cap");
  limits.spender = GUARD;
} else {
  const to = kind === "withdraw" ? ME : FEE_TO;
  if (byName.ExactCalldata !== "") die(`${kind} must allow plain transfers only (empty calldata)`);
  if (byName.AllowedTargets !== to.slice(2)) die(`${kind} recipient is not exactly ${kind === "withdraw" ? "the user's wallet" : "the fee address"}`);
  if (byName.NativeTokenTransferAmount.length !== 64) die("transfer cap term is not 32 bytes");
  limits.recipient = to;
  limits.max_total_hype = hype(BigInt("0x" + byName.NativeTokenTransferAmount));
}

console.log(JSON.stringify({ ok: true, kind, limits, expires: new Date(until * 1000).toISOString().slice(0, 10) }, null, 1));
