import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Clock, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, Activity, Lock } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import DepartureCard from '../components/DepartureCard';
import HospitalModeCard from '../components/HospitalModeCard';
import ConsultationOtpCard from '../components/ConsultationOtpCard';
import Tooltip from '../components/Tooltip';

export default function QueueTracking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQueueId = searchParams.get('queue_id') || 'Q001';

  const [queueIdInput, setQueueIdInput] = useState(initialQueueId);
  const [activeQueueId, setActiveQueueId] = useState(initialQueueId);

  const [queueData, setQueueData] = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [escalating, setEscalating] = useState(false);

  const fetchQueueStatus = async (qId) => {
    if (!qId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await hospitalApi.getQueueStatus(qId);
      setQueueData(data);

      if (data.department && data.position) {
        try {
          const pred = await hospitalApi.predictWaitTime({
            department: data.department,
            current_queue_length: data.position,
            hour_of_day: new Date().getHours(),
            day_of_week: new Date().getDay()
          });
          setAiPrediction(pred.predicted_wait_time);
        } catch (predErr) {
          console.warn('ML Prediction call note:', predErr);
        }
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403) {
        setError("You don't have permission to view this queue information.");
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
    fetchQueueStatus(activeQueueId);
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
      setActiveQueueId(queueIdInput.trim());
      setSearchParams({ queue_id: queueIdInput.trim() });
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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">Track My Consultation Queue</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Private patient portal for live queue position, departure alerts & verification OTP
        </p>
      </div>

      {/* Lookup Bar */}
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

          <Tooltip text="See your queue position and estimated waiting time." position="top">
            <button
              type="submit"
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs shrink-0"
            >
              Track My Queue
            </button>
          </Tooltip>
        </form>
      </div>

      {/* Live Polling Bar */}
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
        </div>

        <Tooltip text="Refresh your latest queue status." position="top">
          <button
            onClick={() => fetchQueueStatus(activeQueueId)}
            className="inline-flex items-center gap-1.5 text-sky-600 hover:text-sky-700 font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Status
          </button>
        </Tooltip>
      </div>

      {loading && !queueData ? (
        <LoadingState message={`Calculating your estimated waiting time for '${activeQueueId}'...`} />
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center max-w-md mx-auto shadow-xs">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-rose-900 mb-1">Queue Privacy Notice</h3>
          <p className="text-xs text-rose-700 font-medium">{error}</p>
        </div>
      ) : queueData ? (
        <div className="space-y-6">
          
          {/* CONSULTATION OTP CARD (WHEN READY / POSITION 1 ARRIVED) */}
          {isReadyForOtp && (
            <ConsultationOtpCard bookingId={queueData.queue_id} queueData={queueData} />
          )}

          {/* MAIN QUEUE TICKET */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-md relative overflow-hidden">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block">Token ID</span>
                <span className="text-3xl font-extrabold font-mono text-slate-900">{queueData.queue_id}</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={queueData.priority} type="priority" />
                <StatusBadge status={queueData.status} type="status" />
              </div>
            </div>

            {/* METRICS */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5 text-center">
                <span className="text-xs font-bold text-sky-600 uppercase tracking-wider block mb-1">Current Position</span>
                <span className="text-4xl font-extrabold text-slate-900">#{queueData.position}</span>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-center">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">Estimated Waiting Time</span>
                <span className="text-4xl font-extrabold text-emerald-800">~{aiPrediction || queueData.predicted_wait_time || 15} mins</span>
              </div>
            </div>
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
                    Request emergency queue priority when appropriate.
                  </p>
                </div>
              </div>

              <Tooltip text="Request emergency queue priority when appropriate." position="left">
                <button
                  onClick={() => setShowEmergencyConfirm(true)}
                  className="w-full sm:w-auto px-6 py-3 bg-white text-rose-700 hover:bg-rose-50 font-bold rounded-2xl text-xs transition shadow-md shrink-0"
                >
                  Request Emergency Priority
                </button>
              </Tooltip>
            </div>
          )}

        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
          <p className="text-xs text-slate-500 mb-3">You don't currently have an active queue.</p>
        </div>
      )}

    </div>
  );
}
