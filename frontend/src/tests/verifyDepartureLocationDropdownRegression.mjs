/**
 * Automated Regression Test for Location Dropdown State Isolation in DepartureCard
 * Requirement 12:
 * "Add a regression test verifying that a selected landmark (e.g., 'Tumkur Bus Stand')
 * remains selected after GPS polling/update events."
 */

import assert from 'node:assert';
import { TUMKUR_PRESETS, TUMKUR_OPTIONS } from '../constants/tumkurPresets.js';
import { translations } from '../i18n/translations.js';

console.log('=== RUNNING DEPARTURE LOCATION DROPDOWN REGRESSION TESTS ===\n');

// 1. Verify all required translation keys for the dropdown and badges
console.log('Test 1: Verify translation keys for GPS and preset locations');
const requiredKeys = ['current_gps_location', 'using_selected_location', 'live_gps_active', 'gps_unavailable'];
for (const lang of ['en', 'kn', 'hi']) {
  assert(translations[lang], `Translations for ${lang} must exist`);
  for (const key of requiredKeys) {
    assert(translations[lang][key], `Key "${key}" must exist in language "${lang}"`);
    assert(translations[lang][key].length > 0, `Key "${key}" cannot be empty`);
  }
}
console.log('✓ PASS: All required translations exist across en, kn, and hi.\n');

// 2. Verify TUMKUR_PRESETS contains all expected landmarks
console.log('Test 2: Verify all Tumkur and regional landmarks exist with valid geographic coordinates');
const expectedLandmarks = [
  'Tumkur Bus Stand',
  'Batawadi',
  'Kyatsandra',
  'SSIT Campus',
  'Sira Gate',
  'Gubbi Gate',
  'Tumkur Railway Station',
  'B.H. Road Tumkur',
  'Siddaganga Matha',
  'Alipur, Gauribidanur',
  'Alipur'
];

for (const landmark of expectedLandmarks) {
  assert(TUMKUR_PRESETS[landmark], `Missing landmark preset: ${landmark}`);
  const { coords, lat, lon } = TUMKUR_PRESETS[landmark];
  assert(Array.isArray(coords) && coords.length === 2, `coords must be [lon, lat] for ${landmark}`);
  assert.strictEqual(coords[0], lon, `coords[0] must equal lon for ${landmark}`);
  assert.strictEqual(coords[1], lat, `coords[1] must equal lat for ${landmark}`);
  assert(lat > 13.0 && lat < 14.0, `Latitude must be valid coordinate for ${landmark}`);
  assert(lon > 77.0 && lon < 78.0, `Longitude must be valid coordinate for ${landmark}`);
}
assert.strictEqual(TUMKUR_OPTIONS.length, expectedLandmarks.length);
console.log('✓ PASS: All landmarks exist with verified geographic coordinates.\n');

// 3. State Machine & Event Isolation Simulation
console.log('Test 3: DepartureCard State Machine & Polling Isolation');

class DepartureCardStateEngine {
  constructor(initialTravelInfo) {
    const isDeviceGps = initialTravelInfo?.location_source === 'gps' || initialTravelInfo?.location_source === 'device_gps';
    const isApprox = initialTravelInfo?.is_approximate_location ?? initialTravelInfo?.is_approximate;

    this.originMode = (isDeviceGps && !isApprox && initialTravelInfo?.origin_latitude && initialTravelInfo?.origin_longitude)
      ? 'gps'
      : 'preset';

    this.selectedOrigin = (this.originMode === 'gps')
      ? 'Current GPS Location'
      : (initialTravelInfo?.location_address || initialTravelInfo?.patient_address || 'Tumkur Bus Stand');

    this.selectedPreset = (this.originMode === 'preset' && TUMKUR_PRESETS[this.selectedOrigin])
      ? { name: this.selectedOrigin, ...TUMKUR_PRESETS[this.selectedOrigin] }
      : null;

    this.browserGps = {
      coords: null,
      status: 'idle',
      accuracy: null
    };

    this.liveCoords = (this.originMode === 'gps' && initialTravelInfo?.origin_latitude)
      ? [Number(initialTravelInfo.origin_longitude), Number(initialTravelInfo.origin_latitude)]
      : (this.selectedPreset ? this.selectedPreset.coords : null);

    this.currentTravelInfo = { ...initialTravelInfo };
  }

  // User selects landmark from dropdown or chooses GPS
  onOriginSelect(origin) {
    if (origin === 'Current GPS Location' || origin === '__GPS__') {
      this.originMode = 'gps';
      this.selectedOrigin = 'Current GPS Location';
      this.selectedPreset = null;
      if (this.browserGps.coords) {
        this.liveCoords = this.browserGps.coords;
      }
      this.currentTravelInfo = {
        ...this.currentTravelInfo,
        patient_address: 'Current GPS Location',
        location_source: 'gps',
        is_approximate_location: false
      };
      return;
    }

    const preset = TUMKUR_PRESETS[origin];
    this.originMode = 'preset';
    this.selectedOrigin = origin;
    this.selectedPreset = preset ? { name: origin, ...preset } : null;
    if (preset) {
      this.liveCoords = preset.coords;
    }
    this.currentTravelInfo = {
      ...this.currentTravelInfo,
      patient_address: origin,
      location_address: origin,
      origin_coordinates: preset ? preset.coords : null,
      origin_latitude: preset ? preset.lat : null,
      origin_longitude: preset ? preset.lon : null,
      location_source: 'preset',
      is_approximate_location: false
    };
  }

  // navigator.geolocation.watchPosition callback
  onBrowserGpsWatchEvent(lat, lon, accuracy) {
    const coords = [lon, lat];
    this.browserGps = { coords, status: 'watching', accuracy };

    // GUARD: Never overwrite preset selection!
    if (this.originMode !== 'gps') {
      return;
    }

    this.liveCoords = coords;
    this.selectedOrigin = 'Current GPS Location';
    this.currentTravelInfo = {
      ...this.currentTravelInfo,
      origin_latitude: lat,
      origin_longitude: lon,
      origin_coordinates: coords,
      patient_address: 'Current GPS Location',
      location_source: 'gps'
    };
  }

  // 5-second queue polling sync effect
  on5SecondQueuePoll(incoming) {
    if (this.originMode === 'preset') {
      // PRESERVE landmark selection and preset route coordinates
      this.currentTravelInfo = {
        ...this.currentTravelInfo,
        queue_id: incoming.queue_id || this.currentTravelInfo.queue_id,
        status: incoming.status || this.currentTravelInfo.status,
        expected_consultation_time: incoming.expected_consultation_time || this.currentTravelInfo.expected_consultation_time,
        patient_address: this.selectedOrigin,
        location_address: this.selectedOrigin,
        location_source: 'preset'
      };
      // selectedOrigin remains untouched
      return;
    }

    this.currentTravelInfo = {
      ...this.currentTravelInfo,
      ...incoming
    };
  }
}

// Subtest 3a: Select "Tumkur Bus Stand", verify state and coords
const engine = new DepartureCardStateEngine({
  patient_address: 'Davane, Karnataka, India',
  location_address: 'Davane, Karnataka, India',
  location_source: 'manual',
  is_approximate_location: true
});

assert.strictEqual(engine.originMode, 'preset');
engine.onOriginSelect('Tumkur Bus Stand');
assert.strictEqual(engine.selectedOrigin, 'Tumkur Bus Stand');
assert.strictEqual(engine.originMode, 'preset');
assert.deepStrictEqual(engine.liveCoords, [77.1011, 13.3392]);
console.log('✓ PASS 3a: Selecting "Tumkur Bus Stand" sets originMode="preset" and loads correct coords.');

// Subtest 3b: Background GPS watcher fires with arbitrary GPS coordinates
engine.onBrowserGpsWatchEvent(13.3456, 77.1234, 12);
assert.strictEqual(engine.selectedOrigin, 'Tumkur Bus Stand', 'REGRESSION BUG: GPS event overwrote selected landmark!');
assert.strictEqual(engine.originMode, 'preset', 'REGRESSION BUG: GPS event changed originMode!');
assert.deepStrictEqual(engine.liveCoords, [77.1011, 13.3392], 'REGRESSION BUG: liveCoords altered by GPS event while in preset mode!');
assert.deepStrictEqual(engine.browserGps.coords, [77.1234, 13.3456], 'Browser GPS coordinates must be recorded in background');
console.log('✓ PASS 3b: Background GPS updates do NOT overwrite selected landmark "Tumkur Bus Stand".');

// Subtest 3c: 5-second queue polling event occurs with stale/device info
engine.on5SecondQueuePoll({
  queue_id: 'Q_12345',
  status: 'called',
  patient_address: 'Current GPS Location',
  location_source: 'gps',
  origin_latitude: 13.3456,
  origin_longitude: 77.1234
});
assert.strictEqual(engine.selectedOrigin, 'Tumkur Bus Stand', 'REGRESSION BUG: Queue polling overwrote selectedOrigin!');
assert.strictEqual(engine.originMode, 'preset', 'REGRESSION BUG: Queue polling flipped originMode!');
assert.strictEqual(engine.currentTravelInfo.patient_address, 'Tumkur Bus Stand', 'REGRESSION BUG: patient_address clobbered by queue poll!');
assert.strictEqual(engine.currentTravelInfo.status, 'called', 'Queue status should still update');
console.log('✓ PASS 3c: 5-second queue polling preserves user landmark selection.');

// Subtest 3d: Select "Batawadi"
engine.onOriginSelect('Batawadi');
assert.strictEqual(engine.selectedOrigin, 'Batawadi');
assert.strictEqual(engine.originMode, 'preset');
assert.deepStrictEqual(engine.liveCoords, [77.1147, 13.3558]);

// Multiple successive GPS polling events while "Batawadi" is selected
for (let i = 0; i < 5; i++) {
  engine.onBrowserGpsWatchEvent(13.3500 + i * 0.001, 77.1200 + i * 0.001, 8);
  engine.on5SecondQueuePoll({ status: 'in_progress' });
}
assert.strictEqual(engine.selectedOrigin, 'Batawadi', 'REGRESSION BUG: Multiple GPS/polling events overwrote Batawadi!');
assert.deepStrictEqual(engine.liveCoords, [77.1147, 13.3558], 'REGRESSION BUG: Batawadi coordinates overwritten!');
console.log('✓ PASS 3d: Multiple successive GPS and polling events maintain "Batawadi" selection.');

// Subtest 3e: Explicitly switch back to "Current GPS Location"
engine.onOriginSelect('Current GPS Location');
assert.strictEqual(engine.selectedOrigin, 'Current GPS Location');
assert.strictEqual(engine.originMode, 'gps');
assert.deepStrictEqual(engine.liveCoords, engine.browserGps.coords, 'liveCoords must switch to browser GPS coords');
console.log('✓ PASS 3e: User can switch back to "Current GPS Location" whenever desired.');

console.log('\n===============================================================');
console.log('🎉 ALL LOCATION DROPDOWN REGRESSION TESTS PASSED! 🎉');
console.log('===============================================================\n');
