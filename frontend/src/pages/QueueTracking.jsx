import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Clock, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, Activity, User, Phone, MapPin, Stethoscope, UserCheck } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import DepartureCard from '../components/DepartureCard';
import HospitalModeCard from '../components/HospitalModeCard';
import ConsultationOtpCard from '../components/ConsultationOtpCard';
import Tooltip from '../components/Tooltip';

export default function QueueTracking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQueueId = searchParams.get('queue_id') || null;

  const [queueIdInput, setQueueIdInput] = useState(initialQueueId || '');
  const [activeQueueId, setActiveQueueId] = useState(initialQueueId);

  const [queueData, setQueueData] = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

  // Auto-load patient's active queue token on mount if no queue_id in query params
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

  const fetchQueueStatus = async (qId) => {
    if (!qId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await hospitalApi.getQueueStatus(qId);
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
          setAiPrediction(pred.predicted_consultation_duration_min || pred.predicted_wait_time);
        } catch (predErr) {
          console.warn('ML Prediction not available:', predErr);
        }
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403) {
        setError("Unauthorized Access: You can only view and track your own active consultation queue.");
      } else if (err.response?.status === 401) {
        setError("Your session has expired. Please login again.");
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
      setShowEmergencyConfirm(false);
      await fetchQueueStatus(queueData.queue_id);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to request emergency queue priority.');
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">Track Consultation Queue</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Welcome, <span className="font-bold text-sky-700">{user?.name || queueData?.patient_name || 'Patient'}</span> — Track your live queue position & departure alerts
        </p>
      </div>

      {/* Search / Token Lookup Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs max-w-xl mx-auto">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Enter Token or Booking ID (e.g. Q001, B001)..."
              value={queueIdInput}
              onChange={(e) => setQueueIdInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition uppercase font-mono"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs shrink-0"
          >
            Track Token
          </button>
        </form>
      </div>

      {/* Polling & Refresh Bar */}
      <div className="flex items-center justify-between px-2 text-xs font-semibold text-slate-600">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-600" />
          <span>Live Polling:</span>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition ${
              autoRefresh ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {autoRefresh ? 'ACTIVE (5s)' : 'PAUSED'}
          </button>
          <span className="text-[10px] text-slate-400 hidden sm:inline">• Last updated: {lastUpdated}</span>
        </div>

        <button
          onClick={() => fetchQueueStatus(activeQueueId)}
          className="inline-flex items-center gap-1.5 text-sky-600 hover:text-sky-700 font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Status
        </button>
      </div>

      {loading && !queueData ? (
        <LoadingState message={`Fetching live queue token status...`} />
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center max-w-md mx-auto shadow-xs space-y-4">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-rose-900 mb-1">Queue Access Notice</h3>
            <p className="text-xs text-rose-700 font-medium">{error}</p>
          </div>
          <button
            onClick={loadMyActiveQueue}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition"
          >
            Load My Active Token
          </button>
        </div>
      ) : queueData ? (
        <div className="space-y-6">
          
          {/* CONSULTATION OTP CARD */}
          {isReadyForOtp && (
            <ConsultationOtpCard bookingId={queueData.queue_id} queueData={queueData} />
          )}

          {/* MAIN QUEUE CARD */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-md relative overflow-hidden space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block">Token ID</span>
                <span className="text-3xl font-extrabold font-mono text-slate-900">{queueData.queue_id}</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={queueData.priority} type="priority" />
                <StatusBadge status={queueData.status} type="status" />
              </div>
            </div>

            {/* PATIENT & DOCTOR INFORMATION GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-sky-600 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Patient Name</span>
                  <span className="font-extrabold text-slate-800">{queueData.patient_name || user?.name || 'Patient'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Stethoscope className="w-4 h-4 text-sky-600 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Assigned Doctor</span>
                  <span className="font-extrabold text-slate-800">{queueData.doctor_name || 'Dr. Ananya Sharma'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Department & Room</span>
                  <span className="font-extrabold text-slate-800">{queueData.department} • {queueData.room_number || 'Room 204'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-sky-600 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Contact Phone</span>
                  <span className="font-extrabold text-slate-800">{queueData.patient_phone || user?.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* METRICS DISPLAY */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5 text-center">
                <span className="text-xs font-bold text-sky-600 uppercase tracking-wider block mb-1">Current Position</span>
                <span className="text-4xl font-extrabold text-slate-900">#{queueData.position}</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Patients Ahead</span>
                <span className="text-4xl font-extrabold text-slate-800">{Math.max(0, queueData.position - 1)}</span>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-center">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">AI Estimated Wait</span>
                <span className="text-4xl font-extrabold text-emerald-800">~{aiPrediction || queueData.predicted_wait_time || 15} mins</span>
              </div>
            </div>

            {/* SYMPTOMS BADGES */}
            {queueData.symptoms && queueData.symptoms.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">Reported Symptoms:</span>
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
          <DepartureCard travelInfo={queueData.travel_info} />

          {/* EMERGENCY ESCALATION CTA */}
          {queueData.status === 'waiting' && queueData.priority !== 'emergency' && (
            <div className="bg-gradient-to-r from-rose-500 to-red-600 rounded-3xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base">Require Emergency Attention?</h4>
                  <p className="text-xs text-rose-100 mt-0.5">
                    Escalate token to Emergency Priority for immediate clinical evaluation.
                  </p>
                </div>
              </div>

              <button
                onClick={handleConfirmEmergency}
                disabled={escalating}
                className="w-full sm:w-auto px-6 py-3 bg-white text-rose-700 hover:bg-rose-50 font-bold rounded-2xl text-xs transition shadow-md shrink-0"
              >
                {escalating ? 'Escalating...' : 'Request Emergency Priority'}
              </button>
            </div>
          )}

        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-4 max-w-md mx-auto">
          <p className="text-xs text-slate-500">You don't currently have an active queue token.</p>
          <button
            onClick={() => navigate('/book')}
            className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition"
          >
            Book Consultation
          </button>
        </div>
      )}

    </div>
  );
}
