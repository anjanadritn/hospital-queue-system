import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Users,
  ShieldAlert,
  Stethoscope,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  Cpu,
  KeyRound,
  Play,
  XCircle,
  UserX,
  PhoneCall,
  Sparkles,
  Search,
  Filter,
  DoorOpen,
  Calendar,
  Clock,
  Activity,
  Bell,
  Check,
  FileText,
  UserCheck,
  Power,
  SkipForward
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import PatientDetailsModal from '../components/PatientDetailsModal';

export default function StaffDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  // Determine active tab from URL query if available
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get('tab') || 'console';
  const [activeTab, setActiveTab] = useState(initialTab); // 'console' | 'waiting' | 'emergency' | 'appointments' | 'completed' | 'notifications'

  const [queues, setQueues] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [doctorOnline, setDoctorOnline] = useState(true);
  const [consultationNotes, setConsultationNotes] = useState('');
  const [doctorDiagnosis, setDoctorDiagnosis] = useState('');
  const [doctorAdvice, setDoctorAdvice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Pre-Consultation Patient Details Modal State
  const [selectedPatientForModal, setSelectedPatientForModal] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenPatientModal = (patient) => {
    setSelectedPatientForModal(patient);
    setIsModalOpen(true);
  };

  const [doctorProfile, setDoctorProfile] = useState(null);

  useEffect(() => {
    if (user?.doctor_id) {
      hospitalApi.getDoctor(user.doctor_id)
        .then((doc) => {
          if (doc && doc.doctor_id) setDoctorProfile(doc);
        })
        .catch(() => {});
    }
  }, [user?.doctor_id]);

  const rawDoctorId = user?.doctor_id || user?.user_id || 'D001';
  const doctorId = typeof rawDoctorId === 'string' && rawDoctorId.startsWith('U_DOC_')
    ? rawDoctorId.replace('U_DOC_', '')
    : rawDoctorId;
  const doctorName = doctorProfile?.name || user?.name || 'Dr. Ananya Sharma';
  const department = doctorProfile?.department || user?.department || 'Cardiology';
  const roomNumber = doctorProfile?.consultation_room || user?.room_number || user?.consultation_room || 'Room 204';

  const loadDoctorWorkstationData = async () => {
    try {
      const [queueData, aptsData, notifsData] = await Promise.all([
        hospitalApi.getAllQueues(),
        hospitalApi.getAdminAppointments().catch(() => []),
        hospitalApi.getNotifications(doctorId).catch(() => [])
      ]);

      const qList = Array.isArray(queueData) ? queueData : (queueData?.queues || []);
      setQueues(qList);
      setAppointments(Array.isArray(aptsData) ? aptsData : []);
      const nList = Array.isArray(notifsData) ? notifsData : (notifsData?.notifications || []);
      setNotifications(nList);
    } catch (err) {
      console.error('Workstation fetch error:', err);
      setError('Could not load queue. Please check server connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctorWorkstationData();
    // Real-time dynamic queue polling every 4 seconds
    const interval = setInterval(loadDoctorWorkstationData, 4000);
    return () => clearInterval(interval);
  }, [doctorId]);

  // Actions
  const handleCallPatient = async (queueId) => {
    setActionLoadingId(queueId);
    try {
      await hospitalApi.callPatient(queueId);
      await loadDoctorWorkstationData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to call patient.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartConsultation = async (queueId) => {
    setActionLoadingId(queueId);
    try {
      await hospitalApi.startConsultation(queueId);
      await loadDoctorWorkstationData();
    } catch (err) {
      console.error(err);
      const errData = err.response?.data || {};
      if (errData.requires_arrival_verification) {
        alert(
          `⚠️ Arrival Not Verified\n\n` +
          `${errData.error}\n\n` +
          `Please ask the Admin Arrival Desk to verify the patient\'s 6-digit OTP first.`
        );
      } else {
        alert(errData.error || 'Failed to start consultation.');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCompleteConsultation = async (queueId, assessmentData = null) => {
    setActionLoadingId(queueId);
    try {
      const payload = assessmentData || {
        diagnosis: doctorDiagnosis.trim() || null,
        notes: consultationNotes.trim() || null,
        advice: doctorAdvice.trim() || null
      };
      await hospitalApi.completeQueueToken(queueId, payload);
      setDoctorDiagnosis('');
      setConsultationNotes('');
      setDoctorAdvice('');
      await loadDoctorWorkstationData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to complete consultation.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSkipPatient = async (queueId) => {
    setActionLoadingId(queueId);
    try {
      await hospitalApi.skipQueueToken(queueId);
      setDoctorDiagnosis('');
      setConsultationNotes('');
      setDoctorAdvice('');
      await loadDoctorWorkstationData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to skip patient.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEscalateEmergency = async (queueId) => {
    setActionLoadingId(queueId);
    try {
      await hospitalApi.escalateEmergency(queueId);
      await loadDoctorWorkstationData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to escalate emergency priority.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkNoShow = async (queueId) => {
    if (!window.confirm('Mark this patient as No-Show?')) return;
    setActionLoadingId(queueId);
    try {
      await hospitalApi.markNoShow(queueId);
      await loadDoctorWorkstationData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to mark no-show.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter queues strictly for this doctor's queue
  const doctorQueues = queues.filter((q) => {
    if (!q) return false;
    return q.doctor_id === doctorId;
  });

  // Category Buckets
  const currentPatient = doctorQueues.find(
    (q) => q.status === 'in_consultation' || q.status === 'called'
  );

  const waitingPatients = doctorQueues.filter(
    (q) =>
      (q.status === 'waiting' || q.status === 'arrived' || q.status === 'ready') &&
      q.priority !== 'emergency'
  );

  const emergencyPatients = doctorQueues.filter(
    (q) =>
      q.priority === 'emergency' &&
      q.status !== 'completed' &&
      q.status !== 'cancelled' &&
      q.status !== 'no_show'
  );

  const missedPatients = doctorQueues.filter(
    (q) => (q.status === 'missed' || q.status === 'missed_consultation')
  );

  const completedPatients = doctorQueues.filter((q) => q.status === 'completed');

  // Next patient to call: emergency patient first, then first waiting patient, then missed patients at the end
  const nextInLinePatient =
    emergencyPatients.find((q) => q.status !== 'in_consultation' && q.status !== 'called') ||
    waitingPatients[0] ||
    missedPatients.find((q) => q.status !== 'in_consultation' && q.status !== 'called') ||
    null;

  // Search filter
  const filterList = (list) => {
    if (!searchQuery.trim()) return list;
    const term = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        (item.queue_id && item.queue_id.toLowerCase().includes(term)) ||
        (item.patient_name && item.patient_name.toLowerCase().includes(term)) ||
        (item.patient_id && item.patient_id.toLowerCase().includes(term))
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/70 py-6 sm:py-10 overflow-x-hidden w-full max-w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        
        {/* DOCTOR CLINICAL HEADER & SHIFT STATUS */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-tr from-sky-600 to-teal-500 rounded-2xl flex items-center justify-center text-white text-xl font-extrabold shadow-md shadow-sky-600/20 shrink-0">
              <Stethoscope className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                  {department} Department
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <DoorOpen className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{roomNumber}</span>
                </span>
                <span className="text-[11px] text-slate-400 font-semibold">
                  Shift: 09:00 AM - 04:00 PM
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {doctorName}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('doctor_opd_console', 'Doctor OPD Console')} • {t('simsrh_campus_title', 'SIMSRH Campus, Tumakuru')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Direct Link to ML Queue Prediction */}
            <Link
              to="/doctor/predictions"
              className="px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 shadow-xs"
              title="View Random Forest ML Queue Predictions"
            >
              <Cpu className="w-4 h-4 text-purple-600" />
              <span>{t('ml_queue_prediction', 'ML Queue Prediction')}</span>
            </Link>

            {/* Shift Online / In Procedure Toggle */}
            <button
              onClick={() => setDoctorOnline(!doctorOnline)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
                doctorOnline
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${doctorOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{doctorOnline ? `● ${t('active_now', 'On Active Duty')}` : `○ ${t('in_procedure', 'In Procedure / Break')}`}</span>
            </button>

            <button
              onClick={loadDoctorWorkstationData}
              disabled={loading}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition cursor-pointer"
              title="Refresh Queue Records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* 5 WORKLOAD STAT METRICS (Strict 6-Color System) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Waiting Patients (Amber) */}
          <div
            onClick={() => setActiveTab('waiting')}
            className={`p-4 sm:p-5 rounded-3xl border transition cursor-pointer ${
              activeTab === 'waiting'
                ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-4 ring-amber-100'
                : 'bg-white border-amber-200/80 hover:border-amber-400 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider ${activeTab === 'waiting' ? 'text-amber-100' : 'text-amber-800'}`}>
                {t('patients_waiting')}
              </span>
              <Users className="w-4 h-4" />
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold ${activeTab === 'waiting' ? 'text-white' : 'text-amber-950'}`}>
              {waitingPatients.length}
            </div>
            <p className={`text-[10px] sm:text-[11px] font-medium mt-1 ${activeTab === 'waiting' ? 'text-amber-100' : 'text-amber-700'}`}>
              {t('waiting_line')}
            </p>
          </div>

          {/* Emergency Cases (Red) */}
          <div
            onClick={() => setActiveTab('emergency')}
            className={`p-4 sm:p-5 rounded-3xl border transition cursor-pointer ${
              activeTab === 'emergency'
                ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-4 ring-rose-100'
                : 'bg-white border-rose-200/80 hover:border-rose-400 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider ${activeTab === 'emergency' ? 'text-rose-100' : 'text-rose-800'}`}>
                {t('emergency_cases')}
              </span>
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold ${activeTab === 'emergency' ? 'text-white' : 'text-rose-600'}`}>
              {emergencyPatients.length}
            </div>
            <p className={`text-[10px] sm:text-[11px] font-medium mt-1 ${activeTab === 'emergency' ? 'text-rose-100' : 'text-rose-600'}`}>
              {t('emergency_triage')}
            </p>
          </div>

          {/* In Chamber (Teal / Cyan) */}
          <div
            onClick={() => setActiveTab('console')}
            className={`p-4 sm:p-5 rounded-3xl border transition cursor-pointer ${
              activeTab === 'console'
                ? 'bg-gradient-to-r from-sky-600 to-teal-600 text-white border-sky-700 shadow-md ring-4 ring-sky-100'
                : 'bg-white border-sky-200/80 hover:border-sky-400 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider ${activeTab === 'console' ? 'text-sky-100' : 'text-sky-800'}`}>
                {t('in_chamber')}
              </span>
              <Activity className="w-4 h-4" />
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold flex items-center gap-2 ${activeTab === 'console' ? 'text-white' : 'text-slate-900'}`}>
              <span>{currentPatient ? 1 : 0}</span>
              {currentPatient && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            <p className={`text-[10px] sm:text-[11px] font-medium mt-1 ${activeTab === 'console' ? 'text-sky-100' : 'text-sky-700'}`}>
              {currentPatient ? `Active: ${currentPatient.queue_id}` : t('ready_to_call')}
            </p>
          </div>

          {/* Missed Consultations (Amber / Orange) */}
          <div
            onClick={() => setActiveTab('missed')}
            className={`p-4 sm:p-5 rounded-3xl border transition cursor-pointer ${
              activeTab === 'missed'
                ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-4 ring-amber-100'
                : 'bg-white border-amber-300/80 hover:border-amber-500 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider ${activeTab === 'missed' ? 'text-amber-100' : 'text-amber-900'}`}>
                {t('missed_queue')}
              </span>
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold ${activeTab === 'missed' ? 'text-white' : 'text-amber-700'}`}>
              {missedPatients.length}
            </div>
            <p className={`text-[10px] sm:text-[11px] font-medium mt-1 ${activeTab === 'missed' ? 'text-amber-100' : 'text-amber-800'}`}>
              {t('skip_explanation')}
            </p>
          </div>

          {/* Completed Today (Green) */}
          <div
            onClick={() => setActiveTab('completed')}
            className={`p-4 sm:p-5 rounded-3xl border transition cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-4 ring-emerald-100'
                : 'bg-white border-emerald-200/80 hover:border-emerald-400 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider ${activeTab === 'completed' ? 'text-emerald-100' : 'text-emerald-800'}`}>
                {t('completed_today')}
              </span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold ${activeTab === 'completed' ? 'text-white' : 'text-emerald-700'}`}>
              {completedPatients.length}
            </div>
            <p className={`text-[10px] sm:text-[11px] font-medium mt-1 ${activeTab === 'completed' ? 'text-emerald-100' : 'text-emerald-800'}`}>
              {t('completed')}
            </p>
          </div>
        </div>

        {/* CLINICAL SPOTLIGHT 1: CURRENTLY CONSULTING PATIENT */}
        {currentPatient ? (
          <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-sky-400/40 space-y-6 relative overflow-hidden ring-1 ring-sky-500/20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center relative">
                  <Activity className="w-6 h-6 animate-pulse" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                      {t('active_in_chamber')}
                    </span>
                    <span className="px-3 py-0.5 bg-sky-500/20 border border-sky-400/40 text-sky-300 rounded-full text-xs font-mono font-black inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                      TOKEN #{currentPatient.queue_id}
                    </span>
                    <span className="text-[11px] font-bold text-slate-300">
                      ({t('position')} #{currentPatient.position || 1})
                    </span>
                  </div>
                  <h2
                    onClick={() => handleOpenPatientModal(currentPatient)}
                    className="text-xl sm:text-2xl font-extrabold text-white mt-0.5 cursor-pointer hover:underline hover:text-sky-300 flex items-center gap-2 transition"
                    title="Click to view complete pre-consultation details"
                  >
                    <span>{currentPatient.patient_name || 'Patient'}</span>
                    <FileText className="w-4 h-4 text-sky-300 shrink-0" />
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* View Full Pre-Consultation Details Button */}
                <button
                  onClick={() => handleOpenPatientModal(currentPatient)}
                  className="px-3.5 py-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Open complete pre-consultation information dossier"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-300" />
                  <span>{t('view_patient_details')}</span>
                </button>

                <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                  currentPatient.status === 'in_consultation'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-amber-500 text-white'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    currentPatient.status === 'in_consultation' ? 'bg-white animate-pulse' : 'bg-white animate-ping'
                  }`} />
                  <span>{currentPatient.status === 'in_consultation' ? t('in_consultation') : t('called')}</span>
                </span>

                {currentPatient.verified_by_admin || currentPatient.arrived_at_hospital ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('arrived_verified')}</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-400/40 text-amber-300">
                    {t('in_transit')}
                  </span>
                )}

                <StatusBadge status={currentPatient.priority} type="priority" />
              </div>
            </div>

            {/* CLINICAL SUMMARY FOR DOCTOR (Clean, focused consultation data) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Demographics */}
              <div
                onClick={() => handleOpenPatientModal(currentPatient)}
                className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/10 space-y-1 cursor-pointer transition"
                title="Click to view patient details"
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{t('demographics_origin')}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-white font-extrabold text-sm">
                  {currentPatient.age ? `${currentPatient.age} yrs` : 'Age N/A'} • {currentPatient.gender || 'Not specified'}
                </div>
                <div className="text-sky-300 font-semibold text-[11px]">
                  📍 {currentPatient.city || currentPatient.address || 'Tumakuru'}
                </div>
                {currentPatient.pdo && (
                  <div className="text-slate-400 text-[10px]">PDO: {currentPatient.pdo}</div>
                )}
              </div>

              {/* Symptoms & Duration */}
              <div
                onClick={() => handleOpenPatientModal(currentPatient)}
                className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/10 space-y-1 sm:col-span-1 lg:col-span-2 cursor-pointer transition"
                title="Click to view patient details"
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">{t('presenting_symptoms')}</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                    {currentPatient.duration_days || 1} {currentPatient.duration_days === 1 ? 'day' : 'days'} duration
                  </span>
                </div>
                <div className="text-white font-bold text-sm">
                  {Array.isArray(currentPatient.symptoms) ? currentPatient.symptoms.join(', ') : (currentPatient.symptoms || 'General Checkup')}
                </div>
                {currentPatient.custom_symptoms && (
                  <div className="text-amber-200 text-[11px] italic">
                    Additional info: {currentPatient.custom_symptoms}
                  </div>
                )}
              </div>

              {/* Physical Vitals & ML Duration */}
              <div
                onClick={() => handleOpenPatientModal(currentPatient)}
                className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/10 space-y-1 cursor-pointer transition"
                title="Click to view patient details"
              >
                <span className="text-slate-400 block text-[10px] uppercase font-bold">{t('physical_vitals')}</span>
                <div className="text-white font-semibold text-xs flex items-center gap-3">
                  <span>H: <strong className="text-white font-extrabold">{currentPatient.height_cm ? `${currentPatient.height_cm} cm` : '—'}</strong></span>
                  <span>W: <strong className="text-white font-extrabold">{currentPatient.weight_kg ? `${currentPatient.weight_kg} kg` : '—'}</strong></span>
                </div>
                <div className="text-purple-300 font-bold text-[11px] flex items-center gap-1 mt-1">
                  <Cpu className="w-3 h-3 text-purple-400" />
                  <span>~{currentPatient.predicted_duration || currentPatient.predicted_consultation_duration || 15}m RF predicted</span>
                </div>
              </div>
            </div>

            {/* Doctor Workflow Actions: CALL -> In Consultation -> COMPLETE or SKIP */}
            <div className="pt-2 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder={t('doctor_diagnosis_placeholder', 'Doctor Diagnosis (e.g. Acute Viral Bronchitis)')}
                  value={doctorDiagnosis}
                  onChange={(e) => setDoctorDiagnosis(e.target.value)}
                  className="px-3.5 py-2.5 bg-white/10 border border-white/20 rounded-xl text-xs text-white placeholder:text-slate-400 focus:bg-white/20 focus:outline-none transition"
                />
                <input
                  type="text"
                  placeholder={t('clinical_notes_placeholder')}
                  value={consultationNotes}
                  onChange={(e) => setConsultationNotes(e.target.value)}
                  className="px-3.5 py-2.5 bg-white/10 border border-white/20 rounded-xl text-xs text-white placeholder:text-slate-400 focus:bg-white/20 focus:outline-none transition"
                />
                <input
                  type="text"
                  placeholder={t('prescription_advice_placeholder', 'Prescription & Medical Advice...')}
                  value={doctorAdvice}
                  onChange={(e) => setDoctorAdvice(e.target.value)}
                  className="px-3.5 py-2.5 bg-white/10 border border-white/20 rounded-xl text-xs text-white placeholder:text-slate-400 focus:bg-white/20 focus:outline-none transition"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                {/* If Called: show Start Consultation (only if patient arrival verified) */}
                {currentPatient.status === 'called' && (
                  currentPatient.verified_by_admin || currentPatient.arrived_at_hospital ? (
                    <button
                      onClick={() => handleStartConsultation(currentPatient.queue_id)}
                      disabled={actionLoadingId === currentPatient.queue_id}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>{t('start_consultation')}</span>
                    </button>
                  ) : (
                    <div className="px-4 py-2 bg-amber-500/20 border border-amber-400/40 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-2">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Awaiting Admin Arrival OTP Verification</span>
                    </div>
                  )
                )}

                {/* COMPLETE CONSULTATION BUTTON */}
                <button
                  onClick={() => handleCompleteConsultation(currentPatient.queue_id)}
                  disabled={actionLoadingId === currentPatient.queue_id}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                  title="Mark consultation completed and archive medical history"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('complete_consultation')}</span>
                </button>

                {/* SKIP PATIENT BUTTON (Moves token to end of active queue) */}
                <button
                  onClick={() => handleSkipPatient(currentPatient.queue_id)}
                  disabled={actionLoadingId === currentPatient.queue_id}
                  className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  title={t('skip_explanation')}
                >
                  <SkipForward className="w-4 h-4 text-amber-400" />
                  <span>{t('skip_missed')}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* CLINICAL SPOTLIGHT 2: CALL NEXT PATIENT HERO BANNER */
          <div className="bg-gradient-to-r from-sky-700 via-teal-700 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-sky-400/30">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-400"></span>
                </span>
                <span className="text-xs font-extrabold uppercase tracking-widest text-sky-200">
                  {t('ready_to_call')}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold">
                {nextInLinePatient
                  ? `Next In Line: ${nextInLinePatient.patient_name || nextInLinePatient.patient_id} (Token #${nextInLinePatient.queue_id})`
                  : 'All Waiting Patients Completed!'}
              </h2>
              <p className="text-xs sm:text-sm text-sky-100 max-w-xl">
                {nextInLinePatient
                  ? `${nextInLinePatient.priority === 'emergency' ? '⚠️ Emergency priority case.' : nextInLinePatient.status === 'missed' ? '⏰ Missed consultation re-queued at end of line.' : 'Standard OPD waiting line.'} Calling will notify the patient and display on the OPD chamber screen.`
                  : 'No patients currently waiting in line for this OPD clinic.'}
              </p>
            </div>

            {nextInLinePatient && (
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                <button
                  onClick={() => handleCallPatient(nextInLinePatient.queue_id)}
                  disabled={actionLoadingId === nextInLinePatient.queue_id}
                  className="flex-1 md:flex-initial px-6 py-3.5 bg-white text-slate-900 hover:bg-slate-100 rounded-2xl text-xs font-extrabold transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4 text-sky-600" />
                  <span>{t('call_to_chamber')} #{nextInLinePatient.queue_id}</span>
                </button>

                <button
                  onClick={() => handleOpenPatientModal(nextInLinePatient)}
                  className="px-4 py-3.5 bg-white/15 hover:bg-white/25 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-white/20"
                  title="View patient pre-consultation details"
                >
                  <FileText className="w-4 h-4 text-sky-300" />
                  <span>{t('view_patient_details')}</span>
                </button>

                <button
                  onClick={() => handleSkipPatient(nextInLinePatient.queue_id)}
                  disabled={actionLoadingId === nextInLinePatient.queue_id}
                  className="px-4 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-white/20"
                  title={t('skip_explanation')}
                >
                  <SkipForward className="w-4 h-4 text-amber-300" />
                  <span>{t('skip_missed')}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* WORKSTATION TABS */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'console', label: t('all_patients'), count: doctorQueues.length },
                { id: 'waiting', label: t('waiting_line'), count: waitingPatients.length },
                { id: 'emergency', label: t('emergency_triage'), count: emergencyPatients.length },
                { id: 'missed', label: t('missed_consultations'), count: missedPatients.length },
                { id: 'completed', label: t('completed'), count: completedPatients.length },
                { id: 'notifications', label: 'Alerts', count: notifications.filter((n) => !n.read).length }
              ].map((tabItem) => (
                <button
                  key={tabItem.id}
                  onClick={() => setActiveTab(tabItem.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
                    activeTab === tabItem.id
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{tabItem.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    activeTab === tabItem.id
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tabItem.count}
                  </span>
                </button>
              ))}

              <Link
                to="/doctor/predictions"
                className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                title="View Random Forest ML Queue Predictions"
              >
                <Cpu className="w-3.5 h-3.5 text-purple-600" />
                <span>{t('ml_queue_prediction', 'ML Queue Prediction')}</span>
              </Link>
            </div>

            {/* Search filter */}
            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder={t('search', 'Search token, name...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-sky-500 focus:outline-none transition"
              />
            </div>
          </div>

          {/* TAB 1: ALL TOKENS / WAITING / EMERGENCY / MISSED / COMPLETED */}
          {activeTab !== 'notifications' ? (
            <div>
              {(() => {
                const currentList = filterList(
                  activeTab === 'waiting'
                    ? waitingPatients
                    : activeTab === 'emergency'
                      ? emergencyPatients
                      : activeTab === 'missed'
                        ? missedPatients
                        : activeTab === 'completed'
                          ? completedPatients
                          : doctorQueues
                );

                if (currentList.length === 0) {
                  return (
                    <div className="p-12 sm:p-16 text-center text-slate-400 text-xs font-medium space-y-2">
                      <Users className="w-10 h-10 text-slate-200 mx-auto" />
                      <p>{t('no_waiting_patients', 'No patients in this category currently.')}</p>
                    </div>
                  );
                }

                return (
                  <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {currentList.map((item) => {
                        const isEmergency = item.priority === 'emergency';
                        const symptomsStr = Array.isArray(item.symptoms) ? item.symptoms.join(', ') : '';
                        const isCurrent = item.queue_id === currentPatient?.queue_id;
                        const isNext = item.queue_id === nextInLinePatient?.queue_id && !currentPatient;

                        return (
                          <div
                            key={item.queue_id}
                            className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between gap-3.5 ${
                              isEmergency
                                ? 'bg-rose-50/40 border-rose-300 ring-1 ring-rose-200 shadow-xs'
                                : isCurrent
                                  ? 'bg-sky-50/50 border-sky-300 ring-1 ring-sky-200 shadow-xs'
                                  : 'bg-white border-slate-200/90 hover:border-sky-300 hover:shadow-xs'
                            }`}
                          >
                            {/* Card Header: Position, Token, Priority & Status badges */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs border shrink-0 ${
                                  isCurrent
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-sky-50 text-sky-700 border-sky-200'
                                }`}>
                                  #{item.position}
                                </span>
                                <div className="min-w-0">
                                  <div className="font-mono font-extrabold text-sm text-sky-900 flex items-center gap-1.5 truncate">
                                    {isCurrent && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
                                    {isNext && <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping shrink-0" />}
                                    <span>TOKEN #{item.queue_id}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                {item.slot_id && (
                                  <span className={`px-2 py-0.5 border rounded-lg text-[10px] font-bold uppercase ${
                                    item.slot_id === 'evening'
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}>
                                    {item.slot_id === 'evening' ? t('evening_slot_title', 'Evening') : t('morning_slot_title', 'Morning')}
                                  </span>
                                )}
                                {isEmergency && (
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-black uppercase">
                                    {t('emergency_priority', 'EMERGENCY')}
                                  </span>
                                )}
                                <StatusBadge status={item.status} type="status" />
                              </div>
                            </div>

                            {/* Patient Info & Chief Complaints */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <div
                                onClick={() => handleOpenPatientModal(item)}
                                className="font-extrabold text-xs sm:text-sm text-slate-900 cursor-pointer hover:underline hover:text-sky-600 transition flex items-center gap-1.5"
                                title="Click to view pre-consultation details"
                              >
                                <span className="truncate">{item.patient_name || item.patient_id}</span>
                                <FileText className="w-3.5 h-3.5 text-slate-400 hover:text-sky-600 shrink-0" />
                              </div>

                              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span>{item.patient_phone ? `+91 ${item.patient_phone}` : 'Patient'}</span>
                                {item.age && <span>• {item.age} yrs</span>}
                                {item.gender && <span>• {item.gender}</span>}
                              </div>

                              <div className="text-xs text-slate-700 bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                                  {t('chief_complaints')}
                                </span>
                                <p className="line-clamp-2 text-[11px] font-medium text-slate-800" title={symptomsStr}>
                                  {symptomsStr || 'General OPD Consultation'}
                                </p>
                              </div>
                            </div>

                            {/* Duration, Expected Start & Arrival Status */}
                            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[11px]">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-bold text-[10px]">
                                <Cpu className="w-3 h-3 text-purple-600 shrink-0" />
                                <span>~{item.predicted_consultation_duration || 15}m RF</span>
                              </span>

                              {item.expected_consultation_time && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 rounded-lg font-bold text-[10px]">
                                  <Clock className="w-3 h-3 text-sky-600 shrink-0" />
                                  <span>Start: {item.expected_consultation_time}</span>
                                </span>
                              )}

                              {item.leaving_now && (
                                <span className="px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-lg font-bold text-[10px] inline-flex items-center gap-1">
                                  <span>🚗 Left</span>
                                </span>
                              )}

                              {item.verified_by_admin || item.arrived_at_hospital ? (
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>{t('arrived_verified')}</span>
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg font-medium text-[10px] inline-flex items-center shrink-0">
                                  {t('en_route')}
                                </span>
                              )}
                            </div>

                            {/* Action Buttons: Responsive, wrapped, no overflow */}
                            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                              {/* View Full Patient Details Modal */}
                              <button
                                onClick={() => handleOpenPatientModal(item)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 hover:border-sky-300 rounded-lg font-bold text-[10px] transition inline-flex items-center gap-1 cursor-pointer"
                                title="View complete clinical and pre-consultation details"
                              >
                                <FileText className="w-3 h-3 text-sky-600" />
                                <span>{t('view_patient_details')}</span>
                              </button>

                              {/* Call / Re-call Patient */}
                              {(item.status === 'waiting' || item.status === 'ready' || item.status === 'arrived' || item.status === 'missed') && (
                                <button
                                  onClick={() => handleCallPatient(item.queue_id)}
                                  disabled={actionLoadingId === item.queue_id}
                                  className={`px-2.5 py-1.5 text-white rounded-lg font-bold text-[10px] transition inline-flex items-center gap-1 shadow-xs cursor-pointer ${
                                    item.status === 'missed' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-sky-600 hover:bg-sky-700'
                                  }`}
                                  title={item.status === 'missed' ? 'Re-call missed patient to chamber' : 'Call patient to consultation room'}
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  <span>{item.status === 'missed' ? t('re_call') : t('call_patient')}</span>
                                </button>
                              )}

                              {/* Start Consultation — gated behind Admin arrival OTP verification */}
                              {item.status === 'called' && (
                                item.verified_by_admin || item.arrived_at_hospital ? (
                                  <button
                                    onClick={() => handleStartConsultation(item.queue_id)}
                                    disabled={actionLoadingId === item.queue_id}
                                    className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-[10px] transition inline-flex items-center gap-1 shadow-xs cursor-pointer"
                                    title="Commence consultation — patient arrival verified"
                                  >
                                    <Play className="w-3 h-3" />
                                    <span>{t('start_consultation')}</span>
                                  </button>
                                ) : (
                                  <span
                                    className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg font-bold text-[10px] inline-flex items-center gap-1"
                                    title="Admin must verify patient arrival OTP before consultation can start"
                                  >
                                    <KeyRound className="w-3 h-3 text-amber-600" />
                                    <span>Pending Arrival OTP</span>
                                  </span>
                                )
                              )}

                              {/* Complete Consultation */}
                              {(item.status === 'in_consultation' || item.status === 'called') && (
                                <button
                                  onClick={() => handleCompleteConsultation(item.queue_id)}
                                  disabled={actionLoadingId === item.queue_id}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] transition inline-flex items-center gap-1 shadow-xs cursor-pointer"
                                  title="Mark consultation completed and advance queue"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{t('complete_consultation')}</span>
                                </button>
                              )}

                              {/* Skip Patient */}
                              {item.status !== 'completed' && item.status !== 'cancelled' && item.status !== 'no_show' && item.status !== 'missed' && (
                                <button
                                  onClick={() => handleSkipPatient(item.queue_id)}
                                  disabled={actionLoadingId === item.queue_id}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-[10px] transition inline-flex items-center gap-1 cursor-pointer"
                                  title={t('skip_explanation')}
                                >
                                  <SkipForward className="w-3 h-3 text-amber-600" />
                                  <span>{t('skip_missed')}</span>
                                </button>
                              )}

                              {/* Escalate to Emergency */}
                              {item.priority !== 'emergency' && item.status !== 'completed' && item.status !== 'cancelled' && (
                                <button
                                  onClick={() => handleEscalateEmergency(item.queue_id)}
                                  disabled={actionLoadingId === item.queue_id}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[10px] transition inline-flex items-center gap-1 cursor-pointer"
                                  title="Escalate to Emergency Priority"
                                >
                                  <ShieldAlert className="w-3 h-3 text-rose-600" />
                                  <span>Emergency</span>
                                </button>
                              )}

                              {/* No-Show */}
                              {item.status !== 'completed' && item.status !== 'cancelled' && item.status !== 'no_show' && (
                                <button
                                  onClick={() => handleMarkNoShow(item.queue_id)}
                                  disabled={actionLoadingId === item.queue_id}
                                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold text-[10px] transition inline-flex items-center gap-1 cursor-pointer"
                                  title="Mark No-Show"
                                >
                                  <UserX className="w-3 h-3" />
                                  <span>No-Show</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* TAB 2: DOCTOR CLINICAL ALERTS & NOTIFICATIONS */
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-sm text-slate-900">Clinical Event Notifications</h3>
                <span className="text-xs font-bold text-slate-500">{notifications.length} Total Alerts</span>
              </div>

              {notifications.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p>No new clinical alerts for this doctor station.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map((n) => (
                    <div key={n.notification_id || Math.random()} className="py-3 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{n.title}</span>
                          <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.2 rounded-md">
                            {n.type || 'Alert'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* PRE-CONSULTATION PATIENT DETAILS MODAL / DRAWER */}
      <PatientDetailsModal
        patient={selectedPatientForModal}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPatientForModal(null);
        }}
        onCall={handleCallPatient}
        onStart={handleStartConsultation}
        onComplete={handleCompleteConsultation}
        onSkip={handleSkipPatient}
        actionLoading={actionLoadingId === selectedPatientForModal?.queue_id}
      />
    </div>
  );
}