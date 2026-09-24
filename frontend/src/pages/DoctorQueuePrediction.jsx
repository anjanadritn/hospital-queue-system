import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  Clock,
  Calendar,
  ArrowRight,
  Activity,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Layers,
  Shield,
  ArrowLeft,
  Users,
  Stethoscope,
  Info,
  Timer,
  LayoutGrid,
  Table as TableIcon
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function DoctorQueuePrediction() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const rawUserDoc = user?.doctor_id || user?.user_id;
  const initialDoctorId = typeof rawUserDoc === 'string' && rawUserDoc.startsWith('U_DOC_')
    ? rawUserDoc.replace('U_DOC_', '')
    : (user?.doctor_id || 'D001');
  const [selectedDoctorId, setSelectedDoctorId] = useState(initialDoctorId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Active doctor details
  const activeDoctor = doctors.find((d) => d.doctor_id === selectedDoctorId);
  const doctorName = selectedDoctorId === 'all'
    ? 'All Assigned Physicians'
    : (activeDoctor?.name || user?.name || 'Dr. Ananya Sharma');
  const department = selectedDoctorId === 'all'
    ? 'All OPD Departments'
    : (activeDoctor?.department || user?.department || 'Cardiology');
  const roomNumber = selectedDoctorId === 'all'
    ? 'All Consultation Rooms'
    : (activeDoctor?.consultation_room || user?.room_number || user?.consultation_room || 'Room 204');

  // Keep current time updated every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Fetch doctors list for doctor filter selector
  useEffect(() => {
    hospitalApi.getDoctors()
      .then((docs) => {
        const list = Array.isArray(docs) ? docs : (docs?.doctors || []);
        setDoctors(list);
      })
      .catch((err) => console.warn('Could not load doctors list:', err));
  }, []);

  // Load actual current queue data and use existing Random Forest prediction service
  const loadQueueData = async () => {
    try {
      const queueData = await hospitalApi.getAllQueues();
      const qList = Array.isArray(queueData) ? queueData : (queueData?.queues || []);

      // If any active queue tokens lack a predicted duration, retrieve it from the live RF service
      const missingPreds = qList.filter(
        (q) => !q.predicted_duration && !q.predicted_consultation_duration && ['in_consultation', 'called', 'ready', 'waiting', 'arrived'].includes(q.status)
      );

      if (missingPreds.length > 0) {
        await Promise.all(
          missingPreds.map(async (item) => {
            try {
              const res = await hospitalApi.predictWaitTime({
                symptoms: Array.isArray(item.symptoms) && item.symptoms.length > 0 ? item.symptoms : ['general checkup'],
                department: item.department || 'General Medicine',
                priority: item.priority === 'emergency' ? 'emergency' : 'normal',
                queue_position: Number(item.position) || 1
              });
              if (res && res.predicted_consultation_duration_min) {
                item.predicted_duration = res.predicted_consultation_duration_min;
              }
            } catch (pErr) {
              // Graceful fallback
            }
          })
        );
      }

      setQueues([...qList]);
      setError(null);
    } catch (err) {
      console.error('Failed to load queue predictions:', err);
      setError('Could not load live queue data. Please verify network connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueueData();
    const interval = setInterval(loadQueueData, 5000);
    return () => clearInterval(interval);
  }, [selectedDoctorId]);

  // Format Date object into "2:47 PM" style
  const formatTime = (dateObj) => {
    return dateObj.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Filter and process active tokens with progressive timeline calculation
  // STRICT PRIVACY: Extracts ONLY Token number, Queue position, Status, Predicted duration, Estimated wait time, Expected consultation time.
  // Absolutely NO names, phone numbers, symptoms, age, gender, or personal details are passed or rendered.
  const processedTokens = useMemo(() => {
    const filtered = queues.filter((q) => {
      if (!q) return false;
      if (selectedDoctorId === 'all') return true;
      return q.doctor_id === selectedDoctorId;
    });

    const activeStatuses = ['in_consultation', 'called', 'ready', 'waiting', 'arrived', 'missed'];
    const active = filtered.filter((q) => activeStatuses.includes(q.status));

    // Sort active tokens: in_consultation first, then emergency priority, then position
    active.sort((a, b) => {
      if (a.status === 'in_consultation') return -1;
      if (b.status === 'in_consultation') return 1;
      const isEmA = a.priority === 'emergency' ? 0 : 1;
      const isEmB = b.priority === 'emergency' ? 0 : 1;
      if (isEmA !== isEmB) return isEmA - isEmB;
      return (a.position || 999) - (b.position || 999);
    });

    // Progressive timeline calculation using actual predicted consultation durations
    let cumulativeWaitMinutes = 0;
    const now = currentTime;

    return active.map((entry, index) => {
      const isCurrentInChamber = entry.status === 'in_consultation';
      const duration = Number(
        entry.predicted_duration || entry.predicted_consultation_duration || 15
      );

      let waitTimeMinutes = 0;
      let expectedStartDate = new Date(now.getTime());

      if (isCurrentInChamber) {
        // Patient is actively in consultation right now
        waitTimeMinutes = 0;
        expectedStartDate = new Date(now.getTime());
        // Remaining time for current patient in chamber
        const remainingMinutes = Math.max(3, Math.round(duration * 0.5));
        cumulativeWaitMinutes = remainingMinutes;
      } else {
        // Patient waiting in line: start time is now + cumulative minutes of all preceding patients
        waitTimeMinutes = cumulativeWaitMinutes;
        expectedStartDate = new Date(now.getTime() + cumulativeWaitMinutes * 60000);
        // Add this patient's predicted duration to the running total for subsequent patients
        cumulativeWaitMinutes += duration;
      }

      return {
        tokenNumber: entry.queue_id || `Q${String(index + 1).padStart(3, '0')}`,
        queuePosition: index + 1,
        status: entry.status || 'waiting',
        priority: entry.priority || 'normal',
        predictedDuration: duration,
        estimatedWaitTimeMinutes: waitTimeMinutes,
        expectedStartTimeFormatted: formatTime(expectedStartDate),
        isCurrent: isCurrentInChamber
      };
    });
  }, [queues, selectedDoctorId, department, currentTime]);

  if (loading && queues.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <LoadingState message="Loading Random Forest Queue Predictions..." />
      </div>
    );
  }

  if (error && queues.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <ErrorState message={error} onRetry={loadQueueData} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 py-6 sm:py-10 overflow-x-hidden w-full max-w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-6 sm:space-y-8 w-full">
        
        {/* TOP BAR / NAVIGATION BREADCRUMB */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/doctor"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition shadow-xs"
              title="Return to Main OPD Console"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('back_to_opd_console', 'Back to OPD Console')}</span>
            </Link>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
              Doctor Module • Intelligent Queue Timing
            </span>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
              <Cpu className="w-3.5 h-3.5 text-purple-600" />
              <span>Random Forest Regression</span>
            </span>
            <button
              onClick={loadQueueData}
              disabled={loading}
              className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition shadow-xs cursor-pointer"
              title="Refresh Predictions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* PAGE HEADER BANNER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-purple-500/20 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider uppercase bg-purple-500/30 text-purple-200 border border-purple-400/40">
                  {t('ml_queue_prediction', 'ML Queue Prediction')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-slate-200">
                  {department} • {roomNumber}
                </span>
                <span className="text-[11px] text-slate-300 font-medium">
                  {doctorName}
                </span>

                {doctors.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md rounded-xl px-2.5 py-0.5 border border-white/20 text-xs mt-1 sm:mt-0">
                    <Stethoscope className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                    <select
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      aria-label="Filter by Doctor Station"
                      className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-1"
                    >
                      <option value="all" className="text-slate-900 font-semibold">
                        {t('all_opd_stations', 'All OPD Stations')}
                      </option>
                      {doctors.map((d) => (
                        <option key={d.doctor_id} value={d.doctor_id} className="text-slate-900 font-semibold">
                          {d.name} ({d.department} • {d.consultation_room})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {t('queue_consultation_predictions', 'Queue Consultation Predictions')}
              </h1>
              <p className="text-xs sm:text-sm text-purple-200/90 max-w-2xl leading-relaxed">
                {t('predictions_subtitle', 'Live consultation durations and expected start times computed progressively via Random Forest ML.')}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 w-full md:w-auto shrink-0">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
                <div className="text-2xl font-black text-white">{processedTokens.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-200">{t('active_in_queue', 'Active In Queue')}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
                <div className="text-2xl font-black text-purple-300">
                  {processedTokens.reduce((acc, curr) => acc + curr.predictedDuration, 0)}m
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-200">{t('total_est_workload', 'Total Est. Workload')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* PROGRESSIVE TIMELINE SECTION (FULLY RESPONSIVE - ZERO HORIZONTAL SCROLL) */}
        <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Timer className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Progressive Consultation Timeline
                </h2>
                <p className="text-xs text-slate-500">
                  Start times advance sequentially based on predicted consultation durations of tokens ahead
                </p>
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
              Current Time: <strong className="text-slate-900 font-extrabold">{formatTime(currentTime)}</strong>
            </div>
          </div>

          {processedTokens.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-medium space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-slate-700 font-bold text-sm">No Active Queue Waiting</p>
              <p>All consultations for this session have been completed.</p>
            </div>
          ) : (
            <div>
              {/* MOBILE PROGRESSIVE CHAIN (STACKED VERTICALLY - AVOIDS HORIZONTAL SCROLL) */}
              <div className="sm:hidden space-y-2.5">
                {processedTokens.map((item, idx) => {
                  const isLast = idx === processedTokens.length - 1;
                  return (
                    <div key={item.tokenNumber} className="flex flex-col items-center w-full">
                      <div
                        className={`w-full p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          item.isCurrent
                            ? 'bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-200'
                            : 'bg-slate-50/90 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs border ${
                            item.isCurrent ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'
                          }`}>
                            #{item.queuePosition}
                          </div>
                          <div>
                            <div className="font-mono text-base font-black text-slate-900">
                              {item.tokenNumber}
                            </div>
                            <div className="text-[10px] font-bold text-slate-500">
                              {item.isCurrent ? 'In Consultation' : `Est. wait: ${item.estimatedWaitTimeMinutes}m`}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 inline-block mb-0.5">
                            ~{item.predictedDuration}m RF
                          </div>
                          <div className="text-sm font-black text-purple-950">
                            {item.expectedStartTimeFormatted}
                          </div>
                        </div>
                      </div>

                      {!isLast && (
                        <div className="my-1 text-purple-400 flex items-center gap-1 text-[10px] font-bold">
                          <span>↓</span>
                          <span className="text-slate-400 font-medium">+~{item.predictedDuration}m duration</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* TABLET / DESKTOP PROGRESSIVE CHAIN (WRAPPING CLEANLY WITHOUT HORIZONTAL SCROLL) */}
              <div className="hidden sm:flex flex-wrap items-center gap-3 pt-1">
                {processedTokens.map((item, idx) => {
                  const isLast = idx === processedTokens.length - 1;
                  return (
                    <React.Fragment key={item.tokenNumber}>
                      <div
                        className={`p-3.5 rounded-2xl border transition flex flex-col gap-1 min-w-[150px] flex-1 max-w-[210px] ${
                          item.isCurrent
                            ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-200'
                            : 'bg-slate-50/90 border-slate-200 hover:border-purple-300 hover:bg-purple-50/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-slate-500">
                            {item.isCurrent ? '● IN DESK' : `POS #${item.queuePosition}`}
                          </span>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700">
                            ~{item.predictedDuration}m
                          </span>
                        </div>

                        <div className="flex items-baseline gap-1.5 my-0.5">
                          <span className="font-mono text-base sm:text-lg font-black text-slate-900">
                            {item.tokenNumber}
                          </span>
                          <span className="text-slate-400 text-xs font-bold">→</span>
                          <span className="text-xs sm:text-sm font-extrabold text-purple-800">
                            {item.expectedStartTimeFormatted}
                          </span>
                        </div>

                        <div className="text-[10px] font-semibold text-slate-500">
                          {item.isCurrent ? (
                            <span className="text-emerald-700 font-bold">Consultation Active</span>
                          ) : (
                            <span>Est. wait: {item.estimatedWaitTimeMinutes} mins</span>
                          )}
                        </div>
                      </div>

                      {!isLast && (
                        <div className="flex flex-col items-center justify-center px-0.5 text-slate-300">
                          <ArrowRight className="w-4 h-4 text-purple-400" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Progressive Sequence Formula Banner */}
              <div className="mt-4 p-3 bg-purple-50/60 rounded-2xl border border-purple-200/70 text-xs text-purple-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Progressive Sequence Formula: </span>
                  {processedTokens.slice(0, 4).map((t) => `${t.tokenNumber} (~${t.predictedDuration}m) → ${t.expectedStartTimeFormatted}`).join('  ➔  ')}
                  {processedTokens.length > 4 && '  ➔  ...'}
                  <span className="block text-[11px] text-purple-700 mt-0.5">
                    Each consultation start time is progressively computed by adding the Random Forest predicted duration of tokens ahead in line.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PREDICTED CONSULTATION BREAKDOWN (STRICTLY 6 FIELDS - ZERO PII - NO HORIZONTAL SCROLL) */}
        <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Predicted Consultation Breakdown
              </h2>
              <p className="text-xs text-slate-500">
                Shows exclusively: Token number, Queue position, Status, Predicted duration, Estimated wait time, and Expected start time.
              </p>
            </div>
            
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200">
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Table View"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>
          </div>

          {processedTokens.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              No queue tokens available.
            </div>
          ) : viewMode === 'cards' ? (
            /* 1. RESPONSIVE CARDS VIEW (1 COL ON MOBILE, ZERO HORIZONTAL SCROLL) */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {processedTokens.map((tokenItem) => {
                const isEmergency = tokenItem.priority === 'emergency';
                return (
                  <div
                    key={tokenItem.tokenNumber}
                    className={`rounded-2xl p-5 border transition-all relative overflow-hidden flex flex-col justify-between gap-4 ${
                      tokenItem.isCurrent
                        ? 'bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border-emerald-300 shadow-sm ring-2 ring-emerald-200'
                        : isEmergency
                          ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                          : 'bg-slate-50/60 border-slate-200/90 hover:border-purple-300 hover:bg-white shadow-xs'
                    }`}
                  >
                    {/* 1 & 2: Token Number & Queue Position & 3: Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs border ${
                          tokenItem.isCurrent
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-800 border-slate-200'
                        }`}>
                          #{tokenItem.queuePosition}
                        </span>
                        <div>
                          <div className="font-mono font-black text-base text-slate-900 flex items-center gap-1.5">
                            {tokenItem.isCurrent && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                            <span>{tokenItem.tokenNumber}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400">
                            Queue Position #{tokenItem.queuePosition}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={tokenItem.status} type="status" />
                        {isEmergency && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-md">
                            EMERGENCY
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 4: Predicted Consultation Duration & 5: Estimated Waiting Time */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                      <div className="bg-white/80 rounded-xl p-2.5 border border-slate-100">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-purple-700">
                          <Cpu className="w-3 h-3 text-purple-600" />
                          <span>ML Duration</span>
                        </div>
                        <div className="text-base font-black text-slate-900 mt-0.5">
                          ~{tokenItem.predictedDuration} <span className="text-xs font-semibold text-slate-500">mins</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Random Forest
                        </div>
                      </div>

                      <div className="bg-white/80 rounded-xl p-2.5 border border-slate-100">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-sky-700">
                          <Clock className="w-3 h-3 text-sky-600" />
                          <span>Estimated Wait</span>
                        </div>
                        <div className="text-base font-black text-slate-900 mt-0.5">
                          {tokenItem.isCurrent ? (
                            <span className="text-emerald-600 font-extrabold">0 mins</span>
                          ) : (
                            <span>{tokenItem.estimatedWaitTimeMinutes} <span className="text-xs font-semibold text-slate-500">mins</span></span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {tokenItem.isCurrent ? 'Currently in desk' : 'Queue cumulative'}
                        </div>
                      </div>
                    </div>

                    {/* 6: Expected Consultation / Start Time */}
                    <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-purple-400" />
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Expected Consultation
                          </div>
                          <div className="text-sm font-black text-white">
                            {tokenItem.expectedStartTimeFormatted}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-white/10 text-purple-300">
                        {tokenItem.isCurrent ? 'Now Active' : `In ~${tokenItem.estimatedWaitTimeMinutes}m`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 2. RESPONSIVE TABLE VIEW (STRICTLY 6 COLUMNS - COMPACT) */
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200">
                    <th className="p-3">Position</th>
                    <th className="p-3">Token Number</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Predicted Duration</th>
                    <th className="p-3">Estimated Wait</th>
                    <th className="p-3">Expected Start Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedTokens.map((tokenItem) => (
                    <tr
                      key={tokenItem.tokenNumber}
                      className={`hover:bg-slate-50/80 transition ${
                        tokenItem.isCurrent ? 'bg-emerald-50/50 font-bold' : ''
                      }`}
                    >
                      <td className="p-3 font-extrabold text-slate-800">
                        #{tokenItem.queuePosition}
                      </td>
                      <td className="p-3 font-mono font-black text-slate-900">
                        {tokenItem.tokenNumber}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={tokenItem.status} type="status" />
                      </td>
                      <td className="p-3 font-bold text-purple-700">
                        ~{tokenItem.predictedDuration} mins
                      </td>
                      <td className="p-3 font-bold text-slate-700">
                        {tokenItem.isCurrent ? '0 mins (Active)' : `~${tokenItem.estimatedWaitTimeMinutes} mins`}
                      </td>
                      <td className="p-3 font-black text-indigo-900">
                        {tokenItem.expectedStartTimeFormatted}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* "HOW ML PREDICTION WORKS" SECTION (SHOWING THE 7 MODEL INPUTS) */}
        <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                How ML Prediction Works
              </h2>
              <p className="text-xs text-slate-500">
                Trained Random Forest Regressor calibrated on clinical OPD consultation parameters
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-4xl">
            The Smart Hospital Queue System uses an intelligent <strong>Random Forest regression model</strong> to predict
            the consultation duration for each individual patient. Wait times and expected consultation start times are
            then progressively computed by accumulating the predicted durations of patients ahead in line plus any active
            in-consultation remaining time.
          </p>

          {/* 7 MODEL INPUTS DISPLAY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pt-2">
            {[
              {
                title: 'Queue length ahead',
                desc: 'Number of active patients waiting in line ahead of this token.',
                icon: Layers,
                color: 'text-sky-600 bg-sky-50 border-sky-200'
              },
              {
                title: 'Doctor average consultation time',
                desc: 'Baseline historical average consultation time for the assigned physician (10–20 mins).',
                icon: Clock,
                color: 'text-teal-600 bg-teal-50 border-teal-200'
              },
              {
                title: 'Hour',
                desc: 'Hour of the day capturing morning rush hour OPD spikes vs afternoon consultation velocity.',
                icon: Calendar,
                color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
              },
              {
                title: 'Day of week',
                desc: 'Accounts for weekly hospital footfall cycles (e.g. higher Monday OPD footfall).',
                icon: Activity,
                color: 'text-purple-600 bg-purple-50 border-purple-200'
              },
              {
                title: 'Patient type',
                desc: 'Distinguishes emergency triage cases from routine OPD checkups.',
                icon: Shield,
                color: 'text-rose-600 bg-rose-50 border-rose-200'
              },
              {
                title: 'Doctor',
                desc: 'Incorporates physician-specific specialty focus and consultation pacing.',
                icon: Stethoscope,
                color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
              },
              {
                title: 'Department',
                desc: 'Reflects procedural variation across Cardiology, Dermatology, Orthopedics, etc.',
                icon: Users,
                color: 'text-amber-600 bg-amber-50 border-amber-200'
              }
            ].map((feature) => {
              const IconComp = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-slate-300 transition space-y-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${feature.color}`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">{feature.title}</h3>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    {feature.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
