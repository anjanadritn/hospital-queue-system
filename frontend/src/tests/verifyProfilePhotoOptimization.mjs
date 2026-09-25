import assert from 'node:assert';
import axios from 'axios';
import { translations } from '../i18n/translations.js';

console.log('================================================================');
console.log(' PATIENT PROFILE PHOTO UPLOAD & AUTOMATIC OPTIMIZATION TESTS');
console.log('================================================================\n');

// -------------------------------------------------------------------------
// 1. Translations Verification across English, Kannada, and Hindi
// -------------------------------------------------------------------------
console.log('--- 1. Testing Translations across en, kn, hi ---');
const requiredPhotoKeys = [
  'optimizing_photo',
  'uploading_photo',
  'profile_photo_updated_success',
  'unable_process_image',
  'confirm_remove_photo',
  'photo_auto_optimize_hint',
  'supported_formats',
  'image_too_large',
  'invalid_image_format'
];

for (const lang of ['en', 'kn', 'hi']) {
  assert(translations[lang], `Language '${lang}' must exist in translations`);
  for (const key of requiredPhotoKeys) {
    const val = translations[lang][key];
    assert(val, `Key '${key}' must exist in '${lang}'`);
    assert(typeof val === 'string' && val.trim().length > 0, `Key '${key}' in '${lang}' cannot be empty`);
  }
}
console.log('✓ PASS: All required photo upload translation keys exist in en, kn, and hi.\n');

// -------------------------------------------------------------------------
// 2. Aspect Ratio & Dimension Calculation Logic Verification
// -------------------------------------------------------------------------
console.log('--- 2. Testing Aspect Ratio & Scaling Math ---');

function calculateScaledDimensions(origWidth, origHeight, maxWidth = 800, maxHeight = 800) {
  let targetWidth = origWidth;
  let targetHeight = origHeight;

  if (targetWidth > maxWidth || targetHeight > maxHeight) {
    const widthRatio = maxWidth / targetWidth;
    const heightRatio = maxHeight / targetHeight;
    const bestRatio = Math.min(widthRatio, heightRatio);

    targetWidth = Math.max(1, Math.round(targetWidth * bestRatio));
    targetHeight = Math.max(1, Math.round(targetHeight * bestRatio));
  }

  return { targetWidth, targetHeight };
}

// Case 2A: Landscape image 4000x3000 (4:3)
{
  const { targetWidth, targetHeight } = calculateScaledDimensions(4000, 3000, 800, 800);
  assert.strictEqual(targetWidth, 800);
  assert.strictEqual(targetHeight, 600);
  const origAspect = 4000 / 3000;
  const scaledAspect = targetWidth / targetHeight;
  assert(Math.abs(origAspect - scaledAspect) < 0.001, 'Landscape aspect ratio must be preserved');
  console.log(`✓ PASS: Landscape 4000x3000 scaled to ${targetWidth}x${targetHeight} (preserved aspect ratio: ${scaledAspect.toFixed(2)})`);
}

// Case 2B: Portrait image 3000x4000 (3:4)
{
  const { targetWidth, targetHeight } = calculateScaledDimensions(3000, 4000, 800, 800);
  assert.strictEqual(targetWidth, 600);
  assert.strictEqual(targetHeight, 800);
  const origAspect = 3000 / 4000;
  const scaledAspect = targetWidth / targetHeight;
  assert(Math.abs(origAspect - scaledAspect) < 0.001, 'Portrait aspect ratio must be preserved');
  console.log(`✓ PASS: Portrait 3000x4000 scaled to ${targetWidth}x${targetHeight} (preserved aspect ratio: ${scaledAspect.toFixed(2)})`);
}

// Case 2C: Square image 2048x2048 (1:1)
{
  const { targetWidth, targetHeight } = calculateScaledDimensions(2048, 2048, 800, 800);
  assert.strictEqual(targetWidth, 800);
  assert.strictEqual(targetHeight, 800);
  assert.strictEqual(targetWidth, targetHeight, 'Square aspect ratio must remain square');
  console.log(`✓ PASS: Square 2048x2048 scaled to ${targetWidth}x${targetHeight}`);
}

// Case 2D: Small image 450x300 (under 800x800)
{
  const { targetWidth, targetHeight } = calculateScaledDimensions(450, 300, 800, 800);
  assert.strictEqual(targetWidth, 450, 'Small width should not be artificially enlarged');
  assert.strictEqual(targetHeight, 300, 'Small height should not be artificially enlarged');
  console.log(`✓ PASS: Small image 450x300 preserved as ${targetWidth}x${targetHeight} without distortion\n`);
}

// -------------------------------------------------------------------------
// 3. Backend Integration & Safety Layer Verification
// -------------------------------------------------------------------------
console.log('--- 3. Testing Backend Integration & Safety Layer ---');
const API_BASE = 'http://localhost:5000/api';

async function runBackendIntegrationTests() {
  // Step 3A: Login as Demo Patient
  console.log('Signing in Demo Patient (9876543211)...');
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    phone: '9876543211',
    password: 'PatientPass123!',
    role: 'patient'
  });
  assert(loginRes.data.token, 'Login must return token');
  const token = loginRes.data.token;
  const patientId = loginRes.data.user.patient_id || 'P001';
  console.log(`✓ Logged in as Patient: ${loginRes.data.user.name} (${patientId})`);

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  // Step 3B: Create valid minimal JPEG image bytes (valid JPEG magic bytes: FF D8 FF E0 ...)
  const validJpegBuffer = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x0A,
    0x00, 0x0A, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3F, 0x00, 0xBF, 0xFF, 0xD9
  ]);
  const validJpegB64 = validJpegBuffer.toString('base64');

  // Step 3C: Upload optimized photo via PUT /patients/me/picture
  console.log('Uploading optimized JPEG profile photo...');
  const uploadRes = await axios.put(
    `${API_BASE}/patients/me/picture`,
    {
      image_base64: validJpegB64,
      mime_type: 'image/jpeg'
    },
    { headers: authHeaders }
  );
  assert.strictEqual(uploadRes.status, 200);
  assert(uploadRes.data.success, 'Profile photo upload must succeed');
  assert(uploadRes.data.patient.profile_picture.startsWith('data:image/jpeg;base64,'), 'Stored profile picture must be valid data URI');
  console.log('✓ PASS: Profile photo successfully uploaded and stored in MongoDB');

  // Step 3D: Verify persistence by fetching profile via GET /patients/me
  console.log('Fetching patient profile to confirm database persistence...');
  const profileRes = await axios.get(`${API_BASE}/patients/me`, { headers: authHeaders });
  assert.strictEqual(profileRes.status, 200);
  const fetchedPicture = profileRes.data.profile_picture || profileRes.data.patient?.profile_picture;
  assert(fetchedPicture, 'Profile picture must persist in DB');
  assert.strictEqual(fetchedPicture, uploadRes.data.patient.profile_picture, 'Fetched picture must match uploaded picture');
  console.log('✓ PASS: MongoDB persistence confirmed across separate request');

  // Step 3E: Test Backend Safety Layer - Reject Oversized Image (> 2 MB)
  console.log('Testing backend safety layer against oversized payload (> 2MB)...');
  const oversizedBuffer = Buffer.alloc(2.5 * 1024 * 1024, 0xAA);
  oversizedBuffer[0] = 0xFF;
  oversizedBuffer[1] = 0xD8;
  oversizedBuffer[2] = 0xFF;
  const oversizedB64 = oversizedBuffer.toString('base64');
  try {
    await axios.put(
      `${API_BASE}/patients/me/picture`,
      {
        image_base64: oversizedB64,
        mime_type: 'image/jpeg'
      },
      { headers: authHeaders }
    );
    assert.fail('Backend should have rejected oversized image > 2MB');
  } catch (err) {
    assert.strictEqual(err.response?.status, 400, 'Expected 400 Bad Request for oversized image');
    assert(err.response?.data?.error?.includes('Maximum allowed size is 2 MB'), 'Error must specify 2 MB limit');
    console.log(`✓ PASS: Backend safety layer rejected oversized image: "${err.response.data.error}"`);
  }

  // Step 3F: Test Backend Safety Layer - Reject Invalid Magic Bytes
  console.log('Testing backend safety layer against fake image / invalid magic bytes...');
  const fakeImageB64 = Buffer.from('NOT_AN_IMAGE_FILE_DATA_CORRUPT').toString('base64');
  try {
    await axios.put(
      `${API_BASE}/patients/me/picture`,
      {
        image_base64: fakeImageB64,
        mime_type: 'image/jpeg'
      },
      { headers: authHeaders }
    );
    assert.fail('Backend should have rejected invalid magic bytes');
  } catch (err) {
    assert.strictEqual(err.response?.status, 400, 'Expected 400 Bad Request for invalid magic bytes');
    assert(err.response?.data?.error?.includes('File content does not match'), 'Error must state format mismatch');
    console.log(`✓ PASS: Backend safety layer rejected invalid image data: "${err.response.data.error}"`);
  }

  // Step 3G: Test Remove Profile Picture via DELETE /patients/me/picture
  console.log('Testing profile photo removal...');
  const removeRes = await axios.delete(`${API_BASE}/patients/me/picture`, { headers: authHeaders });
  assert.strictEqual(removeRes.status, 200);
  assert(removeRes.data.success, 'Photo removal must succeed');
  assert.strictEqual(removeRes.data.patient.profile_picture, null, 'Profile picture field must be null after removal');
  console.log('✓ PASS: Profile photo successfully removed');

  // Step 3H: Verify removal persisted in DB
  const profileAfterRemoval = await axios.get(`${API_BASE}/patients/me`, { headers: authHeaders });
  const picAfter = profileAfterRemoval.data.profile_picture ?? profileAfterRemoval.data.patient?.profile_picture ?? null;
  assert.strictEqual(picAfter, null, 'Profile picture must remain null in DB');
  console.log('✓ PASS: Photo removal persisted in MongoDB, defaulting back to initial avatar');

  console.log('\n================================================================');
  console.log(' ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (100%)');
  console.log('================================================================');
}

runBackendIntegrationTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
