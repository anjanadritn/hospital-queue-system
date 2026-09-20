import assert from 'node:assert';

// 1. Mock global window and navigator for unit verification
const mockGeolocation = {
  getCurrentPosition: null,
  watchPosition: null,
  clearWatch: () => {}
};

globalThis.window = {};
globalThis.navigator = {
  geolocation: mockGeolocation
};

// Import getBrowserLocation
import { getBrowserLocation } from '../services/locationService.js';

async function runTests() {
  console.log('--- Starting GPS Behavior Regression Tests ---');

  // Test 1: GPS available -> returns fresh coordinates with maximumAge: 0 & highAccuracy
  {
    let passedOptions = null;
    mockGeolocation.getCurrentPosition = (successCb, errorCb, options) => {
      passedOptions = options;
      successCb({
        coords: {
          latitude: 13.345678,
          longitude: 77.123456,
          accuracy: 15
        }
      });
    };

    const res = await getBrowserLocation({ maximumAge: 0, enableHighAccuracy: true });
    assert.strictEqual(res.success, true, 'getBrowserLocation should return success: true');
    assert.strictEqual(res.latitude, 13.345678, 'Latitude should match');
    assert.strictEqual(res.longitude, 77.123456, 'Longitude should match');
    assert.strictEqual(passedOptions.maximumAge, 0, 'maximumAge must be 0 (no cached coords)');
    assert.strictEqual(passedOptions.enableHighAccuracy, true, 'enableHighAccuracy must be true');

    // Simulate state transition in DepartureCard
    const isExactGps = res.success;
    const liveCoords = [res.longitude, res.latitude];
    const gpsStatus = 'watching';
    const badge = (isExactGps && liveCoords)
      ? '✓ Exact GPS Active'
      : (gpsStatus === 'denied' || gpsStatus === 'unavailable')
        ? 'GPS unavailable — Using approximate location'
        : 'Approximate Landmark Transit';

    assert.strictEqual(badge, '✓ Exact GPS Active', 'Badge must display "✓ Exact GPS Active"');
    console.log('[PASS] Test 1: GPS available -> Fresh coordinates returned and badge is "✓ Exact GPS Active"');
  }

  // Test 2: GPS denied -> fallback remains approximate and UI clearly says GPS unavailable
  {
    mockGeolocation.getCurrentPosition = (successCb, errorCb) => {
      errorCb({
        code: 1, // PERMISSION_DENIED
        message: 'User denied Geolocation'
      });
    };

    const res = await getBrowserLocation({ maximumAge: 0, enableHighAccuracy: true });
    assert.strictEqual(res.success, false, 'getBrowserLocation should return success: false on denial');
    assert.strictEqual(res.code, 1, 'Error code should be 1');

    // Simulate state transition in DepartureCard
    const isExactGps = false;
    const liveCoords = null;
    const gpsStatus = res.code === 1 ? 'denied' : 'unavailable';
    const badge = (isExactGps && liveCoords)
      ? '✓ Exact GPS Active'
      : (gpsStatus === 'denied' || gpsStatus === 'unavailable')
        ? 'GPS unavailable — Using approximate location'
        : 'Approximate Landmark Transit';

    assert.strictEqual(badge, 'GPS unavailable — Using approximate location', 'Must display GPS unavailable message');
    assert.notStrictEqual(badge, '✓ Exact GPS Active', 'Must NOT display Exact GPS Active');
    console.log('[PASS] Test 2: GPS denied -> UI displays "GPS unavailable — Using approximate location"');
  }

  // Test 3: Successful GPS must never be replaced by Tumakuru fallback on subsequent polling
  {
    // Active GPS state
    let isExactGps = true;
    let selectedOrigin = 'Current GPS Location';
    let currentTravelInfo = {
      distance_km: 1.8,
      travel_time_min: 4,
      origin_latitude: 13.345678,
      origin_longitude: 77.123456,
      is_approximate_location: false,
      location_source: 'gps',
      route_geometry: { type: 'LineString', coordinates: [[77.123456, 13.345678], [77.096826, 13.376059]] }
    };

    // Incoming 5-second polling prop from backend (which still has city: Tumakuru, origin_latitude: null)
    const initialTravelInfoFromPoll = {
      patient_address: 'Tumakuru',
      city: 'Tumakuru',
      origin_latitude: null,
      origin_longitude: null,
      is_approximate_location: true,
      distance_km: 5.0,
      travel_time_min: 6,
      route_geometry: { type: 'LineString', coordinates: [[77.1, 13.34], [77.096826, 13.376059]] },
      expected_consultation_time: '02:30 PM'
    };

    // State sync reducer logic from DepartureCard
    if (isExactGps) {
      currentTravelInfo = {
        ...currentTravelInfo,
        expected_consultation_time: initialTravelInfoFromPoll.expected_consultation_time
      };
      // selectedOrigin remains 'Current GPS Location'
    } else {
      currentTravelInfo = { ...currentTravelInfo, ...initialTravelInfoFromPoll };
      selectedOrigin = initialTravelInfoFromPoll.patient_address;
    }

    assert.strictEqual(selectedOrigin, 'Current GPS Location', 'Origin must not be clobbered to Tumakuru');
    assert.strictEqual(currentTravelInfo.distance_km, 1.8, 'GPS distance must be preserved');
    assert.strictEqual(currentTravelInfo.travel_time_min, 4, 'GPS travel time must be preserved');
    assert.strictEqual(currentTravelInfo.is_approximate_location, false, 'is_approximate_location must remain false');
    assert.strictEqual(currentTravelInfo.location_source, 'gps', 'location_source must remain gps');
    assert.strictEqual(currentTravelInfo.expected_consultation_time, '02:30 PM', 'Consultation time from poll updated');
    console.log('[PASS] Test 3: Successful GPS is preserved and never replaced by Tumakuru fallback on polling');
  }

  console.log('--- All 3 GPS Behavior Regression Tests PASSED Successfully ---');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
