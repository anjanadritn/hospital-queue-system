import React from 'react';
import { AlertCircle, Clock, CheckCircle2, UserCheck } from 'lucide-react';

export default function StatusBadge({ status, type = 'status' }) {
  const normalized = String(status || '').toLowerCase();

  if (type === 'priority') {
    if (normalized === 'emergency') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
          <AlertCircle className="w-3.5 h-3.5" />
          EMERGENCY
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        NORMAL
      </span>
    );
  }

  // Queue Status
  switch (normalized) {
    case 'waiting':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock className="w-3.5 h-3.5" />
          Waiting
        </span>
      );
    case 'called':
    case 'in_consultation':
    case 'in progress':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
          <UserCheck className="w-3.5 h-3.5" />
          In Progress
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Completed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          {status}
        </span>
      );
  }
}
