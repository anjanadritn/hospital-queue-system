import React, { useState } from 'react';
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
  Sparkles,
  GraduationCap,
  ShieldCheck,
  Activity,
  Cpu,
  Navigation,
  Clock,
  CheckCircle2,
  Users,
  Stethoscope
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { t } = useLanguage();

  const [role, setRole] = useState('patient');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);
    setError(null);
  };

  const handleQuickDemoFill = (demoRole) => {
    setRole(demoRole);
    setError(null);
    if (demoRole === 'patient') {
      setPhone('9876543211');
      setPassword('PatientPass123!');
    } else if (demoRole === 'doctor') {
      setPhone('9876543210');
      setPassword('DoctorPass123!');
    } else if (demoRole === 'admin') {
      setPhone('9999999999');
      setPassword('AdminPass123!');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await hospitalApi.loginUser(phone.trim(), password, role);
      if (res.token) {
        await login(res.token, res.user);

        // Auto-redirect strictly based on role
        let defaultTarget = '/patient';
        if (res.user.role === 'admin') defaultTarget = '/admin';
        else if (res.user.role === 'doctor') defaultTarget = '/doctor';

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
            
            {/* Header */}
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-sky-600 block mb-1">
                {t('portal_authentication', 'Portal Authentication')}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {t('sign_in_smarthospital', 'Sign In to SmartHospital')}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {t('select_account_role_desc', 'Select your account role and enter credentials to continue.')}
              </p>
            </div>

            {/* Quick 1-Click Evaluator Demo Accounts Banner */}
            <div className="p-3.5 bg-sky-50/70 border border-sky-200/80 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>{t('quick_demo_login', '1-Click Examiner Demo Login:')}</span>
                </span>
                <span className="text-[10px] text-sky-700 font-bold bg-sky-100/80 px-2 py-0.5 rounded-full">
                  {t('instant_access', 'Instant Access')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handleQuickDemoFill('patient')}
                  className={`py-2 px-2.5 rounded-xl border transition text-center cursor-pointer ${
                    role === 'patient'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50 hover:border-sky-300'
                  }`}
                >
                  {t('patient', 'Patient')}
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoFill('doctor')}
                  className={`py-2 px-2.5 rounded-xl border transition text-center cursor-pointer ${
                    role === 'doctor'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50 hover:border-sky-300'
                  }`}
                >
                  {t('doctor', 'Doctor')}
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoFill('admin')}
                  className={`py-2 px-2.5 rounded-xl border transition text-center cursor-pointer ${
                    role === 'admin'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50 hover:border-sky-300'
                  }`}
                >
                  {t('admin', 'Admin')}
                </button>
              </div>
            </div>

            {/* Role Switcher Tabs */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                {t('select_account_role', 'Select Account Role')}
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
                {[
                  { id: 'patient', label: t('patient', 'Patient'), icon: Users },
                  { id: 'doctor', label: t('doctor', 'Doctor'), icon: Stethoscope },
                  { id: 'admin', label: t('admin', 'Admin'), icon: ShieldCheck }
                ].map((r) => {
                  const Icon = r.icon;
                  const isSelected = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleRoleChange(r.id)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-white text-sky-700 shadow-xs border border-slate-200/60'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{r.label}</span>
                    </button>
                  );
                })}
              </div>
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
                    maxLength={10}
                    placeholder={t('phone_placeholder', '10-digit mobile number')}
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

              {/* Submit Button (Primary Blue/Teal Gradient) */}
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
                    <span className="capitalize">{t('login_as_role', { role: t(role, role) }, `Sign In as ${role}`)}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Registration Link */}
            <div className="pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                {t('new_to_smarthospital', 'New to SmartHospital?')}{' '}
                <Link to="/signup" className="text-sky-600 font-extrabold hover:underline">
                  {t('create_account', 'Register a Patient Account')}
                </Link>
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
