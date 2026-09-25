import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Stethoscope,
  Calendar,
  Clock,
  FileText,
  User,
  CheckCircle2,
  Plus,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LoadingState from '../components/LoadingState';
import ConsultationRecordModal from '../components/ConsultationRecordModal';

export default function PatientMedicalHistory() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [medicalHistory, setMedicalHistory] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    hospitalApi.getMyMedicalHistory()
      .then((res) => {
        const records = res?.consultations || (Array.isArray(res) ? res : []);
        setMedicalHistory(records);
      })
      .catch(() => setMedicalHistory([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <LoadingState message="Loading your medical history records..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        {/* Page Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-teal-900 via-slate-900 to-emerald-950 rounded-3xl p-6 sm:p-10 text-white shadow-xl">
          <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/20 text-teal-300 rounded-full text-xs font-bold border border-teal-400/30">
                <Activity className="w-3.5 h-3.5 text-teal-400" />
                <span>SIMSRH Patient EMR</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                {t('my_medical_history')}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                {t('medical_history_subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <Link
                to="/patient"
                className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs transition flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Link>
              <Link
                to="/book"
                className="flex-1 md:flex-none px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold rounded-2xl text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Book Consultation</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-xs font-bold scrollbar-thin">
          <Link
            to="/patient"
            className="px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          >
            Overview &amp; Live Token
          </Link>
          <span className="px-4 py-2.5 rounded-xl shrink-0 bg-teal-700 text-white shadow-xs flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-teal-300" />
            <span>{t('my_medical_history')}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-white text-teal-800">
              {medicalHistory.length}
            </span>
          </span>
          <Link
            to="/patient/appointments"
            className="px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{t('appointment_bookings', 'Appointment Bookings')}</span>
          </Link>
          <Link
            to="/patient/profile"
            className="px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5"
          >
            <User className="w-3.5 h-3.5" />
            <span>{t('my_profile')}</span>
          </Link>
          <Link
            to="/patient/security"
            className="px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Account &amp; Security</span>
          </Link>
        </div>

        {/* Medical History Content */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  SIMSRH Patient EMR
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">{t('my_medical_history')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('medical_history_subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>{medicalHistory.length} {t('total_visits')}</span>
              </span>
            </div>
          </div>

          {medicalHistory.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-sm space-y-3">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-base font-bold text-slate-800">{t('no_history_yet')}</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Completed consultations and physician clinical assessments will automatically appear here chronologically once your consultation is concluded by your doctor.
              </p>
              <Link
                to="/book"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition mt-2"
              >
                <Plus className="w-4 h-4" /> Book a Consultation
              </Link>
            </div>
          ) : (
            <div className="relative pl-4 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-teal-200">
              {medicalHistory.map((item, idx) => {
                const date = item.consultation_date || (item.created_at ? item.created_at.split('T')[0] : 'N/A');
                const time = item.consultation_time || (item.created_at && item.created_at.includes('T') ? item.created_at.split('T')[1].substring(0, 5) : 'OPD Hours');
                const vitals = item.vitals_at_consultation || {};
                const pReported = item.patient_reported || {};
                const dAssess = item.doctor_assessment || {};
                const symptoms = pReported.symptoms || item.symptoms || [];
                const symptomsList = Array.isArray(symptoms) ? symptoms : [symptoms];
                const diagnosis = dAssess.diagnosis || item.diagnosis;
                const notes = dAssess.notes || item.doctor_notes;
                const advice = dAssess.advice || item.doctor_advice;
                const itemHeight = vitals.height_cm ?? item.height_cm;
                const itemWeight = vitals.weight_kg ?? item.weight_kg;
                const itemBmi = vitals.bmi ?? (itemHeight && itemWeight ? (itemWeight / Math.pow(itemHeight / 100, 2)).toFixed(1) : null);

                return (
                  <div key={item.consultation_id || item.queue_id || idx} className="relative group">
                    {/* Timeline Dot */}
                    <div className="absolute -left-4 sm:-left-8 top-6 -translate-x-1/2 w-4 h-4 rounded-full bg-teal-600 border-4 border-white shadow-sm group-hover:scale-125 transition-transform" />

                    {/* Consultation Card */}
                    <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-teal-300 transition space-y-5">
                      {/* Top Section */}
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                              Consultation Record
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                              Patient ID: {item.patient_id || user?.patient_id || 'N/A'}
                            </span>
                            <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              ID: {item.consultation_id || item.queue_id || 'OPD-REC'}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> {t('visit_completed')}
                            </span>
                          </div>

                          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 pt-0.5">
                            <User className="w-5 h-5 text-teal-600 shrink-0" />
                            <span>{item.patient_name || user?.name || 'Patient'}</span>
                          </h3>

                          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 pt-0.5">
                            <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                              <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                              <span>{item.doctor_name || item.doctor_id || 'Attending Specialist'}</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              {item.department || 'General Medicine'}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="font-bold text-teal-700 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" /> {date}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500 flex items-center gap-1 font-medium">
                              <Clock className="w-3.5 h-3.5" /> {time}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedRecord(item)}
                          className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                        >
                          <FileText className="w-4 h-4" />
                          <span>{t('view_full_record')}</span>
                        </button>
                      </div>

                      {/* Vitals Summary Bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70">
                        <div>
                          <span className="text-slate-400 block text-[10px] font-bold uppercase">{t('age_years')}</span>
                          <span className="font-bold text-slate-800 mt-0.5 block">{vitals.age ?? item.age ?? '—'} yrs</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] font-bold uppercase">{t('gender')}</span>
                          <span className="font-bold text-slate-800 mt-0.5 block">{vitals.gender ?? item.gender ?? '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] font-bold uppercase">{t('height')}</span>
                          <span className="font-bold text-slate-800 mt-0.5 block">{itemHeight ? `${itemHeight} cm` : '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] font-bold uppercase">{t('weight')}</span>
                          <span className="font-bold text-slate-800 mt-0.5 block">{itemWeight ? `${itemWeight} kg` : '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] font-bold uppercase">{t('calculated_bmi')}</span>
                          <span className="font-extrabold text-teal-700 mt-0.5 block">{itemBmi ? `${itemBmi} kg/m²` : '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] font-bold uppercase">Duration</span>
                          <span className="font-bold text-slate-800 mt-0.5 block">{pReported.duration_days ?? item.duration_days ?? 1} day(s)</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] font-bold uppercase">Origin</span>
                          <span className="font-bold text-slate-800 mt-0.5 block truncate" title={vitals.city || item.city || 'Tumakuru'}>
                            📍 {vitals.city || item.city || 'Tumakuru'}
                          </span>
                        </div>
                      </div>

                      {/* Two Column Clinical Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/40 space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1">
                            <User className="w-3 h-3" /> {t('patient_reported_complaints')}
                          </span>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {symptomsList.length > 0 ? (
                              symptomsList.map((s, sIdx) => (
                                <span key={sIdx} className="px-2 py-0.5 rounded text-xs font-semibold bg-white text-sky-900 border border-sky-200 shadow-xs">
                                  • {s}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs italic text-slate-400">No symptoms reported</span>
                            )}
                          </div>
                          {pReported.duration_days && (
                            <p className="text-xs text-slate-600 font-medium pt-1">
                              Duration of Illness: <strong>{pReported.duration_days} day(s)</strong>
                            </p>
                          )}
                          {pReported.custom_symptoms && (
                            <p className="text-xs text-slate-600 italic bg-white p-2 rounded border border-sky-100">
                              "{pReported.custom_symptoms}"
                            </p>
                          )}
                        </div>

                        <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                            <Stethoscope className="w-3 h-3" /> {t('doctor_assessment')}
                          </span>
                          <div>
                            <span className="text-[11px] text-slate-400 font-semibold block">{t('diagnosis')}:</span>
                            {diagnosis ? (
                              <span className="text-xs font-bold text-emerald-900 bg-white px-2 py-1 rounded inline-block border border-emerald-200 mt-0.5">
                                {diagnosis}
                              </span>
                            ) : (
                              <span className="text-xs italic text-slate-500">
                                {t('no_diagnosis_recorded')}
                              </span>
                            )}
                          </div>
                          {notes && (
                            <p className="text-xs text-slate-700 pt-1 line-clamp-2">
                              <strong className="text-slate-900">Notes: </strong>{notes}
                            </p>
                          )}
                          {advice && (
                            <p className="text-xs text-slate-700 line-clamp-2">
                              <strong className="text-slate-900">Advice: </strong>{advice}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Full Consultation Record Modal */}
      {selectedRecord && (
        <ConsultationRecordModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}
