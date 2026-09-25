import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Calendar,
  User,
  MapPin,
  Plus,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LoadingState from '../components/LoadingState';
import StatusBadge from '../components/StatusBadge';

export default function PatientAppointments() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const patientId = user.patient_id || user.user_id;
    if (!patientId) { setLoading(false); return; }

    setLoading(true);
    hospitalApi.getPatientAppointments(patientId)
      .then((data) => setAppointments(Array.isArray(data) ? data : []))
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <LoadingState message="Loading your appointment history..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        {/* Page Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-sky-900 via-slate-900 to-teal-950 rounded-3xl p-6 sm:p-10 text-white shadow-xl">
          <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full text-xs font-bold border border-sky-400/30">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                <span>Complete Appointment History</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                {t('consultation_bookings')}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                {t('bookings_subtitle')}
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
                className="flex-1 md:flex-none px-6 py-3 bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white font-bold rounded-2xl text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
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
          <Link
            to="/patient/history"
            className="px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-teal-600" />
            <span>{t('my_medical_history')}</span>
          </Link>
          <span className="px-4 py-2.5 rounded-xl shrink-0 bg-sky-600 text-white shadow-xs flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{t('appointment_bookings', 'Appointment Bookings')} ({appointments.length})</span>
          </span>
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

        {/* Appointments Content */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">{t('consultation_bookings')}</h2>
              <p className="text-xs text-slate-500">{t('bookings_subtitle')}</p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
              {appointments.length} {t('bookings')}
            </span>
          </div>

          {appointments.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="font-bold text-slate-700 mb-1">{t('no_appointments_found')}</p>
              <Link
                to="/book"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 transition mt-3"
              >
                <Plus className="w-4 h-4" /> Book a Consultation
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 px-3">{t('booking_id', 'Booking ID')}</th>
                    <th className="pb-3 px-3">{t('token', 'Token #')}</th>
                    <th className="pb-3 px-3">{t('patient_and_origin', 'Patient & Origin')}</th>
                    <th className="pb-3 px-3">{t('doctor_and_dept', 'Doctor & Dept')}</th>
                    <th className="pb-3 px-3">{t('date', 'Date')}</th>
                    <th className="pb-3 px-3">{t('priority', 'Priority')}</th>
                    <th className="pb-3 px-3">{t('status', 'Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {appointments.map((apt) => (
                    <tr key={apt.booking_id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-sky-700">{apt.booking_id}</td>
                      <td className="py-3 px-3 font-mono font-black text-slate-900">{apt.queue_id || '—'}</td>
                      <td className="py-3 px-3 text-[11px]">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{apt.patient_name || user?.name || 'Patient'}</span>
                          {apt.booking_for === 'family' && apt.relation && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold">
                              {apt.relation}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 flex items-center gap-1 mt-0.5 max-w-[170px] truncate" title={apt.location_address || apt.patient_address || apt.city}>
                          <MapPin className="w-3 h-3 text-sky-500 shrink-0" />
                          <span>{apt.location_address || apt.patient_address || apt.city || 'Tumakuru'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[11px]">
                        <div className="font-bold text-slate-900">{apt.doctor_id}</div>
                        <div className="text-sky-700 font-semibold">{apt.department}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">{apt.consultation_date}</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={apt.priority || 'normal'} type="priority" />
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={apt.status} type="status" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
