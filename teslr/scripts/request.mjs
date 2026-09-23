#!/usr/bin/env node
// Fixed-origin transport. User text is input data, never JavaScript or shell source.
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { catalog, validateRequest } from './policy.mjs';

const ORIGIN = 'https://teslr.club';
const MAX_INPUT_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 120_000;
const CONFIRMATION_AGE_MS = 5 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KNOWN_API_ERRORS = new Set([
  'confirmation_required', 'invalid_tesla_connection_token',
  'missing_tesla_connection_token', 'tesla_connection_not_found',
  'tesla_connection_expired', 'tesla_reconnect_required',
  'insufficient_credits', 'credit_operation_replayed', 'idempotency_conflict',
  'idempotency_key_conflict', 'idempotency_key_required',
  'invalid_idempotency_key', 'rate_limit_exceeded', 'fair_use_limit_exceeded',
  'provider_outcome_unknown', 'provider_dispatch_unknown', 'internal_error',
  'vehicle_not_found', 'vehicle_unavailable', 'vehicle_asleep',
  'energy_site_not_found', 'unsupported_command', 'unsupported_resource',
  'unsupported_provider', 'invalid_parameters', 'invalid_query_parameter',
  'place_selection_stale', 'place_search_unverified', 'place_not_found',
  'json_required', 'personal_data_opt_in_required',
  'tesla_virtual_key_not_paired', 'tesla_command_scope_required', 'tesla_scope_required',
  'tesla_partner_scope_unavailable', 'tesla_timeout', 'tesla_command_timeout',
  'tesla_vehicle_unavailable', 'tesla_command_proxy_unavailable',
  'tesla_command_proxy_required', 'tesla_invalid_command', 'tesla_request_rejected',
  'tesla_reauthorization_required', 'tesla_payment_required', 'tesla_access_denied',
  'tesla_resource_not_found', 'tesla_precondition_failed', 'tesla_region_mismatch',
  'tesla_account_locked', 'tesla_rate_limited', 'tesla_privacy_restriction',
  'tesla_device_error', 'tesla_request_failed',
  'beta_fair_use_limit', 'beta_cooldown_active', 'beta_access_paused',
]);

class RequestError extends Error {
  constructor(code, details = {}) { super(code); this.code = code; this.details = details; }
}

function fail(code) { throw new RequestError(code); }

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readToken() {
  const token = process.env.TESLR_FLEET_TOKEN;
  if (!token || token.length < 16 || token.length > 4096 || /\s/.test(token)) {
    fail('secure_token_missing_or_invalid');
  }
  return token;
}

function parseJson(text) {
  if (Buffer.byteLength(text, 'utf8') > MAX_INPUT_BYTES) fail('request_too_large');
  let value;
  try { value = JSON.parse(text); } catch { fail('invalid_json'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_envelope');
  return value;
}

export function decodeRequest(encoded) {
  // Enforce the literal canonical Base64 alphabet: no shell metacharacters,
  // whitespace, URL-safe alternative encoding, or silently ignored garbage.
  if (typeof encoded !== 'string' || encoded.length > Math.ceil(MAX_INPUT_BYTES / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    fail('invalid_request_base64');
  }
  const decoded = Buffer.from(encoded, 'base64');
  if (decoded.toString('base64') !== encoded) fail('invalid_request_base64');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(decoded); }
  catch { fail('invalid_utf8'); }
  return parseJson(text);
}

function safePolicy(envelope) {
  let request;
  try { request = validateRequest(envelope); }
  catch { fail('invalid_request'); }
  // Defense in depth, independent of the operation catalog.
  if (!request || !['GET', 'POST', 'DELETE'].includes(request.method) ||
      typeof request.path !== 'string' || !request.path.startsWith('/api/') ||
      /[?#\\\r\n]/.test(request.path) || request.path.includes('..') ||
      (request.method !== 'GET') !== request.write) fail('invalid_request');
  return request;
}

function prepare(envelope, token) {
  const request = safePolicy(envelope);
  const idempotencyKey = envelope.idempotencyKey ?? randomUUID();
  if (!UUID.test(idempotencyKey)) fail('invalid_idempotency_key');
  const normalized = {
    method: request.method,
    path: request.path,
    query: request.query ?? {},
    body: request.body ?? null,
    target: envelope.target ?? null,
    idempotencyKey,
  };
  // Credentials never enter arguments or output. Binding the approval to this
  // token prevents reusing a confirmation after switching configured accounts.
  const operationHash = digest(canonical({
    ...normalized,
    credentialBinding: request.write ? digest(token ?? readToken()) : null,
  }));
  return { request, normalized, operationHash, idempotencyKey };
}

export function prepareRequest(envelope) {
  const prepared = prepare(envelope);
  const { confirmation: _confirmation, ...unconfirmed } = envelope;
  return {
    ok: true,
    preview: true,
    untrustedData: true,
    write: prepared.request.write,
    risk: prepared.request.risk ?? null,
    consequence: prepared.request.consequence ?? null,
    operationHash: prepared.operationHash,
    request: prepared.normalized,
    envelope: { ...unconfirmed, idempotencyKey: prepared.idempotencyKey },
    confirmationExpiresAfterSeconds: CONFIRMATION_AGE_MS / 1000,
    requiresHumanApproval: prepared.request.write,
  };
}

function checkApproval(envelope, prepared, now) {
  if (!prepared.request.write) return;
  if (!envelope.idempotencyKey) fail('preview_required');
  const proof = envelope.confirmation;
  if (!proof || proof.approved !== true ||
      proof.operationHash !== prepared.operationHash) fail('confirmation_required');
  if (prepared.request.risk === 'critical' && proof.riskAcknowledged !== true) {
    fail('risk_acknowledgment_required');
  }
  if (typeof proof.confirmedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(proof.confirmedAt)) {
    fail('confirmation_expired');
  }
  const confirmedAt = Date.parse(proof.confirmedAt);
  if (!Number.isFinite(confirmedAt) || new Date(confirmedAt).toISOString() !== proof.confirmedAt ||
      confirmedAt > now || now - confirmedAt > CONFIRMATION_AGE_MS) fail('confirmation_expired');
}

function apiCode(data) {
  const code = data?.error?.code;
  return KNOWN_API_ERRORS.has(code) ? code : 'api_request_failed';
}

function retryAfterSeconds(header) {
  if (typeof header !== 'string') return undefined;
  let seconds;
  if (/^\d{1,7}$/.test(header)) seconds = Number(header);
  else if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(header)) {
    const parsed = Date.parse(header);
    if (new Date(parsed).toUTCString() !== header) return undefined;
    seconds = Math.max(0, Math.ceil((parsed - Date.now()) / 1000));
  }
  return Number.isInteger(seconds) && seconds >= 0 && seconds <= 604800 ? seconds : undefined;
}

function redactToken(value, token) {
  // Defense in depth against an echoed credential, including property names.
  if (typeof value === 'string') return value.split(token).join('[credential redacted]');
  if (Array.isArray(value)) return value.map((item) => redactToken(item, token));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      [key.split(token).join('[credential redacted]'), redactToken(item, token)]));
  }
  return value;
}

async function readResponse(response) {
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    await response.body?.cancel();
    fail('non_json_response');
  }
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    fail('response_too_large');
  }
  if (!response.body) fail('invalid_response');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        fail('response_too_large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
  catch { fail('invalid_response'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('invalid_response');
  return data;
}

async function http(request, token, idempotencyKey, fetchImpl) {
  const url = new URL(request.path, ORIGIN);
  if (url.origin !== ORIGIN) fail('invalid_request');
  for (const [key, value] of Object.entries(request.query ?? {})) {
    url.searchParams.set(key, String(value));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: request.method,
      headers: {
        authorization: `Bearer ${token}`,
        'x-teslr-provider': 'tesla',
        'x-teslr-include-personal-data': 'false',
        'idempotency-key': idempotencyKey,
        accept: 'application/json',
        ...(request.body ? { 'content-type': 'application/json' } : {}),
      },
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) fail('redirect_rejected');
    const data = await readResponse(response);
    return {
      status: response.status, successfulHttp: response.ok, data,
      retryAfterSeconds: retryAfterSeconds(response.headers.get('retry-after')),
    };
  } finally { clearTimeout(timeout); }
}

async function preflight(envelope, token, fetchImpl) {
  let path;
  if (envelope.operation === 'disconnect') path = '/api/tesla/connection';
  else if (envelope.operation === 'clear-default') path = '/api/preferences/default-vehicle';
  else if (envelope.target?.startsWith('vehicle-')) path = '/api/vehicles';
  else if (envelope.target?.startsWith('energy-')) path = '/api/energy';
  else fail('target_required');
  const result = await http({ method: 'GET', path }, token, randomUUID(), fetchImpl);
  if (!result.successfulHttp || result.data.ok !== true) {
    throw new RequestError(apiCode(result.data), {
      phase: 'target_revalidation', status: result.status,
      ...(result.retryAfterSeconds !== undefined ? { retryAfterSeconds: result.retryAfterSeconds } : {}),
    });
  }
  if (envelope.operation === 'disconnect') {
    if (result.data.connected !== true || result.data.provider !== 'tesla') fail('target_revalidation_failed');
  } else if (envelope.operation === 'clear-default') {
    if (result.data.defaultVehicle?.id !== envelope.target) fail('target_changed');
  } else {
    const list = path === '/api/vehicles' ? result.data.vehicles : result.data.energySites;
    if (!Array.isArray(list)) fail('target_revalidation_failed');
    const target = list.find((item) => item?.id === envelope.target);
    if (!target) fail('target_changed');
    if (target.active === false) fail('target_unavailable');
  }
}

function outcome(envelope, response) {
  const { data, successfulHttp, status } = response;
  const flags = [data.ok, data.success, data.result,
    data.response?.success, data.response?.result,
    data.data?.success, data.data?.result];
  if (data.billing?.reconciliationRequired === true ||
      ['ambiguous', 'reconciliation_required'].includes(data.billing?.status) ||
      ['provider_dispatch_unknown', 'provider_outcome_unknown', 'credit_operation_replayed']
        .includes(data.error?.code)) return 'outcome_unknown';
  if (!successfulHttp) return status >= 500 || ![400, 401, 403, 404, 415, 422, 429].includes(status)
    ? 'outcome_unknown' : 'rejected';
  if (flags.some((flag) => flag === false)) return 'rejected';
  if (data.result === true || data.success === true || data.response?.result === true ||
      data.response?.success === true || data.data?.result === true || data.data?.success === true) {
    return 'confirmed';
  }
  if (envelope.operation === 'set-default' && data.changed === true &&
      data.defaultVehicle?.id === envelope.target) return 'confirmed';
  if (envelope.operation === 'clear-default' && data.ok === true &&
      data.status === 'unset' && data.defaultVehicle === null) return 'confirmed';
  if (envelope.operation === 'disconnect' && data.ok === true && data.revoked === true) return 'confirmed';
  return 'outcome_unknown';
}

// Dependency injection is for offline imported tests, not a command-line host,
// token, timeout, retry or executable-code override.
export async function runRequest(envelope, { preview = false, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let dispatchedWrite = false;
  try {
    if (preview) return prepareRequest(envelope);
    const token = readToken();
    const prepared = prepare(envelope, token);
    checkApproval(envelope, prepared, now());
    if (prepared.request.write) {
      await preflight(envelope, token, fetchImpl);
      // A slow list response must not extend an expired approval.
      checkApproval(envelope, prepared, now());
      dispatchedWrite = true;
    }
    const response = await http(prepared.request, token, prepared.idempotencyKey, fetchImpl);
    const writeOutcome = prepared.request.write ? outcome(envelope, response) : undefined;
    const ok = prepared.request.write ? writeOutcome === 'confirmed'
      : response.successfulHttp && response.data.ok !== false && response.data.success !== false;
    return {
      ok,
      status: response.status,
      untrustedData: true,
      ...(response.retryAfterSeconds !== undefined ? { retryAfterSeconds: response.retryAfterSeconds } : {}),
      ...(writeOutcome ? { outcome: writeOutcome } : {}),
      ...(ok ? { data: redactToken(response.data, token) }
        : { code: apiCode(response.data), retryAutomatically: false }),
    };
  } catch (error) {
    return {
      ok: false,
      code: error instanceof RequestError ? error.code : 'request_failed',
      ...(error instanceof RequestError ? error.details : {}),
      ...(dispatchedWrite ? { outcome: 'outcome_unknown' } : { outcome: 'not_dispatched' }),
      retryAutomatically: false,
    };
  }
}

async function readInput(argv) {
  let preview = false;
  let encoded;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--preview' && !preview) preview = true;
    else if (argv[index] === '--request-base64' && encoded === undefined && argv[index + 1]) {
      encoded = argv[++index];
    } else fail('invalid_arguments');
  }
  if (encoded !== undefined) return { preview, envelope: decodeRequest(encoded) };
  if (process.stdin.isTTY) fail('structured_input_required');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > MAX_INPUT_BYTES) fail('request_too_large');
    chunks.push(chunk);
  }
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
  catch { fail('invalid_utf8'); }
  return { preview, envelope: parseJson(text) };
}

async function main() {
  let result;
  try {
    if (process.argv.length === 3 && process.argv[2] === '--capabilities') {
      process.stdout.write(`${JSON.stringify({ ok: true, capabilities: catalog })}\n`);
      return;
    }
    const { preview, envelope } = await readInput(process.argv.slice(2));
    result = await runRequest(envelope, { preview });
  } catch (error) {
    result = { ok: false, code: error instanceof RequestError ? error.code : 'request_failed' };
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
