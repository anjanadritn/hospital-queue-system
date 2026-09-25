import React, { createContext, useContext, useState, useEffect } from 'react';
import { hospitalApi } from '../api/hospitalApi';

const AuthContext = createContext(null);

const safeStorage = {
  getItem: (key) => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  },
  setItem: (key, val) => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem(key, val);
    } catch (e) {}
  },
  removeItem: (key) => {
    try {
      if (typeof window !== 'undefined') localStorage.removeItem(key);
    } catch (e) {}
  }
};

export function AuthProvider({ children }) {
  const isValidUser = (u) => {
    return Boolean(u && typeof u === 'object' && !u.error && !u.code && (u.user_id || u.phone || u.role || u.email || u.id));
  };

  const safeClearTokens = () => {
    safeStorage.removeItem('access_token');
    safeStorage.removeItem('smart_hospital_token');
    safeStorage.removeItem('smart_hospital_user');
  };

  const [token, setToken] = useState(() => safeStorage.getItem('access_token') || safeStorage.getItem('smart_hospital_token'));
  const [user, setUser] = useState(() => {
    const cached = safeStorage.getItem('smart_hospital_user');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (isValidUser(parsed)) return parsed;
      } catch (_) { return null; }
    }
    return null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(safeStorage.getItem('access_token') || safeStorage.getItem('smart_hospital_token')));
  const [isLoading, setIsLoading] = useState(false);

  // Restore session from localStorage & validate JWT in background without blocking initial render
  const restoreSession = async () => {
    const savedToken = safeStorage.getItem('access_token') || safeStorage.getItem('smart_hospital_token');
    
    if (!savedToken) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    try {
      // Race validation with a 3.5 second timeout so a disconnected/slow backend NEVER blocks rendering
      const fetchPromise = hospitalApi.getCurrentUser();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session validation timeout')), 3500)
      );
      const userData = await Promise.race([fetchPromise, timeoutPromise]);
      if (isValidUser(userData)) {
        setUser(userData);
        setToken(savedToken);
        setIsAuthenticated(true);
        safeStorage.setItem('smart_hospital_user', JSON.stringify(userData));
      } else if (userData && (userData.error || userData.code)) {
        // Discard error responses returned from API
        console.warn('Session restoration received error payload:', userData);
        safeClearTokens();
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.warn('Session restoration background check note:', err?.message || err);
      // Only clear if 401 unauthorized was returned by server
      if (err?.response?.status === 401) {
        safeClearTokens();
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    restoreSession();
  }, []);

  // Login handler storing access_token in localStorage & fetching canonical user
  const login = async (newToken, initialUserData) => {
    safeStorage.setItem('access_token', newToken);
    safeStorage.setItem('smart_hospital_token', newToken);
    setToken(newToken);

    try {
      const canonicalUser = await hospitalApi.getCurrentUser();
      if (isValidUser(canonicalUser)) {
        setUser(canonicalUser);
        safeStorage.setItem('smart_hospital_user', JSON.stringify(canonicalUser));
      } else if (isValidUser(initialUserData)) {
        setUser(initialUserData);
        safeStorage.setItem('smart_hospital_user', JSON.stringify(initialUserData));
      }
    } catch (e) {
      if (isValidUser(initialUserData)) {
        setUser(initialUserData);
        safeStorage.setItem('smart_hospital_user', JSON.stringify(initialUserData));
      }
    }

    setIsAuthenticated(true);
    setIsLoading(false);
  };

  // Explicit logout handler
  const logout = () => {
    safeStorage.removeItem('access_token');
    safeStorage.removeItem('smart_hospital_token');
    safeStorage.removeItem('smart_hospital_user');
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setIsLoading(false);
  };

  const refreshUser = async () => {
    try {
      const canonicalUser = await hospitalApi.getCurrentUser();
      setUser(canonicalUser);
    } catch (e) {
      console.warn('Failed to refresh user:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
