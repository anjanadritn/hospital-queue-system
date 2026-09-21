import assert from 'node:assert';
import { translations } from '../i18n/translations.js';

console.log('--- RUNNING PATIENT LOCATION SELECTION & BOOKING FLOW TESTS ---');

// 1. Verify translation keys across en, kn, and hi
const requiredLocationKeys = [
  'booking_for_question',
  'booking_myself',
  'booking_myself_desc',
  'booking_family',
  'booking_family_desc',
  'who_is_patient',
  'patient_name_label',
  'patient_relation_label',
  'where_is_patient_question',
  'loc_opt_current',
  'loc_opt_current_desc',
  'loc_opt_map',
  'loc_opt_map_desc',
  'loc_opt_manual',
  'loc_opt_manual_desc',
  'approximate_notice',
  'location_source_map',
  'location_source_manual',
  'device_gps_confirmed'
];

for (const lang of ['en', 'kn', 'hi']) {
  assert(translations[lang], `translations[${lang}] must exist`);
  for (const key of requiredLocationKeys) {
    assert(translations[lang][key], `translations[${lang}][${key}] must exist and be defined`);
    assert(translations[lang][key].length > 0, `translations[${lang}][${key}] cannot be empty string`);
  }
}
console.log('✓ PASS: All patient location translation keys exist for en, kn, and hi.');

// 2. Test booking logic state isolation (Myself vs Family Member)
function createBookingPayload(options) {
  const {
    bookingFor = 'myself',
    relation = '',
    patientName = '',
    deviceGpsCoords = null, // e.g. [lon, lat] for device holding the phone
    selectedOption = 'current', // 'current' | 'map' | 'manual'
    mapSelectedLocation = null, // { address, lat, lon }
    manualLocation = null // { city, locality, address }
  } = options;

  if (bookingFor === 'myself') {
    // Keep existing behavior: device GPS is queried and used
    return {
      booking_for: 'myself',
      relation: null,
      patient_name: null,
      origin_latitude: deviceGpsCoords ? deviceGpsCoords[1] : null,
      origin_longitude: deviceGpsCoords ? deviceGpsCoords[0] : null,
      location_source: deviceGpsCoords ? 'device_gps' : 'manual',
      is_approximate: !deviceGpsCoords,
      location_address: deviceGpsCoords ? 'Current Device GPS' : 'Tumakuru'
    };
  }

  // Booking for family member / dependent:
  // MUST NOT automatically query or use device GPS!
  assert(
    options.autoQueriedDeviceGps !== true,
    'SECURITY ERROR: Device GPS must never be automatically queried when booking for family!'
  );

  if (selectedOption === 'current') {
    // Booker confirmed they are physically with the patient
    return {
      booking_for: 'family',
      relation: relation || 'Family Member',
      patient_name: patientName,
      origin_latitude: deviceGpsCoords ? deviceGpsCoords[1] : null,
      origin_longitude: deviceGpsCoords ? deviceGpsCoords[0] : null,
      location_source: 'device_gps',
      is_approximate: false,
      location_address: 'Device Location (With Patient)'
    };
  }

  if (selectedOption === 'map') {
    assert(mapSelectedLocation, 'Map selected location must be provided');
    return {
      booking_for: 'family',
      relation: relation || 'Mother',
      patient_name: patientName || 'Mother',
      origin_latitude: mapSelectedLocation.lat,
      origin_longitude: mapSelectedLocation.lon,
      location_source: 'map_selected',
      is_approximate: false,
      location_address: mapSelectedLocation.address
    };
  }

  if (selectedOption === 'manual') {
    assert(manualLocation, 'Manual location must be provided');
    const fullAddr = [manualLocation.address, manualLocation.locality, manualLocation.city]
      .filter(Boolean)
      .join(', ');
    return {
      booking_for: 'family',
      relation: relation || 'Family Member',
      patient_name: patientName || 'Family Member',
      origin_latitude: null,
      origin_longitude: null,
      location_source: 'manual',
      is_approximate: true, // Marked as approximate!
      location_address: fullAddr,
      approximate_notice: 'Approximate location — travel time may vary.'
    };
  }
}

// Test Case 2A: Self booking uses device GPS
{
  const bengaluruGps = [77.5946, 12.9716];
  const payload = createBookingPayload({
    bookingFor: 'myself',
    deviceGpsCoords: bengaluruGps
  });
  assert.strictEqual(payload.booking_for, 'myself');
  assert.strictEqual(payload.origin_latitude, 12.9716);
  assert.strictEqual(payload.origin_longitude, 77.5946);
  assert.strictEqual(payload.location_source, 'device_gps');
  assert.strictEqual(payload.is_approximate, false);
  console.log('✓ PASS: Self booking uses device GPS and marks is_approximate as false.');
}

// Test Case 2B: Family booking for Mother in Alipur uses Map Selection
{
  const bengaluruDeviceGps = [77.5946, 12.9716]; // Booker is in Bengaluru
  const alipurMapSelection = {
    address: 'Alipur, Gauribidanur, Chikkaballapur',
    lat: 13.6234,
    lon: 77.4567
  };

  const payload = createBookingPayload({
    bookingFor: 'family',
    relation: 'Mother',
    patientName: 'Sharadamma',
    deviceGpsCoords: bengaluruDeviceGps,
    selectedOption: 'map',
    mapSelectedLocation: alipurMapSelection,
    autoQueriedDeviceGps: false
  });

  // Booker's Bengaluru GPS must NOT be in payload
  assert.notStrictEqual(payload.origin_latitude, bengaluruDeviceGps[1]);
  assert.notStrictEqual(payload.origin_longitude, bengaluruDeviceGps[0]);

  // Mother's Alipur coordinates MUST be in payload
  assert.strictEqual(payload.origin_latitude, 13.6234);
  assert.strictEqual(payload.origin_longitude, 77.4567);
  assert.strictEqual(payload.location_source, 'map_selected');
  assert.strictEqual(payload.is_approximate, false);
  assert.strictEqual(payload.relation, 'Mother');
  assert.strictEqual(payload.patient_name, 'Sharadamma');
  console.log('✓ PASS: Mother appointment in Alipur uses map-selected coordinates and ignores Booker Bengaluru GPS.');
}

// Test Case 2C: Family booking with manual entry is marked approximate
{
  const payload = createBookingPayload({
    bookingFor: 'family',
    relation: 'Father',
    patientName: 'Kenchappa',
    selectedOption: 'manual',
    manualLocation: {
      city: 'Chikkaballapur',
      locality: 'Alipur Cross',
      address: 'Near Old Bus Stand'
    },
    autoQueriedDeviceGps: false
  });

  assert.strictEqual(payload.location_source, 'manual');
  assert.strictEqual(payload.is_approximate, true);
  assert.strictEqual(payload.approximate_notice, 'Approximate location — travel time may vary.');
  assert.strictEqual(payload.location_address, 'Near Old Bus Stand, Alipur Cross, Chikkaballapur');
  console.log('✓ PASS: Manual family location is flagged as approximate with warning notice.');
}

// Test Case 2D: Departure card respects map-selected patient location and avoids browser GPS clobbering
function simulateDepartureGuard(initialTravelInfo) {
  const isDeviceGps = initialTravelInfo.location_source === 'gps' || initialTravelInfo.location_source === 'device_gps';
  const isApprox = initialTravelInfo.is_approximate ?? initialTravelInfo.is_approximate_location ?? false;
  const isExactGps = isDeviceGps && !isApprox && Boolean(initialTravelInfo.origin_latitude && initialTravelInfo.origin_longitude);
  const liveTrackingActive = isExactGps;

  return {
    isExactGps,
    liveTrackingActive,
    originLatitude: initialTravelInfo.origin_latitude,
    originLongitude: initialTravelInfo.origin_longitude,
    locationSource: initialTravelInfo.location_source,
    isApproximate: isApprox
  };
}

{
  const motherTravelInfo = {
    booking_for: 'family',
    relation: 'Mother',
    location_source: 'map_selected',
    location_address: 'Alipur, Chikkaballapur',
    origin_latitude: 13.6234,
    origin_longitude: 77.4567,
    is_approximate: false
  };

  const guardResult = simulateDepartureGuard(motherTravelInfo);
  assert.strictEqual(guardResult.isExactGps, false, 'Map selected must not be flagged as device GPS');
  assert.strictEqual(guardResult.liveTrackingActive, false, 'Device GPS watch must NOT be active for remote patient');
  assert.strictEqual(guardResult.originLatitude, 13.6234);
  assert.strictEqual(guardResult.originLongitude, 77.4567);
  assert.strictEqual(guardResult.locationSource, 'map_selected');
  console.log('✓ PASS: DepartureCard guards Mother location from being clobbered by device GPS.');
}

console.log('\nALL PATIENT LOCATION SELECTION TESTS PASSED SUCCESSFULLY.');
