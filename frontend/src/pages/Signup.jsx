import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HeartPulse,
  User,
  Phone,
  Mail,
  Lock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  KeyRound,
  GraduationCap,
  Activity,
  Cpu
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useLanguage } from '../context/LanguageContext';

export default function Signup() {
  const navigate = useNavigate();
  const { t } = useLanguage();

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
      setError(t('invalid_phone_error', 'Please enter a valid 10-digit mobile number'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwords_dont_match', 'Passwords do not match'));
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
        t('failed_send_otp', 'Failed to send verification OTP');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!otpInput || otpInput.length !== 6) {
      setError(t('enter_6_digit_otp_error', 'Please enter the 6-digit OTP code'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await hospitalApi.registerPatient({
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
        t('reg_failed_otp', 'Account registration failed. Please verify your OTP.');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="max-w-6xl w-full bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        
        {/* LEFT COLUMN: Modern Healthcare Brand Showcase (5 cols) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-950 via-sky-950 to-teal-950 p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

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
                  {t('signup_title', 'Patient Portal Registration')}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-400/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('enterprise_healthcare_platform', 'Verified Patient Network')}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                {t('signup_hero_title', 'Begin Your Connected Clinical Journey')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {t('signup_hero_desc', 'Register with your mobile phone number to unlock advance specialist booking, live queue position tracking, and smart departure alerts.')}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-xs bg-white/5 p-3 rounded-2xl border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-400/30 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-emerald-200 block">{t('instant_access', 'Instant SMS OTP Verification')}</span>
                  <span className="text-slate-400 text-[11px]">{t('doctor_calling_otp_triage', 'Secure patient authentication protocol')}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs bg-white/5 p-3 rounded-2xl border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-400/30 shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-purple-200 block">{t('ai_wait_time_forecasting', 'Personalized Waiting Prediction')}</span>
                  <span className="text-slate-400 text-[11px]">{t('rf_ml_queue_prediction', 'Real-time queue latency calculated for your turn')}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs bg-white/5 p-3 rounded-2xl border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center border border-sky-400/30 shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-sky-200 block">{t('hospital_short', 'Shridevi Hospital Campus Access')}</span>
                  <span className="text-slate-400 text-[11px]">{t('clinical_wings', 'Direct integration with Tumkur clinical wings')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-white/10 text-xs text-slate-400 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="leading-tight">
              {t('academic_project_tag', 'Final-Year Engineering Project • Shridevi Institute of Engineering & Technology, Tumkur')}
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: Signup Form Console (7 cols) */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto space-y-6">
            
            {/* Header */}
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-sky-600 block mb-1">
                {t('new_patient_enrollment', 'New Patient Enrollment')}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {t('create_account', 'Create Patient Account')}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {t('create_patient_account_desc', 'Enter your details to generate your patient ID and verify your phone.')}
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1">
                  <span className="font-extrabold block">{t('authentication_notice', 'Registration Issue')}</span>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Success State */}
            {success ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 mb-1">{t('account_verified_created', 'Account Verified & Created!')}</h3>
                  <p className="text-xs text-slate-500">
                    {t('redirecting_to_login', 'Your patient profile has been registered in the SmartHospital database. Redirecting to login...')}
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 transition"
                  >
                    <span>{t('proceed_to_signin', 'Proceed to Sign In')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ) : !otpSent ? (
              /* STEP 1: INITIAL DETAILS */
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('full_name', 'Full Name')}</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      placeholder={t('full_name_placeholder', 'e.g. Ramesh Kumar')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('phone_number', 'Phone Number')}</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder={t('phone_placeholder', '10-digit number')}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('email_optional', 'Email (Optional)')}</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        placeholder="patient@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('password', 'Password')}</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder={t('password_placeholder', 'Create password')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
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

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('confirm_password', 'Confirm Password')}</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder={t('confirm_password_placeholder', 'Confirm password')}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? t('hide_password', 'Hide password') : t('show_password', 'Show password')}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 cursor-pointer mt-4"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('sending_otp_code', 'Sending OTP Verification Code...')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('send_otp_verify_phone', 'Send OTP Code & Verify Phone')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* STEP 2: OTP VERIFICATION */
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-sky-600" />
                    <span>{t('verification_code_sent', 'Verification Code Sent')}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {t('we_sent_otp_to', { phone: `+91 ${phone}` }, `We sent a 6-digit OTP code to +91 ${phone}`)}.
                  </p>
                  {devOtp && (
                    <div className="pt-2">
                      <span className="px-2 py-0.5 bg-sky-200/80 text-sky-900 font-mono font-bold rounded-md text-[10px]">
                        {t('demo_autofilled_otp', { otp: devOtp }, `Demo Auto-Filled OTP: ${devOtp}`)}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">
                    {t('enter_otp', 'Enter 6-Digit OTP Code')}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center py-3 text-2xl font-mono font-extrabold tracking-[0.3em] bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 focus:bg-white focus:border-sky-600 focus:outline-none transition"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer"
                  >
                    {t('edit_phone', 'Edit Phone')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading || otpInput.length !== 6}
                    className="w-2/3 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t('verifying_and_creating', 'Verifying & Creating...')}</span>
                      </>
                    ) : (
                      <>
                        <span>{t('complete_registration', 'Complete Registration')}</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Login Link */}
            <div className="pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                {t('already_have_account', 'Already have an account?')}{' '}
                <Link to="/login" className="text-sky-600 font-extrabold hover:underline">
                  {t('sign_in_here', 'Sign In Here')}
                </Link>
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
