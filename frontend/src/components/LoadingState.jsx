import React from 'react';
import { HeartPulse, Loader2 } from 'lucide-react';

export default function LoadingState({
  message = 'Loading hospital clinical records...',
  type = 'spinner', // 'spinner' | 'cards' | 'table'
  count = 3
}) {
  if (type === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="bg-white rounded-3xl p-6 border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 skeleton rounded-2xl" />
              <div className="w-20 h-5 skeleton rounded-full" />
            </div>
            <div className="w-3/4 h-5 skeleton rounded-lg" />
            <div className="w-1/2 h-4 skeleton rounded-lg" />
            <div className="pt-4 border-t border-slate-100 flex justify-between">
              <div className="w-24 h-4 skeleton rounded" />
              <div className="w-16 h-4 skeleton rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 space-y-3 animate-pulse">
        <div className="w-1/3 h-5 skeleton rounded mb-4" />
        {[...Array(count)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-100">
            <div className="w-16 h-4 skeleton rounded" />
            <div className="w-1/4 h-4 skeleton rounded" />
            <div className="w-1/5 h-4 skeleton rounded" />
            <div className="w-16 h-5 skeleton rounded-full ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center min-h-[280px]">
      <div className="relative mb-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500/10 to-teal-500/10 border border-sky-200/60 flex items-center justify-center text-sky-600">
          <HeartPulse className="w-7 h-7 animate-pulse text-sky-600" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-teal-500 animate-ping opacity-75" />
      </div>
      <h4 className="text-sm font-bold text-slate-800 tracking-tight mb-1">
        Synchronizing with SmartHospital Engine
      </h4>
      <p className="text-xs text-slate-400 max-w-xs">{message}</p>
    </div>
  );
}
