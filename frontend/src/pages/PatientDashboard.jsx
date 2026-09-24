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
  Ban,
  Building2,
  ExternalLink
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import DepartureCard from '../components/DepartureCard';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ConsultationRecordModal from '../components/ConsultationRecordModal';
import CancelAppointmentModal from '../components/CancelAppointmentModal';
import MyLiveQueueSection from '../components/MyLiveQueueSection';
import LateArrivalWarningCard from '../components/LateArrivalWarningCard';
import { getBrowserLocation } from '../services/locationService';

export default function PatientDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Redirect legacy tabs to dedicated routes
  const urlTab = searchParams.get('tab');
  useEffect(() => {
    if (urlTab === 'profile') {
      navigate('/patient/profile', { replace: true });
    } else if (urlTab === 'history' || urlTab === 'medical-history') {
      navigate('/patient/history', { replace: true });
    }
  }, [urlTab, navigate]);

  const [appointments, setAppointments] = useState([]);
  const [activeQueue, setActiveQueue] = useState(null);
  const [liveQueueData, setLiveQueueData] = useState(null);
  const [queueRefreshing, setQueueRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [cancellingAppointment, setCancellingAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leavingLoading, setLeavingLoading] = useState(false);

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
      const [aptsData, queueData, notifsData, historyData] = await Promise.allSettled([
        patientId ? hospitalApi.getPatientAppointments(patientId) : Promise.resolve([]),
        hospitalApi.getMyActiveQueue(),
        patientId ? hospitalApi.getNotifications(patientId) : Promise.resolve([]),
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
        const histList = historyData.value.consultations || (Array.isArray(historyData.value) ? historyData.value : []);
        setMedicalHistory(histList);
      }
    } catch (err) {
      console.error('Error fetching patient dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Real-time dynamic queue & notifications polling every 5 seconds
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
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user]);

  const handleJoinQueue = async (appointment) => {
    setJoining(true);
    try {
      const coords = await getBrowserLocation().catch(() => null);
      const res = await hospitalApi.joinQueue(appointment.booking_id, coords);
      if (res.queue_id) {
        await loadDashboardData();
        navigate(`/tracking?queue_id=${res.queue_id}`);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to enter queue');
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveNow = async (queueId) => {
    setLeavingLoading(true);
    try {
      const coords = await getBrowserLocation().catch(() => null);
      await hospitalApi.confirmLeavingNow(queueId, coords);
      await loadDashboardData();
    } catch (e) {
      console.error('Error confirming departure:', e);
    } finally {
      setLeavingLoading(false);
    }
  };

  const handleMarkAllNotifsRead = async () => {
    if (!user) return;
    try {
      const patientId = user.patient_id || user.user_id;
      await hospitalApi.markAllNotificationsRead(patientId);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error('Error marking notifications as read:', e);
    }
  };

  const isCancellable = (apt) => {
    if (!apt) return false;
    const status = (apt.status || '').toLowerCase();
    const nonCancellable = ['in_consultation', 'completed', 'cancelled', 'missed', 'missed_consultation', 'no_show'];
    return !nonCancellable.includes(status);
  };

  const nowStr = new Date().toISOString().split('T')[0];
  const upcomingAppointments = appointments.filter(
    (a) => a.consultation_date >= nowStr && a.status !== 'completed' && a.status !== 'cancelled'
  );
  const nextAppointment = upcomingAppointments.length > 0 ? upcomingAppointments[0] : (appointments[0] || null);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <LoadingState message="Loading your patient dashboard overview & live queue status..." />
      </div>
    );
  }

  const patientName = user?.name || 'Valued Patient';
  const patientId = user?.patient_id || 'P001';
  const initialLetter = patientName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        {/* 1. TOP WELCOME BANNER */}
        <div className="relative overflow-hidden bg-gradient-to-r from-sky-900 via-slate-900 to-teal-950 rounded-3xl p-6 sm:p-10 text-white shadow-xl">
          <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full text-xs font-bold border border-sky-400/30">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Patient ID: {patientId}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 text-[11px]">{t('portal_active', 'Portal Active')}</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                {t('welcome_back', { name: patientName }, `Welcome, ${patientName}`)}
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

        {/* 2. SUMMARY TILES: UPCOMING VISITS | ACTIVE TOKEN | MEDICAL RECORDS | PROFILE LINK */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Upcoming Visits */}
          <div className="bg-white rounded-2xl p-5 border border-sky-100 shadow-xs hover:border-sky-300 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('upcoming_visits', 'Upcoming Visits')}
              </span>
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{upcomingAppointments.length}</div>
            <p className="text-[11px] text-sky-600 font-semibold mt-0.5">
              {upcomingAppointments.length > 0 ? t('confirmed_in_system', 'Confirmed in system') : t('no_upcoming_visits', 'No upcoming visits')}
            </p>
          </div>

          {/* Active OPD Queue Token */}
          <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-xs hover:border-amber-300 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('active_token', 'Live OPD Token')}
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Ticket className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900">
              {activeQueue?.queue_id ? `#${activeQueue.queue_id}` : 'None'}
            </div>
            <p className="text-[11px] text-amber-700 font-semibold mt-0.5 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${activeQueue ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'}`} />
              <span>{activeQueue ? `Status: ${activeQueue.status || 'Waiting'}` : 'Not in queue'}</span>
            </p>
          </div>

          {/* Medical Records Summary Tile */}
          <Link
            to="/patient/history"
            className="bg-white rounded-2xl p-5 border border-teal-100 shadow-xs hover:border-teal-300 hover:shadow-sm transition group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('medical_history_tab', 'Medical Records')}
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-teal-800">{medicalHistory.length}</div>
            <p className="text-[11px] text-teal-700 font-semibold mt-0.5 flex items-center gap-1">
              <span>{t('view_medical_records', 'View medical history')}</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </Link>

          {/* Patient Profile Summary Tile */}
          <Link
            to="/patient/profile"
            className="bg-white rounded-2xl p-5 border border-purple-100 shadow-xs hover:border-purple-300 hover:shadow-sm transition group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('my_profile', 'My Profile')}
              </span>
              {user?.profile_picture ? (
                <img
                  src={user.profile_picture}
                  alt={patientName}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-300"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-black text-xs">
                  {initialLetter}
                </div>
              )}
            </div>
            <div className="text-sm font-extrabold text-slate-900 truncate">{patientName}</div>
            <p className="text-[11px] text-purple-700 font-semibold mt-0.5 flex items-center gap-1">
              <span>{t('view_my_profile', 'View complete profile')}</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </Link>
        </div>

        {/* 3. QUICK ACCESS ACTIONS BAR */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
          <span className="text-slate-400 uppercase tracking-wider text-[11px] font-extrabold pl-1">
            Quick Actions:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/book"
              className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl transition flex items-center gap-1.5 border border-sky-200 shadow-2xs"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{t('book_consultation')}</span>
            </Link>

            <Link
              to={activeQueue?.queue_id ? `/tracking?queue_id=${activeQueue.queue_id}` : '/tracking'}
              className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl transition flex items-center gap-1.5 border border-amber-200 shadow-2xs"
            >
              <Ticket className="w-3.5 h-3.5 text-amber-600" />
              <span>{t('live_token')}</span>
            </Link>

            <Link
              to="/patient/profile"
              className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl transition flex items-center gap-1.5 border border-purple-200 shadow-2xs"
            >
              <User className="w-3.5 h-3.5" />
              <span>{t('my_profile')}</span>
            </Link>

            <Link
              to="/patient/history"
              className="px-3.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl transition flex items-center gap-1.5 border border-teal-200 shadow-2xs"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{t('my_medical_history')}</span>
            </Link>
          </div>
        </div>

        {/* 4. URGENT CALLOUT BANNER: DOCTOR CALLING PATIENT NOW */}
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
              className="px-6 py-3 bg-white text-rose-700 hover:bg-amber-50 font-black text-xs rounded-xl shadow-lg transition shrink-0"
            >
              {t('view_live_screen', 'View Live Calling Screen')}
            </Link>
          </div>
        )}

        {/* 5. ACTIVE QUEUE / CONSULTATION SPOTLIGHT */}
        {activeQueue && activeQueue.queue_id ? (
          <div className="space-y-6">
            <MyLiveQueueSection
              activeQueue={activeQueue}
              liveQueueData={liveQueueData}
              queueRefreshing={queueRefreshing}
              handleRefreshLiveQueue={handleRefreshLiveQueue}
              handleLeaveNow={handleLeaveNow}
              leavingLoading={leavingLoading}
            />

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
        ) : nextAppointment ? (
          /* Next Upcoming Consultation Card */
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                    {t('upcoming_appointment', 'Next Scheduled Consultation')}
                  </span>
                  <StatusBadge status={nextAppointment.status} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  {nextAppointment.doctor_name || nextAppointment.doctor_id}
                </h3>
                <p className="text-xs text-sky-700 font-semibold flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{nextAppointment.department || 'General Medicine'}</span>
                </p>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-xs text-slate-400 font-semibold">{t('consultation_date', 'Consultation Date')}</div>
                <div className="text-sm font-extrabold text-slate-800">{nextAppointment.consultation_date}</div>
                <div className="text-xs text-slate-500">{nextAppointment.slot_time || 'OPD Slot'}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                <span>SIMSRH OPD Campus • NH4 Sira Road, Tumakuru</span>
              </div>

              <div className="flex items-center gap-2">
                {isCancellable(nextAppointment) && (
                  <button
                    type="button"
                    onClick={() => setCancellingAppointment(nextAppointment)}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{t('cancel_appointment', 'Cancel')}</span>
                  </button>
                )}

                {nextAppointment.queue_id ? (
                  <Link
                    to={`/tracking?queue_id=${nextAppointment.queue_id}`}
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <span>{t('track_queue', 'Track Queue')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <button
                    onClick={() => handleJoinQueue(nextAppointment)}
                    disabled={joining}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <span>{joining ? 'Assigning...' : t('enter_live_queue', 'Enter Live Queue')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Empty State when no appointment */
          <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-slate-200/90 shadow-sm max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Stethoscope className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-1">
                {t('no_active_consultations', 'No Active Consultations Found')}
              </h3>
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

        {/* 6. UPCOMING APPOINTMENTS SUMMARY LIST */}
        {upcomingAppointments.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <span>{t('appointment_bookings', 'Upcoming Appointments')}</span>
                </h3>
                <p className="text-xs text-slate-500">Confirmed upcoming consultations</p>
              </div>
              <Link
                to="/patient/profile?tab=appointments"
                className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                <span>View Full History ({appointments.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {upcomingAppointments.slice(0, 3).map((apt, idx) => (
                <div key={apt.booking_id || idx} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900">{apt.doctor_name || apt.doctor_id}</span>
                      <span className="px-2 py-0.5 bg-sky-50 text-sky-700 text-[10px] font-bold rounded-md border border-sky-100">
                        {apt.department || 'General Medicine'}
                      </span>
                      <StatusBadge status={apt.status} />
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-3">
                      <span>Date: {apt.consultation_date}</span>
                      <span>Time: {apt.slot_time || 'OPD Slot'}</span>
                      <span className="font-mono text-slate-400">Token #{apt.token_number || apt.queue_id || '—'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {isCancellable(apt) && (
                      <button
                        type="button"
                        onClick={() => setCancellingAppointment(apt)}
                        className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg border border-rose-200 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <Link
                      to={`/tracking?queue_id=${apt.queue_id || apt.booking_id}`}
                      className="px-3 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold rounded-lg border border-sky-200 transition"
                    >
                      Track
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. MEDICAL RECORDS SPOTLIGHT SUMMARY */}
        {medicalHistory.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-teal-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700 block">
                    {t('recent_clinical_consultation', 'Most Recent Medical Record')}
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
                  {medicalHistory[0].consultation_date || 'Recent'}
                </span>
                <Link
                  to="/patient/history"
                  className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <span>{t('view_all', 'View History')} ({medicalHistory.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-sky-50/50 rounded-xl border border-sky-100">
                <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block mb-1">
                  {t('reported_symptoms', 'Reported Symptoms')}
                </span>
                <p className="text-slate-700 font-medium">
                  {(medicalHistory[0].patient_reported?.symptoms || medicalHistory[0].symptoms || []).join(', ') || 'Routine consultation'}
                </p>
              </div>

              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                  {t('clinical_assessment_diagnosis', 'Clinical Assessment')}
                </span>
                <p className="text-slate-800 font-semibold">
                  {medicalHistory[0].doctor_assessment?.diagnosis || medicalHistory[0].diagnosis || 'Completed'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">
                Ref: <strong className="font-mono text-slate-600">{medicalHistory[0].queue_id || medicalHistory[0].consultation_id || 'OPD-REC'}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedRecord(medicalHistory[0])}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t('view_full_record', 'View Full Record')}</span>
              </button>
            </div>
          </div>
        )}

        {/* 8. RECENT NOTIFICATIONS OVERVIEW */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-600" />
                <span>Hospital Transit & Queue Alerts</span>
              </h3>
              <p className="text-xs text-slate-500">Live departure notices, wait times, and queue arrival updates</p>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAllNotifsRead}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Mark Read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Bell className="w-6 h-6 text-slate-200 mx-auto mb-2" />
              <p className="font-bold text-slate-600">No active notifications</p>
              <p className="text-slate-400 text-[11px] mt-0.5">Live queue notifications will appear here when an appointment is active.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
              {notifications.slice(0, 5).map((n) => (
                <div key={n.notification_id || Math.random()} className={`py-3 flex items-start gap-3 ${!n.read ? 'bg-sky-50/40 p-2.5 rounded-xl' : ''}`}>
                  <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-extrabold text-slate-900">{n.title}</span>
                      <span className="px-1.5 py-0.2 bg-sky-100 text-sky-800 text-[9px] font-bold rounded">
                        {n.type || 'Alert'}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">{n.message}</p>
                  </div>
                </div>
              ))}
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
            loadDashboardData();
          }}
        />
      )}
    </div>
  );
}