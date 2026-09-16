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
  X
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
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [queues, setQueues] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      const [analyticsData, docsData, deptsData, usersData, queueData, aptsData, patientsData] = await Promise.all([
        hospitalApi.getAnalytics().catch(() => null),
        hospitalApi.getDoctors().catch(() => []),
        hospitalApi.getDepartments().catch(() => []),
        hospitalApi.getAdminUsers().catch(() => []),
        hospitalApi.getAllQueues().catch(() => []),
        hospitalApi.getAdminAppointments().catch(() => []),
        hospitalApi.adminSearchPatients(patientSearchQuery).catch(() => [])
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

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAdminData();
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
            <span>{t('arrival_otp', 'Arrival Desk')} (Verify OTP)</span>
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
            <span>{t('all_active_queue', 'Live Queues')} ({waitingQueues.length})</span>
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
            <span>{t('book_consultation', 'Appointments')} ({appointments.length})</span>
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
            User Accounts ({users.length})
          </button>
          
          <button
            onClick={() => handleTabChange('settings')}
            className={`px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 ${
              activeTab === 'settings'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            OPD Settings
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
                <p className="text-xs text-slate-500 font-medium">Across {departments.length} clinical wings</p>
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
                <p className="text-xs text-teal-800 font-medium">Active queue tokens today</p>
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
                <p className="text-xs text-rose-700 font-medium">Priority clinical cases</p>
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
                <p className="text-xs text-emerald-800 font-medium">Consultations finished</p>
              </div>
            </div>

            {/* Quick Actions Strip */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap gap-4 items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hospital Administration Quick Actions</h3>
                <p className="text-xs text-slate-500">Deploy clinical updates or register doctors to MongoDB</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDocModalOpen(true)}
                  className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Doctor</span>
                </button>
                <button
                  onClick={() => setIsDeptModalOpen(true)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Department</span>
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
                      SIMSRH Reception Check-In Desk
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                      Verify Patient Arrival OTP
                    </h2>
                  </div>
                </div>
                <div className="text-xs text-slate-300 font-semibold bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10">
                  <span>Front Desk Clearance Level</span>
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
                    Queue Token or Booking ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Q001 or B001"
                    value={verifyTokenId}
                    onChange={(e) => setVerifyTokenId(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-sm font-mono text-white placeholder:text-slate-500 focus:bg-white/20 focus:border-emerald-400 focus:outline-none transition uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Patient's 6-Digit Arrival OTP *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 482910"
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
                    <span>Verifying OTP with Server...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify Arrival & Clear Patient</span>
                    </>
                  )}
                </button>
              </form>

              <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
                ℹ️ When a patient arrives at Shridevi Hospital reception, enter their Queue Token (or Booking ID) and the 6-digit code shown on their smartphone. Once verified, their status will update to <strong className="text-emerald-300">Arrived & Verified</strong>, allowing the doctor to call and start consultation.
              </p>
            </div>

            {/* Table of Patients Awaiting Arrival Verification */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Patients In Queue — Awaiting Reception Arrival Check-In ({unverifiedArrivals.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Patients en route or recently arrived at SIMSRH Tumakuru campus
                  </p>
                </div>
              </div>

              {unverifiedArrivals.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">All currently queued patients are checked-in and verified!</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">New booked patients will appear here for reception check-in.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                        <th className="pb-3 px-3">Token</th>
                        <th className="pb-3 px-3">Patient Name</th>
                        <th className="pb-3 px-3">Clinical Details</th>
                        <th className="pb-3 px-3">Origin / City</th>
                        <th className="pb-3 px-3">Doctor / Room</th>
                        <th className="pb-3 px-3">Priority</th>
                        <th className="pb-3 px-3 text-right">Quick Action</th>
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
                              {q.patient_phone ? `+91 ${q.patient_phone}` : 'Patient'}
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
                              {q.priority === 'emergency' ? 'EMERGENCY' : 'Normal'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleQuickFillVerify(q)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Check-In</span>
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
                      Unified MongoDB Patient Records
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900">Patient Records & Consultation History</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Search registered patients by Patient ID, Name, or Phone. Open persistent profiles and complete clinical visit timelines.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3.5 py-1.5 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-teal-600" />
                    <span>{patientsList.length} Registered Patients</span>
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
                  <span>Search</span>
                </button>
              </div>

              {/* Patients List Table */}
              {patientSearchLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                  <p>Searching patient records database...</p>
                </div>
              ) : patientsList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-600">{t('no_records_found')}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Try searching by another phone number, name, or patient ID.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                        <th className="pb-3 px-3">Patient ID</th>
                        <th className="pb-3 px-3">Name & Demographics</th>
                        <th className="pb-3 px-3">Phone</th>
                        <th className="pb-3 px-3">Village / City</th>
                        <th className="pb-3 px-3">Total Visits</th>
                        <th className="pb-3 px-3">Last Visit</th>
                        <th className="pb-3 px-3 text-right">Actions</th>
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
                              <span>{pt.total_visits || 0} visits</span>
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
                              <span>Open Records</span>
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
                          Admin Patient Records View
                        </span>
                        <h3 className="text-xl font-bold mt-0.5">
                          {selectedPatientRecord.patient?.name || 'Patient Details'}
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
                          <User className="w-3.5 h-3.5 text-teal-600" /> Patient Persistent Profile
                        </span>
                        <span className="text-xs font-bold text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-full">
                          {selectedPatientRecord.consultations?.length || 0} Total Consultations
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Age:</span>
                          <span className="font-bold text-slate-800">{selectedPatientRecord.patient?.age || '—'} yrs</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Gender:</span>
                          <span className="font-bold text-slate-800">{selectedPatientRecord.patient?.gender || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Height:</span>
                          <span className="font-bold text-slate-800">
                            {selectedPatientRecord.patient?.height_cm ? `${selectedPatientRecord.patient?.height_cm} cm` : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Weight:</span>
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
                        <span>Complete Consultation History (Chronological)</span>
                      </h4>

                      {!selectedPatientRecord.consultations || selectedPatientRecord.consultations.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p>No completed consultation history on file for this patient.</p>
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
                                    <span>View Full Record</span>
                                  </button>
                                </div>

                                {/* Vitals Summary Strip (Age, Gender, Height, Weight, BMI, Duration, Origin) */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl text-slate-600 border border-slate-100">
                                  <div>Age: <strong className="text-slate-900">{vitals.age ?? c.age ?? selectedPatientRecord.patient?.age ?? '—'} yrs</strong></div>
                                  <div>Gender: <strong className="text-slate-900">{vitals.gender ?? c.gender ?? selectedPatientRecord.patient?.gender ?? '—'}</strong></div>
                                  <div>Ht: <strong className="text-slate-900">{vitals.height_cm ?? c.height_cm ?? selectedPatientRecord.patient?.height_cm ? `${vitals.height_cm ?? c.height_cm ?? selectedPatientRecord.patient?.height_cm}cm` : '—'}</strong></div>
                                  <div>Wt: <strong className="text-slate-900">{vitals.weight_kg ?? c.weight_kg ?? selectedPatientRecord.patient?.weight_kg ? `${vitals.weight_kg ?? c.weight_kg ?? selectedPatientRecord.patient?.weight_kg}kg` : '—'}</strong></div>
                                  <div>BMI: <strong className="text-teal-700 font-bold">{vitals.bmi ? `${vitals.bmi}` : '—'}</strong></div>
                                  <div>Duration: <strong className="text-slate-900">{pReported.duration_days ?? c.duration_days ?? 1} d</strong></div>
                                  <div className="truncate" title={vitals.city || c.city || selectedPatientRecord.patient?.city || 'Tumakuru'}>
                                    Origin: <strong className="text-slate-900">📍 {vitals.city || c.city || selectedPatientRecord.patient?.city || 'Tumakuru'}</strong>
                                  </div>
                                </div>

                                {/* Clinical Breakdown */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                  {/* Patient complaints */}
                                  <div className="p-3 bg-sky-50/50 rounded-lg border border-sky-100 space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 block">
                                      Patient-Reported Complaints
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
                                        Duration: {pReported.duration_days} day(s)
                                      </p>
                                    )}
                                  </div>

                                  {/* Doctor assessment */}
                                  <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100 space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                                      Doctor-Recorded Assessment
                                    </span>
                                    <div>
                                      {diagnosis ? (
                                        <span className="px-2 py-0.5 bg-white text-emerald-900 rounded text-[11px] font-bold border border-emerald-200 inline-block">
                                          {diagnosis}
                                        </span>
                                      ) : (
                                        <span className="text-[11px] italic text-slate-400">
                                          No diagnosis recorded by physician
                                        </span>
                                      )}
                                    </div>
                                    {advice && (
                                      <p className="text-[11px] text-slate-700 line-clamp-2 pt-0.5">
                                        <strong>Advice:</strong> {advice}
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
                      Close Records
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
                <h2 className="text-base font-extrabold text-slate-900">Hospital Live OPD Queues</h2>
                <p className="text-xs text-slate-500">Real-time queue positions and waiting times across all OPD departments</p>
              </div>

              {/* Department Filter */}
              <div className="flex items-center gap-2 overflow-x-auto">
                {['All', 'Cardiology', 'General Medicine', 'Orthopedics', 'Pediatrics', 'Neurology'].map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setSelectedDeptFilter(dept)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                      selectedDeptFilter === dept
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            {/* Emergency Banner if any emergencies */}
            {emergencyQueues.length > 0 && (
              <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 text-rose-600 animate-pulse shrink-0" />
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-rose-800 block">
                      Emergency Triage Alert
                    </span>
                    <span className="text-xs text-rose-700 font-semibold">
                      {emergencyQueues.length} patient(s) have been flagged for high-priority emergency triage attention.
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 bg-rose-600 text-white text-xs font-black rounded-xl">
                  PRIORITY #1
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
                      <p>No queue items found for department: {selectedDeptFilter}</p>
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                        <th className="pb-3 px-3">Pos</th>
                        <th className="pb-3 px-3">Token</th>
                        <th className="pb-3 px-3">Patient Name</th>
                        <th className="pb-3 px-3">Clinical Consultation Details</th>
                        <th className="pb-3 px-3">Specialist & Room</th>
                        <th className="pb-3 px-3">Arrival Status</th>
                        <th className="pb-3 px-3">Est. Wait</th>
                        <th className="pb-3 px-3">Queue Status</th>
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
                                <span>Verified</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleQuickFillVerify(q)}
                                className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Pending Check-in</span>
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
                              {q.status}
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

        {/* TAB 4: APPOINTMENTS MONITOR */}
        {activeTab === 'appointments' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Advance Clinical Appointments Roster</h2>
                <p className="text-xs text-slate-500">All advance consultations registered across SIMSRH clinics</p>
              </div>
              <span className="text-xs font-bold text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
                {appointments.length} Total Bookings
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 px-3">Booking ID</th>
                    <th className="pb-3 px-3">Token #</th>
                    <th className="pb-3 px-3">Patient Name</th>
                    <th className="pb-3 px-3">Doctor & Dept</th>
                    <th className="pb-3 px-3">Date</th>
                    <th className="pb-3 px-3">Symptoms</th>
                    <th className="pb-3 px-3">Room</th>
                    <th className="pb-3 px-3">Priority</th>
                    <th className="pb-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {appointments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No appointments booked yet.
                      </td>
                    </tr>
                  ) : (
                    appointments.map((apt) => (
                      <tr key={apt.booking_id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 font-mono font-bold text-sky-700">{apt.booking_id}</td>
                        <td className="py-3 px-3 font-mono font-black text-slate-900">{apt.queue_id || '—'}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {apt.patient_name || apt.name || apt.patient_id}
                          <div className="text-[10px] text-slate-400 font-normal">
                            📍 {apt.city || 'Tumakuru'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[11px]">
                          <div className="font-bold text-slate-900">{apt.doctor_id}</div>
                          <div className="text-sky-700 font-semibold">{apt.department}</div>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">{apt.consultation_date}</td>
                        <td className="py-3 px-3 text-[11px] text-slate-600 max-w-[140px] truncate">
                          {Array.isArray(apt.symptoms) ? apt.symptoms.join(', ') : 'General OPD'}
                        </td>
                        <td className="py-3 px-3 text-emerald-700 font-bold">{apt.room_number || 'Room 204'}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            apt.priority === 'emergency' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {apt.priority || 'normal'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {apt.status || 'booked'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: DOCTORS DIRECTORY */}
        {activeTab === 'doctors' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Medical Specialists Roster</h2>
                <p className="text-xs text-slate-500">Active hospital physicians and consulting hours</p>
              </div>
              <button
                onClick={() => setIsDocModalOpen(true)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Doctor</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">Doctor ID</th>
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Department</th>
                    <th className="pb-3">Room</th>
                    <th className="pb-3">Experience</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {doctors.map((doc) => (
                    <tr key={doc.doctor_id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 font-bold font-mono text-sky-700">{doc.doctor_id}</td>
                      <td className="py-3.5 font-bold text-slate-900">{doc.name}</td>
                      <td className="py-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[11px] font-semibold border border-sky-100">
                          {doc.department}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-600">{doc.consultation_room}</td>
                      <td className="py-3.5 text-slate-600">{doc.experience || '10 years'}</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          doc.available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {doc.available ? 'Available' : 'Unavailable'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: DEPARTMENTS */}
        {activeTab === 'departments' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Hospital Departments</h2>
                <p className="text-xs text-slate-500">Clinical wings and consulting room assignments</p>
              </div>
              <button
                onClick={() => setIsDeptModalOpen(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Department</span>
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
                    Department Lead: <span className="font-bold text-slate-800">{dept.head_doctor || 'Senior Specialist'}</span>
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
              <h2 className="text-base font-bold text-slate-900">Registered System Accounts</h2>
              <p className="text-xs text-slate-500">Patients, Doctors, and Administrators stored in MongoDB</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">User ID</th>
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Phone</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Status</th>
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
              <h2 className="text-base font-bold text-slate-900">Hospital OPD & Queue Parameters</h2>
              <p className="text-xs text-slate-500">Configure global consultation rules and transit buffers</p>
            </div>

            {settingsSaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold">
                ✓ Hospital operational settings updated successfully.
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
                  Default Travel Safety Buffer (Minutes)
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
                  Max Advance Booking Window (Days)
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
                  Hospital Campus Destination Address
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
                Save Settings
              </button>
            </form>
          </div>
        )}

      </div>

      {/* Add Doctor Modal */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Register New Doctor</h3>
            <form onSubmit={handleCreateDoctor} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Doctor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Ramesh Rao"
                  value={docForm.name}
                  onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
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
                  <label className="block font-bold text-slate-700 mb-1">Room</label>
                  <input
                    type="text"
                    value={docForm.consultation_room}
                    onChange={(e) => setDocForm({ ...docForm, consultation_room: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Specialization</label>
                <input
                  type="text"
                  placeholder="e.g. Cardiac Specialist"
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
                  Save Doctor
                </button>
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
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
            <h3 className="text-lg font-bold text-slate-900 mb-4">Add Department</h3>
            <form onSubmit={handleCreateDept} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Urology"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Clinical focus and services..."
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Room / Wing</label>
                  <input
                    type="text"
                    value={deptForm.room}
                    onChange={(e) => setDeptForm({ ...deptForm, room: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lead Doctor</label>
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
                  Save Department
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
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
