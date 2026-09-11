import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { HeartPulse, Lock, Phone, AlertCircle, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [role, setRole] = useState('patient');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);
    // Don't auto-fill credentials - users must enter their own
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (import.meta.env.DEV) {
        console.log(`[AUTH DEBUG] Login request sent | Phone: ${phone.trim()} | Role: ${role}`);
      }

      const res = await hospitalApi.loginUser(phone.trim(), password, role);
      if (res.token) {
        await login(res.token, res.user);
        
        // Preserve target route or redirect based on role
        const fromPath = location.state?.from?.pathname;
        const defaultTarget = res.user.role === 'patient' ? '/patient' : '/staff';
        navigate(fromPath || defaultTarget, { replace: true });
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`[AUTH DEBUG] Login failed | Phone: ${phone.trim()} | Status: ${err.response?.status || 'Network Error'}`);
      }
      console.error(err);
      setError(err.response?.data?.error || 'Invalid phone number or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
      <div className="bg-white rounded-3xl p-6 sm:p-10 max-w-md w-full border border-slate-200/80 shadow-xl relative overflow-hidden">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-tr from-sky-600 to-teal-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-3 shadow-md">
            <HeartPulse className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            SMART<span className="text-sky-600">HOSPITAL</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Smarter queues. Less waiting. Better care.</p>
        </div>

        {/* Role Selector */}
        <div className="mb-6">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
            Select Role to Access
          </label>
          <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
            {['patient', 'doctor', 'admin'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleChange(r)}
                className={`py-2 text-xs font-bold rounded-xl capitalize transition ${
                  role === r ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">{error}</span>
              {error.includes("Invalid phone number") && (
                <span className="text-[11px] text-rose-600 block mt-1">
                  New patients must create an account and verify their phone number first.
                </span>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit registered phone number"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-700">Password</label>
              <Link to="/forgot-password" className="text-[11px] font-bold text-sky-600 hover:text-sky-700">
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-md transition focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2 mt-6"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Login to Dashboard'}
          </button>
        </form>

        {/* Signup Link */}
        {role === 'patient' ? (
          <div className="mt-8 text-center border-t border-slate-100 pt-6">
            <p className="text-xs text-slate-500 mb-2">New patient looking to book a consultation?</p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-600 hover:text-sky-700"
            >
              <span>Create Patient Account & Verify Phone</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="mt-6 text-center text-[11px] text-slate-400 border-t border-slate-100 pt-4">
            * Note: Doctor & Admin accounts are provisioned securely by Hospital Administration.
          </div>
        )}

      </div>
    </div>
  );
}
