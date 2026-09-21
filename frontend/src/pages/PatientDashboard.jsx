import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  Stethoscope,
  Calendar,
  Clock,
  Navigation,
  DoorOpen,
  Plus,
  ArrowRight,
  ShieldCheck,
  Cpu,
  User,
  AlertTriangle,
  CheckCircle2,
  Ticket,
  ChevronRight,
  Sparkles,
  MapPin,
  RefreshCw,
  PhoneCall,
  Bell,
  FileText,
  Save,
  Check
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import DepartureCard from '../components/DepartureCard';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ConsultationRecordModal from '../components/ConsultationRecordModal';
import MyLiveQueueSection from '../components/MyLiveQueueSection';
import LateArrivalWarningCard from '../components/LateArrivalWarningCard';
import { getBrowserLocation } from '../services/locationService';

export default function PatientDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlTab = searchParams.get('tab');
  const getInitialTab = () => {
    if (urlTab === 'history' || urlTab === 'medical-history') return 'medical-history';
    if (urlTab && ['overview', 'appointments', 'notifications', 'profile'].includes(urlTab)) return urlTab;
    return 'overview';
  };

  const [appointments, setAppointments] = useState([]);
  const [activeQueue, setActiveQueue] = useState(null);
  const [liveQueueData, setLiveQueueData] = useState(null);
  const [queueRefreshing, setQueueRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [patientProfile, setPatientProfile] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState(getInitialTab);

  const handleTabChange = (tab) => {
    const canonicalTab = (tab === 'history' ? 'medical-history' : tab);
    setActiveTab(canonicalTab);
    if (canonicalTab === 'overview') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: canonicalTab });
    }
  };

  useEffect(() => {
    if (urlTab === 'history' || urlTab === 'medical-history') {
      setActiveTab('medical-history');
    } else if (urlTab && ['overview', 'appointments', 'notifications', 'profile'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    email: '',
    age: '',
    gender: 'Male',
    city: 'Tumakuru',
    height_cm: '',
    weight_kg: '',
    pdo: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const fetchMyLiveQueue = async (queueObj) => {
    if (!queueObj) {
      setLiveQueueData(null);
      return;
    }
    const doctorId = queueObj.doctor_id;
    const slotId = queueObj.slot_id || queueObj.consultation_slot?.slot_id;
    const date = queueObj.consultation_date || queueObj.consultation_slot?.date;
    const dept = queueObj.department;
    if (doctorId && slotId) {
      try {
        const pubData = await hospitalApi.getPublicQueue(dept, slotId, doctorId, date);
        setLiveQueueData(pubData);
      } catch (err) {
        console.error('Error fetching live queue for patient doctor slot:', err);
      }
    }
  };

  const handleRefreshLiveQueue = async () => {
    if (!activeQueue) return;
    setQueueRefreshing(true);
    try {
      const doctorId = activeQueue.doctor_id;
      const slotId = activeQueue.slot_id || activeQueue.consultation_slot?.slot_id;
      const date = activeQueue.consultation_date || activeQueue.consultation_slot?.date;
      const dept = activeQueue.department;
      const [freshQueue, pubData] = await Promise.all([
        hospitalApi.getMyActiveQueue(),
        hospitalApi.getPublicQueue(dept, slotId, doctorId, date)
      ]);
      if (freshQueue && freshQueue.queue_id) {
        setActiveQueue(freshQueue);
      }
      if (pubData) {
        setLiveQueueData(pubData);
      }
    } catch (e) {
      console.error('Manual queue refresh error:', e);
    } finally {
      setQueueRefreshing(false);
    }
  };

  const loadDashboardData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const patientId = user.patient_id || user.user_id;
      const [aptsData, queueData, notifsData, profileData, historyData] = await Promise.allSettled([
        patientId ? hospitalApi.getPatientAppointments(patientId) : Promise.resolve([]),
        hospitalApi.getMyActiveQueue(),
        patientId ? hospitalApi.getNotifications(patientId) : Promise.resolve([]),
        patientId ? hospitalApi.getPatientProfile(patientId).catch(() => null) : Promise.resolve(null),
        hospitalApi.getMyMedicalHistory().catch(() => ({ success: true, consultations: [] }))
      ]);

      if (aptsData.status === 'fulfilled' && aptsData.value) {
        setAppointments(Array.isArray(aptsData.value) ? aptsData.value : []);
      }
      if (queueData.status === 'fulfilled' && queueData.value && queueData.value.queue_id) {
        setActiveQueue(queueData.value);
        fetchMyLiveQueue(queueData.value);
      } else {
        setActiveQueue(null);
        setLiveQueueData(null);
      }
      if (notifsData.status === 'fulfilled' && notifsData.value) {
        const notifList = Array.isArray(notifsData.value) 
          ? notifsData.value 
          : Array.isArray(notifsData.value?.notifications)
            ? notifsData.value.notifications
            : [];
        setNotifications(notifList);
      }
      if (historyData.status === 'fulfilled' && historyData.value) {
        const historyRecords = historyData.value.consultations || 
          (Array.isArray(historyData.value) ? historyData.value : []);
        setMedicalHistory(historyRecords);
      }
      if (profileData.status === 'fulfilled' && profileData.value) {
        const p = profileData.value;
        setPatientProfile(p);
        setProfileForm({
          name: p.name || user.name || '',
          phone: p.phone || user.phone || '',
          email: p.email || user.email || '',
          age: p.age || user.age || '',
          gender: p.gender || user.gender || 'Male',
          city: p.city || user.city || user.address || 'Tumakuru',
          height_cm: p.height_cm || user.height_cm || '',
          weight_kg: p.weight_kg || user.weight_kg || '',
          pdo: p.pdo || ''
        });
      } else {
        setProfileForm({
          name: user.name || '',
          phone: user.phone || '',
          email: user.email || '',
          age: user.age || '',
          gender: user.gender || 'Male',
          city: user.city || user.address || 'Tumakuru',
          height_cm: user.height_cm || '',
          weight_kg: user.weight_kg || '',
          pdo: ''
        });
      }
    } catch (err) {
      console.error('Error fetching patient dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Real-time dynamic queue & notifications polling every 4 seconds
    const interval = setInterval(() => {
      if (user) {
        const patientId = user.patient_id || user.user_id;
        Promise.allSettled([
          patientId ? hospitalApi.getPatientAppointments(patientId) : Promise.resolve([]),
          hospitalApi.getMyActiveQueue(),
          patientId ? hospitalApi.getNotifications(patientId) : Promise.resolve([])
        ]).then(([aptsData, queueData, notifsData]) => {
          if (aptsData.status === 'fulfilled' && aptsData.value) {
            setAppointments(Array.isArray(aptsData.value) ? aptsData.value : []);
          }
          if (queueData.status === 'fulfilled' && queueData.value && queueData.value.queue_id) {
            setActiveQueue(queueData.value);
            fetchMyLiveQueue(queueData.value);
          } else {
            setActiveQueue(null);
            setLiveQueueData(null);
          }
          if (notifsData.status === 'fulfilled' && notifsData.value) {
            const notifList = Array.isArray(notifsData.value)
              ? notifsData.value
              : Array.isArray(notifsData.value?.notifications)
                ? notifsData.value.notifications
                : [];
            setNotifications(notifList);
          }
        }).catch(console.error);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [user]);

  const handleMarkAllNotifsRead = async () => {
    const patientId = user?.patient_id || user?.user_id;
    if (!patientId) return;
    try {
      await hospitalApi.markAllNotificationsRead(patientId);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const patientId = user?.patient_id || user?.user_id;
    if (!patientId) return;
    setProfileSaving(true);
    setProfileSuccess(false);
    try {
      await hospitalApi.updateMyProfile({
        name: profileForm.name,
        phone: profileForm.phone,
        email: profileForm.email,
        age: profileForm.age ? Number(profileForm.age) : null,
        gender: profileForm.gender,
        city: profileForm.city,
        height_cm: profileForm.height_cm ? Number(profileForm.height_cm) : null,
        weight_kg: profileForm.weight_kg ? Number(profileForm.weight_kg) : null,
        pdo: profileForm.pdo
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
      await loadDashboardData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleJoinQueue = async (appointment) => {
    setJoining(true);
    try {
      let originLat = appointment.origin_latitude ?? null;
      let originLon = appointment.origin_longitude ?? null;
      let isApprox = appointment.is_approximate ?? appointment.is_approximate_location ?? true;
      let locationSource = appointment.location_source || (originLat != null ? 'device_gps' : 'manual');
      let locationAddress = appointment.location_address || appointment.patient_address || appointment.city || 'Tumakuru';
      let patientAddress = locationAddress;
      let city = appointment.city || appointment.patient_address || user.city || user.address || 'Tumakuru';

      // Only query browser GPS if booking is for 'myself' or explicitly set as 'device_gps',
      // NEVER when booked for family with map_selected or manual location!
      const shouldQueryDeviceGps = (
        appointment.booking_for === 'myself' ||
        appointment.location_source === 'device_gps' ||
        (!appointment.booking_for && !appointment.location_source)
      );

      if (shouldQueryDeviceGps) {
        const freshGps = await getBrowserLocation({ timeout: 8000, maximumAge: 0 });

        if (freshGps.success && freshGps.latitude != null && freshGps.longitude != null) {
          originLat = freshGps.latitude;
          originLon = freshGps.longitude;
          isApprox = false;
          locationSource = 'device_gps';
          patientAddress = appointment.location_address || appointment.patient_address || 'Current GPS Location';
        }
      }

      const res = await hospitalApi.joinQueue({
        patient_id: user.patient_id || user.user_id,
        doctor_id: appointment.doctor_id,
        department: appointment.department,
        priority: appointment.priority || 'normal',
        symptoms: appointment.symptoms || [],
        custom_symptoms: appointment.custom_symptoms || '',
        city: city,
        patient_address: patientAddress,
        location_address: locationAddress,
        origin_latitude: originLat,
        origin_longitude: originLon,
        location_source: locationSource,
        is_approximate: isApprox,
        is_approximate_location: isApprox,
        booking_for: appointment.booking_for || 'myself',
        relation: appointment.relation || null,
        patient_name: appointment.patient_name || user.name
      });
      const queueId = res.queue_id || res.data?.queue_id;
      if (queueId) {
        navigate(`/tracking?queue_id=${queueId}`);
      }
    } catch (err) {
      console.error('Failed to join queue', err);
      alert(err.response?.data?.error || 'Unable to join live queue. Please retry.');
    } finally {
      setJoining(false);
    }
  };

  const [actionLoading, setActionLoading] = useState(false);

  const handleArrived = async (queueId) => {
    setActionLoading(true);
    try {
      await hospitalApi.arriveAtHospital(queueId);
      await loadDashboardData();
    } catch (err) {
      console.error(err);
      alert('Could not mark arrival. Please retry.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalateEmergency = async (queueId) => {
    if (!window.confirm('Are you experiencing an acute medical emergency? This will immediately escalate your queue priority to #1.')) return;
    setActionLoading(true);
    try {
      await hospitalApi.escalateEmergency(queueId);
      await loadDashboardData();
    } catch (err) {
      console.error(err);
      alert('Could not escalate emergency. Please notify hospital staff directly.');
    } finally {
      setActionLoading(false);
    }
  };

  const [leavingLoading, setLeavingLoading] = useState(false);
  const [leavingSuccessMsg, setLeavingSuccessMsg] = useState('');

  const handleConfirmLeaving = async (queueId) => {
    if (!queueId) return;
    setLeavingLoading(true);
    setLeavingSuccessMsg('');
    try {
      let coords = null;
      try {
        coords = await getBrowserLocation();
      } catch (e) {
        console.log('Using fallback coordinates for departure:', e);
      }
      const res = await hospitalApi.confirmLeavingNow(queueId, coords);
      if (res && (res.queue_entry || res.queue_id)) {
        const updatedEntry = res.queue_entry || res;
        setActiveQueue(prev => ({
          ...prev,
          ...updatedEntry,
          leaving_now: true,
          leave_reminder_status: 'LEAVING_CONFIRMED'
        }));
        setLeavingSuccessMsg('✓ Departure confirmed! Your travel progress is now actively synchronized with SIMSRH.');
        await loadDashboardData();
      }
    } catch (err) {
      console.error('Error confirming departure:', err);
      alert(err.response?.data?.error || 'Could not record departure. Please retry.');
    } finally {
      setLeavingLoading(false);
    }
  };

  const nowStr = new Date().toISOString().split('T')[0];
  const upcomingAppointments = appointments.filter(
    (a) => a.consultation_date >= nowStr && a.status !== 'completed' && a.status !== 'cancelled'
  );
  const pastAppointments = appointments.filter(
    (a) => a.consultation_date < nowStr || a.status === 'completed' || a.status === 'cancelled'
  );

  const nextAppointment = upcomingAppointments.length > 0 ? upcomingAppointments[0] : (appointments[0] || null);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <LoadingState message="Loading your patient portal records & queue status..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* TOP WELCOME BANNER (Blue/Teal Primary) */}
        <div className="relative overflow-hidden bg-gradient-to-r from-sky-900 via-slate-900 to-teal-950 rounded-3xl p-6 sm:p-10 text-white shadow-xl">
          <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full text-xs font-bold border border-sky-400/30">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Patient ID: {user?.patient_id || 'SHP-2026-PT'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 text-[11px]">{t('portal_active', 'Portal Active')}</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                {t('welcome_back', { name: user?.name || 'Valued Patient' }, `Welcome, ${user?.name || 'Valued Patient'}`)}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                {t('dashboard_subtitle', 'Track your upcoming consultations, monitor live OPD waiting tokens, and view smart departure calculations in real time.')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <button
                onClick={loadDashboardData}
                className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs transition flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
                title="Refresh Records"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">{t('refresh', 'Refresh')}</span>
              </button>
              <Link
                to="/book"
                className="flex-1 md:flex-none px-6 py-3 bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white font-bold rounded-2xl text-xs transition shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('book_consultation', 'Book Consultation')}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 4 SUMMARY STATS TILES (Strict Color System) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Active / Next Appointment (Blue/Teal) */}
          <div className="bg-white rounded-2xl p-5 border border-sky-100 shadow-xs hover:border-sky-300 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('upcoming_visits', 'Upcoming Visits')}</span>
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{upcomingAppointments.length}</div>
            <p className="text-[11px] text-sky-600 font-semibold mt-0.5">
              {upcomingAppointments.length > 0 ? t('confirmed_in_system', 'Confirmed in system') : t('no_upcoming_visits', 'No upcoming visits')}
            </p>
          </div>

          {/* Active Queue Token (Orange/Amber) */}
          <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-xs hover:border-amber-300 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('live_opd_token', 'Live OPD Token')}</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Ticket className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-amber-900">
              {activeQueue ? `#${activeQueue.position}` : t('none', 'None')}
            </div>
            <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
              {activeQueue ? t('token_in_progress', { token: activeQueue.queue_id }, `${activeQueue.queue_id} in progress`) : t('not_in_queue_line', 'Not in queue line')}
            </p>
          </div>

          {/* AI Wait Estimate (Purple) */}
          <div className="bg-white rounded-2xl p-5 border border-purple-100 shadow-xs hover:border-purple-300 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('ai_estimated_wait', 'AI Estimated Wait')}</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-purple-900">
              {typeof activeQueue?.predicted_wait_time === 'number' ? `~${activeQueue.predicted_wait_time}m` : '~5m'}
            </div>
            <p className="text-[11px] text-purple-700 font-semibold mt-0.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-500" />
              <span>ML Random Forest</span>
            </p>
          </div>

          {/* Completed Consultations (Green) */}
          <div 
            onClick={() => handleTabChange('medical-history')}
            className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-xs hover:border-emerald-300 hover:shadow-sm transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('completed_visits', 'Completed Visits')}</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-emerald-800">{medicalHistory.length}</div>
            <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
              <span>{t('view_medical_records', 'View medical records')}</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>

        </div>

        {/* TAB NAVIGATION: OVERVIEW | MEDICAL HISTORY | APPOINTMENTS | NOTIFICATIONS | PROFILE */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-xs font-bold scrollbar-thin">
          <button
            onClick={() => handleTabChange('overview')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 ${
              activeTab === 'overview'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {t('overview_live_token', 'Overview & Live Token')}
          </button>

          <button
            onClick={() => handleTabChange('medical-history')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              (activeTab === 'medical-history' || activeTab === 'history')
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-teal-300" />
            <span>{t('my_medical_history')}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              (activeTab === 'medical-history' || activeTab === 'history') ? 'bg-white text-teal-800' : 'bg-teal-100 text-teal-800'
            }`}>
              {medicalHistory.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('appointments')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeTab === 'appointments'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{t('appointment_bookings', 'Appointment Bookings')} ({appointments.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('notifications')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeTab === 'notifications'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{t('notifications_tab', 'Notifications')} ({notifications.length})</span>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-black">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('profile')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t('my_profile')}</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW & QUEUE TOKEN */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* URGENT REAL-TIME CALLOUT: DOCTOR IS CALLING PATIENT NOW */}
            {activeQueue && activeQueue.status === 'called' && (
              <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 rounded-3xl p-6 sm:p-7 text-white shadow-xl animate-pulse flex flex-col sm:flex-row items-center justify-between gap-4 border-2 border-white/40">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                    <PhoneCall className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-100 block">
                      {t('urgent_opd_notification', 'Urgent Live OPD Notification')}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-extrabold">
                      {t('doctor_calling_token', { token: activeQueue.queue_id }, `Doctor is Calling Your Token (#${activeQueue.queue_id}) Now!`)}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/90 mt-0.5">
                      {t('proceed_immediately_to', { room: activeQueue.room_number || 'Room 204' }, `Please proceed immediately to ${activeQueue.room_number || 'Room 204'} for your consultation.`)}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/tracking?queue_id=${activeQueue.queue_id}`}
                  className="w-full sm:w-auto px-8 py-3.5 bg-white text-slate-900 hover:bg-slate-100 font-extrabold rounded-2xl text-xs transition shadow-lg shrink-0 text-center cursor-pointer"
                >
                  {t('open_live_pass', 'Open Live Pass & Directions')}
                </Link>
              </div>
            )}

            {/* MISSED CONSULTATION CALLOUT: Patient was unavailable when called */}
            {activeQueue && (activeQueue.status === 'missed' || activeQueue.status === 'missed_consultation') && (
              <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 rounded-3xl p-6 sm:p-7 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 border-2 border-white/40">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-100 block">
                      {t('missed_alert_title')}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-extrabold">
                      Token #{activeQueue.queue_id} • {t('missed')}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/90 mt-0.5">
                      {t('missed_alert_desc')}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/tracking?queue_id=${activeQueue.queue_id}`}
                  className="w-full sm:w-auto px-8 py-3.5 bg-white text-amber-950 hover:bg-amber-50 font-extrabold rounded-2xl text-xs transition shadow-lg shrink-0 text-center cursor-pointer"
                >
                  {t('live_token')}
                </Link>
              </div>
            )}

            {/* LATE ARRIVAL REORDERED WARNING CARD */}
            {activeQueue?.late_arrival_reordered && (
              <LateArrivalWarningCard
                queueData={activeQueue}
                totalQueueLength={
                  liveQueueData?.doctor_queues?.[activeQueue.doctor_id]?.entries?.length ||
                  liveQueueData?.queue_entries?.length ||
                  activeQueue.total_active_queue ||
                  null
                }
              />
            )}

            {/* MY LIVE QUEUE SECTION (Strictly doctor_id + consultation_date + consultation_slot) */}
            {activeQueue && (
              <MyLiveQueueSection
                activeQueue={activeQueue}
                liveQueueData={liveQueueData}
                onRefresh={handleRefreshLiveQueue}
                refreshing={queueRefreshing}
              />
            )}

            {/* TRAVEL TRANSIT & ARRIVAL VERIFICATION */}
            {activeQueue && (
              <div className="bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-teal-500/10 rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-md space-y-6">

                {/* INTERACTIVE "I'M LEAVING NOW" & TRAVEL TRANSIT SECTION */}
                <div className="bg-white/95 rounded-2xl p-5 border border-sky-200/80 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                        <Navigation className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                          {t('real_time_travel_guidance', 'Real-Time Travel & Departure Guidance')}
                        </span>
                        <div className="text-[11px] text-slate-500">
                          {t('destination_simsrh', 'Destination: Shridevi Institute of Medical Sciences (SIMSRH), Lingapura, Tumakuru')}
                        </div>
                      </div>
                    </div>

                    {/* Durable Reminder Alert Badge */}
                    {activeQueue.leave_reminder_status && activeQueue.leave_reminder_status !== 'NOT_REQUIRED' && (
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1 ${
                        activeQueue.leave_reminder_status === 'LEAVING_CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : activeQueue.leave_reminder_status === 'URGENT_REMINDER_SENT'
                          ? 'bg-rose-100 text-rose-800 animate-bounce'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        <span>● {t('reminder', 'Reminder')}: {activeQueue.leave_reminder_status.replace(/_/g, ' ')}</span>
                      </span>
                    )}
                  </div>

                  {/* Departure Status / Interactive Action */}
                  {activeQueue.leaving_now ? (
                    <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                          ✓
                        </div>
                        <div>
                          <div className="text-xs font-black text-emerald-900">
                            {t('on_your_way_to_simsrh', "You're On Your Way to SIMSRH!")}
                          </div>
                          <div className="text-[11px] text-emerald-700 mt-0.5">
                            {t('departed_at', {
                              time: activeQueue.leaving_now_at ? new Date(activeQueue.leaving_now_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently',
                              mins: activeQueue.travel_info?.travel_time_minutes || 15
                            }, `Departed at ${activeQueue.leaving_now_at ? new Date(activeQueue.leaving_now_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}. Expected transit: ~${activeQueue.travel_info?.travel_time_minutes || 15} mins.`)}
                          </div>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-white text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold shadow-2xs">
                        {t('expected_arrival', 'Expected Arrival')}: ~{activeQueue.expected_arrival_time || activeQueue.expected_consultation_time || 'On Schedule'}
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 bg-gradient-to-r from-sky-50 to-teal-50 border border-sky-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">
                          {t('starting_journey_question', 'Are you starting your journey to SIMSRH now?')}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 max-w-lg">
                          {t('recommended_departure')}: <strong className="text-teal-800 font-bold">{activeQueue.recommended_departure_time || activeQueue.travel_info?.recommended_departure_time || 'Leave Soon'}</strong> ({t('expected_consultation_time')}: <strong className="text-sky-800 font-bold">{activeQueue.expected_consultation_time || activeQueue.travel_info?.expected_consultation_time || '~15m'}</strong>).
                        </p>
                        {leavingSuccessMsg && (
                          <div className="text-xs font-bold text-emerald-700 mt-1">
                            {leavingSuccessMsg}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleConfirmLeaving(activeQueue.queue_id)}
                        disabled={leavingLoading}
                        className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 text-white rounded-xl text-xs font-black transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shrink-0"
                      >
                        {leavingLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{t('confirming_departure', 'Confirming Departure...')}</span>
                          </>
                        ) : (
                          <>
                            <Navigation className="w-4 h-4" />
                            <span>{t('im_leaving_now_btn', "I'M LEAVING NOW")}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* 6-DIGIT HOSPITAL ARRIVAL VERIFICATION CODE CARD */}
                <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white p-6 rounded-2xl border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 block">
                      {t('arrival_otp')}
                    </span>
                    <div className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-emerald-400 mt-1">
                      {activeQueue.arrival_otp || '123456'}
                    </div>
                    <p className="text-xs text-slate-300 mt-1 max-w-lg">
                      {t('arrival_otp_instruction')}
                    </p>
                  </div>

                  <div>
                    {activeQueue.verified_by_admin || activeQueue.arrived_at_hospital ? (
                      <span className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold inline-flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{t('arrival_verified_reception', 'Arrival Verified at Reception Desk')}</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleArrived(activeQueue.queue_id)}
                        disabled={actionLoading}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('i_have_arrived_reception', 'I Have Arrived at Reception')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* MAIN SECTION: UPCOMING CONSULTATION CARD */}
            {nextAppointment ? (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm hover:shadow-md transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-5 mb-6 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-sky-100 text-sky-700 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-sky-600 block">
                          {t('confirmed_upcoming_consultation', 'Confirmed Upcoming Consultation')}
                        </span>
                        <h3 className="text-lg font-extrabold text-slate-900">
                          {t('booking_reference', 'Booking Reference')}: <span className="font-mono text-sky-700">{nextAppointment.booking_id}</span>
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge status={nextAppointment.priority || 'normal'} type="priority" />
                      <StatusBadge status={nextAppointment.status} type="status" />
                    </div>
                  </div>

                  {nextAppointment.booking_for === 'family' && (
                    <div className="mb-6 p-4 bg-sky-50/80 rounded-2xl border border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium">{t('appointment_for', 'Appointment for')}:</span>
                            <span className="font-extrabold text-slate-900">{nextAppointment.patient_name || 'Family Member'}</span>
                            {nextAppointment.relation && (
                              <span className="px-2 py-0.5 rounded-full bg-sky-200/80 text-sky-800 text-[10px] font-bold">
                                {nextAppointment.relation}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span>{nextAppointment.location_address || nextAppointment.patient_address || nextAppointment.city}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {nextAppointment.is_approximate ? (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200">
                            {t('approximate_notice', 'Approximate location — travel time may vary.')}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 text-[11px] font-bold border border-sky-200">
                            {nextAppointment.location_source === 'map_selected' ? t('location_source_map', 'Map Selected') : t('device_gps_confirmed', 'Device Location')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">{t('specialist_and_opd', 'Specialist & Specialty')}</span>
                      <div className="text-base font-bold text-slate-900">{nextAppointment.doctor_id || 'Specialist Doctor'}</div>
                      <div className="text-xs font-bold text-sky-700 mt-0.5">{nextAppointment.department || 'Clinical OPD'}</div>
                    </div>

                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">{t('chamber_room', 'Clinic & Room')}</span>
                      <div className="text-base font-bold text-emerald-700 flex items-center gap-1.5 mt-0.5">
                        <DoorOpen className="w-4 h-4" />
                        <span>{nextAppointment.room_number || 'Room 204'}</span>
                      </div>
                      <div className="text-xs text-slate-500">SIMSRH Campus, Sira Road, Tumakuru</div>
                    </div>

                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">{t('scheduled_date_token', 'Scheduled Date & Token')}</span>
                      <div className="text-base font-bold text-slate-900 mt-0.5">{nextAppointment.consultation_date}</div>
                      <div className="text-xs font-mono font-bold text-sky-700">
                        {nextAppointment.queue_id ? `${t('token')}: ${nextAppointment.queue_id}` : t('token_assigned_on_entry', 'Token Assigned on Entry')}
                      </div>
                    </div>
                  </div>

                  {/* Symptoms summary */}
                  {nextAppointment.symptoms && nextAppointment.symptoms.length > 0 && (
                    <div className="bg-slate-50 p-4 rounded-2xl mb-6 text-xs text-slate-700 border border-slate-100">
                      <span className="font-bold text-slate-900 block mb-1.5">{t('reported_symptoms')}:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {nextAppointment.symptoms.map((s, i) => (
                          <span key={i} className="px-2.5 py-1 bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">
                            {s}
                          </span>
                        ))}
                        {nextAppointment.custom_symptoms && (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-800 text-xs font-semibold rounded-lg border border-amber-200">
                            {nextAppointment.custom_symptoms}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-slate-100 pt-5 gap-3">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>{t('consultation_registered_msg')}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {nextAppointment.queue_id ? (
                        <Link
                          to={`/tracking?queue_id=${nextAppointment.queue_id}`}
                          className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
                        >
                          <span>{t('track_consultation', 'Track Live Queue & Pass')}</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleJoinQueue(nextAppointment)}
                          disabled={joining}
                          className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                        >
                          <span>{joining ? t('loading', 'Assigning Token...') : t('enter_live_queue', 'Enter Live Queue')}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* INTEGRATED TUMKUR SMART DEPARTURE CARD - ONLY AFTER LEAVING STARTED */}
                {(activeQueue?.leaving_now || nextAppointment?.leaving_now) && (
                  <DepartureCard travelInfo={{
                    ...(activeQueue?.travel_info || nextAppointment?.travel_info || {}),
                    expected_consultation_time: activeQueue?.expected_consultation_time || activeQueue?.travel_info?.expected_consultation_time,
                    expected_consultation_iso: activeQueue?.expected_consultation_iso || activeQueue?.travel_info?.expected_consultation_iso,
                    recommended_departure_time: activeQueue?.recommended_departure_time || activeQueue?.travel_info?.recommended_departure_time,
                    recommended_departure_iso: activeQueue?.recommended_departure_iso || activeQueue?.travel_info?.recommended_departure_iso,
                    location_source: activeQueue?.location_source || activeQueue?.travel_info?.location_source || nextAppointment?.location_source,
                    location_address: activeQueue?.location_address || activeQueue?.travel_info?.location_address || nextAppointment?.location_address,
                    is_approximate: activeQueue?.is_approximate ?? activeQueue?.travel_info?.is_approximate ?? nextAppointment?.is_approximate,
                    is_approximate_location: activeQueue?.is_approximate_location ?? activeQueue?.travel_info?.is_approximate_location ?? nextAppointment?.is_approximate,
                    booking_for: activeQueue?.booking_for || nextAppointment?.booking_for,
                    relation: activeQueue?.relation || nextAppointment?.relation,
                    leaving_now: true
                  }} />
                )}
              </div>
            ) : (
              /* EMPTY STATE */
              <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-slate-200/90 shadow-sm max-w-lg mx-auto space-y-4">
                <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                  <Stethoscope className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 mb-1">{t('no_active_consultations', 'No Active Consultations Found')}</h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
                    {t('schedule_appointment_prompt', 'Schedule an appointment with an OPD specialist at SIMSRH Tumakuru to receive a queue token and transit departure guidance.')}
                  </p>
                </div>
                <Link
                  to="/book"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
                >
                  <span>{t('schedule_consultation', 'Schedule Consultation')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            {/* RECENT MEDICAL CONSULTATION SPOTLIGHT */}
            {medicalHistory.length > 0 && (
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-teal-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700 block">
                        {t('recent_clinical_consultation')}
                      </span>
                      <h4 className="text-base font-extrabold text-slate-900">
                        {medicalHistory[0].doctor_name || medicalHistory[0].doctor_id || t('attending_physician')}
                        <span className="text-xs font-semibold text-slate-500 ml-2">
                          ({medicalHistory[0].department || 'General Medicine'})
                        </span>
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      {medicalHistory[0].consultation_date || (medicalHistory[0].created_at ? medicalHistory[0].created_at.split('T')[0] : t('recent'))}
                    </span>
                    <button
                      onClick={() => handleTabChange('medical-history')}
                      className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>{t('view_all')} ({medicalHistory.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-sky-50/50 rounded-xl border border-sky-100">
                    <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block mb-1">
                      {t('reported_symptoms')}
                    </span>
                    <p className="text-slate-700 font-medium">
                      {(medicalHistory[0].patient_reported?.symptoms || medicalHistory[0].symptoms || []).join(', ') || 'Routine consultation'}
                    </p>
                  </div>

                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                      {t('clinical_assessment_diagnosis')}
                    </span>
                    <p className="text-slate-800 font-semibold">
                      {medicalHistory[0].doctor_assessment?.diagnosis || medicalHistory[0].diagnosis || (
                        <span className="italic text-slate-400">{t('diagnosis_pending_entry')}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    Ref: <strong className="font-mono text-slate-600">{medicalHistory[0].queue_id || medicalHistory[0].consultation_id || 'OPD-REC'}</strong>
                  </span>
                  <button
                    onClick={() => setSelectedRecord(medicalHistory[0])}
                    className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{t('view_full_record')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NOTIFICATIONS & LIVE TRANSIT ALERTS */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Hospital Transit & Queue Alerts</h3>
                <p className="text-xs text-slate-500">Live departure notices, queue predictions, and hospital arrival updates</p>
              </div>
              {notifications.length > 0 && (
                <button
                  onClick={handleMarkAllNotifsRead}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Mark All as Read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="font-bold text-slate-700">No active notifications.</p>
                <p className="text-slate-400 text-[11px] mt-0.5">You will receive departure alerts and wait time estimates when you book a consultation.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <div key={n.notification_id || Math.random()} className={`py-4 flex items-start gap-4 ${!n.read ? 'bg-sky-50/40 p-3 rounded-2xl' : ''}`}>
                    <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-extrabold text-xs text-slate-900">{n.title}</span>
                        <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[10px] font-bold rounded-md">
                          {n.type || 'Alert'}
                        </span>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-sky-600" />
                        )}
                      </div>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">{n.message}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY MEDICAL HISTORY (Chronological Consultation Timeline) */}
        {(activeTab === 'medical-history' || activeTab === 'history') && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                    SIMSRH Patient EMR
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">{t('my_medical_history')}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('medical_history_subtitle')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  <span>{medicalHistory.length} {t('total_visits')}</span>
                </span>
              </div>
            </div>

            {medicalHistory.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-sm space-y-3">
                <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-base font-bold text-slate-800">{t('no_history_yet')}</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Completed consultations and physician clinical assessments will automatically appear here chronologically once your consultation is concluded by your doctor.
                </p>
                <Link
                  to="/book"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition mt-2"
                >
                  <Plus className="w-4 h-4" /> Book a Consultation
                </Link>
              </div>
            ) : (
              <div className="relative pl-4 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-teal-200">
                {medicalHistory.map((item, idx) => {
                  const date = item.consultation_date || (item.created_at ? item.created_at.split('T')[0] : 'N/A');
                  const time = item.consultation_time || (item.created_at && item.created_at.includes('T') ? item.created_at.split('T')[1].substring(0, 5) : 'OPD Hours');
                  const vitals = item.vitals_at_consultation || {};
                  const pReported = item.patient_reported || {};
                  const dAssess = item.doctor_assessment || {};
                  const symptoms = pReported.symptoms || item.symptoms || [];
                  const symptomsList = Array.isArray(symptoms) ? symptoms : [symptoms];
                  const diagnosis = dAssess.diagnosis || item.diagnosis;
                  const notes = dAssess.notes || item.doctor_notes;
                  const advice = dAssess.advice || item.doctor_advice;
                  const itemHeight = vitals.height_cm ?? item.height_cm;
                  const itemWeight = vitals.weight_kg ?? item.weight_kg;
                  const itemBmi = vitals.bmi ?? (itemHeight && itemWeight ? (itemWeight / Math.pow(itemHeight / 100, 2)).toFixed(1) : null);

                  return (
                    <div key={item.consultation_id || item.queue_id || idx} className="relative group">
                      {/* Timeline Dot */}
                      <div className="absolute -left-4 sm:-left-8 top-6 -translate-x-1/2 w-4 h-4 rounded-full bg-teal-600 border-4 border-white shadow-sm group-hover:scale-125 transition-transform" />

                      {/* Consultation Card */}
                      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-teal-300 transition space-y-5">
                        {/* Top Section: Patient Full Name & Clinical Reference Identifiers */}
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                                Consultation Record
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                                Patient ID: {item.patient_id || user?.patient_id || 'N/A'}
                              </span>
                              <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                ID: {item.consultation_id || item.queue_id || 'OPD-REC'}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3" /> {t('visit_completed')}
                              </span>
                            </div>

                            {/* Patient's FULL NAME prominently displayed */}
                            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 pt-0.5">
                              <User className="w-5 h-5 text-teal-600 shrink-0" />
                              <span>{item.patient_name || user?.name || 'Patient'}</span>
                            </h3>

                            {/* Doctor, Department, Date & Time */}
                            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 pt-0.5">
                              <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                                <span>{item.doctor_name || item.doctor_id || 'Attending Specialist'}</span>
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                {item.department || 'General Medicine'}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-bold text-teal-700 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" /> {date}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500 flex items-center gap-1 font-medium">
                                <Clock className="w-3.5 h-3.5" /> {time}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedRecord(item)}
                            className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                          >
                            <FileText className="w-4 h-4" />
                            <span>{t('view_full_record')}</span>
                          </button>
                        </div>

                        {/* Vitals Summary Bar (Age, Gender, Height, Weight, BMI, Illness Duration, Origin) */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70">
                          <div>
                            <span className="text-slate-400 block text-[10px] font-bold uppercase">{t('age_years')}</span>
                            <span className="font-bold text-slate-800 mt-0.5 block">{vitals.age ?? item.age ?? '—'} yrs</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] font-bold uppercase">{t('gender')}</span>
                            <span className="font-bold text-slate-800 mt-0.5 block">{vitals.gender ?? item.gender ?? '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] font-bold uppercase">{t('height')}</span>
                            <span className="font-bold text-slate-800 mt-0.5 block">{itemHeight ? `${itemHeight} cm` : '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] font-bold uppercase">{t('weight')}</span>
                            <span className="font-bold text-slate-800 mt-0.5 block">{itemWeight ? `${itemWeight} kg` : '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] font-bold uppercase">{t('calculated_bmi')}</span>
                            <span className="font-extrabold text-teal-700 mt-0.5 block">{itemBmi ? `${itemBmi} kg/m²` : '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] font-bold uppercase">Duration</span>
                            <span className="font-bold text-slate-800 mt-0.5 block">{pReported.duration_days ?? item.duration_days ?? 1} day(s)</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] font-bold uppercase">Origin</span>
                            <span className="font-bold text-slate-800 mt-0.5 block truncate" title={vitals.city || item.city || 'Tumakuru'}>
                              📍 {vitals.city || item.city || 'Tumakuru'}
                            </span>
                          </div>
                        </div>

                        {/* Two Column Clinical Comparison */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left Column: Patient-Reported Complaints */}
                          <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/40 space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1">
                              <User className="w-3 h-3" /> {t('patient_reported_complaints')}
                            </span>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {symptomsList.length > 0 ? (
                                symptomsList.map((s, sIdx) => (
                                  <span key={sIdx} className="px-2 py-0.5 rounded text-xs font-semibold bg-white text-sky-900 border border-sky-200 shadow-xs">
                                    • {s}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs italic text-slate-400">No symptoms reported</span>
                              )}
                            </div>
                            {pReported.duration_days && (
                              <p className="text-xs text-slate-600 font-medium pt-1">
                                Duration of Illness: <strong>{pReported.duration_days} day(s)</strong>
                              </p>
                            )}
                            {pReported.custom_symptoms && (
                              <p className="text-xs text-slate-600 italic bg-white p-2 rounded border border-sky-100">
                                "{pReported.custom_symptoms}"
                              </p>
                            )}
                          </div>

                          {/* Right Column: Doctor-Recorded Assessment */}
                          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                              <Stethoscope className="w-3 h-3" /> {t('doctor_assessment')}
                            </span>
                            <div>
                              <span className="text-[11px] text-slate-400 font-semibold block">{t('diagnosis')}:</span>
                              {diagnosis ? (
                                <span className="text-xs font-bold text-emerald-900 bg-white px-2 py-1 rounded inline-block border border-emerald-200 mt-0.5">
                                  {diagnosis}
                                </span>
                              ) : (
                                <span className="text-xs italic text-slate-500">
                                  {t('no_diagnosis_recorded')}
                                </span>
                              )}
                            </div>
                            {notes && (
                              <p className="text-xs text-slate-700 pt-1 line-clamp-2">
                                <strong className="text-slate-900">Notes: </strong>{notes}
                              </p>
                            )}
                            {advice && (
                              <p className="text-xs text-slate-700 line-clamp-2">
                                <strong className="text-slate-900">Advice: </strong>{advice}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: APPOINTMENT BOOKINGS */}
        {activeTab === 'appointments' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{t('consultation_bookings')}</h3>
                <p className="text-xs text-slate-500">{t('bookings_subtitle')}</p>
              </div>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
                {appointments.length} {t('bookings')}
              </span>
            </div>

            {appointments.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p>{t('no_appointments_found')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                      <th className="pb-3 px-3">{t('booking_id', 'Booking ID')}</th>
                      <th className="pb-3 px-3">{t('token', 'Token #')}</th>
                      <th className="pb-3 px-3">{t('patient_and_origin', 'Patient & Origin')}</th>
                      <th className="pb-3 px-3">{t('doctor_and_dept', 'Doctor & Dept')}</th>
                      <th className="pb-3 px-3">{t('date', 'Date')}</th>
                      <th className="pb-3 px-3">{t('priority', 'Priority')}</th>
                      <th className="pb-3 px-3">{t('status', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {appointments.map((apt) => (
                      <tr key={apt.booking_id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 font-mono font-bold text-sky-700">{apt.booking_id}</td>
                        <td className="py-3 px-3 font-mono font-black text-slate-900">{apt.queue_id || '—'}</td>
                        <td className="py-3 px-3 text-[11px]">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{apt.patient_name || user?.name || 'Patient'}</span>
                            {apt.booking_for === 'family' && apt.relation && (
                              <span className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 text-[10px] font-bold">
                                {apt.relation}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500 flex items-center gap-1 mt-0.5 max-w-[170px] truncate" title={apt.location_address || apt.patient_address || apt.city}>
                            <MapPin className="w-3 h-3 text-sky-500 shrink-0" />
                            <span>{apt.location_address || apt.patient_address || apt.city || 'Tumakuru'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[11px]">
                          <div className="font-bold text-slate-900">{apt.doctor_id}</div>
                          <div className="text-sky-700 font-semibold">{apt.department}</div>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">{apt.consultation_date}</td>
                        <td className="py-3 px-3">
                          <StatusBadge status={apt.priority || 'normal'} type="priority" />
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={apt.status} type="status" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MY PATIENT PROFILE (Dedicated persistent profile viewing and editing) */}
        {activeTab === 'profile' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                    Patient ID: {user?.patient_id || patientProfile?.patient_id || 'N/A'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Verified Profile</span>
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">{t('patient_profile', 'Patient Profile & Master Record')}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage your persistent hospital registration details, physical vitals, and contact information.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTabChange('medical-history')}
                  className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-teal-200 cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-teal-600" />
                  <span>View Medical History ({medicalHistory.length})</span>
                </button>
              </div>
            </div>

            {profileSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 shadow-xs">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">{t('profile_updated_success', 'Patient profile details updated successfully!')}</span>
              </div>
            )}

            {/* 2-Column Responsive Layout: Left = Master Profile Card, Right = Edit Form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT: MASTER PATIENT PROFILE CARD (5 cols) */}
              <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-6">
                <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-teal-600 text-white flex items-center justify-center text-2xl font-black shadow-md shadow-sky-600/20 shrink-0">
                    {(profileForm.name || user?.name || 'P').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900 leading-tight">
                      {profileForm.name || user?.name || 'Valued Patient'}
                    </h4>
                    <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded mt-1 inline-block border border-sky-200">
                      ID: {user?.patient_id || patientProfile?.patient_id || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Contact & Origin Summary */}
                <div className="space-y-3 text-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Contact & Geographic Origin
                  </span>
                  
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5 text-slate-400" /> Phone
                    </span>
                    <span className="font-mono font-bold text-slate-900">{profileForm.phone || user?.phone || '—'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" /> Email
                    </span>
                    <span className="font-semibold text-slate-900 truncate max-w-[180px]">{profileForm.email || user?.email || 'Not Provided'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> Village / City
                    </span>
                    <span className="font-bold text-slate-900">{profileForm.city || 'Tumakuru'}</span>
                  </div>
                </div>

                {/* Demographics & Physical Vitals */}
                <div className="space-y-3 text-xs pt-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Demographics & Physical Vitals
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-[11px] block">{t('age_years')}</span>
                      <span className="font-black text-slate-900 text-sm mt-0.5 block">{profileForm.age || '—'} yrs</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-[11px] block">{t('gender')}</span>
                      <span className="font-black text-slate-900 text-sm mt-0.5 block">{profileForm.gender || '—'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-[11px] block">{t('height')}</span>
                      <span className="font-black text-slate-900 text-sm mt-0.5 block">{profileForm.height_cm ? `${profileForm.height_cm} cm` : '—'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-[11px] block">{t('weight')}</span>
                      <span className="font-black text-slate-900 text-sm mt-0.5 block">{profileForm.weight_kg ? `${profileForm.weight_kg} kg` : '—'}</span>
                    </div>
                  </div>
                </div>

                {/* BMI Health Status Spotlight */}
                {(() => {
                  const h = Number(profileForm.height_cm);
                  const w = Number(profileForm.weight_kg);
                  const bmiVal = (h && w) ? (w / Math.pow(h / 100, 2)).toFixed(1) : null;
                  let bmiCategory = 'Awaiting Height & Weight';
                  let bmiColor = 'bg-slate-100 text-slate-600 border-slate-200';
                  if (bmiVal) {
                    const num = Number(bmiVal);
                    if (num < 18.5) {
                      bmiCategory = 'Underweight (<18.5)';
                      bmiColor = 'bg-amber-100 text-amber-900 border-amber-300';
                    } else if (num < 25) {
                      bmiCategory = 'Normal / Healthy Weight (18.5–24.9)';
                      bmiColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                    } else if (num < 30) {
                      bmiCategory = 'Overweight (25–29.9)';
                      bmiColor = 'bg-purple-100 text-purple-900 border-purple-300';
                    } else {
                      bmiCategory = 'Obese (≥30)';
                      bmiColor = 'bg-rose-100 text-rose-900 border-rose-300';
                    }
                  }

                  return (
                    <div className="p-4 rounded-2xl border border-teal-200 bg-teal-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-teal-600" /> Body Mass Index (BMI)
                        </span>
                        <span className="font-mono font-black text-sm text-teal-900">
                          {bmiVal ? `${bmiVal} kg/m²` : '—'}
                        </span>
                      </div>
                      <div className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border text-center ${bmiColor}`}>
                        {bmiCategory}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* RIGHT: UPDATE PATIENT PROFILE FORM (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-base font-extrabold text-slate-900">{t('update_profile_info')}</h4>
                  <p className="text-xs text-slate-500">{t('edit_profile_desc')}</p>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">{t('full_name')} *</label>
                      <input
                        type="text"
                        required
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">{t('phone_number')} *</label>
                      <input
                        type="tel"
                        required
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="e.g. 9876543210"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">{t('email', 'Email Address')}</label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        placeholder="patient@example.com"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">{t('village_city')} *</label>
                      <input
                        type="text"
                        required
                        value={profileForm.city}
                        onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                        placeholder="e.g. Tumakuru, Sira, Gubbi"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">{t('age_years')}</label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={profileForm.age}
                        onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })}
                        placeholder="e.g. 38"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">{t('gender')}</label>
                      <select
                        value={profileForm.gender}
                        onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                      >
                        <option value="Male">{t('male', 'Male')}</option>
                        <option value="Female">{t('female', 'Female')}</option>
                        <option value="Other">{t('other', 'Other')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">{t('height')} (cm)</label>
                      <input
                        type="number"
                        min="40"
                        max="250"
                        value={profileForm.height_cm}
                        onChange={(e) => setProfileForm({ ...profileForm, height_cm: e.target.value })}
                        placeholder="e.g. 172"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">{t('weight')} (kg)</label>
                      <input
                        type="number"
                        min="2"
                        max="300"
                        value={profileForm.weight_kg}
                        onChange={(e) => setProfileForm({ ...profileForm, weight_kg: e.target.value })}
                        placeholder="e.g. 68"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">{t('calculated_bmi')}</label>
                      <div className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-teal-800">
                        {profileForm.height_cm && profileForm.weight_kg 
                          ? `${(Number(profileForm.weight_kg) / Math.pow(Number(profileForm.height_cm) / 100, 2)).toFixed(1)} kg/m²` 
                          : 'Enter Ht & Wt'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{t('pdo_ref_optional')}</label>
                    <input
                      type="text"
                      value={profileForm.pdo || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, pdo: e.target.value })}
                      placeholder={t('optional_health_card')}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{profileSaving ? t('saving_profile') : t('update_profile', 'Update Profile Details')}</span>
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Full Consultation Record Modal */}
      {selectedRecord && (
        <ConsultationRecordModal 
          record={selectedRecord} 
          onClose={() => setSelectedRecord(null)} 
        />
      )}
    </div>
  );
}