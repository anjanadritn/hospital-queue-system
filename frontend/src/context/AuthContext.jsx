import React, { createContext, useContext, useState, useEffect } from 'react';
import { hospitalApi } from '../api/hospitalApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('access_token') || localStorage.getItem('smart_hospital_token'));
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage & validate JWT with GET /auth/me on startup
  const restoreSession = async () => {
    const savedToken = localStorage.getItem('access_token') || localStorage.getItem('smart_hospital_token');
    
    if (!savedToken) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Validate JWT with backend GET /auth/me
      const userData = await hospitalApi.getCurrentUser();
      setUser(userData);
      setToken(savedToken);
      setIsAuthenticated(true);
    } catch (err) {
      console.warn('Session restoration failed (Token expired or invalid):', err);
      // Expired or invalid JWT token -> Clear session
      localStorage.removeItem('access_token');
      localStorage.removeItem('smart_hospital_token');
      localStorage.removeItem('smart_hospital_user');
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    restoreSession();
  }, []);

  // Login handler storing access_token in localStorage & fetching canonical user
  const login = async (newToken, initialUserData) => {
    localStorage.setItem('access_token', newToken);
    localStorage.setItem('smart_hospital_token', newToken);
    setToken(newToken);

    try {
      const canonicalUser = await hospitalApi.getCurrentUser();
      setUser(canonicalUser);
      localStorage.setItem('smart_hospital_user', JSON.stringify(canonicalUser));
    } catch (e) {
      setUser(initialUserData);
      if (initialUserData) {
        localStorage.setItem('smart_hospital_user', JSON.stringify(initialUserData));
      }
    }

    setIsAuthenticated(true);
    setIsLoading(false);
  };

  // Explicit logout handler
  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('smart_hospital_token');
    localStorage.removeItem('smart_hospital_user');
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
