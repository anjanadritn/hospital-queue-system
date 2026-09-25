import React from 'react';
import { Link } from 'react-router-dom';
import {
  HeartPulse,
  GraduationCap,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Stethoscope,
  Activity,
  Cpu,
  Building2,
  Calendar,
  Clock,
  Sparkles,
  ExternalLink,
  Heart
} from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 pt-16 pb-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800/80">
          
          {/* Col 1 & 2: Project & College Branding */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-sky-500 to-teal-400 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                <HeartPulse className="w-6 h-6" />
              </div>
              <div>
                <span className="font-black text-xl text-white tracking-tight block">
                  SMART<span className="text-sky-400">HOSPITAL</span>
                </span>
                <span className="text-[11px] font-semibold text-slate-400 block -mt-0.5">
                  AI-Powered OPD Queue & Patient Care Platform
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              An intelligent healthcare management and virtual queue system designed to eradicate lobby overcrowding, dynamically predict consultation durations using Random Forest regression, and calculate smart departure times for outpatients in Tumkur.
            </p>

            {/* Academic Badge */}
            <div className="p-3.5 bg-slate-800/80 border border-slate-700/70 rounded-2xl max-w-sm space-y-1.5">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                <GraduationCap className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Final Year Major Project (2025–2026)</span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium">
                Shridevi Institute of Engineering & Technology (SIET)
              </div>
              <div className="text-[10px] text-slate-400">
                Affiliated to Visvesvaraya Technological University (VTU), Belagavi • Approved by AICTE, New Delhi
              </div>
            </div>
          </div>

          {/* Col 3: Patient Care Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-sky-400" />
              <span>{t('patient_services', 'Patient Services')}</span>
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/doctors" className="hover:text-sky-400 transition flex items-center gap-1.5">
                  {t('find_doctors', 'Find Doctors & Specialists')}
                </Link>
              </li>
              <li>
                <Link to="/book" className="hover:text-sky-400 transition flex items-center gap-1.5">
                  {t('book_consultation', 'Book In-Clinic Slot')}
                </Link>
              </li>
              <li>
                <Link to="/tracking" className="hover:text-sky-400 transition flex items-center gap-1.5">
                  {t('live_token', 'Live Queue Token Tracker')}
                </Link>
              </li>
              <li>
                <Link to="/departments" className="hover:text-sky-400 transition flex items-center gap-1.5">
                  {t('departments', 'Clinical OPD Departments')}
                </Link>
              </li>
              <li>
                <Link to="/patient" className="hover:text-sky-400 transition flex items-center gap-1.5">
                  {t('my_dashboard', 'Patient Health Dashboard')}
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-teal-300 transition flex items-center gap-1.5 font-medium text-teal-400">
                  {t('about_simsrh', 'About SIMSRH & Campus')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Platform & AI Features */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-teal-400" />
              <span>{t('smart_features', 'Smart Features')}</span>
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/predict" className="hover:text-teal-400 transition flex items-center gap-1.5">
                  {t('ai_simulator', 'AI Wait-Time Simulator')}
                </Link>
              </li>
              <li>
                <Link to="/tracking" className="hover:text-teal-400 transition flex items-center gap-1.5">
                  {t('when_to_leave', 'Smart Arrival & Departure')}
                </Link>
              </li>
              <li>
                <Link to="/doctor" className="hover:text-teal-400 transition flex items-center gap-1.5">
                  {t('doctor_workstation', 'Doctor OPD Workstation')}
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-teal-400 transition flex items-center gap-1.5">
                  {t('admin_management', 'Hospital Operations Portal')}
                </Link>
              </li>
              <li>
                <Link to="/analytics" className="hover:text-teal-400 transition flex items-center gap-1.5">
                  {t('queue_analytics', 'Queue Flow Analytics')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 5: Hospital Campus & Emergency */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>{t('about_simsrh', 'Target Hospital')}</span>
            </h4>
            <div className="text-xs space-y-2 text-slate-400">
              <p className="text-slate-200 font-bold leading-snug">
                {t('hospital_name', 'Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH)')}
              </p>
              <p className="text-[11px] leading-relaxed text-slate-400">
                {t('simsrh_location', 'Sira Road, NH4, Lingapura, Tumakuru, Karnataka – 572106')}
              </p>
              <div className="pt-1 space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2 text-rose-400 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('emergency_247', '24/7 Emergency Care')}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>{t('opd_live', 'OPD Consultations: Daily')}</span>
                </div>
                <div className="pt-2">
                  <a
                    href="https://shridevmedical.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-bold text-xs hover:underline"
                  >
                    <span>Visit shridevmedical.org</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div>
                  <Link
                    to="/about"
                    className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 font-bold text-xs"
                  >
                    <span>{t('about_simsrh', 'About SIMSRH Profile')} →</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Clinical Data NLM RxNorm Attribution Note */}
        <div className="pt-6 border-t border-slate-800/80 text-[11px] text-slate-400 text-center sm:text-left leading-relaxed">
          <p>
            This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.
          </p>
        </div>

        {/* Bottom Strip */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} {t('brand_title', 'SmartHospital Platform')}.</span>
            <span className="hidden sm:inline">•</span>
            <span>{t('academic_project_tag', 'Developed at Shridevi Institute of Engineering and Technology, Tumkur.')}</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 rounded-lg text-[10px] font-bold text-sky-300 border border-slate-700">
              Flask • MongoDB • React/Vite
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 rounded-lg text-[10px] font-bold text-teal-300 border border-slate-700">
              Random Forest ML Engine
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
}
