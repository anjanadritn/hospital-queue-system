import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  HeartPulse,
  Lock,
  Phone,
  AlertCircle,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  ShieldCheck,
  Activity,
  Cpu,
  Users,
  Stethoscope,
  Pill,
  FlaskConical,
  MoreVertical
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { t } = useLanguage();

  // Parse role from URL query param with support for pharmacy and lab aliases
  const parseRoleParam = (param) => {
    if (!param) return 'patient';
    const p = String(param).toLowerCase();
    if (p === 'doctor') return 'doctor';
    if (p === 'admin') return 'admin';
    if (p === 'pharmacy' || p === 'pharmacist') return 'pharmacist';
    if (p === 'lab' || p === 'laboratory' || p === 'lab_technician') return 'lab_technician';
    return 'patient';
  };

  const [role, setRole] = useState(() => {
    const params = new URLSearchParams(location.search);
    return parseRoleParam(params.get('role'));
  });

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [staffMenuOpen, setStaffMenuOpen] = useState(false);
  const staffMenuRef = useRef(null);

  // Close three-dot menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (staffMenuRef.current && !staffMenuRef.current.contains(e.target)) {
        setStaffMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync role if URL search param changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const parsed = parseRoleParam(params.get('role'));
    setRole(parsed);
    setError(null);
  }, [location.search]);

  const handleSelectRole = (targetRoleKey) => {
    setStaffMenuOpen(false);
    setError(null);
    if (targetRoleKey === 'patient') {
      navigate('/login?role=patient');
    } else if (targetRoleKey === 'doctor') {
      navigate('/login?role=doctor');
    } else if (targetRoleKey === 'admin') {
      navigate('/login?role=admin');
    } else if (targetRoleKey === 'pharmacy') {
      navigate('/login?role=pharmacy');
    } else if (targetRoleKey === 'lab') {
      navigate('/login?role=lab');
    }
  };

  const normalizePhoneInput = (val) => {
    if (!val) return '';
    const digits = val.replace(/\D/g, '');
    if (digits.startsWith('0091') && digits.length >= 14) return digits.slice(4);
    if (digits.startsWith('91') && digits.length > 10) return digits.slice(2);
    if (digits.startsWith('0') && digits.length === 11) return digits.slice(1);
    if (digits.length > 10) return digits.slice(-10);
    return digits;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanPhone = normalizePhoneInput(phone) || phone.trim();

    try {
      const res = await hospitalApi.loginUser(cleanPhone, password, role);
      if (res.token) {
        await login(res.token, res.user);

        // Auto-redirect strictly based on role
        let defaultTarget = res.redirect || '/patient';
        if (res.user?.role === 'admin') defaultTarget = '/admin';
        else if (res.user?.role === 'doctor') defaultTarget = '/doctor';
        else if (res.user?.role === 'pharmacist' || res.user?.role === 'pharmacy') defaultTarget = '/pharmacy';
        else if (res.user?.role === 'lab_technician' || res.user?.role === 'laboratory' || res.user?.role === 'lab') defaultTarget = '/laboratory';
        else defaultTarget = '/patient';

        navigate(defaultTarget, { replace: true });
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || t('invalid_credentials', 'Invalid phone number or password for selected role.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="max-w-6xl w-full bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        
        {/* LEFT COLUMN: Modern Healthcare Brand & Architecture Showcase (5 cols on large screens) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-950 via-sky-950 to-teal-950 p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Ambient Glows */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand Header */}
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-tr from-sky-500 to-teal-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                <HeartPulse className="w-7 h-7" />
              </div>
              <div>
                <span className="font-extrabold text-xl tracking-tight text-white block">
                  SMART<span className="text-sky-400">HOSPITAL</span>
                </span>
                <span className="text-[11px] text-teal-300 font-semibold uppercase tracking-wider block">
                  {t('brand_tagline', 'Clinical OPD & Queue Care')}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-400/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('enterprise_healthcare_platform', 'Enterprise Healthcare Platform')}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                {t('login_hero_title', 'Modern Patient Care & Smart Queue Intelligence')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {t('login_hero_desc', 'Connect seamlessly with OPD specialists, track consultation progress in real time, and receive AI-driven departure recommendations.')}
              </p>
            </div>

            {/* Key Feature Highlights with Mandated Colors */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-xs bg-white/5 p-3 rounded-2xl border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-400/30 shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-purple-200 block">{t('ai_wait_time_forecasting', 'AI Wait-Time Forecasting')}</span>
                  <span className="text-slate-400 text-[11px]">{t('rf_ml_queue_prediction', 'Random Forest ML queue latency prediction')}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs bg-white/5 p-3 rounded-2xl border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-400/30 shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-emerald-200 block">{t('tumkur_smart_transit_sync', 'Tumkur Smart Transit Sync')}</span>
                  <span className="text-slate-400 text-[11px]">{t('dynamic_departure_alerts', 'Dynamic departure alerts from Bus Stand & Batawadi')}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs bg-white/5 p-3 rounded-2xl border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center border border-sky-400/30 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-sky-200 block">{t('live_opd_token_journey', 'Live OPD Token Journey')}</span>
                  <span className="text-slate-400 text-[11px]">{t('doctor_calling_otp_triage', 'Doctor calling, 6-digit OTP verification & triage')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Academic Attribution Footer */}
          <div className="relative z-10 pt-6 mt-6 border-t border-white/10 text-xs text-slate-400 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="leading-tight">
              {t('academic_project_tag', 'Final-Year Engineering Project • Shridevi Institute of Engineering and Technology, Tumkur')}
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Authentication Console (7 cols on large screens) */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto space-y-6">
            
            {/* Top Bar with Three-Dot Staff Portal Menu (Top-Left) & Return to Patient Link */}
            <div className="flex items-center justify-between pb-1 -mt-2">
              <div className="relative" ref={staffMenuRef}>
                <button
                  type="button"
                  id="staff-portal-toggle"
                  onClick={() => setStaffMenuOpen((prev) => !prev)}
                  className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer flex items-center justify-center border border-transparent hover:border-slate-200"
                  aria-label="Staff & Hospital Portals"
                  title="Staff & Hospital Portals"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {staffMenuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Staff & Hospital Portals
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Clinical and administrative consoles
                      </span>
                    </div>

                    <div className="py-1 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => handleSelectRole('doctor')}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                          role === 'doctor' ? 'bg-sky-50 text-sky-800' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Stethoscope className="w-4 h-4 text-sky-600" />
                          <span>Doctor Login</span>
                        </span>
                        {role === 'doctor' && <span className="w-2 h-2 rounded-full bg-sky-600" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectRole('admin')}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                          role === 'admin' ? 'bg-purple-50 text-purple-800' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <ShieldCheck className="w-4 h-4 text-purple-600" />
                          <span>Admin Login</span>
                        </span>
                        {role === 'admin' && <span className="w-2 h-2 rounded-full bg-purple-600" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectRole('pharmacy')}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                          role === 'pharmacist' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Pill className="w-4 h-4 text-emerald-600" />
                          <span>Pharmacy Login</span>
                        </span>
                        {role === 'pharmacist' && <span className="w-2 h-2 rounded-full bg-emerald-600" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectRole('lab')}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                          role === 'lab_technician' ? 'bg-indigo-50 text-indigo-800' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <FlaskConical className="w-4 h-4 text-indigo-600" />
                          <span>Laboratory Login</span>
                        </span>
                        {role === 'lab_technician' && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                      </button>

                      <div className="pt-1 mt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleSelectRole('patient')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                            role === 'patient' ? 'bg-teal-50 text-teal-800' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <Users className="w-4 h-4 text-teal-600" />
                            <span>Patient Login</span>
                          </span>
                          {role === 'patient' && <span className="w-2 h-2 rounded-full bg-teal-600" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {role !== 'patient' && (
                <button
                  type="button"
                  onClick={() => handleSelectRole('patient')}
                  className="text-xs font-bold text-slate-500 hover:text-sky-600 transition flex items-center gap-1 cursor-pointer"
                >
                  <span>← Back to Patient Login</span>
                </button>
              )}
            </div>

            {/* Header Content */}
            <div>
              {role === 'patient' ? (
                <>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-teal-600 block mb-1">
                    Patient Care Portal
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Patient Sign In
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Enter your registered mobile phone number and password to access your health portal.
                  </p>
                </>
              ) : role === 'doctor' ? (
                <>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-extrabold border border-sky-200 mb-2">
                    <Stethoscope className="w-3.5 h-3.5 text-sky-600" />
                    <span>Doctor OPD Console</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Doctor Sign In
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Access clinical workstation, OPD live queues, and patient consultation records.
                  </p>
                </>
              ) : role === 'admin' ? (
                <>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-extrabold border border-purple-200 mb-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    <span>Hospital Administration</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Admin Operations Sign In
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Administrative clearance for hospital operations, department oversight, and staff management.
                  </p>
                </>
              ) : role === 'pharmacist' ? (
                <>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold border border-emerald-200 mb-2">
                    <Pill className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Pharmacy Dispensary</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Pharmacy Staff Sign In
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Fulfill clinical prescriptions, prepare medication packages, and update dispensing statuses.
                  </p>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-extrabold border border-indigo-200 mb-2">
                    <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Diagnostic Laboratory</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Laboratory Staff Sign In
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Manage diagnostic investigations, record specimen collections, and upload clinical reports.
                  </p>
                </>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1">
                  <span className="font-extrabold block">{t('authentication_notice', 'Authentication Notice')}</span>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('phone_number', 'Mobile Phone Number')}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    maxLength={16}
                    placeholder={t('phone_placeholder', 'Mobile number (10-digit or +91...)')}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">{t('password', 'Password')}</label>
                  <Link
                    to="/forgot-password"
                    className="text-[11px] font-bold text-sky-600 hover:text-sky-700 transition"
                  >
                    {t('forgot_password', 'Forgot Password?')}
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder={t('password_placeholder', 'Enter your account password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t('hide_password', 'Hide password') : t('show_password', 'Show password')}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 cursor-pointer pt-3 mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('authenticating_account', 'Authenticating Account...')}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {role === 'patient'
                        ? 'Sign In as Patient'
                        : role === 'doctor'
                          ? 'Sign In as Doctor'
                          : role === 'admin'
                            ? 'Sign In as Admin'
                            : role === 'pharmacist'
                              ? 'Sign In as Pharmacy Staff'
                              : role === 'lab_technician'
                                ? 'Sign In as Laboratory Staff'
                                : `Sign In as ${role}`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Registration Link (Only for Patient) */}
            {role === 'patient' && (
              <div className="pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500">
                  {t('new_to_smarthospital', 'New to SmartHospital?')}{' '}
                  <Link to="/signup" className="text-sky-600 font-extrabold hover:underline">
                    {t('create_account', 'Register a Patient Account')}
                  </Link>
                </p>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
