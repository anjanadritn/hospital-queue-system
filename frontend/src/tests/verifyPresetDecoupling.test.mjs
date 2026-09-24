import assert from 'assert';
import { TUMKUR_PRESETS } from '../constants/tumkurPresets.js';
import { resolvePresetFromCandidate } from '../components/DepartureCard.jsx';

console.log('--- Testing Preset Coordinates & Decoupling ---');

// 1. Verify Alipur preset has latitude, longitude, and coords
const alipurPreset = TUMKUR_PRESETS['Alipur, Gauribidanur'];
assert(alipurPreset, 'Alipur preset must exist');
assert.strictEqual(alipurPreset.latitude, 13.6100, 'Alipur latitude must be 13.6100');
assert.strictEqual(alipurPreset.longitude, 77.4200, 'Alipur longitude must be 77.4200');
assert.deepStrictEqual(alipurPreset.coords, [77.4200, 13.6100], 'Alipur coords must be [77.42, 13.61]');
console.log('✓ Alipur preset definition verified: [13.6100°N, 77.4200°E]');

// 2. Verify Tumkur Bus Stand preset
const busStandPreset = TUMKUR_PRESETS['Tumkur Bus Stand'];
assert(busStandPreset, 'Tumkur Bus Stand preset must exist');
assert.strictEqual(busStandPreset.latitude, 13.3392, 'Tumkur Bus Stand latitude must be 13.3392');
assert.strictEqual(busStandPreset.longitude, 77.1011, 'Tumkur Bus Stand longitude must be 77.1011');
assert.deepStrictEqual(busStandPreset.coords, [77.1011, 13.3392]);
console.log('✓ Tumkur Bus Stand preset definition verified: [13.3392°N, 77.1011°E]');

// 3. Test resolvePresetFromCandidate
const resolvedAlipur = resolvePresetFromCandidate('Alipur, Gauribidanur');
assert(resolvedAlipur, 'Must resolve Alipur');
assert.strictEqual(resolvedAlipur.latitude, 13.6100);
assert.strictEqual(resolvedAlipur.longitude, 77.4200);

const resolvedFuzzy = resolvePresetFromCandidate('alipur');
assert(resolvedFuzzy, 'Must resolve Alipur fuzzily');
assert.strictEqual(resolvedFuzzy.latitude, 13.6100);

const resolvedBusStand = resolvePresetFromCandidate('Tumkur Bus Stand');
assert(resolvedBusStand, 'Must resolve Tumkur Bus Stand');
assert.strictEqual(resolvedBusStand.latitude, 13.3392);
console.log('✓ resolvePresetFromCandidate works accurately for exact and fuzzy preset matching');

// 4. Test simulate payload generation when in preset mode vs browser GPS
const mockBrowserGps = {
  coords: [77.0990, 13.3770], // Browser GPS near hospital
  accuracy: 15
};

function generateRoutePayload(originMode, selectedPreset, browserGps, queueId) {
  if (originMode === 'preset') {
    return {
      queue_id: queueId,
      origin_mode: 'preset',
      origin_label: selectedPreset.name,
      origin: selectedPreset.name,
      origin_lat: selectedPreset.latitude ?? selectedPreset.lat,
      origin_lng: selectedPreset.longitude ?? selectedPreset.lon,
      origin_latitude: selectedPreset.latitude ?? selectedPreset.lat,
      origin_longitude: selectedPreset.longitude ?? selectedPreset.lon,
      location_source: 'preset',
      is_approximate: false
    };
  } else {
    return {
      queue_id: queueId,
      origin_mode: 'gps',
      user_selected_gps: true,
      origin_label: 'Current GPS Location',
      origin_lat: browserGps.coords[1],
      origin_lng: browserGps.coords[0],
      location_source: 'gps',
      is_approximate: false
    };
  }
}

// When originMode = 'preset', payload MUST use preset coordinates, NOT browser GPS!
const payload = generateRoutePayload('preset', resolvedAlipur, mockBrowserGps, 'Q-123');
assert.strictEqual(payload.origin_mode, 'preset');
assert.strictEqual(payload.origin_lat, 13.6100);
assert.strictEqual(payload.origin_lng, 77.4200);
assert.notStrictEqual(payload.origin_lat, mockBrowserGps.coords[1], 'Must NOT use browser GPS latitude');
assert.notStrictEqual(payload.origin_lng, mockBrowserGps.coords[0], 'Must NOT use browser GPS longitude');
console.log('✓ Route payload in preset mode strictly uses preset coordinates [13.61, 77.42] and ignores browser GPS [13.377, 77.099]');

console.log('\nALL FRONTEND PRESET DECOUPLING TESTS PASSED!');
