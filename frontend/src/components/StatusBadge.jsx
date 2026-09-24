import React from 'react';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  UserCheck,
  Cpu,
  Sparkles,
  XCircle,
  Hourglass,
  Activity,
  UserX
} from 'lucide-react';

/**
 * Enterprise Healthcare Status Badge System
 * - Blue/Teal: In Progress, Calling, Primary active states
 * - Green: Success, Available, Completed, Verified
 * - Red: Emergency, Critical, Escalated, Error
 * - Orange/Yellow: Waiting, Delayed, Warning
 * - Purple: AI/ML Predicted, Algorithmic Optimization
 * - Gray: Inactive, Cancelled, No-Show, Off-Duty
 */
import { useLanguage } from '../context/LanguageContext';

export default function StatusBadge({ status, type = 'status', size = 'sm' }) {
  const { t } = useLanguage();
  const raw = String(status || '').trim();
  const normalized = raw.toLowerCase().replace(/[-_]/g, ' ');

  const sizeClasses = size === 'xs'
    ? 'text-[10px] px-2 py-0.5 gap-1'
    : size === 'lg'
      ? 'text-xs px-3.5 py-1.5 gap-2'
      : 'text-[11px] px-2.5 py-1 gap-1.5';

  // Priority Mode
  if (type === 'priority' || normalized === 'emergency' || normalized === 'normal') {
    if (normalized === 'emergency') {
      return (
        <span className={`inline-flex items-center font-bold rounded-full bg-red-50 text-red-700 border border-red-200/80 pulse-emergency tracking-wide ${sizeClasses}`}>
          <AlertCircle className="w-3 h-3 text-red-600 animate-pulse shrink-0" />
          <span>{t('emergency')}</span>
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200 tracking-wide ${sizeClasses}`}>
        <span>{t('normal')}</span>
      </span>
    );
  }

  // AI / ML Feature Badge
  if (normalized.includes('ai') || normalized.includes('ml') || normalized.includes('predicted')) {
    return (
      <span className={`inline-flex items-center font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 tracking-wide ${sizeClasses}`}>
        <Cpu className="w-3 h-3 text-purple-600 shrink-0" />
        <span className="capitalize">{raw}</span>
      </span>
    );
  }

  // Red: Critical, Error, High Severity
  if (normalized === 'critical' || normalized === 'failed' || normalized === 'error' || normalized === 'high risk') {
    return (
      <span className={`inline-flex items-center font-bold rounded-full bg-red-50 text-red-700 border border-red-200 tracking-wide ${sizeClasses}`}>
        <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
        <span className="capitalize">{raw}</span>
      </span>
    );
  }

  // Orange / Yellow: Waiting, Delayed, Pending
  if (normalized === 'waiting' || normalized === 'pending' || normalized === 'delayed' || normalized === 'arrived') {
    return (
      <span className={`inline-flex items-center font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200/90 tracking-wide ${sizeClasses}`}>
        <Clock className="w-3 h-3 text-amber-600 shrink-0" />
        <span>{normalized === 'waiting' ? t('waiting') : raw === 'arrived' ? t('arrived_verified') : raw}</span>
      </span>
    );
  }

  // Amber / Orange: Missed Consultation
  if (normalized === 'missed' || normalized === 'missed consultation' || normalized === 'skipped') {
    return (
      <span className={`inline-flex items-center font-bold rounded-full bg-amber-100/90 text-amber-900 border border-amber-300 tracking-wide ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        <Clock className="w-3 h-3 text-amber-700 shrink-0" />
        <span>{t('missed')}</span>
      </span>
    );
  }

  // Blue / Teal: In Progress, Called, In Consultation
  if (normalized === 'called' || normalized === 'in consultation' || normalized === 'in progress' || normalized === 'consulting') {
    const isCalled = normalized === 'called';
    return (
      <span className={`inline-flex items-center font-bold rounded-full ${
        isCalled ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
      } tracking-wide ${sizeClasses}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isCalled ? 'bg-sky-500 animate-pulse' : 'bg-emerald-500 animate-pulse'} shrink-0`} />
        <Activity className={`w-3 h-3 ${isCalled ? 'text-sky-600' : 'text-emerald-600'} shrink-0`} />
        <span>{isCalled ? t('called') : t('in_consultation')}</span>
      </span>
    );
  }

  // Green: Completed, Available, Verified, Healthy
  if (normalized === 'completed' || normalized === 'available' || normalized === 'verified' || normalized === 'ready' || normalized === 'active') {
    return (
      <span className={`inline-flex items-center font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/90 tracking-wide ${sizeClasses}`}>
        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
        <span>{normalized === 'completed' ? t('completed') : normalized === 'verified' ? t('verified') : raw}</span>
      </span>
    );
  }

  // Gray: Cancelled, No-Show, Inactive, Off-Duty
  if (normalized === 'cancelled' || normalized === 'no show' || normalized === 'inactive' || normalized === 'off duty' || normalized === 'unavailable') {
    return (
      <span className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200 tracking-wide ${sizeClasses}`}>
        <UserX className="w-3 h-3 text-slate-400 shrink-0" />
        <span className="capitalize">{raw}</span>
      </span>
    );
  }

  // Neutral Fallback
  return (
    <span className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
      <span className="capitalize">{raw}</span>
    </span>
  );
}
