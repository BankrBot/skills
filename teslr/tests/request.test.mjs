import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decodeRequest, prepareRequest, runRequest } from '../scripts/request.mjs';

const TOKEN = 'synthetic-offline-token-not-a-real-credential';
const VEHICLE = 'vehicle-0123456789abcdef0123';
const OTHER_VEHICLE = 'vehicle-abcdef0123456789abcd';
const ENERGY = 'energy-0123456789abcdef0123';
const NOW = Date.parse('2026-09-07T12:00:00.000Z');
const CLI = fileURLToPath(new URL('../scripts/request.mjs', import.meta.url));
const LOCK = { operation: 'fleet-command', target: VEHICLE, command: 'door_lock', parameters: {} };
let oldToken;
let oldFetch;
before(() => {
  oldToken = process.env.TESLR_FLEET_TOKEN;
  oldFetch = globalThis.fetch;
  process.env.TESLR_FLEET_TOKEN = TOKEN;
  globalThis.fetch = async () => { throw new Error('Live HTTP is forbidden in these tests'); };
});
after(() => {
  if (oldToken === undefined) delete process.env.TESLR_FLEET_TOKEN;
  else process.env.TESLR_FLEET_TOKEN = oldToken;
  globalThis.fetch = oldFetch;
});

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', ...headers },
});
const listed = () => json({ ok: true, vehicles: [{ id: VEHICLE }, { id: OTHER_VEHICLE }] });
function approved(envelope = LOCK) {
  const preview = prepareRequest(envelope);
  return {
    ...preview.envelope,
    confirmation: {
      approved: true, confirmedAt: new Date(NOW).toISOString(),
      operationHash: preview.operationHash, riskAcknowledged: true,
    },
  };
}
function fixture(responses) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      assert.ok(response, 'Unexpected HTTP request');
      return typeof response === 'function' ? response() : response;
    },
  };
}
const options = (mock) => ({ fetchImpl: mock.fetchImpl, now: () => NOW });

test('canonical Base64 decodes JSON as data and rejects alternate or malformed encodings', () => {
  const envelope = { operation: 'vehicles' };
  const encoded = Buffer.from(JSON.stringify(envelope)).toString('base64');
  assert.deepEqual(decodeRequest(encoded), envelope);
  for (const value of [`${encoded}\n`, `${encoded};whoami`, 'e30', '!!!!', '/w==']) {
    assert.throws(() => decodeRequest(value));
  }
});

test('preview is local and contains exact operation without token or credential fingerprint', () => {
  const preview = prepareRequest(LOCK);
  assert.equal(preview.preview, true);
  assert.equal(preview.request.path, `/api/vehicles/${VEHICLE}/fleet-commands`);
  assert.equal(preview.request.body.command, 'door_lock');
  assert.equal(preview.request.target, VEHICLE);
  assert.match(preview.operationHash, /^[a-f0-9]{64}$/);
  assert.equal(preview.envelope.confirmation, undefined);
  assert.equal(JSON.stringify(preview).includes(TOKEN), false);
  assert.equal(JSON.stringify(preview).includes('credentialBinding'), false);
});

test('write preview needs only the internally read token, read preview does not', async () => {
  delete process.env.TESLR_FLEET_TOKEN;
  try {
    assert.equal(prepareRequest({ operation: 'vehicles' }).write, false);
    const result = await runRequest(LOCK, { preview: true });
    assert.equal(result.code, 'secure_token_missing_or_invalid');
  } finally { process.env.TESLR_FLEET_TOKEN = TOKEN; }
});

test('the exact hash binds target, command, parameters and UUID but not confirmation timestamp', () => {
  const first = prepareRequest(LOCK);
  assert.equal(prepareRequest(first.envelope).operationHash, first.operationHash);
  const second = prepareRequest({ ...first.envelope, target: OTHER_VEHICLE });
  assert.notEqual(second.operationHash, first.operationHash);
  assert.notEqual(prepareRequest(LOCK).operationHash, first.operationHash);
  assert.equal(prepareRequest({ ...first.envelope, confirmation: approved().confirmation }).operationHash,
    first.operationHash);
});

test('unapproved writes make no network calls, not even a target lookup', async () => {
  const mock = fixture([]);
  const result = await runRequest(LOCK, options(mock));
  assert.equal(result.ok, false);
  assert.equal(result.outcome, 'not_dispatched');
  assert.equal(mock.calls.length, 0);
});

test('changed target or key invalidates approval before network access', async () => {
  for (const change of [{ target: OTHER_VEHICLE }, { idempotencyKey: '12345678-1234-4234-8234-123456789abc' }]) {
    const mock = fixture([]);
    const result = await runRequest({ ...approved(), ...change }, options(mock));
    assert.equal(result.code, 'confirmation_required');
    assert.equal(mock.calls.length, 0);
  }
});

test('switching configured credentials invalidates existing approval', async () => {
  const envelope = approved();
  process.env.TESLR_FLEET_TOKEN = 'synthetic-offline-different-account-token';
  try {
    const mock = fixture([]);
    const result = await runRequest(envelope, options(mock));
    assert.equal(result.code, 'confirmation_required');
    assert.equal(mock.calls.length, 0);
  } finally { process.env.TESLR_FLEET_TOKEN = TOKEN; }
});

test('stale, future, invalid, or missing approval times fail before HTTP', async () => {
  for (const time of [NOW - 300_001, NOW + 1, NaN, null]) {
    const envelope = approved();
    envelope.confirmation.confirmedAt = Number.isFinite(time) && time !== null
      ? new Date(time).toISOString() : 'not-a-date';
    const mock = fixture([]);
    const result = await runRequest(envelope, options(mock));
    assert.equal(result.code, Number.isFinite(time) && time !== null
      ? 'confirmation_expired' : 'invalid_request');
    assert.equal(mock.calls.length, 0);
  }
});

test('expired confirmation after a slow target check cannot dispatch a write', async () => {
  const mock = fixture([listed()]);
  let checks = 0;
  const result = await runRequest(approved(), {
    fetchImpl: mock.fetchImpl, now: () => ++checks === 1 ? NOW : NOW + 300_001,
  });
  assert.equal(result.code, 'confirmation_expired');
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].options.method, 'GET');
});

test('successful dispatch relists first, fixes origin/provider, rejects redirects, preserves write key', async () => {
  const mock = fixture([listed(), json({ ok: true, result: true })]);
  const envelope = approved();
  const result = await runRequest(envelope, options(mock));
  assert.equal(result.ok, true);
  assert.equal(result.outcome, 'confirmed');
  assert.equal(mock.calls[0].url, 'https://teslr.club/api/vehicles');
  assert.equal(mock.calls[1].options.method, 'POST');
  assert.equal(mock.calls[1].options.headers['idempotency-key'], envelope.idempotencyKey);
  assert.notEqual(mock.calls[0].options.headers['idempotency-key'], envelope.idempotencyKey);
  for (const call of mock.calls) {
    assert.equal(new URL(call.url).origin, 'https://teslr.club');
    assert.equal(call.options.redirect, 'error');
    assert.equal(call.options.headers.authorization, `Bearer ${TOKEN}`);
    assert.equal(call.options.headers['x-teslr-provider'], 'tesla');
    assert.equal(call.options.headers['x-teslr-include-personal-data'], 'false');
    assert.ok(call.options.signal instanceof AbortSignal);
  }
});

test('missing exact current target cannot silently use another vehicle', async () => {
  const mock = fixture([json({ ok: true, vehicles: [{ id: OTHER_VEHICLE }] })]);
  const result = await runRequest(approved(), options(mock));
  assert.equal(result.code, 'target_changed');
  assert.equal(result.outcome, 'not_dispatched');
  assert.equal(mock.calls.length, 1);
});

test('failed target lookup never dispatches command or returns provider error text', async () => {
  const mock = fixture([json({ ok: false, error: { code: 'internal_error', message: TOKEN } }, 500)]);
  const result = await runRequest(approved(), options(mock));
  assert.equal(result.code, 'internal_error');
  assert.equal(result.phase, 'target_revalidation');
  assert.equal(mock.calls.length, 1);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test('write network failure is unknown and is never automatically retried', async () => {
  const mock = fixture([listed(), new Error(`connection failed: ${TOKEN}`)]);
  const result = await runRequest(approved(), options(mock));
  assert.equal(result.outcome, 'outcome_unknown');
  assert.equal(result.retryAutomatically, false);
  assert.equal(mock.calls.length, 2);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test('HTTP 200 negative provider flags do not count as success', async () => {
  for (const body of [
    { ok: true, result: false }, { ok: true, success: false },
    { ok: true, response: { result: false } }, { ok: true, data: { result: false } },
  ]) {
    const mock = fixture([listed(), json(body)]);
    const result = await runRequest(approved(), options(mock));
    assert.equal(result.ok, false);
    assert.equal(result.outcome, 'rejected');
  }
});

test('missing positive result or required billing reconciliation is unknown', async () => {
  for (const body of [
    { ok: true }, { ok: true, result: null },
    { ok: true, result: true, billing: { reconciliationRequired: true } },
  ]) {
    const mock = fixture([listed(), json(body)]);
    const result = await runRequest(approved(), options(mock));
    assert.equal(result.ok, false);
    assert.equal(result.outcome, 'outcome_unknown');
  }
});

test('API failures expose only known codes/status, never body text or unknown error codes', async () => {
  for (const code of ['internal_error', `print_${TOKEN}`]) {
    const mock = fixture([listed(), json({ ok: false, error: { code, message: TOKEN } }, 502)]);
    const result = await runRequest(approved(), options(mock));
    assert.equal(result.code, code === 'internal_error' ? code : 'api_request_failed');
    assert.equal(result.status, 502);
    assert.equal(result.outcome, 'outcome_unknown');
    assert.equal(JSON.stringify(result).includes(TOKEN), false);
  }
});

test('successful data keeps operational IDs, is marked untrusted, and removes echoed token', async () => {
  const mock = fixture([json({ ok: true, vehicles: [{ id: VEHICLE, name: 'Demo' }], note: TOKEN, [TOKEN]: TOKEN })]);
  const result = await runRequest({ operation: 'vehicles' }, options(mock));
  assert.equal(result.ok, true);
  assert.equal(result.untrustedData, true);
  assert.equal(result.data.vehicles[0].id, VEHICLE);
  assert.equal(result.data.vehicles[0].name, 'Demo');
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test('redirect response never follows destination', async () => {
  const mock = fixture([new Response(null, { status: 302, headers: { location: 'https://attacker.invalid/' } })]);
  const result = await runRequest({ operation: 'vehicles' }, options(mock));
  assert.equal(result.code, 'redirect_rejected');
  assert.equal(mock.calls.length, 1);
});

test('non-JSON, oversized declared response and oversized stream are rejected', async () => {
  for (const response of [
    new Response(`<p>${TOKEN}</p>`, { headers: { 'content-type': 'text/html' } }),
    json({ ok: true }, 200, { 'content-length': String(3 * 1024 * 1024) }),
    json({ ok: true, data: 'x'.repeat(2 * 1024 * 1024) }),
  ]) {
    const mock = fixture([response]);
    const result = await runRequest({ operation: 'vehicles' }, options(mock));
    assert.equal(result.ok, false);
    assert.equal(result.outcome, 'not_dispatched');
    assert.equal(JSON.stringify(result).includes(TOKEN), false);
    assert.equal(mock.calls.length, 1);
  }
});

test('critical disconnect requires distinct risk acknowledgment and checks same connection', async () => {
  const envelope = approved({ operation: 'disconnect' });
  const missingRisk = structuredClone(envelope);
  delete missingRisk.confirmation.riskAcknowledged;
  const blocked = fixture([]);
  assert.equal((await runRequest(missingRisk, options(blocked))).code, 'risk_acknowledgment_required');
  const mock = fixture([
    json({ ok: true, connected: true, provider: 'tesla' }),
    json({ ok: true, revoked: true }),
  ]);
  const result = await runRequest(envelope, options(mock));
  assert.equal(result.outcome, 'confirmed');
  assert.equal(mock.calls[0].url, 'https://teslr.club/api/tesla/connection');
  assert.equal(mock.calls[1].options.method, 'DELETE');
});

test('clear-default binds supplied target despite DELETE having no body', async () => {
  const envelope = approved({ operation: 'clear-default', target: VEHICLE });
  const changed = fixture([json({ ok: true, defaultVehicle: { id: OTHER_VEHICLE } })]);
  const rejected = await runRequest(envelope, options(changed));
  assert.equal(rejected.code, 'target_changed');
  assert.equal(changed.calls.length, 1);
  const current = fixture([
    json({ ok: true, defaultVehicle: { id: VEHICLE } }),
    json({ ok: true, status: 'unset', defaultVehicle: null }),
  ]);
  assert.equal((await runRequest(envelope, options(current))).outcome, 'confirmed');
  assert.equal(current.calls[0].url, 'https://teslr.club/api/preferences/default-vehicle');
});

test('energy actions relist energy sites, not vehicles', async () => {
  const envelope = approved({ operation: 'energy-action', target: ENERGY, action: 'backup', parameters: { backup_reserve_percent: 40 } });
  const mock = fixture([json({ ok: true, energySites: [{ id: ENERGY }] }), json({ ok: true, result: true })]);
  const result = await runRequest(envelope, options(mock));
  assert.equal(result.outcome, 'confirmed');
  assert.equal(mock.calls[0].url, 'https://teslr.club/api/energy');
});

test('CLI accepts structured stdin or literal Base64 without dynamic evaluation', () => {
  const encoded = Buffer.from(JSON.stringify({ operation: 'vehicles' })).toString('base64');
  for (const mode of [
    { args: ['--preview', '--request-base64', encoded] },
    { args: ['--preview'], input: JSON.stringify({ operation: 'vehicles' }) },
  ]) {
    const result = spawnSync(process.execPath, [CLI, ...mode.args], {
      input: mode.input, encoding: 'utf8', env: { PATH: process.env.PATH },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).preview, true);
  }
});

test('CLI rejects URL/token overrides and malicious raw argument text', () => {
  for (const args of [
    ['--url', 'https://attacker.invalid'], ['--token', TOKEN],
    ['--request-base64', '$(touch /tmp/NEVER_CREATED_BY_TESLR_TEST)'],
    ['--preview', '--request-base64', Buffer.from(JSON.stringify({ operation: 'vehicles', token: TOKEN })).toString('base64')],
  ]) {
    const result = spawnSync(process.execPath, [CLI, ...args], {
      input: '', encoding: 'utf8', env: { PATH: process.env.PATH },
    });
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).ok, false);
    assert.equal(result.stdout.includes(TOKEN), false);
    assert.equal(result.stderr, '');
  }
});

test('inactive vehicle membership is not permission to dispatch', async () => {
  const mock = fixture([json({ ok: true, vehicles: [{ id: VEHICLE, active: false }] })]);
  const result = await runRequest(approved(), options(mock));
  assert.equal(result.code, 'target_unavailable');
  assert.equal(result.outcome, 'not_dispatched');
  assert.equal(mock.calls.length, 1);
});

test('known actionable provider error codes survive without remote prose', async () => {
  for (const code of ['tesla_virtual_key_not_paired', 'tesla_command_scope_required',
    'tesla_scope_required', 'tesla_partner_scope_unavailable', 'tesla_timeout',
    'tesla_command_proxy_unavailable', 'beta_fair_use_limit', 'beta_cooldown_active', 'beta_access_paused']) {
    const mock = fixture([json({ ok: false, error: { code, message: TOKEN } }, 429)]);
    const result = await runRequest({ operation: 'vehicles' }, options(mock));
    assert.equal(result.code, code);
    assert.equal(result.status, 429);
    assert.equal(JSON.stringify(result).includes(TOKEN), false);
  }
});

test('rate-limit metadata survives preflight without dispatch or arbitrary header echo', async () => {
  for (const [header, expected] of [['120', 120], ['0', 0], ['-1', undefined],
    ['99999999999', undefined], [TOKEN, undefined]]) {
    const mock = fixture([json({ ok: false, error: { code: 'beta_cooldown_active' } }, 429, { 'retry-after': header })]);
    const result = await runRequest(approved(), options(mock));
    assert.equal(result.retryAfterSeconds, expected);
    assert.equal(result.code, 'beta_cooldown_active');
    assert.equal(result.status, 429);
    assert.equal(result.outcome, 'not_dispatched');
    assert.equal(mock.calls.length, 1);
    assert.equal(JSON.stringify(result).includes(TOKEN), false);
  }
});

test('canonical HTTP-date Retry-After becomes bounded seconds, never raw text', async () => {
  const future = new Date(Date.now() + 60_000).toUTCString();
  const mock = fixture([json({ ok: false }, 429, { 'retry-after': future })]);
  const result = await runRequest({ operation: 'vehicles' }, options(mock));
  assert.ok(result.retryAfterSeconds >= 58 && result.retryAfterSeconds <= 60);
  assert.equal(JSON.stringify(result).includes(future), false);
});

test('explicitly reconfirmed exact retry retains UUID, method and body', async () => {
  const envelope = approved();
  const mock = fixture([listed(), json({ ok: true, result: false }), listed(), json({ ok: true, result: true })]);
  assert.equal((await runRequest(envelope, options(mock))).outcome, 'rejected');
  const preview = prepareRequest(envelope);
  assert.equal(preview.operationHash, envelope.confirmation.operationHash);
  const retry = {
    ...preview.envelope,
    confirmation: { ...envelope.confirmation, confirmedAt: new Date(NOW + 1000).toISOString() },
  };
  assert.equal((await runRequest(retry, { fetchImpl: mock.fetchImpl, now: () => NOW + 1000 })).outcome, 'confirmed');
  assert.equal(mock.calls.length, 4);
  assert.equal(mock.calls[1].options.headers['idempotency-key'], mock.calls[3].options.headers['idempotency-key']);
  assert.equal(mock.calls[1].options.method, mock.calls[3].options.method);
  assert.equal(mock.calls[1].options.body, mock.calls[3].options.body);
});

test('CLI capabilities discovery needs no token and never makes a request', () => {
  const result = spawnSync(process.execPath, [CLI, '--capabilities'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(result.status, 0, result.stdout || result.stderr);
  assert.equal(JSON.parse(result.stdout).capabilities.operations.vehicles.method, 'GET');
});

test('shell metacharacters inside an allowed text parameter remain inert JSON data', () => {
  const vehicleName = `Demo'; $(do-not-run-this) \\ \"`;
  const envelope = { operation: 'fleet-command', target: VEHICLE,
    command: 'set_vehicle_name', parameters: { vehicle_name: vehicleName } };
  const encoded = Buffer.from(JSON.stringify(envelope)).toString('base64');
  const result = spawnSync(process.execPath, [CLI, '--preview', '--request-base64', encoded], {
    encoding: 'utf8', env: { PATH: process.env.PATH, TESLR_FLEET_TOKEN: TOKEN },
  });
  assert.equal(result.status, 0, result.stdout || result.stderr);
  assert.equal(JSON.parse(result.stdout).request.body.parameters.vehicle_name, vehicleName);
  assert.equal(result.stderr, '');
});
