import React, { useState, useEffect } from 'react';
import {
  Activity,
  Clock,
  UserCheck,
  Stethoscope,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useLanguage } from '../context/LanguageContext';
import { formatErrorMessage } from '../utils/errorUtils';

const DEPARTMENTS = [
  'All Departments',
  'Cardiology',
  'General Medicine',
  'Orthopedics',
  'Pediatrics',
  'Dermatology',
  'Neurology',
  'ENT',
  'Gastroenterology',
  'Pulmonology',
  'Ophthalmology'
];

export default function LiveQueueBoard({ initialDepartment = '' }) {
  const { t } = useLanguage();
  const [selectedDept, setSelectedDept] = useState(initialDepartment);
  const [selectedSlot, setSelectedSlot] = useState(''); // '' for all, 'morning', 'evening'
  const [selectedDoctor, setSelectedDoctor] = useState(''); // '' for all doctors
  const [doctorsList, setDoctorsList] = useState([]);
  const [queueData, setQueueData] = useState({
    currently_consulting: [],
    next_patient: null,
    next_patients: [],
    upcoming_patients: [],
    doctor_queues: {},
    total_active_queue: 0,
    last_updated: ''
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    hospitalApi.getDoctors()
      .then((docs) => {
        const list = Array.isArray(docs) ? docs : (docs?.doctors || []);
        setDoctorsList(list);
      })
      .catch(() => {});
  }, []);

  const fetchLiveQueue = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      setError(null);
      const deptFilter = selectedDept === 'All Departments' ? '' : selectedDept;
      const data = await hospitalApi.getPublicQueue(deptFilter, selectedSlot, selectedDoctor);
      setQueueData(data || {});
    } catch (err) {
      console.error('Failed to load public live queue:', err);
      setError('Unable to stream live queue data. Retrying...');
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveQueue();
    // Auto refresh every 8 seconds to reflect live queue events without page reload
    const interval = setInterval(() => {
      fetchLiveQueue();
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedDept, selectedSlot, selectedDoctor]);

  const currentlyConsulting = queueData.currently_consulting || [];
  const nextPatient = queueData.next_patient;
  const upcomingPatients = queueData.upcoming_patients || [];
  const doctorQueues = queueData.doctor_queues || {};
  const doctorQueueList = Object.values(doctorQueues);
  const totalCount = queueData.total_active_queue || 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100/70 overflow-hidden">
      {/* Top Banner & Filters */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 px-6 py-6 text-white sm:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800/60">
                {t('live_queue_board', 'Live OPD Queue Board')}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2">
              {t('live_tracking_title', 'Real-Time Consultation Queue')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              {t('live_queue_subtitle', 'Dynamically recalculated using Random Forest machine learning based on live doctor consultations.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Slot selector */}
            <div className="flex bg-slate-800/90 p-1 rounded-xl border border-slate-700/60 text-xs">
              <button
                onClick={() => setSelectedSlot('')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  selectedSlot === '' ? 'bg-sky-600 text-white shadow' : 'text-slate-300 hover:text-white'
                }`}
              >
                {t('all_slots', 'All Slots')}
              </button>
              <button
                onClick={() => setSelectedSlot('morning')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  selectedSlot === 'morning' ? 'bg-sky-600 text-white shadow' : 'text-slate-300 hover:text-white'
                }`}
              >
                {t('morning_slot', 'Morning')}
              </button>
              <button
                onClick={() => setSelectedSlot('evening')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  selectedSlot === 'evening' ? 'bg-sky-600 text-white shadow' : 'text-slate-300 hover:text-white'
                }`}
              >
                {t('evening_slot', 'Evening')}
              </button>
            </div>

            {/* Doctor selector */}
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="bg-slate-800 text-white text-xs font-semibold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              <option value="">{t('all_doctors', 'All Doctors')}</option>
              {doctorsList.map((doc) => (
                <option key={doc.doctor_id} value={doc.doctor_id}>
                  {doc.name} ({doc.department})
                </option>
              ))}
            </select>

            {/* Department selector */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-800 text-white text-xs font-semibold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept === 'All Departments' ? '' : dept}>
                  {dept === 'All Departments' ? t('all_departments', 'All Departments') : dept}
                </option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              onClick={() => fetchLiveQueue(true)}
              disabled={isRefreshing}
              title={t('refresh', 'Refresh queue')}
              className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Board Content */}
      <div className="p-6 sm:p-8 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-600 mb-3" />
            <p className="text-sm font-medium">{t('loading_clinical_records', 'Streaming live hospital queue data...')}</p>
          </div>
        ) : error && totalCount === 0 ? (
          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="text-sm">{formatErrorMessage(error)}</span>
          </div>
        ) : (
          <>
            {/* SEPARATE DOCTOR QUEUES BREAKDOWN */}
            {doctorQueueList.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-sky-600" />
                    {t('doctor_workstation', 'Doctor-Specific OPD Queues')} ({doctorQueueList.length})
                  </h3>
                  {selectedDoctor && (
                    <button
                      onClick={() => setSelectedDoctor('')}
                      className="text-xs text-sky-600 hover:text-sky-700 font-semibold underline cursor-pointer"
                    >
                      {t('all_doctors', 'View All Doctor Queues')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {doctorQueueList.map((dq) => {
                    const isSelected = selectedDoctor === dq.doctor_id;
                    const consultingToken = dq.currently_consulting?.[0]?.token;
                    const nextToken = dq.next_patient?.token;
                    return (
                      <button
                        key={dq.doctor_id || dq.doctor_name}
                        onClick={() => setSelectedDoctor(isSelected ? '' : (dq.doctor_id || ''))}
                        className={`text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-sky-50/80 border-sky-400 shadow-sm ring-2 ring-sky-300'
                            : 'bg-white hover:bg-slate-50/80 border-slate-200/80 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-slate-900 block truncate">
                              {dq.doctor_name}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 block">
                              {dq.department}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] font-bold rounded-md">
                            {dq.room_number || 'Room 204'}
                          </span>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="text-emerald-700 font-bold">
                            {t('in_consultation', 'Serving')}: {consultingToken || t('ready', 'Open')}
                          </span>
                          <span className="text-sky-700 font-semibold">
                            {t('next_in_line', 'Next')}: {nextToken || t('ready', 'None')}
                          </span>
                          <span className="text-slate-400 font-bold">
                            {dq.total_active} {t('waiting', 'waiting')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Two Primary Focus Cards: Currently Consulting & Next */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* CURRENTLY CONSULTING */}
              <div className="relative rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/20 p-5 sm:p-6 shadow-sm overflow-hidden">
                <div className="absolute top-0 right-0 transform translate-x-3 -translate-y-3 w-28 h-28 bg-emerald-200/30 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                      {t('currently_consulting', 'Now In Consultation')}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
                    {t('active_now', 'Active Room')}
                  </span>
                </div>

                {currentlyConsulting.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {currentlyConsulting.map((item, i) => (
                      <div key={item.token || i} className="bg-white/80 backdrop-blur rounded-xl p-4 border border-emerald-200/80 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-900">
                              {item.token}
                            </span>
                            <p className="text-xs font-bold text-slate-700 mt-0.5">
                              {item.consultation_category || item.department}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="inline-block px-2.5 py-1 bg-slate-900 text-white font-mono text-xs font-bold rounded-lg shadow-sm">
                              {item.room_number || 'Room 204'}
                            </span>
                            <p className="text-[11px] font-semibold text-slate-500 mt-1">
                              {item.doctor}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                          <span className="flex items-center gap-1 font-medium text-emerald-700">
                            <Activity className="w-3.5 h-3.5 text-emerald-600" />
                            {t('in_consultation', 'Consultation in progress')}
                          </span>
                          <span className="font-semibold text-slate-700">
                            ~{item.predicted_duration || 12} {t('mins_short', 'mins')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400">
                    <Stethoscope className="w-8 h-8 mx-auto text-slate-300 mb-1.5" />
                    <p className="text-xs font-medium">{t('ready_to_call', 'Chamber currently open for next patient')}</p>
                  </div>
                )}
              </div>

              {/* NEXT IN LINE */}
              <div className="relative rounded-2xl border-2 border-sky-500/40 bg-gradient-to-br from-sky-50/60 via-white to-sky-50/20 p-5 sm:p-6 shadow-sm overflow-hidden">
                <div className="absolute top-0 right-0 transform translate-x-3 -translate-y-3 w-28 h-28 bg-sky-200/30 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between pb-3 border-b border-sky-200/60">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-sky-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-sky-800">
                      {t('next_in_line', 'Next Patient (Position #1)')}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-sky-100 text-sky-800 text-[11px] font-bold rounded-full">
                    {t('ready', 'Please Be Ready')}
                  </span>
                </div>

                {nextPatient ? (
                  <div className="mt-4 bg-white/80 backdrop-blur rounded-xl p-4 border border-sky-200/80 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-2xl sm:text-3xl font-black tracking-tight text-sky-950">
                          {nextPatient.token}
                        </span>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">
                          {nextPatient.consultation_category || nextPatient.department}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2.5 py-1 bg-sky-900 text-white font-mono text-xs font-bold rounded-lg shadow-sm">
                          {nextPatient.room_number || 'Room 204'}
                        </span>
                        <p className="text-[11px] font-semibold text-slate-500 mt-1">
                          {nextPatient.doctor}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('estimated_wait_time', 'Est. Wait')}</span>
                        <span className="text-sm font-black text-sky-700">~{nextPatient.estimated_wait_time || 5} {t('mins_short', 'min')}</span>
                      </div>
                      <div className="border-l border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('expected_consultation_label', 'Expected Start')}</span>
                        <span className="text-sm font-black text-slate-800">{nextPatient.expected_consultation_time || t('ready', 'Immediate')}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400">
                    <UserCheck className="w-8 h-8 mx-auto text-slate-300 mb-1.5" />
                    <p className="text-xs font-medium">{t('no_waiting_patients', 'No queue wait for next position')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* UPCOMING QUEUE PROGRESSION TIMELINE */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  {t('upcoming_queue', 'Upcoming Queue Progression')} ({upcomingPatients.length} {t('waiting', 'Waiting')})
                </h3>
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                  {t('live_queue_subtitle', 'Expected times update progressively with each consultation')}
                </span>
              </div>

              {upcomingPatients.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {upcomingPatients.map((patient, index) => (
                    <div
                      key={patient.token || index}
                      className="bg-slate-50 hover:bg-white hover:border-sky-300 border border-slate-200/80 rounded-2xl p-4 transition-all duration-200 shadow-sm hover:shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 font-mono">
                            {patient.token}
                          </span>
                          <span className="text-xs font-bold text-slate-500">
                            #{patient.position}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-200/60 px-2 py-0.5 rounded-md">
                          {patient.room_number || 'Room 204'}
                        </span>
                      </div>

                      <p className="text-xs font-bold text-slate-800 mt-2 truncate">
                        {patient.consultation_category || patient.department}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {patient.doctor}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">{t('estimated_wait_time', 'Wait')}</span>
                          <span className="font-bold text-slate-700">~{patient.estimated_wait_time}{t('mins_short', 'm')}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-semibold">{t('expected_consultation_label', 'Expected')}</span>
                          <span className="font-black text-sky-700">{patient.expected_consultation_time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                  {t('no_waiting_patients', 'No further patients in this slot queue. Immediate consultation available!')}
                </div>
              )}
            </div>

            {/* Privacy & Safety Footer Notice */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero Patient Health Information (PHI) displayed. Protected by hospital privacy compliance.</span>
              </div>
              <div className="text-slate-400">
                SIMSRH Smart Hospital • OPD Live Display
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
