import React, { useState, useEffect } from 'react';
import { KeyRound, Clock, RefreshCw, DoorOpen, CheckCircle2, ShieldCheck } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';

export default function ConsultationOtpCard({ bookingId, queueData }) {
  const [otpData, setOtpData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(300);

  const fetchOtp = async () => {
    setLoading(true);
    try {
      let res = await hospitalApi.getOtpStatus(bookingId);
      if (!res.active && res.status !== 'VERIFIED') {
        res = await hospitalApi.generateConsultationOtp(bookingId, queueData?.patient_id || 'P001', queueData?.doctor_id || 'D001');
      }
      setOtpData(res);
      if (res.remaining_seconds) {
        setTimeLeft(res.remaining_seconds);
      }
    } catch (err) {
      console.warn('Could not fetch OTP:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookingId) {
      fetchOtp();
    }
  }, [bookingId]);

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!bookingId) return null;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-sky-500/30 relative overflow-hidden">
      
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-400/30">
            <ShieldCheck className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white tracking-tight">CONSULTATION READY</h3>
            <p className="text-[11px] text-sky-300 font-medium">Identity & Presence Verification</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-400/30">
          <Clock className="w-3.5 h-3.5" />
          <span>Expires in {formatTimer(timeLeft)}</span>
        </div>
      </div>

      {/* Doctor & Room Summary */}
      <div className="grid grid-cols-2 gap-4 text-xs bg-white/5 p-4 rounded-2xl border border-white/10 mb-6">
        <div>
          <span className="text-slate-400 block font-medium">Assigned Doctor</span>
          <span className="font-bold text-white text-sm">{queueData?.doctor_id || 'Dr. Ananya Sharma'}</span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Consultation Room</span>
          <span className="font-bold text-emerald-400 text-sm flex items-center gap-1">
            <DoorOpen className="w-4 h-4" /> {queueData?.room_number || 'Room 204'}
          </span>
        </div>
      </div>

      {/* 6-DIGIT OTP DISPLAY */}
      <div className="bg-slate-950/80 rounded-2xl p-6 text-center border border-sky-500/20 mb-6 shadow-inner">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-400 block mb-2">
          Your Verification OTP
        </span>

        {loading ? (
          <div className="text-xl font-mono text-slate-400 py-2 animate-pulse">Generating OTP...</div>
        ) : otpData && otpData.otp ? (
          <div className="text-4xl sm:text-5xl font-extrabold font-mono text-emerald-400 tracking-[0.2em] my-1">
            {otpData.otp}
          </div>
        ) : (
          <div className="text-sm text-rose-400 py-2">
            OTP Expired or Invalid. Click below to regenerate.
          </div>
        )}

        <p className="text-[11px] text-slate-300 mt-3 font-medium">
          🔒 Please provide this 6-digit OTP code to your doctor to verify your presence and start your consultation.
        </p>
      </div>

      {/* Regenerate Action */}
      {(timeLeft === 0 || !otpData?.active) && (
        <button
          onClick={fetchOtp}
          className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md"
        >
          <RefreshCw className="w-4 h-4" /> Regenerate Consultation Verification OTP
        </button>
      )}

    </div>
  );
}
