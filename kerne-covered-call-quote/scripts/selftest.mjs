#!/usr/bin/env node
// Offline self-test for quote.mjs. No network. Run: node selftest.mjs
// It checks the hash function against published vectors, verifies a saved live quote
// (fixture.json, signed by the real Kerne signer), and confirms that edited copies are refused.

import { readFileSync } from 'node:fs';
import { keccak256, verifyResponse, summarize, buildResult, PINNED } from './quote.mjs';

const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const enc = (s) => new TextEncoder().encode(s);
let failed = 0;
const t = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failed++; };

t('keccak256("")', hex(keccak256(enc(''))) === 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
t('keccak256("abc")', hex(keccak256(enc('abc'))) === '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
t('keccak256 of 200 bytes (two blocks)', hex(keccak256(new Uint8Array(200).fill(0xa3))) === '3a57666b048777f2c953dc4456f45a2588e1cb6f2da760122d530ac2ce607d4a');

const fixture = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));
const good = verifyResponse(fixture);
t(`saved live quote verifies against ${PINNED.signer}`, good.verified);
t('saved live quote summarizes', good.verified && typeof summarize(good.payload, 1794597400, '1').summary_text === 'string');

const clone = () => JSON.parse(JSON.stringify(fixture));
const refuses = (name, edit) => { const c = clone(); edit(c); t(`refuses: ${name}`, verifyResponse(c).verified === false); };

refuses('strike edited inside the signed document', (c) => { c.signed_payload_canonical = c.signed_payload_canonical.replace('"premium_bps":', '"premium_bps":1'); });
refuses('hash swapped', (c) => { c.attestation_hash = '0x' + '11'.repeat(32); });
refuses('signature byte flipped', (c) => { c.signature = c.signature.slice(0, 20) + (c.signature[20] === 'a' ? 'b' : 'a') + c.signature.slice(21); });
refuses('signature removed', (c) => { delete c.signature; });
refuses('empty object', (c) => { for (const k of Object.keys(c)) delete c[k]; });

// The unsigned top-level copy must never be what gets reported.
const lied = clone();
lied.quote.premium_bps = 9999;
lied.quote.strike = '1.00000000';
const v = verifyResponse(lied);
t('unsigned top-level fields are ignored', v.verified && v.payload.quote.premium_bps === good.payload.quote.premium_bps);

// A genuine quote that is too old is reported without numbers.
const signedAt = good.payload.unix_timestamp;
const old = buildResult(fixture, signedAt + 3 * 3600);
t('a genuine quote 3 hours old is reported as stale, with no numbers', old.code === 4 && !('quote' in old.output) && !('summary_text' in old.output));
t('the same quote 1 minute old is reported', buildResult(fixture, signedAt + 60).code === 0);
const bad = clone();
bad.signed_payload_canonical = JSON.stringify({ status: 'QUOTE_OK', note: 'INJECTED-TEXT' });
t('a failed check never echoes text from the response', !JSON.stringify(buildResult(bad, signedAt).output).includes('INJECTED'));

console.log(failed === 0 ? '\nALL OK' : `\n${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
