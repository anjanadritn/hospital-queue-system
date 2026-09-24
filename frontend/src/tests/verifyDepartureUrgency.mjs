/**
 * Regression Test Suite for Smart Patient Departure Engine Reminder/State Logic
 *
 * Tests all requirements from Requirement F:
 * 1. Current time before departure → BEFORE_DEPARTURE
 * 2. Current time after departure but before expected arrival → LEAVE_NOW
 * 3. Current time after expected arrival but before 2-minute deadline → URGENT
 * 4. Current time after arrival deadline → VERY_LATE
 * 5. Arrived patient → no departure warning
 * 6. Completed/cancelled/missed patient → no departure warning
 * 7. Existing 2-minute late-arrival queue reorder still works (tested with backend pytest)
 * 8. No stale 02:09 recommendation remains as the only status when current time is later
 */

import {
  DEPARTURE_STATES,
  parseIsoOrTime,
  isPatientArrivedOrTerminal,
  getDepartureState
} from '../services/departureStateService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('--- RUNNING DEPARTURE ENGINE REGRESSION TESTS ---');

// Base fixture matching the user's exact issue scenario
const basePatient = {
  queue_id: 'D001-Q010',
  doctor_name: 'Dr. Ananya Sharma',
  consultation_date: '2026-09-19',
  consultation_slot: 'evening',
  status: 'waiting',
  arrived_at_hospital: false,
  verified_by_admin: false,
  late_arrival_reordered: true,
  recommended_departure_time: '02:09 PM',
  recommended_departure_iso: '2026-09-19T14:09:00+05:30',
  expected_hospital_arrival: '02:25 PM',
  expected_hospital_arrival_iso: '2026-09-19T14:25:00+05:30',
  arrival_deadline_time: '02:27 PM',
  arrival_deadline_iso: '2026-09-19T14:27:00+05:30',
  expected_consultation_time: '02:35 PM',
  expected_consultation_iso: '2026-09-19T14:35:00+05:30'
};

// Test 1: Current time before departure → BEFORE_DEPARTURE
{
  console.log('\nTest 1: Current time before departure (02:00 PM)');
  const testTime = parseIsoOrTime(null, '02:00 PM', '2026-09-19');
  const state = getDepartureState(basePatient, testTime);
  assert(state === DEPARTURE_STATES.BEFORE_DEPARTURE, `State is BEFORE_DEPARTURE (got: ${state})`);
}

// Test 2: Current time after departure but before expected arrival → LEAVE_NOW
{
  console.log('\nTest 2: Current time after departure but before expected arrival (02:15 PM)');
  const testTime = parseIsoOrTime(null, '02:15 PM', '2026-09-19');
  const state = getDepartureState(basePatient, testTime);
  assert(state === DEPARTURE_STATES.LEAVE_NOW, `State is LEAVE_NOW (got: ${state})`);
}

// Test 3: Current time after expected arrival but before 2-minute deadline → URGENT
{
  console.log('\nTest 3: Current time after expected arrival but before 2-minute deadline (02:26 PM)');
  const testTime = parseIsoOrTime(null, '02:26 PM', '2026-09-19');
  const state = getDepartureState(basePatient, testTime);
  assert(state === DEPARTURE_STATES.URGENT, `State is URGENT (got: ${state})`);
}

// Test 4: Current time after arrival deadline → VERY_LATE
{
  console.log('\nTest 4: Current time after arrival deadline (02:28 PM)');
  const testTime = parseIsoOrTime(null, '02:28 PM', '2026-09-19');
  const state = getDepartureState(basePatient, testTime);
  assert(state === DEPARTURE_STATES.VERY_LATE, `State is VERY_LATE (got: ${state})`);
}

// Test 5: Arrived patient → no departure warning (ARRIVED_OR_TERMINAL)
{
  console.log('\nTest 5: Arrived patient (arrived_at_hospital=true or status="arrived")');
  const arrivedPatient1 = { ...basePatient, arrived_at_hospital: true };
  const arrivedPatient2 = { ...basePatient, status: 'arrived' };
  const arrivedPatient3 = { ...basePatient, verified_by_admin: true };
  const testTime = parseIsoOrTime(null, '03:12 PM', '2026-09-19'); // Even if time is 3:12 PM

  assert(
    getDepartureState(arrivedPatient1, testTime) === DEPARTURE_STATES.ARRIVED_OR_TERMINAL,
    'arrived_at_hospital=true yields ARRIVED_OR_TERMINAL'
  );
  assert(
    getDepartureState(arrivedPatient2, testTime) === DEPARTURE_STATES.ARRIVED_OR_TERMINAL,
    'status="arrived" yields ARRIVED_OR_TERMINAL'
  );
  assert(
    getDepartureState(arrivedPatient3, testTime) === DEPARTURE_STATES.ARRIVED_OR_TERMINAL,
    'verified_by_admin=true yields ARRIVED_OR_TERMINAL'
  );
  assert(
    isPatientArrivedOrTerminal(arrivedPatient1) === true,
    'isPatientArrivedOrTerminal returns true'
  );
}

// Test 6: Completed/cancelled/missed patient → no departure warning (ARRIVED_OR_TERMINAL)
{
  console.log('\nTest 6: Completed/cancelled/missed patient');
  const testTime = parseIsoOrTime(null, '03:12 PM', '2026-09-19');
  const statuses = ['completed', 'cancelled', 'missed', 'in_consultation', 'no_show'];
  for (const s of statuses) {
    const patient = { ...basePatient, status: s };
    const state = getDepartureState(patient, testTime);
    assert(
      state === DEPARTURE_STATES.ARRIVED_OR_TERMINAL,
      `Status "${s}" yields ARRIVED_OR_TERMINAL (no departure warning)`
    );
  }
}

// Test 7: Parsing edge cases (12h format fallback, missing deadline auto-derived)
{
  console.log('\nTest 7: Auto-derived deadline from arrival time when ISO deadline absent');
  const patientWithoutDeadline = {
    ...basePatient,
    arrival_deadline_time: null,
    arrival_deadline_iso: null
  };
  // 02:25 PM arrival + 2 mins = 02:27 PM deadline
  const urgentTime = parseIsoOrTime(null, '02:26 PM', '2026-09-19');
  const veryLateTime = parseIsoOrTime(null, '02:28 PM', '2026-09-19');
  assert(
    getDepartureState(patientWithoutDeadline, urgentTime) === DEPARTURE_STATES.URGENT,
    'Auto-derives 2-min deadline: 02:26 PM is URGENT'
  );
  assert(
    getDepartureState(patientWithoutDeadline, veryLateTime) === DEPARTURE_STATES.VERY_LATE,
    'Auto-derives 2-min deadline: 02:28 PM is VERY_LATE'
  );
}

// Test 8: Problem Reproduction Test: Stale 02:09 PM at 03:12 PM
{
  console.log('\nTest 8: User scenario reproduction (Recommended 02:09 PM, Current time 03:12 PM)');
  const currentTime312 = parseIsoOrTime(null, '03:12 PM', '2026-09-19');
  const stateAt312 = getDepartureState(basePatient, currentTime312);

  assert(
    stateAt312 !== DEPARTURE_STATES.BEFORE_DEPARTURE,
    'State at 03:12 PM is NOT BEFORE_DEPARTURE'
  );
  assert(
    stateAt312 === DEPARTURE_STATES.VERY_LATE,
    `State at 03:12 PM evaluates to VERY_LATE (got: ${stateAt312})`
  );
}

// Test 9: Verification of 3-state dynamic arrival rules & 197.6km / 144min route
{
  console.log('\nTest 9: 3-State Dynamic Arrival Calculation (197.6 km, 144 min)');

  // Subtest 9A: Not departed + recommended departure passed (Consultation: 12:08 PM, travel: 144 min, buffer: 10 min -> Rec departure: 09:34 AM, Now: 11:45 AM)
  const testNowMs = parseIsoOrTime(null, '11:45 AM', '2026-09-20');
  const longRoutePatient = {
    expected_consultation_time: '12:08 PM',
    expected_consultation_iso: '2026-09-20T12:08:00+05:30',
    recommended_departure_time: '09:34 AM',
    recommended_departure_iso: '2026-09-20T09:34:00+05:30',
    distance_km: 197.6,
    travel_time_min: 144,
    safety_buffer_min: 10,
    leaving_now: false,
    consultation_date: '2026-09-20'
  };

  const state9A = getDepartureState(longRoutePatient, testNowMs);
  assert(state9A === DEPARTURE_STATES.LEAVE_NOW, `State at 11:45 AM with 144min route is LEAVE_NOW (got: ${state9A})`);

  // Subtest 9B: Departed -> departure time + travel duration (Departed at 11:30 AM + 144 min = 01:54 PM arrival)
  const departedPatient = {
    ...longRoutePatient,
    leaving_now: true,
    leaving_now_at: '2026-09-20T11:30:00+05:30'
  };
  const timeBeforeArrival = parseIsoOrTime(null, '01:30 PM', '2026-09-20');
  const timeAfterArrival = parseIsoOrTime(null, '01:55 PM', '2026-09-20');
  const timeAfterDeadline = parseIsoOrTime(null, '01:57 PM', '2026-09-20');

  assert(getDepartureState(departedPatient, timeBeforeArrival) === DEPARTURE_STATES.LEAVE_NOW, 'Departed patient en route evaluates to LEAVE_NOW before 01:54 PM');
  assert(getDepartureState(departedPatient, timeAfterArrival) === DEPARTURE_STATES.URGENT, 'Departed patient past 01:54 PM arrival evaluates to URGENT');
  assert(getDepartureState(departedPatient, timeAfterDeadline) === DEPARTURE_STATES.VERY_LATE, 'Departed patient past 01:56 PM deadline evaluates to VERY_LATE');

  // Subtest 9C: On schedule -> recommended departure + travel duration (Rec: 02:00 PM, travel: 30m, Now: 01:00 PM)
  const onSchedulePatient = {
    expected_consultation_time: '02:40 PM',
    expected_consultation_iso: '2026-09-20T14:40:00+05:30',
    recommended_departure_time: '02:00 PM',
    recommended_departure_iso: '2026-09-20T14:00:00+05:30',
    travel_time_min: 30,
    safety_buffer_min: 10,
    leaving_now: false,
    consultation_date: '2026-09-20'
  };
  const timeBeforeDep = parseIsoOrTime(null, '01:00 PM', '2026-09-20');
  assert(getDepartureState(onSchedulePatient, timeBeforeDep) === DEPARTURE_STATES.BEFORE_DEPARTURE, 'On-schedule patient before 02:00 PM is BEFORE_DEPARTURE');
}

console.log(`\n========================================`);
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
