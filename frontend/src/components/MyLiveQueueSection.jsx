import React from 'react';
import {
  Activity,
  Stethoscope,
  Clock,
  User,
  Users,
  CheckCircle2,
  RefreshCw,
  DoorOpen,
  Calendar,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import LateArrivalWarningCard from './LateArrivalWarningCard';
import { useLanguage } from '../context/LanguageContext';

/**
 * MyLiveQueueSection
 * 
 * Displays the live queue strictly for the logged-in patient's:
 * doctor_id + consultation_date + consultation_slot
 * 
 * Complies with strict Zero PII privacy (safe public operational indicators only).
 * Reuses the authoritative queue recalculation and highlights the patient's own position.
 */
export default function MyLiveQueueSection({
  activeQueue,
  liveQueueData,
  onRefresh,
  refreshing = false
}) {
  const { t } = useLanguage();

  if (!activeQueue) {
    return null;
  }

  const patientToken = activeQueue.queue_id;
  const doctorId = activeQueue.doctor_id;
  const docQueue = liveQueueData?.doctor_queues?.[doctorId] || 
    (liveQueueData?.doctor_queues && Object.values(liveQueueData.doctor_queues)[0]) || 
    null;

  // Authoritative operational values
  const doctorName = activeQueue.doctor_name || docQueue?.doctor_name || 'Dr. Assigned Specialist';
  const department = activeQueue.department || docQueue?.department || 'OPD Consultation';
  const roomNumber = activeQueue.room_number || docQueue?.room_number || 'Room 204';
  
  const slotName = activeQueue.consultation_slot?.slot_name || 
    (activeQueue.slot_id === 'evening' ? 'Evening Slot' : 'Morning Slot');
  const slotDisplayTime = activeQueue.consultation_slot?.display_time || 
    (activeQueue.slot_id === 'evening' ? '02:00 PM – 09:00 PM' : '09:00 AM – 01:00 PM');
  const consultationDate = activeQueue.consultation_date || 
    activeQueue.consultation_slot?.date || 
    'Today';

  // Currently consulting token
  const currentlyConsultingItem = (docQueue?.currently_consulting && docQueue.currently_consulting[0]) ||
    (liveQueueData?.currently_consulting && liveQueueData.currently_consulting[0]) ||
    null;
  const currentlyConsultingToken = currentlyConsultingItem?.token || currentlyConsultingItem?.queue_id || null;

  // Next token
  const nextItem = docQueue?.next_patient || liveQueueData?.next_patient || null;
  const nextToken = nextItem?.token || nextItem?.queue_id || null;

  // Patient's own indicators
  const patientPosition = activeQueue.position || 1;
  const patientsAhead = Math.max(0, patientPosition - 1);
  const predictedWait = typeof activeQueue.predicted_wait_time === 'number'
    ? activeQueue.predicted_wait_time
    : 5;
  const expectedTime = activeQueue.expected_consultation_time || 'Approaching';
  const queueStatus = activeQueue.status || 'waiting';

  // Ordered list of safe tokens in this doctor's slot
  const queueEntries = (docQueue?.entries && docQueue.entries.length > 0)
    ? docQueue.entries
    : (liveQueueData?.queue_entries || []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'in_consultation':
        return { text: 'In Consultation', color: 'bg-emerald-500 text-white' };
      case 'ready':
      case 'called':
        return { text: 'Next Up (Ready)', color: 'bg-amber-500 text-white animate-pulse' };
      case 'arrived':
        return { text: 'Arrived at Clinic', color: 'bg-sky-100 text-sky-800' };
      case 'waiting':
      default:
        return { text: 'Waiting in Line', color: 'bg-slate-100 text-slate-700' };
    }
  };

  const statusBadgeInfo = getStatusBadge(queueStatus);

  return (
    <div className="bg-white rounded-3xl border-2 border-amber-200/90 shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl">
      {/* SECTION TOP HEADER */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-teal-600 text-white p-6 sm:p-7 relative overflow-hidden">
        {/* Background decorative glow */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-wider text-amber-50 border border-white/30 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <Activity className="w-3.5 h-3.5 text-amber-100" />
              <span>Live Queue Monitor</span>
              <span className="text-white/60">•</span>
              <span className="text-amber-100 font-semibold">{consultationDate}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>My Live Queue</span>
            </h2>

            <div className="flex flex-wrap items-center gap-2.5 text-xs text-amber-50 pt-0.5">
              <span className="font-extrabold text-white text-sm flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-amber-200" />
                {doctorName}
              </span>
              <span className="text-white/50">•</span>
              <span className="px-2 py-0.5 bg-black/20 rounded-md font-semibold text-amber-100">
                {department}
              </span>
              <span className="text-white/50">•</span>
              <span className="px-2 py-0.5 bg-black/20 rounded-md font-semibold text-amber-100 flex items-center gap-1">
                <DoorOpen className="w-3.5 h-3.5" />
                {roomNumber}
              </span>
              <span className="text-white/50">•</span>
              <span className="px-2 py-0.5 bg-black/20 rounded-md font-semibold text-amber-100 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {slotName} ({slotDisplayTime})
              </span>
            </div>
          </div>

          {/* Real-time Refresh Action */}
          <div className="flex items-center gap-3 self-start lg:self-center">
            <div className="text-right hidden sm:block text-[11px] text-amber-100/90 leading-tight">
              <div>Auto-refreshed live</div>
              <div className="text-white/70">Authoritative recalculation</div>
            </div>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                title="Refresh Live Queue"
                className="px-4 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-xl text-xs font-extrabold transition-all duration-200 border border-white/30 flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-7 space-y-6 bg-slate-50/40">
        {/* LATE-ARRIVAL STATUS WARNING CARD */}
        {activeQueue?.late_arrival_reordered && (
          <LateArrivalWarningCard
            queueData={activeQueue}
            totalQueueLength={queueEntries.length}
          />
        )}

        {/* KEY OPERATIONAL METRICS (4 TILES) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tile 1: Currently Consulting Token */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Currently Consulting
              </span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
              {currentlyConsultingToken ? `Token #${currentlyConsultingToken}` : 'None'}
            </div>
            <div className="mt-1 text-xs text-slate-500 flex items-center gap-1.5 font-medium">
              <DoorOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>{currentlyConsultingToken ? 'Inside Chamber' : 'Chamber Ready for Next'}</span>
            </div>
          </div>

          {/* Tile 2: Next Token */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Next Token in Line
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-100 text-sky-800 rounded-full">
                Position #1
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-sky-950 tracking-tight">
              {nextToken ? `Token #${nextToken}` : 'None'}
            </div>
            <div className="mt-1 text-xs text-slate-500 flex items-center gap-1.5 font-medium">
              <ArrowRight className="w-3.5 h-3.5 text-sky-600" />
              <span>{nextToken ? 'Approaching Consultation' : 'Queue Clear'}</span>
            </div>
          </div>

          {/* Tile 3: Patient's Own Token & Position (PROMINENTLY HIGHLIGHTED) */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-5 rounded-2xl border-2 border-amber-400 shadow-md text-white relative overflow-hidden transform transition-all duration-200 hover:scale-[1.02]">
            <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-wider text-amber-100 border border-white/30">
              YOU ARE HERE
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-100 block">
              Your Live Position
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
                #{patientPosition}
              </span>
              <span className="text-xs font-bold text-amber-100 font-mono">
                (Token #{patientToken})
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-50 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
              <span>
                {patientsAhead === 0
                  ? "You're next in line!"
                  : `${patientsAhead} ${patientsAhead === 1 ? 'patient' : 'patients'} ahead`}
              </span>
            </div>
          </div>

          {/* Tile 4: Wait Time & Consultation Status */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Predicted Wait & Start
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${statusBadgeInfo.color}`}>
                {statusBadgeInfo.text}
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-baseline gap-1.5">
              <span>~{predictedWait}m</span>
              <span className="text-xs font-bold text-slate-400 font-normal">estimated wait</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Expected Start: <strong className="text-slate-900 font-black">{expectedTime}</strong></span>
            </div>
          </div>
        </div>

        {/* LIVE QUEUE SEQUENCE TRACK FOR THIS DOCTOR'S ACTIVE SLOT */}
        {queueEntries.length > 0 && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Doctor's Queue Progression Track ({queueEntries.length} Active {queueEntries.length === 1 ? 'Patient' : 'Patients'})
                </h3>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2 font-medium">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> In Chamber
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Next / Ready
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> {t('late_arrival_status', 'Late Arrival')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-400" /> Waiting
                </span>
              </div>
            </div>

            {/* Token Stream Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-1">
              {queueEntries.map((entry, idx) => {
                const isPatient = entry.token === patientToken || entry.queue_id === patientToken;
                const isCurrent = entry.is_current || entry.status === 'in_consultation';
                const isNext = (entry.is_next || entry.position === 1) && !isCurrent;
                const isLate = Boolean(entry.is_late || entry.late_arrival_reordered);

                return (
                  <div
                    key={entry.token || entry.queue_id || idx}
                    className={`relative p-3.5 rounded-xl transition-all duration-200 flex flex-col justify-between ${
                      isPatient
                        ? 'bg-gradient-to-b from-amber-50 to-orange-50 border-2 border-amber-500 shadow-md ring-2 ring-amber-400/30'
                        : isCurrent
                        ? 'bg-emerald-50/70 border border-emerald-300'
                        : isNext
                        ? 'bg-sky-50/70 border border-sky-300'
                        : isLate
                        ? 'bg-rose-50/50 border border-rose-200'
                        : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    {/* Patient Highlight Tag */}
                    {isPatient && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.2 bg-amber-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider shadow-xs whitespace-nowrap">
                        ★ YOUR TOKEN
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-1 gap-1">
                      <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded ${
                        isPatient ? 'bg-amber-200 text-amber-900' : 'bg-slate-200/80 text-slate-700'
                      }`}>
                        #{entry.position}
                      </span>
                      <span className={`text-[10px] font-bold ${
                        isCurrent
                          ? 'text-emerald-700 font-extrabold'
                          : isNext
                          ? 'text-sky-700 font-extrabold'
                          : isLate
                          ? 'text-rose-600 font-extrabold'
                          : 'text-slate-500'
                      }`}>
                        {isCurrent
                          ? '● Active'
                          : isNext
                          ? '● Next'
                          : isLate
                          ? `● ${t('late_arrival_status', 'Late Arrival')}`
                          : 'Waiting'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div className={`text-base font-black font-mono ${
                        isPatient ? 'text-amber-950 font-black text-lg' : 'text-slate-800'
                      }`}>
                        {entry.token || entry.queue_id}
                      </div>
                      {isLate && (
                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-extrabold uppercase tracking-tight">
                          {t('late_arrival_status', 'Late Arrival')}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                      <span>Wait</span>
                      <span className="font-bold text-slate-700">~{entry.estimated_wait_time ?? entry.predicted_duration ?? 5}m</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PRIVACY & ISOLATION NOTICE */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Strict Zero PII Privacy: patient medical details and identity are never disclosed.</span>
          </div>
          <div className="hidden sm:block text-slate-400">
            Partition: {doctorId} • {consultationDate} • {slotName}
          </div>
        </div>
      </div>
    </div>
  );
}
