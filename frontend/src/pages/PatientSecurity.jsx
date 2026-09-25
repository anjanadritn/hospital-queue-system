import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Calendar,
  User,
  ShieldCheck,
  Key,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  ArrowLeft,
  Save,
  Smartphone
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function PatientSecurity() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    setSaving(true);
    try {
      await hospitalApi.changePassword({
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword
      });
      setSuccessMsg('Password updated successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update password. Please check your current password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        {/* Page Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl">
          <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full text-xs font-bold border border-sky-400/30">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Account Security</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Account &amp; Security
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                Manage your login credentials and account security settings.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <Link
                to="/patient"
                className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs transition flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-xs font-bold scrollbar-thin">
          <Link
            to="/patient"
            className="px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          >
            Overview &amp; Live Token
          </Link>
          <Link
            to="/patient/history"
            className="px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-teal-600" />
            <span>{t('my_medical_history')}</span>
          </Link>
          <Link
            to="/patient/appointments"
            className="px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{t('appointment_bookings', 'Appointment Bookings')}</span>
          </Link>
          <Link
            to="/patient/profile"
            className="px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5"
          >
            <User className="w-3.5 h-3.5" />
            <span>{t('my_profile')}</span>
          </Link>
          <span className="px-4 py-2.5 rounded-xl shrink-0 bg-sky-600 text-white shadow-xs flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Account &amp; Security</span>
          </span>
        </div>

        {/* Security Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* Account Summary Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-sky-600" />
                Account Overview
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Your registered account details at SIMSRH</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500 font-semibold flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" /> Full Name
                </span>
                <span className="font-bold text-slate-900">{user?.name || '—'}</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500 font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-400" /> Patient ID
                </span>
                <span className="font-mono font-bold text-sky-700">{user?.patient_id || '—'}</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500 font-semibold flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-slate-400" /> Phone
                </span>
                <span className="font-mono font-bold text-slate-900">{user?.phone || '—'}</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500 font-semibold flex items-center gap-2">
                  <Key className="w-4 h-4 text-slate-400" /> Account Role
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 capitalize">
                  {user?.role || 'patient'}
                </span>
              </div>
            </div>

            {/* Security Status */}
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-2.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Security Status
              </span>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold">JWT Authentication</span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Active
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold">OTP Verification</span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Enabled
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold">Encrypted Storage</span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Secured
                </span>
              </div>
            </div>
          </div>

          {/* Change Password Form */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-sky-600" />
                Change Password
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Update your login password for enhanced security</p>
            </div>

            {successMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 shadow-xs">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-bold">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
              {/* Current Password */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Current Password *</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder="Enter your current password"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Password *</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordForm.newPassword.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className={`h-1 flex-1 rounded-full transition-all ${
                      passwordForm.newPassword.length < 6 ? 'bg-rose-300' :
                      passwordForm.newPassword.length < 10 ? 'bg-amber-400' : 'bg-emerald-500'
                    }`} />
                    <span className={`text-[10px] font-bold ${
                      passwordForm.newPassword.length < 6 ? 'text-rose-600' :
                      passwordForm.newPassword.length < 10 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {passwordForm.newPassword.length < 6 ? 'Too Short' :
                       passwordForm.newPassword.length < 10 ? 'Fair' : 'Strong'}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Confirm New Password *</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Re-enter new password"
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none transition pr-10 ${
                      passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword
                        ? 'border-rose-300 focus:border-rose-500'
                        : passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword
                          ? 'border-emerald-300 focus:border-emerald-500'
                          : 'border-slate-200 focus:border-sky-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                  <p className="text-[10px] text-rose-600 font-bold mt-1">Passwords do not match</p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 text-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Updating Password...' : 'Update Password'}</span>
                </button>
              </div>
            </form>

            {/* Security Tips */}
            <div className="p-4 bg-sky-50/60 rounded-2xl border border-sky-200 space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-800">Security Tips</span>
              <ul className="text-[11px] text-slate-600 space-y-1.5">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" /> Use at least 8 characters with numbers and symbols</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" /> Avoid using the same password across services</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" /> Never share your credentials with hospital staff</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
