import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  Users,
  Stethoscope,
  Building2,
  Calendar,
  Clock,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Cpu,
  RefreshCw,
  Activity,
  UserCheck,
  Settings,
  Lock,
  Layers,
  FileText,
  User,
  Phone,
  MapPin,
  ChevronRight,
  X,
  Sun,
  Moon,
  BedDouble,
  AlertTriangle
} from 'lucide-react';
import { hospitalApi } from '../../api/hospitalApi';
import { useLanguage } from '../../context/LanguageContext';
import LoadingState from '../../components/LoadingState';
import ErrorState from '../../components/ErrorState';
import ConsultationRecordModal from '../../components/ConsultationRecordModal';

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const validTabs = ['overview', 'arrival-desk', 'patient-records', 'live-queues', 'appointments', 'doctors', 'departments', 'users', 'settings'];

  const [activeTab, setActiveTab] = useState(() => {
    if (urlTab && validTabs.includes(urlTab)) return urlTab;
    return 'overview';
  });

  const [analytics, setAnalytics] = useState(null);
  const [slotAnalytics, setSlotAnalytics] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [doctorLeaveLoading, setDoctorLeaveLoading] = useState(null); // doctor_id being toggled
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [queues, setQueues] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('ALL');

  const formatExactBookedTime = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString([], {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  // Patient Records State (EMR)
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [patientsList, setPatientsList] = useState([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [selectedPatientRecord, setSelectedPatientRecord] = useState(null);
  const [patientRecordLoading, setPatientRecordLoading] = useState(false);
  const [modalConsultation, setModalConsultation] = useState(null);

  // Arrival Desk Verification State
  const [verifyTokenId, setVerifyTokenId] = useState('');
  const [verifyOtp, setVerifyOtp] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState(null);
  const [verifyError, setVerifyError] = useState(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');

  // New Doctor Modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    name: '',
    department: 'Cardiology',
    specialization: '',
    experience: '8 years',
    consultation_room: 'Room 101',
    working_hours: '09:00 AM - 04:00 PM',
    avg_consultation_duration: 15
  });

  // New Department Modal
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({
    name: '',
    description: '',
    room: 'OPD Block',
    head_doctor: ''
  });

  // Settings State
  const [settings, setSettings] = useState({
    defaultBuffer: 10,
    maxAdvanceDays: 2,
    emergencyEscalationAuto: true,
    hospitalLocation: 'Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH), Sira Road, NH4, Lingapura, Tumakuru – 572106'
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  const handleSearchPatients = async (query = '') => {
    setPatientSearchLoading(true);
    try {
      const res = await hospitalApi.adminSearchPatients(query);
      setPatientsList(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to search patients:', err);
    } finally {
      setPatientSearchLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'overview') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
    if (tab === 'patient-records') {
      handleSearchPatients(patientSearchQuery);
    }
  };

  useEffect(() => {
    if (urlTab && validTabs.includes(urlTab)) {
      setActiveTab(urlTab);
      if (urlTab === 'patient-records') {
        handleSearchPatients(patientSearchQuery);
      }
    }
  }, [urlTab]);

  const handleOpenPatientHistory = async (patientId) => {
    setPatientRecordLoading(true);
    try {
      const res = await hospitalApi.adminGetPatientRecords(patientId);
      if (res && res.success) {
        setSelectedPatientRecord(res);
      }
    } catch (err) {
      console.error('Failed to get patient records:', err);
      alert('Could not retrieve patient medical history.');
    } finally {
      setPatientRecordLoading(false);
    }
  };

  const fetchAdminData = async () => {
    try {
      const [analyticsData, docsData, deptsData, usersData, queueData, aptsData, patientsData, slotData] = await Promise.all([
        hospitalApi.getAnalytics().catch(() => null),
        hospitalApi.getAllDoctorsAdmin().catch(() => hospitalApi.getDoctors().catch(() => [])),
        hospitalApi.getDepartments().catch(() => []),
        hospitalApi.getAdminUsers().catch(() => []),
        hospitalApi.getAllQueues().catch(() => []),
        hospitalApi.getAdminAppointments().catch(() => []),
        hospitalApi.adminSearchPatients(patientSearchQuery).catch(() => []),
        hospitalApi.getAdminSlotAnalytics().catch(() => null)
      ]);

      setAnalytics(analyticsData || {
        total_patients_waiting: Array.isArray(queueData) ? queueData.filter(q => q.status === 'waiting' || q.status === 'arrived').length : 3,
        emergency_patients: Array.isArray(queueData) ? queueData.filter(q => q.priority === 'emergency').length : 1,
        completed_consultations: 12,
        total_appointments: Array.isArray(aptsData) ? aptsData.length : 15,
        total_doctors: docsData?.length || 10,
        active_doctors: 8,
        avg_predicted_wait: 14.5
      });
      setSlotAnalytics(slotData);
      setDoctors(docsData || []);
      setDepartments(deptsData || []);
      setUsers(usersData || []);
      setQueues(Array.isArray(queueData) ? queueData : []);
      setAppointments(Array.isArray(aptsData) ? aptsData : []);
      if (Array.isArray(patientsData)) {
        setPatientsList(patientsData);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    setRefreshing(true);
    await fetchAdminData();
  };

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const handleToggleDoctorLeave = async (doctorId, currentOnLeave) => {
    const newOnLeave = !currentOnLeave;
    let reason = '';
    if (newOnLeave) {
      reason = window.prompt(
        `Mark Dr. as On Leave Today.\n\nOptional: Enter a leave reason (press OK to confirm):`,
        'Doctor is on leave today'
      );
      if (reason === null) return; // User cancelled
      reason = reason.trim() || 'Doctor is on leave today';
    } else {
      const confirmed = window.confirm('Restore this doctor to Available? This will clear the on-leave flag.');
      if (!confirmed) return;
    }
    setDoctorLeaveLoading(doctorId);
    try {
      const res = await hospitalApi.toggleDoctorLeave(doctorId, newOnLeave, reason);
      // Optimistically update local state
      setDoctors(prev => prev.map(d =>
        d.doctor_id === doctorId
          ? { ...d, on_leave: newOnLeave, available: !newOnLeave, leave_reason: reason }
          : d
      ));
      const notifMsg = res.patients_notified
        ? `\n\n${res.patients_notified} affected patient(s) have been notified.`
        : '';
      alert(`${res.message}${notifMsg}`);
    } catch (err) {
      console.error('Toggle leave error:', err);
      alert(err.response?.data?.error || 'Failed to update doctor leave status. Please try again.');
    } finally {
      setDoctorLeaveLoading(null);
    }
  };

  const handleVerifyArrival = async (e) => {
    if (e) e.preventDefault();
    if (!verifyTokenId.trim() || !verifyOtp.trim()) {
      setVerifyError('Please enter both Token / Booking ID and 6-digit Arrival OTP');
      return;
    }
    setVerifyLoading(true);
    setVerifyMessage(null);
    setVerifyError(null);
    try {
      const res = await hospitalApi.verifyArrivalOtp(verifyTokenId.trim(), verifyOtp.trim());
      setVerifyMessage(res.message || `Token ${verifyTokenId} verified successfully! Patient marked as Arrived.`);
      setVerifyTokenId('');
      setVerifyOtp('');
      await fetchAdminData();
    } catch (err) {
      setVerifyError(err.response?.data?.error || 'Invalid OTP code or token not found.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleQuickFillVerify = (token) => {
    setVerifyTokenId(token.queue_id || token.booking_id || '');
    if (token.arrival_otp) {
      setVerifyOtp(token.arrival_otp);
    }
    setActiveTab('arrival-desk');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    try {
      await hospitalApi.adminCreateDoctor(docForm);
      setIsDocModalOpen(false);
      setDocForm({
        name: '',
        department: 'Cardiology',
        specialization: '',
        experience: '8 years',
        consultation_room: 'Room 101',
        working_hours: '09:00 AM - 04:00 PM',
        avg_consultation_duration: 15
      });
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add doctor');
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    try {
      await hospitalApi.createDepartment(deptForm);
      setIsDeptModalOpen(false);
      setDeptForm({ name: '', description: '', room: 'OPD Block', head_doctor: '' });
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add department');
    }
  };

  if (loading) {
    return <LoadingState message="Loading administrative portal records..." />;
  }

  const waitingQueues = queues.filter(q => q.status === 'waiting' || q.status === 'arrived' || q.status === 'called');
  const emergencyQueues = queues.filter(q => q.priority === 'emergency' && q.status !== 'completed' && q.status !== 'cancelled');
  const unverifiedArrivals = queues.filter(q => !q.verified_by_admin && q.status !== 'completed' && q.status !== 'cancelled');

  return (
    <div className="min-h-screen bg-slate-50/70 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-200/80 px-3 py-1 rounded-full mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-sky-600" />
              <span>{t('admin', 'Admin')} Clearance</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {t('admin_portal', 'Hospital Administration Portal')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {t('admin_subtitle', 'Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH), Tumakuru • Master Control Panel')}
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="self-start sm:self-auto px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-600' : ''}`} />
            <span>{t('refresh', 'Refresh Data')}</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 mb-8 text-xs font-bold scrollbar-thin">
          <button
            onClick={() => handleTabChange('overview')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 ${
              activeTab === 'overview'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {t('hospital_overview', 'System Overview')}
          </button>
          
          <button
            onClick={() => handleTabChange('arrival-desk')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeTab === 'arrival-desk'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t('arrival_desk_tab', 'Arrival Desk (Verify OTP)')}</span>
            {unverifiedArrivals.length > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-black">
                {unverifiedArrivals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('patient-records')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeTab === 'patient-records'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('patient_records', 'Patient Records')}</span>
            {patientsList.length > 0 && (
              <span className="px-1.5 py-0.2 bg-teal-200 text-teal-900 rounded-full text-[10px] font-black">
                {patientsList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('live-queues')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeTab === 'live-queues'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{t('hospital_live_opd_queues', 'Live Queues')} ({waitingQueues.length})</span>
            {emergencyQueues.length > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-black animate-pulse">
                {emergencyQueues.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('appointments')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeTab === 'appointments'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{t('appointments_bookings_monitor', 'Appointments')} ({appointments.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('doctors')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 ${
              activeTab === 'doctors'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {t('doctor', 'Doctors')} ({doctors.length})
          </button>
          
          <button
            onClick={() => handleTabChange('departments')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 ${
              activeTab === 'departments'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {t('departments', 'Departments')} ({departments.length})
          </button>
          
          <button
            onClick={() => handleTabChange('users')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 ${
              activeTab === 'users'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {t('registered_system_accounts', 'User Accounts')} ({users.length})
          </button>
          
          <button
            onClick={() => handleTabChange('settings')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 ${
              activeTab === 'settings'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {t('hospital_opd_params', 'OPD Settings')}
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('doctor', 'Total Doctors')}</span>
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mb-1">{doctors.length}</div>
                <p className="text-xs text-slate-500 font-medium">{t('across_clinical_wings', { count: departments.length }, `Across ${departments.length} clinical wings`)}</p>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('patients_waiting', 'Waiting Patients')}</span>
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-teal-700 mb-1">
                  {analytics?.total_patients_waiting || 0}
                </div>
                <p className="text-xs text-teal-800 font-medium">{t('active_queue_tokens_today', 'Active queue tokens today')}</p>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('emergency_cases', 'Emergency Queue')}</span>
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-rose-600 mb-1">
                  {analytics?.emergency_patients || 0}
                </div>
                <p className="text-xs text-rose-700 font-medium">{t('priority_clinical_cases', 'Priority clinical cases')}</p>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('completed_today', 'Completed Visits')}</span>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-emerald-700 mb-1">
                  {analytics?.completed_consultations || 0}
                </div>
                <p className="text-xs text-emerald-800 font-medium">{t('consultations_finished', 'Consultations finished')}</p>
              </div>
            </div>

            {/* OPD Consultation Slot Operational Demand & Capacity Breakdown */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-sky-600" />
                    <h3 className="text-base font-extrabold text-slate-900">
                      {t('slot_demand_capacity', 'Consultation Slot Operational Demand & Capacity')}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('slot_demand_desc', 'Live database metrics separating slot demand from the active eligible queue')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-full text-xs font-bold">
                    {t('total_capacity_label', { count: slotAnalytics?.summary?.total_capacity || 90 }, `Total Capacity: ${slotAnalytics?.summary?.total_capacity || 90}`)}
                  </span>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                    {t('total_booked_label', { count: slotAnalytics?.summary?.total_booked || 0 }, `Total Booked: ${slotAnalytics?.summary?.total_booked || 0}`)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Morning Slot Card */}
                {(() => {
                  const m = slotAnalytics?.slots?.morning;
                  const booked = m?.booked_count || 0;
                  const capacity = m?.max_capacity || 40;
                  const active = m?.active_queue_count || 0;
                  const completed = m?.completed_count || 0;
                  const remaining = m?.remaining_capacity || 40;
                  const util = m?.utilization_pct || (booked > 0 ? Math.round((booked / capacity) * 100) : 0);
                  const avgWait = m?.avg_wait_mins || 14;

                  return (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/5 via-sky-500/5 to-teal-500/5 border border-amber-200/80 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shadow-2xs">
                            <Sun className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900">{t('morning_slot_title', 'Morning Consultation Slot')}</h4>
                            <div className="text-xs font-bold text-sky-700">09:00 AM – 01:00 PM</div>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg text-xs font-extrabold">
                          {t('pct_booked', { pct: util }, `${util}% Booked`)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1.5">
                          <span>{t('capacity_utilization', 'Capacity Utilization')}</span>
                          <span>{t('bookings_util_summary', { booked, capacity, remaining }, `${booked} / ${capacity} Bookings (${remaining} available)`)}</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-teal-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, util)}%` }}
                          />
                        </div>
                      </div>

                      {/* 3 Metric Badges */}
                      <div className="grid grid-cols-3 gap-2.5 pt-1 text-center">
                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('active_in_line', 'Active In Line')}</span>
                          <span className="text-base font-black text-sky-900">{active}</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('completed', 'Completed')}</span>
                          <span className="text-base font-black text-emerald-700">{completed}</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('avg_wait', 'Avg Wait')}</span>
                          <span className="text-base font-black text-purple-700">~{avgWait}m</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Afternoon/Evening Slot Card */}
                {(() => {
                  const e = slotAnalytics?.slots?.evening;
                  const booked = e?.booked_count || 0;
                  const capacity = e?.max_capacity || 50;
                  const active = e?.active_queue_count || 0;
                  const completed = e?.completed_count || 0;
                  const remaining = e?.remaining_capacity || 50;
                  const util = e?.utilization_pct || (booked > 0 ? Math.round((booked / capacity) * 100) : 0);
                  const avgWait = e?.avg_wait_mins || 16;

                  return (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-sky-500/5 border border-indigo-200/80 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-2xs">
                            <Moon className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900">{t('evening_slot_title', 'Afternoon / Evening Slot')}</h4>
                            <div className="text-xs font-bold text-indigo-700">02:00 PM – 09:00 PM</div>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-indigo-100 text-indigo-900 rounded-lg text-xs font-extrabold">
                          {t('pct_booked', { pct: util }, `${util}% Booked`)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1.5">
                          <span>{t('capacity_utilization', 'Capacity Utilization')}</span>
                          <span>{t('bookings_util_summary', { booked, capacity, remaining }, `${booked} / ${capacity} Bookings (${remaining} available)`)}</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-sky-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, util)}%` }}
                          />
                        </div>
                      </div>

                      {/* 3 Metric Badges */}
                      <div className="grid grid-cols-3 gap-2.5 pt-1 text-center">
                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('active_in_line', 'Active In Line')}</span>
                          <span className="text-base font-black text-indigo-900">{active}</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('completed', 'Completed')}</span>
                          <span className="text-base font-black text-emerald-700">{completed}</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('avg_wait', 'Avg Wait')}</span>
                          <span className="text-base font-black text-purple-700">~{avgWait}m</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Quick Actions Strip */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap gap-4 items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{t('admin_quick_actions', 'Hospital Administration Quick Actions')}</h3>
                <p className="text-xs text-slate-500">{t('deploy_clinical_updates', 'Deploy clinical updates or register doctors to MongoDB')}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDocModalOpen(true)}
                  className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('register_doctor', 'Register Doctor')}</span>
                </button>
                <button
                  onClick={() => setIsDeptModalOpen(true)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('add_department', 'Add Department')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ARRIVAL DESK (Verify Patient OTP upon Hospital Arrival) */}
        {activeTab === 'arrival-desk' && (
          <div className="space-y-8">
            {/* Reception Desk Verification Form Card */}
            <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl border border-emerald-500/30">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 block">
                      {t('reception_checkin_desk', 'SIMSRH Reception Check-In Desk')}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                      {t('verify_patient_arrival_otp', 'Verify Patient Arrival OTP')}
                    </h2>
                  </div>
                </div>
                <div className="text-xs text-slate-300 font-semibold bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10">
                  <span>{t('front_desk_clearance', 'Front Desk Clearance Level')}</span>
                </div>
              </div>

              {/* Feedback Banners */}
              {verifyMessage && (
                <div className="mt-4 p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-xs text-emerald-200 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold">{verifyMessage}</span>
                </div>
              )}
              {verifyError && (
                <div className="mt-4 p-4 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-xs text-rose-200 flex items-center gap-2.5">
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-bold">{verifyError}</span>
                </div>
              )}

              {/* Form Inputs */}
              <form onSubmit={handleVerifyArrival} className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    {t('queue_token_or_booking_id', 'Queue Token or Booking ID *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('enter_token_or_booking_placeholder', 'e.g. Q001 or B001')}
                    value={verifyTokenId}
                    onChange={(e) => setVerifyTokenId(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-sm font-mono text-white placeholder:text-slate-500 focus:bg-white/20 focus:border-emerald-400 focus:outline-none transition uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    {t('patient_6digit_otp', "Patient's 6-Digit Arrival OTP *")}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder={t('enter_otp_placeholder', 'e.g. 482910')}
                    value={verifyOtp}
                    onChange={(e) => setVerifyOtp(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-sm font-mono tracking-widest text-emerald-300 placeholder:text-slate-500 focus:bg-white/20 focus:border-emerald-400 focus:outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={verifyLoading}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-60"
                >
                  {verifyLoading ? (
                    <span>{t('verifying_otp_server', 'Verifying OTP with Server...')}</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t('verify_arrival_clear_patient', 'Verify Arrival & Clear Patient')}</span>
                    </>
                  )}
                </button>
              </form>

              <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
                ℹ️ {t('reception_otp_instruction', 'When a patient arrives at Shridevi Hospital reception, enter their Queue Token (or Booking ID) and the 6-digit code shown on their smartphone. Once verified, their status will update to Arrived & Verified, allowing the doctor to call and start consultation.')}
              </p>
            </div>

            {/* Table of Patients Awaiting Arrival Verification */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {t('patients_in_queue_awaiting', { count: unverifiedArrivals.length }, `Patients In Queue — Awaiting Reception Arrival Check-In (${unverifiedArrivals.length})`)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('patients_en_route_campus', 'Patients en route or recently arrived at SIMSRH Tumakuru campus')}
                  </p>
                </div>
              </div>

              {unverifiedArrivals.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">{t('all_queued_patients_verified', 'All currently queued patients are checked-in and verified!')}</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">{t('new_booked_patients_appear', 'New booked patients will appear here for reception check-in.')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                        <th className="pb-3 px-3">{t('token_col', 'Token')}</th>
                        <th className="pb-3 px-3">{t('patient_name_col', 'Patient Name')}</th>
                        <th className="pb-3 px-3">{t('clinical_details_col', 'Clinical Details')}</th>
                        <th className="pb-3 px-3">{t('origin_city', 'Origin / City')}</th>
                        <th className="pb-3 px-3">{t('doctor_and_room', 'Doctor / Room')}</th>
                        <th className="pb-3 px-3">{t('priority', 'Priority')}</th>
                        <th className="pb-3 px-3 text-right">{t('quick_action', 'Quick Action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {unverifiedArrivals.map((q) => (
                        <tr key={q.queue_id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-3 font-mono font-black text-sky-700">
                            {q.queue_id}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900">
                            {q.patient_name || q.patient_id}
                            <div className="text-[10px] text-slate-400 font-normal">
                              {q.patient_phone ? `+91 ${q.patient_phone}` : t('patient', 'Patient')}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[11px]">
                            <div className="font-bold text-slate-800">
                              {q.age ? `${q.age}y` : ''} {q.gender ? `• ${q.gender}` : ''}
                            </div>
                            <div className="text-slate-500 truncate max-w-[140px]">
                              {Array.isArray(q.symptoms) ? q.symptoms.join(', ') : 'General'} ({q.duration_days || 1}d)
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[11px] font-semibold text-slate-600">
                            📍 {q.city || 'Tumakuru'}
                          </td>
                          <td className="py-3 px-3 text-[11px]">
                            <div className="font-bold text-slate-900">{q.doctor_id || 'Doctor'}</div>
                            <div className="text-emerald-700 font-bold">{q.room_number || 'Room 204'} ({q.department})</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              q.priority === 'emergency' ? 'bg-rose-100 text-rose-800 animate-pulse' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {q.priority === 'emergency' ? t('emergency_priority', 'EMERGENCY') : t('normal_priority', 'Normal')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleQuickFillVerify(q)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{t('check_in', 'Check-In')}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: PATIENT RECORDS & EMR (Single Source of Truth MongoDB) */}
        {activeTab === 'patient-records' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                      {t('unified_mongodb_records', 'Unified MongoDB Patient Records')}
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900">{t('patient_records_history', 'Patient Records & Consultation History')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('patient_records_subtitle', 'Search registered patients by Patient ID, Name, or Phone. Open persistent profiles and complete clinical visit timelines.')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3.5 py-1.5 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-teal-600" />
                    <span>{t('registered_patients_count', { count: patientsList.length }, `${patientsList.length} Registered Patients`)}</span>
                  </span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={patientSearchQuery}
                    onChange={(e) => {
                      setPatientSearchQuery(e.target.value);
                      handleSearchPatients(e.target.value);
                    }}
                    placeholder={t('search_patient_placeholder')}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-teal-500 focus:outline-none transition"
                  />
                  {patientSearchQuery && (
                    <button
                      onClick={() => {
                        setPatientSearchQuery('');
                        handleSearchPatients('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleSearchPatients(patientSearchQuery)}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{t('search_records_btn', 'Search')}</span>
                </button>
              </div>

              {/* Patients List Table */}
              {patientSearchLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                  <p>{t('searching_patient_db', 'Searching patient records database...')}</p>
                </div>
              ) : patientsList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-600">{t('no_records_found')}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t('try_searching_other_query', 'Try searching by another phone number, name, or patient ID.')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                        <th className="pb-3 px-3">{t('patient_id_col', 'Patient ID')}</th>
                        <th className="pb-3 px-3">{t('name_demographics_col', 'Name & Demographics')}</th>
                        <th className="pb-3 px-3">{t('phone_col', 'Phone')}</th>
                        <th className="pb-3 px-3">{t('village_city_col', 'Village / City')}</th>
                        <th className="pb-3 px-3">{t('total_visits_col', 'Total Visits')}</th>
                        <th className="pb-3 px-3">{t('last_visit_col', 'Last Visit')}</th>
                        <th className="pb-3 px-3 text-right">{t('actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {patientsList.map((pt) => (
                        <tr key={pt.patient_id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              {pt.patient_id}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <span>{pt.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {pt.age ? `${pt.age} yrs` : ''} {pt.gender ? `• ${pt.gender}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-800">
                            {pt.phone || '—'}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {pt.city || 'Tumakuru'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{t('visits_count', { count: pt.total_visits || 0 }, `${pt.total_visits || 0} visits`)}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600 text-[11px]">
                            {pt.last_visit_date || 'N/A'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleOpenPatientHistory(pt.patient_id)}
                              disabled={patientRecordLoading}
                              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer ml-auto"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>{t('open_records', 'Open Records')}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Slide-Over Drawer: Complete Patient Profile & Consultation Timeline */}
            {selectedPatientRecord && (
              <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
                <div 
                  className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl overflow-y-auto flex flex-col border-l border-slate-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Drawer Header */}
                  <div className="bg-gradient-to-r from-teal-800 to-cyan-900 text-white p-6 sticky top-0 z-10">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[11px] uppercase tracking-widest text-teal-200 font-bold">
                          {t('admin_patient_view', 'Admin Patient Records View')}
                        </span>
                        <h3 className="text-xl font-bold mt-0.5">
                          {selectedPatientRecord.patient?.name || t('patient_details', 'Patient Details')}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-teal-100">
                          <span className="font-mono bg-white/10 px-2 py-0.5 rounded">
                            ID: {selectedPatientRecord.patient?.patient_id}
                          </span>
                          <span>•</span>
                          <span>📞 {selectedPatientRecord.patient?.phone}</span>
                          <span>•</span>
                          <span>📍 {selectedPatientRecord.patient?.city || 'Tumakuru'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedPatientRecord(null)}
                        className="p-2 text-teal-100 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Drawer Content */}
                  <div className="p-6 space-y-6 flex-1">
                    {/* Patient Master Profile Card */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-teal-600" /> {t('patient_persistent_profile', 'Patient Persistent Profile')}
                        </span>
                        <span className="text-xs font-bold text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-full">
                          {t('total_consultations_count', { count: selectedPatientRecord.consultations?.length || 0 }, `${selectedPatientRecord.consultations?.length || 0} Total Consultations`)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">{t('age_label', 'Age:')}</span>
                          <span className="font-bold text-slate-800">{selectedPatientRecord.patient?.age || '—'} yrs</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">{t('gender_label', 'Gender:')}</span>
                          <span className="font-bold text-slate-800">{selectedPatientRecord.patient?.gender || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">{t('height_label', 'Height:')}</span>
                          <span className="font-bold text-slate-800">
                            {selectedPatientRecord.patient?.height_cm ? `${selectedPatientRecord.patient?.height_cm} cm` : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">{t('weight_label', 'Weight:')}</span>
                          <span className="font-bold text-slate-800">
                            {selectedPatientRecord.patient?.weight_kg ? `${selectedPatientRecord.patient?.weight_kg} kg` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Chronological Timeline */}
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-teal-600" />
                        <span>{t('consultation_history_chronological', 'Complete Consultation History (Chronological)')}</span>
                      </h4>

                      {!selectedPatientRecord.consultations || selectedPatientRecord.consultations.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p>{t('no_completed_history', 'No completed consultation history on file for this patient.')}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedPatientRecord.consultations.map((c, cIdx) => {
                            const date = c.consultation_date || (c.created_at ? c.created_at.split('T')[0] : 'N/A');
                            const time = c.consultation_time || (c.created_at && c.created_at.includes('T') ? c.created_at.split('T')[1].substring(0, 5) : 'OPD');
                            const vitals = c.vitals_at_consultation || {};
                            const pReported = c.patient_reported || {};
                            const dAssess = c.doctor_assessment || {};
                            const symptoms = pReported.symptoms || c.symptoms || [];
                            const symptomsList = Array.isArray(symptoms) ? symptoms : [symptoms];
                            const diagnosis = dAssess.diagnosis || c.diagnosis;
                            const notes = dAssess.notes || c.doctor_notes;
                            const advice = dAssess.advice || c.doctor_advice;

                            return (
                              <div key={c.consultation_id || c.queue_id || cIdx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
                                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                      <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                        Patient ID: {c.patient_id || selectedPatientRecord.patient?.patient_id || 'N/A'}
                                      </span>
                                      <span className="font-mono text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                        Ref: {c.consultation_id || c.queue_id || 'OPD-REC'}
                                      </span>
                                      <span className="font-bold text-teal-700 flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" /> {date}
                                      </span>
                                      <span>•</span>
                                      <span>{time}</span>
                                    </div>

                                    {/* Patient FULL NAME */}
                                    <h4 className="text-base font-black text-slate-900 flex items-center gap-1.5 pt-0.5">
                                      <User className="w-4 h-4 text-teal-600" />
                                      <span>{c.patient_name || selectedPatientRecord.patient?.name || 'Patient'}</span>
                                    </h4>

                                    <div className="text-xs text-slate-600 flex items-center gap-2">
                                      <span className="font-bold text-slate-800 flex items-center gap-1">
                                        <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                                        <span>{c.doctor_name || c.doctor_id || 'Doctor'}</span>
                                      </span>
                                      <span className="text-xs text-sky-700 font-semibold px-2 py-0.2 rounded-full bg-sky-50 border border-sky-200">
                                        {c.department || 'General Medicine'}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => setModalConsultation(c)}
                                    className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>{t('view_full_record', 'View Full Record')}</span>
                                  </button>
                                </div>

                                {/* Vitals Summary Strip (Age, Gender, Height, Weight, BMI, Duration, Origin) */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl text-slate-600 border border-slate-100">
                                  <div>{t('age_label', 'Age:')} <strong className="text-slate-900">{vitals.age ?? c.age ?? selectedPatientRecord.patient?.age ?? '—'} yrs</strong></div>
                                  <div>{t('gender_label', 'Gender:')} <strong className="text-slate-900">{vitals.gender ?? c.gender ?? selectedPatientRecord.patient?.gender ?? '—'}</strong></div>
                                  <div>{t('height_label', 'Ht:')} <strong className="text-slate-900">{vitals.height_cm ?? c.height_cm ?? selectedPatientRecord.patient?.height_cm ? `${vitals.height_cm ?? c.height_cm ?? selectedPatientRecord.patient?.height_cm}cm` : '—'}</strong></div>
                                  <div>{t('weight_label', 'Wt:')} <strong className="text-slate-900">{vitals.weight_kg ?? c.weight_kg ?? selectedPatientRecord.patient?.weight_kg ? `${vitals.weight_kg ?? c.weight_kg ?? selectedPatientRecord.patient?.weight_kg}kg` : '—'}</strong></div>
                                  <div>{t('bmi_label', 'BMI:')} <strong className="text-teal-700 font-bold">{vitals.bmi ? `${vitals.bmi}` : '—'}</strong></div>
                                  <div>{t('duration_label', 'Duration:')} <strong className="text-slate-900">{pReported.duration_days ?? c.duration_days ?? 1} d</strong></div>
                                  <div className="truncate" title={vitals.city || c.city || selectedPatientRecord.patient?.city || 'Tumakuru'}>
                                    {t('origin_label', 'Origin:')} <strong className="text-slate-900">📍 {vitals.city || c.city || selectedPatientRecord.patient?.city || 'Tumakuru'}</strong>
                                  </div>
                                </div>

                                {/* Clinical Breakdown */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                  {/* Patient complaints */}
                                  <div className="p-3 bg-sky-50/50 rounded-lg border border-sky-100 space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 block">
                                      {t('patient_reported_complaints', 'Patient-Reported Complaints')}
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {symptomsList.map((s, idx) => (
                                        <span key={idx} className="px-1.5 py-0.5 bg-white text-sky-900 rounded text-[11px] border border-sky-200 font-medium">
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                    {pReported.duration_days && (
                                      <p className="text-[11px] text-slate-600 pt-0.5">
                                        {t('duration_days_count', { count: pReported.duration_days }, `Duration: ${pReported.duration_days} day(s)`)}
                                      </p>
                                    )}
                                  </div>

                                  {/* Doctor assessment */}
                                  <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100 space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                                      {t('doctor_recorded_assessment', 'Doctor-Recorded Assessment')}
                                    </span>
                                    <div>
                                      {diagnosis ? (
                                        <span className="px-2 py-0.5 bg-white text-emerald-900 rounded text-[11px] font-bold border border-emerald-200 inline-block">
                                          {diagnosis}
                                        </span>
                                      ) : (
                                        <span className="text-[11px] italic text-slate-400">
                                          {t('no_diagnosis_recorded', 'No diagnosis recorded by physician')}
                                        </span>
                                      )}
                                    </div>
                                    {advice && (
                                      <p className="text-[11px] text-slate-700 line-clamp-2 pt-0.5">
                                        <strong>{t('advice_label', 'Advice:')}</strong> {advice}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Drawer Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button
                      onClick={() => setSelectedPatientRecord(null)}
                      className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      {t('close_records', 'Close Records')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LIVE QUEUES & EMERGENCY MONITOR */}
        {activeTab === 'live-queues' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">{t('hospital_live_opd_queues', 'Hospital Live OPD Queues')}</h2>
                <p className="text-xs text-slate-500">{t('realtime_positions_wait', 'Real-time queue positions and waiting times across all OPD departments')}</p>
              </div>

              {/* Department Filter */}
              <div className="flex items-center gap-2 overflow-x-auto">
                {['All', 'Cardiology', 'General Medicine', 'Orthopedics', 'Pediatrics', 'Neurology'].map((dept) => {
                  const deptLabel = dept === 'All'
                    ? t('filter_all', 'All')
                    : t('dept_' + dept.toLowerCase().replace(/[^a-z]/g, '_'), dept);
                  return (
                    <button
                      key={dept}
                      onClick={() => setSelectedDeptFilter(dept)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                        selectedDeptFilter === dept
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {deptLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Emergency Banner if any emergencies */}
            {emergencyQueues.length > 0 && (
              <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 text-rose-600 animate-pulse shrink-0" />
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-rose-800 block">
                      {t('emergency_triage_alert', 'Emergency Triage Alert')}
                    </span>
                    <span className="text-xs text-rose-700 font-semibold">
                      {t('emergency_flagged_count', { count: emergencyQueues.length }, `${emergencyQueues.length} patient(s) have been flagged for high-priority emergency triage attention.`)}
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 bg-rose-600 text-white text-xs font-black rounded-xl">
                  {t('priority_num1', 'PRIORITY #1')}
                </span>
              </div>
            )}

            {/* Queues Table */}
            <div className="overflow-x-auto">
              {(() => {
                const filtered = queues.filter((q) => {
                  if (selectedDeptFilter !== 'All' && q.department !== selectedDeptFilter) return false;
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-12 text-center text-slate-400 text-xs">
                      <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p>{t('no_queue_items_dept', { dept: selectedDeptFilter }, `No queue items found for department: ${selectedDeptFilter}`)}</p>
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                        <th className="pb-3 px-3">{t('pos_col', 'Pos')}</th>
                        <th className="pb-3 px-3">{t('token_col', 'Token')}</th>
                        <th className="pb-3 px-3">{t('patient_name_col', 'Patient Name')}</th>
                        <th className="pb-3 px-3">{t('clinical_details_col', 'Clinical Consultation Details')}</th>
                        <th className="pb-3 px-3">{t('specialist_room_col', 'Specialist & Room')}</th>
                        <th className="pb-3 px-3">{t('arrival_status_col', 'Arrival Status')}</th>
                        <th className="pb-3 px-3">{t('est_wait_col', 'Est. Wait')}</th>
                        <th className="pb-3 px-3">{t('queue_status_col', 'Queue Status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filtered.map((q) => (
                        <tr key={q.queue_id} className={`hover:bg-slate-50 transition ${q.priority === 'emergency' ? 'bg-rose-50/40' : ''}`}>
                          <td className="py-3 px-3">
                            <span className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center font-black">
                              #{q.position}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-black text-sky-800">
                            {q.queue_id}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900">
                            {q.patient_name || q.patient_id}
                            <div className="text-[10px] text-slate-400 font-normal">
                              📍 {q.city || 'Tumakuru'}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[11px]">
                            <div className="font-bold text-slate-800">
                              {q.age ? `${q.age}y` : ''} {q.gender ? `• ${q.gender}` : ''}
                            </div>
                            <div className="text-slate-600 truncate max-w-[160px]">
                              {Array.isArray(q.symptoms) ? q.symptoms.join(', ') : 'General Checkup'} ({q.duration_days || 1}d)
                            </div>
                            {q.height_cm && (
                              <div className="text-[10px] text-slate-400">
                                H: {q.height_cm}cm {q.weight_kg ? `• W: ${q.weight_kg}kg` : ''}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[11px]">
                            <div className="font-bold text-slate-900">{q.doctor_id || 'Doctor'}</div>
                            <div className="text-emerald-700 font-bold">{q.room_number || 'Room 204'}</div>
                            <div className="text-sky-700 text-[10px] font-semibold">{q.department}</div>
                          </td>
                          <td className="py-3 px-3">
                            {q.verified_by_admin || q.arrived_at_hospital ? (
                              <span className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-[10px] inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>{t('verified_badge', 'Verified')}</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleQuickFillVerify(q)}
                                className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>{t('pending_checkin', 'Pending Check-in')}</span>
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-3 text-purple-700 font-bold font-mono">
                            ~{q.predicted_wait_time || 15}m
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              q.status === 'in_consultation' ? 'bg-emerald-100 text-emerald-800' :
                              q.status === 'called' ? 'bg-amber-100 text-amber-800' :
                              q.status === 'completed' ? 'bg-slate-100 text-slate-600' : 'bg-sky-100 text-sky-800'
                            }`}>
                              {q.status === 'in_consultation' ? t('in_consultation_status', 'In Consultation') :
                               q.status === 'called' ? t('called_status', 'Called') :
                               q.status === 'completed' ? t('completed_status', 'Completed') :
                               t('waiting_in_line', 'Waiting')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 4: APPOINTMENTS / BOOKINGS OPERATIONAL MONITOR */}
        {activeTab === 'appointments' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <span>{t('appointments_bookings_monitor', 'Appointments & Bookings Monitor')}</span>
                </h2>
                <p className="text-xs text-slate-500">{t('live_operational_booking_records', 'Live operational booking records across hospital clinics (Zero Patient PII / Clinical Data)')}</p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-extrabold text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200">
                  {t('total_bookings_count', { count: appointments.length }, `${appointments.length} Total Bookings`)}
                </span>
                <button
                  type="button"
                  onClick={fetchDashboardData}
                  disabled={refreshing}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Refresh bookings"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>{t('refresh', 'Refresh')}</span>
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('filter_bookings_placeholder', 'Filter by token (e.g. Q001), doctor, dept, or booking ID...')}
                  value={bookingSearchQuery}
                  onChange={(e) => setBookingSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">{t('status_filter_label', 'Status:')}</span>
                <select
                  value={bookingStatusFilter}
                  onChange={(e) => setBookingStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
                >
                  <option value="ALL">{t('all_statuses', 'All Statuses')}</option>
                  <option value="booked">{t('booked_status', 'Booked')}</option>
                  <option value="confirmed">{t('confirmed_status', 'Confirmed')}</option>
                  <option value="waiting">{t('waiting_status', 'Waiting')}</option>
                  <option value="arrived">{t('arrived_status', 'Arrived')}</option>
                  <option value="in_consultation">{t('in_consultation_status', 'In Consultation')}</option>
                  <option value="completed">{t('completed_status', 'Completed')}</option>
                  <option value="missed">{t('skipped_missed_status', 'Skipped / Missed Consultation')}</option>
                  <option value="cancelled">{t('cancelled_status', 'Cancelled')}</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 px-3">{t('token_number_col', 'Token Number')}</th>
                    <th className="pb-3 px-3">{t('doctor_name_col', 'Doctor Name')}</th>
                    <th className="pb-3 px-3">{t('department_col', 'Department')}</th>
                    <th className="pb-3 px-3">{t('consultation_date_col', 'Consultation Date')}</th>
                    <th className="pb-3 px-3">{t('consultation_slot_col', 'Consultation Slot')}</th>
                    <th className="pb-3 px-3">{t('exact_booked_time_col', 'Exact Booked Date/Time')}</th>
                    <th className="pb-3 px-3">{t('current_queue_pos_col', 'Current Queue Position')}</th>
                    <th className="pb-3 px-3">{t('current_status_col', 'Current Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(() => {
                    const q = bookingSearchQuery.trim().toLowerCase();
                    const filtered = appointments.filter((apt) => {
                      const matchesQuery = !q || (
                        (apt.token_number || apt.queue_id || '').toLowerCase().includes(q) ||
                        (apt.booking_id || '').toLowerCase().includes(q) ||
                        (apt.doctor_name || apt.doctor_id || '').toLowerCase().includes(q) ||
                        (apt.department || '').toLowerCase().includes(q) ||
                        (apt.consultation_date || '').toLowerCase().includes(q)
                      );
                      const rawStatus = (apt.current_status || apt.status || '').toLowerCase().trim();
                      let matchesStatus = true;
                      if (bookingStatusFilter !== 'ALL') {
                        const target = bookingStatusFilter.toLowerCase();
                        if (target === 'booked') {
                          matchesStatus = rawStatus === 'booked';
                        } else if (target === 'confirmed') {
                          matchesStatus = rawStatus === 'confirmed';
                        } else if (target === 'waiting') {
                          matchesStatus = rawStatus === 'waiting';
                        } else if (target === 'arrived') {
                          matchesStatus = rawStatus === 'arrived' || rawStatus === 'ready' || rawStatus === 'called';
                        } else if (target === 'in_consultation') {
                          matchesStatus = rawStatus === 'in_consultation';
                        } else if (target === 'completed') {
                          matchesStatus = rawStatus === 'completed';
                        } else if (target === 'missed') {
                          matchesStatus = rawStatus === 'missed' || rawStatus === 'skipped' || rawStatus === 'missed_consultation' || rawStatus === 'no_show';
                        } else if (target === 'cancelled') {
                          matchesStatus = rawStatus === 'cancelled';
                        } else {
                          matchesStatus = rawStatus === target;
                        }
                      }
                      return matchesQuery && matchesStatus;
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-400">
                            {t('no_matching_bookings', 'No matching booking records found.')}
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((apt) => {
                      const tokenNum = apt.token_number || apt.queue_id || '—';
                      const docName = apt.doctor_name || apt.doctor_id || 'Dr. Assigned Specialist';
                      const deptName = apt.department || 'General OPD';
                      const consultDate = apt.consultation_date || 'Today';
                      
                      const slotObj = apt.consultation_slot || {};
                      const slotName = slotObj.slot_name || (apt.slot_id === 'evening' ? t('evening_slot', 'Evening Slot') : t('morning_slot', 'Morning Slot'));
                      const slotTime = slotObj.display_time || (apt.slot_id === 'evening' ? '02:00 PM – 09:00 PM' : '09:00 AM – 01:00 PM');
                      
                      const bookedTime = formatExactBookedTime(apt.booked_at || apt.created_at);
                      const currentPos = apt.current_queue_position ?? apt.position;
                      const rawStatus = (apt.current_status || apt.status || 'booked').toLowerCase().trim();

                      // Status Badge Style
                      const getStatusBadge = (st) => {
                        switch (st) {
                          case 'in_consultation':
                            return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold';
                          case 'ready':
                          case 'called':
                            return 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold animate-pulse';
                          case 'waiting':
                            return 'bg-sky-100 text-sky-800 border-sky-300 font-bold';
                          case 'arrived':
                            return 'bg-teal-100 text-teal-800 border-teal-300 font-bold';
                          case 'completed':
                            return 'bg-slate-100 text-slate-700 border-slate-200';
                          case 'cancelled':
                            return 'bg-rose-100 text-rose-800 border-rose-300';
                          case 'missed':
                          case 'skipped':
                          case 'missed_consultation':
                          case 'no_show':
                            return 'bg-orange-100 text-orange-800 border-orange-300';
                          case 'confirmed':
                            return 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold';
                          case 'booked':
                          default:
                            return 'bg-blue-50 text-blue-700 border-blue-200';
                        }
                      };

                      const getStatusText = (st) => {
                        switch (st) {
                          case 'in_consultation': return t('in_consultation_status', 'In Consultation');
                          case 'ready': return t('ready_status', 'Ready (Next Up)');
                          case 'called': return t('called_status', 'Called');
                          case 'waiting': return t('waiting_status', 'Waiting');
                          case 'arrived': return t('arrived_status', 'Arrived');
                          case 'completed': return t('completed_status', 'Completed');
                          case 'cancelled': return t('cancelled_status', 'Cancelled');
                          case 'missed':
                          case 'skipped':
                          case 'missed_consultation':
                          case 'no_show': return t('skipped_missed_status', 'Skipped / Missed Consultation');
                          case 'confirmed': return t('confirmed_status', 'Confirmed');
                          case 'booked': default: return t('booked_status', 'Booked');
                        }
                      };

                      return (
                        <tr key={apt.booking_id || tokenNum} className="hover:bg-slate-50 transition">
                          {/* 1. Token number */}
                          <td className="py-3.5 px-3">
                            <div className="font-mono font-black text-slate-900 text-sm">
                              {tokenNum !== '—' ? t('token_prefix', { token: tokenNum }, `Token #${tokenNum}`) : '—'}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              ID: {apt.booking_id}
                            </div>
                          </td>

                          {/* 2. Doctor name */}
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <Stethoscope className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              <span>{docName}</span>
                            </div>
                            <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                              {t('chamber_label', { room: apt.room_number || 'Room 204' }, `Chamber: ${apt.room_number || 'Room 204'}`)}
                            </div>
                          </td>

                          {/* 3. Department */}
                          <td className="py-3.5 px-3">
                            <span className="px-2.5 py-1 bg-sky-50 text-sky-800 rounded-lg font-bold text-xs border border-sky-100 inline-block">
                              {deptName}
                            </span>
                          </td>

                          {/* 4. Consultation date */}
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{consultDate}</span>
                            </div>
                          </td>

                          {/* 5. Consultation slot */}
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-slate-900">
                              {slotName}
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                              {slotTime}
                            </div>
                          </td>

                          {/* 6. Exact booked date/time */}
                          <td className="py-3.5 px-3">
                            <div className="text-slate-700 font-mono text-[11px] font-medium flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{bookedTime}</span>
                            </div>
                          </td>

                          {/* 7. Current queue position */}
                          <td className="py-3.5 px-3">
                            {['waiting', 'ready', 'called', 'in_consultation', 'arrived'].includes(rawStatus) && currentPos != null ? (
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-full font-mono font-black text-xs inline-block">
                                {t('in_line_pos', { pos: currentPos }, `#${currentPos} in line`)}
                              </span>
                            ) : rawStatus === 'completed' ? (
                              <span className="text-slate-400 font-mono text-xs font-semibold">{t('finished_status', '— (Finished)')}</span>
                            ) : rawStatus === 'cancelled' || rawStatus === 'missed' ? (
                              <span className="text-slate-400 font-mono text-xs font-semibold">—</span>
                            ) : currentPos != null ? (
                              <span className="font-mono text-slate-600 text-xs font-bold">#{currentPos}</span>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">—</span>
                            )}
                          </td>

                          {/* 8. Current status */}
                          <td className="py-3.5 px-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider border inline-block ${getStatusBadge(rawStatus)}`}>
                              {getStatusText(rawStatus)}
                            </span>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: DOCTORS DIRECTORY */}
        {activeTab === 'doctors' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">{t('medical_specialists_roster', 'Medical Specialists Roster')}</h2>
                <p className="text-xs text-slate-500">{t('active_physicians_hours', 'Active hospital physicians and consulting hours')}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {doctors.filter(d => d.on_leave).length > 0 && (
                  <span className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-1.5">
                    <BedDouble className="w-3.5 h-3.5 text-red-600" />
                    <span>{doctors.filter(d => d.on_leave).length} On Leave Today</span>
                  </span>
                )}
                <button
                  onClick={() => setIsDocModalOpen(true)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('add_doctor', 'Add Doctor')}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {doctors.map((doc) => (
                <div
                  key={doc.doctor_id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 ${
                    doc.on_leave
                      ? 'bg-red-50/40 border-red-200 ring-1 ring-red-100'
                      : 'bg-white border-slate-200/80 hover:border-sky-300 hover:shadow-xs'
                  }`}
                >
                  {/* Doctor header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        doc.on_leave
                          ? 'bg-red-100 text-red-600 border border-red-200'
                          : 'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}>
                        {doc.name?.split(' ').slice(-1)[0]?.[0] || 'D'}
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 leading-tight">{doc.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{doc.doctor_id}</div>
                      </div>
                    </div>
                    {/* On Leave / Available badge */}
                    {doc.on_leave ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 shrink-0">
                        <BedDouble className="w-3 h-3" />
                        ON LEAVE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        {doc.available !== false ? '● Available' : '○ Unavailable'}
                      </span>
                    )}
                  </div>

                  {/* Department & Room */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 font-semibold">{doc.department}</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 font-semibold">{doc.consultation_room}</span>
                    <span className="text-slate-500">{doc.experience || '10 years'}</span>
                  </div>

                  {/* Leave reason banner */}
                  {doc.on_leave && doc.leave_reason && (
                    <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-xl p-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-red-700 font-medium">{doc.leave_reason}</p>
                    </div>
                  )}

                  {/* Leave Toggle Button */}
                  <button
                    onClick={() => handleToggleDoctorLeave(doc.doctor_id, doc.on_leave)}
                    disabled={doctorLeaveLoading === doc.doctor_id}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      doc.on_leave
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                    }`}
                    title={doc.on_leave ? 'Restore doctor to Available' : 'Mark doctor as On Leave Today'}
                  >
                    <BedDouble className="w-3.5 h-3.5" />
                    <span>
                      {doctorLeaveLoading === doc.doctor_id
                        ? 'Updating...'
                        : doc.on_leave
                          ? 'Restore to Available'
                          : 'Mark On Leave Today'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DEPARTMENTS */}
        {activeTab === 'departments' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">{t('hospital_departments_title', 'Hospital Departments')}</h2>
                <p className="text-xs text-slate-500">{t('clinical_wings_desc', 'Clinical wings and consulting room assignments')}</p>
              </div>
              <button
                onClick={() => setIsDeptModalOpen(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('add_department', 'Add Department')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {departments.map((dept) => (
                <div key={dept.department_id || dept.name} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-bold text-slate-900">{dept.name}</h3>
                    <span className="text-[10px] font-semibold bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                      {dept.room || 'OPD Block'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{dept.description}</p>
                  <div className="text-[11px] text-slate-600 font-medium">
                    {t('dept_lead_label', 'Department Lead:')} <span className="font-bold text-slate-800">{dept.head_doctor || 'Senior Specialist'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: USERS & PATIENTS */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">{t('registered_system_accounts', 'Registered System Accounts')}</h2>
              <p className="text-xs text-slate-500">{t('users_stored_mongodb', 'Patients, Doctors, and Administrators stored in MongoDB')}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">{t('user_id_col', 'User ID')}</th>
                    <th className="pb-3">{t('name', 'Name')}</th>
                    <th className="pb-3">{t('phone', 'Phone')}</th>
                    <th className="pb-3">{t('role_col', 'Role')}</th>
                    <th className="pb-3">{t('status_col', 'Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {users.map((u) => (
                    <tr key={u.user_id || u.phone} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-mono font-bold text-slate-800">{u.user_id || 'U_USR'}</td>
                      <td className="py-3 font-bold text-slate-900">{u.name}</td>
                      <td className="py-3">{u.phone}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'doctor' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          {u.status || 'VERIFIED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs max-w-2xl space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">{t('hospital_opd_params', 'Hospital OPD & Queue Parameters')}</h2>
              <p className="text-xs text-slate-500">{t('configure_rules_buffers', 'Configure global consultation rules and transit buffers')}</p>
            </div>

            {settingsSaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold">
                {t('settings_updated_success', '✓ Hospital operational settings updated successfully.')}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSettingsSaved(true);
                setTimeout(() => setSettingsSaved(false), 3000);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('default_travel_buffer_mins', 'Default Travel Safety Buffer (Minutes)')}
                </label>
                <input
                  type="number"
                  value={settings.defaultBuffer}
                  onChange={(e) => setSettings({ ...settings, defaultBuffer: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('max_advance_booking_days', 'Max Advance Booking Window (Days)')}
                </label>
                <input
                  type="number"
                  value={settings.maxAdvanceDays}
                  onChange={(e) => setSettings({ ...settings, maxAdvanceDays: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('hospital_destination_address', 'Hospital Campus Destination Address')}
                </label>
                <input
                  type="text"
                  value={settings.hospitalLocation}
                  onChange={(e) => setSettings({ ...settings, hospitalLocation: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>

              <button
                type="submit"
                className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {t('save_settings_btn', 'Save Settings')}
              </button>
            </form>
          </div>
        )}

      </div>

      {/* Add Doctor Modal */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{t('register_new_doctor_title', 'Register New Doctor')}</h3>
            <form onSubmit={handleCreateDoctor} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('doc_name_label', 'Doctor Name')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('doc_name_placeholder', 'e.g. Dr. Ramesh Rao')}
                  value={docForm.name}
                  onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('department', 'Department')}</label>
                  <select
                    value={docForm.department}
                    onChange={(e) => setDocForm({ ...docForm, department: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    {departments.map((d) => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('room', 'Room')}</label>
                  <input
                    type="text"
                    value={docForm.consultation_room}
                    onChange={(e) => setDocForm({ ...docForm, consultation_room: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('specialization_label', 'Specialization')}</label>
                <input
                  type="text"
                  placeholder={t('specialization_placeholder', 'e.g. Cardiac Specialist')}
                  value={docForm.specialization}
                  onChange={(e) => setDocForm({ ...docForm, specialization: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-sky-600 text-white rounded-xl font-bold cursor-pointer"
                >
                  {t('save_doctor_btn', 'Save Doctor')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  {t('cancel', 'Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Department Modal */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{t('add_department_title', 'Add Department')}</h3>
            <form onSubmit={handleCreateDept} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('dept_name_label', 'Department Name')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('dept_name_placeholder', 'e.g. Urology')}
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('description_label', 'Description')}</label>
                <textarea
                  rows={3}
                  placeholder={t('dept_desc_placeholder', 'Clinical focus and services...')}
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('room_wing_label', 'Room / Wing')}</label>
                  <input
                    type="text"
                    value={deptForm.room}
                    onChange={(e) => setDeptForm({ ...deptForm, room: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('lead_doctor_label', 'Lead Doctor')}</label>
                  <input
                    type="text"
                    placeholder="Doctor Name"
                    value={deptForm.head_doctor}
                    onChange={(e) => setDeptForm({ ...deptForm, head_doctor: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-bold cursor-pointer"
                >
                  {t('save_dept_btn', 'Save Department')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  {t('cancel', 'Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Consultation Record Sheet Modal */}
      {modalConsultation && (
        <ConsultationRecordModal
          record={modalConsultation}
          onClose={() => setModalConsultation(null)}
        />
      )}

    </div>
  );
}
