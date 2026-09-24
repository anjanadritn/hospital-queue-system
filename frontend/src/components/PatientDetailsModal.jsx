import React, { useEffect } from 'react';
import {
  X,
  User,
  Activity,
  Phone,
  MapPin,
  Clock,
  Cpu,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  FileText,
  Weight,
  Ruler,
  PhoneCall,
  Play,
  SkipForward,
  HeartPulse
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { useLanguage } from '../context/LanguageContext';

export default function PatientDetailsModal({
  patient,
  isOpen,
  onClose,
  onCall,
  onStart,
  onComplete,
  onSkip,
  actionLoading = false
}) {
  const { t } = useLanguage();

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !patient) return null;

  // Calculate BMI if height and weight are provided
  const heightM = patient.height_cm ? patient.height_cm / 100 : null;
  const bmi = heightM && patient.weight_kg ? (patient.weight_kg / (heightM * heightM)).toFixed(1) : null;
  
  let bmiCategory = null;
  let bmiColor = 'text-slate-600 bg-slate-100 border-slate-200';
  if (bmi) {
    const val = parseFloat(bmi);
    if (val < 18.5) {
      bmiCategory = 'Underweight';
      bmiColor = 'text-amber-700 bg-amber-50 border-amber-200';
    } else if (val < 25) {
      bmiCategory = 'Normal Weight';
      bmiColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (val < 30) {
      bmiCategory = 'Overweight';
      bmiColor = 'text-orange-700 bg-orange-50 border-orange-200';
    } else {
      bmiCategory = 'Obese';
      bmiColor = 'text-rose-700 bg-rose-50 border-rose-200';
    }
  }

  const isEmergency = patient.priority === 'emergency';
  const isCurrent = patient.status === 'called' || patient.status === 'in_consultation';
  const isMissed = patient.status === 'missed';

  const symptomsList = Array.isArray(patient.symptoms)
    ? patient.symptoms
    : patient.symptoms
    ? [patient.symptoms]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className={`px-6 py-5 border-b border-slate-200/80 flex items-start justify-between gap-4 ${
          isEmergency
            ? 'bg-gradient-to-r from-rose-600 via-rose-700 to-slate-900 text-white'
            : 'bg-gradient-to-r from-sky-700 via-teal-700 to-slate-900 text-white'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-13 h-13 rounded-2xl flex items-center justify-center text-xl font-black shadow-md ${
              isEmergency ? 'bg-rose-500 text-white' : 'bg-white/20 text-white backdrop-blur-sm'
            }`}>
              {patient.patient_name ? patient.patient_name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  {patient.patient_name || patient.name || 'Patient Profile'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-white/20 text-white border border-white/30">
                  {patient.queue_id || patient.booking_id || 'OPD'}
                </span>
                {patient.position && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                    Pos #{patient.position}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-white/80 mt-1 font-medium flex-wrap">
                <span>ID: <strong className="text-white">{patient.patient_id || 'P-OPD'}</strong></span>
                <span>•</span>
                <span>{patient.age ? `${patient.age} yrs` : 'Age N/A'}</span>
                <span>•</span>
                <span>{patient.gender || 'Not Specified'}</span>
                <span>•</span>
                <span className="capitalize">{patient.department || 'General Medicine'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE CLINICAL CONTENT) */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-slate-800">
          
          {/* Status & Priority Alerts */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('status') || 'Status'}:</span>
              <StatusBadge status={patient.status} type="status" />
              <StatusBadge status={patient.priority} type="priority" />
            </div>

            <div className="flex items-center gap-2">
              {patient.verified_by_admin || patient.arrived_at_hospital ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('arrived_verified') || 'Arrived & Verified'}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t('in_transit') || 'In Transit / En Route'}</span>
                </span>
              )}
            </div>
          </div>

          {/* SECTION 1: PHYSICAL VITALS & ANTHROPOMETRICS */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-sky-600" />
                <span>{t('physical_vitals') || 'Physical Vitals & Body Metrics'}</span>
              </h4>
              <span className="text-[11px] font-semibold text-slate-400">Pre-Consultation Recorded</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('height') || 'Height'}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-slate-900">
                    {patient.height_cm ? patient.height_cm : '—'}
                  </span>
                  {patient.height_cm && <span className="text-xs text-slate-500 font-bold">cm</span>}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('weight') || 'Weight'}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-slate-900">
                    {patient.weight_kg ? patient.weight_kg : '—'}
                  </span>
                  {patient.weight_kg && <span className="text-xs text-slate-500 font-bold">kg</span>}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('calculated_bmi') || 'Calculated BMI'}</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-slate-900">{bmi || '—'}</span>
                  {bmiCategory && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${bmiColor}`}>
                      {bmiCategory}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('illness_duration') || 'Illness Duration'}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-amber-700">
                    {patient.duration_days || 1}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">
                    {patient.duration_days === 1 ? 'day' : 'days'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: CLINICAL COMPLAINT & SYMPTOMS */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-sky-600" />
              <span>{t('presenting_symptoms') || 'Presenting Symptoms & Clinical Complaints'}</span>
            </h4>

            {symptomsList.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {symptomsList.map((symptom, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-sky-50 text-sky-800 border border-sky-200 rounded-xl text-xs font-extrabold capitalize flex items-center gap-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    <span>{symptom}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic">General OPD Consultation / Routine Health Check</div>
            )}

            {patient.custom_symptoms && (
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1">
                <span className="font-bold text-[10px] uppercase text-amber-700 block">
                  {t('patient_additional_notes') || "Patient's Clinical Notes / Symptoms Description"}:
                </span>
                <p className="italic">"{patient.custom_symptoms}"</p>
              </div>
            )}
          </div>

          {/* SECTION 3: DEMOGRAPHICS, ORIGIN & TRAVEL */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-sky-600" />
              <span>{t('demographics_origin') || 'Demographics, Origin & Hospital Transit'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('village_city') || 'Village / City Origin'}</span>
                  <span className="font-extrabold text-slate-900">{patient.city || patient.address || 'Tumakuru'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('contact_phone') || 'Contact Phone'}</span>
                  <span className="font-extrabold text-slate-900">
                    {patient.patient_phone ? `+91 ${patient.patient_phone}` : patient.phone ? `+91 ${patient.phone}` : '—'}
                  </span>
                </div>
              </div>

              {patient.travel_info && (
                <div className="sm:col-span-2 p-3 bg-sky-50/60 border border-sky-100 rounded-xl text-xs flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                    <div>
                      <span className="font-bold text-sky-900">
                        {patient.travel_info.distance_km || 8} km • ~{patient.travel_info.travel_time_min || 20}m transit time
                      </span>
                      <span className="text-slate-500 block text-[11px]">
                        Traffic: {patient.travel_info.traffic_condition || 'Normal'} • Mode: {patient.travel_info.mode || 'Drive'}
                      </span>
                    </div>
                  </div>
                  {patient.travel_info.leave_by_time && (
                    <span className="px-2.5 py-1 bg-white text-sky-700 font-extrabold rounded-lg border border-sky-200 text-[11px]">
                      Leave by: {patient.travel_info.leave_by_time}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 4: ML PREDICTION & QUEUE METRICS */}
          <div className="bg-purple-50/60 border border-purple-200/80 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-purple-600" />
                <span>{t('rf_model_prediction') || 'Random Forest Consultation Duration System'}</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-purple-200/70 text-purple-800 text-[10px] font-extrabold">
                Active SIMSRH Model
              </span>
            </div>
            <p className="text-xs text-purple-950 font-medium">
              Based on patient's reported symptoms ({symptomsList.join(', ') || 'OPD'}), department ({patient.department}), and {patient.priority} priority, the Random Forest model estimated a consultation duration of{' '}
              <strong className="text-purple-900 font-black">
                ~{patient.predicted_duration || patient.predicted_consultation_duration || 14} minutes
              </strong>.
            </p>
          </div>

        </div>

        {/* MODAL FOOTER WITH DIRECT DOCTOR WORKFLOW ACTIONS */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            <span>Room: </span>
            <strong className="text-slate-800 font-extrabold">{patient.room_number || 'Room 102 (OPD)'}</strong>
          </div>

          <div className="flex items-center gap-2">
            {/* Call Patient button */}
            {(patient.status === 'waiting' || patient.status === 'ready' || patient.status === 'missed') && onCall && (
              <button
                onClick={() => {
                  onCall(patient.queue_id);
                  onClose();
                }}
                disabled={actionLoading}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>{patient.status === 'missed' ? t('re_call') || 'Re-Call' : t('call_to_chamber') || 'Call to Chamber'}</span>
              </button>
            )}

            {/* Start Consultation button */}
            {patient.status === 'called' && onStart && (
              <button
                onClick={() => {
                  onStart(patient.queue_id);
                  onClose();
                }}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{t('start_consultation') || 'Start Consultation'}</span>
              </button>
            )}

            {/* Complete Consultation button */}
            {(patient.status === 'in_consultation' || patient.status === 'called') && onComplete && (
              <button
                onClick={() => {
                  onComplete(patient.queue_id);
                  onClose();
                }}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('complete_consultation') || 'Complete Consultation'}</span>
              </button>
            )}

            {/* Skip Patient button */}
            {(patient.status === 'called' || patient.status === 'in_consultation' || patient.status === 'waiting') && onSkip && (
              <button
                onClick={() => {
                  onSkip(patient.queue_id);
                  onClose();
                }}
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5 text-amber-700" />
                <span>{t('skip_missed') || 'Skip (Missed)'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {t('close') || 'Close'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
