import React from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Clock,
  Phone,
  ExternalLink,
  ShieldCheck,
  HeartPulse,
  Navigation,
  CheckCircle2,
  Stethoscope,
  Activity,
  GraduationCap,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';

export default function AboutHospital() {
  const { t } = useLanguage();
  const hospitalName = t('hospital_name', "Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH)");
  const hospitalLocation = t('simsrh_location', "Sira Road, NH4, Lingapura, Tumakuru, Karnataka – 572106");
  const hospitalWebsite = "https://shridevmedical.org/";
  const mapsUrl = "https://maps.google.com/?q=Shridevi+Institute+of+Medical+Sciences+and+Research+Hospital+Tumakuru";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-sky-100 selection:text-sky-900">
      
      {/* 1. HERO BANNER */}
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-50 via-teal-50/40 to-white pt-12 pb-16 lg:pt-16 lg:pb-20 border-b border-slate-200/70">
        
        {/* Ambient background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-10 -right-20 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            
            {/* Institution Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-sky-200 text-sky-800 text-xs font-bold mb-6 shadow-sm">
              <Building2 className="w-4 h-4 text-sky-600" />
              <span>Teaching Hospital & Healthcare Institution</span>
            </div>

            {/* Hospital Full Title */}
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight mb-4">
              {hospitalName}
            </h1>

            {/* Subtitle / Location pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100/90 text-slate-700 text-xs font-bold rounded-full mb-6 border border-slate-200">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>{hospitalLocation}</span>
            </div>

            <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto mb-8">
              A premier medical institution and research hospital committed to providing accessible, high-quality medical services and advanced clinical care to the community in Tumakuru and neighboring regions.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={hospitalWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white font-extrabold rounded-2xl text-xs transition-all shadow-lg shadow-sky-600/20 hover:-translate-y-0.5 inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Visit Official Website</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-2xl text-xs transition-all border border-slate-200 hover:border-sky-300 shadow-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5 text-sky-600" />
                <span>Get Directions (Google Maps)</span>
              </a>

              <Link
                to="/doctors"
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <Stethoscope className="w-3.5 h-3.5 text-teal-400" />
                <span>Find Doctors & Queue</span>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* 2. KEY HOSPITAL HIGHLIGHTS (Strictly accurate information) */}
      <section className="py-12 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: 24/7 Emergency Care */}
            <div className="bg-gradient-to-br from-rose-50 to-orange-50/40 rounded-3xl p-6 border-2 border-rose-200 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center mb-4 shadow-md shadow-rose-600/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-600 text-white mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                <span>Round-the-Clock Service</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">24/7 Emergency Care</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                The hospital provides dedicated 24/7 emergency medical care, casualty management, and round-the-clock clinical triage for trauma and critical health events.
              </p>
              <div className="pt-3 border-t border-rose-200/60 flex items-center gap-2 text-rose-700 font-extrabold text-xs">
                <Phone className="w-3.5 h-3.5" />
                <span>Emergency Casualty: 24 Hours Available</span>
              </div>
            </div>

            {/* Card 2: Campus & Location */}
            <div className="bg-gradient-to-br from-sky-50 to-teal-50/40 rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center mb-4 shadow-md shadow-sky-600/20">
                <MapPin className="w-6 h-6" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 mb-2">
                Tumakuru, Karnataka
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">Location & Campus</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Located on the National Highway 4 (NH4) on Sira Road at Lingapura, Tumakuru. Strategically accessible from all regions of Tumakuru district and surrounding rural communities.
              </p>
              <div className="pt-3 border-t border-sky-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500">PIN: 572106</span>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1"
                >
                  <span>Open Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Card 3: Institutional Teaching & Research */}
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50/40 rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center mb-4 shadow-md shadow-teal-600/20">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 mb-2">
                Medical Science & Research
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">Academic Medical Center</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                A teaching and research hospital fostering medical education, clinical excellence, diagnostic laboratories, and patient-centered treatment across medical specialities.
              </p>
              <div className="pt-3 border-t border-teal-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500">Official Portal</span>
                <a
                  href={hospitalWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
                >
                  <span>shridevmedical.org</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 3. DETAILED ABOUT SECTION & INTRODUCTION */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6">
              
              <div>
                <span className="text-xs font-extrabold text-sky-600 uppercase tracking-widest block mb-2">
                  Institutional Profile
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  About Shridevi Institute of Medical Sciences and Research Hospital
                </h2>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
                <p>
                  <strong>Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH)</strong> is an esteemed medical institution and multispecialty healthcare center situated in Tumakuru, Karnataka. Established with the vision of bridging healthcare accessibility and medical education, SIMSRH caters to patients from Tumakuru district as well as neighboring rural and semi-urban localities.
                </p>
                <p>
                  The institution encompasses modern outpatient consultation wings, inpatient wards, intensive care units, and well-equipped diagnostic facilities. The hospital functions with a focus on ethical healthcare delivery, compassionate bedside attention, and structured medical services.
                </p>
                <p>
                  With round-the-clock emergency medical services, SIMSRH ensures that critical trauma, emergency medical cases, and maternal care are promptly managed at any hour of the day.
                </p>
              </div>

              {/* Factual Highlights List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-extrabold text-slate-900 block">24/7 Emergency Care</span>
                    <span className="text-slate-500">Continuous emergency and casualty services</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-extrabold text-slate-900 block">Multispeciality OPD</span>
                    <span className="text-slate-500">Regular outpatient clinical consultations</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-extrabold text-slate-900 block">Highway Accessibility</span>
                    <span className="text-slate-500">Convenient location on NH4 Sira Road</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-extrabold text-slate-900 block">Medical Teaching Facility</span>
                    <span className="text-slate-500">Training doctors, specialists, and nurses</span>
                  </div>
                </div>
              </div>

              {/* External Website Direct Box */}
              <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-extrabold text-xs text-sky-950">Official Institutional Website</h4>
                  <p className="text-[11px] text-sky-700">For academic admissions, institution administration, and official hospital circulars:</p>
                </div>
                <a
                  href={hospitalWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                >
                  <span>Visit shridevmedical.org</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

            </div>

            {/* Right Card Column: Contact, Location & Directions */}
            <div className="lg:col-span-5 space-y-6">
              
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
                
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-black">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Hospital Address & Contact</h3>
                    <p className="text-[11px] text-slate-500">Tumakuru Campus</p>
                  </div>
                </div>

                {/* Address Info */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Full Postal Address
                  </span>
                  <p className="text-xs font-bold text-slate-800 leading-relaxed">
                    Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH)
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Sira Road, NH4, Lingapura,<br />
                    Tumakuru, Karnataka – 572106
                  </p>
                </div>

                {/* Emergency Details */}
                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2 text-rose-700 font-extrabold text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>24/7 Emergency Care</span>
                  </div>
                  <p className="text-[11px] text-rose-600">
                    Casualty department open 24 hours a day, 365 days a year.
                  </p>
                </div>

                {/* Website Link */}
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Official Website
                  </span>
                  <div>
                    <a
                      href={hospitalWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline inline-flex items-center gap-1"
                    >
                      <span>https://shridevmedical.org/</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Get Directions CTA */}
                <div className="pt-2">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-xl text-xs font-extrabold transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Get Directions via Google Maps</span>
                  </a>
                </div>

              </div>

              {/* Academic Connection Card */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sky-400 text-xs font-bold">
                  <GraduationCap className="w-4 h-4" />
                  <span>Academic Engineering Innovation</span>
                </div>
                <h4 className="font-black text-sm text-white">
                  SmartHospital Platform Collaboration
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  This intelligent OPD queue tracking and consultation system was developed as a final-year engineering project at <strong>Shridevi Institute of Engineering and Technology (SIET), Tumkur</strong>, designed to streamline outpatient flow and reduce waiting room crowding at SIMSRH.
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <Link
                    to="/predict"
                    className="text-xs font-bold text-teal-400 hover:text-teal-300 inline-flex items-center gap-1"
                  >
                    <span>Try AI Wait Predictor</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* NLM RxNorm Clinical Data Attribution Card */}
              <div className="bg-sky-950/40 text-slate-200 rounded-3xl p-6 border border-sky-800/40 space-y-3">
                <div className="flex items-center gap-2 text-sky-400 text-xs font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>Clinical Terminology & Data Attribution</span>
                </div>
                <h4 className="font-black text-sm text-white">
                  U.S. National Library of Medicine (NLM) RxNorm
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.
                </p>
                <div className="pt-1 flex items-center gap-2 text-[11px] text-sky-300">
                  <span className="px-2.5 py-1 bg-sky-900/60 rounded-lg border border-sky-700/50 font-mono text-[10px]">
                    Prescribable RxNorm Terminology API
                  </span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 4. FAST-TRACK OPD QUEUE CTA BANNER */}
      <section className="py-12 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                Visiting SIMSRH for Outpatient Consultation?
              </h3>
              <p className="text-xs sm:text-sm text-sky-100 max-w-xl">
                Avoid crowded waiting rooms. Book consultation slots online, track your live OPD token, and arrive right when the doctor is ready.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
              <Link
                to="/doctors"
                className="px-6 py-3 bg-white text-slate-900 hover:bg-slate-50 rounded-xl text-xs font-black transition shadow-md"
              >
                {t('find_doctors', 'Find Specialists')}
              </Link>
              <Link
                to="/tracking"
                className="px-6 py-3 bg-slate-900/40 hover:bg-slate-900/60 text-white rounded-xl text-xs font-bold border border-white/30 transition shadow-md"
              >
                {t('live_token', 'Track Live Token')}
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
