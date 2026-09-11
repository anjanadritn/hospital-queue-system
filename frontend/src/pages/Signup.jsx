import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HeartPulse, User, Phone, Mail, Lock, ShieldCheck, AlertCircle, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';

export default function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await hospitalApi.sendAuthOtp(phone.trim(), 'ACCOUNT_VERIFICATION');
      setOtpSent(true);
      if (res.development_otp) {
        setDevOtp(res.development_otp);
        setOtpInput(res.development_otp);
      }
    } catch (err) {
      console.error('OTP Send Error:', err);
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to send verification OTP';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!otpInput || otpInput.length !== 6) {
      setError('Please enter the 6-digit OTP code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await hospitalApi.registerPatient({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password: password,
        otp: otpInput.trim()
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      console.error('Registration Error:', err);
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Account registration failed. Check OTP.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
      <div className="bg-white rounded-3xl p-6 sm:p-10 max-w-md w-full border border-slate-200/80 shadow-xl relative overflow-hidden">
        
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-tr from-sky-600 to-teal-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-3 shadow-md">
            <HeartPulse className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Create Patient Account
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Mandatory Phone Verification Required</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Phone Number Verified!</h3>
            <p className="text-xs text-slate-500">Account created with status VERIFIED. Redirecting to login...</p>
          </div>
        ) : !otpSent ? (
          /* STEP 1: ACCOUNT DETAILS & SEND OTP */
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Mandatory Verification)</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-md transition focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2 mt-6"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Verification OTP'}
            </button>
          </form>
        ) : (
          /* STEP 2: VERIFY PHONE OTP */
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100 text-center mb-4">
              <span className="text-xs font-semibold text-slate-600 block">OTP Sent to Phone</span>
              <span className="text-base font-bold text-sky-900">{phone}</span>
              {devOtp && (
                <span className="text-[11px] font-mono text-emerald-700 font-bold block mt-1">
                  Development OTP: {devOtp}
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                Enter 6-Digit Phone Verification OTP
              </label>
              <input
                type="text"
                maxLength={6}
                required
                autoFocus
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full text-center py-3 text-2xl font-mono font-extrabold tracking-[0.3em] bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 focus:bg-white focus:border-sky-600 focus:outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpInput.length !== 6}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-2xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify Phone & Create Account'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center border-t border-slate-100 pt-6">
          <p className="text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-extrabold text-sky-600 hover:text-sky-700">
              Login here
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
