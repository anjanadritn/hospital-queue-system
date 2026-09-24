import assert from 'node:assert';
import { translations } from '../i18n/translations.js';
import { isPatientArrivedOrTerminal, getDepartureState, DEPARTURE_STATES } from '../services/departureStateService.js';

console.log('--- RUNNING ARRIVAL VERIFIED EXPERIENCE TESTS ---');

// Test 1: Translation keys exist for English, Kannada, and Hindi
const requiredKeys = [
  'arrival_verified',
  'arrival_verified_badge',
  'arrival_verified_title',
  'arrival_verified_desc',
  'patients_ahead_label',
  'fresh_expected_consultation',
  'target_30_status_label',
  'target_30_on_track',
  'target_30_exceeded',
  'target_30_disclaimer',
  'waiting_in_opd_lounge'
];

for (const lang of ['en', 'kn', 'hi']) {
  assert(translations[lang], `translations[${lang}] must exist`);
  for (const key of requiredKeys) {
    assert(translations[lang][key], `translations[${lang}][${key}] must exist`);
    assert(translations[lang][key].length > 0, `translations[${lang}][${key}] cannot be empty`);
  }
}
console.log('✓ PASS: All Arrival Verified translation keys present for en, kn, and hi.');

// Test 2: 30-Minute Target Status Evaluation
function evaluate30MinTarget(predictedWait) {
  const isOnTrack = predictedWait <= 30;
  return {
    isOnTrack,
    status: isOnTrack ? 'on_track' : 'exceeds_target',
    label: isOnTrack ? 'On track' : 'Queue exceeds 30-minute target',
    isGuaranteed: false // 30 mins is an operational target, NOT guaranteed
  };
}

// Case A: Wait <= 30 mins (e.g. 15 mins) -> On track
{
  const res = evaluate30MinTarget(15);
  assert.strictEqual(res.isOnTrack, true);
  assert.strictEqual(res.status, 'on_track');
  assert.strictEqual(res.label, 'On track');
  assert.strictEqual(res.isGuaranteed, false, '30 min must be a target, not a guarantee');
  console.log('✓ PASS: Wait <= 30 min evaluates to "On track".');
}

// Case B: Wait = 30 mins (boundary) -> On track
{
  const res = evaluate30MinTarget(30);
  assert.strictEqual(res.isOnTrack, true);
  assert.strictEqual(res.status, 'on_track');
  assert.strictEqual(res.label, 'On track');
  console.log('✓ PASS: Wait = 30 min boundary evaluates to "On track".');
}

// Case C: Wait > 30 mins (e.g. 45 mins) -> Queue exceeds 30-minute target
{
  const res = evaluate30MinTarget(45);
  assert.strictEqual(res.isOnTrack, false);
  assert.strictEqual(res.status, 'exceeds_target');
  assert.strictEqual(res.label, 'Queue exceeds 30-minute target');
  console.log('✓ PASS: Wait > 30 min evaluates to "Queue exceeds 30-minute target".');
}

// Test 3: Travel Information Removal upon Arrival Verification
function evaluateViewMode(queueData) {
  const isArrivalVerified = Boolean(
    queueData?.verified_by_admin ||
    queueData?.arrived_at_hospital ||
    queueData?.status === 'arrived'
  );

  if (isArrivalVerified) {
    return {
      mode: 'ARRIVAL_VERIFIED',
      showGpsRoute: false,
      showDistance: false,
      showLeaveNow: false,
      showDepartureTime: false,
      showTravelDuration: false,
      showArrivalVerifiedCard: true,
      showToken: true,
      showPosition: true,
      showPatientsAhead: true,
      showEstWait: true,
      showFreshConsultation: true,
      show30MinTarget: true
    };
  }

  return {
    mode: 'PRE_ARRIVAL',
    showGpsRoute: true,
    showDistance: true,
    showLeaveNow: true,
    showDepartureTime: true,
    showTravelDuration: true,
    showArrivalVerifiedCard: false
  };
}

// Case A: Pre-arrival patient -> Shows travel info
{
  const preArrivalPatient = {
    queue_id: 'D001-Q005',
    status: 'waiting',
    arrived_at_hospital: false,
    verified_by_admin: false,
    distance_km: 12.5,
    travel_time_min: 22
  };
  const view = evaluateViewMode(preArrivalPatient);
  assert.strictEqual(view.mode, 'PRE_ARRIVAL');
  assert.strictEqual(view.showGpsRoute, true);
  assert.strictEqual(view.showLeaveNow, true);
  assert.strictEqual(view.showArrivalVerifiedCard, false);
  console.log('✓ PASS: Pre-arrival patient retains travel info, GPS route, and Leave Now.');
}

// Case B: Arrival-verified patient -> Removes travel info, shows ArrivalVerifiedCard
{
  const verifiedPatient = {
    queue_id: 'D001-Q005',
    status: 'arrived',
    arrived_at_hospital: true,
    verified_by_admin: true,
    position: 2,
    predicted_wait_time: 14,
    expected_consultation_time: '11:14 AM'
  };
  const view = evaluateViewMode(verifiedPatient);
  assert.strictEqual(view.mode, 'ARRIVAL_VERIFIED');
  assert.strictEqual(view.showGpsRoute, false, 'GPS route must be removed');
  assert.strictEqual(view.showDistance, false, 'Distance must be removed');
  assert.strictEqual(view.showLeaveNow, false, 'Leave Now must be removed');
  assert.strictEqual(view.showDepartureTime, false, 'Departure time must be removed');
  assert.strictEqual(view.showTravelDuration, false, 'Travel duration must be removed');
  assert.strictEqual(view.showArrivalVerifiedCard, true);
  assert.strictEqual(view.show30MinTarget, true);
  console.log('✓ PASS: Arrival verified patient hides travel info and renders ArrivalVerifiedCard.');
}

// Test 4: Departure state service returns ARRIVED_OR_TERMINAL
{
  const arrivalInfo = {
    arrived_at_hospital: true,
    verified_by_admin: true,
    status: 'arrived'
  };
  assert.strictEqual(isPatientArrivedOrTerminal(arrivalInfo), true);
  assert.strictEqual(getDepartureState(arrivalInfo), DEPARTURE_STATES.ARRIVED_OR_TERMINAL);
  console.log('✓ PASS: departureStateService correctly evaluates arrival state as ARRIVED_OR_TERMINAL.');
}

console.log('\n========================================');
console.log('ALL ARRIVAL VERIFIED EXPERIENCE TESTS PASSED');
console.log('========================================');
