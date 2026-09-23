// Local, reviewed capabilities. Remote catalogs and response text are data only.
// Routes/bodies verified against Teslr production 12367cd (2026-09-07),
// lib/{fleet-api,data-resources,mutations}.ts and the installed Tesla signer
// github.com/teslamotors/vehicle-command@724d8c85e3c5/pkg/proxy/command.go.
// No network, environment access, dynamic code, or runtime schema extensions.

const object = (properties = {}, required = Object.keys(properties)) => ({
  type: 'object', properties, required, additionalProperties: false,
});
const bool = { type: 'boolean' };
const integer = (minimum, maximum = Number.MAX_SAFE_INTEGER) => ({ type: 'integer', minimum, maximum });
const number = (minimum, maximum) => ({ type: 'number', minimum, maximum });
const enumeration = (...values) => ({ type: typeof values[0] === 'number' ? 'integer' : 'string', enum: values });
const text = (minLength = 1, maxLength = 256, pattern = '^[^\\u0000-\\u001f\\u007f]+$') => ({
  type: 'string', minLength, maxLength, pattern,
});
const opaque = (kind) => text(1, 80, `^${kind}-[a-f0-9]{20}$`);
const empty = object();
const minute = integer(0, 1439);
const utcInstant = { ...text(24, 24, '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$'), format: 'canonical-utc' };
const dateTime = { ...text(20, 35, '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$'), format: 'date-time' };
const timezone = { ...text(1, 64, '^[A-Za-z0-9_+\\-/]+$'), format: 'time-zone' };
const dayNames = text(3, 160, '^(?:All|Weekdays|Weekends|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))*$');
const uuid = text(36, 36, '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$');
const confirmationSchema = object({ approved: bool, operationHash: text(64, 64, '^[a-f0-9]{64}$'),
  confirmedAt: utcInstant, riskAcknowledged: bool }, ['approved', 'operationHash', 'confirmedAt']);

const emptyCommandNames = [
  'auto_conditioning_start', 'auto_conditioning_stop', 'cancel_software_update',
  'charge_max_range', 'charge_port_door_close', 'charge_port_door_open',
  'charge_standard', 'charge_start', 'charge_stop', 'clear_pin_to_drive_admin',
  'door_lock', 'door_unlock', 'erase_user_data', 'flash_lights', 'honk_horn',
  'media_next_fav', 'media_next_track', 'media_prev_fav', 'media_prev_track',
  'media_toggle_playback', 'media_volume_down', 'media_volume_up',
  'parental_controls_clear_pin_admin', 'remote_start_drive',
  'reset_pin_to_drive_pin', 'reset_valet_pin', 'speed_limit_clear_pin_admin',
];

const fleetCommands = {
  ...Object.fromEntries(emptyCommandNames.map((name) => [name, empty])),
  actuate_trunk: object({ which_trunk: enumeration('front', 'rear') }),
  add_precondition_schedule: {
    ...object({ enabled: bool, days_of_week: dayNames, precondition_time: minute,
      scheduled_at: utcInstant, one_time: bool }, ['enabled', 'days_of_week', 'one_time']),
    oneOf: [{ required: ['precondition_time'], forbidden: ['scheduled_at'] },
      { required: ['scheduled_at'], forbidden: ['precondition_time'], properties: { one_time: { const: true } } }],
  },
  adjust_volume: object({ volume: number(0, 11) }),
  guest_mode: object({ enable: bool }),
  parental_controls_enable_setting: object({
    setting: enumeration('SpeedLimit', 'Acceleration', 'SafetyFeatures', 'Curfew',
      'BrowserBlocked', 'TheaterBlocked', 'ArcadeBlocked'), enable: bool,
  }),
  // Local reviewed range, not a claim that each model supports every value.
  // Tesla validates the model-specific parental-control minimum.
  parental_controls_set_speed_limit: object({ limit_mph: number(1, 120) }),
  remote_auto_seat_climate_request: object({ auto_seat_position: integer(1, 2), auto_climate_on: bool }),
  remote_auto_steering_wheel_heat_climate_request: object({ on: bool }),
  remote_seat_cooler_request: object({ seat_position: integer(1, 2), seat_cooler_level: integer(0, 3) }),
  remote_seat_heater_request: object({ seat_position: integer(0, 8), level: integer(0, 3) }),
  remote_steering_wheel_heat_level_request: object({ level: enumeration(0, 1, 3) }),
  remote_steering_wheel_heater_request: object({ on: bool }),
  // These are numeric schedule IDs from the API, not X-agent-only scheduleRef aliases.
  remove_charge_schedule: object({ id: integer(1) }),
  remove_precondition_schedule: object({ id: integer(1) }),
  schedule_software_update: object({ offset_sec: integer(0, 604800) }),
  set_bioweapon_mode: object({ on: bool, manual_override: bool }),
  set_cabin_overheat_protection: object({ on: bool, fan_only: bool }, ['on']),
  set_charge_limit: object({ percent: integer(50, 100) }),
  // Includes legacy 80A AC hardware; the car/EVSE still enforces its lower limit.
  // Source: Tesla 80A Wall Connector manual, linked in catalog.boundsSources.
  set_charging_amps: object({ charging_amps: integer(1, 80) }),
  set_climate_keeper_mode: object({ climate_keeper_mode: enumeration(0, 1, 2, 3), manual_override: bool }, ['climate_keeper_mode']),
  set_cop_temp: object({ cop_temp: enumeration(0, 1, 2) }),
  set_preconditioning_max: object({ on: bool, manual_override: bool }, ['on']),
  set_scheduled_charging: {
    ...object({ enable: bool, time: minute }, ['enable']),
    oneOf: [{ properties: { enable: { const: false } }, forbidden: ['time'] },
      { properties: { enable: { const: true } }, required: ['time'] }],
  },
  set_scheduled_departure: {
    ...object({ enable: bool, departure_time: minute, off_peak_charging_enabled: bool,
      off_peak_charging_weekdays_only: bool, preconditioning_enabled: bool,
      preconditioning_weekdays_only: bool, end_off_peak_time: minute }, ['enable']),
    oneOf: [{ properties: { enable: { const: false } },
      forbidden: ['departure_time', 'off_peak_charging_enabled', 'off_peak_charging_weekdays_only',
        'preconditioning_enabled', 'preconditioning_weekdays_only', 'end_off_peak_time'] },
    { properties: { enable: { const: true } },
      required: ['departure_time', 'off_peak_charging_enabled', 'off_peak_charging_weekdays_only',
        'preconditioning_enabled', 'preconditioning_weekdays_only', 'end_off_peak_time'] }],
  },
  set_sentry_mode: object({ on: bool }),
  set_temps: object({ driver_temp: number(15, 28), passenger_temp: number(15, 28) }),
  set_vehicle_name: object({ vehicle_name: text(1, 256) }),
  speed_limit_set_limit: object({ limit_mph: number(50, 120) }),
  sun_roof_control: object({ state: enumeration('stop', 'close', 'vent') }),
  window_control: object({ command: enumeration('vent', 'close') }),
};

const commandConsequences = {
  actuate_trunk: 'Opens or actuates the selected trunk/frunk. Check clearance and that no person or object is in its path.',
  door_unlock: 'Unlocks the vehicle, allowing physical access. Verify the vehicle is in a safe place.',
  window_control: 'Moves the windows; venting exposes the interior and closing can affect nearby people or objects.',
  sun_roof_control: 'Moves or stops the sunroof; check clearance and people before operating it.',
  clear_pin_to_drive_admin: 'Clears the PIN-to-Drive protection; access or driving security can be reduced.',
  erase_user_data: 'Erases guest user data from the vehicle. This deletion may not be recoverable.',
  guest_mode: 'Changes guest mode and may change which vehicle data and settings are retained or accessible.',
  parental_controls_clear_pin_admin: 'Clears the parental-control PIN and changes protection of driving restrictions.',
  parental_controls_enable_setting: 'Changes the selected parental restriction, including driving or safety-related settings.',
  parental_controls_set_speed_limit: 'Changes the parental-control maximum driving speed.',
  remote_start_drive: 'Temporarily authorizes keyless driving. Only proceed when the intended driver is present and authorized.',
  reset_pin_to_drive_pin: 'Resets the PIN-to-Drive PIN; this changes protection against unauthorized driving.',
  reset_valet_pin: 'Removes the valet PIN; Tesla requires valet mode to be disabled first.',
  speed_limit_clear_pin_admin: 'Clears the speed-limit PIN, changing protection of the vehicle speed restriction.',
  speed_limit_set_limit: 'Changes the maximum speed configured for speed-limit mode.',
  schedule_software_update: 'Schedules software installation; the vehicle may be unavailable to drive while it installs.',
  set_sentry_mode: 'Changes parked security recording; disabling Sentry Mode reduces vehicle monitoring.',
};

const mutations = {
  'delete-driver': object({ driverId: opaque('driver') }),
  'revoke-invitation': object({ invitationId: opaque('invitation') }),
  'delete-telemetry-config': object({ acknowledge: { const: 'DISABLE_FLEET_TELEMETRY' } }),
};
const mutationConsequences = {
  'delete-driver': 'Removes the selected additional driver’s access to this vehicle.',
  'revoke-invitation': 'Invalidates the selected pending driver invitation.',
  'delete-telemetry-config': 'Deletes this application’s Fleet Telemetry configuration and stops its telemetry stream.',
};
const energyActions = {
  backup: object({ backup_reserve_percent: number(0, 100) }),
  'grid-import-export': {
    ...object({ customer_preferred_export_rule: enumeration('battery_ok', 'pv_only', 'never'),
      disallow_charge_from_grid_with_solar_installed: bool }, []),
    anyOf: [{ required: ['customer_preferred_export_rule'] },
      { required: ['disallow_charge_from_grid_with_solar_installed'] }],
  },
  'off-grid-vehicle-charging-reserve': object({ off_grid_vehicle_charging_reserve_percent: number(0, 100) }),
  operation: object({ default_real_mode: enumeration('autonomous', 'self_consumption') }),
  'storm-mode': object({ enabled: bool }),
};
const energyConsequences = {
  backup: 'Changes energy reserved for outages, affecting how much backup power remains available.',
  'grid-import-export': 'Changes grid charging/export behavior, which may affect electricity costs and export permissions.',
  'off-grid-vehicle-charging-reserve': 'Changes how much site battery energy is reserved while charging a vehicle off-grid.',
  operation: 'Switches Powerwall operating mode and may change battery use, grid imports, exports, and costs.',
  'storm-mode': 'Changes Storm Watch participation and preparedness charging behavior.',
};

const dataReads = {
  state: object({ use_cache: bool }, []), battery: empty, status: empty,
  'tire-pressure': object({ pressure_format: enumeration('bar', 'kpa', 'psi') }, []),
  'telemetry-config': empty, drivers: empty, invitations: empty, 'firmware-alerts': empty,
};
const vehicleDataEndpoints = ['charge_state', 'climate_state', 'closures_state', 'drive_state',
  'gui_settings', 'vehicle_config', 'vehicle_state'];
const fleetReads = {
  drivers: empty, invitations: empty, 'fleet-status': empty, 'fleet-telemetry-config': empty,
  'fleet-telemetry-errors': empty, 'mobile-enabled': empty, 'nearby-charging-sites': empty,
  'recent-alerts': empty, 'release-notes': empty, 'service-data': empty, vehicle: empty,
  'vehicle-data': object({ endpoints: text(1, 256,
    `^(?:${vehicleDataEndpoints.join('|')})(?:;(?:${vehicleDataEndpoints.join('|')}))*$`) }, []),
  'eligible-subscriptions': empty, 'eligible-upgrades': empty, 'enterprise-roles': empty,
  options: empty, 'warranty-details': empty,
};
const accountReads = {
  products: empty, 'user-feature-config': empty, 'user-orders': empty,
  'business-charging-history': empty, 'charging-sessions': empty,
};
const energyHistoryQuery = object({ start_date: dateTime, end_date: dateTime,
  period: enumeration('day', 'week', 'month', 'year', 'lifetime'), time_zone: timezone }, []);
const energyReads = {
  'backup-history': energyHistoryQuery, 'energy-history': energyHistoryQuery,
  'charge-history': object({ start_date: dateTime, end_date: dateTime, time_zone: timezone }, []),
  'live-status': empty, 'site-info': empty,
};
const statsQuery = object({ from: integer(0, 4102444800), to: integer(0, 4102444800),
  timezone, distance_format: enumeration('mi', 'km'), limit: integer(1, 5000) }, []);
const semanticText = (maximum) => ({ ...text(1, maximum), format: 'semantic-text' });
const nullableSemanticText = (maximum) => ({ ...semanticText(maximum), type: ['string', 'null'] });
const array = (items, minItems, maxItems, uniqueItems = false) => ({ type: 'array', items, minItems, maxItems, uniqueItems });
const placeIntent = {
  ...object({
    mode: enumeration('named', 'category', 'hybrid'),
    placeTypes: array(enumeration('restaurant', 'cafe', 'bar', 'pub', 'bakery', 'ice_cream',
      'grocery', 'convenience', 'pharmacy', 'hospital', 'clinic', 'fuel', 'charging_station',
      'bank', 'atm', 'library', 'hotel', 'park', 'parking', 'airport', 'cinema', 'theatre',
      'museum', 'attraction', 'shopping_mall', 'retail', 'hardware', 'clothing', 'electronics',
      'car_wash', 'auto_repair', 'post_office', 'school', 'university', 'police', 'fire_station'), 0, 3, true),
    name: nullableSemanticText(160), brand: nullableSemanticText(120), locality: nullableSemanticText(120),
    conceptGroups: array(array(semanticText(48), 1, 8, true), 0, 4),
    selectionPolicy: enumeration('nearest', 'unique'),
  }),
  format: 'place-intent',
};
const placesQuery = object({ query: text(2, 80), radius_meters: integer(1000, 100000),
  limit: integer(1, 10), intent: placeIntent }, ['query']);
const routeParameters = object({ query: text(2, 80), radiusMeters: integer(1000, 100000),
  selectionId: text(49, 49, '^place-[A-Za-z0-9_-]{43}$'), intent: placeIntent }, ['query', 'selectionId']);

const operations = {
  vehicles: { method: 'GET', path: '/api/vehicles', query: object({ include_inactive: bool }, []) },
  'default-vehicle': { method: 'GET', path: '/api/preferences/default-vehicle' },
  'set-default': { method: 'POST', path: '/api/preferences/default-vehicle', target: 'vehicle', write: true },
  'clear-default': { method: 'DELETE', path: '/api/preferences/default-vehicle', target: 'vehicle', write: true },
  connection: { method: 'GET', path: '/api/tesla/connection' },
  disconnect: { method: 'DELETE', path: '/api/tesla/connection', write: true },
  status: { method: 'GET', path: '/api/vehicles/{target}', target: 'vehicle' },
  stats: { method: 'GET', path: '/api/vehicles/{target}/stats', target: 'vehicle', query: statsQuery },
  catalog: { method: 'GET', path: '/api/data' },
  'command-catalog': { method: 'GET', path: '/api/commands' },
  'fleet-catalog': { method: 'GET', path: '/api/fleet' },
  'mutation-catalog': { method: 'GET', path: '/api/mutations' },
  data: { method: 'GET', path: '/api/vehicles/{target}/data/{resource}', target: 'vehicle', resources: dataReads },
  'fleet-read': { method: 'GET', path: '/api/vehicles/{target}/fleet/{resource}', target: 'vehicle', resources: fleetReads },
  'fleet-account': { method: 'GET', path: '/api/fleet/{resource}', resources: accountReads },
  'energy-sites': { method: 'GET', path: '/api/energy' },
  'energy-read': { method: 'GET', path: '/api/energy/{target}/{resource}', target: 'energy', resources: energyReads },
  wake: { method: 'POST', path: '/api/vehicles/{target}/commands', target: 'vehicle', write: true },
  'fleet-command': { method: 'POST', path: '/api/vehicles/{target}/fleet-commands', target: 'vehicle', write: true, commands: fleetCommands },
  mutation: { method: 'POST', path: '/api/vehicles/{target}/mutations', target: 'vehicle', write: true, actions: mutations },
  'energy-action': { method: 'POST', path: '/api/energy/{target}/actions', target: 'energy', write: true, actions: energyActions },
  places: { method: 'GET', path: '/api/vehicles/{target}/places', target: 'vehicle', query: placesQuery },
  route: { method: 'POST', path: '/api/vehicles/{target}/navigation', target: 'vehicle', write: true, parameters: routeParameters },
};

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const catalog = freeze({
  version: 1,
  operations,
  fleetCommands,
  mutations,
  energyActions,
  commandConsequences,
  mutationConsequences,
  energyConsequences,
  envelopeMetadata: { idempotencyKey: uuid, confirmation: confirmationSchema },
  boundsSources: {
    speedLimit: 'https://www.tesla.com/ownersmanual/modely/en_us/GUID-94B0E05E-F642-4C8E-8FED-E5EB45FA27DA.html',
    acCharging: 'https://www.tesla.com/sites/default/files/downloads/80a-single-phase-wall-connector-installation-manual-c-d.pdf',
    note: 'Reviewed portable-client ranges; vehicle, firmware and equipment may impose narrower limits. Parental speed uses a local 1–120 mph envelope, not a claimed Tesla minimum.',
  },
  confirmation: 'Every write requires fresh exact-request user confirmation; critical actions also require riskAcknowledged.',
  queryTypes: 'JSON query values use their declared types; the helper encodes them as URL query strings.',
  unsupported: {
    commands: ['add_charge_schedule', 'navigation_gps_request', 'navigation_request',
      'navigation_sc_request', 'navigation_waypoints_request', 'parental_controls_activate',
      'parental_controls_deactivate', 'remote_boombox', 'set_pin_to_drive', 'set_valet_mode',
      'speed_limit_activate', 'speed_limit_clear_pin', 'speed_limit_deactivate',
      'trigger_homelink', 'upcoming_calendar_entries'],
    accountReads: ['user-me', 'user-region', 'charging-invoice', 'vehicle-pricing'],
    vehicleReads: ['specs', 'location', 'map', 'plate'],
    mutations: ['create-invitation'],
    energyActions: ['time-of-use-settings'],
    reason: 'PIN/secret-bearing, raw-location/freeform payloads, invitation delivery, disabled partner scopes, or incomplete reviewed schemas. Use Tesla’s app for these. Navigation uses the separate route operation.',
  },
});

function failure(code = 'invalid_request') {
  const error = new Error('Request is outside the installed local Teslr policy. Use the local capabilities catalog and exact parameter types.');
  error.code = code;
  return error;
}

function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) &&
    Reflect.ownKeys(value).every((key) => typeof key === 'string' &&
      Object.getOwnPropertyDescriptor(value, key)?.get === undefined &&
      Object.getOwnPropertyDescriptor(value, key)?.set === undefined);
}

function matches(value, schema) {
  if (Object.hasOwn(schema, 'const') && value !== schema.const) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (Array.isArray(schema.type)) return schema.type.some((type) => matches(value, { ...schema, type }));
  if (schema.type === 'object' || schema.properties || schema.required || schema.forbidden) {
    if (!plain(value)) return false;
    const properties = schema.properties ?? {};
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(properties, key))) return false;
    if (schema.required?.some((key) => !Object.hasOwn(value, key))) return false;
    if (schema.forbidden?.some((key) => Object.hasOwn(value, key))) return false;
    if (Object.entries(properties).some(([key, property]) => Object.hasOwn(value, key) && !matches(value[key], property))) return false;
    if (schema.format === 'place-intent') {
      if (value.mode === 'named' && (!value.name || value.placeTypes.length || value.conceptGroups.length)) return false;
      if (value.mode === 'category' && (!value.placeTypes.length || value.name || value.brand)) return false;
      if (value.mode === 'hybrid' && (!value.placeTypes.length || (!value.name && !value.brand && !value.conceptGroups.length))) return false;
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < schema.minItems || value.length > schema.maxItems ||
      value.some((item) => !matches(item, schema.items))) return false;
    if (schema.uniqueItems && new Set(value.map((item) => typeof item === 'string'
      ? item.trim().replace(/\s+/g, ' ') : JSON.stringify(item))).size !== value.length) return false;
  } else if (schema.type === 'null') {
    if (value !== null) return false;
  } else if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') return false;
  } else if (schema.type === 'integer' || schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) ||
      (schema.type === 'integer' && !Number.isSafeInteger(value)) ||
      (schema.minimum !== undefined && value < schema.minimum) ||
      (schema.maximum !== undefined && value > schema.maximum)) return false;
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < (schema.minLength ?? 0) ||
      value.length > (schema.maxLength ?? 4096) ||
      (schema.pattern && !new RegExp(schema.pattern, 'u').test(value))) return false;
    if (schema.format === 'canonical-utc' && (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value)) return false;
    if (schema.format === 'semantic-text' && !value.trim()) return false;
    if (schema.format === 'date-time') {
      const [year, month, day] = value.slice(0, 10).split('-').map(Number);
      const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (!Number.isFinite(Date.parse(value)) || day < 1 || day > (monthDays[month - 1] ?? 0)) return false;
    }
    if (schema.format === 'time-zone') {
      try { new Intl.DateTimeFormat('en-US', { timeZone: value }); } catch { return false; }
    }
  }
  if (schema.oneOf && schema.oneOf.filter((candidate) => matches(value, candidate)).length !== 1) return false;
  if (schema.anyOf && !schema.anyOf.some((candidate) => matches(value, candidate))) return false;
  return true;
}

function validate(value, schema, code = 'invalid_parameters') {
  if (!matches(value, schema)) throw failure(code);
  return value;
}

function select(map, name, code) {
  if (typeof name !== 'string' || !Object.hasOwn(map, name)) throw failure(code);
  return map[name];
}

/** Validate a typed envelope and construct only locally fixed routes and bodies.
 * Authorization/confirmation proofs are checked by request.mjs, not by this
 * pure preview function. A returned write is NOT permission to send it.
 */
export function validateRequest(envelope) {
  if (!plain(envelope)) throw failure();
  const op = select(operations, envelope.operation, 'unsupported_operation');
  const allowed = new Set(['operation', 'idempotencyKey', 'confirmation']);
  if (op.target) allowed.add('target');
  if (op.resources) allowed.add('resource');
  if (op.commands) allowed.add('command');
  if (op.actions) allowed.add('action');
  if (op.write) allowed.add('parameters');
  if (op.query || op.resources) allowed.add('query');
  if (Object.keys(envelope).some((key) => !allowed.has(key))) throw failure('unknown_field');
  if (Object.hasOwn(envelope, 'idempotencyKey')) validate(envelope.idempotencyKey, uuid, 'invalid_idempotency_key');
  if (Object.hasOwn(envelope, 'confirmation')) validate(envelope.confirmation, confirmationSchema, 'invalid_confirmation');
  if (op.target) validate(envelope.target, opaque(op.target), 'invalid_target');
  let path = op.path.replace('{target}', envelope.target ?? '');
  let querySchema = op.query ?? empty;
  if (op.resources) {
    querySchema = select(op.resources, envelope.resource, 'unsupported_resource');
    path = path.replace('{resource}', envelope.resource);
  }
  const query = validate(Object.hasOwn(envelope, 'query') ? envelope.query : {}, querySchema, 'invalid_query');
  if (query.from !== undefined && query.to !== undefined && query.from > query.to) throw failure('invalid_time_range');
  if (query.start_date && query.end_date && Date.parse(query.start_date) > Date.parse(query.end_date)) throw failure('invalid_time_range');
  let parameterSchema = op.parameters ?? empty;
  if (op.commands) parameterSchema = select(op.commands, envelope.command, 'unsupported_command');
  if (op.actions) parameterSchema = select(op.actions, envelope.action, 'unsupported_action');
  const parameters = validate(Object.hasOwn(envelope, 'parameters') ? envelope.parameters : {}, parameterSchema);
  const result = { method: op.method, path, write: op.write === true };
  if (Object.keys(query).length) result.query = Object.fromEntries(Object.entries(query).map(([key, value]) =>
    [key, typeof value === 'object' ? JSON.stringify(value) : String(value)]));
  if (op.write) {
    result.risk = 'sensitive';
    result.consequence = 'Changes the selected vehicle or account setting. Confirm this exact request before sending.';
    if (envelope.operation === 'set-default') result.body = { vehicleId: envelope.target };
    if (envelope.operation === 'clear-default') result.consequence = 'Clears the saved default vehicle preference. The helper must verify this is still the current default.';
    if (envelope.operation === 'disconnect') {
      result.body = { confirm: true, acknowledge: 'REVOKE_TESLA_CONNECTION' };
      result.risk = 'critical';
      result.consequence = 'Revokes the Tesla connection associated with the configured token, stopping its vehicle and energy access. Reconnection is required to restore access.';
    }
    if (envelope.operation === 'wake') {
      result.body = { command: 'wake', parameters: {} };
      result.consequence = 'Wakes this vehicle and may consume battery energy.';
    }
    if (envelope.operation === 'fleet-command') {
      result.body = { command: envelope.command, parameters,
        confirm: true, confirmedVehicleId: envelope.target };
      if (commandConsequences[envelope.command]) {
        result.risk = 'critical'; result.consequence = commandConsequences[envelope.command];
      }
    }
    if (envelope.operation === 'mutation') {
      result.body = { mutation: envelope.action, parameters,
        confirm: true, confirmedVehicleId: envelope.target };
      result.risk = 'critical'; result.consequence = mutationConsequences[envelope.action];
    }
    if (envelope.operation === 'energy-action') {
      result.body = { action: envelope.action, parameters,
        confirm: true, confirmedEnergyId: envelope.target };
      result.risk = 'critical'; result.consequence = energyConsequences[envelope.action];
    }
    if (envelope.operation === 'route') {
      result.body = { ...parameters, confirm: true, confirmedVehicleId: envelope.target };
      result.risk = 'critical';
      result.consequence = 'Sends the selected destination to this vehicle’s navigation. This does not drive the vehicle. The server privately uses its current location.';
    }
  }
  // Do not retain mutable references into caller input across preview/approval.
  return JSON.parse(JSON.stringify(result));
}
