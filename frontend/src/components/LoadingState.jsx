import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingState({ message = 'Connecting to Smart Hospital System...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
      <Loader2 className="w-10 h-10 text-sky-600 animate-spin mb-4" />
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}
