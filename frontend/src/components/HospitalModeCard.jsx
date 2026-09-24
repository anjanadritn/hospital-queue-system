import React from 'react';
import { Building2, DoorOpen, BellRing, CheckCircle2, UserCheck, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function HospitalModeCard({ queueData, onToggleArrived }) {
  const { t } = useLanguage();
  if (!queueData) return null;

  const isArrived = queueData.arrived_at_hospital || queueData.status === 'arrived';
  const roomNumber = queueData.room_number || 'Room 204';
  const position = queueData.position || 1;
  const doctorName = queueData.doctor_name || queueData.doctor_id || 'Doctor';

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-teal-200 shadow-md relative overflow-hidden">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 text-teal-700 rounded-xl flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900">{t('hospital_mode_active', 'Hospital Queue Mode')}</h3>
            <p className="text-xs text-slate-500">{t('live_tracking_subtitle', 'Live inside-hospital status updates')}</p>
          </div>
        </div>

        {!isArrived ? (
          <button
            onClick={onToggleArrived}
            className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t('arrival_verified_title', "I've Arrived at Hospital")}</span>
          </button>
        ) : (
          <span className="px-3.5 py-1.5 bg-teal-100 text-teal-800 rounded-full text-xs font-extrabold flex items-center gap-1.5 border border-teal-200">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-ping" />
            {t('arrival_verified_title', "You're at the Hospital")}
          </span>
        )}
      </div>

      {/* Hospital Stage View */}
      {isArrived ? (
        <div className="space-y-6">
          
          {/* Room Number Callout */}
          <div className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-2xl p-6 text-center shadow-sm">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-teal-100 block mb-1">
              {t('chamber_location', 'Assigned Consultation Location')}
            </span>
            <div className="text-3xl font-extrabold flex items-center justify-center gap-2">
              <DoorOpen className="w-8 h-8" />
              <span>{t('proceed_to_room', { room: roomNumber, doctor: doctorName }, `Proceed to ${roomNumber}`)}</span>
            </div>
            <p className="text-xs text-teal-100 mt-1 font-medium">
              {t('doctor', 'Doctor')}: {doctorName} ({queueData.department || 'General Medicine'})
            </p>
          </div>

          {/* Dynamic Stage Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-sky-100 text-sky-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">
                  {t('live_tracking_title', 'Live Stage Announcement')}
                </h4>
                {position === 1 ? (
                  <p className="text-base font-extrabold text-emerald-600 animate-pulse">
                    🔔 {t('please_proceed_now', `Be ready — you are next! Please stand near ${roomNumber}.`)}
                  </p>
                ) : position === 2 ? (
                  <p className="text-sm font-bold text-sky-700">
                    {t('currently_consulting', 'Doctor is currently consulting another patient.')} {t('estimated_wait_time', 'Your turn is in approximately')} ~{queueData.predicted_wait_time || 12} {t('mins_short', 'minutes')}.
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-slate-700">
                    {t('currently_consulting', 'Doctor is currently consulting.')} {position - 1} {t('ahead_in_line', 'patient(s) ahead of you')}.
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
          <p className="text-xs text-slate-600 font-medium mb-3">
            {t('arrival_otp_hint', 'Once you arrive at the hospital entrance, click the button above to switch to Hospital Queue Mode and receive room location alerts.')}
          </p>
        </div>
      )}

    </div>
  );
}
