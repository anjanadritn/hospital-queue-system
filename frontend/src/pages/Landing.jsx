import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Stethoscope,
  Activity,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Cpu,
  Heart,
  Baby,
  Brain,
  Eye,
  Wind,
  Ear,
  Bone,
  Flame,
  Star,
  ShieldCheck,
  ChevronRight,
  HeartPulse,
  Users,
  Search,
  Building2,
  GraduationCap,
  Car,
  Calendar,
  AlertTriangle,
  QrCode,
  MapPin,
  Lock,
  ExternalLink,
  Navigation
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useLanguage } from '../context/LanguageContext';

const DEPARTMENT_METADATA = {
  'Cardiology': { icon: Heart, color: 'text-rose-600 bg-rose-50 border-rose-100', description: 'Specialized heart care, ECG, diagnostic evaluations & advanced cardiac monitoring.', room: 'Room 204' },
  'General Medicine': { icon: Stethoscope, color: 'text-sky-600 bg-sky-50 border-sky-100', description: 'Comprehensive primary healthcare, chronic condition management & preventive screenings.', room: 'Room 101' },
  'Orthopedics': { icon: Bone, color: 'text-amber-600 bg-amber-50 border-amber-100', description: 'Joint replacement, bone fractures, spine alignment & sports injury rehabilitation.', room: 'Room 305' },
  'Pediatrics': { icon: Baby, color: 'text-teal-600 bg-teal-50 border-teal-100', description: 'Compassionate infant & child wellness, vaccinations & developmental care.', room: 'Room 108' },
  'Dermatology': { icon: Sparkles, color: 'text-purple-600 bg-purple-50 border-purple-100', description: 'Clinical skincare, allergy diagnosis, laser therapies & dermatological treatments.', room: 'Room 212' },
  'Neurology': { icon: Brain, color: 'text-indigo-600 bg-indigo-50 border-indigo-100', description: 'Brain & nervous system disorders, epilepsy management, migraines & stroke therapy.', room: 'Room 402' },
  'ENT': { icon: Ear, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', description: 'Ear, nose & throat diagnostics, sinus treatments, voice care & hearing assessments.', room: 'Room 115' },
  'Gastroenterology': { icon: Flame, color: 'text-orange-600 bg-orange-50 border-orange-100', description: 'Digestive system, liver care, endoscopy evaluations & abdominal health.', room: 'Room 310' },
  'Pulmonology': { icon: Wind, color: 'text-cyan-600 bg-cyan-50 border-cyan-100', description: 'Respiratory therapy, asthma care, pulmonary function testing & sleep medicine.', room: 'Room 201' },
  'Ophthalmology': { icon: Eye, color: 'text-blue-600 bg-blue-50 border-blue-100', description: 'Comprehensive vision tests, cornea & retina care, cataract care & glaucoma management.', room: 'Room 250' }
};

const COMMON_CONCERNS = [
  { label: 'Chest Pain / Palpitation', dept: 'Cardiology', icon: Heart, color: 'text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200' },
  { label: 'Fever & Cold', dept: 'General Medicine', icon: Stethoscope, color: 'text-sky-600 bg-sky-50 hover:bg-sky-100 border-sky-200' },
  { label: 'Knee & Joint Pain', dept: 'Orthopedics', icon: Bone, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200' },
  { label: 'Child Cough / Fever', dept: 'Pediatrics', icon: Baby, color: 'text-teal-600 bg-teal-50 hover:bg-teal-100 border-teal-200' },
  { label: 'Skin Rash & Acne', dept: 'Dermatology', icon: Sparkles, color: 'text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-200' },
  { label: 'Severe Headache / Migraine', dept: 'Neurology', icon: Brain, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-200' },
  { label: 'Ear Pain / Throat Infection', dept: 'ENT', icon: Ear, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' },
  { label: 'Stomach Ache & Acidity', dept: 'Gastroenterology', icon: Flame, color: 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-200' }
];

const TESTIMONIALS = [
  {
    id: 1,
    name: 'Arjun Mehta',
    role: 'Cardiology Outpatient • Tumkur',
    rating: 5,
    quote: 'Instead of waiting for two hours in a packed hospital lobby, I booked my token from home, tracked the live queue on my phone, and walked into Room 204 right when my turn arrived.',
    initials: 'AM',
    accent: 'bg-sky-100 text-sky-700'
  },
  {
    id: 2,
    name: 'Pooja Sharma',
    role: 'Pediatrics Consultation • Batawadi',
    rating: 5,
    quote: 'When my toddler had a sudden high fever, the staff used the emergency triage escalation feature. Our queue token was elevated immediately. Lifesaving service at Shridevi Hospital!',
    initials: 'PS',
    accent: 'bg-teal-100 text-teal-700'
  },
  {
    id: 3,
    name: 'Devendra Patel',
    role: 'Orthopedics Follow-Up • Kyatsandra',
    rating: 5,
    quote: 'The AI wait time prediction was surprisingly exact. The system predicted 18 minutes, and the doctor summoned my token within 16 minutes. No anxiety, no confusion.',
    initials: 'DP',
    accent: 'bg-indigo-100 text-indigo-700'
  },
  {
    id: 4,
    name: 'Meera Deshpande',
    role: 'Dermatology Patient • SSIT Area',
    rating: 5,
    quote: 'The smart departure alert told me exactly when to leave my home near SSIT campus. I reached Shridevi Hospital 10 minutes before consultation. Truly modern healthcare!',
    initials: 'MD',
    accent: 'bg-emerald-100 text-emerald-700'
  }
];

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [departments, setDepartments] = useState([]);
  const [featuredDoctors, setFeaturedDoctors] = useState([]);
  const [activeQueues, setActiveQueues] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([
      hospitalApi.getDoctors(),
      hospitalApi.getAllQueues()
    ]).then(([docsRes, queuesRes]) => {
      if (!isMounted) return;
      if (docsRes.status === 'fulfilled' && Array.isArray(docsRes.value)) {
        const docs = docsRes.value;
        setFeaturedDoctors(docs.slice(0, 4));

        const deptMap = {};
        docs.forEach((doc) => {
          const deptName = doc.department || 'General Medicine';
          if (!deptMap[deptName]) {
            deptMap[deptName] = {
              name: deptName,
              doctorCount: 0,
              room: doc.consultation_room || 'OPD Block',
              headDoctor: doc.name
            };
          }
          deptMap[deptName].doctorCount += 1;
        });
        setDepartments(Object.values(deptMap));
      }

      if (queuesRes.status === 'fulfilled' && Array.isArray(queuesRes.value)) {
        setActiveQueues(queuesRes.value);
      }
    }).catch(console.error);

    return () => {
      isMounted = false;
    };
  }, []);

  const handleHeroSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/doctors?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/doctors');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-sky-100 selection:text-sky-900">
      
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-50/90 via-teal-50/30 to-white pt-12 pb-20 lg:pt-16 lg:pb-28 border-b border-slate-200/70">
        
        {/* Decorative background glow & mesh */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-20 -right-20 w-96 h-96 bg-teal-200/35 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            
            {/* College Project Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-sky-200 text-sky-800 text-xs font-bold mb-6 shadow-sm hover:scale-105 transition-transform">
              <GraduationCap className="w-4 h-4 text-sky-600" />
              <span>Shridevi Institute of Engineering & Technology, Tumkur • Final Year Project 2025–26</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.12] mb-6">
              Skip Waiting Rooms.{' '}
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600">
                Consult Doctors Faster.
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-slate-600 font-medium mb-8 max-w-2xl mx-auto leading-relaxed">
              Practo-inspired outpatient queue management for <strong className="text-slate-900">Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH)</strong>, Tumakuru. Secure instant digital tokens, skip crowded waiting rooms, and track consultations in real time.
            </p>

            {/* Hero Quick Search Bar */}
            <form onSubmit={handleHeroSearch} className="max-w-2xl mx-auto mb-6">
              <div className="relative flex items-center bg-white rounded-2xl border-2 border-slate-200 shadow-lg p-2 focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-100 transition-all">
                <Search className="w-5 h-5 text-slate-400 ml-3 shrink-0" />
                <input
                  type="text"
                  placeholder="Search by doctor name, Cardiology, Pediatrics, fever, knee pain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none placeholder-slate-400"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-sky-600/20 shrink-0 cursor-pointer"
                >
                  {t('find_doctors', 'Find Doctors')}
                </button>
              </div>
            </form>

            {/* Quick Filter Pills (Health Concerns) */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-10 max-w-2xl mx-auto">
              <span className="text-xs font-bold text-slate-500 mr-1">{t('search', 'Quick Search:')}</span>
              {COMMON_CONCERNS.slice(0, 5).map((c) => (
                <button
                  key={c.label}
                  onClick={() => navigate(`/doctors?dept=${encodeURIComponent(c.dept)}`)}
                  className="px-3 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 rounded-full text-xs font-semibold transition cursor-pointer"
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* 2 Clear Call-To-Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Link
                to="/doctors"
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white font-black rounded-2xl text-sm transition-all shadow-lg shadow-sky-600/25 hover:-translate-y-0.5 flex items-center justify-center gap-2 group cursor-pointer"
              >
                <Stethoscope className="w-4 h-4" />
                <span>{t('find_doctors', 'Find Doctors')} & {t('book_consultation', 'Join Queue')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                to="/tracking"
                className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-2xl text-sm transition-all border-2 border-slate-200 hover:border-sky-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Activity className="w-4 h-4 text-sky-600" />
                <span>{t('live_token', 'Track Live Queue Token')}</span>
              </Link>
            </div>

            {/* Trust Benefit Badges */}
            <div className="pt-6 border-t border-slate-200/80 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs font-bold text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" /> Real-time Queue Tracking
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" /> Smart Tumkur Departure
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-rose-600" /> {t('emergency_247', '24/7 Emergency Care')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" /> AI Wait Time Prediction
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* 2. STATS IMPACT STRIP */}
      <section className="bg-white py-10 border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            <div className="pt-4 lg:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-sky-700 mb-1">70%</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Wait Reduction</div>
            </div>
            <div className="pt-4 lg:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-teal-600 mb-1">10</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clinical Departments</div>
            </div>
            <div className="pt-4 lg:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-slate-800 mb-1">&lt; 15 min</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">OPD Consultation Window</div>
            </div>
            <div className="pt-4 lg:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-emerald-600 mb-1">Instant</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Emergency Priority Fast-Track</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PRACTO-STYLE QUICK SERVICES CARDS */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
              Everything You Need for a Seamless Hospital Visit
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              From discovering experienced doctors to real-time queue tracking and emergency fast-tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Find & Book */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-sky-300 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Specialist Doctors</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Browse verified specialists across 10 hospital departments, view verified patient stories, clinical qualifications, and consultation fee transparency.
                </p>
              </div>
              <Link
                to="/doctors"
                className="inline-flex items-center gap-1.5 text-xs font-black text-sky-600 hover:text-sky-700 group-hover:gap-2.5 transition-all pt-3 border-t border-slate-100"
              >
                <span>Find Doctors Now</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Card 2: Live Token & Departure */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-teal-300 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Car className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Smart Departure & Queue</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Input your starting location in Tumkur (SSIT, Bus Stand, Batawadi, etc.) and our algorithm computes your exact departure time to arrive right when called.
                </p>
              </div>
              <Link
                to="/tracking"
                className="inline-flex items-center gap-1.5 text-xs font-black text-teal-600 hover:text-teal-700 group-hover:gap-2.5 transition-all pt-3 border-t border-slate-100"
              >
                <span>Track Live Queue</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Card 3: AI Simulator & Emergency */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-purple-300 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Cpu className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">AI Wait Simulator</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Random Forest Machine Learning model trained on 1000+ realistic clinical scenarios to predict consultation duration with high precision.
                </p>
              </div>
              <Link
                to="/predict"
                className="inline-flex items-center gap-1.5 text-xs font-black text-purple-600 hover:text-purple-700 group-hover:gap-2.5 transition-all pt-3 border-t border-slate-100"
              >
                <span>Try AI Simulator</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* DEDICATED ABOUT HOSPITAL SECTION (SIMSRH) */}
      <section className="py-16 bg-white border-t border-b border-slate-200/80 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Column: Hospital Info & Overview */}
            <div className="lg:col-span-7 space-y-5">
              
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-bold border border-sky-200 shadow-xs">
                <Building2 className="w-3.5 h-3.5 text-sky-600" />
                <span>Target Hospital • Tumakuru</span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH)
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH) is an established medical institution and comprehensive teaching hospital located in Tumakuru, Karnataka. Committed to compassionate, patient-centered healthcare delivery, SIMSRH provides extensive outpatient clinical services, specialized medical care, and round-the-clock emergency medical response.
              </p>

              {/* Key Highlights Pill Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900">24/7 Emergency Care</h4>
                    <p className="text-[11px] text-slate-500">Continuous emergency casualty & critical trauma care</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900">Sira Road, NH4</h4>
                    <p className="text-[11px] text-slate-500">Lingapura, Tumakuru, Karnataka – 572106</p>
                  </div>
                </div>
              </div>

              {/* Action Links */}
              <div className="flex flex-wrap items-center gap-3 pt-3">
                <Link
                  to="/about"
                  className="px-6 py-3 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white font-extrabold rounded-2xl text-xs transition-all shadow-md shadow-sky-600/20 hover:-translate-y-0.5 inline-flex items-center gap-2"
                >
                  <span>Explore Hospital Profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <a
                  href="https://shridevmedical.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-2xl text-xs border border-slate-200 hover:border-sky-300 transition-all inline-flex items-center gap-1.5 shadow-xs"
                >
                  <span>Visit Official Website</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                </a>

                <a
                  href="https://maps.google.com/?q=Shridevi+Institute+of+Medical+Sciences+and+Research+Hospital+Tumakuru"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-all inline-flex items-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5 text-sky-600" />
                  <span>Get Directions</span>
                </a>
              </div>

            </div>

            {/* Right Column: Visual Card */}
            <div className="lg:col-span-5">
              <div className="bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-sky-800/60 relative overflow-hidden space-y-6">
                
                <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-black">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-white">SIMSRH Tumakuru</h3>
                      <p className="text-[11px] text-teal-300">Medical Sciences & Research</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                    24/7 Casualty
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Campus Location
                    </span>
                    <p className="font-bold text-slate-200 leading-relaxed">
                      Sira Road, NH4, Lingapura,<br />
                      Tumakuru, Karnataka – 572106
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Emergency Services
                    </span>
                    <p className="text-rose-300 font-semibold leading-relaxed">
                      24/7 Emergency Care with round-the-clock emergency medical response.
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Official Medical Website
                    </span>
                    <div>
                      <a
                        href="https://shridevmedical.org/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-300 hover:text-sky-200 font-bold inline-flex items-center gap-1 hover:underline"
                      >
                        <span>https://shridevmedical.org/</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                  <span>SmartHospital OPD Integration</span>
                  <Link to="/about" className="text-teal-300 font-bold hover:underline flex items-center gap-1">
                    <span>View Hospital Details</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 5. HEALTH CONCERNS / SYMPTOMS QUICK ACCESS (Practo Signature) */}
      <section className="py-16 bg-white border-t border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
            <div>
              <span className="text-xs font-bold text-sky-600 uppercase tracking-wider block mb-1">
                Consult by Health Concern
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Common Symptoms & Clinical Specialities
              </h2>
            </div>
            <Link
              to="/departments"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 hover:gap-2 transition-all"
            >
              <span>View All 10 Departments</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {COMMON_CONCERNS.map((item) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(`/doctors?dept=${encodeURIComponent(item.dept)}`)}
                  className="p-5 rounded-3xl border border-slate-200/80 hover:border-sky-300 hover:shadow-lg transition-all text-left bg-slate-50/50 hover:bg-white group cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${item.color} group-hover:scale-110 transition-transform`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-sky-600 transition mb-0.5">
                    {item.label}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-semibold">{item.dept}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. LIVE OPD DEPARTMENT QUEUE TICKER */}
      <section className="py-14 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Hospital OPD Feed • SIMSRH Tumakuru</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Current OPD Room Waiting Counters
              </h2>
            </div>
            <Link
              to="/doctors"
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition cursor-pointer inline-flex items-center gap-2"
            >
              <span>Join OPD Queue</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.keys(DEPARTMENT_METADATA).map((deptName) => {
              const meta = DEPARTMENT_METADATA[deptName];
              const IconComp = meta.icon;
              const deptQueueCount = activeQueues.filter((q) => q.department === deptName && ['waiting', 'arrived', 'ready'].includes(q.status)).length;
              return (
                <div
                  key={deptName}
                  className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 hover:border-sky-400/40 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <IconComp className="w-4 h-4 text-sky-400" />
                    <span className="text-[10px] font-bold text-slate-400">{meta.room}</span>
                  </div>
                  <div className="font-extrabold text-xs text-white truncate mb-1">{deptName}</div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Waiting:</span>
                    <span className="font-black text-teal-300">{deptQueueCount} patients</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. HOW IT WORKS 4-STEP FLOW */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-extrabold text-sky-600 uppercase tracking-widest block mb-2">
              Simple 4-Step Patient Journey
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
              How SmartHospital Works
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Designed to make hospital visits efficient, calm, and zero-stress for outpatients in Tumkur.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            
            {/* Step 1 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative">
              <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-sky-600/20">
                1
              </div>
              <h3 className="text-base font-black text-slate-900 mb-2">Select Specialist</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Choose doctor and department based on your symptoms and obtain a digital queue token instantly from anywhere.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative">
              <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-teal-600/20">
                2
              </div>
              <h3 className="text-base font-black text-slate-900 mb-2">Smart Departure Alert</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Our transit engine calculates travel time from your Tumkur landmark and tells you precisely when to leave home.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-indigo-600/20">
                3
              </div>
              <h3 className="text-base font-black text-slate-900 mb-2">Arrive Just-In-Time</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Click "I Have Arrived" on your dashboard upon reaching Shridevi Hospital. No lobby waiting or standing in physical lines.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-emerald-600/20">
                4
              </div>
              <h3 className="text-base font-black text-slate-900 mb-2">OTP Consultation</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your doctor summons your token, verifies your secure 4-digit consultation code, and provides personalized clinical care.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 7. VERIFIED PATIENT STORIES */}
      <section className="py-16 bg-white border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-extrabold text-teal-600 uppercase tracking-widest block mb-2">
              Verified Patient Stories
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Trusted by Patients Across Tumkur
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.id}
                className="bg-slate-50/70 rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-3">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed italic mb-4">
                    "{t.quote}"
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-slate-200/60">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${t.accent}`}>
                    {t.initials}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900">{t.name}</h4>
                    <p className="text-[10px] text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. ACADEMIC PROJECT SHOWCASE BANNER */}
      <section className="py-12 bg-slate-100 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-sky-900 to-teal-900 rounded-3xl p-8 text-white flex flex-col lg:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0 border border-white/20">
                <GraduationCap className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight mb-1">
                  Shridevi Institute of Engineering & Technology (SIET), Tumkur
                </h3>
                <p className="text-xs text-slate-200 max-w-xl leading-relaxed">
                  Final Year Major Project • Department of Computer Science & Engineering. Affiliated to VTU Belagavi & Approved by AICTE, New Delhi.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/predict"
                className="px-5 py-3 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-black transition shadow-md cursor-pointer"
              >
                AI Model Demo
              </Link>
              <Link
                to="/doctors"
                className="px-5 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black transition shadow-md cursor-pointer"
              >
                Explore Doctors
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
