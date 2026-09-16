import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Stethoscope,
  Heart,
  Bone,
  Baby,
  Brain,
  Eye,
  Wind,
  Ear,
  Flame,
  Sparkles,
  ArrowRight,
  Search,
  CheckCircle2,
  Calendar,
  Activity
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

const DEPT_ICON_MAP = {
  'Cardiology': { icon: Heart, color: 'text-rose-600 bg-rose-50 border-rose-100', treated: ['Heart Disease', 'Hypertension', 'Chest Pain', 'ECG Monitoring'] },
  'General Medicine': { icon: Stethoscope, color: 'text-sky-600 bg-sky-50 border-sky-100', treated: ['Viral Fevers', 'Diabetes Care', 'Hypertension', 'Routine Health Checks'] },
  'Orthopedics': { icon: Bone, color: 'text-amber-600 bg-amber-50 border-amber-100', treated: ['Fractures & Trauma', 'Joint Replacement', 'Arthritis', 'Spinal Disorders'] },
  'Pediatrics': { icon: Baby, color: 'text-teal-600 bg-teal-50 border-teal-100', treated: ['Newborn Care', 'Vaccinations', 'Child Nutrition', 'Pediatric Infections'] },
  'Dermatology': { icon: Sparkles, color: 'text-purple-600 bg-purple-50 border-purple-100', treated: ['Skin Allergies', 'Eczema & Psoriasis', 'Acne Care', 'Hair & Scalp Treatments'] },
  'Neurology': { icon: Brain, color: 'text-indigo-600 bg-indigo-50 border-indigo-100', treated: ['Headache & Migraine', 'Epilepsy & Seizures', 'Stroke Recovery', 'Nerve Disorders'] },
  'ENT': { icon: Ear, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', treated: ['Sinusitis & Allergy', 'Hearing Assessments', 'Tonsillitis', 'Throat Infections'] },
  'Gastroenterology': { icon: Flame, color: 'text-orange-600 bg-orange-50 border-orange-100', treated: ['Acid Reflux (GERD)', 'Liver Care', 'Gastritis & Ulcers', 'Digestive Health'] },
  'Pulmonology': { icon: Wind, color: 'text-cyan-600 bg-cyan-50 border-cyan-100', treated: ['Asthma & Bronchitis', 'Chronic Cough', 'COPD Management', 'Sleep Medicine'] },
  'Ophthalmology': { icon: Eye, color: 'text-blue-600 bg-blue-50 border-blue-100', treated: ['Vision Testing', 'Cataract Consultations', 'Glaucoma Care', 'Refractive Errors'] }
};

const DEFAULT_DEPTS = [
  { department_id: 'DEPT001', name: 'Cardiology', description: 'Comprehensive cardiac care, ECG, diagnostic evaluations & advanced heart monitoring.', room: 'Room 204', head_doctor: 'Dr. Ananya Sharma', specialists_count: 1 },
  { department_id: 'DEPT002', name: 'General Medicine', description: 'Primary healthcare, fever triage, diabetes management & routine medical checkups.', room: 'Room 101', head_doctor: 'Dr. Rajesh Kumar', specialists_count: 1 },
  { department_id: 'DEPT003', name: 'Orthopedics', description: 'Joint replacement, fracture trauma care, spine clinic & musculoskeletal wellness.', room: 'Room 305', head_doctor: 'Dr. Sunita Patel', specialists_count: 1 },
  { department_id: 'DEPT004', name: 'Pediatrics', description: 'Dedicated pediatric consultations, neonatal monitoring, infant health & immunizations.', room: 'Room 108', head_doctor: 'Dr. Vikram Sethi', specialists_count: 1 },
  { department_id: 'DEPT005', name: 'Dermatology', description: 'Clinical skincare, allergy patch testing, psoriasis & cosmetic dermatology care.', room: 'Room 212', head_doctor: 'Dr. Meera Deshmukh', specialists_count: 1 },
  { department_id: 'DEPT006', name: 'Neurology', description: 'Brain and nervous system disorders, headache clinic, epilepsy & stroke rehabilitation.', room: 'Room 402', head_doctor: 'Dr. Arvind Rao', specialists_count: 1 },
  { department_id: 'DEPT007', name: 'ENT', description: 'Ear, nose & throat surgery, audiology screening, sinusitis & tonsil treatments.', room: 'Room 115', head_doctor: 'Dr. Kavita Menon', specialists_count: 1 },
  { department_id: 'DEPT008', name: 'Gastroenterology', description: 'Digestive endoscopy, liver & pancreatic disorders, acid reflux & GI treatments.', room: 'Room 310', head_doctor: 'Dr. Manoj Joshi', specialists_count: 1 },
  { department_id: 'DEPT009', name: 'Pulmonology', description: 'Chest medicine, asthma therapy, chronic cough, COPD & sleep apnea consultations.', room: 'Room 201', head_doctor: 'Dr. Priya Iyer', specialists_count: 1 },
  { department_id: 'DEPT010', name: 'Ophthalmology', description: 'Comprehensive vision testing, cataract consultations, glaucoma & retinal health.', room: 'Room 250', head_doctor: 'Dr. Abhijit Gupta', specialists_count: 1 }
];

export default function Departments() {
  const [departments, setDepartments] = useState(DEFAULT_DEPTS);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let isMounted = true;
    hospitalApi.getDepartments()
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data) && data.length > 0) {
          setDepartments(data);
        }
      })
      .catch((err) => {
        console.warn('Using default departments list:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-50/70 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-10 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-100 mb-3">
            <Building2 className="w-3.5 h-3.5" />
            <span>Hospital Clinical Wings</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
            Medical Departments & Specialties
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
            Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH), Tumakuru offers multidisciplinary outpatient clinical wings supported by 24/7 Emergency Care.
          </p>

          {/* Search bar */}
          <div className="relative max-w-md mx-auto mt-6">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder="Search departments or medical specialties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 shadow-xs focus:border-sky-500 focus:outline-none transition"
            />
          </div>
        </div>

        {/* Highlights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 text-center">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-2xl font-extrabold text-sky-600">10</div>
            <div className="text-[11px] text-slate-500 font-medium">Specialized Departments</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-2xl font-extrabold text-teal-600">100%</div>
            <div className="text-[11px] text-slate-500 font-medium">Digital Token Enabled</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-2xl font-extrabold text-amber-600">OPD & Triage</div>
            <div className="text-[11px] text-slate-500 font-medium">Daily Outpatient Clinics</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-2xl font-extrabold text-rose-600">Instant</div>
            <div className="text-[11px] text-slate-500 font-medium">Emergency Escalation</div>
          </div>
        </div>

        {/* Departments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((dept) => {
            const config = DEPT_ICON_MAP[dept.name] || {
              icon: Stethoscope,
              color: 'text-sky-600 bg-sky-50 border-sky-100',
              treated: ['Clinical Consultation', 'Diagnostic Evaluation']
            };
            const DeptIcon = config.icon;

            return (
              <div
                key={dept.department_id || dept.name}
                className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  
                  {/* Top: Icon & Room Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${config.color} group-hover:scale-105 transition-transform`}>
                      <DeptIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200/60">
                      {dept.room || 'OPD Block'}
                    </span>
                  </div>

                  {/* Title & Head Doctor */}
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-sky-600 transition-colors mb-1">
                    {dept.name}
                  </h3>
                  {dept.head_doctor && (
                    <p className="text-[11px] text-sky-700 font-semibold mb-3">
                      Lead: {dept.head_doctor}
                    </p>
                  )}

                  {/* Description */}
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    {dept.description}
                  </p>

                  {/* Common Treated Conditions Chips */}
                  <div className="mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Key Clinical Focus:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {config.treated.map((c, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-medium bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200/70"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
                  <Link
                    to={`/doctors?dept=${encodeURIComponent(dept.name)}`}
                    className="flex-1 py-2.5 px-3 bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-800 rounded-xl text-xs font-bold transition text-center flex items-center justify-center gap-1.5"
                  >
                    <span>View Doctors</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    to={`/book?dept=${encodeURIComponent(dept.name)}`}
                    className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    Book Slot
                  </Link>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
