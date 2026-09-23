import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Stethoscope,
  Building2,
  Calendar,
  LogIn,
  LogOut,
  Cpu,
  BarChart3,
  ShieldAlert,
  Menu,
  X,
  HeartPulse,
  LayoutDashboard,
  ShieldCheck,
  User,
  Clock,
  Users,
  Layers,
  ChevronRight,
  Globe,
  FileText
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import NotificationPanel from './NotificationPanel';
import Tooltip from './Tooltip';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { language, setLanguage, t, languages } = useLanguage();
  const [dbHealthy, setDbHealthy] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [activeQueueToken, setActiveQueueToken] = useState(null);

  useEffect(() => {
    hospitalApi.getHealth()
      .then((res) => setDbHealthy(res.database_connected !== false))
      .catch(() => setDbHealthy(false));
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'patient') {
      hospitalApi.getMyActiveQueue()
        .then((q) => {
          if (q && q.queue_id) setActiveQueueToken(q);
          else setActiveQueueToken(null);
        })
        .catch(() => setActiveQueueToken(null));
    } else {
      setActiveQueueToken(null);
    }
  }, [isAuthenticated, user, location.pathname]);


  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isPatient = user?.role === 'patient';
  const isDoctor = user?.role === 'doctor';
  const isAdmin = user?.role === 'admin';

  const isActive = (path) => location.pathname === path;

  // Notification target identifier based on authenticated role
  const notificationTargetId = isPatient
    ? (user?.patient_id || user?.user_id)
    : isDoctor
      ? (user?.doctor_id || user?.user_id || 'D001')
      : (user?.user_id || 'admin');

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Clinical OPD Status */}
        <div className="flex items-center gap-4">
          <Link
            to={isPatient ? '/patient' : isDoctor ? '/doctor' : isAdmin ? '/admin' : '/'}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-10 h-10 bg-gradient-to-tr from-sky-600 to-teal-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-sky-600/15 group-hover:scale-105 transition-transform duration-200">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-slate-900 tracking-tight block leading-tight">
                SMART<span className="text-sky-600">HOSPITAL</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-500 block -mt-0.5">
                {isDoctor ? t('doctor_opd_console', 'SIMSRH Doctor Console') : isAdmin ? t('admin_portal', 'SIMSRH Operations Portal') : isPatient ? t('patient_care_portal', 'SIMSRH Patient Portal') : 'SIMSRH Tumakuru • OPD Platform'}
              </span>
            </div>
          </Link>

          {/* OPD Live Health Indicator */}
          {dbHealthy !== null && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className={`w-1.5 h-1.5 rounded-full ${dbHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span>{dbHealthy ? t('opd_live') : t('offline')}</span>
            </span>
          )}
        </div>

        {/* DESKTOP ROLE-BASED NAVIGATION */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/70 text-xs font-bold">
          
          {/* 1. PATIENT NAVIGATION (Strictly Patient Tools) */}
          {isAuthenticated && isPatient && (
            <>
              <Link
                to="/patient"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/patient') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-sky-600" />
                <span>{t('my_dashboard')}</span>
              </Link>

              <Link
                to="/book"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/book') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>{t('book_consultation')}</span>
              </Link>

              <Link
                to="/patient?tab=medical-history"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/patient') && location.search.includes('medical-history') ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-teal-600" />
                <span>{t('my_medical_history')}</span>
              </Link>

              <Link
                to={activeQueueToken?.queue_id ? `/tracking?queue_id=${activeQueueToken.queue_id}` : '/tracking'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/tracking') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-sky-600" />
                <span>{t('live_token')}</span>
              </Link>

              <Link
                to="/doctors"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/doctors') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5 text-sky-600" />
                <span>{t('find_doctors')}</span>
              </Link>

              <Link
                to="/departments"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/departments') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>{t('departments')}</span>
              </Link>

              <Link
                to="/about"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/about') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-sky-600" />
                <span>{t('about_simsrh')}</span>
              </Link>
            </>
          )}

          {/* 2. DOCTOR NAVIGATION (Strictly Clinical Doctor Tools) */}
          {isAuthenticated && isDoctor && (
            <>
              <Link
                to="/doctor"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition ${
                  isActive('/doctor') || isActive('/staff') ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>{t('doctor_opd_console')}</span>
              </Link>

              <Link
                to="/doctor?tab=queue"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  location.search.includes('queue') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-sky-600" />
                <span>{t('waiting_line')}</span>
              </Link>

              <Link
                to="/doctor?tab=emergency"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition ${
                  location.search.includes('emergency') ? 'bg-rose-50 text-rose-700 font-extrabold shadow-xs' : 'text-rose-600 hover:bg-rose-50/50'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>{t('emergency_triage')}</span>
              </Link>

              <Link
                to="/doctor/predictions"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition ${
                  isActive('/doctor/predictions') ? 'bg-purple-600 text-white shadow-xs' : 'text-purple-700 hover:bg-purple-50'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>{t('ml_queue_prediction', 'ML Queue Prediction')}</span>
              </Link>

              <Link
                to="/departments"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/departments') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>{t('clinical_wings')}</span>
              </Link>
            </>
          )}

          {/* 3. ADMIN NAVIGATION (Strictly Hospital Management Tools) */}
          {isAuthenticated && isAdmin && (
            <>
              <Link
                to="/admin"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition ${
                  isActive('/admin') && !location.search ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-sky-400" />
                <span>{t('hospital_overview')}</span>
              </Link>

              <Link
                to="/admin?tab=doctors"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  location.search.includes('doctors') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5 text-sky-600" />
                <span>{t('find_doctors')}</span>
              </Link>

              <Link
                to="/admin?tab=patient-records"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  location.search.includes('patient-records') ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                <span>{t('patient_records')}</span>
              </Link>

              <Link
                to="/admin?tab=users"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  location.search.includes('users') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-sky-600" />
                <span>{t('all_patients')}</span>
              </Link>

              <Link
                to="/admin?tab=departments"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  location.search.includes('departments') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>{t('departments')}</span>
              </Link>

              <Link
                to="/analytics"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/analytics') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
                <span>{t('queue_analytics', 'Queue Analytics')}</span>
              </Link>
            </>
          )}

          {/* 4. PUBLIC NAVIGATION (When Logged Out) */}
          {!isAuthenticated && (
            <>
              <Link
                to="/"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{t('home')}</span>
              </Link>

              <Link
                to="/about"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/about') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>{t('about_simsrh')}</span>
              </Link>

              <Link
                to="/doctors"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/doctors') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5 text-sky-600" />
                <span>{t('find_doctors')}</span>
              </Link>

              <Link
                to="/departments"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/departments') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>{t('departments')}</span>
              </Link>

              <Link
                to={activeQueueToken?.queue_id ? `/tracking?queue_id=${activeQueueToken.queue_id}` : '/tracking'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/tracking') ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-sky-600" />
                <span>{t('live_token')}</span>
              </Link>

              <Link
                to="/predict"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  isActive('/predict')
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-purple-700 hover:bg-purple-50'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-purple-500" />
                <span>{t('ai_simulator')}</span>
              </Link>
            </>
          )}

        </nav>

        {/* RIGHT SIDE USER ACTIONS, LANGUAGE SELECTOR & NOTIFICATIONS */}
        <div className="flex items-center gap-2.5 sm:gap-3">

          {/* GLOBAL MULTILINGUAL LANGUAGE SELECTOR */}
          <div className="flex items-center bg-slate-100/90 hover:bg-slate-200/80 rounded-xl p-1 border border-slate-200 text-xs font-bold transition shadow-2xs">
            <Globe className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1 shrink-0" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label="Select Language"
              className="bg-transparent border-0 text-slate-800 text-xs font-black focus:outline-none cursor-pointer pr-1 py-0.5"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code} className="text-slate-900 font-bold">
                  {lang.native}
                </option>
              ))}
            </select>
          </div>

          {/* Active Queue Token Quick Jump Badge */}
          {isAuthenticated && isPatient && activeQueueToken && (
            <Link
              to={`/tracking?queue_id=${activeQueueToken.queue_id}`}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-sky-600 to-teal-600 text-white rounded-full text-xs font-extrabold shadow-sm hover:shadow-md hover:scale-105 transition-all"
              title="Click to view live queue token tracker"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
              <span>Token {activeQueueToken.queue_id} (#{activeQueueToken.position})</span>
            </Link>
          )}
          
          {/* Notification Bell (Targeted for Patient or Doctor) */}
          {isAuthenticated && (
            <Tooltip text="Notifications & Alerts" position="bottom">
              <NotificationPanel patientId={notificationTargetId} />
            </Tooltip>
          )}

          {/* Authenticated User Profile Badge & Logout */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2.5 pl-1">
              <div className="text-right hidden sm:block">
                <span className="font-extrabold text-xs text-slate-900 block leading-tight">
                  {user.name}
                </span>
                <span
                  className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    user.role === 'admin'
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : user.role === 'doctor'
                        ? 'bg-sky-100 text-sky-800 border border-sky-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {user.role}
                </span>
              </div>

              <Tooltip text={t('sign_out')} position="bottom">
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login?role=patient"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-sky-600/15 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t('sign_in')}</span>
              </Link>
              <Link
                to="/signup"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <span>{t('register')}</span>
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* MOBILE RESPONSIVE DRAWER (Strictly Role-Separated) */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-xl animate-in slide-in-from-top duration-200">
          
          {/* Mobile Language Switcher Row */}
          <div className="flex items-center justify-between p-2.5 bg-slate-100 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-sky-600" />
              <span>{t('language')}:</span>
            </span>
            <div className="flex items-center gap-1">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLanguage(l.code)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                    language === l.code
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {l.native}
                </button>
              ))}
            </div>
          </div>

          {/* User Info Bar if Authenticated */}
          {isAuthenticated && user && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                  {user.name?.[0] || 'U'}
                </div>
                <div>
                  <div className="font-extrabold text-xs text-slate-900">{user.name}</div>
                  <div className="text-[10px] text-slate-500 capitalize">{user.role} Account</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-rose-600 font-bold px-2.5 py-1 bg-rose-50 rounded-lg hover:bg-rose-100 transition cursor-pointer"
              >
                {t('sign_out')}
              </button>
            </div>
          )}

          {/* 1. Mobile Patient Navigation */}
          {isAuthenticated && isPatient && (
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-1">
                {t('patient_care_portal')}
              </div>
              <Link to="/patient" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4 text-sky-600" /> {t('my_dashboard')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/book" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-teal-600" /> {t('book_consultation')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/patient?tab=medical-history" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-teal-600" /> {t('my_medical_history')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to={activeQueueToken?.queue_id ? `/tracking?queue_id=${activeQueueToken.queue_id}` : '/tracking'} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-sky-600" /> {t('live_token')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/doctors" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><Stethoscope className="w-4 h-4 text-sky-600" /> {t('find_doctors')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/departments" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><Building2 className="w-4 h-4 text-teal-600" /> {t('departments')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/about" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><Building2 className="w-4 h-4 text-sky-600" /> {t('about_simsrh')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          )}

          {/* 2. Mobile Doctor Navigation */}
          {isAuthenticated && isDoctor && (
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-1">
                {t('doctor_workstation')}
              </div>
              <Link to="/doctor" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><Stethoscope className="w-4 h-4 text-sky-600" /> {t('doctor_opd_console')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/doctor?tab=queue" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><Users className="w-4 h-4 text-sky-600" /> {t('waiting_line')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/doctor?tab=emergency" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-rose-50 text-xs font-bold text-rose-700">
                <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-rose-600" /> {t('emergency_triage')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-rose-400" />
              </Link>
              <Link to="/doctor/predictions" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50 text-xs font-bold text-purple-800">
                <span className="flex items-center gap-2"><Cpu className="w-4 h-4 text-purple-600" /> {t('ml_queue_prediction', 'ML Queue Prediction')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
              </Link>
            </div>
          )}

          {/* 3. Mobile Admin Navigation */}
          {isAuthenticated && isAdmin && (
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-1">
                {t('admin_management', 'Admin Management')}
              </div>
              <Link to="/admin" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4 text-sky-600" /> {t('hospital_overview')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/admin?tab=patient-records" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-teal-600" /> {t('patient_records')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/admin?tab=doctors" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><Stethoscope className="w-4 h-4 text-sky-600" /> {t('find_doctors')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/admin?tab=users" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><Users className="w-4 h-4 text-sky-600" /> {t('all_patients')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/analytics" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-600" /> {t('queue_analytics', 'Queue Analytics')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          )}

          {/* 4. Mobile Logged Out Navigation */}
          {!isAuthenticated && (
            <div className="space-y-1">
              <Link to="/" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span>{t('home')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/about" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2"><Building2 className="w-4 h-4 text-teal-600" /> {t('about_simsrh')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/doctors" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span>{t('find_doctors')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/departments" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800">
                <span>{t('departments')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/predict" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50 text-xs font-bold text-purple-700">
                <span>{t('ai_simulator')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
              </Link>
              <div className="pt-3 flex gap-2">
                <Link to="/login?role=patient" className="flex-1 py-2.5 bg-sky-600 text-white rounded-xl text-center text-xs font-bold">
                  {t('sign_in')}
                </Link>
                <Link to="/signup" className="flex-1 py-2.5 bg-slate-100 text-slate-800 rounded-xl text-center text-xs font-bold">
                  {t('register')}
                </Link>
              </div>
            </div>
          )}

        </div>
      )}
    </header>
  );
}