import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, validateRequest } from '../scripts/policy.mjs';

const vehicle = 'vehicle-00000000000000000001';
const energy = 'energy-00000000000000000002';
const driver = 'driver-00000000000000000003';
const invitation = 'invitation-00000000000000000004';
const selection = `place-${'a'.repeat(43)}`;
const command = (name, parameters = {}) => ({ operation: 'fleet-command', target: vehicle, command: name, parameters });
const rejects = (value, code) => assert.throws(() => validateRequest(value), (error) =>
  error instanceof Error && (!code || error.code === code));

test('all routes are local static paths and unknown routes cannot be supplied', () => {
  assert.equal(Object.keys(catalog.operations).length, 23);
  assert.deepEqual(validateRequest({ operation: 'command-catalog' }), {
    method: 'GET', path: '/api/commands', write: false,
  });
  for (const op of Object.values(catalog.operations)) {
    assert.match(op.path, /^\/api\//);
    assert.ok(['GET', 'POST', 'DELETE'].includes(op.method));
  }
  for (const operation of ['https://evil.invalid', '../vehicles', 'constructor', '__proto__', 'teslafy', 'commands']) {
    rejects({ operation }, 'unsupported_operation');
  }
  for (const extra of ['url', 'baseUrl', 'headers', 'method', 'path', 'provider', 'fetchImpl']) {
    rejects({ operation: 'vehicles', [extra]: 'untrusted' }, 'unknown_field');
  }
});

test('exact opaque targets reject VIN, arbitrary IDs, traversal, encoded paths and wrong kind', () => {
  for (const target of ['vehicle-abc', 'vehicle-0000000000000000000A', vehicle + '/fleet',
    vehicle + '?x=y', vehicle + '%2f..', '5YJ3E1EA0KF000000', energy, null, 123, {}]) {
    rejects({ operation: 'status', target }, 'invalid_target');
  }
  assert.equal(validateRequest({ operation: 'status', target: vehicle }).path, `/api/vehicles/${vehicle}`);
  assert.equal(validateRequest({ operation: 'energy-read', target: energy, resource: 'site-info' }).path,
    `/api/energy/${energy}/site-info`);
});

test('static data read catalog cannot be expanded by response resource names', () => {
  for (const [operation, resources] of [['data', catalog.operations.data.resources],
    ['fleet-read', catalog.operations['fleet-read'].resources],
    ['fleet-account', catalog.operations['fleet-account'].resources],
    ['energy-read', catalog.operations['energy-read'].resources]]) {
    for (const resource of Object.keys(resources)) {
      const request = { operation, resource };
      if (operation !== 'fleet-account') request.target = operation === 'energy-read' ? energy : vehicle;
      assert.equal(validateRequest(request).write, false);
      rejects({ ...request, resource: 'new-provider-operation' }, 'unsupported_resource');
      rejects({ ...request, query: { authorization: 'synthetic' } }, 'invalid_query');
    }
  }
  for (const resource of ['location', 'map', 'plate']) rejects({ operation: 'data', target: vehicle, resource });
  for (const resource of ['user-me', 'user-region', 'charging-invoice', 'vehicle-pricing']) rejects({ operation: 'fleet-account', resource });
  assert.throws(() => { catalog.operations.data.resources['dynamic-resource'] = {}; }, TypeError);
});

test('query keys and types are operation-specific and normalized without raw query interpolation', () => {
  assert.deepEqual(validateRequest({ operation: 'vehicles', query: { include_inactive: false } }).query,
    { include_inactive: 'false' });
  assert.deepEqual(validateRequest({ operation: 'data', target: vehicle, resource: 'tire-pressure',
    query: { pressure_format: 'psi' } }).query, { pressure_format: 'psi' });
  rejects({ operation: 'vehicles', query: { include_inactive: 'false' } }, 'invalid_query');
  rejects({ operation: 'data', target: vehicle, resource: 'battery', query: { pressure_format: 'psi' } }, 'invalid_query');
  rejects({ operation: 'data', target: vehicle, resource: 'state', query: null }, 'invalid_query');
  rejects({ operation: 'fleet-read', target: vehicle, resource: 'vehicle-data', query: { endpoints: 'location_data' } }, 'invalid_query');
  assert.ok(validateRequest({ operation: 'fleet-read', target: vehicle, resource: 'vehicle-data',
    query: { endpoints: 'charge_state;climate_state' } }));
});

test('time ranges reject reversal, invalid calendars, timezone injection and numeric strings', () => {
  rejects({ operation: 'stats', target: vehicle, query: { from: 20, to: 10 } }, 'invalid_time_range');
  rejects({ operation: 'stats', target: vehicle, query: { from: '20' } }, 'invalid_query');
  rejects({ operation: 'stats', target: vehicle, query: { timezone: 'Not/AZone' } }, 'invalid_query');
  const base = { operation: 'energy-read', target: energy, resource: 'energy-history' };
  rejects({ ...base, query: { start_date: '2026-02-31T00:00:00Z' } }, 'invalid_query');
  rejects({ ...base, query: { start_date: '2026-09-02T00:00:00Z', end_date: '2026-09-01T00:00:00Z' } }, 'invalid_time_range');
  assert.ok(validateRequest({ ...base, query: { start_date: '2024-02-29T00:00:00Z', period: 'day', time_zone: 'UTC' } }));
});

const commandExamples = {
  actuate_trunk: { which_trunk: 'front' },
  add_precondition_schedule: { enabled: true, days_of_week: 'Weekdays', precondition_time: 480, one_time: false },
  adjust_volume: { volume: 4 }, guest_mode: { enable: true },
  parental_controls_enable_setting: { setting: 'SpeedLimit', enable: true },
  parental_controls_set_speed_limit: { limit_mph: 65 },
  remote_auto_seat_climate_request: { auto_seat_position: 1, auto_climate_on: true },
  remote_auto_steering_wheel_heat_climate_request: { on: true },
  remote_seat_cooler_request: { seat_position: 1, seat_cooler_level: 2 },
  remote_seat_heater_request: { seat_position: 0, level: 2 },
  remote_steering_wheel_heat_level_request: { level: 3 },
  remote_steering_wheel_heater_request: { on: true },
  remove_charge_schedule: { id: 123 }, remove_precondition_schedule: { id: 456 },
  schedule_software_update: { offset_sec: 0 },
  set_bioweapon_mode: { on: true, manual_override: false },
  set_cabin_overheat_protection: { on: true, fan_only: false },
  set_charge_limit: { percent: 80 }, set_charging_amps: { charging_amps: 32 },
  set_climate_keeper_mode: { climate_keeper_mode: 2, manual_override: false },
  set_cop_temp: { cop_temp: 1 }, set_preconditioning_max: { on: true },
  set_scheduled_charging: { enable: true, time: 600 }, set_scheduled_departure: { enable: false },
  set_sentry_mode: { on: true }, set_temps: { driver_temp: 20, passenger_temp: 20 },
  set_vehicle_name: { vehicle_name: 'Synthetic Test Car' }, speed_limit_set_limit: { limit_mph: 65 },
  sun_roof_control: { state: 'close' }, window_control: { command: 'vent' },
};

for (const [name, schema] of Object.entries(catalog.fleetCommands)) {
  test(`Fleet command ${name}: exact body, unknown/absent fields rejected`, () => {
    const parameters = commandExamples[name] ?? {};
    const result = validateRequest(command(name, parameters));
    assert.equal(result.write, true);
    assert.equal(result.path, `/api/vehicles/${vehicle}/fleet-commands`);
    assert.deepEqual(result.body, { command: name, parameters, confirm: true, confirmedVehicleId: vehicle });
    rejects(command(name, { ...parameters, arbitrary_payload: {} }), 'invalid_parameters');
    rejects(command(name, null), 'invalid_parameters');
    for (const required of schema.required ?? []) {
      const missing = { ...parameters }; delete missing[required];
      rejects(command(name, missing), 'invalid_parameters');
    }
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'number') {
        for (const invalid of [NaN, Infinity, -Infinity, String(value)]) {
          rejects(command(name, { ...parameters, [key]: invalid }), 'invalid_parameters');
        }
      }
    }
  });
}

test('unsupported commands fail closed, including new commands returned by a remote catalog', () => {
  for (const name of [...catalog.unsupported.commands, 'wake', 'open_tonneau', '__proto__']) {
    rejects(command(name), 'unsupported_command');
  }
});

test('command boundaries are enforced without implicit units or aliases', () => {
  for (const parameters of [{ driver_temp: 90, passenger_temp: 90 },
    { driver_temp: 20 }, { driver_temp: 20, passenger_temp: 20, unit: 'F' }]) rejects(command('set_temps', parameters));
  for (const parameters of [{ percent: 101 }, { percent: 49 }, { percent: 80.5 }]) rejects(command('set_charge_limit', parameters));
  rejects(command('set_charging_amps', { charging_amps: 2147483648 }));
  rejects(command('set_charging_amps', { charging_amps: 81 }));
  assert.ok(validateRequest(command('set_charging_amps', { charging_amps: 80 })));
  for (const limit_mph of [49, 121]) rejects(command('speed_limit_set_limit', { limit_mph }));
  assert.ok(validateRequest(command('speed_limit_set_limit', { limit_mph: 120 })));
  for (const limit_mph of [0, 121]) rejects(command('parental_controls_set_speed_limit', { limit_mph }));
  rejects(command('remove_charge_schedule', { scheduleRef: 'charge_schedule_1' }));
  rejects(command('remote_seat_heater_request', { seat_position: 9, level: 1 }));
  rejects(command('remote_steering_wheel_heat_level_request', { level: 2 }));
  rejects(command('schedule_software_update', { offset_sec: -1 }));
  rejects(command('schedule_software_update', { offset_sec: 604801 }));
});

test('conditional schedule schemas do not accept ambiguous or freeform schedules', () => {
  assert.ok(validateRequest(command('set_scheduled_charging', { enable: false })));
  rejects(command('set_scheduled_charging', { enable: true }));
  rejects(command('set_scheduled_charging', { enable: false, time: 600 }));
  rejects(command('set_scheduled_departure', { enable: true }));
  assert.ok(validateRequest(command('set_scheduled_departure', { enable: true, departure_time: 480,
    off_peak_charging_enabled: true, off_peak_charging_weekdays_only: false,
    preconditioning_enabled: true, preconditioning_weekdays_only: false, end_off_peak_time: 420 })));
  const base = { enabled: true, days_of_week: 'Monday,Friday', one_time: true };
  assert.ok(validateRequest(command('add_precondition_schedule', { ...base, scheduled_at: '2099-01-01T09:00:00.000Z' })));
  rejects(command('add_precondition_schedule', { ...base, scheduled_at: '2099-01-01T09:00:00Z' }));
  rejects(command('add_precondition_schedule', { ...base, scheduled_at: '2099-01-01T09:00:00.000Z', one_time: false }));
  rejects(command('add_precondition_schedule', { ...base, scheduled_at: '2099-01-01T09:00:00.000Z', precondition_time: 480 }));
  rejects(command('add_precondition_schedule', { ...base, precondition_time: 480, lat: 1, lon: 1 }));
});

test('all critical commands expose explicit consequences for transport confirmation', () => {
  for (const name of Object.keys(catalog.commandConsequences)) {
    const result = validateRequest(command(name, commandExamples[name] ?? {}));
    assert.equal(result.risk, 'critical');
    assert.ok(result.consequence.length > 30);
  }
});

test('mutations use actual API parameter names, opaque child IDs, and exact acknowledgment', () => {
  const examples = { 'delete-driver': { driverId: driver }, 'revoke-invitation': { invitationId: invitation },
    'delete-telemetry-config': { acknowledge: 'DISABLE_FLEET_TELEMETRY' } };
  for (const [action, parameters] of Object.entries(examples)) {
    const result = validateRequest({ operation: 'mutation', target: vehicle, action, parameters });
    assert.equal(result.risk, 'critical');
    assert.deepEqual(result.body, { mutation: action, parameters, confirm: true, confirmedVehicleId: vehicle });
    rejects({ operation: 'mutation', target: vehicle, action, parameters: {} });
  }
  rejects({ operation: 'mutation', target: vehicle, action: 'delete-driver', parameters: { driverRef: 'driver_1' } });
  rejects({ operation: 'mutation', target: vehicle, action: 'create-invitation', parameters: {} }, 'unsupported_action');
});

test('every energy action has a complete closed schema and critical consequence', () => {
  const examples = { backup: { backup_reserve_percent: 30 },
    'grid-import-export': { customer_preferred_export_rule: 'pv_only' },
    'off-grid-vehicle-charging-reserve': { off_grid_vehicle_charging_reserve_percent: 20 },
    operation: { default_real_mode: 'self_consumption' }, 'storm-mode': { enabled: true } };
  for (const [action, parameters] of Object.entries(examples)) {
    const request = { operation: 'energy-action', target: energy, action, parameters };
    const result = validateRequest(request);
    assert.equal(result.risk, 'critical');
    assert.deepEqual(result.body, { action, parameters, confirm: true, confirmedEnergyId: energy });
    rejects({ ...request, parameters: { ...parameters, extra: true } });
    rejects({ ...request, parameters: {} });
  }
  rejects({ operation: 'energy-action', target: energy, action: 'backup', parameters: { backup_reserve_percent: 101 } });
  rejects({ operation: 'energy-action', target: energy, action: 'time-of-use-settings', parameters: {} }, 'unsupported_action');
});

test('preferences, wake and disconnect are all classified as writes', () => {
  assert.deepEqual(validateRequest({ operation: 'set-default', target: vehicle }).body, { vehicleId: vehicle });
  const clear = validateRequest({ operation: 'clear-default', target: vehicle });
  assert.equal(clear.method, 'DELETE'); assert.equal(clear.write, true); assert.equal(clear.body, undefined);
  rejects({ operation: 'clear-default' }, 'invalid_target');
  const wake = validateRequest({ operation: 'wake', target: vehicle });
  assert.equal(wake.write, true); assert.deepEqual(wake.body, { command: 'wake', parameters: {} });
  const disconnect = validateRequest({ operation: 'disconnect' });
  assert.equal(disconnect.risk, 'critical');
  assert.deepEqual(disconnect.body, { confirm: true, acknowledge: 'REVOKE_TESLA_CONNECTION' });
});

test('navigation requires a search-returned opaque selection and rejects coordinates or malformed intents', () => {
  const request = { operation: 'route', target: vehicle,
    parameters: { query: 'coffee', selectionId: selection, radiusMeters: 10000 } };
  assert.deepEqual(validateRequest(request).body, { ...request.parameters, confirm: true, confirmedVehicleId: vehicle });
  rejects({ ...request, parameters: { query: 'coffee' } });
  rejects({ ...request, parameters: { ...request.parameters, lat: 1, lon: 2 } });
  rejects({ ...request, parameters: { ...request.parameters, selectionId: 'https://evil.invalid' } });
  rejects({ ...request, parameters: { ...request.parameters, intent: { url: 'https://evil.invalid' } } });
});

test('structured place intents preserve named/category/hybrid meaning through search and routing', () => {
  const base = { mode: 'category', placeTypes: ['restaurant'], name: null, brand: null, locality: null,
    conceptGroups: [['pizza', 'pizzeria']], selectionPolicy: 'nearest' };
  const examples = [base,
    { ...base, mode: 'named', placeTypes: [], name: 'Synthetic Cafe', conceptGroups: [], selectionPolicy: 'unique' },
    { ...base, mode: 'hybrid', brand: 'Synthetic Brand' }];
  for (const intent of examples) {
    const search = validateRequest({ operation: 'places', target: vehicle, query: { query: 'pizza', intent } });
    assert.deepEqual(JSON.parse(search.query.intent), intent);
    const route = validateRequest({ operation: 'route', target: vehicle,
      parameters: { query: 'pizza', selectionId: selection, intent } });
    assert.deepEqual(route.body.intent, intent);
  }
  const invalid = [
    { ...base, mode: 'named' }, { ...base, name: 'Invalid category name' },
    { ...base, mode: 'hybrid', conceptGroups: [] }, { ...base, placeTypes: ['unreviewed'] },
    { ...base, placeTypes: ['restaurant', 'restaurant'] }, { ...base, conceptGroups: [['pizza', ' pizza ']] },
    { ...base, conceptGroups: [[' ']] }, { ...base, selectionPolicy: 'execute-first' },
    { ...base, extra: true }, { ...base, locality: { url: 'https://evil.invalid' } },
  ];
  for (const intent of invalid) {
    rejects({ operation: 'places', target: vehicle, query: { query: 'pizza', intent } }, 'invalid_query');
    rejects({ operation: 'route', target: vehicle, parameters: { query: 'pizza', selectionId: selection, intent } }, 'invalid_parameters');
  }
  const missing = { ...base }; delete missing.brand;
  rejects({ operation: 'places', target: vehicle, query: { query: 'pizza', intent: missing } });
});

test('confirmation and idempotency metadata have the same closed schemas as transport', () => {
  const key = '01234567-89ab-4cde-8f01-23456789abcd';
  const proof = { approved: true, operationHash: 'a'.repeat(64), confirmedAt: '2026-09-07T00:00:00.000Z' };
  assert.ok(validateRequest({ ...command('door_lock'), idempotencyKey: key, confirmation: proof }));
  for (const idempotencyKey of ['ordinary-key', '01234567-89ab-0cde-8f01-23456789abcd', key + '/']) {
    rejects({ ...command('door_lock'), idempotencyKey }, 'invalid_idempotency_key');
  }
  for (const confirmation of [null, {}, { ...proof, unexpected: true }, { ...proof, approved: 'yes' },
    { ...proof, confirmedAt: '2026-02-31T00:00:00.000Z' }, { ...proof, riskAcknowledged: 'yes' }]) {
    rejects({ ...command('door_lock'), confirmation }, 'invalid_confirmation');
  }
});

test('prototype-bearing, accessor, symbol and non-JSON inputs cannot bypass validation', () => {
  rejects(Object.assign(Object.create({ injected: true }), { operation: 'vehicles' }));
  rejects(JSON.parse('{"operation":"vehicles","__proto__":{"query":{"include_inactive":true}}}'));
  rejects({ operation: 'vehicles', [Symbol('extra')]: 1 });
  let getterCalled = false;
  const request = { get operation() { getterCalled = true; return 'vehicles'; } };
  rejects(request); assert.equal(getterCalled, false);
  for (const value of [null, [], 'vehicles', 1]) rejects(value);
});

test('validated output is detached from mutable input; errors do not echo untrusted data', () => {
  const request = command('set_temps', { driver_temp: 20, passenger_temp: 20 });
  const result = validateRequest(request);
  request.parameters.driver_temp = 99;
  assert.equal(result.body.parameters.driver_temp, 20);
  try { validateRequest({ operation: 'synthetic-secret-do-not-echo' }); assert.fail(); }
  catch (error) { assert.ok(!error.message.includes('synthetic-secret')); }
});
