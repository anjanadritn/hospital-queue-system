import React from 'react';
import { 
  X, Calendar, Clock, User, Stethoscope, Building2, 
  FileText, Activity, AlertCircle, CheckCircle2, Printer, 
  ShieldAlert, Sparkles, HeartPulse, Scale, Ruler, MapPin
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function ConsultationRecordModal({ record, onClose }) {
  const { t } = useLanguage();

  if (!record) return null;

  const consultationDate = record.consultation_date || (record.created_at ? record.created_at.split('T')[0] : 'N/A');
  const consultationTime = record.consultation_time || (record.created_at && record.created_at.includes('T') 
    ? record.created_at.split('T')[1].substring(0, 5) 
    : 'OPD Hours');

  const doctorName = record.doctor_name || record.doctor_id || 'Attending Physician';
  const department = record.department || 'General OPD';
  const patientName = record.patient_name || 'Patient';
  const patientId = record.patient_id || 'N/A';

  // Vitals
  const vitals = record.vitals_at_consultation || {};
  const age = vitals.age ?? record.age ?? 'N/A';
  const gender = vitals.gender ?? record.gender ?? 'N/A';
  const height = vitals.height_cm ?? record.height_cm;
  const weight = vitals.weight_kg ?? record.weight_kg;
  const bmi = vitals.bmi ?? (height && weight ? (weight / Math.pow(height / 100, 2)).toFixed(1) : null);
  const city = vitals.city || record.city || record.address || 'Tumakuru';

  // Patient reported
  const patientReported = record.patient_reported || {};
  const symptoms = patientReported.symptoms || record.symptoms || [];
  const symptomsList = Array.isArray(symptoms) ? symptoms : [symptoms];
  const durationDays = patientReported.duration_days ?? record.duration_days;
  const customSymptoms = patientReported.custom_symptoms || record.custom_symptoms;

  // Doctor assessment
  const doctorAssessment = record.doctor_assessment || {};
  const diagnosis = doctorAssessment.diagnosis || record.diagnosis || null;
  const doctorNotes = doctorAssessment.notes || record.doctor_notes || null;
  const doctorAdvice = doctorAssessment.advice || record.doctor_advice || null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-fadeIn print:p-0 print:bg-white">
      <div 
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 print:shadow-none print:border-none print:m-0 print:w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-cyan-900 text-white p-6 relative print:bg-white print:text-slate-900 print:border-b-2 print:border-teal-700">
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-teal-100 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition print:hidden"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-3">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20 print:bg-teal-50 print:border-teal-600">
              <HeartPulse className="w-7 h-7 text-teal-200 print:text-teal-700" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest font-semibold text-teal-200 print:text-teal-700">
                Shridevi Institute of Medical Sciences & Research Hospital (SIMSRH)
              </span>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white print:text-slate-900">
                {t('consultation_sheet')}
              </h2>
              <p className="text-xs text-teal-100/90 mt-0.5 print:text-slate-600">
                Sira Road, NH4, Tumakuru, Karnataka – 572106 • 24/7 Emergency & OPD Care
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/15 text-xs text-teal-100 print:border-slate-300 print:text-slate-700">
            <div>
              <span className="opacity-75 block text-[11px]">{t('token')} / Ref:</span>
              <span className="font-mono font-bold text-white print:text-slate-900 text-sm">
                {record.queue_id || record.consultation_id || record.booking_id || 'OPD-REC'}
              </span>
            </div>
            <div>
              <span className="opacity-75 block text-[11px]">{t('consultation_date')}:</span>
              <span className="font-semibold text-white print:text-slate-900 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {consultationDate}
              </span>
            </div>
            <div>
              <span className="opacity-75 block text-[11px]">{t('physician')}:</span>
              <span className="font-semibold text-white print:text-slate-900 flex items-center gap-1">
                <Stethoscope className="w-3 h-3" /> {doctorName}
              </span>
            </div>
            <div>
              <span className="opacity-75 block text-[11px]">{t('department_label')}:</span>
              <span className="font-semibold text-white print:text-slate-900 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {department}
              </span>
            </div>
          </div>
        </div>

        {/* Record Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto print:max-h-none print:overflow-visible">
          {/* Patient Info & Vitals Strip */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold">
                  {patientName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                    {patientName}
                  </h4>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    Patient ID: <strong className="text-slate-700 dark:text-slate-200">{patientId}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('visit_completed')}
                </span>
              </div>
            </div>

            {/* Vitals Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 mt-3 text-xs">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <span className="text-slate-400 block text-[11px]">{t('age_years')}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{age} yrs</span>
              </div>
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <span className="text-slate-400 block text-[11px]">{t('gender')}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{gender}</span>
              </div>
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <span className="text-slate-400 block text-[11px] flex items-center gap-1"><Ruler className="w-3 h-3 text-teal-500" /> {t('height')}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{height ? `${height} cm` : '—'}</span>
              </div>
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <span className="text-slate-400 block text-[11px] flex items-center gap-1"><Scale className="w-3 h-3 text-teal-500" /> {t('weight')}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{weight ? `${weight} kg` : '—'}</span>
              </div>
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <span className="text-slate-400 block text-[11px] flex items-center gap-1"><Activity className="w-3 h-3 text-teal-500" /> {t('calculated_bmi')}</span>
                <span className="font-semibold text-teal-700 dark:text-teal-300 text-sm">
                  {bmi ? `${bmi} kg/m²` : '—'}
                </span>
              </div>
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <span className="text-slate-400 block text-[11px] flex items-center gap-1"><MapPin className="w-3 h-3 text-teal-500" /> {t('origin', 'Origin')}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate block" title={city}>
                  {city}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Patient-Reported Complaints (Strictly Separated) */}
          <div className="rounded-xl p-5 border border-sky-200 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/20">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800 dark:bg-sky-900/80 dark:text-sky-300">
                Section 1
              </span>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
                <User className="w-4 h-4 text-sky-600" /> {t('patient_reported_complaints')}
              </h3>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                  {t('chief_complaints')}
                </span>
                <div className="flex flex-wrap gap-2">
                  {symptomsList.length > 0 ? (
                    symptomsList.map((s, idx) => (
                      <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-slate-800 text-sky-900 dark:text-sky-200 border border-sky-200 dark:border-sky-800 shadow-sm">
                        • {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs italic text-slate-400">{t('no_symptoms_reported', 'No specific symptoms recorded')}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {durationDays && (
                  <div className="text-xs bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block">{t('illness_duration')}:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {durationDays} {t('days_of_symptoms', 'day(s) of symptoms')}
                    </span>
                  </div>
                )}
                {customSymptoms && (
                  <div className="text-xs bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 sm:col-span-2">
                    <span className="text-slate-400 block">{t('patient_additional_notes')}:</span>
                    <p className="text-slate-700 dark:text-slate-200 italic mt-0.5 whitespace-pre-line">
                      "{customSymptoms}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Doctor-Recorded Clinical Assessment & Plan (Strictly Separated) */}
          <div className="rounded-xl p-5 border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-300">
                Section 2
              </span>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-emerald-600" /> {t('doctor_assessment')}
              </h3>
            </div>

            <div className="space-y-4 text-sm">
              {/* Diagnosis Field */}
              <div className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-800/80 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> {t('diagnosis')}
                  </span>
                  {diagnosis ? (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      {t('clinically_confirmed', 'Clinically Confirmed')}
                    </span>
                  ) : null}
                </div>
                {diagnosis ? (
                  <p className="text-base font-bold text-slate-900 dark:text-white">
                    {diagnosis}
                  </p>
                ) : (
                  <div className="flex items-center gap-2 text-xs italic text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-dashed border-slate-300 dark:border-slate-700">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{t('no_diagnosis_recorded')}</span>
                  </div>
                )}
              </div>

              {/* Clinical Notes / Observations */}
              {doctorNotes && (
                <div className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    {t('clinical_notes')}
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 text-sm whitespace-pre-line leading-relaxed">
                    {doctorNotes}
                  </p>
                </div>
              )}

              {/* Medical Advice & Treatment Plan */}
              {doctorAdvice && (
                <div className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-teal-200 dark:border-teal-800/80">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 block mb-1">
                    {t('medical_advice')}
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 text-sm whitespace-pre-line leading-relaxed font-medium">
                    {doctorAdvice}
                  </p>
                </div>
              )}

              {!diagnosis && !doctorNotes && !doctorAdvice && (
                <p className="text-xs italic text-slate-400 text-center py-2">
                  No physician notes or instructions were documented during this consultation.
                </p>
              )}
            </div>
          </div>

          {/* Hospital Seal & Physician Signature area for printing */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-end text-xs text-slate-500 print:flex">
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">SIMSRH Tumakuru Outpatient Department</p>
              <p>Generated via Smart Hospital Queue & EMR System</p>
            </div>
            <div className="text-right">
              <div className="h-10 border-b border-dashed border-slate-400 w-48 mb-1"></div>
              <p className="font-bold text-slate-800 dark:text-slate-200">{doctorName}</p>
              <p className="text-[11px]">{department}</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 print:hidden">
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition flex items-center gap-2 shadow-sm"
          >
            <Printer className="w-4 h-4" /> {t('print_record')}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition shadow-sm"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
