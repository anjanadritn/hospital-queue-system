import React from 'react';
import {
  CheckCircle2,
  Clock,
  UserCheck,
  DoorOpen,
  Stethoscope,
  Users,
  AlertTriangle,
  Info,
  Sparkles,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * ArrivalVerifiedCard
 * 
 * Rendered when the patient's arrival OTP has been verified by reception/admin.
 * Replaces pre-arrival travel metrics (GPS route, distance, Leave Now, departure time, travel duration)
 * with the authoritative post-arrival experience:
 * - Arrival Verified confirmation
 * - Token ID
 * - Current Queue Position
 * - Patients Ahead
 * - Estimated Waiting Time (Random Forest ML)
 * - Fresh Expected Consultation Time
 * - 30-Minute Target Status ("On track" vs "Queue exceeds 30-minute target")
 * - Explicit disclaimer that 30 min is an operational target, NOT a guarantee.
 */
export default function ArrivalVerifiedCard({ queueData, onRefresh, refreshing = false }) {
  const { t } = useLanguage();

  if (!queueData) return null;

  const token = queueData.queue_id || queueData.token || queueData.booking_id || 'N/A';
  const position = queueData.position || 1;
  const patientsAhead = Math.max(0, position - 1);
  const doctorName = queueData.doctor_name || queueData.doctor_id || 'Specialist Doctor';
  const roomNumber = queueData.room_number || 'Room 101';
  const department = queueData.department || 'General Medicine';

  // Predicted wait time (Random Forest)
  const predictedWait = typeof queueData.predicted_wait_time === 'number'
    ? queueData.predicted_wait_time
    : (position === 1 ? 5 : (position - 1) * 12);

  // Fresh expected consultation time (recalculated upon arrival)
  const expectedTime = queueData.expected_consultation_time ||
    queueData.travel_info?.expected_consultation_time ||
    'Approaching';

  // 30-Minute Target Evaluation:
  // Treat 30 minutes as an operational target, NOT a guaranteed consultation time.
  const isOnTrack = predictedWait <= 30;

  return (
    <div
      id="arrival-verified-container"
      className="bg-white rounded-3xl p-5 sm:p-7 border-2 border-emerald-300/80 shadow-lg relative overflow-hidden transition-all duration-300 hover:shadow-xl space-y-6"
    >
      {/* Decorative emerald glow */}
      <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP HEADER: ARRIVAL VERIFIED BANNER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 relative z-10">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 shadow-inner">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                {t('arrival_verified_badge', 'Arrival Verified')}
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {t('brand_short', 'SIMSRH Campus')}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
              {t('arrival_verified_title', 'Arrival Verified — You Are At SIMSRH')}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {t('arrival_verified_desc', 'Patient arrival confirmed at reception. You are physically present at SIMSRH.')}
            </p>
          </div>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="self-end sm:self-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? t('loading', 'Syncing...') : t('refresh', 'Refresh')}</span>
          </button>
        )}
      </div>

      {/* CORE 4-METRIC GRID (Responsive on Mobile) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        
        {/* Metric 1: Token */}
        <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 text-center flex flex-col justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
            {t('token', 'Token ID')}
          </span>
          <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
            {token}
          </span>
          <span className="text-[10px] text-slate-500 font-semibold mt-1">
            {department}
          </span>
        </div>

        {/* Metric 2: Current Queue Position */}
        <div className="bg-sky-50/80 p-4 sm:p-5 rounded-2xl border border-sky-200 text-center flex flex-col justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-700 block mb-1">
            {t('queue_pos', 'Current Position')}
          </span>
          <span className="text-3xl sm:text-4xl font-black font-mono text-sky-950 tracking-tight">
            #{position}
          </span>
          <span className="text-[10px] text-sky-700 font-bold mt-1">
            {position === 1 ? t('on_schedule', 'Next up!') : t('waiting_line', 'In live OPD queue')}
          </span>
        </div>

        {/* Metric 3: Patients Ahead */}
        <div className="bg-amber-50/80 p-4 sm:p-5 rounded-2xl border border-amber-200 text-center flex flex-col justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 block mb-1">
            {t('patients_ahead_label', 'Patients Ahead')}
          </span>
          <span className="text-3xl sm:text-4xl font-black font-mono text-amber-950 tracking-tight">
            {patientsAhead}
          </span>
          <span className="text-[10px] text-amber-800 font-bold mt-1">
            {patientsAhead === 0 ? t('you_are_next_in_line', "You're next in line!") : `${patientsAhead} ${patientsAhead === 1 ? 'patient' : 'patients'} ahead`}
          </span>
        </div>

        {/* Metric 4: Estimated Waiting Time (ML) */}
        <div className="bg-purple-50/80 p-4 sm:p-5 rounded-2xl border border-purple-200 text-center flex flex-col justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 flex items-center justify-center gap-1 mb-1">
            <Cpu className="w-3.5 h-3.5 text-purple-600" />
            <span>{t('estimated_wait_time', 'Estimated Wait')}</span>
          </span>
          <span className="text-3xl sm:text-4xl font-black font-mono text-purple-950 tracking-tight">
            ~{predictedWait}{t('mins_short', 'm')}
          </span>
          <span className="text-[10px] text-purple-700 font-bold mt-1">
            {t('rf_model_prediction', 'Random Forest Model')}
          </span>
        </div>

      </div>

      {/* FRESH CONSULTATION TIME & 30-MINUTE TARGET STATUS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
        
        {/* FRESH EXPECTED CONSULTATION TIME CARD */}
        <div className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-teal-100" />
              <span className="text-xs font-black uppercase tracking-wider text-teal-100">
                {t('fresh_expected_consultation', 'Fresh Expected Consultation')}
              </span>
            </div>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight mt-1">
              {expectedTime}
            </div>
            <p className="text-xs text-teal-100 font-medium mt-2 leading-relaxed">
              {t('consultation_recalculated_notice', 'Recalculated from your verified hospital arrival and live doctor queue pace.')}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs text-teal-100">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <DoorOpen className="w-4 h-4 text-white" />
              <span>{roomNumber}</span>
            </div>
            <div className="flex items-center gap-1.5 text-teal-100 font-medium">
              <Stethoscope className="w-3.5 h-3.5 text-teal-200" />
              <span>{doctorName}</span>
            </div>
          </div>
        </div>

        {/* 30-MINUTE TARGET STATUS CARD (REQUIREMENTS 6, 7, 8, 9) */}
        <div className={`rounded-2xl p-5 sm:p-6 border-2 flex flex-col justify-between transition-all ${
          isOnTrack
            ? 'bg-emerald-50/90 border-emerald-300'
            : 'bg-amber-50/90 border-amber-300'
        }`}>
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                {t('target_30_status_label', '30-Minute Target Status')}
              </span>

              {/* Status Badge */}
              {isOnTrack ? (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('target_30_on_track', 'On track')}</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-600 text-white flex items-center gap-1 shadow-xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{t('target_30_exceeded', 'Queue exceeds 30-minute target')}</span>
                </span>
              )}
            </div>

            {/* Status Message */}
            <div className="mt-2">
              {isOnTrack ? (
                <p className="text-sm font-extrabold text-emerald-950 leading-snug">
                  ✓ {t('target_on_track_desc', `Your estimated wait is ~${predictedWait} mins, on track within the hospital 30-minute target.`)}
                </p>
              ) : (
                <p className="text-sm font-extrabold text-amber-950 leading-snug">
                  ⚠️ {t('target_exceeded_desc', `Updated wait: ~${predictedWait} mins. High OPD volume has extended your turn beyond the 30-minute target.`)}
                </p>
              )}
            </div>
          </div>

          {/* Explicit Operational Target Disclaimer (Requirement 7) */}
          <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-start gap-2 text-[11px] text-slate-500">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-tight">
              <strong>{t('details', 'Notice')}:</strong> {t('target_30_disclaimer', '30 minutes is an operational target, not a guaranteed consultation time. High-acuity clinical cases or emergency triage may adjust timing.')}
            </p>
          </div>
        </div>

      </div>

      {/* WAITING LOUNGE GUIDANCE FOOTER */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600 relative z-10">
        <div className="flex items-center gap-2">
          <DoorOpen className="w-4 h-4 text-teal-600 shrink-0" />
          <span className="font-semibold">
            {t('waiting_in_opd_lounge', 'Please wait comfortably in the OPD waiting lounge near your assigned consultation room.')}
          </span>
        </div>
        <div className="text-[11px] font-bold text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200 shrink-0">
          Chamber {roomNumber} • {doctorName}
        </div>
      </div>

    </div>
  );
}
