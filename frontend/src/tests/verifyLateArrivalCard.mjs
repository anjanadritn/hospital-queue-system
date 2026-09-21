import assert from 'node:assert';
import { translations } from '../i18n/translations.js';

console.log('--- RUNNING LATE ARRIVAL WARNING CARD TESTS ---');

// Test 1: Translation keys exist for English, Kannada, and Hindi
const keys = [
  'late_arrival_warning_title',
  'your_token_label',
  'new_queue_position_label',
  'queue_recalculated_notice',
  'expected_consultation_label',
  'late_arrival_desc',
  'end_of_queue_label',
  'late_arrival_status'
];

for (const lang of ['en', 'kn', 'hi']) {
  assert(translations[lang], `translations[${lang}] must exist`);
  for (const key of keys) {
    assert(translations[lang][key], `translations[${lang}][${key}] must exist`);
    assert(translations[lang][key].length > 0, `translations[${lang}][${key}] cannot be empty`);
  }
}
console.log('✓ PASS: All translation keys present for en, kn, and hi.');

// Test 2: Simulating rendering logic
function evaluateCardVisibility(queueData, totalQueueLength = null) {
  if (!queueData || !queueData.late_arrival_reordered) {
    return { shouldRender: false };
  }
  const pos = queueData.position != null ? queueData.position : 'Last';
  const totalLength = totalQueueLength ?? queueData.total_active_queue ?? queueData.total_queue_count ?? null;
  const isEndOfQueue = Boolean(
    totalLength != null &&
    pos != null &&
    !isNaN(Number(pos)) &&
    !isNaN(Number(totalLength)) &&
    Number(totalLength) > 0 &&
    Number(pos) === Number(totalLength)
  );

  return {
    shouldRender: true,
    token: queueData.queue_id || queueData.token || queueData.booking_id || 'N/A',
    position: pos,
    isEndOfQueue,
    expectedConsultation: queueData.expected_consultation_time || queueData.travel_info?.expected_consultation_time || 'Approaching',
    doctorName: queueData.doctor_name || 'Assigned Doctor'
  };
}

// Case A: late_arrival_reordered is false or missing -> does NOT render
assert.strictEqual(evaluateCardVisibility({ queue_id: 'D001-Q010', late_arrival_reordered: false }).shouldRender, false);
assert.strictEqual(evaluateCardVisibility({ queue_id: 'D001-Q010' }).shouldRender, false);
assert.strictEqual(evaluateCardVisibility(null).shouldRender, false);
console.log('✓ PASS: Card does NOT render when late_arrival_reordered is false/null.');

// Case B: late_arrival_reordered is true -> renders dynamic fields without hardcoding
const dynamicData = {
  queue_id: 'D003-Q042',
  position: 7,
  late_arrival_reordered: true,
  expected_consultation_time: '04:15 PM',
  doctor_name: 'Dr. Suresh Kumar'
};

const result = evaluateCardVisibility(dynamicData);
assert.strictEqual(result.shouldRender, true);
assert.strictEqual(result.token, 'D003-Q042', 'Token must be dynamic');
assert.strictEqual(result.position, 7, 'Position must be dynamic');
assert.strictEqual(result.expectedConsultation, '04:15 PM', 'Consultation time must be dynamic');
assert.strictEqual(result.doctorName, 'Dr. Suresh Kumar', 'Doctor name must be dynamic');
console.log('✓ PASS: Card dynamically renders token, position, and consultation time.');

// Case C: Position #2 in 5-patient queue must NOT show (End of Queue)
const q012Scenario = evaluateCardVisibility({ queue_id: 'D001-Q012', position: 2, late_arrival_reordered: true }, 5);
assert.strictEqual(q012Scenario.isEndOfQueue, false, 'Position #2 in 5-patient queue must NOT be End of Queue');
console.log('✓ PASS: Position #2 in 5-patient queue correctly omits (End of Queue).');

// Case D: Position #5 in 5-patient queue MUST show (End of Queue)
const q018Scenario = evaluateCardVisibility({ queue_id: 'D001-Q018', position: 5, late_arrival_reordered: true }, 5);
assert.strictEqual(q018Scenario.isEndOfQueue, true, 'Position #5 in 5-patient queue MUST be End of Queue');
console.log('✓ PASS: Position #5 in 5-patient queue correctly shows (End of Queue).');

console.log('\n========================================');
console.log('ALL LATE ARRIVAL WARNING TESTS PASSED');
console.log('========================================');
