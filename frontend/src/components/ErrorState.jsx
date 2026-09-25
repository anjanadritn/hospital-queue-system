import React from 'react';
import { AlertCircle, RefreshCw, ServerCrash, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

import { formatErrorMessage } from '../utils/errorUtils';

export default function ErrorState({
  title,
  message,
  onRetry,
  backLink = '/doctors',
  backText
}) {
  const { t } = useLanguage();
  const displayTitle = title || t('service_notice', 'Service Communication Notice');
  const fallbackMsg = t('service_error_msg', 'Unable to synchronize with the healthcare queue server. Please verify network connectivity.');
  const displayMessage = formatErrorMessage(message, fallbackMsg);
  const displayBackText = backText || t('return_to_specialists', 'Return to Specialists Directory');

  return (
    <div className="bg-white rounded-3xl p-8 border border-red-100 shadow-sm max-w-lg mx-auto my-8 text-center relative overflow-hidden">
      {/* Red accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 to-rose-600" />
      
      <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-xs">
        <AlertCircle className="w-7 h-7" />
      </div>

      <h3 className="text-base font-extrabold text-slate-900 mb-1.5">{displayTitle}</h3>
      <p className="text-xs text-slate-500 leading-relaxed mb-6 max-w-sm mx-auto">
        {displayMessage}
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full sm:w-auto px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('retry_connection', 'Retry Connection')}</span>
          </button>
        )}
        {backLink && (
          <Link
            to={backLink}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{displayBackText}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
