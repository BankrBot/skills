// Adapter responsibility map (SDK @voidly/session 1.3.0):
// settlement-verification.test.ts owns receipt identity/canonical agreement,
// payer-scoped nonce and paired logs, token/block/head checks, alias grouping,
// historical complete terms, descriptor admission and input snapshots.
// settlement-rpc.test.ts owns receipt HTTP byte/depth limits, retries, monotonic
// deadlines, JSON-RPC envelopes, cancellation and response/error redaction.
// settlement-package.test.ts owns emitted/packed/browser/declaration closure.
// This suite retains Bankr policy, installed-SDK call-through, CLI/file/error
// translation and the separate gas-only transport. No RPC sockets are opened.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { envelopeHash, settlementNonce, canonicalize as sdkCanonicalize, SETTLEMENT_BINDING_DOMAIN } from "@voidly/session";
import { createHash } from "node:crypto";
import {
  verifySettlement, host, operatorKeyOf, invokedAsMain, renderVerdict, exitCodeFor,
  httpRpc, READ_METHODS, DEFAULT_RPCS, MAX_RPC_BODY_BYTES, MAX_CANONICAL_DEPTH,
} from "../scripts/verify-settlement.mjs";
import { CANONICAL_USDC_BASE, EXPECTED_PAYEE_ACCOUNT, ALLOWED_BASE_RPC_HOSTS } from "../scripts/lib/pins.mjs";

// Independent synchronous fixture construction; production admission uses SDK only.
const grantHashOf = grant => createHash("sha256").update(sdkCanonicalize(grant)).digest("hex");
const bindingNonce = hash => "0x" + createHash("sha256").update(SETTLEMENT_BINDING_DOMAIN + hash).digest("hex");
const TOPIC_AUTHORIZATION_USED = "0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5";
const TOPIC_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const SKILL2 = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(SKILL2, "scripts/verify-settlement.mjs");
const TX = "0x" + "ab".repeat(32), GRANT_A = "aa".repeat(32);
const PAYER = "0x" + "11".repeat(20), PAYEE_A = EXPECTED_PAYEE_ACCOUNT.split(":").at(-1);
const OTHER = "0x" + "33".repeat(20), BLOCK_HASH = "0x" + "77".repeat(32);
const RPCS = ["https://mainnet.base.org", "https://base.drpc.org"];
const TYPED = { tx: TX, grantHash: GRANT_A, payer: PAYER, payee: PAYEE_A, amount: "50000" };
const word = value => "0x" + BigInt(value).toString(16).padStart(64, "0");
const topic = address => "0x" + address.slice(2).padStart(64, "0");
const inBlock = { transactionHash: TX, blockHash: BLOCK_HASH, blockNumber: "0x100" };
const receiptOf = (grantHash = GRANT_A, value = "50000", payee = PAYEE_A) => ({
  ...inBlock, status: "0x1", logs: [
    { ...inBlock, address: CANONICAL_USDC_BASE, logIndex: "0x0", topics: [TOPIC_AUTHORIZATION_USED, topic(PAYER), bindingNonce(grantHash)], data: "0x" },
    { ...inBlock, address: CANONICAL_USDC_BASE, logIndex: "0x1", topics: [TOPIC_TRANSFER, topic(PAYER), topic(payee)], data: word(value) },
  ],
});
const GRANT = (over = {}) => ({
  schema: "voidly-task-grant/v1", hirer_did: "did:voidly:synthetic-hirer", provider_did: "did:voidly:synthetic-provider",
  provider_signing_pubkey_base64: "ERERERERERERERERERERERERERERERERERERERERERE=",
  provider_enc_pubkey_base64: "IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI=",
  offer_hash: "01".repeat(32), capsule_hash: "02".repeat(32), brief_commitment: "03".repeat(32),
  price_chain: "eip155:8453", price_asset: `eip155:8453/erc20:${CANONICAL_USDC_BASE}`,
  price_payer_account: `eip155:8453:${PAYER}`, price_payee_account: EXPECTED_PAYEE_ACCOUNT,
  price_min_amount: "50000", price_max_amount: "5000000", nonce: "c3ludGhldGljLW5vbmNlLW9ubHk=",
  issued_at: "2020-01-01T00:00:00.000Z", expires_at: "2020-01-01T00:10:00.000Z", ...over,
});
const jsonResponse = (body, init) => new Response(JSON.stringify(body), init);
function fetchServing(receipt = receiptOf(), modify) {
  const calls = [];
  const fetch = async (url, init) => {
    const request = JSON.parse(init.body);
    calls.push({ url: String(url), ...request });
    assert.equal(init.method, "POST"); assert.equal(init.redirect, "error");
    assert.equal(init.credentials, "omit"); assert.equal(init.referrerPolicy, "no-referrer");
    assert.equal(request.jsonrpc, "2.0"); assert.equal(typeof request.id, "number");
    const defaults = { eth_chainId: "0x2105", eth_getTransactionReceipt: receipt,
      eth_getBlockByNumber: { hash: BLOCK_HASH, number: "0x100" }, eth_blockNumber: "0x10c" };
    assert.ok(Object.hasOwn(defaults, request.method), "only the four receipt reads are admitted");
    const result = modify ? modify(calls.at(-1), defaults[request.method]) : defaults[request.method];
    return jsonResponse({ jsonrpc: "2.0", id: request.id, result });
  };
  return { fetch, calls };
}
const forbiddenFetch = async () => { throw new Error("NETWORK_ATTEMPTED"); };
// A bad fixture must never silently fall through to a real network request.
const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = forbiddenFetch;
const guard = "globalThis.fetch=async()=>{process.stderr.write('NETWORK_ATTEMPTED');throw new Error('network forbidden')};";
const preload = code => `data:text/javascript,${encodeURIComponent(code)}`;
const runCli = (args, opts = {}) => spawnSync(process.execPath, ["--import", preload(guard), CLI, ...args], { encoding: "utf8", timeout: 5000, ...opts });
function runSuccessfulCli(args, receipt = receiptOf()) {
  const code = `const receipt=${JSON.stringify(receipt)};const calls=[];
  globalThis.fetch=async(url,init)=>{const r=JSON.parse(init.body);calls.push({url:String(url),...r});
  const values={eth_chainId:'0x2105',eth_getTransactionReceipt:receipt,eth_getBlockByNumber:{hash:receipt.blockHash,number:receipt.blockNumber},eth_blockNumber:'0x10c'};
  if(!Object.hasOwn(values,r.method))throw new Error('unexpected method');
  return new Response(JSON.stringify({jsonrpc:'2.0',id:r.id,result:values[r.method]}));};
  process.on('exit',()=>process.stderr.write('CALLS='+JSON.stringify(calls)+'\\n'));`;
  return spawnSync(process.execPath, ["--import", preload(code), CLI, ...args], { encoding: "utf8", timeout: 5000 });
}
const typedArgs = ["--tx", TX, "--grant-hash", GRANT_A, "--payer", PAYER, "--payee", PAYEE_A, "--amount", "50000"];

test("installed SDK receives the fixed defaults and all four reads for both operators", async () => {
  const fixture = fetchServing();
  const verdict = await verifySettlement({ ...TYPED, fetch: fixture.fetch });
  assert.equal(verdict.ok, true, JSON.stringify(verdict));
  assert.equal(fixture.calls.length, 8);
  assert.deepEqual([...new Set(fixture.calls.map(c => new URL(c.url).host))], DEFAULT_RPCS.map(host));
  assert.equal(new Set(fixture.calls.map(c => c.id)).size, 8);
  assert.deepEqual(verdict.assurance, { level: "rpc-quorum-inclusion", confirmationBasis: "lowest-latest-head", safe: "not-checked", finalized: "not-checked", requiredConfirmations: 12 });
  assert.equal(exitCodeFor(verdict), 0);
  assert.match(renderVerdict(verdict).join("\n"), /canonical receipt documents agree/);
  assert.doesNotMatch(renderVerdict(verdict).join("\n"), /byte-identical/);
});

test("Bankr policy cannot be overridden and legacy rpc injection cannot be silently ignored", async () => {
  let calls = 0; const fetch = async () => { calls++; throw new Error(); };
  for (const extra of [{ rpc: forbiddenFetch }, { allowedRpcHosts: ["evil.example"] }, { extra: true }]) {
    assert.equal((await verifySettlement({ ...TYPED, fetch, ...extra })).reason, "verifier_misconfigured");
  }
  assert.equal(calls, 0);
});

test("mutating public policy arrays cannot retarget receipt defaults or widen its allowlist", async () => {
  const defaults = [...DEFAULT_RPCS], hosts = [...ALLOWED_BASE_RPC_HOSTS];
  let refused, verdict, fixture;
  try {
    DEFAULT_RPCS.splice(0, DEFAULT_RPCS.length, ...RPCS);
    ALLOWED_BASE_RPC_HOSTS.push("evil.example");
    fixture = fetchServing();
    verdict = await verifySettlement({ ...TYPED, fetch: fixture.fetch });
    refused = await verifySettlement({ ...TYPED, rpcUrls: ["https://evil.example", RPCS[1]], fetch: forbiddenFetch });
  } finally {
    DEFAULT_RPCS.splice(0, DEFAULT_RPCS.length, ...defaults);
    ALLOWED_BASE_RPC_HOSTS.splice(0, ALLOWED_BASE_RPC_HOSTS.length, ...hosts);
  }
  assert.equal(verdict.ok, true);
  assert.deepEqual([...new Set(fixture.calls.map(call => host(call.url)))], defaults.map(host));
  assert.equal(refused.reason, "rpc_host_not_allowlisted");
});

test("endpoint policy, invalid inputs and sub-floor depth refuse before fetch", async () => {
  let calls = 0; const fetch = async () => { calls++; throw new Error(); };
  for (const [extra, reason] of [
    [{ rpcUrls: ["https://evil.example", RPCS[1]] }, "rpc_host_not_allowlisted"],
    [{ rpcUrls: ["http://mainnet.base.org", RPCS[1]] }, "rpc_not_https"],
    [{ rpcUrls: ["https://mainnet.base.org", "https://mainnet.base.org:443/path"] }, "insufficient_rpc_quorum"],
    [{ rpcUrls: ["https://localhost:1", "https://127.0.0.1:2"], allowUnpinnedRpc: true }, "insufficient_rpc_quorum"],
    [{ rpcUrls: [] }, "no_rpc_endpoints"], [{ tx: TX.slice(2) }, "bad_tx_hash"],
    [{ minConfirmations: 11 }, "verifier_misconfigured"], [{ minConfirmations: 2 ** 53 }, "verifier_misconfigured"],
    [{ allowUnpinnedRpc: "true" }, "verifier_misconfigured"], [{ amount: 50000 }, "bad_typed_terms"],
  ]) assert.equal((await verifySettlement({ ...TYPED, fetch, ...extra })).reason, reason);
  assert.equal(calls, 0);
  const refused = await verifySettlement({ ...TYPED, fetch, rpcUrls: ["https://evil.example", RPCS[1]] });
  assert.match(refused.detail, /--allow-unpinned-rpc/);
});

test("explicit unpinned success remains a distinct verdict and exit 2", async () => {
  const fixture = fetchServing();
  const verdict = await verifySettlement({ ...TYPED, fetch: fixture.fetch, rpcUrls: ["https://a.example/key", "https://b.example/key"], allowUnpinnedRpc: true });
  assert.equal(verdict.ok, true); assert.equal(exitCodeFor(verdict), 2);
  assert.deepEqual(verdict.unpinnedHosts, ["a.example", "b.example"]);
  assert.match(renderVerdict(verdict)[0], /^PROVEN-UNPINNED/);
  assert.match(renderVerdict(verdict).join("\n"), /NOT on the reviewed allowlist/);
});

test("historical complete grant is hashed by the SDK and can settle above its floor", async () => {
  const grant = GRANT(), hash = await envelopeHash(grant);
  const fixture = fetchServing(receiptOf(hash, "50001"));
  const verdict = await verifySettlement({ tx: TX, grant, fetch: fixture.fetch });
  assert.equal(verdict.ok, true, JSON.stringify(verdict));
  assert.equal(verdict.grantHash, hash); assert.equal(verdict.value, "50001");
  assert.deepEqual(verdict.terms, { source: "grant", expiresAt: grant.expires_at, band: { min: "50000", max: "5000000" } });
  assert.match(renderVerdict(verdict).join("\n"), /payment proven for THIS grant/);
});

test("payee pin applies to grant mode before any fetch, while typed mode stays independent", async () => {
  let calls = 0;
  const refused = await verifySettlement({ tx: TX, grant: GRANT({ price_payee_account: `eip155:8453:${OTHER}` }), fetch: async () => { calls++; } });
  assert.equal(refused.reason, "grant_payee_not_pinned"); assert.equal(calls, 0);
  assert.doesNotMatch(refused.detail, /333333/);
  const fixture = fetchServing(receiptOf(GRANT_A, "50000", OTHER));
  assert.equal((await verifySettlement({ ...TYPED, payee: OTHER, fetch: fixture.fetch })).ok, true);
});

test("pin and SDK hashing use the same retained grant after the caller mutates it", async () => {
  const grant = GRANT(), hash = grantHashOf(grant), fixture = fetchServing(receiptOf(hash));
  const pending = verifySettlement({ tx: TX, grant, fetch: fixture.fetch });
  grant.price_payee_account = `eip155:8453:${OTHER}`; grant.offer_hash = "ff".repeat(32);
  const verdict = await pending;
  assert.equal(verdict.ok, true); assert.equal(verdict.grantHash, hash); assert.equal(verdict.payee, PAYEE_A);
});

test("null, malformed, accessor and arbitrary-expiry grants refuse without fetch or disclosure", async () => {
  let reads = 0, calls = 0;
  const accessor = GRANT(); Object.defineProperty(accessor, "price_payee_account", { enumerable: true, get() { reads++; return EXPECTED_PAYEE_ACCOUNT; } });
  for (const grant of [null, [], { wire: { grant: GRANT() } }, accessor, GRANT({ expires_at: "https://user:SECRET@example/key" }), { ...GRANT(), extra: "x" }]) {
    const result = await verifySettlement({ ...TYPED, grant, fetch: async () => { calls++; } });
    assert.equal(result.reason, "grant_not_a_grant_envelope"); assert.doesNotMatch(JSON.stringify(result), /SECRET/);
  }
  assert.equal(reads, 0); assert.equal(calls, 0);
  const trapped = new Proxy({}, { ownKeys() { throw new Error("https://user:SECRET@example/key"); } });
  assert.deepEqual(await verifySettlement(trapped), { ok: false, reason: "verifier_exception", detail: "the supplied data could not be read; underlying messages are withheld" });
});

test("typed spelling and grant cross-checks retain their CLI meanings", async () => {
  const grant = GRANT(), hash = grantHashOf(grant), fixture = fetchServing(receiptOf(hash));
  const base = { tx: TX, grant, fetch: fixture.fetch };
  assert.equal((await verifySettlement({ ...base, grantHash: "0x" + hash.toUpperCase(), amount: "00050000" })).ok, true);
  assert.equal((await verifySettlement({ ...base, amount: "50001" })).reason, "exact_value");
  assert.equal((await verifySettlement({ ...base, amount: "5000001" })).reason, "grant_terms_mismatch");
  assert.equal((await verifySettlement({ ...base, payer: OTHER })).reason, "grant_terms_mismatch");
  assert.equal((await verifySettlement({ ...TYPED, amount: "050000", fetch: fetchServing().fetch })).ok, true);
  assert.equal((await verifySettlement({ ...TYPED, amount: "0", fetch: forbiddenFetch })).reason, "bad_amount");
});

test("SDK receipt failures and transport envelopes pass through the adapter without raw text", async () => {
  for (const [modify, reason] of [
    [(call, value) => call.method === "eth_chainId" ? "0x1" : value, "wrong_chain"],
    [(call, value) => call.method === "eth_getTransactionReceipt" ? { ...value, transactionHash: "0x" + "cd".repeat(32) } : value, "receipt_not_for_this_tx"],
    [(call, value) => call.method === "eth_blockNumber" ? "0x103" : value, "insufficient_confirmations"],
  ]) assert.equal((await verifySettlement({ ...TYPED, fetch: fetchServing(receiptOf(), modify).fetch })).reason, reason);
  const invalid = await verifySettlement({ ...TYPED, fetch: async () => jsonResponse({ result: "0x2105" }) });
  assert.equal(invalid.reason, "rpc_envelope_invalid");
  const failed = await verifySettlement({ ...TYPED, fetch: async () => { throw new Error("https://user:SECRET@example/key"); } });
  assert.equal(failed.reason, "rpc_network"); assert.doesNotMatch(JSON.stringify(failed), /SECRET|https:/);
});

test("independent synchronous fixture hashes agree with installed SDK primitives", async () => {
  const grant = GRANT(), hash = await envelopeHash(grant);
  assert.equal(grantHashOf(grant), hash); assert.equal(bindingNonce(hash), await settlementNonce(hash));
  assert.equal(grantHashOf({ ...grant, extra: null }), hash);
  assert.throws(() => sdkCanonicalize({ n: 1.5 }), /finite integers/);
  assert.equal(operatorKeyOf(new URL("https://LOCALHOST:8443")), "loopback");
  assert.equal(operatorKeyOf(new URL("https://mainnet.base.org.:8443")), "mainnet.base.org");
  assert.equal(host("https://user:SECRET@example.test:8443/key"), "example.test:8443");
  assert.ok(DEFAULT_RPCS.every(url => ALLOWED_BASE_RPC_HOSTS.includes(host(url))));
});

test("CLI pinned and unpinned successes use actual SDK fetch responses and preserve exit/output", () => {
  const pinned = runSuccessfulCli(typedArgs);
  assert.equal(pinned.status, 0, pinned.stderr); assert.match(pinned.stdout, /^PROVEN\n/);
  assert.match(pinned.stdout, /as typed on the command line/);
  const calls = JSON.parse(pinned.stderr.trim().replace(/^CALLS=/, ""));
  assert.equal(calls.length, 8); assert.deepEqual([...new Set(calls.map(c => host(c.url)))], DEFAULT_RPCS.map(host));
  const unpinned = runSuccessfulCli([...typedArgs, "--rpc", "https://a.example/key", "--rpc", "https://b.example/key", "--allow-unpinned-rpc"]);
  assert.equal(unpinned.status, 2, unpinned.stderr); assert.match(unpinned.stdout, /^PROVEN-UNPINNED/);
});

test("CLI historical grant file succeeds and null cannot fall through to typed mode", t => {
  const dir = mkdtempSync(join(tmpdir(), "vs-cli-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "grant.json"), grant = GRANT(); writeFileSync(path, JSON.stringify(grant));
  const success = runSuccessfulCli(["--tx", TX, "--grant", path], receiptOf(grantHashOf(grant)));
  assert.equal(success.status, 0, success.stderr); assert.match(success.stdout, /read off the --grant envelope/);
  writeFileSync(path, "null");
  const refused = runCli([...typedArgs, "--grant", path]);
  assert.equal(refused.status, 1); assert.match(refused.stderr, /grant_not_a_grant_envelope/); assert.doesNotMatch(refused.stderr, /NETWORK_ATTEMPTED/);
});

test("CLI flags and credential-shaped inputs refuse without network or reflected secrets", () => {
  for (const [args, reason] of [
    [[...typedArgs, "--grant"], "flag_value_missing"], [[...typedArgs, "--rpc"], "flag_value_missing"],
    [[...typedArgs, "--tx", TX], "duplicate_flag"], [["--bogus", "x"], "unknown_flag"],
    [[`--rpc=https://user:SECRET@example/key`], "flag_form_unsupported"],
    [["https://user:SECRET@example/key"], "unknown_argument"],
    [["--tx", TX, "--grant", "https://user:SECRET@example/key"], "grant_unreadable"],
  ]) {
    const result = runCli(args); assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, new RegExp(reason)); assert.doesNotMatch(result.stderr + result.stdout, /SECRET|NETWORK_ATTEMPTED|PROVEN/);
  }
});

test("CLI realpath entry point still runs through a symlinked skill directory", t => {
  const dir = mkdtempSync(join(tmpdir(), "vs-link-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  symlinkSync(SKILL2, join(dir, "skill")); const linked = join(dir, "skill", "scripts", "verify-settlement.mjs");
  const result = spawnSync(process.execPath, [linked], { encoding: "utf8", timeout: 5000 });
  assert.equal(result.status, 1); assert.match(result.stderr, /^usage:/);
  assert.equal(invokedAsMain(linked, new URL("../scripts/verify-settlement.mjs", import.meta.url).href), true);
  assert.equal(invokedAsMain(undefined, import.meta.url), false);
});

test("CLI grant cap and regular-file errors retain their named translation", t => {
  const dir = mkdtempSync(join(tmpdir(), "vs-cap-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const big = join(dir, "big.json"); writeFileSync(big, " ".repeat(65537));
  for (const [path, detail] of [[dir, /not a regular file/], [big, /exceeds its 65536-byte limit/], [join(dir, "missing"), /path withheld/]]) {
    const result = runCli(["--tx", TX, "--grant", path]); assert.equal(result.status, 1);
    assert.match(result.stderr, /grant_unreadable/); assert.match(result.stderr, detail); assert.doesNotMatch(result.stderr, /NETWORK_ATTEMPTED/);
  }
});

// Gas transport remains adapter-owned, so its bounds cannot be delegated to SDK tests.
const GAS_URL = "https://mainnet.base.org/synthetic";
const gas = fetch => httpRpc(GAS_URL, "eth_gasPrice", [], { fetch });
const gasReply = (init, result = "0x1") => jsonResponse({ jsonrpc: "2.0", id: JSON.parse(init.body).id, result });
function fakeGasClock(t) {
  const delays = [], deadlines = [];
  t.mock.method(globalThis, "setTimeout", (callback, ms) => {
    if (ms === 20000) deadlines.push(callback);
    else { delays.push(ms); queueMicrotask(callback); }
    return {};
  });
  t.mock.method(globalThis, "clearTimeout", () => {});
  return { delays, deadlines };
}

test("gas reader admits only no-argument gas price and HTTPS without URL credentials", async () => {
  let calls = 0;
  const fetch = async (_url, init) => { calls++; assert.deepEqual(JSON.parse(init.body).params, []); return gasReply(init); };
  for (const [url, method, params] of [[GAS_URL, "eth_estimateGas", [{}]], [GAS_URL, "eth_chainId", []], [GAS_URL, "eth_gasPrice", ["SECRET"]], ["http://mainnet.base.org", "eth_gasPrice", []], ["https://user:SECRET@mainnet.base.org/key", "eth_gasPrice", []]]) {
    await assert.rejects(httpRpc(url, method, params, { fetch }), error => { assert.doesNotMatch(error.message, /SECRET/); return true; });
  }
  READ_METHODS.add("eth_sendRawTransaction");
  try { await assert.rejects(httpRpc(GAS_URL, "eth_sendRawTransaction", [], { fetch }), /refusing non-read method/); }
  finally { READ_METHODS.delete("eth_sendRawTransaction"); }
  assert.equal(calls, 0); assert.equal(await gas(fetch), "0x1"); assert.equal(calls, 1);
});

test("gas reader pins request privacy and validates matching numeric JSON-RPC id", async () => {
  await gas(async (_url, init) => {
    assert.equal(init.redirect, "error"); assert.equal(init.credentials, "omit"); assert.equal(init.referrerPolicy, "no-referrer");
    assert.equal(init.headers["accept-encoding"], "identity"); assert.equal(init.method, "POST");
    const request = JSON.parse(init.body); assert.equal(request.method, "eth_gasPrice"); assert.equal(request.jsonrpc, "2.0");
    assert.equal(typeof request.id, "number"); assert.equal(init.signal.aborted, false); return gasReply(init);
  });
  for (const change of [body => { delete body.id; }, body => { body.id = String(body.id); }, body => { body.id++; }, body => { delete body.jsonrpc; }, body => { body.jsonrpc = "1.0"; }, body => { body.error = null; }, body => { delete body.result; }, body => { delete body.result; body.error = { code: "1", message: "SECRET" }; }]) {
    let calls = 0;
    await assert.rejects(gas(async (_url, init) => { calls++; const body = { jsonrpc: "2.0", id: JSON.parse(init.body).id, result: "0x1" }; change(body); return jsonResponse(body); }), { code: "RPC_ENVELOPE_INVALID" });
    assert.equal(calls, 1);
  }
  await assert.rejects(gas(async (_url, init) => jsonResponse({ jsonrpc: "2.0", id: JSON.parse(init.body).id, error: { code: -1, message: "SECRET" } })), error => error.code === "RPC_ERROR" && !error.message.includes("SECRET"));
});

test("gas declared and cumulative stream caps refuse with the retained body code", async () => {
  let cancelled = 0;
  const large = new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { "content-length": String(MAX_RPC_BODY_BYTES + 1) } });
  await assert.rejects(gas(async () => large), { code: "RPC_BODY_TOO_LARGE" }); assert.ok(cancelled > 0);
  const streamed = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_RPC_BODY_BYTES)); controller.enqueue(new Uint8Array(1)); controller.close(); } }), { headers: { "content-length": "1" } });
  await assert.rejects(gas(async () => streamed), { code: "RPC_BODY_TOO_LARGE" });
  assert.equal(await gas(async (_url, init) => {
    const text = JSON.stringify({ jsonrpc: "2.0", id: JSON.parse(init.body).id, result: "0x1" });
    return new Response(text + " ".repeat(MAX_RPC_BODY_BYTES - Buffer.byteLength(text)));
  }), "0x1");
});

test("gas depth scan precedes parsing and invalid JSON/UTF-8 remain final", async () => {
  await assert.rejects(gas(async () => new Response("[".repeat(MAX_CANONICAL_DEPTH + 1))), { code: "RPC_BODY_TOO_DEEP" });
  for (const body of ["", "not JSON", new Uint8Array([0xff])]) await assert.rejects(gas(async () => new Response(body)), { code: "RPC_JSON_INVALID" });
});

test("gas HTTP429/5xx and exact fetch-failed retries stop after three attempts", async t => {
  const clock = fakeGasClock(t);
  for (const response of [() => new Response("", { status: 429 }), () => new Response("", { status: 503 }), () => { throw new TypeError("fetch failed"); }]) {
    let calls = 0; const before = clock.delays.length;
    await assert.rejects(gas(async () => { calls++; return response(); }));
    assert.equal(calls, 3); assert.deepEqual(clock.delays.slice(before), [400, 1200]);
  }
  const ids = []; let calls = 0;
  assert.equal(await gas(async (_url, init) => { ids.push(JSON.parse(init.body).id); return ++calls === 1 ? new Response("", { status: 503 }) : gasReply(init); }), "0x1");
  assert.equal(new Set(ids).size, 2);
});

test("gas redirects, other HTTP errors, arbitrary throws and failed streams never retry", async t => {
  const clock = fakeGasClock(t);
  for (const response of [() => new Response("", { status: 302 }), () => new Response("", { status: 404 }), () => { throw new Error("SECRET"); }, () => { throw new TypeError("prefix fetch failed SECRET"); }, () => new Response(new ReadableStream({ start(controller) { controller.error(new TypeError("fetch failed")); } }))]) {
    let calls = 0;
    await assert.rejects(gas(async () => { calls++; return response(); }), error => !error.message.includes("SECRET")); assert.equal(calls, 1);
  }
  const redirected = new Response("{}"); Object.defineProperty(redirected, "redirected", { value: true });
  await assert.rejects(gas(async () => redirected), { code: "RPC_REDIRECT" }); assert.deepEqual(clock.delays, []);
});

test("gas deadline bounds a noncooperative fetch and stream without awaiting cancellation", async t => {
  const clock = fakeGasClock(t); let signal;
  const pending = gas(async (_url, init) => { signal = init.signal; return new Promise(() => {}); });
  clock.deadlines.at(-1)(); await assert.rejects(pending, { code: "RPC_TIMEOUT" }); assert.equal(signal.aborted, true);
  let cancelled = 0;
  const streamed = gas(async () => new Response(new ReadableStream({ cancel() { cancelled++; return new Promise(() => {}); } })));
  await Promise.resolve(); await Promise.resolve();
  clock.deadlines.at(-1)(); await assert.rejects(streamed, { code: "RPC_TIMEOUT" }); assert.ok(cancelled > 0); assert.deepEqual(clock.delays, []);
});

test("gas late fetch and late EOF respect monotonic deadline before timer dispatch", async t => {
  const clock = fakeGasClock(t); let now = 0, finish;
  t.mock.method(performance, "now", () => now); t.mock.method(Date, "now", () => -100000);
  const pending = gas(async () => new Promise(resolve => { finish = resolve; }));
  now = 20000; finish(new Response("{}")); await assert.rejects(pending, { code: "RPC_TIMEOUT" });
  now = 0; let controller;
  const streamed = gas(async (_url, init) => new Response(new ReadableStream({ start(c) { controller = c; c.enqueue(new TextEncoder().encode(JSON.stringify({ jsonrpc: "2.0", id: JSON.parse(init.body).id, result: "0x1" }))); } })));
  for (let i = 0; i < 5; i++) await Promise.resolve();
  now = 20000; controller.close(); await assert.rejects(streamed, { code: "RPC_TIMEOUT" }); assert.deepEqual(clock.delays, []);
});

// Faults are scoped to a synthetic grant's descriptor. Module-loader reads and
// closes keep their real behavior; no installed package or remote endpoint runs.
function grantReadFixture(t, fault = "") {
  const dir = mkdtempSync(join(tmpdir(), "vs-grant-read-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const target = join(dir, "grant.json");
  writeFileSync(target, "{}");
  const preload = join(dir, "fault.cjs");
  writeFileSync(preload, `
const fs = require("node:fs");
const target = ${JSON.stringify(target)};
const original = { ...fs };
let owned = null, total = 0;
fs.openSync = (...args) => {
  const fd = original.openSync(...args);
  if (args[0] === target) owned = fd;
  return fd;
};
fs.readSync = (...args) => {
  const n = original.readSync(...args);
  if (args[0] === owned) total += n;
  return n;
};
globalThis.fetch = async () => { process.stderr.write("NETWORK_ATTEMPTED"); throw new Error("network forbidden"); };
process.on("exit", () => process.stderr.write("READ_BYTES=" + total + "\\n"));
${fault}
`);
  return { dir, target, run: () => spawnSync(process.execPath,
    ["--require", preload, CLI, "--tx", TX, "--grant", target],
    { encoding: "utf8", timeout: 5000 }) };
}

function assertGrantReadRefused(result) {
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /REFUSED\s+grant_unreadable/);
  assert.doesNotMatch(result.stderr + result.stdout, /NETWORK_ATTEMPTED|PROVEN|SYNTHETIC_PRIVATE_ERROR/);
}

test("grant CLI caps actual descriptor bytes when a small file grows after fstat", (t) => {
  const fixture = grantReadFixture(t, `
const countedRead = fs.readSync;
let grew = false;
fs.readSync = (...args) => {
  if (args[0] === owned && !grew) {
    grew = true;
    original.writeFileSync(target, " ".repeat(100000));
  }
  return countedRead(...args);
};`);
  const result = fixture.run();
  assertGrantReadRefused(result);
  assert.match(result.stderr, /exceeds its 65536-byte limit/);
  assert.match(result.stderr, /READ_BYTES=65537\n/);
});

test("grant CLI rejects replacement between lstat and open before reading bytes", (t) => {
  const fixture = grantReadFixture(t, `
fs.lstatSync = (...args) => {
  const stat = original.lstatSync(...args);
  if (args[0] === target) {
    original.writeFileSync(target + ".replacement", "{}");
    original.renameSync(target + ".replacement", target);
  }
  return stat;
};`);
  const result = fixture.run();
  assertGrantReadRefused(result);
  assert.match(result.stderr, /READ_BYTES=0\n/);
});

test("grant CLI refuses a failed descriptor close without disclosing the OS error", (t) => {
  const fixture = grantReadFixture(t, `
fs.closeSync = (fd) => {
  original.closeSync(fd);
  if (fd === owned) throw new Error("SYNTHETIC_PRIVATE_ERROR");
};`);
  assertGrantReadRefused(fixture.run());
});

test("grant CLI rejects final-component symlinks without reading their target", (t) => {
  const fixture = grantReadFixture(t);
  const other = join(fixture.dir, "other.json");
  writeFileSync(other, "{}");
  rmSync(fixture.target);
  symlinkSync(other, fixture.target);
  const result = fixture.run();
  assertGrantReadRefused(result);
  assert.match(result.stderr, /READ_BYTES=0\n/);
});

test("grant CLI refuses invalid UTF-8 instead of parsing replacement characters", (t) => {
  const fixture = grantReadFixture(t);
  writeFileSync(fixture.target, Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d]));
  const result = fixture.run();
  assertGrantReadRefused(result);
  assert.match(result.stderr, /--grant is not JSON/);
});

// Exact baseline assertions restored after the per-test responsibility review.
test("later same-payer hire selects its own paired transfer and rejects another hire's amount/payee", async () => {
  const otherHash = "bb".repeat(32);
  const early = receiptOf(GRANT_A, "5000000"), later = receiptOf(otherHash, "1", OTHER);
  later.logs[0].logIndex = "0x2"; later.logs[1].logIndex = "0x3";
  const batched = { ...early, logs: [...early.logs, ...later.logs] };
  const base = { ...TYPED, grantHash: otherHash, payee: OTHER, amount: "1", fetch: fetchServing(batched).fetch };
  const success = await verifySettlement(base);
  assert.equal(success.ok, true); assert.equal(success.authLogIndex, 2); assert.equal(success.transferLogIndex, 3); assert.equal(success.value, "1");
  assert.equal((await verifySettlement({ ...base, amount: "5000000" })).reason, "exact_value");
  assert.equal((await verifySettlement({ ...base, payee: PAYEE_A })).reason, "transfer_recipient_mismatch");
});

test("receipt identity precedes malformed logs and is checked on the second peer", async () => {
  const bad = { ...receiptOf(), transactionHash: "0x" + "cd".repeat(32), logs: [{ address: CANONICAL_USDC_BASE, topics: [], data: "0x" }] };
  assert.equal((await verifySettlement({ ...TYPED, fetch: fetchServing(bad).fetch })).reason, "receipt_not_for_this_tx");
  const peers = fetchServing(receiptOf(), (call, value) => call.method === "eth_getTransactionReceipt" && host(call.url) === host(RPCS[1]) ? bad : value);
  assert.equal((await verifySettlement({ ...TYPED, rpcUrls: RPCS, fetch: peers.fetch })).reason, "receipt_not_for_this_tx");
  assert.equal(peers.calls.filter(call => call.method === "eth_getTransactionReceipt").length, 2);
});

test("uppercase receipt hash remains the same transaction", async () => {
  const receipt = { ...receiptOf(), transactionHash: "0x" + "AB".repeat(32) };
  assert.equal((await verifySettlement({ ...TYPED, fetch: fetchServing(receipt).fetch })).ok, true);
});

test("a malformed extra canonical-USDC log after a valid pair cannot disappear from admission", async () => {
  for (const topics of [TOPIC_TRANSFER, { 0: TOPIC_TRANSFER }, 7, null]) {
    const receipt = receiptOf(); receipt.logs.push({ ...receipt.logs[1], topics, logIndex: "0x2" });
    assert.equal((await verifySettlement({ ...TYPED, fetch: fetchServing(receipt).fetch })).reason, "log_topics_malformed");
  }
});

test("unpinned opt-in never lifts HTTPS and configured assurance depth is retained", async () => {
  let calls = 0;
  const bad = await verifySettlement({ ...TYPED, rpcUrls: ["http://a.example", "https://b.example"], allowUnpinnedRpc: true, fetch: async () => { calls++; } });
  assert.equal(bad.reason, "rpc_not_https"); assert.equal(calls, 0);
  const fixture = fetchServing(receiptOf(), (call, value) => call.method === "eth_blockNumber" ? "0x10d" : value);
  const success = await verifySettlement({ ...TYPED, rpcUrls: ["https://a.example", "https://b.example"], allowUnpinnedRpc: true, minConfirmations: 13, fetch: fixture.fetch });
  assert.equal(success.ok, true); assert.equal(success.confirmations, 13);
  assert.equal(success.assurance.requiredConfirmations, 13); assert.equal(success.assurance.safe, "not-checked"); assert.equal(success.assurance.finalized, "not-checked");
});

test("credential-shaped flag names and a 60000-character host produce bounded redacted CLI refusals", () => {
  const SECRET = "SECRET-API-KEY-1234";
  for (const [args, expected] of [
    [["--tx", TX, `--rpchttps://base.drpc.org/v2/${SECRET}`, "x"], /unknown_flag — \(flag name withheld/],
    [["--tx", TX, `--https://base.drpc.org/v2/${SECRET}=1`], /flag_form_unsupported — \(flag name withheld/],
    [["--tx", TX, "--grant_hash", "beef"], /unknown_flag — --grant_hash/],
  ]) {
    const result = runCli(args); assert.equal(result.status, 1); assert.match(result.stderr, expected); assert.doesNotMatch(result.stderr, /SECRET|NETWORK_ATTEMPTED/);
  }
  const huge = runCli([...typedArgs, "--rpc", "https://" + "a".repeat(60000) + ".example", "--rpc", RPCS[1]]);
  assert.equal(huge.status, 1); assert.match(huge.stderr, /^REFUSED\s+rpc_host_not_allowlisted/); assert.ok(huge.stderr.length < 1200); assert.doesNotMatch(huge.stderr, /NETWORK_ATTEMPTED/);
});

test("typed verdict scope explicitly withholds grant-term and delivery claims", async () => {
  const verdict = await verifySettlement({ ...TYPED, fetch: fetchServing().fetch });
  const lines = renderVerdict(verdict), scope = lines.filter(line => /scope:|^\s{17}/.test(line)).join(" ");
  assert.match(scope, /was not checked/); assert.match(scope, /--grant/); assert.match(scope, /Delivery is a separate proof/); assert.doesNotMatch(scope, /exact hire/);
});

test("all original malformed grant field cases refuse before reading", async () => {
  const missing = GRANT(); delete missing.nonce;
  const changes = [missing, GRANT({ price_min_amount: 50000 }), GRANT({ price_min_amount: "0" }),
    GRANT({ price_payer_account: `eip155:1:${PAYER}` }), GRANT({ price_payee_account: "eip155:8453:notanaddress" }),
    GRANT({ price_min_amount: "6000000" }), GRANT({ price_payer_account: "eip155:8453:0x" + "AB".repeat(20) }),
    { ...GRANT(), __proto__: null, extra: "unknown" }];
  for (const grant of changes) {
    let calls = 0; const result = await verifySettlement({ tx: TX, grant, fetch: async () => { calls++; } });
    assert.equal(result.reason, "grant_not_a_grant_envelope"); assert.equal(calls, 0);
  }
  for (const [grant, reason] of [[GRANT({ price_chain: "eip155:1" }), "grant_chain_not_base"], [GRANT({ price_asset: `eip155:8453/erc20:${OTHER}` }), "grant_asset_not_canonical_usdc"], [GRANT({ price_asset: `eip155:8453/erc20:${CANONICAL_USDC_BASE.toUpperCase()}` }), "grant_asset_not_canonical_usdc"]]) {
    let calls = 0; assert.equal((await verifySettlement({ tx: TX, grant, fetch: async () => { calls++; } })).reason, reason); assert.equal(calls, 0);
  }
});

test("operator-controlled status/block text and large ambiguity cases cannot forge or inflate refusals", async () => {
  const forged = "0x100\nPROVEN\n  scope: forged\n\x1b[2K";
  const cases = [
    [fetchServing({ ...receiptOf(), status: forged }).fetch, "tx_reverted"],
    [fetchServing({ ...receiptOf(), status: "0x0" + "0".repeat(4000000) }).fetch, "tx_reverted"],
    [fetchServing({ ...receiptOf(), blockNumber: "0x1" + "f".repeat(100000) }).fetch, "receipt_not_mined"],
  ];
  for (const number of [forged, ["0x100", "PROVEN"], { a: "PROVEN" }, "0x100\u2028PROVEN", "P".repeat(500000)]) {
    cases.push([fetchServing(receiptOf(), (call, value) => call.method === "eth_getBlockByNumber" ? { number, hash: BLOCK_HASH } : value).fetch, "block_hash_mismatch"]);
  }
  cases.push([fetchServing(receiptOf(), (call, value) => call.method === "eth_getBlockByNumber" ? { number: "0x100", hash: forged } : value).fetch, "block_hash_mismatch"]);
  const ambiguous = receiptOf();
  for (let i = 2; i <= 3000; i++) ambiguous.logs.push({ ...ambiguous.logs[1], logIndex: "0x" + i.toString(16) });
  cases.push([fetchServing(ambiguous).fetch, "transfer_ambiguous"]);
  for (const [fetch, reason] of cases) {
    const result = await verifySettlement({ ...TYPED, fetch }); assert.equal(result.reason, reason);
    assert.ok(result.detail.length < 400); assert.doesNotMatch(result.detail, /PROVEN|\n|\x1b|\u2028/);
  }
});

test("native Node fetch decompression and endless chunking remain bounded through injected loopback transport", async t => {
  const bomb = gzipSync(Buffer.alloc(MAX_RPC_BODY_BYTES * 16, 0x20));
  const server = createServer((request, response) => {
    if (request.url === "/gzip") {
      response.writeHead(200, { "content-type": "application/json", "content-encoding": "gzip", "content-length": String(bomb.length) }); response.end(bomb); return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    const chunk = Buffer.alloc(1024 * 1024, 0x20);
    const push = () => {
      if (response.destroyed) return;
      while (!response.destroyed && response.write(chunk)) {}
      if (!response.destroyed) response.once("drain", push);
    };
    push();
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => { server.closeAllConnections(); server.close(); });
  const port = server.address().port;
  for (const route of ["gzip", "chunked"]) {
    const rewrittenFetch = (url, init) => {
      assert.equal(new URL(url).protocol, "https:"); assert.ok(ALLOWED_BASE_RPC_HOSTS.includes(host(url)));
      return nativeFetch(`http://127.0.0.1:${port}/${route}`, init);
    };
    await assert.rejects(gas(rewrittenFetch), { code: "RPC_BODY_TOO_LARGE" });
    assert.equal((await verifySettlement({ ...TYPED, fetch: rewrittenFetch })).reason, "rpc_body_too_large");
  }
});
