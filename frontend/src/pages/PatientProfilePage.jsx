import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  User,
  Users,
  ShieldCheck,
  Calendar,
  Activity,
  Lock,
  Camera,
  Trash2,
  Edit3,
  Save,
  X,
  Check,
  AlertTriangle,
  FileText,
  PhoneCall,
  Mail,
  MapPin,
  Clock,
  Stethoscope,
  ChevronRight,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  Ban,
  Building2,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { optimizeProfileImage } from '../utils/imageOptimizer';
import LoadingState from '../components/LoadingState';
import StatusBadge from '../components/StatusBadge';
import ConsultationRecordModal from '../components/ConsultationRecordModal';
import CancelAppointmentModal from '../components/CancelAppointmentModal';

export default function PatientProfilePage({ initialTab }) {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlTab = searchParams.get('tab');
  const getInitialTab = () => {
    if (initialTab) return initialTab;
    if (urlTab === 'history' || urlTab === 'medical-history') return 'medical-history';
    if (urlTab && ['personal', 'medical-history', 'appointments', 'security'].includes(urlTab)) return urlTab;
    return 'personal';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [loading, setLoading] = useState(true);

  // Profile data
  const [patientProfile, setPatientProfile] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Profile Picture upload states
  const [picUploading, setPicUploading] = useState(false);
  const [picStatusText, setPicStatusText] = useState('');
  const [picSuccessMessage, setPicSuccessMessage] = useState('');
  const [picError, setPicError] = useState('');

  // Medical History & Appointments
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [appointmentFilter, setAppointmentFilter] = useState('all');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [cancellingAppointment, setCancellingAppointment] = useState(null);

  // Security / Change Password form
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdError, setPwdError] = useState('');

  // Editable Profile Form fields
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    gender: 'Male',
    address: '',
    city: 'Tumakuru',
    state: 'Karnataka',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    age: '',
    height_cm: '',
    weight_kg: ''
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'personal') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  useEffect(() => {
    if (urlTab === 'history' || urlTab === 'medical-history') {
      setActiveTab('medical-history');
    } else if (urlTab && ['personal', 'medical-history', 'appointments', 'security'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const loadProfileData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setProfileError('');
    try {
      const patientId = user.patient_id || user.user_id;
      const [profileRes, historyRes, aptsRes] = await Promise.allSettled([
        patientId ? hospitalApi.getMyPatientProfile().catch(() => hospitalApi.getPatientProfile(patientId)) : Promise.resolve(null),
        hospitalApi.getMyMedicalHistory().catch(() => ({ success: true, consultations: [] })),
        patientId ? hospitalApi.getPatientAppointments(patientId).catch(() => []) : Promise.resolve([])
      ]);

      let pData = null;
      if (profileRes.status === 'fulfilled' && profileRes.value) {
        pData = profileRes.value.patient || profileRes.value;
        setPatientProfile(pData);
        if (pData.profile_picture) {
          setProfilePicture(pData.profile_picture);
        } else if (user.profile_picture) {
          setProfilePicture(user.profile_picture);
        }
      } else if (user?.profile_picture) {
        setProfilePicture(user.profile_picture);
      }

      const activeObj = pData || user;
      setProfileForm({
        name: activeObj?.name || '',
        phone: activeObj?.phone || '',
        email: activeObj?.email || '',
        date_of_birth: activeObj?.date_of_birth || '',
        gender: activeObj?.gender || 'Male',
        address: activeObj?.address || '',
        city: activeObj?.city || 'Tumakuru',
        state: activeObj?.state || 'Karnataka',
        emergency_contact_name: activeObj?.emergency_contact_name || activeObj?.emergency_contact?.name || '',
        emergency_contact_phone: activeObj?.emergency_contact_phone || activeObj?.emergency_contact?.phone || '',
        age: activeObj?.age ?? '',
        height_cm: activeObj?.height_cm ?? '',
        weight_kg: activeObj?.weight_kg ?? ''
      });

      if (historyRes.status === 'fulfilled' && historyRes.value) {
        const consults = historyRes.value.consultations || (Array.isArray(historyRes.value) ? historyRes.value : []);
        setMedicalHistory(consults);
      }

      if (aptsRes.status === 'fulfilled' && aptsRes.value) {
        setAppointments(Array.isArray(aptsRes.value) ? aptsRes.value : []);
      }
    } catch (err) {
      console.error('Error loading patient profile page:', err);
      setProfileError('Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [user]);

  // Calculate age from DOB if age not explicitly provided
  const calculateAge = (dobString, fallbackAge) => {
    if (fallbackAge !== undefined && fallbackAge !== null && fallbackAge !== '') {
      return fallbackAge;
    }
    if (!dobString) return '—';
    try {
      const birthDate = new Date(dobString);
      if (isNaN(birthDate.getTime())) return '—';
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 0 ? age : '—';
    } catch {
      return fallbackAge || '—';
    }
  };

  const handleProfileFieldChange = (e) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess(false);

    try {
      const payload = {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        email: profileForm.email.trim(),
        date_of_birth: profileForm.date_of_birth,
        gender: profileForm.gender,
        address: profileForm.address.trim(),
        city: profileForm.city.trim(),
        state: profileForm.state || 'Karnataka',
        emergency_contact_name: profileForm.emergency_contact_name.trim(),
        emergency_contact_phone: profileForm.emergency_contact_phone.trim(),
        age: profileForm.age ? parseInt(profileForm.age, 10) : undefined,
        height_cm: profileForm.height_cm ? parseFloat(profileForm.height_cm) : undefined,
        weight_kg: profileForm.weight_kg ? parseFloat(profileForm.weight_kg) : undefined
      };

      const res = await hospitalApi.updateMyProfile(payload);
      setPatientProfile(res.patient || res);
      setProfileSuccess(true);
      setIsEditingProfile(false);
      if (refreshUser) await refreshUser();
      setTimeout(() => setProfileSuccess(false), 4000);
      await loadProfileData();
    } catch (err) {
      setProfileError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCancelEditProfile = () => {
    const activeObj = patientProfile || user;
    if (activeObj) {
      setProfileForm({
        name: activeObj.name || '',
        phone: activeObj.phone || '',
        email: activeObj.email || '',
        date_of_birth: activeObj.date_of_birth || '',
        gender: activeObj.gender || 'Male',
        address: activeObj.address || '',
        city: activeObj.city || 'Tumakuru',
        state: activeObj.state || 'Karnataka',
        emergency_contact_name: activeObj.emergency_contact_name || activeObj.emergency_contact?.name || '',
        emergency_contact_phone: activeObj.emergency_contact_phone || activeObj.emergency_contact?.phone || '',
        age: activeObj.age ?? '',
        height_cm: activeObj.height_cm ?? '',
        weight_kg: activeObj.weight_kg ?? ''
      });
    }
    setIsEditingProfile(false);
  };

  // Profile Picture Upload Handler with Automatic Image Optimization
  const handleProfilePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setPicError('');
    setPicSuccessMessage('');
    setPicUploading(true);
    setPicStatusText(t('optimizing_photo', 'Optimizing photo...'));

    try {
      // Automatic client-side resize and compression
      const optimized = await optimizeProfileImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.85,
        maxSizeBytes: 2 * 1024 * 1024
      });

      setPicStatusText(t('uploading_photo', 'Uploading photo...'));

      await hospitalApi.uploadProfilePicture(optimized.dataUri, optimized.mimeType);

      setProfilePicture(optimized.dataUri);
      if (patientProfile) {
        setPatientProfile(prev => ({ ...prev, profile_picture: optimized.dataUri }));
      }

      if (refreshUser) await refreshUser();

      setPicSuccessMessage(t('profile_photo_updated_success', 'Profile photo updated successfully.'));
      setTimeout(() => setPicSuccessMessage(''), 4000);
      await loadProfileData();
    } catch (err) {
      console.error('Profile photo error:', err);
      const msg = err.response?.data?.error || err.message || t('unable_process_image', 'Unable to process this image. Please select another photo.');
      setPicError(msg);
    } finally {
      setPicUploading(false);
      setPicStatusText('');
    }
  };

  const handleRemoveProfilePicture = async () => {
    if (!profilePicture) return;
    const confirmed = window.confirm(t('confirm_remove_photo', 'Are you sure you want to remove your profile photo?'));
    if (!confirmed) return;

    setPicUploading(true);
    setPicStatusText(t('saving_changes', 'Saving...'));
    setPicError('');
    setPicSuccessMessage('');
    try {
      await hospitalApi.removeProfilePicture();
      setProfilePicture(null);
      if (patientProfile) {
        setPatientProfile(prev => ({ ...prev, profile_picture: null }));
      }
      if (refreshUser) await refreshUser();
      setPicSuccessMessage(t('profile_photo_updated_success', 'Profile photo removed successfully.'));
      setTimeout(() => setPicSuccessMessage(''), 4000);
      await loadProfileData();
    } catch (err) {
      setPicError(err.response?.data?.error || 'Failed to remove profile photo.');
    } finally {
      setPicUploading(false);
      setPicStatusText('');
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!passwordForm.current_password) {
      setPwdError(t('current_password_required', 'Current password is required.'));
      return;
    }
    if (!passwordForm.new_password) {
      setPwdError(t('new_password_required', 'New password is required.'));
      return;
    }
    if (passwordForm.new_password.length < 6) {
      setPwdError(t('password_min_length', 'New password must be at least 6 characters.'));
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPwdError(t('passwords_must_match', 'New password and confirmation must match.'));
      return;
    }

    setPwdLoading(true);
    try {
      await hospitalApi.changePassword(
        passwordForm.current_password,
        passwordForm.new_password,
        passwordForm.confirm_password
      );
      setPwdSuccess(t('password_updated_success', 'Password updated successfully.'));
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      setTimeout(() => setPwdSuccess(''), 5000);
    } catch (err) {
      setPwdError(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setPwdLoading(false);
    }
  };

  // Filtered Appointments
  const nowStr = new Date().toISOString().split('T')[0];
  const filteredAppointments = appointments.filter(a => {
    if (appointmentFilter === 'all') return true;
    if (appointmentFilter === 'upcoming') {
      return a.consultation_date >= nowStr && a.status !== 'completed' && a.status !== 'cancelled';
    }
    if (appointmentFilter === 'completed') {
      return a.status === 'completed';
    }
    if (appointmentFilter === 'cancelled') {
      return a.status === 'cancelled';
    }
    if (appointmentFilter === 'missed') {
      return a.status === 'missed' || a.status === 'missed_consultation' || a.status === 'no_show';
    }
    return true;
  });

  const isCancellable = (apt) => {
    if (!apt) return false;
    const status = (apt.status || '').toLowerCase();
    const qStatus = (apt.current_queue_status || apt.queue_status || '').toLowerCase();
    const nonCancellable = ['in_consultation', 'completed', 'cancelled', 'missed', 'missed_consultation', 'no_show'];
    return !nonCancellable.includes(status) && !nonCancellable.includes(qStatus);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <LoadingState message="Loading your complete patient profile & medical history..." />
      </div>
    );
  }

  const patientIdDisplay = user?.patient_id || patientProfile?.patient_id || 'P001';
  const patientNameDisplay = profileForm.name || patientProfile?.name || user?.name || 'Valued Patient';
  const initialLetter = patientNameDisplay.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 sm:py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* BREADCRUMB / BACK TO DASHBOARD */}
        <div className="flex items-center justify-between">
          <Link
            to="/patient"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-sky-600 transition group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>{t('my_dashboard', 'My Dashboard')}</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-extrabold">{t('my_profile', 'My Profile')}</span>
          </Link>

          <button
            onClick={loadProfileData}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-200 shadow-2xs cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">{t('refresh', 'Refresh')}</span>
          </button>
        </div>

        {/* ALERT BANNERS */}
        {profileSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 shadow-xs transition animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{t('profile_updated_success', 'Profile updated successfully.')}</span>
          </div>
        )}

        {picSuccessMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 shadow-xs transition animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{picSuccessMessage}</span>
          </div>
        )}

        {pwdSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 shadow-xs transition animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{pwdSuccess}</span>
          </div>
        )}

        {profileError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2 shadow-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{profileError}</span>
          </div>
        )}

        {picError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2 shadow-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{picError}</span>
          </div>
        )}

        {pwdError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2 shadow-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{pwdError}</span>
          </div>
        )}

        {/* 1. TOP HERO SECTION: PROFILE PHOTO & VERIFIED IDENTITY */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-sky-950 to-teal-950 text-white flex flex-col sm:flex-row items-center sm:items-start gap-6 relative">
            <div className="relative shrink-0">
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt={patientNameDisplay}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover shadow-lg border-4 border-white/90 ring-4 ring-sky-500/30"
                />
              ) : (
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-sky-500 to-teal-400 text-white flex items-center justify-center text-4xl sm:text-5xl font-black shadow-lg border-4 border-white/90 ring-4 ring-sky-500/30">
                  {initialLetter}
                </div>
              )}

              {picUploading && (
                <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-white text-[11px] font-bold backdrop-blur-xs p-2 text-center animate-fade-in">
                  <span className="animate-spin text-xl mb-1">⟳</span>
                  <span className="leading-tight px-1">{picStatusText || t('optimizing_photo', 'Optimizing photo...')}</span>
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full text-xs font-bold border border-sky-400/30 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t('patient_id_label')}: {patientIdDisplay}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[11px] font-bold border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{t('verified_patient', 'Verified Patient Profile')}</span>
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {patientNameDisplay}
              </h1>

              <p className="text-xs text-slate-300 max-w-xl">
                SIMSRH Patient Identity • {profileForm.city || 'Tumakuru'}, {profileForm.state || 'Karnataka'}
              </p>

              {/* Photo Actions: Upload / Remove */}
              <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <label
                  htmlFor="profile-pic-upload"
                  className={`px-3.5 py-1.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-xl border border-white/20 cursor-pointer transition flex items-center gap-1.5 shadow-2xs backdrop-blur-xs ${picUploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <Camera className="w-3.5 h-3.5 text-sky-300" />
                  <span>{picUploading ? (picStatusText || t('optimizing_photo')) : (profilePicture ? t('change_photo', 'Change Photo') : t('upload_photo', 'Upload Photo'))}</span>
                </label>

                {profilePicture && (
                  <button
                    type="button"
                    onClick={handleRemoveProfilePicture}
                    disabled={picUploading}
                    className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-400/30 cursor-pointer transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                    <span>{t('remove_photo', 'Remove Photo')}</span>
                  </button>
                )}

                <input
                  id="profile-pic-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleProfilePictureChange}
                  disabled={picUploading}
                />
              </div>

              <p className="text-[11px] text-slate-300/80 pt-0.5">
                {t('photo_auto_optimize_hint', 'Photos of any size are automatically optimized for profile display.')}
              </p>
            </div>

            {/* Quick Action Button: Edit Profile */}
            <div className="sm:self-start">
              {!isEditingProfile ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('personal');
                    setIsEditingProfile(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{t('edit_profile', 'Edit Profile')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelEditProfile}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-white/20 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{t('cancel_edit', 'Cancel')}</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. DEDICATED PROFILE TABS NAVIGATION */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-2 border-b border-slate-200 overflow-x-auto text-xs font-bold scrollbar-thin">
            <button
              onClick={() => handleTabChange('personal')}
              className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'personal'
                  ? 'bg-white text-sky-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <User className="w-3.5 h-3.5 text-sky-600" />
              <span>{t('personal_info_tab', 'Personal Information')}</span>
            </button>

            <button
              onClick={() => handleTabChange('medical-history')}
              className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'medical-history'
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-teal-600" />
              <span>{t('medical_history_tab', 'Medical History')}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-teal-100 text-teal-800">
                {medicalHistory.length}
              </span>
            </button>

            <button
              onClick={() => handleTabChange('appointments')}
              className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'appointments'
                  ? 'bg-white text-sky-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              <span>{t('appointment_history', 'Appointment History')}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-sky-100 text-sky-800">
                {appointments.length}
              </span>
            </button>

            <button
              onClick={() => handleTabChange('security')}
              className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'security'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-slate-700" />
              <span>{t('account_security', 'Account & Security')}</span>
            </button>
          </div>

          {/* TAB 1: PERSONAL INFORMATION */}
          {activeTab === 'personal' && (
            <div className="p-6 sm:p-8">
              {!isEditingProfile ? (
                /* ======================== VIEW MODE ======================== */
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                      <User className="w-4 h-4 text-sky-600" />
                      <span>{t('personal_information')}</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          {t('full_name')}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900">{profileForm.name || t('not_provided')}</span>
                      </div>

                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          {t('patient_id_label')}
                        </span>
                        <span className="text-sm font-extrabold text-sky-700 font-mono">{patientIdDisplay}</span>
                      </div>

                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          {t('gender')}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900 capitalize">{profileForm.gender || t('not_provided')}</span>
                      </div>

                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          {t('date_of_birth')}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900">{profileForm.date_of_birth || t('not_provided')}</span>
                      </div>

                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          {t('age_years')}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900">
                          {calculateAge(profileForm.date_of_birth, profileForm.age)} {profileForm.date_of_birth ? 'years' : ''}
                        </span>
                      </div>

                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          {t('state_label', 'State')}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900">{profileForm.state || 'Karnataka'}</span>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Section 2: Contact Details */}
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-teal-600" />
                      <span>{t('contact_information')}</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          {t('phone_number')}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900 font-mono">{profileForm.phone || t('not_provided')}</span>
                      </div>

                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          {t('email_address')}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900">{profileForm.email || t('not_provided')}</span>
                      </div>

                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          {t('village_city')}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900">{profileForm.city || 'Tumakuru'}</span>
                      </div>

                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 sm:col-span-2 lg:col-span-3">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          {t('address')}
                        </span>
                        <span className="text-sm font-bold text-slate-800">{profileForm.address || t('not_provided')}</span>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Section 3: Emergency Contact */}
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-rose-500" />
                      <span>{t('emergency_contact')}</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
                        <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block mb-1">
                          {t('emergency_contact_name')}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900">{profileForm.emergency_contact_name || t('not_provided')}</span>
                      </div>

                      <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
                        <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block mb-1">
                          {t('emergency_contact_phone')}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900 font-mono">{profileForm.emergency_contact_phone || t('not_provided')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ======================== EDIT MODE ======================== */
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl text-xs text-sky-800 flex items-center justify-between">
                    <span className="font-bold">{t('editing_profile_details', 'Editing Personal Information (Patient ID is locked for security)')}</span>
                    <button
                      type="button"
                      onClick={handleCancelEditProfile}
                      className="text-xs font-bold text-sky-700 underline cursor-pointer"
                    >
                      {t('cancel_edit', 'Cancel')}
                    </button>
                  </div>

                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                      {t('personal_information')}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('full_name')} *</label>
                        <input
                          type="text"
                          name="name"
                          value={profileForm.name}
                          onChange={handleProfileFieldChange}
                          required
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('patient_id_label')} (Locked)</label>
                        <input
                          type="text"
                          value={patientIdDisplay}
                          disabled
                          className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-not-allowed font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('gender')}</label>
                        <select
                          name="gender"
                          value={profileForm.gender}
                          onChange={handleProfileFieldChange}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          <option value="Male">{t('male')}</option>
                          <option value="Female">{t('female')}</option>
                          <option value="Other">{t('other')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('date_of_birth')}</label>
                        <input
                          type="date"
                          name="date_of_birth"
                          value={profileForm.date_of_birth}
                          onChange={handleProfileFieldChange}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('age_years')}</label>
                        <input
                          type="number"
                          name="age"
                          value={profileForm.age}
                          onChange={handleProfileFieldChange}
                          placeholder="e.g. 24"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('state_label', 'State')}</label>
                        <input
                          type="text"
                          name="state"
                          value={profileForm.state}
                          onChange={handleProfileFieldChange}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                      {t('contact_information')}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('phone_number')} *</label>
                        <input
                          type="tel"
                          name="phone"
                          value={profileForm.phone}
                          onChange={handleProfileFieldChange}
                          required
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('email_address')}</label>
                        <input
                          type="email"
                          name="email"
                          value={profileForm.email}
                          onChange={handleProfileFieldChange}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('village_city')}</label>
                        <input
                          type="text"
                          name="city"
                          value={profileForm.city}
                          onChange={handleProfileFieldChange}
                          placeholder="e.g. Tumakuru"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('address')}</label>
                        <input
                          type="text"
                          name="address"
                          value={profileForm.address}
                          onChange={handleProfileFieldChange}
                          placeholder="e.g. Near Sira Gate, Tumakuru"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                      {t('emergency_contact')}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('emergency_contact_name')}</label>
                        <input
                          type="text"
                          name="emergency_contact_name"
                          value={profileForm.emergency_contact_name}
                          onChange={handleProfileFieldChange}
                          placeholder="e.g. Ramesh Kumar"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('emergency_contact_phone')}</label>
                        <input
                          type="tel"
                          name="emergency_contact_phone"
                          value={profileForm.emergency_contact_phone}
                          onChange={handleProfileFieldChange}
                          placeholder="e.g. 9876543210"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{profileSaving ? t('saving_changes') : t('save_changes')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelEditProfile}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      {t('cancel_edit', 'Cancel')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: MEDICAL HISTORY */}
          {activeTab === 'medical-history' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-teal-600" />
                    <span>{t('medical_history_tab', 'Medical History')}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chronological record of verified clinical consultations, diagnoses, and prescriptions
                  </p>
                </div>
                <span className="px-3 py-1 bg-teal-50 text-teal-800 font-bold text-xs rounded-full border border-teal-200">
                  {medicalHistory.length} {t('records', 'Records')}
                </span>
              </div>

              {medicalHistory.length === 0 ? (
                <div className="text-center py-12 px-4 bg-slate-50/60 rounded-3xl border border-dashed border-slate-200">
                  <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-extrabold text-slate-700 mb-1">{t('no_medical_records_yet')}</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                    Once you complete a consultation with an OPD physician at SIMSRH, your clinical assessment and prescriptions will appear here.
                  </p>
                  <Link
                    to="/book"
                    className="inline-flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{t('book_consultation')}</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {medicalHistory.map((rec, idx) => (
                    <div
                      key={rec._id || rec.consultation_id || idx}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-teal-300 transition space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-sm shrink-0">
                            <Stethoscope className="w-5 h-5 text-teal-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                              {rec.doctor_name || 'Dr. Specialist'}
                            </h4>
                            <p className="text-xs text-teal-700 font-semibold">
                              {rec.department || 'General Medicine'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {rec.consultation_date || rec.date || 'Recent'}
                          </span>
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-200">
                            {t('completed', 'Completed')}
                          </span>
                        </div>
                      </div>

                      {/* Clinical Content */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                        {rec.diagnosis && (
                          <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100">
                            <span className="font-extrabold text-teal-900 block mb-1 uppercase tracking-wider text-[10px]">
                              {t('diagnosis', 'Diagnosis / Assessment')}
                            </span>
                            <p className="text-slate-800 leading-relaxed">{rec.diagnosis}</p>
                          </div>
                        )}

                        {rec.advice && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="font-extrabold text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
                              {t('doctor_advice', 'Doctor Advice & Instructions')}
                            </span>
                            <p className="text-slate-700 leading-relaxed">{rec.advice}</p>
                          </div>
                        )}
                      </div>

                      {/* Prescriptions summary if present */}
                      {Array.isArray(rec.prescriptions) && rec.prescriptions.length > 0 && (
                        <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 text-xs">
                          <span className="font-extrabold text-slate-700 block mb-2 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-sky-600" />
                            {t('prescriptions', 'Prescribed Medicines')} ({rec.prescriptions.length})
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {rec.prescriptions.map((med, mIdx) => (
                              <div key={mIdx} className="p-2 bg-white rounded-lg border border-slate-200/80 text-[11px]">
                                <span className="font-bold text-slate-900 block">{med.medicine || med.name}</span>
                                <span className="text-slate-500 text-[10px]">{med.dosage || ''} • {med.frequency || med.timing || ''}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action to open full modal */}
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(rec)}
                          className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs rounded-xl border border-teal-200 transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-teal-600" />
                          <span>{t('view_prescription_record', 'View Consultation Record & Prescription')}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: APPOINTMENT HISTORY */}
          {activeTab === 'appointments' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-sky-600" />
                    <span>{t('appointment_history', 'Appointment History')}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comprehensive record of upcoming, completed, and cancelled consultation bookings
                  </p>
                </div>

                {/* Filter buttons */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setAppointmentFilter('all')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      appointmentFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    {t('all_appointments', 'All')} ({appointments.length})
                  </button>
                  <button
                    onClick={() => setAppointmentFilter('upcoming')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      appointmentFilter === 'upcoming' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    {t('upcoming', 'Upcoming')}
                  </button>
                  <button
                    onClick={() => setAppointmentFilter('completed')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      appointmentFilter === 'completed' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    {t('completed', 'Completed')}
                  </button>
                  <button
                    onClick={() => setAppointmentFilter('cancelled')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      appointmentFilter === 'cancelled' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    {t('cancelled', 'Cancelled')}
                  </button>
                </div>
              </div>

              {filteredAppointments.length === 0 ? (
                <div className="text-center py-12 px-4 bg-slate-50/60 rounded-3xl border border-dashed border-slate-200">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-extrabold text-slate-700 mb-1">{t('no_appointment_records_yet')}</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                    {appointmentFilter === 'all'
                      ? 'No appointments found in your account history.'
                      : `No ${appointmentFilter} appointments found.`}
                  </p>
                  <Link
                    to="/book"
                    className="inline-flex items-center gap-2 px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{t('book_consultation')}</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAppointments.map((apt, idx) => (
                    <div
                      key={apt.booking_id || apt._id || idx}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-sky-300 transition space-y-4"
                    >
                      {/* Top Header: Booking ID, Patient Target (Myself/Family), Booking Status, Queue Token */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-mono font-bold text-xs rounded-lg border border-slate-200">
                            ID: {apt.booking_id || '—'}
                          </span>

                          {apt.booking_for === 'family_member' || (apt.relation && apt.relation.toLowerCase() !== 'self') ? (
                            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-lg border border-purple-200 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-purple-600" />
                              <span>Family: {apt.relation || 'Dependent'}</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-sky-50 text-sky-700 text-xs font-bold rounded-lg border border-sky-200 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-sky-600" />
                              <span>{t('myself', 'Myself')}</span>
                            </span>
                          )}

                          <StatusBadge status={apt.status} />
                        </div>

                        {/* Queue Token Badge */}
                        <div className="flex items-center gap-2 bg-gradient-to-r from-sky-50 to-teal-50 px-3.5 py-1.5 rounded-xl border border-sky-200 shadow-2xs">
                          <span className="text-[10px] text-sky-700 uppercase font-extrabold tracking-wider">Queue Token</span>
                          <span className="text-sm sm:text-base font-black text-sky-900 font-mono">
                            #{apt.queue_id || apt.token_number || apt.token || '—'}
                          </span>
                        </div>
                      </div>

                      {/* Main Information: Patient Demographics & Consulting Specialist */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left: Patient Details (Who the appointment is for) */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                            Patient Name (Who Appointment is For)
                          </span>
                          <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                            {apt.patient_name || apt.name || 'Valued Patient'}
                          </h4>
                          <div className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-2 pt-0.5">
                            <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                              Age: <strong className="text-slate-900 font-bold">{apt.age ? `${apt.age} yrs` : 'N/A'}</strong>
                            </span>
                            <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                              Gender: <strong className="text-slate-900 font-bold">{apt.gender || '—'}</strong>
                            </span>
                            {apt.city && (
                              <span className="text-slate-400 text-[11px]">
                                • {apt.city}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right: Consulting Specialist & Department / Specialization */}
                        <div className="space-y-1 md:border-l md:border-slate-100 md:pl-4">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                            Consulting Specialist & Department
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Stethoscope className="w-4 h-4 text-sky-600 shrink-0" />
                            <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                              {apt.doctor_name || 'Dr. Specialist'}
                            </h4>
                          </div>
                          <p className="text-xs text-teal-700 font-semibold pl-5">
                            {apt.department || 'General Medicine'}
                            {apt.specialization && apt.specialization !== apt.department ? ` • ${apt.specialization}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Bottom Bar: Date & Time/Slot, Room, Live Queue Status, Cancel & Track Buttons */}
                      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs text-slate-600">
                          <span className="flex items-center gap-1 font-semibold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/60">
                            <Calendar className="w-3.5 h-3.5 text-sky-600" />
                            {apt.consultation_date}
                          </span>
                          <span className="flex items-center gap-1 font-semibold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/60">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            {apt.slot_time || apt.consultation_slot?.display_time || apt.slot || 'OPD Slot'}
                          </span>
                          <span className="flex items-center gap-1 text-slate-500">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {apt.room_number || apt.consultation_room || 'Room 204'}
                          </span>

                          {/* Current Queue Status if applicable */}
                          {apt.status !== 'cancelled' && (apt.current_queue_status || apt.queue_status || apt.queue_position) && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-800 text-[11px] font-bold rounded-lg border border-sky-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                              <span>Queue: {apt.current_queue_status || apt.queue_status || 'Waiting'}</span>
                              {apt.queue_position && apt.queue_position !== '-' && (
                                <span className="font-mono">(Pos #{apt.queue_position})</span>
                              )}
                            </span>
                          )}

                          {apt.status === 'cancelled' && (
                            <span className="text-[11px] text-rose-600 font-semibold bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200">
                              Reason: {apt.cancellation_reason || 'Cancelled by patient'}
                            </span>
                          )}
                        </div>

                        {/* Action Buttons: Cancel / Track */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {isCancellable(apt) && (
                            <button
                              type="button"
                              onClick={() => setCancellingAppointment(apt)}
                              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition cursor-pointer flex items-center gap-1.5"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>{t('cancel_appointment', 'Cancel')}</span>
                            </button>
                          )}

                          <Link
                            to={`/tracking?queue_id=${apt.queue_id || apt.booking_id}`}
                            className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 shadow-2xs"
                          >
                            <span>{t('live_token', 'Track Token')}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ACCOUNT & SECURITY */}
          {activeTab === 'security' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2 mb-1">
                  <Lock className="w-5 h-5 text-slate-700" />
                  <span>{t('account_security', 'Account & Security')}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Manage your account credentials, login security, and verify authenticated session details
                </p>
              </div>

              {/* Account Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    {t('account_status_label', 'Account Status')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-extrabold text-emerald-800">Active & Verified</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    {t('registered_phone', 'Registered Mobile')}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 font-mono">
                    {user?.phone || profileForm.phone || '—'}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    {t('email_address', 'Registered Email')}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {user?.email || profileForm.email || '—'}
                  </span>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* CHANGE PASSWORD CARD */}
              <div className="bg-slate-50/70 rounded-2xl border border-slate-200 p-5 sm:p-6 max-w-xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                    <KeyRound className="w-4 h-4 text-sky-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">{t('change_password', 'Change Password')}</h4>
                    <p className="text-[11px] text-slate-500">
                      Passwords are encrypted using secure PBKDF2/SHA256 password hashing.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('current_password', 'Current Password')} *
                    </label>
                    <input
                      type="password"
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm(p => ({ ...p, current_password: e.target.value }))}
                      required
                      placeholder="Enter your current password"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('new_password', 'New Password')} *
                    </label>
                    <input
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm(p => ({ ...p, new_password: e.target.value }))}
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('confirm_new_password', 'Confirm New Password')} *
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm(p => ({ ...p, confirm_password: e.target.value }))}
                      required
                      minLength={6}
                      placeholder="Re-enter your new password"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{pwdLoading ? t('updating_password', 'Updating password...') : t('change_password', 'Change Password')}</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Consultation Record Modal */}
      {selectedRecord && (
        <ConsultationRecordModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}

      {/* Cancel Appointment Modal */}
      {cancellingAppointment && (
        <CancelAppointmentModal
          appointment={cancellingAppointment}
          onClose={() => setCancellingAppointment(null)}
          onCancelled={() => {
            setCancellingAppointment(null);
            loadProfileData();
          }}
        />
      )}
    </div>
  );
}
