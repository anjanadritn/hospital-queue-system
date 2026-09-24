import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HeartPulse, Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // 1. Session Restoration Screen (while checking GET /auth/me)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center p-8 bg-white rounded-3xl border border-slate-200/80 shadow-xl max-w-sm w-full">
          <div className="w-12 h-12 bg-gradient-to-tr from-sky-600 to-teal-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-md animate-pulse">
            <HeartPulse className="w-7 h-7" />
          </div>
          <div className="flex items-center justify-center gap-2 text-sky-600 font-bold text-sm mb-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Restoring your secure session...</span>
          </div>
          <p className="text-xs text-slate-400 font-medium">Verifying encrypted JWT identity with Flask backend</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated -> Redirect to Login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Role Check -> Redirect if Unauthorized Role
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const fallbackPath = user.role === 'patient' ? '/patient' : '/staff';
    return <Navigate to={fallbackPath} replace />;
  }

  // 4. Authenticated & Authorized -> Render Requested Page
  return children;
}
