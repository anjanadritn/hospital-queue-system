import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Stethoscope,
  CheckCircle2,
  Building2,
  UserX,
  ArrowRight,
  Star,
  Clock,
  Sparkles,
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  List
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import DoctorCard from '../components/DoctorCard';
import QueueJoinModal from '../components/QueueJoinModal';
import LoginRequiredModal from '../components/LoginRequiredModal';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

const QUICK_TAGS = [
  'Cardiology',
  'Chest Pain',
  'Fever',
  'Orthopedics',
  'Joint Pain',
  'Pediatrics',
  'Dermatology',
  'Migraine',
  'ENT',
  'Gastro'
];

export default function Doctors() {
  const { user, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDept = searchParams.get('dept') || 'All';
  const initialQuery = searchParams.get('q') || '';

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [selectedDept, setSelectedDept] = useState(initialDept);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState('All');
  const [sortBy, setSortBy] = useState('rating'); // 'rating' | 'experience' | 'wait'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  const [selectedDoctorForModal, setSelectedDoctorForModal] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const loadDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hospitalApi.getDoctors();
      setDoctors(data || []);
    } catch (err) {
      console.error(err);
      setError(t('unable_to_sync', 'Unable to fetch doctors list from Flask backend. Please ensure backend is running.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  // Update selection if query param changes
  useEffect(() => {
    const deptParam = searchParams.get('dept');
    if (deptParam) setSelectedDept(deptParam);
    const qParam = searchParams.get('q');
    if (qParam) setSearchTerm(qParam);
  }, [searchParams]);

  const handleJoinQueueClick = (doctor) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (user?.role !== 'patient') {
      alert(t('doctor_admin_cannot_join_error', 'Doctor and Admin accounts cannot join patient queues. Please login as a Patient.'));
      return;
    }
    setSelectedDoctorForModal(doctor);
  };

  const departments = ['All', ...new Set(doctors.map((d) => d.department).filter(Boolean))];

  const filteredDoctors = doctors
    .filter((doc) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        doc.name.toLowerCase().includes(term) ||
        (doc.department && doc.department.toLowerCase().includes(term)) ||
        (doc.specialization && doc.specialization.toLowerCase().includes(term)) ||
        (doc.about && doc.about.toLowerCase().includes(term)) ||
        (Array.isArray(doc.services) && doc.services.some((s) => s.toLowerCase().includes(term)));

      const matchesDept = selectedDept === 'All' || doc.department === selectedDept;
      const matchesAvailability = !onlyAvailable || doc.available === true;

      let matchesExp = true;
      const expNum = parseInt(doc.experience, 10) || 5;
      if (selectedExperience === '5+') matchesExp = expNum >= 5;
      else if (selectedExperience === '10+') matchesExp = expNum >= 10;
      else if (selectedExperience === '15+') matchesExp = expNum >= 15;

      return matchesSearch && matchesDept && matchesAvailability && matchesExp;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') {
        return (b.rating || 4.8) - (a.rating || 4.8);
      } else if (sortBy === 'experience') {
        const expA = parseInt(a.experience, 10) || 5;
        const expB = parseInt(b.experience, 10) || 5;
        return expB - expA;
      } else if (sortBy === 'wait') {
        return (a.avg_consultation_duration || 15) - (b.avg_consultation_duration || 15);
      }
      return 0;
    });

  return (
    <div className="min-h-screen bg-slate-50/70 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header with College Project & Practo Styling */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-3.5 py-1 rounded-full border border-sky-200 mb-3">
            <Stethoscope className="w-3.5 h-3.5 text-sky-600" />
            <span>{t('specialist_directory_tumkur', 'SIMSRH Specialists Directory • Tumakuru')}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2">
            {t('find_book_top_doctors', 'Find & Book Top Doctors')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-3xl leading-relaxed">
            {t('find_doctors_desc', 'Consult verified clinical specialists across 10 hospital departments, review patient feedback ratings, view live OPD wait times, and reserve your consultation token.')}
          </p>
        </div>

        {/* Filter Controls Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs mb-8 space-y-5">
          
          {/* Top Row: Search & Filters */}
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder={t('search_doctors_placeholder', 'Search doctors, Cardiology, fever, knee pain, acne, migraine...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition shadow-2xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-3 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {t('clear', 'Clear')}
                </button>
              )}
            </div>

            {/* Controls Right */}
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Experience Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 font-medium">{t('experience', 'Experience:')}</span>
                <select
                  value={selectedExperience}
                  onChange={(e) => setSelectedExperience(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="All">{t('all_years', 'All Years')}</option>
                  <option value="5+">{t('years_plus_5', '5+ Years')}</option>
                  <option value="10+">{t('years_plus_10', '10+ Years')}</option>
                  <option value="15+">{t('years_plus_15', '15+ Years')}</option>
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 font-medium">{t('sort', 'Sort:')}</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="rating">{t('top_rated', 'Top Rated (★)')}</option>
                  <option value="experience">{t('experience_high_low', 'Experience (High to Low)')}</option>
                  <option value="wait">{t('shortest_wait_time', 'Shortest Wait Time')}</option>
                </select>
              </div>

              {/* Available Today Toggle */}
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none bg-emerald-50/70 border border-emerald-200/80 px-3 py-1.5 rounded-xl">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-emerald-900">{t('in_clinic_today', 'In Clinic Today')}</span>
              </label>

            </div>
          </div>

          {/* Department Filter Chips */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => {
                  setSelectedDept(dept);
                  setSearchParams(dept === 'All' ? {} : { dept });
                }}
                className={`px-3.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedDept === dept
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {dept === 'All' ? t('all', 'All') : t('dept_' + dept.toLowerCase().replace(/[^a-z]/g, '_'), dept)}
              </button>
            ))}
          </div>

          {/* Quick Symptoms / Concerns Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
            <span className="text-[11px] font-bold text-slate-400">{t('popular', 'Popular:')}</span>
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setSearchTerm(tag)}
                className="px-2.5 py-0.5 bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-700 rounded-md text-[11px] font-medium border border-slate-200 transition cursor-pointer"
              >
                {t('cond_' + tag.toLowerCase().replace(/[^a-z]/g, '_'), tag)}
              </button>
            ))}
          </div>

        </div>

        {/* Results Counter & Actions */}
        <div className="flex items-center justify-between mb-6 text-xs text-slate-500">
          <div>
            {t('showing_doctors', { count: filteredDoctors.length }, `Showing ${filteredDoctors.length} doctors`)}
            {selectedDept !== 'All' && <span> {t('in', 'in')} <span className="font-extrabold text-sky-700">{t('dept_' + selectedDept.toLowerCase().replace(/[^a-z]/g, '_'), selectedDept)}</span></span>}
            {searchTerm && <span> {t('matching', 'matching')} "<span className="font-extrabold text-slate-800">{searchTerm}</span>"</span>}
          </div>
          <Link
            to="/departments"
            className="font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{t('browse_clinical_wings', 'Browse Clinical Wings')}</span>
          </Link>
        </div>

        {/* Doctors Grid */}
        {loading ? (
          <LoadingState message={t('loading_clinical_records', 'Loading verified doctors and live OPD availability...')} />
        ) : error ? (
          <ErrorState message={error} onRetry={loadDoctors} />
        ) : filteredDoctors.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs max-w-lg mx-auto">
            <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UserX className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{t('no_doctors_found', 'No Doctors Found')}</h3>
            <p className="text-xs text-slate-500 mb-6">
              {t('no_doctors_found_desc', 'No specialists match your search criteria. Try clearing filters or searching for another condition.')}
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedDept('All');
                setOnlyAvailable(false);
                setSelectedExperience('All');
                setSearchParams({});
              }}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              {t('reset_all_filters', 'Reset All Filters')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDoctors.map((doc) => (
              <DoctorCard
                key={doc.doctor_id}
                doctor={doc}
                onJoinQueue={handleJoinQueueClick}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
        )}

      </div>

      {/* Queue Join Modal */}
      {selectedDoctorForModal && (
        <QueueJoinModal
          doctor={selectedDoctorForModal}
          onClose={() => setSelectedDoctorForModal(null)}
          onSuccess={() => setSelectedDoctorForModal(null)}
        />
      )}

      {/* Login Required Modal */}
      {showLoginModal && (
        <LoginRequiredModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          message={t('modal_login_required_desc', "Please log in with your phone or email to join a doctor's live OPD queue.")}
        />
      )}

    </div>
  );
}
