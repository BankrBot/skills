#!/usr/bin/env node
// BankrNS skill — check, register, renew and look up .bankr names with the user's own Bankr wallet.
//
// Two modes (same as the `bruno` skill):
//
// 1. Full (default): this script submits transactions itself through Bankr's Wallet API.
//    Needs BANKR_API_KEY (run `bankr login`). Use standalone: Claude Code, a terminal.
//
// 2. --build-only: this script only BUILDS transactions and prints them as JSON. It submits
//    nothing and needs no API key. Use inside bankrbot's sandbox — bankrbot submits the printed
//    transaction itself, already authenticated as the user. Registration is two transactions
//    (commit, then register ≥60s later), so step 1 prints a `state` token to pass to step 2.
//
// Commands:
//   node bankrns.mjs check    <name> [--years N]
//   node bankrns.mjs lookup   <name.bankr | 0xaddress | @xhandle>
//   node bankrns.mjs resolve  <name.bankr>                           # JSON for sending: {name, address, owner, expires}
//   node bankrns.mjs register <name> [--years N] [--resolve-to 0x…|@handle|name.bankr] [--owner 0x…|@handle]
//                                    [--no-primary] [--no-twitter]
//   node bankrns.mjs register <name> --build-only --wallet-address 0x… [--twitter handle] [same options]
//   node bankrns.mjs register --build-only --state <token>          # step 2 inside bankrbot
//   node bankrns.mjs register --state <token>                        # resume an interrupted full-mode run
//   node bankrns.mjs renew    <name> [--years N] [--build-only]
//   node bankrns.mjs token    [0xaddress | @handle | name.bankr]      # official $BNS token (+ a holder's balance)
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { formatEther, formatUnits, getAddress, isAddress, labelhash, zeroAddress } from "viem";
import {
  BNS_TOKEN,
  CONTRACTS,
  GRACE_PERIOD,
  erc20Abi,
  MAX_COMMITMENT_AGE,
  MIN_COMMITMENT_AGE,
  WEBSITE,
  controllerAbi,
  publicClient,
  registrarAbi,
  universalAbi,
} from "./lib/contracts.mjs";
import { bankrWalletOfHandle, bankrWhoami, submitTxBankr } from "./lib/bankr.mjs";
import {
  buildRegistration,
  commitTx,
  decodeState,
  encodeState,
  fullName,
  idOf,
  labelError,
  randomSecret,
  registerTx,
  renewTx,
  shortAddr,
  toLabel,
  txJson,
  usdPerYear,
  withBuffer,
} from "./lib/names.mjs";

const GAS_RESERVE = 200_000_000_000_000n; // 0.0002 ETH kept aside for the two transactions' gas

// ------------------------------------------------------------------ small utils

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[a.slice(2)] = true;
      else {
        out[a.slice(2)] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

const eth = (wei) => `${Number(formatEther(wei)).toFixed(6)} ETH`;
const log = (...m) => console.log(...m);
const emit = (obj) => console.log(JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseYears(v) {
  const y = v === undefined ? 1 : Number(v);
  if (!Number.isInteger(y) || y < 1 || y > 100) throw new Error("--years must be a whole number between 1 and 100");
  return y;
}

function requireLabel(input) {
  const label = toLabel(input);
  const err = labelError(label);
  if (err) throw new Error(`"${input}" isn't a valid .bankr name: ${err}.`);
  return label;
}

/** 0x address | @handle / handle (via Bankr) | name.bankr -> checksummed address. */
async function resolveTarget(input, what) {
  const v = String(input).trim();
  if (isAddress(v, { strict: false })) return { address: getAddress(v.toLowerCase()) };
  if (v.toLowerCase().endsWith(".bankr")) {
    const a = await publicClient.readContract({ address: CONTRACTS.universalResolver, abi: universalAbi, functionName: "resolve", args: [v.toLowerCase()] });
    if (a === zeroAddress) throw new Error(`${v} doesn't resolve to an address.`);
    return { address: a };
  }
  const handle = v.replace(/^@/, "");
  if (/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    const a = await bankrWalletOfHandle(handle);
    if (!a) throw new Error(`@${handle} has no Bankr wallet, so I can't use it as the ${what}.`);
    return { address: a, handle };
  }
  throw new Error(`Couldn't understand "${input}" as the ${what} — use a 0x address, an @handle, or a .bankr name.`);
}

async function chainTime() {
  return Number((await publicClient.getBlock()).timestamp);
}

async function quote(label, years) {
  const p = await publicClient.readContract({
    address: CONTRACTS.controller,
    abi: controllerAbi,
    functionName: "rentPrice",
    args: [label, BigInt(years) * 365n * 86400n],
  });
  return { base: p.base, premium: p.premium, total: p.base + p.premium };
}

async function nameStatus(label) {
  const [available, expires, reserved] = await Promise.all([
    publicClient.readContract({ address: CONTRACTS.controller, abi: controllerAbi, functionName: "available", args: [label] }),
    publicClient.readContract({ address: CONTRACTS.registrar, abi: registrarAbi, functionName: "nameExpires", args: [idOf(label)] }),
    publicClient.readContract({
      address: CONTRACTS.controller,
      abi: controllerAbi,
      functionName: "reserved",
      args: [labelhash(label)],
    }),
  ]);
  let owner = null;
  if (!available && expires > 0n) {
    owner = await publicClient
      .readContract({ address: CONTRACTS.registrar, abi: registrarAbi, functionName: "ownerOf", args: [idOf(label)] })
      .catch(() => null);
  }
  return { available, expires: Number(expires), reserved, owner };
}

async function commitmentOf(p) {
  return publicClient.readContract({
    address: CONTRACTS.controller,
    abi: controllerAbi,
    functionName: "makeCommitment",
    args: [buildRegistration(p)],
  });
}

async function committedAt(commitment) {
  return Number(
    await publicClient.readContract({ address: CONTRACTS.controller, abi: controllerAbi, functionName: "commitments", args: [commitment] }),
  );
}

// Pending full-mode registrations are saved so an interrupted run can resume without losing the secret.
const PENDING_DIR = join(homedir(), ".bankrns", "pending");
const pendingPath = (label) => join(PENDING_DIR, `${label}.json`);
function savePending(p) {
  mkdirSync(PENDING_DIR, { recursive: true });
  writeFileSync(pendingPath(p.label), JSON.stringify(p, null, 2));
}
function clearPending(label) {
  if (existsSync(pendingPath(label))) rmSync(pendingPath(label));
}

async function confirmedReceipt(submitResult, what) {
  const hash = submitResult.transactionHash;
  if (!hash) throw new Error(`${what}: Bankr returned no transaction hash (${JSON.stringify(submitResult)})`);
  const r = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (r.status !== "success") throw new Error(`${what} reverted on-chain: https://basescan.org/tx/${hash}`);
  return r;
}

// ------------------------------------------------------------------ commands

async function cmdCheck(args) {
  const label = requireLabel(args._[1]);
  const years = parseYears(args.years);
  const s = await nameStatus(label);
  const name = fullName(label);
  if (s.available) {
    const q = await quote(label, years);
    log(`✅ ${name} is available.`);
    log(`   Price: ${eth(q.total)} for ${years} year${years > 1 ? "s" : ""} (≈ $${usdPerYear(label) * years})` +
      (q.premium > 0n ? ` — includes a ${eth(q.premium)} recently-expired premium that decays daily` : ""));
    log(`   Register: node bankrns.mjs register ${label}${years > 1 ? ` --years ${years}` : ""}`);
    return;
  }
  if (s.reserved && s.expires === 0) {
    log(`🔒 ${name} is reserved and can't be registered publicly.`);
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  const [resolved, handle] = await Promise.all([
    publicClient.readContract({ address: CONTRACTS.universalResolver, abi: universalAbi, functionName: "resolve", args: [name] }),
    publicClient.readContract({ address: CONTRACTS.universalResolver, abi: universalAbi, functionName: "text", args: [name, "com.twitter"] }),
  ]);
  const expiry = new Date(s.expires * 1000).toISOString().slice(0, 10);
  if (s.expires <= now) {
    log(`⏳ ${name} expired on ${expiry} and is in its grace period until ${new Date((s.expires + GRACE_PERIOD) * 1000).toISOString().slice(0, 10)}. Only renewals are possible.`);
  } else {
    log(`❌ ${name} is taken.`);
  }
  if (s.owner) log(`   Owner: ${s.owner}${handle ? ` (@${handle})` : ""}`);
  if (resolved !== zeroAddress) log(`   Resolves to: ${resolved}`);
  log(`   Expires: ${expiry}. Anyone can renew it: node bankrns.mjs renew ${label}`);
}

async function cmdLookup(args) {
  const q = String(args._[1] || "").trim();
  if (!q) throw new Error("Usage: node bankrns.mjs lookup <name.bankr | 0xaddress | @handle>");
  let address;
  if (isAddress(q, { strict: false })) {
    address = getAddress(q.toLowerCase());
  } else if (q.includes(".")) {
    // A name, e.g. alice.bankr
    const name = q.toLowerCase();
    const a = await publicClient.readContract({ address: CONTRACTS.universalResolver, abi: universalAbi, functionName: "resolve", args: [name] });
    log(a === zeroAddress ? `${name} doesn't resolve to an address (unregistered, expired, or no address set).` : `${name} → ${a}`);
    return;
  } else {
    // An X handle
    const handle = q.replace(/^@/, "");
    address = await bankrWalletOfHandle(handle);
    if (!address) throw new Error(`@${handle} has no Bankr wallet.`);
    log(`@${handle}'s Bankr wallet: ${address}`);
  }
  const primary = await publicClient.readContract({ address: CONTRACTS.universalResolver, abi: universalAbi, functionName: "reverse", args: [address] });
  log(primary ? `${address} → primary name: ${primary}` : `${address} has no .bankr primary name.`);
}

/**
 * Machine-readable name -> address for sending tokens. Always prints one JSON line.
 * Only returns an address for a live (unexpired) name with an address record; never guesses.
 */
async function cmdResolve(args) {
  const q = String(args._[1] || "").trim().toLowerCase();
  const label = toLabel(q.split(".").length > 2 ? q.split(".").slice(-2).join(".") : q);
  const err = labelError(label);
  if (!q || err) return emit({ ok: false, error: `"${args._[1] ?? ""}" isn't a valid .bankr name${err ? `: ${err}` : ""}.` });
  const name = q.endsWith(".bankr") ? q : fullName(label);
  const [address, s] = await Promise.all([
    publicClient.readContract({ address: CONTRACTS.universalResolver, abi: universalAbi, functionName: "resolve", args: [name] }),
    nameStatus(label),
  ]);
  const expires = s.expires ? new Date(s.expires * 1000).toISOString() : null;
  if (s.expires === 0) return emit({ ok: false, name, error: `${name} is not registered.` });
  if (s.expires * 1000 <= Date.now()) return emit({ ok: false, name, expires, error: `${name} has expired, so it doesn't resolve. Don't send to it.` });
  if (address === zeroAddress) return emit({ ok: false, name, owner: s.owner, expires, error: `${name} has no address set. Ask its owner for an address.` });
  emit({ ok: true, name, address, owner: s.owner, expires, chainId: 8453 });
}

/** Resolves CLI options into the full registration parameters. */
async function planRegistration(args, wallet, walletTwitter) {
  const label = requireLabel(args._[1]);
  const years = parseYears(args.years);

  const owner = args.owner ? await resolveTarget(args.owner, "owner") : { address: wallet, handle: walletTwitter };
  const resolveTo = args["resolve-to"] ? (await resolveTarget(args["resolve-to"], "address to resolve to")).address : owner.address;
  if (owner.address.toLowerCase() === CONTRACTS.controller.toLowerCase() || owner.address.toLowerCase() === CONTRACTS.registrar.toLowerCase()) {
    throw new Error("A BankrNS contract can't own a name.");
  }

  // X handle, stored as `com.twitter` — only if Bankr confirms it belongs to the owner's wallet.
  let twitter;
  if (!args["no-twitter"]) {
    const candidate = (typeof args.twitter === "string" ? args.twitter : owner.handle)?.replace(/^@/, "");
    if (candidate) {
      const handleWallet = await bankrWalletOfHandle(candidate);
      if (handleWallet && handleWallet.toLowerCase() === owner.address.toLowerCase()) twitter = candidate;
      else console.error(`  (not storing @${candidate}: its Bankr wallet isn't the owner ${shortAddr(owner.address)})`);
    }
  }

  // The primary name is set for the SENDER (the Bankr wallet), so only when the name points back to it.
  const primary = !args["no-primary"] && resolveTo.toLowerCase() === wallet.toLowerCase();

  return { label, owner: owner.address, resolveTo, years, secret: randomSecret(), primary, twitter, wallet };
}

async function preflight(p) {
  const s = await nameStatus(p.label);
  if (!s.available) {
    throw new Error(
      s.reserved && s.expires === 0 ? `${fullName(p.label)} is reserved.` : `${fullName(p.label)} is already taken (run: node bankrns.mjs check ${p.label}).`,
    );
  }
  const q = await quote(p.label, p.years);
  const balance = await publicClient.getBalance({ address: p.wallet });
  const needed = withBuffer(q.total) + GAS_RESERVE;
  if (balance < needed) {
    throw new Error(
      `Not enough ETH on Base: ${fullName(p.label)} costs ${eth(q.total)} (+ gas), the Bankr wallet has ${eth(balance)}. Top up about ${eth(needed - balance)} and retry.`,
    );
  }
  return q;
}

function describe(p) {
  return (
    `${fullName(p.label)} for ${p.years} year${p.years > 1 ? "s" : ""}, owned by ${shortAddr(p.owner)}` +
    `${p.resolveTo !== p.owner ? `, resolving to ${shortAddr(p.resolveTo)}` : ""}` +
    `${p.twitter ? `, X @${p.twitter}` : ""}${p.primary ? ", set as primary name" : ""}`
  );
}

async function cmdRegister(args) {
  const buildOnly = args["build-only"] === true;

  // ---------------- resume / step 2 ----------------
  if (args.state) {
    const p = decodeState(args.state);
    return buildOnly ? buildStep2(p) : finishFullRegistration(p);
  }

  // ---------------- step 1 ----------------
  let wallet, walletTwitter;
  if (buildOnly) {
    if (!isAddress(args["wallet-address"] || "", { strict: false })) throw new Error("--build-only needs --wallet-address 0x… (the user's Bankr wallet)");
    wallet = getAddress(args["wallet-address"].toLowerCase());
  } else {
    const who = await bankrWhoami();
    wallet = who.address;
    walletTwitter = who.twitter;
  }
  const p = await planRegistration(args, wallet, walletTwitter);
  const q = await preflight(p);
  const commitment = await commitmentOf(p);
  const t = commitTx(commitment);

  if (buildOnly) {
    emit({
      step: 1,
      summary: `Reserve ${describe(p)}. Price: ${eth(q.total)}.`,
      transaction: txJson(t),
      description: `BankrNS step 1/2: reserve ${fullName(p.label)}`,
      state: encodeState(p),
      next: "Submit `transaction` from the user's Bankr wallet. Once confirmed, wait 60 seconds, then run: node bankrns.mjs register --build-only --state <state>",
    });
    return;
  }

  log(`Registering ${describe(p)}.`);
  log(`Price: ${eth(q.total)} (≈ $${usdPerYear(p.label) * p.years}) + gas. Bankr wallet: ${p.wallet}`);
  savePending(p);
  log(`Step 1/2: reserving privately…`);
  const r1 = await confirmedReceipt(await submitTxBankr({ ...t, description: `BankrNS: reserve ${fullName(p.label)}` }), "Reserve");
  log(`   ✓ confirmed https://basescan.org/tx/${r1.transactionHash}`);
  return finishFullRegistration(p);
}

async function finishFullRegistration(p) {
  const status = await nameStatus(p.label);
  if (!status.available) {
    clearPending(p.label);
    if (status.owner?.toLowerCase() === p.owner.toLowerCase()) {
      log(`✅ ${fullName(p.label)} is already registered to ${shortAddr(p.owner)} — nothing more to do.`);
      return;
    }
    throw new Error(`${fullName(p.label)} was registered by someone else first.`);
  }
  const commitment = await commitmentOf(p);
  const at = await committedAt(commitment);
  if (!at) throw new Error("Step 1 isn't on-chain for these parameters. Start again: node bankrns.mjs register " + p.label);
  const readyAt = at + MIN_COMMITMENT_AGE + 1;
  let now = await chainTime();
  if (now >= at + MAX_COMMITMENT_AGE) {
    clearPending(p.label);
    throw new Error("The reservation expired (older than 24h). Start again: node bankrns.mjs register " + p.label);
  }
  if (now < readyAt) log(`Waiting ${readyAt - now}s (front-running protection)…`);
  while (now < readyAt) {
    await sleep(Math.min(5_000, (readyAt - now) * 1000));
    now = await chainTime();
  }

  const q = await quote(p.label, p.years);
  const value = withBuffer(q.total);
  log(`Step 2/2: registering and paying ${eth(q.total)}…`);
  const r2 = await confirmedReceipt(
    await submitTxBankr({ ...registerTx(buildRegistration(p), value), description: `BankrNS: register ${fullName(p.label)}` }),
    "Register",
  );
  clearPending(p.label);
  const owner = await publicClient.readContract({ address: CONTRACTS.registrar, abi: registrarAbi, functionName: "ownerOf", args: [idOf(p.label)] });
  if (owner.toLowerCase() !== p.owner.toLowerCase()) throw new Error(`Unexpected owner after registration: ${owner}`);
  log(`✅ Registered ${fullName(p.label)}! https://basescan.org/tx/${r2.transactionHash}`);
  log(`   Resolves to ${p.resolveTo}${p.primary ? `, and it's now your primary name` : ""}. Paid ${eth(q.total)}; any extra was refunded.`);
  log(`   See it live: ${WEBSITE}/#/live`);
}

async function buildStep2(p) {
  // Check registration first: a successful step 2 deletes the reservation, so "not found" would
  // otherwise be misreported and could make the bot start the purchase over.
  const s = await nameStatus(p.label);
  if (!s.available) {
    const mine = s.owner?.toLowerCase() === p.owner.toLowerCase();
    emit({
      step: 2,
      ready: false,
      done: mine,
      reason: mine ? `${fullName(p.label)} is already registered to the user — nothing more to submit.` : `${fullName(p.label)} was taken by someone else — do not submit.`,
    });
    return;
  }
  const commitment = await commitmentOf(p);
  const at = await committedAt(commitment);
  const now = await chainTime();
  if (!at) {
    emit({ step: 2, ready: false, reason: "Step 1 isn't confirmed on-chain yet (or was sent from a different wallet). Retry in a few seconds." });
    return;
  }
  if (now >= at + MAX_COMMITMENT_AGE) {
    emit({ step: 2, ready: false, expired: true, reason: "The reservation expired (older than 24h). Start again from step 1." });
    return;
  }
  const readyAt = at + MIN_COMMITMENT_AGE + 1;
  if (now < readyAt) {
    emit({ step: 2, ready: false, waitSeconds: readyAt - now, reason: `Wait ${readyAt - now}s, then run this again.` });
    return;
  }
  const q = await quote(p.label, p.years);
  emit({
    step: 2,
    ready: true,
    summary: `Register ${describe(p)} for ${eth(q.total)} (3% buffer included in value; the excess is refunded).`,
    transaction: txJson(registerTx(buildRegistration(p), withBuffer(q.total))),
    description: `BankrNS step 2/2: register ${fullName(p.label)}`,
    next: `After it confirms, run: node bankrns.mjs check ${p.label}   — and share ${WEBSITE}/#/live`,
  });
}

async function cmdRenew(args) {
  const label = requireLabel(args._[1]);
  const years = parseYears(args.years);
  const s = await nameStatus(label);
  const now = Math.floor(Date.now() / 1000);
  if (s.expires === 0) throw new Error(`${fullName(label)} isn't registered — register it instead.`);
  if (s.expires + GRACE_PERIOD < now) throw new Error(`${fullName(label)} has fully expired — it can be registered again instead.`);
  const q = await quote(label, years);
  const t = renewTx(label, years, withBuffer(q.base));
  if (args["build-only"]) {
    emit({
      summary: `Renew ${fullName(label)} for ${years} year${years > 1 ? "s" : ""}: ${eth(q.base)}.`,
      transaction: txJson(t),
      description: `BankrNS: renew ${fullName(label)}`,
    });
    return;
  }
  await bankrWhoami();
  log(`Renewing ${fullName(label)} for ${years} year${years > 1 ? "s" : ""} (${eth(q.base)})…`);
  const r = await confirmedReceipt(await submitTxBankr({ ...t, description: `BankrNS: renew ${fullName(label)}` }), "Renew");
  const expires = await publicClient.readContract({ address: CONTRACTS.registrar, abi: registrarAbi, functionName: "nameExpires", args: [idOf(label)] });
  log(`✅ Renewed until ${new Date(Number(expires) * 1000).toISOString().slice(0, 10)}. https://basescan.org/tx/${r.transactionHash}`);
}

async function cmdToken(args) {
  const read = (functionName, a = []) => publicClient.readContract({ address: BNS_TOKEN.address, abi: erc20Abi, functionName, args: a });
  const [name, symbol, decimals, supply] = await Promise.all([read("name"), read("symbol"), read("decimals"), read("totalSupply")]);
  // Guard against a wrong constant or a changed deployment: the chain must agree.
  if (symbol !== BNS_TOKEN.symbol || name !== BNS_TOKEN.name) throw new Error(`Unexpected token at ${BNS_TOKEN.address}: ${name} (${symbol})`);
  const fmt = (v) => Number(formatUnits(v, decimals)).toLocaleString("en-US", { maximumFractionDigits: 2 });
  log(`$${symbol} — ${name}, the official BankrNS token on Base`);
  log(`   Contract: ${BNS_TOKEN.address}`);
  log(`   Supply:   ${fmt(supply)} ${symbol} (${decimals} decimals)`);
  log(`   Basescan: https://basescan.org/token/${BNS_TOKEN.address}`);
  log(`   Chart:    https://dexscreener.com/base/${BNS_TOKEN.address}`);
  log(`   Buy with Bankr (by address, never by ticker): "buy $10 of ${BNS_TOKEN.address} on base"`);
  if (args._[1]) {
    const who = await resolveTarget(args._[1], "holder");
    const bal = await read("balanceOf", [who.address]);
    log(`   ${args._[1]} (${shortAddr(who.address)}) holds ${fmt(bal)} ${symbol}`);
  }
}

// ------------------------------------------------------------------ main

const USAGE = readFileSync(new URL(import.meta.url), "utf8")
  .split("\n")
  .filter((l) => l.startsWith("//   node"))
  .map((l) => l.slice(5))
  .join("\n");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (cmd === "check") return cmdCheck(args);
  if (cmd === "lookup") return cmdLookup(args);
  if (cmd === "resolve") return cmdResolve(args);
  if (cmd === "register") return cmdRegister(args);
  if (cmd === "renew") return cmdRenew(args);
  if (cmd === "token") return cmdToken(args);
  log(`Usage:\n${USAGE}`);
  process.exitCode = cmd ? 1 : 0;
}

main().catch((e) => {
  const buildOnly = process.argv.includes("--build-only") || process.argv[2] === "resolve";
  if (buildOnly) emit({ error: e.shortMessage || e.message });
  else console.error(`❌ ${e.shortMessage || e.message}`);
  if (process.env.DEBUG) console.error(e);
  // exitCode (not process.exit) lets open HTTP sockets close cleanly — exit() crashes Node on Windows.
  process.exitCode = 1;
});
