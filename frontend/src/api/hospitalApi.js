import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Add JWT Token Interceptor using access_token key
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('smart_hospital_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Response interceptor to handle 401 session expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear invalid/expired token on 401
      localStorage.removeItem('access_token');
      localStorage.removeItem('smart_hospital_token');
      localStorage.removeItem('smart_hospital_user');
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
  arriveAtHospital: async (queueOrBookingId) => {
    const response = await apiClient.post(`/queue/${queueOrBookingId}/arrive`);
    return response.data;
  },

  // 6. Consultation Verification OTP (Patient & Doctor)
  generateConsultationOtp: async (bookingId, patientId = 'P001', doctorId = 'D001') => {
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
  getAllQueues: async (department = '') => {
    const response = await apiClient.get(`/queue/all${department ? `?department=${encodeURIComponent(department)}` : ''}`);
    return response.data;
  },
  escalateEmergency: async (queueId) => {
    const response = await apiClient.post('/queue/emergency', { queue_id: queueId });
    return response.data;
  },

  // 8. ML Prediction
  predictWaitTime: async (payload) => {
    const response = await apiClient.post('/predict', payload);
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
  }
};
