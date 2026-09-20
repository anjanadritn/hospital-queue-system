import React from 'react';
import { AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * LateArrivalWarningCard
 * 
 * Clear, high-urgency patient-facing notification displayed when a patient's
 * token has been moved to the end of their doctor's queue because they missed
 * the 2-minute hospital arrival grace period.
 * 
 * Strictly renders only when queueData.late_arrival_reordered === true.
 * Uses dynamic tokens, positions, and consultation times with full i18n.
 */
export default function LateArrivalWarningCard({ queueData, className = '' }) {
  const { t } = useLanguage();

  if (!queueData || !queueData.late_arrival_reordered) {
    return null;
  }

  const token = queueData.queue_id || queueData.token || queueData.booking_id || 'N/A';
  const position = queueData.position != null ? queueData.position : 'Last';
  const expectedConsultation =
    queueData.expected_consultation_time ||
    queueData.travel_info?.expected_consultation_time ||
    'Approaching';
  const doctorName = queueData.doctor_name || 'Assigned Doctor';

  return (
    <div
      id="late-arrival-warning-card"
      className={`bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 border-2 border-red-500/80 rounded-3xl p-6 sm:p-7 shadow-lg shadow-rose-200/50 relative overflow-hidden transition-all ${className}`}
    >
      {/* Decorative pulse background */}
      <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header with Red Indicator Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-rose-200/90 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center font-bold shadow-md shadow-red-500/30 shrink-0">
            <AlertCircle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>🔴 {t('late_arrival_warning_title', 'Moved to end due to late arrival')}</span>
              </span>
            </div>
            <p className="text-xs text-rose-800 font-semibold mt-1">
              {t('late_arrival_desc', `Moved to the end of Dr. ${doctorName}'s queue because the 2-minute arrival deadline expired.`)}
            </p>
          </div>
        </div>
      </div>

      {/* Four Dynamic Information Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 relative z-10">
        {/* Token Tile */}
        <div className="bg-white/95 rounded-2xl p-4 border border-rose-200 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500 block mb-0.5">
            {t('your_token_label', 'Your token')}
          </span>
          <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
            {token}
          </span>
        </div>

        {/* New Queue Position Tile */}
        <div className="bg-white/95 rounded-2xl p-4 border-2 border-red-500 shadow-xs bg-red-50/30">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-700 block mb-0.5">
            {t('new_queue_position_label', 'New queue position')}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-red-600">
              #{position}
            </span>
            <span className="text-[11px] font-bold text-rose-700">
              (End of Queue)
            </span>
          </div>
        </div>

        {/* Recalculation Notice Tile */}
        <div className="bg-white/95 rounded-2xl p-4 border border-rose-200 shadow-2xs flex flex-col justify-center">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
            Notice
          </span>
          <div className="text-xs font-black text-rose-900 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-rose-600 animate-spin shrink-0" />
            <span>{t('queue_recalculated_notice', 'Your queue has been recalculated.')}</span>
          </div>
        </div>

        {/* Expected Consultation Time Tile */}
        <div className="bg-white/95 rounded-2xl p-4 border border-rose-200 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
            {t('expected_consultation_label', 'Expected consultation')}
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight flex items-center gap-1.5">
            <Clock className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{expectedConsultation}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
