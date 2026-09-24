import assert from 'node:assert';
import axios from 'axios';
import { translations } from '../i18n/translations.js';

console.log('================================================================');
console.log(' PATIENT PORTAL SEPARATION (DASHBOARD vs PROFILE) TESTS');
console.log('================================================================\n');

// 1. Translations Verification across English, Kannada, and Hindi
console.log('--- 1. Testing Translations across en, kn, hi ---');
const requiredKeys = [
  'my_dashboard',
  'my_profile',
  'my_medical_history',
  'account_security',
  'change_password',
  'current_password',
  'new_password',
  'confirm_new_password',
  'password_updated_success',
  'passwords_must_match',
  'password_min_length',
  'appointment_history',
  'personal_info_tab',
  'medical_history_tab',
  'account_status_label',
  'verified_patient',
  'registered_phone',
  'state_label',
  'all_appointments',
  'upcoming',
  'completed',
  'cancelled',
  'view_prescription_record',
  'no_medical_records_yet',
  'no_appointment_records_yet'
];

for (const lang of ['en', 'kn', 'hi']) {
  assert(translations[lang], `Language '${lang}' must exist in translations`);
  for (const key of requiredKeys) {
    const val = translations[lang][key];
    assert(val, `Key '${key}' must exist in '${lang}'`);
    assert(typeof val === 'string' && val.trim().length > 0, `Key '${key}' in '${lang}' cannot be empty`);
  }
}
console.log('✓ PASS: All separation and profile translation keys exist in en, kn, and hi.\n');

// 2. Integration with Flask Backend
const API_BASE = 'http://localhost:5000/api';

async function runSeparationTests() {
  console.log('--- 2. Testing Authenticated Patient Endpoints ---');

  // Login as Demo Patient
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    phone: '9876543211',
    password: 'PatientPass123!',
    role: 'patient'
  });
  assert(loginRes.data.token, 'Login must succeed');
  const token = loginRes.data.token;
  const patientId = loginRes.data.user.patient_id || 'P001';
  const headers = { Authorization: `Bearer ${token}` };

  console.log(`✓ Logged in as Patient: ${loginRes.data.user.name} (${patientId})`);

  // A. Dedicated Profile Data via GET /patients/me
  console.log('Fetching patient profile (/patients/me)...');
  const profileRes = await axios.get(`${API_BASE}/patients/me`, { headers });
  assert.strictEqual(profileRes.status, 200);
  const patientDoc = profileRes.data.patient || profileRes.data;
  assert(patientDoc.name, 'Patient profile must have a name');
  assert(patientDoc.phone, 'Patient profile must have a phone');
  assert.strictEqual(patientDoc.password, undefined, 'Password must never be returned');
  assert.strictEqual(patientDoc.password_hash, undefined, 'Password hash must never be returned');
  console.log(`✓ PASS: Profile retrieved for ${patientDoc.name} (${patientDoc.patient_id || patientId})`);

  // B. Medical History Data via GET /patients/me/history
  console.log('Fetching medical history (/patients/me/history)...');
  const historyRes = await axios.get(`${API_BASE}/patients/me/history`, { headers });
  assert.strictEqual(historyRes.status, 200);
  assert(Array.isArray(historyRes.data.consultations), 'Consultations must be an array');
  console.log(`✓ PASS: Medical history retrieved (${historyRes.data.total_consultations} records)`);

  // C. Patient Appointments via GET /appointments/patient/:patient_id
  console.log(`Fetching appointments (/appointments/patient/${patientId})...`);
  const aptsRes = await axios.get(`${API_BASE}/appointments/patient/${patientId}`, { headers });
  assert.strictEqual(aptsRes.status, 200);
  assert(Array.isArray(aptsRes.data), 'Appointments must be an array');
  console.log(`✓ PASS: Appointments retrieved (${aptsRes.data.length} records)`);

  // D. Cross-Patient Data Isolation Test
  console.log('Testing cross-patient data isolation (attempting to view another patient)...');
  try {
    await axios.get(`${API_BASE}/appointments/patient/P_DIFFERENT_PATIENT`, { headers });
    assert.fail('Should have been rejected with 403');
  } catch (err) {
    assert.strictEqual(err.response?.status, 403, 'Cross-patient access must return 403 Forbidden');
    console.log('✓ PASS: Blocked unauthorized appointment access with 403 Forbidden');
  }

  try {
    await axios.get(`${API_BASE}/patients/P_DIFFERENT_PATIENT`, { headers });
    assert.fail('Should have been rejected with 403');
  } catch (err) {
    assert.strictEqual(err.response?.status, 403, 'Cross-patient profile access must return 403 Forbidden');
    console.log('✓ PASS: Blocked unauthorized profile access with 403 Forbidden');
  }

  // E. Password Change Endpoint Test
  console.log('Testing change-password endpoint validation...');
  // Bad current password
  try {
    await axios.post(`${API_BASE}/patients/me/change-password`, {
      current_password: 'WrongCurrentPassword!',
      new_password: 'NewValidPassword123!',
      confirm_password: 'NewValidPassword123!'
    }, { headers });
    assert.fail('Should have rejected wrong current password');
  } catch (err) {
    assert.strictEqual(err.response?.status, 400);
    assert(err.response.data.error.includes('Current password is incorrect'));
    console.log(`✓ PASS: Rejected wrong current password: "${err.response.data.error}"`);
  }

  // Mismatched confirm password
  try {
    await axios.post(`${API_BASE}/patients/me/change-password`, {
      current_password: 'PatientPass123!',
      new_password: 'NewValidPassword123!',
      confirm_password: 'MismatchPassword!'
    }, { headers });
    assert.fail('Should have rejected mismatched confirmation');
  } catch (err) {
    assert.strictEqual(err.response?.status, 400);
    assert(err.response.data.error.includes('do not match'));
    console.log(`✓ PASS: Rejected mismatched confirm password: "${err.response.data.error}"`);
  }

  console.log('\n================================================================');
  console.log(' ALL PATIENT PORTAL SEPARATION TESTS PASSED! (100%)');
  console.log('================================================================');
}

runSeparationTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
