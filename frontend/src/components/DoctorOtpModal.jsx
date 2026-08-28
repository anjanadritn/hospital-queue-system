import React, { useState } from 'react';
import { KeyRound, X, CheckCircle2, AlertTriangle, Loader2, ShieldCheck, User } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';

export default function DoctorOtpModal({ patientData, isOpen, onClose, onSuccess }) {
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !patientData) return null;

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification OTP provided by patient');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await hospitalApi.verifyConsultationOtp(patientData.queue_id || patientData.booking_id, otpCode.trim());
      if (res.verified) {
        if (onSuccess) onSuccess(res);
        onClose();
      } else {
        setError(res.error || 'Verification failed');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Invalid or expired consultation OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200">
        
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Patient Verification Required</h2>
          <p className="text-xs text-slate-500 mt-1">
            Verify patient presence before starting consultation
          </p>
        </div>

        {/* Patient Summary */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 mb-6 text-xs grid grid-cols-2 gap-3 text-left">
          <div>
            <span className="text-slate-400 block font-semibold">Patient Name</span>
            <span className="font-bold text-slate-900">{patientData.name || patientData.patient_id || 'Anjan'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-semibold">Token ID</span>
            <span className="font-mono font-bold text-sky-700">{patientData.queue_id || patientData.booking_id}</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
              Enter 6-Digit Consultation OTP
            </label>
            <input
              type="text"
              maxLength={6}
              required
              autoFocus
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="583214"
              className="w-full text-center py-3 text-2xl font-mono font-extrabold tracking-[0.3em] bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 focus:bg-white focus:border-sky-600 focus:outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Start Consultation'}
          </button>
        </form>

      </div>
    </div>
  );
}
