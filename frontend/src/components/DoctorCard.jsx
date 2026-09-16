import React from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  ArrowRight,
  Stethoscope,
  Lock,
  MapPin,
  Star,
  ShieldCheck,
  Cpu,
  Calendar,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import Tooltip from './Tooltip';

export default function DoctorCard({ doctor, onJoinQueue, isAuthenticated }) {
  const tooltipText = !isAuthenticated
    ? "Login required to join this doctor's queue"
    : `Join Dr. ${doctor.name}'s OPD queue`;

  const initials = doctor.name
    ? doctor.name.replace('Dr. ', '').split(' ').map((n) => n[0]).join('').slice(0, 2)
    : 'DR';

  const rating = doctor.rating || 4.9;
  const reviewsCount = doctor.reviews_count || 148;
  const fee = doctor.fee || 400;

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-sky-200 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
      
      {/* Top Accent Gradient Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div>
        {/* Top: Avatar, Department Badge & Availability */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 via-teal-600 to-teal-500 flex items-center justify-center text-white font-black text-base shadow-md shadow-sky-600/20 group-hover:scale-105 transition-transform duration-200">
                {initials}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full shadow-xs">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px] font-extrabold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                  {doctor.department}
                </span>
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                  Verified
                </span>
              </div>
              {/* Star Rating & Patient Stories (Practo signature) */}
              <div className="flex items-center gap-1.5 text-xs">
                <div className="flex items-center gap-1 text-amber-500 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{rating}</span>
                </div>
                <span className="text-slate-300">•</span>
                <span className="text-[11px] font-medium text-slate-500 hover:text-sky-600 transition">
                  {reviewsCount} patient stories
                </span>
              </div>
            </div>
          </div>

          {/* Status Indicator */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
              doctor.available
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${doctor.available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {doctor.available ? 'In Clinic Today' : 'Away'}
          </span>
        </div>

        {/* Doctor Name & Qualifications */}
        <Link
          to={`/doctors/${doctor.doctor_id}`}
          className="text-lg font-black text-slate-900 group-hover:text-sky-600 transition-colors block mb-0.5 leading-snug"
        >
          {doctor.name}
        </Link>
        <p className="text-xs text-sky-700 font-semibold mb-1">
          {doctor.qualifications || 'MBBS, MD'}
        </p>
        <p className="text-xs text-slate-500 font-medium mb-4 line-clamp-1">
          {doctor.specialization || 'Clinical Specialist'}
        </p>

        {/* Practo-style Highlight Badges & Info */}
        <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 space-y-2 mb-4 text-xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Experience:</span>
            <span className="font-bold text-slate-800">{doctor.experience || '8+ years'} practice</span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>Location:</span>
            </span>
            <span className="font-bold text-slate-800">SIMSRH Tumakuru, {doctor.consultation_room || 'OPD'}</span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Consultation Fee:</span>
            <span className="font-extrabold text-emerald-700">₹{fee} <span className="text-[10px] font-normal text-slate-400">at clinic</span></span>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Cpu className="w-3 h-3 text-purple-500" />
              <span>AI Wait Window:</span>
            </span>
            <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
              ~{doctor.avg_consultation_duration || 14} min/patient
            </span>
          </div>
        </div>

      </div>

      {/* Card Bottom Actions */}
      <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
        <Link
          to={`/book?doctorId=${doctor.doctor_id}&dept=${encodeURIComponent(doctor.department || '')}`}
          className="flex-1 py-2.5 px-3 bg-white hover:bg-slate-50 text-sky-700 hover:text-sky-800 rounded-xl text-xs font-bold transition text-center border border-sky-200 shadow-2xs hover:shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5 text-sky-600" />
          <span>Book Slot</span>
        </Link>

        <Tooltip text={tooltipText} position="top">
          <button
            onClick={() => onJoinQueue(doctor)}
            disabled={!doctor.available}
            className="flex-1 py-2.5 px-3 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-sky-600/20 hover:shadow-md cursor-pointer disabled:cursor-not-allowed"
          >
            {!isAuthenticated && <Lock className="w-3.5 h-3.5" />}
            <span>Join Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>

    </div>
  );
}
