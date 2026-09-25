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
  const [token, setToken] = useState(() => safeStorage.getItem('access_token') || safeStorage.getItem('smart_hospital_token'));
  const [user, setUser] = useState(() => {
    const cached = safeStorage.getItem('smart_hospital_user');
    if (cached) {
      try { return JSON.parse(cached); } catch (_) { return null; }
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
      if (userData) {
        setUser(userData);
        setToken(savedToken);
        setIsAuthenticated(true);
        safeStorage.setItem('smart_hospital_user', JSON.stringify(userData));
      }
    } catch (err) {
      console.warn('Session restoration background check note:', err?.message || err);
      // Only clear if 401 unauthorized was returned by server
      if (err?.response?.status === 401) {
        safeStorage.removeItem('access_token');
        safeStorage.removeItem('smart_hospital_token');
        safeStorage.removeItem('smart_hospital_user');
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
      setUser(canonicalUser);
      safeStorage.setItem('smart_hospital_user', JSON.stringify(canonicalUser));
    } catch (e) {
      setUser(initialUserData);
      if (initialUserData) {
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
