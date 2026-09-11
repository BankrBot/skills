#!/usr/bin/env node
// Verify one historical Base-USDC settlement using @voidly/session.
// Bankr retains its grant-payee pin, RPC defaults/allowlist and CLI presentation.
// Hostname grouping does not establish organizational independence. Success is
// quorum-observed inclusion with latest-head depth, not safe/finalized status,
// current grant authority, or delivery. Unpinned success remains exit 2.
// The separate fee reader sends only eth_gasPrice with no parameters.

import { verifySettlement as verifySdkSettlement } from "@voidly/session";
import { realpathSync } from "node:fs";
import { LocalFileError, readFileCapped } from "@voidly/session/node-files";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_PAYEE_ACCOUNT,
  ALLOWED_BASE_RPC_HOSTS,
  usableArgValue,
} from "./lib/pins.mjs";

export const MIN_CONFIRMATIONS = 12;
export const MIN_OPERATORS = 2;
// The two operators read when no --rpc is given. Both serve archive receipts
// and both answered 10/10 and 12/12 under a rapid burst on 2026-09-03.
// mainnet.base.org is allowlisted but deliberately NOT here: it rate-limits
// under this script's own four-call sequence (3/12 HTTP 503 measured the same
// day), and a default pair with one flaky member cannot prove anything.
export const DEFAULT_RPCS = ["https://base.gateway.tenderly.co", "https://base-mainnet.public.blastapi.io"];
const RECEIPT_DEFAULT_RPCS = Object.freeze([...DEFAULT_RPCS]);
const RECEIPT_ALLOWED_RPC_HOSTS = Object.freeze([...ALLOWED_BASE_RPC_HOSTS]);

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Retain the bounded JSON-body limit for the separate fee reader. */
export const MAX_RPC_BODY_BYTES = 4 * 1024 * 1024;
/** Bound nesting before JSON.parse in the fee reader. */
export const MAX_CANONICAL_DEPTH = 64;
/** A task-grant envelope is ~1 KB. */
export const MAX_GRANT_FILE_BYTES = 64 * 1024;

/**
 * Who runs the node — the identity two --rpc values are deduplicated on.
 * `u.host` keeps a non-default port, so one box on two ports was "2/2
 * agreed" under --allow-unpinned-rpc, and `localhost` beside `127.0.0.1` was
 * two operators. Hostname only, with every loopback spelling folded into one.
 */
export const operatorKeyOf = (u) => {
  // Hostname, brackets off, trailing dots off (`mainnet.base.org.` is the
  // same name in the DNS). The URL parser has already canonicalized IPv6
  // spellings (`[0:0:0:0:0:0:0:1]` → `::1`, `[::ffff:127.0.0.1]` →
  // `::ffff:7f00:1`), so the loopback test is on the canonical forms.
  const name = String(u.hostname ?? "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  if (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name === "::1" ||
    name === "::" ||
    name === "0.0.0.0" ||
    /^127\.\d+\.\d+\.\d+$/.test(name) ||
    /^::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}$/.test(name) ||
    /^::ffff:127\.\d+\.\d+\.\d+$/.test(name) ||
    name === "::ffff:0:0" ||
    name === "::ffff:0.0.0.0"
  ) {
    return "loopback";
  }
  return name;
};

/** Host names only — an RPC URL can carry an API key in its path. */
export const host = (u) => {
  try {
    return new URL(u).host;
  } catch {
    return "unparseable";
  }
};

/** Does this JSON text open more than `limit` nested arrays/objects? Strings
 *  are skipped (a bracket inside a string is data). Linear, allocation-free. */
export function nestingDepthExceeds(text, limit) {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (inString) {
      if (c === 0x5c) i += 1; // backslash: skip the escaped char
      else if (c === 0x22) inString = false;
      continue;
    }
    if (c === 0x22) inString = true;
    else if (c === 0x5b || c === 0x7b) {
      depth += 1;
      if (depth > limit) return true;
    } else if (c === 0x5d || c === 0x7d) depth -= 1;
  }
  return false;
}

// Only the fee preview uses this transport. Receipt reads belong to the SDK.
export const READ_METHODS = new Set(["eth_gasPrice"]);
const RPC_RETRY_DELAYS_MS = [400, 1200];
const gasErrors = new WeakSet();
const gasError = (message, code, retryable = false) => {
  const error = Object.assign(new Error(message), { code, retryable });
  gasErrors.add(error);
  return Object.freeze(error);
};
const bodyTooLarge = () => gasError("rpc body too large", "RPC_BODY_TOO_LARGE");
const bodyTooDeep = () => gasError("rpc body nested too deeply", "RPC_BODY_TOO_DEEP");
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
let nextGasId = 1;

export async function httpRpc(url, method, params, options = {}) {
  // Do not use the exported mutable Set as the authority for admitted methods.
  if (method !== "eth_gasPrice") throw gasError("refusing non-read method", "RPC_METHOD_REFUSED");
  try {
    if (!Array.isArray(params) || params.length !== 0 || Reflect.ownKeys(params).length !== 1) throw new Error();
  } catch { throw gasError("refusing gas-price parameters", "RPC_METHOD_REFUSED"); }
  let fetchImpl, endpoint;
  try {
    const config = dataRecord(options);
    if (Object.keys(config).some(key => key !== "fetch")) throw new Error();
    fetchImpl = config.fetch === undefined ? globalThis.fetch : config.fetch;
    if (typeof fetchImpl !== "function" || typeof url !== "string") throw new Error();
    endpoint = new URL(url.trim());
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) throw new Error();
  } catch { throw gasError("rpc URL or fetch configuration refused", "RPC_CONFIGURATION"); }
  for (let attempt = 0; ; attempt += 1) {
    const id = nextGasId;
    nextGasId = nextGasId === Number.MAX_SAFE_INTEGER ? 1 : nextGasId + 1;
    try { return await gasPriceOnce(fetchImpl, endpoint.href, id); }
    catch (error) {
      if (!gasErrors.has(error) || !error.retryable || attempt >= RPC_RETRY_DELAYS_MS.length) throw error;
      await new Promise(resolve => setTimeout(resolve, RPC_RETRY_DELAYS_MS[attempt]));
    }
  }
}

async function gasPriceOnce(fetchImpl, url, id) {
  const controller = new AbortController();
  const started = performance.now();
  let timedOut = false, response, reader, timer;
  const cancel = () => {
    try { const pending = reader ? reader.cancel() : response?.body?.cancel(); if (pending) void pending.catch(() => {}); } catch {}
  };
  const checkDeadline = () => {
    if (timedOut || performance.now() - started >= 20000) {
      timedOut = true;
      throw gasError("rpc timed out", "RPC_TIMEOUT");
    }
  };
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(gasError("rpc timed out", "RPC_TIMEOUT"));
      controller.abort(); cancel();
    }, 20000);
  });
  const task = async () => {
    try {
      try {
        response = await fetchImpl(url, {
          method: "POST", headers: { "content-type": "application/json", "accept-encoding": "identity" },
          body: JSON.stringify({ jsonrpc: "2.0", id, method: "eth_gasPrice", params: [] }),
          signal: controller.signal, redirect: "error", credentials: "omit", referrerPolicy: "no-referrer",
        });
      } catch (error) {
        checkDeadline();
        let retryable = false;
        try { retryable = error instanceof TypeError && error.message === "fetch failed"; } catch {}
        throw gasError("rpc fetch failed", "RPC_NETWORK", retryable);
      }
      checkDeadline();
      const status = response.status;
      if (!Number.isInteger(status) || status < 100 || status > 599) throw gasError("rpc response unreadable", "RPC_NETWORK");
      if (response.redirected || (status >= 300 && status < 400)) throw gasError("rpc redirect refused", "RPC_REDIRECT");
      if (!response.ok) throw gasError(`http ${status}`, "RPC_HTTP", status === 429 || status >= 500);
      if (Number(response.headers.get("content-length") ?? 0) > MAX_RPC_BODY_BYTES) throw bodyTooLarge();
      if (!response.body) throw gasError("rpc empty body", "RPC_JSON_INVALID");
      reader = response.body.getReader();
      let bytes = new Uint8Array(16384), total = 0;
      for (;;) {
        let part;
        try { part = await reader.read(); } catch { checkDeadline(); throw gasError("rpc stream failed", "RPC_NETWORK"); }
        checkDeadline();
        if (part.done) break;
        const chunk = part.value;
        if (!ArrayBuffer.isView(chunk) || Object.prototype.toString.call(chunk) !== "[object Uint8Array]") throw gasError("rpc body unreadable", "RPC_JSON_INVALID");
        if (chunk.byteLength > MAX_RPC_BODY_BYTES - total) throw bodyTooLarge();
        if (total + chunk.byteLength > bytes.byteLength) {
          const grown = new Uint8Array(Math.min(MAX_RPC_BODY_BYTES, Math.max(bytes.byteLength * 2, total + chunk.byteLength)));
          grown.set(bytes.subarray(0, total)); bytes = grown;
        }
        bytes.set(chunk, total); total += chunk.byteLength;
      }
      let text;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, total)); }
      catch { throw gasError("rpc body not UTF-8", "RPC_JSON_INVALID"); }
      checkDeadline();
      if (nestingDepthExceeds(text, MAX_CANONICAL_DEPTH)) throw bodyTooDeep();
      let body;
      try { body = JSON.parse(text); } catch { throw gasError("rpc body not JSON", "RPC_JSON_INVALID"); }
      checkDeadline();
      if (!isPlainObject(body) || !own(body, "jsonrpc") || body.jsonrpc !== "2.0" || !own(body, "id") || typeof body.id !== "number" || body.id !== id) {
        throw gasError("rpc envelope invalid", "RPC_ENVELOPE_INVALID");
      }
      if (own(body, "result") === own(body, "error")) throw gasError("rpc envelope invalid", "RPC_ENVELOPE_INVALID");
      if (own(body, "error")) {
        if (!isPlainObject(body.error) || !own(body.error, "code") || !Number.isInteger(body.error.code) || !own(body.error, "message") || typeof body.error.message !== "string") {
          throw gasError("rpc envelope invalid", "RPC_ENVELOPE_INVALID");
        }
        throw gasError("rpc error", "RPC_ERROR");
      }
      return body.result;
    } catch (error) {
      checkDeadline();
      if (gasErrors.has(error)) throw error;
      throw gasError("rpc response unreadable", "RPC_NETWORK");
    } finally { cancel(); }
  };
  try { return await Promise.race([task(), timeout]); }
  finally { clearTimeout(timer); controller.abort(); cancel(); }
}

// Snapshot own data properties without invoking getters or retaining a mutable
// grant across the Bankr payee pin and the SDK's asynchronous hashing work.
function dataRecord(value) {
  if (!isPlainObject(value)) throw new Error();
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw new Error();
  const out = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !descriptor?.enumerable || !("value" in descriptor)) throw new Error();
    out[key] = descriptor.value;
  }
  return out;
}

export async function verifySettlement(input) {
  try {
    const options = dataRecord(input);
    const keys = ["tx", "grant", "grantHash", "payer", "payee", "amount", "rpcUrls", "minConfirmations", "allowUnpinnedRpc", "fetch"];
    if (Object.keys(options).some(key => !keys.includes(key))) return { ok: false, reason: "verifier_misconfigured", detail: "only documented verifier options are admitted" };
    let grant = options.grant;
    if (grant !== undefined) {
      try { grant = Object.freeze(dataRecord(grant)); }
      catch { return { ok: false, reason: "grant_not_a_grant_envelope", detail: "the grant must be a plain data envelope" }; }
      // Keep the integration's payee pin; do not turn historical verification
      // into live grant validation or discard fields before the SDK hashes it.
      const payee = grant.price_payee_account;
      if (typeof payee === "string" && /^eip155:8453:0x[0-9a-f]{40}$/.test(payee) && payee !== EXPECTED_PAYEE_ACCOUNT) {
        return { ok: false, reason: "grant_payee_not_pinned", detail: "the grant pays an account outside Bankr's reviewed payee pin" };
      }
    }
    const verdict = await verifySdkSettlement({
      tx: options.tx, grant, grantHash: options.grantHash, payer: options.payer,
      payee: options.payee, amount: options.amount,
      rpcUrls: options.rpcUrls === undefined ? RECEIPT_DEFAULT_RPCS : options.rpcUrls,
      allowedRpcHosts: RECEIPT_ALLOWED_RPC_HOSTS,
      allowUnpinnedRpc: options.allowUnpinnedRpc === undefined ? false : options.allowUnpinnedRpc,
      minConfirmations: options.minConfirmations === undefined ? MIN_CONFIRMATIONS : options.minConfirmations,
      fetch: options.fetch,
    });
    if (!verdict.ok && verdict.reason === "rpc_host_not_allowlisted") {
      return { ...verdict, detail: "an RPC host is outside Bankr's reviewed allowlist; --allow-unpinned-rpc requires an explicit operator trust decision" };
    }
    return verdict;
  } catch {
    return { ok: false, reason: "verifier_exception", detail: "the supplied data could not be read; underlying messages are withheld" };
  }
}

const USAGE =
  "usage: node scripts/verify-settlement.mjs \\\n" +
  "  --tx 0x<64-hex> --grant ./keep.grant.json \\\n" +
  "  [--rpc https://mainnet.base.org --rpc https://base.drpc.org] \\\n" +
  "  [--allow-unpinned-rpc]\n" +
  "or, with the terms typed instead of read off the grant:\n" +
  "  --tx 0x<64-hex> --grant-hash <64-hex> \\\n" +
  "  --payer 0x<40-hex> --payee 0x<40-hex> --amount <atomic-usdc> ...\n" +
  `\nAt least ${MIN_OPERATORS} distinct HTTPS Base operators are required.` +
  `\nAllowlisted hosts: ${RECEIPT_ALLOWED_RPC_HOSTS.join(", ")}`;

/**
 * Is this file the program? Node realpaths the main module, so comparing
 * `pathToFileURL(argv[1])` to `import.meta.url` was false through any symlink
 * in the invocation path — and a symlinked skill directory is the common
 * install shape. Through such a link the CLI did nothing and exited 0.
 */
export const invokedAsMain = (argv1, metaUrl) => {
  try {
    return typeof argv1 === "string" && realpathSync(argv1) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
};
const isMain = invokedAsMain(process.argv[1], import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }
  // --allow-unpinned-rpc takes no value; every other flag does. Unknown flags
  // refuse (a typo like --grant_hash silently became an ignored flag plus a
  // swallowed value), and a scalar flag given twice refuses rather than
  // last-one-wins deciding a money question. Only --rpc repeats.
  const VALUELESS = new Set(["allow-unpinned-rpc"]);
  const KNOWN = new Set(["tx", "grant", "grant-hash", "payer", "payee", "amount", "rpc", "allow-unpinned-rpc"]);
  const flags = { rpc: [] };
  for (let i = 0; i < args.length; i += 1) {
    const raw = args[i] ?? "";
    // Neither refusal echoes the value: a stray URL (a forgotten second
    // `--rpc`) or the `--rpc=URL` form carries the API-key path this file
    // withholds everywhere else.
    if (!raw.startsWith("--")) {
      const shown = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? `a URL for ${host(raw)}` : `a ${raw.length}-character value`;
      console.error(`REFUSED  unknown_argument — ${shown} is not a flag (value withheld)\n${USAGE}`);
      process.exit(1);
    }
    const k = raw.replace(/^--/, "");
    // A flag NAME is echoed only when it is shaped like one; anything else is
    // described by length — `--rpchttps://…/v2/KEY` is a name, technically.
    const shownName = (name) => (/^[a-z][a-z0-9_-]{0,30}$/.test(name) ? `--${name}` : `(flag name withheld, ${name.length} chars)`);
    if (k.includes("=")) {
      console.error(`REFUSED  flag_form_unsupported — ${shownName(k.split("=")[0])}=… is not read; write the flag and its value separated by a space (value withheld)\n${USAGE}`);
      process.exit(1);
    }
    if (!KNOWN.has(k)) {
      console.error(`REFUSED  unknown_flag — ${shownName(k)}\n${USAGE}`);
      process.exit(1);
    }
    if (VALUELESS.has(k)) {
      flags[k] = true;
      continue;
    }
    const v = args[i + 1];
    i += 1;
    // A valued flag with nothing usable after it is a usage error — `--grant`
    // as the last argument used to select TYPED mode and print "no --grant
    // was given" on a run invoked with --grant.
    if (!usableArgValue(v)) {
      console.error(`REFUSED  flag_value_missing — --${k} was given with no usable value after it (missing, empty, or another flag)\n${USAGE}`);
      process.exit(1);
    }
    if (k === "rpc") {
      flags.rpc.push(v);
      continue;
    }
    if (k in flags) {
      console.error(`REFUSED  duplicate_flag — --${k} was given twice; which value binds is not guessable`);
      process.exit(1);
    }
    flags[k] = v;
  }
  let grant;
  if (flags.grant !== undefined) {
    // The file is read here and nowhere else; the path itself is never echoed
    // past this line, and its contents are treated as an envelope to check,
    // not as text to trust.
    // One no-follow, nonblocking descriptor; cap the bytes actually read and
    // reject observed replacement/growth before parsing. The file reader comes from @voidly/session/node-files.
    let raw;
    try {
      raw = readFileCapped(flags.grant, MAX_GRANT_FILE_BYTES);
    } catch (error) {
      const code = error instanceof LocalFileError ? error.code : "read";
      const detail = code === "not_regular"
        ? "--grant is not a regular file"
        : code === "too_large"
          ? `--grant exceeds its ${MAX_GRANT_FILE_BYTES}-byte limit`
          : "--grant could not be read as an unchanged, bounded regular file; path withheld";
      console.error(`REFUSED  grant_unreadable — ${detail}`);
      process.exit(1);
    }
    try {
      grant = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
    } catch {
      console.error(`REFUSED  grant_unreadable — --grant is not JSON`);
      process.exit(1);
    }
  }
  const verdict = await verifySettlement({
    tx: flags.tx ?? "",
    grant,
    // With --grant these are cross-checks (each must agree with the grant);
    // without it they are the terms.
    grantHash: flags["grant-hash"] ?? (grant ? undefined : ""),
    payer: flags.payer ?? (grant ? undefined : ""),
    payee: flags.payee ?? (grant ? undefined : ""),
    amount: flags.amount,
    rpcUrls: flags.rpc.length ? flags.rpc : RECEIPT_DEFAULT_RPCS,
    allowUnpinnedRpc: flags["allow-unpinned-rpc"] === true,
  });
  if (!verdict.ok) {
    // One bounded line. Every detail is shape-bounded where it is built; this
    // is the backstop so no future interpolation can make a refusal a page.
    const detail = verdict.detail ? String(verdict.detail) : "";
    console.error(`REFUSED  ${verdict.reason}${detail ? ` — ${detail.length > 1024 ? detail.slice(0, 1024) + "…" : detail}` : ""}`);
    process.exit(1);
  }
  console.log(renderVerdict(verdict).join("\n"));
  process.exit(verdict.unpinned ? 2 : 0);
}

/** Exit code for a verdict: 0 PROVEN, 1 REFUSED, 2 PROVEN-UNPINNED. */
export const exitCodeFor = (verdict) => (!verdict.ok ? 1 : verdict.unpinned ? 2 : 0);

/**
 * The PROVEN block, as lines. Exported so the prose guard can compare the
 * captured block in SKILL.md against what this file actually prints — the
 * guard failed its own name twice by pinning substrings instead.
 * A quorum of fewer than two operators refuses long before a verdict exists,
 * so there is no single-operator branch here on purpose.
 */
export function renderVerdict(verdict) {
  const unpinned = Boolean(verdict.unpinnedHosts?.length);
  return [
    unpinned ? "PROVEN-UNPINNED  (exit 2 — operators you chose, not the reviewed allowlist)" : "PROVEN",
    `  tx:            ${verdict.tx}  (every operator's receipt names this hash)`,
    `  grant_hash:    ${verdict.grantHash}`,
    `  binding nonce: ${verdict.nonce} (recomputed, sha256 over the domain + grant hash)`,
    `  paired logs:   AuthorizationUsed #${verdict.authLogIndex} -> Transfer #${verdict.transferLogIndex} (the next canonical-USDC Transfer after it)`,
    `  transfer:      ${verdict.value} atomic USDC  ${verdict.payer} -> ${verdict.payee}`,
    `  block:         ${verdict.blockNumber}  confirmations: ${verdict.confirmations}` +
      ` (lowest head of ${verdict.headOperators} operators)`,
    "  assurance:     quorum-observed inclusion; latest-head confirmations only; safe/finalized not checked",
    `  chain:         ${verdict.chain} (Base mainnet, 8453) — confirmed by every operator, receipt bound to its block hash`,
    `  quorum:        ${verdict.rpcHosts.length}/${verdict.rpcHosts.length} agreed — ${verdict.rpcHosts.join(" + ")}, canonical receipt documents agree`,
    verdict.terms?.source === "grant"
      ? `  terms:         read off the --grant envelope (its hash recomputed the way the SDK computes it): payer and payee above are THAT grant's, and the amount sits inside its price band ${verdict.terms.band.min}..${verdict.terms.band.max}`
      : "  terms:         as typed on the command line — NOT read off a grant; pass --grant ./keep.grant.json to bind them",
    ...(verdict.unpinnedHosts?.length
      ? [
          `  caution:       ${verdict.unpinnedHosts.join(" + ")} — NOT on the reviewed allowlist (--allow-unpinned-rpc); this proof is only as strong as those operators`,
        ]
      : []),
    ...(verdict.terms?.source === "grant"
      ? [
          "  scope:         payment proven for THIS grant: its nonce was spent by its payer in this tx, moving an amount inside its price band to its payee.",
          "                 Delivery is a separate proof.",
        ]
      : [
          "  scope:         this tx spent the nonce derived from grant_hash and moved exactly that transfer.",
          "                 Whether payer, payee and amount are that grant's TERMS was not checked — no --grant was given.",
          "                 Delivery is a separate proof.",
        ]),
  ];
}
