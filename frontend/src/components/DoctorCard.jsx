import React from 'react';
import { Clock, ArrowRight, Stethoscope, Lock } from 'lucide-react';
import Tooltip from './Tooltip';

export default function DoctorCard({ doctor, onJoinQueue, isAuthenticated }) {
  const tooltipText = !isAuthenticated
    ? "Login required to join the queue"
    : "Join this doctor's queue and receive your queue token";

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 border border-sky-100 group-hover:scale-105 transition">
            <Stethoscope className="w-6 h-6" />
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              doctor.available ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${doctor.available ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {doctor.available ? 'Available Today' : 'Unavailable'}
          </span>
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-sky-600 transition">
          {doctor.name}
        </h3>
        <p className="text-xs font-medium text-sky-700 bg-sky-50 inline-block px-2.5 py-0.5 rounded-lg mb-4">
          {doctor.department}
        </p>

        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 border-t border-slate-100 pt-3 mb-4">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Avg {doctor.avg_consultation_time || 10} mins / patient</span>
          </div>
        </div>
      </div>

      <Tooltip text={tooltipText} position="top">
        <button
          onClick={() => onJoinQueue(doctor)}
          disabled={!doctor.available}
          className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
        >
          {!isAuthenticated && <Lock className="w-3.5 h-3.5" />}
          <span>Join Queue</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </Tooltip>
    </div>
  );
}
