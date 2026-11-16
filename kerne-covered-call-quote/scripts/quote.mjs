#!/usr/bin/env node
// Kerne covered call quote: fetch it, verify it, summarize it.
//
// Read only. One HTTPS GET to one fixed public endpoint. No API key, no wallet, no transaction,
// no dependencies (plain Node 18+). The quote is a REFERENCE value: nothing here can place a trade.
//
//   node quote.mjs                 current quote, verified, as JSON (includes summary_text)
//   node quote.mjs --shares 2.5    also sizes the premium for a holding of 2.5 shares
//   node quote.mjs --text          prints only the plain-text summary
//   node quote.mjs --file q.json   verify a saved /api/quote response instead of fetching (testing)
//
// Exit codes:
//   0  verified and fresh: the quote (or a signed "no quote") is printed
//   1  bad arguments
//   2  verification FAILED: no numbers and no text from the response are printed
//   3  no usable response (endpoint down, timeout, unreadable file, unexpected shape)
//   4  verified but STALE: the newest signed record is older than 45 minutes, no numbers printed
//
// What "verified" means here: the published document hashes to the published hash, both
// signatures recover to the pinned Kerne signer below, and the compact on-chain form of the quote
// says the same thing as the document. It does not re-read Chainlink; for that, run the
// independent verifier at https://kerne-stock-quote.r4woutreach.workers.dev/verify.py

import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The only host this script ever contacts. There is no flag to change it.
export const ENDPOINT = 'https://kerne-stock-quote.r4woutreach.workers.dev/api/quote';

// Trust root. Pinned on purpose: a response is only believed if it is signed by this address.
export const PINNED = Object.freeze({
  signer: '0x9653Bf177239C979921DC8C0639eD00409F4Db88',
  chainId: 8453,
  vault: '0xc6180E9af7Cb4c6D47A230a6c5047fA615Bd0956',
  feed: '0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4',
  schema: 'kerne-stock-quote',
  schemaVersion: 1,
  domain: Object.freeze({ name: 'KerneStockQuote', version: '1', chainId: 8453 }),
  quoteType:
    'Quote(address vault,address feed,uint80 roundId,uint256 spot,uint256 strike,uint32 premiumBps,uint64 saleWindow,uint64 expiry,uint64 validUntil)',
});

// A signed record older than this is treated as stale and its numbers are not printed. The quote
// agent signs every 15 minutes and calls a record fresh for 45.
export const MAX_AGE_SECONDS = 45 * 60;
const MAX_CANONICAL_CHARS = 200_000;
const MAX_BODY_CHARS = 600_000;

// ------------------------------------------------------------------ bytes

const strip0x = (h) => (h.startsWith('0x') || h.startsWith('0X') ? h.slice(2) : h);
const utf8 = (s) => new TextEncoder().encode(s);
function hexToBytes(h) {
  const s = strip0x(h);
  if (s.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(s)) throw new Error('bad hex');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(2 * i, 2 * i + 2), 16);
  return out;
}
const bytesToHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
/// One 32 byte ABI word. Accepts a non-negative integer (number or decimal string) below 2^256.
function word(v) {
  if (typeof v === 'number' ? !Number.isSafeInteger(v) : typeof v === 'bigint' ? false : !(typeof v === 'string' && /^\d{1,78}$/.test(v))) {
    throw new Error('not an unsigned integer');
  }
  const n = BigInt(v);
  if (n < 0n || n >= 1n << 256n) throw new Error('out of range');
  return hexToBytes(n.toString(16).padStart(64, '0'));
}
function addrWord(a) {
  if (typeof a !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error('not an address');
  return hexToBytes(a.slice(2).toLowerCase().padStart(64, '0'));
}
const sameAddr = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

// ------------------------------------------------------------------ keccak-256

const M64 = (1n << 64n) - 1n;
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
const rotl = (x, n) => (n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M64);

function keccakF(s) {
  for (let round = 0; round < 24; round++) {
    const c = [0, 1, 2, 3, 4].map((x) => s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20]);
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1);
      for (let y = 0; y < 25; y += 5) s[x + y] ^= d;
    }
    const b = new Array(25);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], ROT[x + 5 * y]);
    }
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) s[x + y] = b[x + y] ^ (~b[((x + 1) % 5) + y] & M64 & b[((x + 2) % 5) + y]);
    }
    s[0] ^= RC[round];
  }
}

export function keccak256(bytes) {
  const rate = 136;
  const p = new Uint8Array(bytes.length + (rate - (bytes.length % rate)));
  p.set(bytes);
  p[bytes.length] ^= 0x01;
  p[p.length - 1] ^= 0x80;
  const s = new Array(25).fill(0n);
  for (let off = 0; off < p.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(p[off + i * 8 + b]);
      s[i] ^= lane;
    }
    keccakF(s);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) for (let b = 0; b < 8; b++) out[i * 8 + b] = Number((s[i] >> BigInt(8 * b)) & 0xffn);
  return out;
}

// ------------------------------------------------------------------ secp256k1 public key recovery

const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const G = [
  0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
];
const mod = (a, m) => ((a % m) + m) % m;
function inv(a, m) {
  let r0 = mod(a, m), r1 = m, t0 = 1n, t1 = 0n;
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [t0, t1] = [t1, t0 - q * t1];
  }
  if (r0 !== 1n) throw new Error('no modular inverse');
  return mod(t0, m);
}
function modpow(b, e, m) {
  let r = 1n;
  b = mod(b, m);
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}
function dbl(p) {
  if (!p) return null;
  const [x, y] = p;
  if (y === 0n) return null;
  const l = mod(3n * x * x * inv(2n * y, P), P);
  const x3 = mod(l * l - 2n * x, P);
  return [x3, mod(l * (x - x3) - y, P)];
}
function add(p, q) {
  if (!p) return q;
  if (!q) return p;
  const [x1, y1] = p, [x2, y2] = q;
  if (x1 === x2) return mod(y1 + y2, P) === 0n ? null : dbl(p);
  const l = mod((y2 - y1) * inv(x2 - x1, P), P);
  const x3 = mod(l * l - x1 - x2, P);
  return [x3, mod(l * (x1 - x3) - y1, P)];
}
function mul(k, p) {
  let r = null, a = p;
  while (k > 0n) {
    if (k & 1n) r = add(r, a);
    a = dbl(a);
    k >>= 1n;
  }
  return r;
}

export function toChecksumAddress(addrHex) {
  const a = strip0x(addrHex).toLowerCase();
  const h = bytesToHex(keccak256(utf8(a)));
  let out = '0x';
  for (let i = 0; i < 40; i++) out += parseInt(h[i], 16) >= 8 ? a[i].toUpperCase() : a[i];
  return out;
}

/// Ethereum address that signed `digest` (32 bytes) with the 65 byte signature r || s || v.
export function recoverAddress(digest, signatureHex) {
  const raw = strip0x(signatureHex);
  if (raw.length !== 130 || !/^[0-9a-fA-F]+$/.test(raw)) throw new Error('signature must be 65 bytes of hex');
  if (digest.length !== 32) throw new Error('digest must be 32 bytes');
  const r = BigInt('0x' + raw.slice(0, 64));
  const s = BigInt('0x' + raw.slice(64, 128));
  let v = parseInt(raw.slice(128, 130), 16);
  if (v >= 27) v -= 27;
  if (v !== 0 && v !== 1) throw new Error('bad recovery id');
  if (r <= 0n || r >= N || s <= 0n || s >= N) throw new Error('signature out of range');
  const y2 = mod(r * r * r + 7n, P);
  let y = modpow(y2, (P + 1n) / 4n, P);
  if ((y * y) % P !== y2) throw new Error('r is not on the curve');
  if (Number(y & 1n) !== v) y = P - y;
  const z = BigInt('0x' + bytesToHex(digest));
  const rInv = inv(r, N);
  const q = add(mul(mod(-z * rInv, N), G), mul(mod(s * rInv, N), [r, y]));
  if (!q) throw new Error('recovered the point at infinity');
  const pub = concat(word(q[0]), word(q[1]));
  return toChecksumAddress(bytesToHex(keccak256(pub).slice(12)));
}

// ------------------------------------------------------------------ the two signed forms

const eip191 = (msg) => keccak256(concat(utf8(`\x19Ethereum Signed Message:\n${msg.length}`), msg));
export const sha256Hex = (text) => '0x' + createHash('sha256').update(utf8(text)).digest('hex');

export function quoteDigest(m) {
  const domainSeparator = keccak256(concat(
    keccak256(utf8('EIP712Domain(string name,string version,uint256 chainId)')),
    keccak256(utf8(PINNED.domain.name)),
    keccak256(utf8(PINNED.domain.version)),
    word(PINNED.domain.chainId),
  ));
  const structHash = keccak256(concat(
    keccak256(utf8(PINNED.quoteType)),
    addrWord(m.vault), addrWord(m.feed), word(m.roundId), word(m.spot), word(m.strike),
    word(m.premiumBps), word(m.saleWindow), word(m.expiry), word(m.validUntil),
  ));
  return keccak256(concat(hexToBytes('1901'), domainSeparator, structHash));
}

// ------------------------------------------------------------------ verification

/// Verifies a parsed /api/quote response. Returns { verified, checks, payload }.
/// `payload` is parsed from the SIGNED canonical string, never from the unsigned top level, and
/// is null unless every check passed. Nothing from the response is parsed, hashed in bulk or
/// echoed before the document hash and the document signature have both passed, and a failed
/// check carries only its fixed name, never text taken from the response.
/// `opts.signer` exists for tests only; the command line always uses the pinned signer.
export function verifyResponse(res, opts = {}) {
  const signer = opts.signer ?? PINNED.signer;
  const checks = [];
  const check = (name, fn) => {
    let ok = false;
    try { ok = fn() === true; } catch { ok = false; }
    checks.push({ name, ok });
    return ok;
  };
  const failed = () => ({ verified: false, checks, payload: null });
  const eq = (a, b) => BigInt(a) === BigInt(b);

  const canonical = res?.signed_payload_canonical;
  if (!check('response_has_signed_fields', () =>
    typeof canonical === 'string' && canonical.length > 0 && canonical.length <= MAX_CANONICAL_CHARS &&
    typeof res.attestation_hash === 'string' && /^0x[0-9a-fA-F]{64}$/i.test(res.attestation_hash) &&
    typeof res.signature === 'string' && /^(0x)?[0-9a-fA-F]{130}$/i.test(res.signature))) return failed();
  if (!check('document_hash_matches', () => sha256Hex(canonical) === res.attestation_hash.toLowerCase())) return failed();
  if (!check('document_signed_by_pinned_signer', () =>
    sameAddr(recoverAddress(eip191(hexToBytes(res.attestation_hash)), res.signature), signer))) return failed();

  // From here on the document is known to be exactly what the pinned key signed.
  let payload = null;
  if (!check('document_parses', () => {
    payload = JSON.parse(canonical);
    return payload !== null && typeof payload === 'object' && !Array.isArray(payload);
  })) return failed();

  check('schema_is_known', () => payload.schema === PINNED.schema && payload.schema_version === PINNED.schemaVersion);
  check('document_names_pinned_signer', () => sameAddr(payload.signer, signer));
  check('market_is_the_pinned_vault_and_feed', () =>
    payload.market?.chain_id === PINNED.chainId && sameAddr(payload.market?.vault, PINNED.vault) && sameAddr(payload.market?.feed, PINNED.feed));
  check('timestamp_is_an_integer', () => Number.isSafeInteger(payload.unix_timestamp) && payload.unix_timestamp > 0);

  const oc = payload.onchain_quote;
  if (payload.status === 'QUOTE_OK') {
    if (check('quote_present', () => !!payload.quote && !!oc && !!oc.message && !!payload.spot && !!payload.realized_vol && !!payload.vault_bounds)) {
      const m = oc.message;
      check('typed_quote_domain_and_type_are_pinned', () =>
        oc.type === PINNED.quoteType && oc.domain?.name === PINNED.domain.name &&
        oc.domain?.version === PINNED.domain.version && oc.domain?.chainId === PINNED.domain.chainId);
      check('typed_quote_digest_matches', () => '0x' + bytesToHex(quoteDigest(m)) === String(oc.digest).toLowerCase());
      check('typed_quote_signed_by_pinned_signer', () => sameAddr(recoverAddress(quoteDigest(m), oc.signature), signer));
      check('typed_quote_says_the_same_as_document', () =>
        sameAddr(m.vault, payload.market.vault) && sameAddr(m.feed, payload.market.feed) &&
        eq(m.strike, payload.quote.strike_raw) && eq(m.premiumBps, payload.quote.premium_bps) &&
        eq(m.expiry, payload.quote.expiry) && eq(m.validUntil, payload.quote.valid_until) &&
        eq(m.spot, payload.spot.price_raw) && eq(m.roundId, payload.spot.round_id));
      check('prices_have_8_decimals_and_strike_is_above_spot', () =>
        payload.spot.decimals === 8 && BigInt(payload.spot.price_raw) > 0n && BigInt(payload.quote.strike_raw) > BigInt(payload.spot.price_raw));
    }
  } else {
    check('no_quote_carries_no_price', () => typeof payload.status === 'string' && payload.status.startsWith('NO_QUOTE') && payload.quote == null && oc == null);
  }
  return checks.every((c) => c.ok) ? { verified: true, checks, payload } : failed();
}

// ------------------------------------------------------------------ summary

/// raw integer with `dec` decimals -> string with `places` decimals, truncated (never rounded up).
export function fmt(raw, dec, places) {
  let v = BigInt(raw);
  const neg = v < 0n;
  if (neg) v = -v;
  const scale = 10n ** BigInt(dec);
  const whole = v / scale;
  const frac = (v % scale).toString().padStart(dec, '0').slice(0, places);
  return (neg ? '-' : '') + whole.toString() + (places > 0 ? '.' + frac.padEnd(places, '0') : '');
}
/// decimal string -> integer with 18 decimals. Rejects anything that is not a plain positive number.
export function parseShares(s) {
  if (typeof s !== 'string' || !/^\d{1,12}(\.\d{1,18})?$/.test(s)) throw new Error('shares must be a plain positive number, for example 2.5');
  const [w, f = ''] = s.split('.');
  const v = BigInt(w) * 10n ** 18n + BigInt(f.padEnd(18, '0'));
  if (v <= 0n) throw new Error('shares must be greater than zero');
  return v;
}
const iso = (unix) => new Date(Number(unix) * 1000).toISOString().replace('.000Z', 'Z');
const bpsPct = (bps) => fmt(BigInt(bps), 2, 2) + '%';
const wadPct = (wad) => fmt(BigInt(wad) * 100n, 18, 2) + '%';
function ageText(seconds) {
  const s = Math.max(Number(seconds), 0);
  if (s < 120) return `${s} seconds`;
  if (s < 7200) return `${Math.round(s / 60)} minutes`;
  if (s < 172800) return `${Math.round(s / 3600)} hours`;
  return `${Math.round(s / 86400)} days`;
}

/// Plain-language summary of a VERIFIED payload. Every figure is derived from the signed raw
/// integers (8 decimal prices, basis points, unix times, 18 decimal volatilities).
export function summarize(payload, nowUnix, sharesStr = null) {
  const signedAt = iso(payload.unix_timestamp);
  const symbol = typeof payload.market?.symbol === 'string' ? payload.market.symbol : 'TSLAc';
  const out = {
    label: payload.label,
    status: payload.status,
    status_reason: payload.status_reason ?? null,
    symbol,
    stock_token: payload.market?.stock_token ?? null,
    chain: 'Base (8453)',
    signed_at: signedAt,
    sequence: payload.sequence,
    age_seconds: nowUnix - Number(payload.unix_timestamp),
  };
  const vb = payload.vault_bounds;
  if (vb) {
    out.vault = {
      address: payload.market.vault,
      open_for_deposits: BigInt(vb.deposit_cap_raw) > 0n,
      holds_stock: vb.total_assets_raw == null ? null : BigInt(vb.total_assets_raw) > 0n,
      epoch_live: vb.epoch_live === true,
      epochs_opened_so_far: Number(vb.current_epoch),
      could_open_an_epoch_now: vb.could_open_now === true,
      open_blockers: Array.isArray(vb.open_blockers) ? vb.open_blockers : [],
      audited: false,
    };
  }
  const lines = [];
  const isQuote = payload.status === 'QUOTE_OK';
  if (!isQuote) {
    out.quote = null;
    lines.push(`Kerne has no ${symbol} covered call quote right now (${payload.status}, signed ${signedAt}).`);
    if (payload.status_reason) lines.push(`Reason given by the agent: ${payload.status_reason}.`);
    lines.push('A new signed record is published every 15 minutes. Quotes appear while the Chainlink feed is updating, which is around US market hours.');
    if (sharesStr !== null) lines.push('There is no quote, so there is no premium to size for your shares.');
  } else {
    const q = payload.quote, spot = payload.spot, rv = payload.realized_vol;
    const spotRaw = BigInt(spot.price_raw), strikeRaw = BigInt(q.strike_raw), bps = BigInt(q.premium_bps);
    const expiry = Number(q.expiry), validUntil = Number(q.valid_until);
    const expired = nowUnix > validUntil;
    const otmBps = ((strikeRaw - spotRaw) * 10000n) / spotRaw;
    const spotAge = Number(payload.chain?.block_timestamp ?? payload.unix_timestamp) - Number(spot.updated_at); // age at the signed block
    const windowDays = fmt((BigInt(rv.window_seconds) * 10n) / 86400n, 1, 1);
    const atDeltaTarget = q.strike_bound === 'delta_target';
    out.quote = {
      spot_usd: fmt(spotRaw, 8, 2),
      spot_age_seconds: spotAge,
      strike_usd: fmt(strikeRaw, 8, 2),
      strike_above_spot: bpsPct(otmBps),
      strike_call_delta: fmt(BigInt(q.call_delta_wad), 18, 2),
      strike_set_by: atDeltaTarget ? 'the 0.20 delta target' : 'the vault minimum distance, which is further out than the delta target',
      premium_bps: Number(bps),
      premium_of_notional: bpsPct(bps),
      premium_paid_in: 'the stock itself, not dollars',
      option_expiry: iso(expiry),
      days_to_option_expiry: fmt((BigInt(Math.max(expiry - nowUnix, 0)) * 100n) / 86400n, 2, 2),
      realized_vol: wadPct(rv.annualized_vol_wad),
      realized_vol_window_days: windowDays,
      priced_vol: wadPct(q.priced_vol_wad),
      quote_valid_until: iso(validUntil),
      quote_expired: expired,
      seconds_until_quote_expires: Math.max(validUntil - nowUnix, 0),
      vault_could_sell_at_this_price_now: q.sellable_now === true,
    };
    const o = out.quote;
    lines.push(`Kerne reference quote for a covered call on ${symbol} (Coinbase tokenized stock on Base), signed ${signedAt}:`);
    lines.push(`- Spot: $${o.spot_usd} (Chainlink TSLA feed, last updated ${Math.round(spotAge / 60)} min before signing)`);
    lines.push(`- Strike: $${o.strike_usd}, ${o.strike_above_spot} above spot (call delta ${o.strike_call_delta}, set by ${o.strike_set_by})`);
    lines.push(`- Premium: ${o.premium_bps} bps (${o.premium_of_notional} of the position), paid in the stock`);
    lines.push(`- Option expiry: ${o.option_expiry} (${o.days_to_option_expiry} days away)`);
    lines.push(`- Volatility: ${o.realized_vol} realized over ${windowDays} days, priced at ${o.priced_vol}`);
    lines.push(expired
      ? `- This quote EXPIRED at ${o.quote_valid_until}, ${ageText(nowUnix - validUntil)} ago. A new one is signed every 15 minutes: fetch again before relying on it.`
      : `- Quote valid until ${o.quote_valid_until} (${o.seconds_until_quote_expires}s left). A new one is signed every 15 minutes.`);

    if (sharesStr !== null && expired) {
      out.position = null;
      lines.push('No position is sized because this quote has expired. Fetch again in a minute.');
    } else if (sharesStr !== null) {
      const sh = parseShares(sharesStr); // 18 decimals
      const premiumShares = (sh * bps) / 10000n; // 18 decimals, rounded down
      const usd = (x18) => fmt((x18 * spotRaw) / 10n ** 18n, 8, 2); // value at the signed spot
      out.position = {
        shares: fmt(sh, 18, 6),
        value_at_spot_usd: usd(sh),
        premium_in_stock: fmt(premiumShares, 18, 6),
        premium_value_at_spot_usd: usd(premiumShares),
        price_gain_kept_up_to_strike_usd: fmt((sh * (strikeRaw - spotRaw)) / 10n ** 18n, 8, 2),
        note: 'Above the strike at expiry the holder gives up the gain past the strike. Below it, the holder keeps the stock and the premium. The premium does not protect against the stock falling.',
      };
      const p = out.position;
      lines.push(`For ${p.shares} ${symbol} (about $${p.value_at_spot_usd} at spot):`);
      lines.push(`- At this quote the premium would be ${p.premium_in_stock} ${symbol}, about $${p.premium_value_at_spot_usd}`);
      lines.push(`- Price gain kept if the stock rises to the strike: about $${p.price_gain_kept_up_to_strike_usd}`);
    }
    lines.push(`Gains above $${o.strike_usd} at expiry are given up. If the stock falls, the holder takes the fall less the premium: the premium is not downside protection.`);
  }
  if (out.vault) {
    const v = out.vault;
    const facts = [v.open_for_deposits ? 'the deposit cap is above zero' : 'closed to new deposits (the deposit cap is 0)'];
    if (v.holds_stock === false) facts.push('it holds no stock');
    if (v.holds_stock === true) facts.push('it holds stock');
    if (v.epoch_live) facts.push('an epoch is live');
    else if (v.epochs_opened_so_far === 0) facts.push('it has never opened an epoch');
    lines.push(`Vault status: ${facts.join(', ')}. The vault is not audited.`);
    if (isQuote && !v.could_open_an_epoch_now) {
      lines.push(`The vault could not open an epoch on this quote right now${v.open_blockers.length ? ': ' + v.open_blockers.join('; ') : ''}.`);
    }
  }
  lines.push('This is a model value from a published rule, not a market price. ' + String(payload.label ?? ''));
  out.summary_text = lines.join('\n');
  return out;
}

// ------------------------------------------------------------------ result

const NO_NUMBERS = 'Do NOT report any strike, premium, price or other figure, and do not reuse an earlier quote.';

/// Turns a parsed response into { code, output }. No network, no clock: pure, so it can be tested.
export function buildResult(res, nowUnix, sharesStr = null, opts = {}) {
  const { verified, checks, payload } = verifyResponse(res, opts);
  if (!verified) {
    return { code: 2, output: {
      ok: false, verified: false, pinned_signer: PINNED.signer,
      failed_checks: checks.filter((c) => !c.ok).map((c) => c.name),
      instruction: `${NO_NUMBERS} Tell the user the Kerne quote failed its signature check.`,
    } };
  }
  const age = nowUnix - payload.unix_timestamp;
  if (age > MAX_AGE_SECONDS) {
    return { code: 4, output: {
      ok: false, verified: true, stale: true, pinned_signer: PINNED.signer,
      newest_record_signed_at: iso(payload.unix_timestamp), age_seconds: age,
      instruction: `${NO_NUMBERS} Tell the user the newest signed Kerne record is ${ageText(age)} old, so there is no current quote, and offer to try again later.`,
    } };
  }
  let summary;
  try {
    summary = summarize(payload, nowUnix, sharesStr);
  } catch {
    return { code: 3, output: {
      ok: false, verified: true, error: 'the signed record has a shape this script does not understand',
      instruction: `${NO_NUMBERS} Tell the user the quote could not be read.`,
    } };
  }
  return { code: 0, output: {
    ok: true, verified: true, stale: false, pinned_signer: PINNED.signer,
    checks_passed: checks.length, checks: checks.map((c) => c.name),
    attestation_hash: res.attestation_hash.toLowerCase(),
    ...summary,
  } };
}

// ------------------------------------------------------------------ cli

async function fetchQuote() {
  let last = 'no response';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(ENDPOINT, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!r.ok) { last = `HTTP ${r.status}`; continue; }
      const body = await r.text();
      if (body.length > MAX_BODY_CHARS) { last = 'response too large'; continue; }
      try { return JSON.parse(body); } catch { last = 'response was not JSON'; }
    } catch {
      last = 'network error or timeout';
    }
  }
  throw new Error(last);
}

export async function main(argv) {
  const bad = (error) => { console.log(JSON.stringify({ ok: false, error })); return 1; };
  const args = { shares: null, text: false, file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--shares') {
      args.shares = argv[++i];
      try { parseShares(args.shares); } catch (e) { return bad(e.message); }
    } else if (a === '--text') args.text = true;
    else if (a === '--file') {
      args.file = argv[++i];
      if (typeof args.file !== 'string' || args.file.length === 0) return bad('--file needs a path');
    } else if (a === '--help' || a === '-h') {
      console.log('usage: node quote.mjs [--shares <number>] [--text] [--file <saved response.json>]');
      return 0;
    } else return bad('unknown argument');
  }
  let res;
  try {
    if (args.file !== null) {
      let body;
      try { body = readFileSync(args.file, 'utf8'); } catch { throw new Error('the file could not be read'); }
      if (body.length > MAX_BODY_CHARS) throw new Error('the file is too large');
      try { res = JSON.parse(body); } catch { throw new Error('the file is not JSON'); }
    } else {
      res = await fetchQuote();
    }
  } catch (e) {
    console.log(JSON.stringify({
      ok: false, verified: false, error: `could not get the quote: ${e.message}`,
      instruction: `${NO_NUMBERS} Tell the user the Kerne quote could not be fetched and offer to retry later.`,
    }, null, 2));
    return 3;
  }
  const { code, output } = buildResult(res, Math.floor(Date.now() / 1000), args.shares);
  if (code === 0) output.source = args.file !== null ? 'file' : ENDPOINT;
  if (args.text && code === 0) {
    console.log(output.summary_text);
    console.log(`Verified: ${output.checks_passed} of ${output.checks_passed} checks passed against signer ${PINNED.signer}.`);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
  return code;
}

// Run only when executed directly. Real paths are compared so a symlinked or junctioned skill
// folder still runs instead of exiting silently.
function isMain() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}
if (isMain()) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    () => { console.log(JSON.stringify({ ok: false, verified: false, error: 'unexpected error', instruction: NO_NUMBERS })); process.exitCode = 3; },
  );
}
