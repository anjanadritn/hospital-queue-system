import React, { useState } from 'react';
import { 
  X, AlertTriangle, Calendar, Clock, Stethoscope, Ticket, 
  CheckCircle2, Loader2, Ban, ShieldAlert 
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { hospitalApi } from '../api/hospitalApi';

export default function CancelAppointmentModal({ appointment, isOpen, onClose, onSuccess }) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen || !appointment) return null;

  const reasonsList = [
    { key: 'unable', label: t('cancel_reason_unable', 'Unable to attend') },
    { key: 'schedule', label: t('cancel_reason_schedule', 'Schedule changed') },
    { key: 'mistake', label: t('cancel_reason_mistake', 'Booked by mistake') },
    { key: 'other', label: t('cancel_reason_other', 'Other') }
  ];

  const handleCancel = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let finalReason = reason;
      if (reason === t('cancel_reason_other', 'Other') || reason === 'Other') {
        finalReason = customReason.trim() ? `Other: ${customReason.trim()}` : 'Other';
      }

      const res = await hospitalApi.cancelAppointment(appointment.booking_id, finalReason);
      setSuccess(t('cancel_success', 'Appointment cancelled successfully.'));
      
      if (onSuccess) {
        await onSuccess(res);
      }

      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err) {
      console.error('Cancellation error:', err);
      const errMsg = err.response?.data?.error || err.message;
      if (err.response?.status === 409) {
        if (errMsg && errMsg.toLowerCase().includes('already')) {
          setError(t('already_cancelled', 'Appointment has already been cancelled.'));
        } else if (errMsg && (errMsg.toLowerCase().includes('started') || errMsg.toLowerCase().includes('completed'))) {
          setError(t('cancel_error_started', 'This appointment can no longer be cancelled because the consultation has started.'));
        } else {
          setError(errMsg);
        }
      } else {
        setError(errMsg || 'Unable to cancel the appointment. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setReason('');
    setCustomReason('');
    setError('');
    setSuccess('');
    onClose();
  };

  const slotInfo = appointment.consultation_slot?.display_time 
    || appointment.consultation_slot?.slot_name 
    || (appointment.slot_id === 'evening' ? 'Evening Slot (02:00 PM – 09:00 PM)' : 'Morning Slot (09:00 AM – 01:00 PM)');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 text-white p-6 relative">
          <button 
            onClick={handleClose}
            disabled={loading}
            className="absolute top-5 right-5 p-2 text-rose-100 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition disabled:opacity-40 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-200">
                {t('cancel_appointment', 'Cancel Appointment')}
              </span>
              <h3 className="text-xl font-extrabold text-white leading-tight">
                {t('cancel_modal_title', 'Cancel Appointment?')}
              </h3>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 space-y-5">
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            {t('cancel_modal_desc', 'Are you sure you want to cancel this appointment?')}
          </p>

          {/* Appointment Summary Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
              <span className="text-slate-400 font-bold uppercase text-[10px]">{t('booking_id', 'Booking ID')}</span>
              <span className="font-mono font-extrabold text-sky-700">{appointment.booking_id}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">{t('doctor', 'Doctor')}</span>
                <span className="font-bold text-slate-900 block truncate">
                  {appointment.doctor_name || appointment.doctor_id || 'Doctor'}
                </span>
                <span className="text-[11px] text-sky-600 font-semibold">{appointment.department}</span>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">{t('date', 'Date')}</span>
                <span className="font-bold text-slate-900 block">{appointment.consultation_date}</span>
                <span className="text-[11px] text-slate-500">{slotInfo}</span>
              </div>
            </div>

            {appointment.queue_id && (
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t('token', 'Active Token')}:</span>
                </span>
                <span className="font-mono font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {appointment.queue_id}
                </span>
              </div>
            )}
          </div>

          {/* Optional Reason Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              {t('cancel_reason_label', 'Reason for Cancellation (Optional)')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {reasonsList.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  disabled={loading}
                  onClick={() => setReason(r.label)}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                    reason === r.label
                      ? 'bg-rose-50 border-rose-400 text-rose-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {(reason === t('cancel_reason_other', 'Other') || reason === 'Other') && (
              <div className="pt-1">
                <input
                  type="text"
                  disabled={loading}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder={t('specify_reason', 'Please specify reason...')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                  maxLength={120}
                />
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2 animate-shake">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
            >
              {t('keep_appointment', 'Keep Appointment')}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleCancel}
              className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-extrabold rounded-xl text-xs transition shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('cancelling', 'Cancelling...')}</span>
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4" />
                  <span>{t('cancel_appointment', 'Cancel Appointment')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
