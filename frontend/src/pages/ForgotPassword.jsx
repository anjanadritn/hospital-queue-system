import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HeartPulse, Phone, Lock, AlertCircle, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useLanguage } from '../context/LanguageContext';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const normalizePhoneInput = (val) => {
    if (!val) return '';
    const digits = val.replace(/\D/g, '');
    if (digits.startsWith('0091') && digits.length >= 14) return digits.slice(4);
    if (digits.startsWith('91') && digits.length > 10) return digits.slice(2);
    if (digits.startsWith('0') && digits.length === 11) return digits.slice(1);
    if (digits.length > 10) return digits.slice(-10);
    return digits;
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    const cleanPhone = normalizePhoneInput(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      setError(t('invalid_phone_error', 'Please enter a valid 10-digit phone number'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await hospitalApi.forgotPassword(cleanPhone);
      setOtpSent(true);
      if (res.development_otp) {
        setDevOtp(res.development_otp);
        setOtpInput(res.development_otp);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || t('failed_send_otp', 'Failed to send password reset OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otpInput || otpInput.length !== 6) {
      setError(t('enter_6_digit_otp_error', 'Please enter the 6-digit OTP code'));
      return;
    }

    const cleanPhone = normalizePhoneInput(phone);
    setLoading(true);
    setError(null);

    try {
      await hospitalApi.resetPassword(cleanPhone || phone.trim(), otpInput.trim(), newPassword);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || t('pass_reset_failed', 'Password reset failed'));
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
            {t('reset_password_title', 'Reset Password')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('reset_password_subtitle', 'Phone Verification & Password Recovery')}
          </p>
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
            <h3 className="text-lg font-bold text-slate-900 mb-1">{t('password_reset_success', 'Password Reset Successfully!')}</h3>
            <p className="text-xs text-slate-500">{t('redirecting_to_login', 'Redirecting to login page...')}</p>
          </div>
        ) : !otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('phone_number', 'Phone Number')}</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  required
                  maxLength={16}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('enter_registered_phone', 'Enter registered phone (10-digit or +91...)')}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2 mt-6 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('send_reset_otp', 'Send Reset OTP')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="bg-sky-50 p-3.5 rounded-2xl border border-sky-100 text-center mb-4 text-xs">
              <span className="text-slate-600 block">{t('otp_sent_to', { phone }, `Reset OTP sent to ${phone}`)}</span>
              {devOtp && (
                <span className="font-mono text-emerald-700 font-bold block mt-1">
                  {t('demo_autofilled_otp', { otp: devOtp }, `Development OTP: ${devOtp}`)}
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                {t('enter_otp', 'Enter 6-Digit OTP')}
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('new_password', 'New Password')}</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('password_placeholder', 'Enter new password')}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('hide_password', 'Hide password') : t('show_password', 'Show password')}
                  className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-md transition focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otpInput.length !== 6}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-2xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('reset_password_and_save', 'Reset Password & Save')}
            </button>
          </form>
        )}

        <div className="mt-8 text-center border-t border-slate-100 pt-6">
          <Link to="/login" className="text-xs font-bold text-slate-600 hover:text-slate-900">
            {t('back_to_login', 'Back to Login')}
          </Link>
        </div>

      </div>
    </div>
  );
}
