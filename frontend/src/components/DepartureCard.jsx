import React from 'react';
import { Navigation, Clock, ShieldCheck, MapPin, AlertCircle } from 'lucide-react';

export default function DepartureCard({ travelInfo }) {
  if (!travelInfo) return null;

  return (
    <div className="bg-gradient-to-r from-sky-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-sky-800">
      
      {/* Header Banner */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-500/20 rounded-xl flex items-center justify-center text-sky-400 border border-sky-400/30">
            <Navigation className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white tracking-tight">Smart Departure Assistant</h3>
            <p className="text-[11px] text-sky-300 font-medium">Optimized to eliminate hospital wait times</p>
          </div>
        </div>

        <span className="px-3 py-1 bg-teal-500/20 text-teal-300 rounded-full text-[10px] font-bold border border-teal-400/30">
          TRAVEL MODE ACTIVE
        </span>
      </div>

      {/* Main Departure Highlight */}
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/10 text-center">
        <span className="text-[11px] font-bold text-sky-300 uppercase tracking-widest block mb-1">
          Recommended Departure Time
        </span>
        <div className="text-4xl sm:text-5xl font-extrabold text-white font-mono tracking-tight mb-2">
          {travelInfo.recommended_departure_time || '10:47 AM'}
        </div>
        <p className="text-xs text-slate-300 font-medium">
          {travelInfo.departure_alert || "🚗 Leave home around 10:47 AM to arrive before your consultation."}
        </p>
      </div>

      {/* Grid Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <span className="text-[10px] text-slate-400 block font-semibold">Distance</span>
          <span className="text-lg font-bold text-white">{travelInfo.distance_km || 6.4} km</span>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <span className="text-[10px] text-slate-400 block font-semibold">Travel Time</span>
          <span className="text-lg font-bold text-sky-300">{travelInfo.travel_time_min || 18} mins</span>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <span className="text-[10px] text-slate-400 block font-semibold">Safety Buffer</span>
          <span className="text-lg font-bold text-teal-300">+{travelInfo.safety_buffer_min || 10} mins</span>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <span className="text-[10px] text-slate-400 block font-semibold">Consultation</span>
          <span className="text-lg font-bold text-white">{travelInfo.expected_consultation_time || '11:15 AM'}</span>
        </div>
      </div>

    </div>
  );
}
