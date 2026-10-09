#!/usr/bin/env node
// preview-payment.mjs — the Leg 2 gates as a PROGRAM, not a paragraph.
// Node helper using the locked public SDK for local payment admission; no wallet
// keys, no writes, no money. Reads
// your grant file and, in the three check modes, a JSON document you hand it.
//
//   node scripts/preview-payment.mjs preview --grant ./keep.grant.json [--lane a|b] [--amount <atomic>]
//       Renders EVERY field the EIP-712 signature commits to, from the grant:
//       chain + USDC contract, amount in atomic units AND decimal USDC (the
//       SDK signs the band's floor), payer, payee, the EIP-712 domain, the
//       full typed message, the nonce beside its derivation, the validity
//       window as UNIX seconds and clock time, and (Lane B) the submission
//       shape. Show this to the human; get the yes on THIS.
//
//   node scripts/preview-payment.mjs check-sign-response --grant ./keep.grant.json \
//       --lane a|b --response ./sign-response.json [--amount <atomic>]
//       The /wallet/sign response: `signer` must be the grant's payer, the
//       signature must recover the payer over the exact lane/domain/message
//       and unexpired grant. The response must report successful EIP-712 signing.
//       Exit 0 = hand the signature string back to the SDK verbatim.
//
//   node scripts/preview-payment.mjs check-request --grant ./keep.grant.json \
//       --request ./request.json --sign-response ./sign-response.json [--signer 0x<40-hex>] [--amount <atomic>] \
//       [--rpc https://mainnet.base.org --rpc https://base.drpc.org]
//       Inside the `broadcast` callback, BEFORE /wallet/submit: checks the
//       SDK's TransactionRequest (`to`, `chainId`, `value`, `data`) — the
//       selector and all nine arguments — against the grant and refuses any
//       mismatch. The amount must be the one the preview rendered
//       (the band's floor) unless --amount names another in-band value.
//       THE SIGNED CALLDATA NEVER LEAVES THIS MACHINE: the fee line is a
//       typical gas figure times the current gas price read from the
//       two-operator quorum — eth_gasPrice carries no calldata. A live
//       eth_estimateGas would hand the bearer `transfer` authorization to an
//       RPC operator, who could broadcast it first.
//
//   node scripts/preview-payment.mjs check-submit-response --grant ./keep.grant.json \
//       --response ./submit-response.json
//       The /wallet/submit response: success true, status "success" (pending
//       is not evidence; reverted is a refusal), a well-formed transactionHash,
//       chainId 8453, `signer` equal to the payer. Exit 0 prints the exact
//       verify-settlement command to run next.
//
// The grant itself is held to the pins before any of this: pinned provider,
// Base, canonical USDC, and the reviewed price band. A grant is a file
// somebody can hand you; the preview it renders must be one this skill is
// reviewed for.
//
// Exit 0 = the document passed every check named above / 1 = refused, by
// name. Nothing here signs, submits, or authorizes value. No document,
// argv or operator text is ever printed verbatim into a refusal.

import { realpathSync } from "node:fs";
import { LocalFileError, readFileCapped } from "@voidly/session/node-files";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  validateGrant, createPaymentContext as createSdkPaymentContext,
  checkPaymentSignRequest, verifyPaymentSignature, checkPaymentSubmitRequest,
} from "@voidly/session";
import {
  ALLOWED_BASE_RPC_HOSTS,
  CANONICAL_USDC_BASE,
  EXPECTED_PRICE_MAX_AMOUNT,
  EXPECTED_PRICE_MIN_AMOUNT,
  EXPECTED_PROVIDER_DID,
  EXPECTED_PAYEE_ACCOUNT,
  usableArgValue,
} from "./lib/pins.mjs";
import {
  DEFAULT_RPCS,
  MAX_GRANT_FILE_BYTES,
  MIN_OPERATORS,
  host,
  httpRpc,
  operatorKeyOf,
} from "./verify-settlement.mjs";

const feeRpcHosts = Object.freeze([...ALLOWED_BASE_RPC_HOSTS]);

/** The same operator policy the settlement proof applies: https, allowlisted, >= 2 distinct. No unpinned arm here. */
export function operatorsFor(rpcUrls) {
  const refuse = (reason, detail = "") => ({ ok: false, reason, detail });
  const seen = new Set();
  const operators = [];
  for (const raw of rpcUrls) {
    let u;
    try {
      u = new URL(String(raw).trim());
    } catch {
      return refuse("bad_rpc_url", "an --rpc value is not a URL (value withheld)");
    }
    if (u.username || u.password) return refuse("rpc_credentials_refused", "RPC credentials are not accepted");
    if (u.protocol !== "https:") return refuse("rpc_not_https", "RPC URLs must use HTTPS");
    if (!feeRpcHosts.includes(u.host)) return refuse("rpc_host_not_allowlisted", `${u.host} is not one of the reviewed Base operators`);
    const key = operatorKeyOf(u);
    if (seen.has(key)) continue;
    seen.add(key);
    operators.push({ url: String(raw).trim(), host: u.host });
  }
  if (operators.length < MIN_OPERATORS) return refuse("insufficient_rpc_quorum", `${operators.length} distinct operator(s) — a fee estimate for a payment needs at least ${MIN_OPERATORS}`);
  return { ok: true, operators };
}

/** EIP-712 domain of USDC on Base, exactly as @voidly/session builds it. */
export const USDC_BASE_DOMAIN = Object.freeze({
  name: "USD Coin",
  version: "2",
  chainId: 8453,
  verifyingContract: CANONICAL_USDC_BASE,
});
export const TRANSFER_WITH_AUTHORIZATION_SELECTOR = "0xe3ee160e";
export const RECEIVE_WITH_AUTHORIZATION_SELECTOR = "0xef55bec6";
/**
 * A transferWithAuthorization on Base costs roughly 60–90k gas. This is the
 * figure the fee line multiplies the live gas price by. It is TYPICAL, not
 * measured: measuring (eth_estimateGas) would send the signed authorization —
 * bearer material — to an RPC operator, who could broadcast it first.
 */
export const TYPICAL_TRANSFER_WITH_AUTHORIZATION_GAS = 90000n;
/** Above this gas price the fee line is not a fee line, it is a symptom. */
export const GAS_PRICE_SANITY_CEILING_WEI = 1_000_000_000_000n; // 1000 gwei
/** A hex quantity longer than this is not a gas price any chain has. */
const MAX_QUANTITY_HEX_DIGITS = 32;
/** The SDK's own timestamp shape: YYYY-MM-DDTHH:MM:SS(.mmm)Z, nothing else. */
export const ISO_UTC_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/;

const ADDR = /^0x[0-9a-f]{40}$/;
const HASH32 = /^0x[0-9a-f]{64}$/;
const DECIMAL = /^[0-9]{1,78}$/;
const isStr = (v) => typeof v === "string";
const usdc = (atomic) => {
  const s = BigInt(atomic).toString().padStart(7, "0");
  return `${s.slice(0, -6)}.${s.slice(-6)} USDC`;
};
const shownChain = (v) => (typeof v === "number" && Number.isInteger(v) ? String(v) : isStr(v) && /^(0x[0-9a-f]{1,8}|[0-9]{1,10})$/i.test(v) ? v : "(not a chain id)");

/** The SDK's timestampMs, as a value in milliseconds or null. */
export function isoUtcMs(value) {
  if (!isStr(value)) return null;
  const m = ISO_UTC_RE.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const milli = m[7] === undefined ? 0 : Number(m[7]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const ms = Date.UTC(year, month - 1, day, hour, minute, second, milli);
  if (!Number.isFinite(ms)) return null;
  // The SDK round-trips the calendar: Feb 30 rolls to Mar 2 in Date.UTC and
  // is refused there, so it is refused here too — a preview of a validBefore
  // the SDK will never sign is not a preview.
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return ms;
}

/**
 * The pins, on the SDK-validated grant. Chain and asset are fixed here; provider
 * DID and the price band are pins too, and a grant that names another
 * provider or another band previews a payment this skill was not reviewed
 * for. Pure.
 */
export function bindGrantTermsToPins(grant, terms) {
  const refuse = (reason, detail = "") => ({ ok: false, reason, detail });
  if (grant?.provider_did !== EXPECTED_PROVIDER_DID) {
    return refuse("grant_provider_not_pinned", `the grant names a provider that is not the pinned ${EXPECTED_PROVIDER_DID}`);
  }
  if (terms.band.min !== EXPECTED_PRICE_MIN_AMOUNT || terms.band.max !== EXPECTED_PRICE_MAX_AMOUNT) {
    return refuse("grant_band_not_pinned", `the grant's price band is not the reviewed ${EXPECTED_PRICE_MIN_AMOUNT}..${EXPECTED_PRICE_MAX_AMOUNT} — a changed price is a reviewed skill update, not a runtime surprise`);
  }
  return { ok: true };
}

// Contexts retain a validated snapshot, never a caller-supplied partial terms object.
// They establish local consistency, not human consent or provider acceptance.
// A presentation wrapper retains the SDK-owned opaque context; it adds Bankr
// policy/display names, never alternate payment authority.
const contexts = new WeakMap();
const freezeTree = (value) => {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
};
const refused = (reason, detail = "") => ({ ok: false, reason, detail });
function validatedGrant(raw) {
  // Grant v1 is a flat record of strings. Snapshot only own data properties;
  // reject accessors, symbols, hidden fields and non-plain objects before SDK use.
  try {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(raw))) return refused("grant_invalid");
    const keys = Reflect.ownKeys(raw);
    if (keys.length > 32) return refused("grant_invalid");
    const snapshot = Object.create(null);
    for (const key of keys) {
      const d = Object.getOwnPropertyDescriptor(raw, key);
      if (typeof key !== "string" || !d.enumerable || !("value" in d) ||
          typeof d.value !== "string" || d.value.length > 4096) return refused("grant_invalid");
      Object.defineProperty(snapshot, key, { value: d.value, enumerable: true });
    }
    const valid = validateGrant(snapshot, Date.now());
    if (!valid.ok) return refused("grant_invalid", "the complete grant failed the locked SDK schema, identity or validity-window checks");
    const grant = { ...valid.env };
    if (grant.price_chain !== "eip155:8453") return refused("grant_chain_not_base");
    if (grant.price_asset !== `eip155:8453/erc20:${CANONICAL_USDC_BASE}`) return refused("grant_asset_not_canonical_usdc");
    const account = /^eip155:8453:(0x[0-9a-f]{40})$/;
    const payer = account.exec(grant.price_payer_account)?.[1];
    const payee = account.exec(grant.price_payee_account)?.[1];
    if (!payer || !payee) return refused("grant_not_a_grant_envelope");
    if (grant.price_payee_account !== EXPECTED_PAYEE_ACCOUNT) return refused("grant_payee_not_pinned");
    const terms = { ok: true, payer, payee, band: { min: grant.price_min_amount, max: grant.price_max_amount },
      chain: grant.price_chain, asset: grant.price_asset, expiresAt: grant.expires_at };
    const pinned = bindGrantTermsToPins(grant, terms);
    if (!pinned.ok) return pinned;
    return { ok: true, grant, terms };
  } catch {
    return refused("grant_invalid", "the complete grant could not be validated");
  }
}

/** Await the published SDK's immutable complete-grant context, then retain Bankr display metadata. */
export async function createPaymentContext(input = {}) {
  const override = checkOptions(input, ["grant", "lane", "amount"]);
  if (override) return override;
  const { grant, lane, amount = null } = input;
  const valid = validatedGrant(grant);
  if (!valid.ok) return valid;
  if (lane !== "a" && lane !== "b") return refused("signature_lane_required", "name the approved lane explicitly: a or b");
  // Keep the command's approved decimal spelling compatibility (including a
  // leading-zero amount); the immutable SDK intent retains the numeric value.
  if (amount !== null && (typeof amount !== "string" || !DECIMAL.test(amount))) return refused("bad_amount");
  const prepared = await createSdkPaymentContext({ grant: valid.grant,
    entryPoint: lane === "a" ? "receive_with_authorization" : "transfer_with_authorization",
    ...(amount === null ? {} : { amount: BigInt(amount).toString() }) });
  if (!prepared.ok) return mapSdkRefusal(prepared);
  const sdk = prepared.context;
  const { EIP712Domain: _domain, ...types } = sdk.typedData.types;
  const authorization = { ok: true, ...sdk.typedData, types, expiresMs: Date.parse(sdk.grant.expires_at) };
  const context = freezeTree({ grant: sdk.grant,
    terms: { ...valid.terms, grantHash: sdk.grantHash }, lane, amount: sdk.amount, authorization });
  contexts.set(context, sdk);
  const live = liveContext(context);
  return live.ok ? { ok: true, context } : live;
}

const mapSdkRefusal = result => result.ok ? result : refused({
  payment_sign_request_mismatch: "sign_request_mismatch",
  payment_sign_request_invalid_input: "sign_request_mismatch",
  payment_amount_invalid: "bad_amount",
  payment_amount_outside_band: "request_amount_outside_grant_band",
  payment_signature_invalid: "signature_malformed",
  payment_signature_payer_mismatch: "signature_not_from_payer",
}[result.reason] ?? result.reason, "the locked SDK refused the retained payment intent");

export function liveContext(context) {
  const sdk = context && contexts.get(context);
  if (!sdk) return refused("payment_context_required", "retain the original context returned by createPaymentContext");
  return mapSdkRefusal(checkPaymentSignRequest({ context: sdk, typedData: sdk.typedData }));
}
const isPlainRecord = value => value !== null && typeof value === "object" &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const checkOptions = (input, allowed) => {
  if (!isPlainRecord(input)) return refused("payment_input_not_object");
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== "string" || !allowed.includes(key)) return refused("payment_context_override", "lane, amount, expiry and terms must come from the retained context");
    const d = Object.getOwnPropertyDescriptor(input, key);
    if (!d.enumerable || !("value" in d)) return refused("payment_input_not_data", "use plain data properties");
  }
  return null;
};
function captureFields(value, keys, what) {
  if (!isPlainRecord(value)) return refused(`${what}_not_object`);
  const captured = {};
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (d && (!d.enumerable || !("value" in d))) return refused(`${what}_not_data`, "use plain data properties");
    captured[key] = d?.value;
  }
  return { ok: true, value: captured };
}
/** Inside the SDK callback, admit the exact frozen payload before asking the wallet. */
export function checkSignRequest(input = {}) {
  const override = checkOptions(input, ["context", "typedData"]);
  if (override) return override;
  const live = liveContext(input.context);
  if (!live.ok) return live;
  return mapSdkRefusal(checkPaymentSignRequest({ context: contexts.get(input.context), typedData: input.typedData }));
}

/** Admit exact SDK calldata and signature; raw wallet submission remains Lane B only. */
export function checkRequestAgainstGrant(input = {}) {
  const override = checkOptions(input, ["context", "request", "signer", "signResponse"]);
  if (override) return override;
  const { context, request, signer = null, signResponse } = input;
  const live = liveContext(context);
  if (!live.ok) return live;
  if (context.lane !== "b") return refused("request_lane_mismatch", "raw submission requires Lane B");
  const captured = captureFields(request, ["chainId", "to", "value", "data"], "request");
  if (!captured.ok) return captured;
  if (signer !== null && (!isStr(signer) || signer.toLowerCase() !== context.terms.payer)) return refused("signer_not_the_payer");
  if (signResponse === undefined) return refused("sign_response_required");
  const signed = checkSignResponse({ context, response: signResponse });
  if (!signed.ok) return signed;
  // Deliberately let the SDK own chain/target/value/length/selector/arguments
  // and exact r/s/v admission. There is no independent decoder or recovery.
  const checked = checkPaymentSubmitRequest({ context: contexts.get(context),
    signature: signed.signature, request: captured.value });
  if (!checked.ok) return mapSdkRefusal(checked);
  // Bankr's wallet wire spells zero as a decimal; preserve admitted data bytes.
  const admitted = Object.freeze({ ...checked.request, value: "0" });
  const message = context.authorization.message;
  return { ok: true, request: admitted, message,
    decoded: Object.freeze({ ...message, selector: TRANSFER_WITH_AUTHORIZATION_SELECTOR }) };
}

/** Bankr response metadata plus SDK cryptographic recovery; never self-attested identity. */
export function checkSignResponse(input = {}) {
  const override = checkOptions(input, ["context", "response"]);
  if (override) return override;
  const { context, response: rawResponse } = input;
  const live = liveContext(context);
  if (!live.ok) return live;
  const captured = captureFields(rawResponse, ["success", "signatureType", "signature", "signer"], "response");
  if (!captured.ok) return captured;
  const response = captured.value;
  if (response.success !== true) return refused("sign_not_success");
  if (response.signatureType !== "eth_signTypedData_v4") return refused("sign_type_mismatch");
  if (!isStr(response.signer) || !ADDR.test(response.signer.toLowerCase())) return refused("signer_missing");
  if (response.signer.toLowerCase() !== context.terms.payer) return refused("signer_not_the_payer");
  return mapSdkRefusal(verifyPaymentSignature({ context: contexts.get(context), signature: response.signature }));
}

/** /wallet/submit response → the transaction hash, or a refusal. Pure. */
export function checkSubmitResponse(input = {}) {
  const override = checkOptions(input, ["response", "grant"]);
  if (override) return override;
  const captured = captureFields(input.response, ["success", "transactionHash", "status", "chainId", "signer"], "response");
  if (!captured.ok) return captured;
  const response = captured.value;
  const valid = validatedGrant(input.grant);
  if (!valid.ok) return valid;
  const { terms } = valid;
  const refuse = (reason, detail = "") => ({ ok: false, reason, detail });
  if (response === null || typeof response !== "object" || Array.isArray(response)) return refuse("response_not_object");
  if (response.success !== true) return refuse("submit_not_success", "success is not true");
  if (!isStr(response.transactionHash)) return refuse("submit_hash_malformed", "transactionHash is not a string");
  const hash = response.transactionHash.toLowerCase();
  if (!HASH32.test(hash)) return refuse("submit_hash_malformed", "transactionHash is not 0x + 64 hex");
  if (response.status === "pending") return refuse("submit_pending", `${hash} was submitted but is not confirmed — not evidence yet; wait, then run the settlement proof`);
  if (response.status === "reverted") return refuse("submit_reverted", `${hash} reverted on-chain; the nonce may be spent — look it up before any re-sign`);
  if (response.status !== "success") return refuse("submit_status_unknown", `status is ${isStr(response.status) ? "an unrecognised word" : typeof response.status}`);
  const chainOk = (typeof response.chainId === "number" && response.chainId === 8453) || response.chainId === "8453";
  if (!chainOk) return refuse("submit_wrong_chain", `chainId ${shownChain(response.chainId)}`);
  if (!isStr(response.signer) || !ADDR.test(response.signer.toLowerCase())) return refuse("signer_missing", "the response names no usable signer address");
  if (response.signer.toLowerCase() !== terms.payer) {
    return refuse("signer_not_the_payer", `signer ${response.signer.toLowerCase()} paid the gas; it is not the grant's payer ${terms.payer}`);
  }
  return { ok: true, transactionHash: hash };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const MODES = {
  preview: ["--grant", "--lane", "--amount"],
  "check-request": ["--grant", "--request", "--sign-response", "--signer", "--amount", "--rpc"],
  "check-sign-response": ["--grant", "--response", "--lane", "--amount"],
  "check-submit-response": ["--grant", "--response"],
};

/** A path printed back is argv: plainly spelled paths print, anything else is described. */
const safePath = (p) => (/^[A-Za-z0-9._~\/\-]{1,512}$/.test(String(p)) ? String(p) : `(a path with unusual characters, ${String(p).length} chars - not printed)`);

/** Every refusal is one bounded line: a 5 MB detail is not a refusal, and a >64 KB one is cut by the pipe anyway. */
const MAX_DETAIL = 1024;
const die = (name, detail) => {
  const d = detail ? String(detail) : "";
  console.error(`REFUSED  ${name}${d ? ` — ${d.length > MAX_DETAIL ? d.slice(0, MAX_DETAIL) + "…" : d}` : ""}`);
  process.exit(1);
};

const loadSmallJson = (path, what, { requirePrivate = false } = {}) => {
  try {
    const bytes = readFileCapped(path, MAX_GRANT_FILE_BYTES, { requirePrivate });
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    const code = error instanceof LocalFileError ? error.code : null;
    const suffix = { symlink: "symlink_refused", permissions: "permissions_too_open",
      changed: "changed_while_reading" }[code] ?? "unreadable";
    die(`${what}_${suffix}`, `--${what} could not be read as bounded, stable JSON${requirePrivate ? " with private permissions" : ""}`);
  }
};

export const invokedAsMain = (argv1, metaUrl) => {
  try {
    return typeof argv1 === "string" && realpathSync(argv1) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
};

if (invokedAsMain(process.argv[1], import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  if (!Object.hasOwn(MODES, mode)) die("unknown_mode", `first argument must be one of ${Object.keys(MODES).join(", ")}`);
  const allowed = MODES[mode];
  const flags = { "--rpc": [] };
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (/^--[a-z-]+=/.test(a)) die("flag_form_unsupported", `${a.split("=")[0].slice(0, 20)}=… is not read; write the flag and its value separated by a space`);
    if (!allowed.includes(a)) die("unknown_argument", `argument ${i + 2} is neither a flag ${mode} reads nor the value after one (value withheld)`);
    const v = rest[i + 1];
    if (!usableArgValue(v)) die("flag_value_missing", `${a} was given with no usable value after it`);
    if (a === "--rpc") flags["--rpc"].push(v);
    else if (a in flags) die("flag_duplicated", `${a} was given more than once`);
    else flags[a] = v;
    i += 1;
  }
  if (!flags["--grant"]) die("missing_arguments", `${mode} needs --grant ./keep.grant.json`);
  const grant = loadSmallJson(flags["--grant"], "grant");
  const lane = mode === "check-request" ? "b" : flags["--lane"] ?? (mode === "preview" ? "a" : undefined);
  const prepared = mode === "check-submit-response" ? validatedGrant(grant)
    : await createPaymentContext({ grant, lane, amount: flags["--amount"] ?? null });
  if (!prepared.ok) die(prepared.reason, prepared.detail);
  const context = prepared.context;
  const terms = context?.terms ?? prepared.terms;
  const clock = (sec) => new Date(Number(sec) * 1000).toISOString();

  if (mode === "preview") {
    const { primaryType, message: m } = context.authorization;
    console.log("PREVIEW  every field the signature commits to, from the grant file");
    console.log(`  grant_hash:      ${terms.grantHash}`);
    console.log(`  chain:           eip155:8453 (Base mainnet)   USDC: ${CANONICAL_USDC_BASE}`);
    console.log(`  amount:          ${m.value} atomic = ${usdc(m.value)}   (default: the SDK signs the band's floor; band ${terms.band.min}..${terms.band.max}, the reviewed pin)`);
    console.log(`  payer (from):    ${m.from}   <- the wallet that signs MUST be this address`);
    console.log(`  payee (to):      ${m.to}   (frozen into the grant at sealing; the pinned provider's manifest named it then)`);
    console.log(`  provider:        ${EXPECTED_PROVIDER_DID} (the pin; the grant names it)`);
    console.log(`  EIP-712 domain:  ${JSON.stringify(USDC_BASE_DOMAIN)}`);
    console.log(`  primaryType:     ${primaryType}   (Lane ${lane.toUpperCase()})`);
    console.log(`  typed message:   ${JSON.stringify(m)}`);
    console.log(`  nonce:           ${m.nonce}`);
    console.log(`                   = 0x + sha256("voidly-session-settlement-binding/v1|" + grant_hash)`);
    console.log(`  validAfter:      0 (immediately)`);
    console.log(`  validBefore:     ${m.validBefore} = ${clock(m.validBefore)}   (the grant's expires_at; cannot be re-minted — re-seal past it)`);
    if (lane === "b") {
      console.log(`  submission:      POST /wallet/submit  to=${CANONICAL_USDC_BASE}  chainId=8453  value="0"`);
      console.log(`                   selector ${TRANSFER_WITH_AUTHORIZATION_SELECTOR} transferWithAuthorization(from,to,value,validAfter,validBefore,nonce,v,r,s)`);
      console.log(`                   calldata exists only AFTER signing — check-request admits it inside the broadcast callback; the fee line there is typical gas (${TYPICAL_TRANSFER_WITH_AUTHORIZATION_GAS}) × the live gas price, and the signed calldata is never sent to any RPC`);
      console.log(`                   Bankr control: "Arbitrary contract calls" is on by default today; if effectively disabled, stop. Timers are optional; never loosen a control automatically.`);
    } else {
      console.log(`  submission:      none by you — the provider redeems a receive authorization in its own transaction`);
      console.log(`                   Bankr spend-limit coverage of provider redemption is unverified; do not promise it.`);
    }
    console.log("  Bankr policy:    walletApiEnabled and a non-read-only key are required. A configured allowedRecipients restriction blocks EIP-712 signing on BOTH lanes and all raw submissions. Stop; never relax it or switch lanes to bypass it.");
    console.log("  after settling:  node scripts/verify-settlement.mjs --tx <hash> --grant " + safePath(flags["--grant"]));
    process.exit(0);
  }

  if (mode === "check-sign-response") {
    if (!flags["--response"]) die("missing_arguments", "check-sign-response needs --response ./sign-response.json");
    if (!flags["--lane"]) die("signature_lane_required", "check-sign-response requires --lane a or --lane b");
    const r = checkSignResponse({ response: loadSmallJson(flags["--response"], "response", { requirePrivate: true }), context });
    if (!r.ok) die(r.reason, r.detail);
    console.log("ACCEPTED  signature — recovered the grant payer over the exact approved lane, domain and message; hand the checked signature back to the SDK verbatim");
    process.exit(0);
  }

  if (mode === "check-submit-response") {
    if (!flags["--response"]) die("missing_arguments", "check-submit-response needs --response ./submit-response.json");
    const r = checkSubmitResponse({ response: loadSmallJson(flags["--response"], "response"), grant });
    if (!r.ok) die(r.reason, r.detail);
    console.log(`ACCEPTED  submission ${r.transactionHash} — mined, success, signer is the payer. Not yet settlement: run`);
    console.log(`  node scripts/verify-settlement.mjs --tx ${r.transactionHash} --grant ${safePath(flags["--grant"])}`);
    process.exit(0);
  }

  // check-request
  if (!flags["--request"]) die("missing_arguments", "check-request needs --request ./request.json (the SDK's TransactionRequest)");
  if (!flags["--sign-response"]) die("sign_response_required", "check-request needs the approved Lane B --sign-response ./sign-response.json");
  const request = loadSmallJson(flags["--request"], "request", { requirePrivate: true });
  const signResponse = loadSmallJson(flags["--sign-response"], "sign_response", { requirePrivate: true });
  const typedAmount = flags["--amount"] !== undefined ? flags["--amount"] : null;
  if (typedAmount !== null && !DECIMAL.test(typedAmount)) die("bad_amount", "--amount must be a decimal atomic amount");
  const checked = checkRequestAgainstGrant({ request, context, signer: flags["--signer"] ?? null, signResponse });
  if (!checked.ok) die(checked.reason, checked.detail);
  const policy = operatorsFor(flags["--rpc"].length ? flags["--rpc"] : DEFAULT_RPCS);
  if (!policy.ok) die(policy.reason, policy.detail);
  // The fee line: typical gas × the live gas price. eth_gasPrice takes no
  // arguments — nothing about this request, least of all its signature,
  // leaves the machine. Every operator must answer; the highest price is the
  // conservative one.
  const prices = [];
  for (const op of policy.operators) {
    let price;
    try {
      price = await httpRpc(op.url, "eth_gasPrice", []);
    } catch {
      die("gas_price_unavailable", `${host(op.url)} did not answer eth_gasPrice — a fee that cannot be read is a fee the human cannot approve`);
    }
    if (!isStr(price) || !/^0x[0-9a-f]+$/i.test(price) || price.length - 2 > MAX_QUANTITY_HEX_DIGITS) {
      die("gas_price_unreadable", `${host(op.url)} answered a non-quantity`);
    }
    const wei = BigInt(price);
    if (wei > GAS_PRICE_SANITY_CEILING_WEI) die("gas_price_implausible", `${host(op.url)} reports a gas price above ${GAS_PRICE_SANITY_CEILING_WEI} wei — not a fee a human should approve blind`);
    prices.push({ host: host(op.url), wei });
  }
  const stillLive = liveContext(context);
  if (!stillLive.ok) die(stillLive.reason, stillLive.detail);
  const worst = prices.reduce((a, b) => (b.wei > a.wei ? b : a));
  const feeWei = TYPICAL_TRANSFER_WITH_AUTHORIZATION_GAS * worst.wei;
  console.log("CHECKED  the SDK's request is THIS grant's transfer authorization and nothing else");
  console.log(`  to/chain/value:  ${CANONICAL_USDC_BASE} / 8453 / 0`);
  console.log(`  selector:        ${checked.decoded.selector} transferWithAuthorization`);
  console.log(`  from -> to:      ${checked.decoded.from} -> ${checked.decoded.to}`);
  console.log(`  value:           ${checked.decoded.value} atomic = ${usdc(checked.decoded.value)}   (= the previewed amount)`);
  console.log(`  window:          ${checked.decoded.validAfter}..${checked.decoded.validBefore} (${clock(checked.decoded.validBefore)})`);
  console.log(`  nonce:           ${checked.decoded.nonce} (this grant's binding nonce)`);
  console.log("  signature:       cryptographically recovered and byte-bound to the approved response (bytes withheld)");
  console.log(`  gas:             ~${TYPICAL_TRANSFER_WITH_AUTHORIZATION_GAS} (typical for transferWithAuthorization; NOT measured — measuring would hand the signed authorization to an RPC operator)`);
  console.log(`  fee estimate:    ~${feeWei} wei ≈ ${(Number(feeWei) / 1e18).toFixed(9)} ETH at ${prices.map((p) => `${p.host} ${p.wei} wei/gas`).join(", ")} (highest used)`);
  console.log("  submit with:     transaction { to, chainId, data } from the SDK request, value \"0\", waitForConfirmation true — then check-submit-response, then the proof");
  process.exit(0);
}
