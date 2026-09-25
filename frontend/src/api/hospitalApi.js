import axios from 'axios';

const resolveApiBaseUrl = () => {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim();

  // In browser environments:
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || '';
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local');

    if (isLocalhost) {
      return (envUrl || 'http://localhost:5000').replace(/\/+$/, '');
    }

    // In production (such as *.vercel.app or custom domain):
    // Only use envUrl if it is a real non-localhost URL (e.g. https://api.myhospital.com)
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/\/+$/, '');
    }

    // Default to relative /api for production so Vercel can proxy/route it
    return '/api';
  }

  // Non-browser / SSR fallback:
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'http://localhost:5000';
};

const API_BASE_URL = resolveApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Safe storage access for Axios interceptors
const safeGetToken = () => {
  try {
    return typeof window !== 'undefined' ? (localStorage.getItem('access_token') || localStorage.getItem('smart_hospital_token')) : null;
  } catch (e) {
    return null;
  }
};

const safeClearTokens = () => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('smart_hospital_token');
      localStorage.removeItem('smart_hospital_user');
    }
  } catch (e) {}
};

// Add JWT Token Interceptor using access_token key & ensure production never hits localhost
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || '';
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local');

    if (!isLocalhost && config.baseURL && (config.baseURL.includes('localhost') || config.baseURL.includes('127.0.0.1'))) {
      config.baseURL = '/api';
    }
  }

  const token = safeGetToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Response interceptor to handle 401 session expiration and error normalization
apiClient.interceptors.response.use(
  (response) => {
    if (response?.data && typeof response.data === 'object' && response.data.error && response.data.success === false) {
      const err = new Error(
        typeof response.data.error === 'string'
          ? response.data.error
          : (response.data.error?.message || 'Request failed')
      );
      err.response = response;
      return Promise.reject(err);
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      safeClearTokens();
    }
    return Promise.reject(error);
  }
);

export const hospitalApi = {
  // 1. Health
  getHealth: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  // 2. Authentication & Phone OTP
  sendAuthOtp: async (phone, purpose = 'ACCOUNT_VERIFICATION') => {
    const response = await apiClient.post('/auth/send-otp', { phone, purpose });
    return response.data;
  },
  verifyAuthOtp: async (phone, otp, purpose = 'ACCOUNT_VERIFICATION') => {
    const response = await apiClient.post('/auth/verify-otp', { phone, otp, purpose });
    return response.data;
  },
  registerPatient: async (payload) => {
    const response = await apiClient.post('/auth/register', payload);
    return response.data;
  },
  loginUser: async (phone, password, role = 'patient') => {
    const response = await apiClient.post('/auth/login', { phone, password, role });
    return response.data;
  },
  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
  forgotPassword: async (phone) => {
    const response = await apiClient.post('/auth/forgot-password', { phone });
    return response.data;
  },
  resetPassword: async (phone, otp, newPassword) => {
    const response = await apiClient.post('/auth/reset-password', { phone, otp, new_password: newPassword });
    return response.data;
  },

  // 3. Doctors
  getDoctors: async (department = '') => {
    const response = await apiClient.get(`/doctors${department ? `?department=${encodeURIComponent(department)}` : ''}`);
    return response.data;
  },
  getDoctor: async (doctorId) => {
    const response = await apiClient.get(`/doctors/${doctorId}`);
    return response.data;
  },
  getDoctorReviews: async (doctorId) => {
    const response = await apiClient.get(`/doctors/${doctorId}/reviews`);
    return response.data;
  },
  submitDoctorReview: async (doctorId, reviewData) => {
    const response = await apiClient.post(`/doctors/${doctorId}/reviews`, reviewData);
    return response.data;
  },

  // 4. Symptoms
  getSymptoms: async () => {
    const response = await apiClient.get('/symptoms');
    return response.data;
  },
  searchSymptoms: async (query) => {
    const response = await apiClient.get(`/symptoms/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // 5. Appointments & Advance Booking
  bookAppointment: async (payload) => {
    const response = await apiClient.post('/appointments/book', payload);
    return response.data;
  },
  getAppointment: async (bookingId) => {
    const response = await apiClient.get(`/appointments/${bookingId}`);
    return response.data;
  },
  getPatientAppointments: async (patientId) => {
    const response = await apiClient.get(`/appointments/patient/${patientId}`);
    return response.data;
  },
  getMyMedicalHistory: async () => {
    const response = await apiClient.get('/patients/me/history');
    return response.data;
  },
  updateMyProfile: async (payload) => {
    const response = await apiClient.put('/patients/me', payload);
    return response.data;
  },
  getConsultationRecord: async (consultationId) => {
    const response = await apiClient.get(`/patients/records/${consultationId}`);
    return response.data;
  },
  getPatientHistory: async (patientId) => {
    const response = await apiClient.get(`/patients/${patientId}/history`);
    return response.data;
  },
  getMyPatientProfile: async () => {
    const response = await apiClient.get('/patients/me');
    return response.data;
  },
  uploadProfilePicture: async (imageDataUri, mimeType = 'image/jpeg') => {
    // Accepts a data-URI string (e.g. from FileReader.readAsDataURL)
    // Sends as base64 JSON to backend for validation and storage
    const b64 = imageDataUri.includes(',') ? imageDataUri.split(',')[1] : imageDataUri;
    const response = await apiClient.put('/patients/me/picture', {
      image_base64: b64,
      mime_type: mimeType,
    });
    return response.data;
  },
  getPatientProfile: async (patientId) => {
    const response = await apiClient.get(`/patients/${patientId}`);
    return response.data;
  },
  updatePatientProfile: async (patientId, payload) => {
    const response = await apiClient.put(`/patients/${patientId}`, payload);
    return response.data;
  },
  arriveAtHospital: async (queueOrBookingId) => {
    const response = await apiClient.post(`/queue/${queueOrBookingId}/arrive`);
    return response.data;
  },

  // 6. Consultation Verification OTP (Patient & Doctor)
  generateConsultationOtp: async (bookingId, patientId, doctorId) => {
    if (!patientId || !doctorId) {
      throw new Error("Patient ID and Doctor ID are required for consultation OTP generation");
    }
    const response = await apiClient.post(`/consultation/${bookingId}/generate-otp`, { patient_id: patientId, doctor_id: doctorId });
    return response.data;
  },
  getOtpStatus: async (bookingId) => {
    const response = await apiClient.get(`/consultation/${bookingId}/otp-status`);
    return response.data;
  },
  verifyConsultationOtp: async (bookingId, otpCode) => {
    const response = await apiClient.post(`/doctor/consultation/${bookingId}/verify-otp`, { otp: otpCode });
    return response.data;
  },
  completeConsultation: async (bookingId, actualDurationMins = 15) => {
    const response = await apiClient.post(`/doctor/consultation/${bookingId}/complete`, { actual_duration_mins: actualDurationMins });
    return response.data;
  },

  // 7. Queue Engine
  joinQueue: async (payload) => {
    const response = await apiClient.post('/queue/join', payload);
    return response.data;
  },
  getQueueStatus: async (queueId) => {
    const response = await apiClient.get(`/queue/status/${queueId}`);
    return response.data;
  },
  getMyActiveQueue: async () => {
    const response = await apiClient.get('/queue/my');
    return response.data;
  },
  getAllQueues: async (department = '') => {
    const response = await apiClient.get(`/queue/all${department ? `?department=${encodeURIComponent(department)}` : ''}`);
    return response.data;
  },
  getDoctorQueue: async (doctorId) => {
    const response = await apiClient.get(`/queue/doctor/${doctorId}`);
    return response.data;
  },
  escalateEmergency: async (queueId) => {
    const response = await apiClient.post('/queue/emergency', { queue_id: queueId });
    return response.data;
  },
  callPatient: async (queueId) => {
    const response = await apiClient.post(`/queue/${queueId}/call`);
    return response.data;
  },
  startConsultation: async (queueId) => {
    const response = await apiClient.post(`/queue/${queueId}/start`);
    return response.data;
  },
  completeQueueToken: async (queueId, payload = {}) => {
    const response = await apiClient.post(`/queue/${queueId}/complete`, payload);
    return response.data;
  },
  skipQueueToken: async (queueId) => {
    const response = await apiClient.post(`/queue/${queueId}/skip`);
    return response.data;
  },
  cancelQueueToken: async (queueId) => {
    const response = await apiClient.post(`/queue/${queueId}/cancel`);
    return response.data;
  },
  markNoShow: async (queueId) => {
    const response = await apiClient.post(`/queue/${queueId}/no-show`);
    return response.data;
  },

  // 8. ML Prediction & Analytics
  predictWaitTime: async (payload) => {
    const response = await apiClient.post('/predict', payload);
    return response.data;
  },
  getAnalytics: async () => {
    const response = await apiClient.get('/analytics');
    return response.data;
  },

  // 9. Notifications
  getNotifications: async (patientId) => {
    const response = await apiClient.get(`/notifications/${patientId}`);
    return response.data;
  },
  markNotificationRead: async (notificationId) => {
    const response = await apiClient.post(`/notifications/${notificationId}/read`);
    return response.data;
  },
  markAllNotificationsRead: async (patientId) => {
    const response = await apiClient.post(`/notifications/patient/${patientId}/read-all`);
    return response.data;
  },

  // 10. Departments
  getDepartments: async () => {
    const response = await apiClient.get('/departments');
    return response.data;
  },
  getDepartment: async (deptId) => {
    const response = await apiClient.get(`/departments/${deptId}`);
    return response.data;
  },
  createDepartment: async (payload) => {
    const response = await apiClient.post('/departments', payload);
    return response.data;
  },

  // 11. Smart Travel & Departure Calculation
  calculateTravelDeparture: async (payload) => {
    const formattedPayload = {
      ...payload,
      origin_mode: payload.origin_mode || (payload.location_source === 'preset' ? 'preset' : (payload.origin_latitude ? 'gps' : 'preset')),
      origin_lat: payload.origin_lat !== undefined ? payload.origin_lat : payload.origin_latitude,
      origin_lng: payload.origin_lng !== undefined ? payload.origin_lng : payload.origin_longitude,
      origin_label: payload.origin_label || payload.origin || payload.patient_address,
    };
    const response = await apiClient.post('/travel/calculate', formattedPayload);
    return response.data;
  },

  // 12. Admin & System Management
  getAdminStats: async () => {
    const response = await apiClient.get('/admin/stats');
    return response.data;
  },
  getAdminUsers: async () => {
    const response = await apiClient.get('/admin/users');
    return response.data;
  },
  adminCreateDoctor: async (payload) => {
    const response = await apiClient.post('/admin/doctors', payload);
    return response.data;
  },
  verifyArrivalOtp: async (tokenOrBookingId, otp) => {
    const response = await apiClient.post('/queue/verify-arrival-otp', {
      token_or_booking_id: tokenOrBookingId,
      otp,
    });
    return response.data;
  },
  getAdminAppointments: async () => {
    const response = await apiClient.get('/admin/appointments');
    return response.data;
  },
  getAdminPatients: async (query = '') => {
    const response = await apiClient.get(`/admin/patients${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    return response.data;
  },
  adminSearchPatients: async (query = '') => {
    const response = await apiClient.get(`/admin/patients${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    return response.data;
  },
  adminGetPatientRecords: async (patientId) => {
    const response = await apiClient.get(`/admin/patients/${patientId}/records`);
    return response.data;
  },

  // 13. Consultation Slots, Public Live Queue & Patient Departure
  getSlotAvailability: async (date = '', doctorId = '', department = '') => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (doctorId) params.append('doctor_id', doctorId);
    if (department) params.append('department', department);
    const queryString = params.toString();
    const response = await apiClient.get(`/appointments/slots${queryString ? `?${queryString}` : ''}`);
    return response.data;
  },
  getPublicQueue: async (department = '', slotId = '', doctorId = '', date = '') => {
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (slotId) params.append('slot_id', slotId);
    if (doctorId) params.append('doctor_id', doctorId);
    if (date) params.append('date', date);
    const queryString = params.toString();
    const response = await apiClient.get(`/queue/public${queryString ? `?${queryString}` : ''}`);
    return response.data;
  },
  confirmLeavingNow: async (queueId, coords = null) => {
    const payload = {};
    if (coords && coords.length === 2) {
      payload.origin_longitude = coords[0];
      payload.origin_latitude = coords[1];
    }
    const response = await apiClient.post(`/queue/${queueId}/leave-now`, payload);
    return response.data;
  },
  getAdminSlotAnalytics: async (date = '') => {
    const response = await apiClient.get(`/admin/slots${date ? `?date=${encodeURIComponent(date)}` : ''}`);
    return response.data;
  },
  evaluateQueueReminders: async () => {
    const response = await apiClient.post('/queue/evaluate-reminders');
    return response.data;
  },
  searchLocations: async (query) => {
    const response = await apiClient.get(`/location/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },
  reverseGeocode: async (lat, lon) => {
    const response = await apiClient.get(`/location/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
    return response.data;
  },
  uploadProfilePicture: async (imageDataUri, mimeType) => {
    const response = await apiClient.put('/patients/me/picture', {
      image_base64: imageDataUri,
      mime_type: mimeType
    });
    return response.data;
  },

  // 14. Change Password (authenticated patient)
  changePassword: async (payload) => {
    const response = await apiClient.post('/auth/change-password', payload);
    return response.data;
  }
};

