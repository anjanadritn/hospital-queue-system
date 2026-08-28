import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, AlertCircle, Loader2, User, Phone, Building2, Stethoscope, Ticket } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';

export default function QueueJoinModal({ doctor, isOpen, onClose, onSuccess }) {
  const navigate = useNavigate();

  const [patientId, setPatientId] = useState(`P${Math.floor(100 + Math.random() * 900)}`);
  const [patientName, setPatientName] = useState('Anjan');
  const [phone, setPhone] = useState('9876543210');
  const [priority, setPriority] = useState('normal');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [joinedResult, setJoinedResult] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        patient_id: patientId,
        name: patientName,
        phone: phone,
        doctor_id: doctor ? doctor.doctor_id : 'D001',
        department: doctor ? doctor.department : 'Cardiology',
        priority: priority
      };

      const res = await hospitalApi.joinQueue(payload);
      setJoinedResult(res);
      if (onSuccess) onSuccess(res);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to join queue. Please check Flask backend status.');
    } finally {
      setLoading(false);
    }
  };

  const handleTrackQueue = () => {
    if (joinedResult) {
      navigate(`/tracking?queue_id=${joinedResult.queue_id}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200">
        
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {!joinedResult ? (
          <div>
            <div className="mb-6">
              <div className="w-12 h-12 bg-sky-100 rounded-2xl flex items-center justify-center text-sky-600 mb-3">
                <Ticket className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Join Hospital Queue</h2>
              <p className="text-xs text-slate-500">
                Book your instant live token for {doctor ? doctor.name : 'Cardiology Department'}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Patient ID</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                    placeholder="e.g. P001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Patient Name</label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  placeholder="Enter full name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Doctor</label>
                  <input
                    type="text"
                    readOnly
                    value={doctor ? doctor.name : 'Dr. Smith'}
                    className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    readOnly
                    value={doctor ? doctor.department : 'Cardiology'}
                    className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Queue Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                >
                  <option value="normal">Normal Priority</option>
                  <option value="emergency">Emergency Priority</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md mt-6"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Request Queue Token'}
              </button>
            </form>
          </div>
        ) : (
          /* SUCCESS RESPONSE VIEW */
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-4 shadow-sm animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 mb-1">Queue Token Generated!</h3>
            <p className="text-xs text-slate-500 mb-6">Your position has been calculated by the Flask Backend</p>

            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-6 mb-6">
              <span className="text-[11px] uppercase font-bold text-sky-600 tracking-wider block mb-1">
                Queue ID
              </span>
              <div className="text-4xl font-extrabold text-sky-900 mb-4 font-mono tracking-tight">
                {joinedResult.queue_id}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-sky-200/60 pt-4 text-left">
                <div>
                  <span className="text-[10px] text-sky-600 font-semibold block">Current Position</span>
                  <span className="text-xl font-bold text-slate-900">#{joinedResult.position}</span>
                </div>
                <div>
                  <span className="text-[10px] text-sky-600 font-semibold block">AI Estimated Wait</span>
                  <span className="text-xl font-bold text-emerald-600">~{joinedResult.predicted_wait_time || 15} mins</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleTrackQueue}
                className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                Track Live Queue Status
              </button>
              <button
                onClick={onClose}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
