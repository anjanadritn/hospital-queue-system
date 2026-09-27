import axios from 'axios';

const resolveApiBaseUrl = () => {
  const envUrl = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) ||
    ''
  ).trim();

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

    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/\/+$/, '');
    }

    return 'https://hospital-queue-system-oqz8.onrender.com';
  }

  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'https://hospital-queue-system-oqz8.onrender.com';
};

const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname || '';
      const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.endsWith('.local');

      if (!isLocalhost && config.baseURL && (config.baseURL.includes('localhost') || config.baseURL.includes('127.0.0.1'))) {
        const envUrl = (
          (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
          (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
          (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) ||
          ''
        ).trim();
        config.baseURL = (envUrl && !envUrl.includes('localhost'))
          ? envUrl.replace(/\/+$/, '')
          : 'https://hospital-queue-system-oqz8.onrender.com';
      }
    }

    const token =
      localStorage.getItem('access_token') ||
      localStorage.getItem('smart_hospital_token') ||
      localStorage.getItem('hospital_jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('hospital_jwt_token');
      localStorage.removeItem('hospital_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
