import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Stethoscope,
  Clock,
  MapPin,
  Calendar,
  Users,
  Award,
  ShieldCheck,
  Star,
  Activity,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Phone,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Building2,
  Cpu,
  MessageSquarePlus,
  Send,
  Lock
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import QueueJoinModal from '../components/QueueJoinModal';
import LoginRequiredModal from '../components/LoginRequiredModal';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function DoctorProfile() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const [doctor, setDoctor] = useState(null);
  const [queueItems, setQueueItems] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'schedule' | 'reviews' | 'location'
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Review submission state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      hospitalApi.getDoctor(doctorId),
      hospitalApi.getDoctorQueue ? hospitalApi.getDoctorQueue(doctorId) : Promise.resolve([]),
      hospitalApi.getDoctorReviews ? hospitalApi.getDoctorReviews(doctorId) : Promise.resolve([])
    ])
      .then(([docRes, qRes, revRes]) => {
        if (!isMounted) return;
        if (docRes.status === 'fulfilled' && docRes.value) {
          setDoctor(docRes.value);
        } else {
          setError('Doctor profile not found.');
        }

        if (qRes.status === 'fulfilled' && Array.isArray(qRes.value)) {
          setQueueItems(qRes.value);
        }

        if (revRes.status === 'fulfilled' && Array.isArray(revRes.value)) {
          setReviews(revRes.value);
        }
      })
      .catch((err) => {
        console.error('Error fetching doctor profile data:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [doctorId]);

  const handleJoinQueueClick = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (user?.role !== 'patient') {
      alert('Only registered patient accounts can join OPD queues. Please login as a Patient.');
      return;
    }
    setShowJoinModal(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!newReview.comment.trim()) return;

    setSubmittingReview(true);
    try {
      const payload = {
        author: user?.name || 'Verified Patient',
        rating: newReview.rating,
        comment: newReview.comment.trim()
      };
      const res = await hospitalApi.submitDoctorReview(doctorId, payload);
      setReviews([res, ...reviews]);
      setIsReviewModalOpen(false);
      setNewReview({ rating: 5, comment: '' });
    } catch (err) {
      console.error(err);
      alert('Could not submit review. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return <LoadingState message={t('loading_clinical_records', 'Loading doctor credentials, live OPD queue, and reviews...')} />;
  }

  if (error || !doctor) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <ErrorState
          title={t('no_doctors_found', 'Doctor Not Found')}
          message={error || t('no_doctors_found_desc', "The requested doctor profile does not exist in Shridevi Hospital's directory.")}
          actionLabel={t('find_doctors', 'Back to Doctors')}
          onAction={() => navigate('/doctors')}
        />
      </div>
    );
  }

  const initials = doctor.name
    ? doctor.name.replace('Dr. ', '').split(' ').map((n) => n[0]).join('').slice(0, 2)
    : 'DR';

  const waitingCount = queueItems.filter((q) => ['waiting', 'arrived', 'ready'].includes(q.status)).length;
  const inConsultationPatient = queueItems.find((q) => q.status === 'in_consultation');
  const rating = doctor.rating || 4.9;
  const reviewsCount = reviews.length > 0 ? reviews.length : (doctor.reviews_count || 142);
  const fee = doctor.fee || 400;

  return (
    <div className="min-h-screen bg-slate-50/70 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Breadcrumb Navigation */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link to="/doctors" className="hover:text-sky-600 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('find_doctors', 'Doctors Directory')}</span>
          </Link>
          <span>/</span>
          <span className="text-sky-700 font-bold">{doctor.department}</span>
          <span>/</span>
          <span className="text-slate-800 font-bold">{doctor.name}</span>
        </div>

        {/* HERO PROFILE CARD */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm mb-8 relative overflow-hidden">
          
          {/* Top subtle color strip */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-600 via-teal-500 to-emerald-500" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            {/* Left: Avatar & Bio Details */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="relative shrink-0">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-sky-600 via-teal-600 to-teal-500 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-sky-600/20">
                  {initials}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-sm">
                  <ShieldCheck className="w-5 h-5 text-sky-600" />
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-xs font-extrabold text-sky-800 bg-sky-50 px-3 py-0.5 rounded-full border border-sky-200">
                    {doctor.department}
                  </span>
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-0.5 rounded-full border border-teal-100 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                    <span>{t('verified', 'Verified Specialist')}</span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold ${
                      doctor.available
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${doctor.available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    {doctor.available ? t('in_clinic_today', 'In Clinic Today') : t('away', 'Away')}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-1">
                  {doctor.name}
                </h1>
                <p className="text-xs sm:text-sm text-sky-700 font-bold mb-1">
                  {doctor.qualifications || 'MBBS, MD'}
                </p>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mb-3">
                  {doctor.specialization} • <strong className="text-slate-700">{doctor.experience}</strong> of clinical excellence
                </p>

                {/* Practo Ratings & Reviews */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
                  <div className="flex items-center gap-1 text-amber-500 font-extrabold">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{rating} / 5.0</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600">{reviewsCount} {t('patient_reviews', 'Verified Patient Stories')}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-emerald-700 font-bold">98% Recommended</span>
                </div>
              </div>
            </div>

            {/* Right: Quick Action Card */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[260px]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">{t('consultation_fee', 'Consultation Fee:')}</span>
                <span className="font-extrabold text-slate-900 text-sm">₹{fee} <span className="text-[10px] text-slate-400 font-normal">OPD</span></span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">{t('location_label', 'OPD Location:')}</span>
                <span className="font-bold text-slate-800">{doctor.consultation_room || 'Room 101'}</span>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex gap-2">
                <Link
                  to={`/book?doctorId=${doctor.doctor_id}&dept=${encodeURIComponent(doctor.department || '')}`}
                  className="flex-1 py-2.5 px-3 bg-white hover:bg-slate-50 text-sky-700 font-bold rounded-xl text-xs border border-sky-200 transition text-center shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-sky-600" />
                  <span>{t('book_slot', 'Book Slot')}</span>
                </Link>

                <button
                  onClick={handleJoinQueueClick}
                  disabled={!doctor.available}
                  className="flex-1 py-2.5 px-3 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-xs transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {!isAuthenticated && <Lock className="w-3.5 h-3.5" />}
                  <span>{t('join_queue', 'Join Queue')}</span>
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* LIVE OPD QUEUE WIDGET BANNER */}
        <div className="bg-gradient-to-r from-sky-900 to-teal-900 rounded-3xl p-6 text-white mb-8 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-sky-300 border border-white/20">
                <Activity className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base tracking-tight">{t('live_opd_token_journey', 'Live OPD Queue Counter')}</h3>
                  <span className="text-[10px] font-extrabold bg-emerald-400/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                    {t('opd_live', 'Live Feed')}
                  </span>
                </div>
                <p className="text-xs text-sky-200 font-medium">
                  {inConsultationPatient
                    ? `${t('now_serving', 'Now serving')}: ${t('token_number', { token: inConsultationPatient.queue_id }, 'Token ' + inConsultationPatient.queue_id)}`
                    : t('doctor_room_ready', 'Doctor consultation room is ready for next token.')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 self-start sm:self-auto">
              <div className="text-right">
                <span className="text-[11px] text-slate-300 block font-semibold">{t('patients_ahead', 'Patients Ahead')}</span>
                <span className="text-2xl font-black text-white">{waitingCount}</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-300 block font-semibold">{t('avg_consultation_time', 'Avg Consultation')}</span>
                <span className="text-2xl font-black text-teal-300">~{doctor.avg_consultation_duration || 14}m</span>
              </div>
            </div>
          </div>
        </div>

        {/* PRACTO-STYLE 4 TABS */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden mb-12">
          
          {/* Tab Navigation */}
          <div className="flex items-center border-b border-slate-200 px-6 pt-2 bg-slate-50/50 overflow-x-auto scrollbar-thin">
            {[
              { id: 'overview', label: t('overview', 'Overview & Expertise'), icon: Stethoscope },
              { id: 'schedule', label: t('opd_schedule', 'OPD Schedule & Live Queue'), icon: Clock },
              { id: 'reviews', label: `${t('patient_reviews', 'Patient Stories')} (${reviewsCount})`, icon: Star },
              { id: 'location', label: t('chamber_location', 'Hospital Location & Directions'), icon: MapPin }
            ].map((tab) => {
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                    activeTab === tab.id
                      ? 'border-sky-600 text-sky-700 bg-white shadow-2xs'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab 1: Overview & Expertise */}
          {activeTab === 'overview' && (
            <div className="p-6 sm:p-8 space-y-8">
              
              {/* Bio */}
              <div>
                <h3 className="text-base font-black text-slate-900 mb-2">About the Doctor</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-4xl">
                  {doctor.about || `${doctor.name} is an esteemed specialist in ${doctor.department} with over ${doctor.experience} of clinical practice at Shridevi Hospital Campus, Tumkur.`}
                </p>
              </div>

              {/* Clinical Services */}
              <div>
                <h3 className="text-base font-black text-slate-900 mb-3">Specialized Clinical Services</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(doctor.services || [
                    'Comprehensive Clinical Diagnosis',
                    'Preventive Screening & Evaluation',
                    'Specialist OPD Consultation',
                    'Patient Follow-up & Monitoring'
                  ]).map((svc, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-semibold text-slate-700 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>{svc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Education & Awards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-sky-600" />
                    <span>Education & Training</span>
                  </h4>
                  <p className="text-xs font-bold text-slate-800">
                    {doctor.education || 'Prestigious Medical Institute'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {doctor.qualifications || 'MBBS, MD'}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>Awards & Accreditations</span>
                  </h4>
                  <p className="text-xs font-bold text-slate-800">
                    {doctor.awards || 'Clinical Excellence Award'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Indian Medical Association (IMA) & Karnataka Medical Council
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* Tab 2: OPD Schedule & Queue */}
          {activeTab === 'schedule' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Working Hours Card */}
                <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200">
                  <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-3">Clinic Timings</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Days:</span>
                      <span className="font-extrabold text-slate-900">Monday – Saturday</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Hours:</span>
                      <span className="font-extrabold text-sky-700">{doctor.working_hours || '09:00 AM – 04:00 PM'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Consultation Room:</span>
                      <span className="font-extrabold text-slate-900">{doctor.consultation_room || 'Room 101'}</span>
                    </div>
                  </div>
                </div>

                {/* Queue Summary Card */}
                <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200">
                  <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-3">Live Line Stats</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Patients in Queue:</span>
                      <span className="font-extrabold text-teal-700">{waitingCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Expected Wait:</span>
                      <span className="font-extrabold text-purple-700">~{waitingCount * (doctor.avg_consultation_duration || 14)} mins</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Emergency Support:</span>
                      <span className="font-extrabold text-emerald-700">24x7 Priority Triage</span>
                    </div>
                  </div>
                </div>

                {/* Quick Action */}
                <div className="bg-sky-50/60 rounded-3xl p-5 border border-sky-100 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-sky-900 uppercase tracking-wider mb-1">Reserve Your Spot</h4>
                    <p className="text-xs text-sky-700 leading-relaxed mb-4">
                      Get your queue token now to track the doctor's live progress from home.
                    </p>
                  </div>
                  <button
                    onClick={handleJoinQueueClick}
                    disabled={!doctor.available}
                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-extrabold transition shadow-sm cursor-pointer"
                  >
                    Join Live Queue Now
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* Tab 3: Patient Stories & Reviews */}
          {activeTab === 'reviews' && (
            <div className="p-6 sm:p-8 space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900 mb-1">Patient Feedback & Experiences</h3>
                  <p className="text-xs text-slate-500">
                    Real reviews verified through Shridevi Hospital outpatient consultations.
                  </p>
                </div>
                <button
                  onClick={() => setIsReviewModalOpen(true)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  <span>Share Your Experience</span>
                </button>
              </div>

              {/* Reviews List */}
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    No reviews yet. Be the first to share your experience with {doctor.name}!
                  </p>
                ) : (
                  reviews.map((rev, index) => (
                    <div
                      key={index}
                      className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                            {rev.author ? rev.author[0] : 'P'}
                          </div>
                          <div>
                            <span className="font-extrabold text-xs text-slate-900 block leading-tight">{rev.author}</span>
                            <span className="text-[10px] text-teal-600 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Verified Consultation
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-amber-400">
                          {[...Array(rev.rating || 5)].map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed pt-1">
                        "{rev.comment}"
                      </p>
                      <div className="text-[10px] text-slate-400">
                        {rev.date || 'Recent Consultation at Shridevi Hospital'}
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* Tab 4: Hospital Location & Directions */}
          {activeTab === 'location' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900 mb-2">Hospital Campus & Location</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {doctor.name} consults at Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH) in Tumakuru.
                </p>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-w-2xl space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-slate-800 font-bold">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH), Sira Road, NH4, Lingapura, Tumakuru, Karnataka – 572106</span>
                  </div>
                  <div className="text-slate-500 pl-6">
                    Room: <strong>{doctor.consultation_room || 'Room 101'}</strong> • Main OPD Wing
                  </div>
                  <div className="pl-6 pt-1 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                      <ShieldCheck className="w-3.5 h-3.5" /> 24/7 Emergency Care Available
                    </span>
                    <a
                      href="https://maps.google.com/?q=Shridevi+Institute+of+Medical+Sciences+and+Research+Hospital+Tumakuru"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline"
                    >
                      Get Directions (Google Maps) →
                    </a>
                  </div>
                </div>
              </div>

              {/* Landmarks Travel Times */}
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">
                  Travel Times from Key Tumkur Landmarks
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
                  {[
                    { place: 'Tumkur Bus Stand', time: '20 mins', dist: '7.2 km' },
                    { place: 'Batawadi', time: '15 mins', dist: '5.5 km' },
                    { place: 'Kyatsandra', time: '24 mins', dist: '9.8 km' },
                    { place: 'SSIT Campus', time: '18 mins', dist: '6.8 km' },
                    { place: 'Sira Gate', time: '12 mins', dist: '4.2 km' },
                    { place: 'Tumkur Railway Stn', time: '20 mins', dist: '7.5 km' }
                  ].map((item) => (
                    <div key={item.place} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div className="font-bold text-slate-800">{item.place}</div>
                      <div className="text-sky-600 font-extrabold text-[11px]">{item.time} (~{item.dist})</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Review Submission Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-1">Review {doctor.name}</h3>
            <p className="text-xs text-slate-500 mb-4">
              Share your consultation feedback to help other outpatients at Shridevi Hospital.
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Your Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setNewReview({ ...newReview, rating: star })}
                      className="p-1 cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= newReview.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-extrabold text-slate-700 ml-2">{newReview.rating} Stars</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Your Experience</label>
                <textarea
                  rows={4}
                  required
                  placeholder="How was your consultation? Was the explanation clear and the wait time manageable?"
                  value={newReview.comment}
                  onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingReview ? 'Submitting...' : 'Post Review'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Queue Join Modal */}
      {showJoinModal && (
        <QueueJoinModal
          doctor={doctor}
          onClose={() => setShowJoinModal(false)}
          onSuccess={() => {
            setShowJoinModal(false);
            navigate('/patient');
          }}
        />
      )}

      {/* Login Required Modal */}
      {showLoginModal && (
        <LoginRequiredModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          message="Please log in as a Patient to join the OPD queue."
        />
      )}

    </div>
  );
}
