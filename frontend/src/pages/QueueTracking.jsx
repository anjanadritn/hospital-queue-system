import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Activity,
  User,
  Phone,
  MapPin,
  Stethoscope,
  UserCheck,
  Cpu,
  Ticket,
  ChevronRight,
  ArrowRight,
  PhoneCall
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import DepartureCard from '../components/DepartureCard';
import HospitalModeCard from '../components/HospitalModeCard';
import ConsultationOtpCard from '../components/ConsultationOtpCard';
import LateArrivalWarningCard from '../components/LateArrivalWarningCard';

export default function QueueTracking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQueueId = searchParams.get('queue_id') || null;

  const [queueIdInput, setQueueIdInput] = useState(initialQueueId || '');
  const [activeQueueId, setActiveQueueId] = useState(initialQueueId);

  const [queueData, setQueueData] = useState(null);
  const [predictedConsultationDuration, setPredictedConsultationDuration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [escalating, setEscalating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

  const loadMyActiveQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hospitalApi.getMyActiveQueue();
      if (data && data.queue_id) {
        setActiveQueueId(data.queue_id);
        setQueueIdInput(data.queue_id);
        setSearchParams({ queue_id: data.queue_id });
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialQueueId) {
      loadMyActiveQueue();
    }
  }, []);

  const playCallChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      // AudioContext policy
    }
  };

  const fetchQueueStatus = async (qId) => {
    if (!qId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await hospitalApi.getQueueStatus(qId);
      if (data.status === 'called' && queueData?.status !== 'called') {
        playCallChime();
      }
      setQueueData(data);
      setLastUpdated(new Date().toLocaleTimeString());

      if (data.department && data.position) {
        try {
          const pred = await hospitalApi.predictWaitTime({
            symptoms: data.symptoms || ['general'],
            department: data.department,
            priority: data.priority || 'normal',
            queue_position: data.position
          });
          setPredictedConsultationDuration(pred.predicted_consultation_duration_min || null);
        } catch (predErr) {
          console.warn('ML Prediction not available:', predErr);
        }
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403) {
        setError('Unauthorized Access: You can only view and track your own active consultation queue.');
      } else if (err.response?.status === 401) {
        setError('Your session has expired. Please login again.');
      } else {
        setError(`Consultation token '${qId}' was not found in active hospital queue records.`);
      }
      setQueueData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeQueueId) {
      fetchQueueStatus(activeQueueId);
    }
  }, [activeQueueId]);

  useEffect(() => {
    if (!autoRefresh || !activeQueueId) return;
    const interval = setInterval(() => {
      fetchQueueStatus(activeQueueId);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeQueueId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (queueIdInput.trim()) {
      setActiveQueueId(queueIdInput.trim().toUpperCase());
      setSearchParams({ queue_id: queueIdInput.trim().toUpperCase() });
    }
  };

  const handleConfirmEmergency = async () => {
    if (!queueData) return;
    setEscalating(true);
    try {
      await hospitalApi.escalateEmergency(queueData.queue_id);
      await fetchQueueStatus(queueData.queue_id);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to request emergency priority.');
    } finally {
      setEscalating(false);
    }
  };

  const handleToggleArrived = async () => {
    if (!queueData) return;
    try {
      await hospitalApi.arriveAtHospital(queueData.queue_id);
      await fetchQueueStatus(queueData.queue_id);
    } catch (err) {
      console.error(err);
    }
  };

  const isReadyForOtp = queueData && (
    queueData.status === 'ready' ||
    queueData.status === 'OTP_GENERATED' ||
    (queueData.position === 1 && (queueData.arrived_at_hospital || queueData.status === 'arrived'))
  );

  // Stepper Calculation
  // Step 1: Token Issued
  // Step 2: In Queue
  // Step 3: Approaching Room
  // Step 4: In Consultation
  // Step 5: Completed
  const getStepStatus = () => {
    if (!queueData) return 1;
    const status = (queueData.status || '').toLowerCase();
    if (status === 'completed') return 5;
    if (status === 'in_consultation' || status === 'called') return 4;
    if (queueData.position <= 2 || status === 'ready' || status === 'arrived') return 3;
    if (status === 'waiting') return 2;
    return 1;
  };
  const currentStep = getStepStatus();

  return (
    <div className="min-h-screen bg-slate-50/70 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Header */}
        <div className="text-center max-w-xl mx-auto">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-200 mb-3">
            <Activity className="w-3.5 h-3.5 text-sky-600" />
            <span>Live Consultation Tracker</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Real-Time Queue Status
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Welcome, <span className="font-bold text-slate-800">{user?.name || queueData?.patient_name || 'Patient'}</span> — Follow your live position, transit alerts, and doctor call status.
          </p>
        </div>

        {/* Token Search Bar */}
        <div className="bg-white rounded-3xl p-3 sm:p-4 border border-slate-200/80 shadow-xs max-w-xl mx-auto">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Enter Token ID (e.g. Q001, B001)..."
                value={queueIdInput}
                onChange={(e) => setQueueIdInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition uppercase font-mono shadow-2xs"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-2xl text-xs font-bold transition shadow-xs shrink-0 cursor-pointer"
            >
              Track
            </button>
          </form>
        </div>

        {/* Polling & Refresh Bar */}
        <div className="flex items-center justify-between px-2 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-600" />
            <span>Real-Time Sync:</span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {autoRefresh ? '● ACTIVE (5s)' : '○ PAUSED'}
            </button>
            <span className="text-[10px] text-slate-400 hidden sm:inline">• Last updated: {lastUpdated}</span>
          </div>

          <button
            onClick={() => fetchQueueStatus(activeQueueId)}
            className="inline-flex items-center gap-1.5 text-sky-600 hover:text-sky-700 font-bold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loading && !queueData ? (
          <LoadingState message="Fetching live queue status from MongoDB..." />
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center max-w-md mx-auto shadow-xs space-y-4">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-red-900 mb-1">Queue Access Notice</h3>
              <p className="text-xs text-red-700 font-medium">{error}</p>
            </div>
            <button
              onClick={loadMyActiveQueue}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Load Active Token
            </button>
          </div>
        ) : queueData ? (
          <div className="space-y-6">
            
            {/* Visual 5-Step Stepper */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-4">
                Consultation Journey Stepper
              </span>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                {[
                  { step: 1, label: 'Token Issued' },
                  { step: 2, label: 'In Queue' },
                  { step: 3, label: 'Approaching' },
                  { step: 4, label: 'Consulting' },
                  { step: 5, label: 'Completed' }
                ].map((s) => {
                  const isDone = currentStep > s.step;
                  const isCurrent = currentStep === s.step;
                  return (
                    <div key={s.step} className="flex flex-col items-center">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 mb-2 ${
                          isDone
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : isCurrent
                              ? 'bg-sky-600 text-white ring-4 ring-sky-100 animate-pulse'
                              : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : s.step}
                      </div>
                      <span className={`text-[10px] sm:text-[11px] font-bold leading-tight ${
                        isCurrent ? 'text-sky-700' : isDone ? 'text-emerald-700' : 'text-slate-400'
                      }`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CONSULTATION OTP CARD */}
            {isReadyForOtp && (
              <ConsultationOtpCard bookingId={queueData.queue_id} queueData={queueData} />
            )}

            {/* DOCTOR CALLING ALERT BANNER */}
            {queueData.status === 'called' && (
              <div className="p-4 bg-rose-500 text-white rounded-2xl flex items-center justify-between shadow-lg shadow-rose-200 animate-bounce">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                    <PhoneCall className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div>
                    <p className="font-extrabold text-base">Doctor Is Calling Your Token Now!</p>
                    <p className="text-xs text-rose-100">Please proceed immediately to {queueData.room_number || 'OPD Consultation Room'}.</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-white text-rose-600 font-black rounded-lg text-xs tracking-wider uppercase">
                  Called
                </span>
              </div>
            )}

            {/* LATE-ARRIVAL STATUS WARNING CARD */}
            {queueData.late_arrival_reordered && (
              <LateArrivalWarningCard queueData={queueData} />
            )}

            {/* MAIN QUEUE CARD */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-md relative overflow-hidden space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block">
                    Queue Token
                  </span>
                  <span className="text-3xl font-extrabold font-mono text-slate-900">
                    {queueData.queue_id}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={queueData.priority} type="priority" />
                  <StatusBadge status={queueData.status} type="status" />
                </div>
              </div>

              {/* PATIENT & DOCTOR INFO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-sky-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Patient</span>
                    <span className="font-extrabold text-slate-800">{queueData.patient_name || user?.name || 'Patient'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Stethoscope className="w-4 h-4 text-sky-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Doctor</span>
                    <span className="font-extrabold text-slate-800">{queueData.doctor_name || 'Specialist Doctor'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Room & Dept</span>
                    <span className="font-extrabold text-slate-800">{queueData.department} • {queueData.room_number || 'Room 101'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-sky-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Phone</span>
                    <span className="font-extrabold text-slate-800">{queueData.patient_phone || user?.phone || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* METRICS DISPLAY WITH COLOR SYSTEM */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Position (Blue) */}
                <div className="bg-sky-50/80 border border-sky-200/70 rounded-2xl p-5 text-center">
                  <span className="text-xs font-bold text-sky-700 uppercase tracking-wider block mb-1">
                    Your Position
                  </span>
                  <span className="text-4xl font-extrabold text-slate-900">#{queueData.position}</span>
                </div>

                {/* Patients Ahead (Orange/Yellow) */}
                <div className="bg-amber-50/80 border border-amber-200/70 rounded-2xl p-5 text-center">
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block mb-1">
                    Ahead in Line
                  </span>
                  <span className="text-4xl font-extrabold text-amber-900">
                    {Math.max(0, queueData.position - 1)}
                  </span>
                </div>

                {/* AI Estimated Wait (Purple) */}
                <div className="bg-purple-50/80 border border-purple-200/70 rounded-2xl p-5 text-center">
                  <span className="text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center justify-center gap-1 mb-1">
                    <Cpu className="w-3.5 h-3.5 text-purple-600" />
                    <span>Est. Queue Wait</span>
                  </span>
                  <span className="text-4xl font-extrabold text-purple-900">
                    ~{typeof queueData.predicted_wait_time === 'number'
                      ? queueData.predicted_wait_time
                      : (queueData.position === 1 ? 5 : (queueData.position - 1) * 12)}m
                  </span>
                  <span className="text-[10px] text-purple-600 font-medium block mt-1">
                    Random Forest: ~{predictedConsultationDuration || queueData.predicted_duration || queueData.predicted_consultation_duration || 12}m/visit
                  </span>
                </div>

              </div>

              {/* Symptoms chips */}
              {queueData.symptoms && queueData.symptoms.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                    Reported Symptoms:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {queueData.symptoms.map((sym, i) => (
                      <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">
                        {sym}
                      </span>
                    ))}
                    {queueData.custom_symptoms && (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-800 text-xs font-semibold rounded-lg border border-amber-200">
                        Note: {queueData.custom_symptoms}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* HOSPITAL MODE CARD */}
            <HospitalModeCard queueData={queueData} onToggleArrived={handleToggleArrived} />

            {/* DEPARTURE CARD */}
            <DepartureCard
              travelInfo={{
                ...(queueData.travel_info || {}),
                queue_id: queueData.queue_id,
                booking_id: queueData.booking_id,
                status: queueData.status,
                arrived_at_hospital: queueData.arrived_at_hospital,
                verified_by_admin: queueData.verified_by_admin,
                late_arrival_reordered: queueData.late_arrival_reordered,
                leaving_now: queueData.leaving_now,
                leaving_now_at: queueData.leaving_now_at,
                leave_reminder_status: queueData.leave_reminder_status,
                doctor_name: queueData.doctor_name,
                consultation_slot: queueData.consultation_slot,
                consultation_date: queueData.consultation_date,
                patient_address: queueData.city || queueData.patient_address || 'Tumakuru',
                origin_latitude: queueData.origin_latitude,
                origin_longitude: queueData.origin_longitude,
                is_approximate_location: queueData.is_approximate_location ?? true,
                location_source: queueData.travel_info?.location_source || (queueData.is_approximate_location === false ? 'gps' : 'landmark_approximate'),
                expected_hospital_arrival: queueData.expected_arrival_time || queueData.expected_hospital_arrival || queueData.travel_info?.expected_hospital_arrival,
                expected_hospital_arrival_iso: queueData.expected_arrival_iso || queueData.expected_hospital_arrival_iso || queueData.travel_info?.expected_hospital_arrival_iso,
                arrival_deadline_time: queueData.arrival_deadline_time || queueData.travel_info?.arrival_deadline_time,
                arrival_deadline_iso: queueData.arrival_deadline_iso || queueData.travel_info?.arrival_deadline_iso,
                expected_consultation_time: queueData.expected_consultation_time || queueData.travel_info?.expected_consultation_time,
                expected_consultation_iso: queueData.expected_consultation_iso || queueData.travel_info?.expected_consultation_iso,
                recommended_departure_time: queueData.recommended_departure_time || queueData.travel_info?.recommended_departure_time,
                recommended_departure_iso: queueData.recommended_departure_iso || queueData.travel_info?.recommended_departure_iso,
                departure_alert: queueData.departure_alert || queueData.travel_info?.departure_alert
              }}
              onRefreshQueue={() => fetchQueueStatus(queueData.queue_id)}
            />

            {/* EMERGENCY ESCALATION CTA (Red) */}
            {queueData.status === 'waiting' && queueData.priority !== 'emergency' && (
              <div className="bg-gradient-to-r from-red-600 to-rose-600 rounded-3xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base">Require Immediate Emergency Attention?</h4>
                    <p className="text-xs text-red-100 mt-0.5">
                      Escalate your token to Emergency Priority for prompt clinical triage.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleConfirmEmergency}
                  disabled={escalating}
                  className="w-full sm:w-auto px-6 py-3 bg-white text-red-700 hover:bg-red-50 font-bold rounded-2xl text-xs transition shadow-md shrink-0 cursor-pointer"
                >
                  {escalating ? 'Escalating...' : 'Request Emergency Priority'}
                </button>
              </div>
            )}

          </div>
        ) : (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-4 max-w-md mx-auto">
            <Ticket className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500">You don't currently have an active consultation token.</p>
            <button
              onClick={() => navigate('/book')}
              className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Book Consultation
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
