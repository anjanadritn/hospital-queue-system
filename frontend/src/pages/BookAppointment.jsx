import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Calendar,
  User,
  Stethoscope,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DoorOpen,
  Navigation,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Activity,
  Edit3,
  HeartPulse,
  Sun,
  Moon,
  Users
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatErrorMessage } from '../utils/errorUtils';
import SymptomSelector from '../components/SymptomSelector';
import DepartureCard from '../components/DepartureCard';
import PatientLocationSelector from '../components/PatientLocationSelector';

export default function BookAppointment() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();

  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  // Form State - Use authenticated user's data
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [durationDays, setDurationDays] = useState(3);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [city, setCity] = useState('Tumakuru');
  const [originLatitude, setOriginLatitude] = useState(null);
  const [originLongitude, setOriginLongitude] = useState(null);
  const [isApproximateLocation, setIsApproximateLocation] = useState(true);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'
  const [gpsMessage, setGpsMessage] = useState('');
  const [pdo, setPdo] = useState('');

  // Family / Dependent vs Self Booking State
  const [bookingFor, setBookingFor] = useState('myself'); // 'myself' | 'family_member'
  const [relation, setRelation] = useState('self');
  const [locationSource, setLocationSource] = useState('device_gps');
  const [locationAddress, setLocationAddress] = useState('');

  const handleBookingForChange = (target) => {
    setBookingFor(target);
    if (target === 'myself') {
      setRelation('self');
      if (user) {
        setPatientName(user.name || user.full_name || 'Patient');
        setPatientPhone(user.phone || '');
        if (user.age) setAge(user.age);
        if (user.gender) setGender(user.gender);
        if (user.city || user.address) setCity(user.city || user.address);
        if (user.height_cm) setHeightCm(user.height_cm);
        if (user.weight_kg) setWeightKg(user.weight_kg);
      }
      // Always reset to GPS mode and clear stale family coordinates
      setLocationSource('device_gps');
      setOriginLatitude(null);
      setOriginLongitude(null);
      setLocationAddress('');
      setIsApproximateLocation(true);
      setGpsStatus('idle');
      setGpsMessage('');
    } else {
      setRelation('Mother');
      // For family member, do not pre-fill user profile; let booker enter patient vitals
      setPatientName('');
      setAge('');
      setHeightCm('');
      setWeightKg('');
      // NEVER silently use booker's GPS for family member!
      setOriginLatitude(null);
      setOriginLongitude(null);
      setIsApproximateLocation(false);
      setLocationSource('map_selected');
      setLocationAddress('');
      setCity('');
    }
  };

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      setGpsMessage('Geolocation is not supported by your browser. Using approximate landmark.');
      setIsApproximateLocation(true);
      return;
    }

    setGpsStatus('requesting');
    setGpsMessage('Requesting GPS location permission...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lon = Number(position.coords.longitude.toFixed(6));
        setOriginLatitude(lat);
        setOriginLongitude(lon);
        setIsApproximateLocation(false);
        setLocationSource('device_gps');
        setGpsStatus('granted');
        setGpsMessage(`Precise GPS captured: ${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`);
        if (!city || city === 'Tumakuru') {
          setCity('Current GPS Location');
          setLocationAddress(`Current Device GPS (${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E)`);
        }
      },
      (geoError) => {
        setIsApproximateLocation(true);
        setOriginLatitude(null);
        setOriginLongitude(null);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setGpsStatus('denied');
          setGpsMessage('Location permission denied. Using approximate landmark fallback.');
        } else {
          setGpsStatus('unavailable');
          setGpsMessage('GPS location unavailable. Using approximate landmark fallback.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  // Proactively ask patient for browser location permission on load ONLY if booking for myself
  useEffect(() => {
    if (bookingFor === 'myself' && typeof window !== 'undefined' && navigator.geolocation) {
      handleRequestLocation();
    }
  }, [bookingFor]);

  const [selectedDept, setSelectedDept] = useState('General Medicine');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [consultationDate, setConsultationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState('morning');
  const [slotData, setSlotData] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [customSymptoms, setCustomSymptoms] = useState('');
  const [priority, setPriority] = useState('normal');

  // Fetch slot availability whenever doctor or date changes
  useEffect(() => {
    if (consultationDate) {
      setLoadingSlots(true);
      hospitalApi.getSlotAvailability(selectedDoctorId || null, consultationDate)
        .then((res) => {
          setSlotData(res);
        })
        .catch((err) => {
          console.error("Error fetching slot availability:", err);
        })
        .finally(() => setLoadingSlots(false));
    }
  }, [selectedDoctorId, consultationDate]);

  const [isReviewing, setIsReviewing] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bookingResult, setBookingResult] = useState(null);

  const [isReturningPatient, setIsReturningPatient] = useState(false);

  // Live BMI calculation
  const calculatedBmi = (heightCm && weightKg && Number(heightCm) > 0 && Number(weightKg) > 0)
    ? (Number(weightKg) / Math.pow(Number(heightCm) / 100, 2)).toFixed(1)
    : null;

  // Initialize patient info from authenticated user and persistent profile
  useEffect(() => {
    if (!authLoading && user) {
      setPatientId(user.patient_id || user.user_id || '');
      setPatientName(user.name || user.full_name || 'Patient');
      setPatientPhone(user.phone || '');
      if (user.email) setPatientEmail(user.email);
      if (user.age) setAge(user.age);
      if (user.gender) setGender(user.gender);
      if (user.city || user.address) setCity(user.city || user.address);
      if (user.height_cm) setHeightCm(user.height_cm);
      if (user.weight_kg) setWeightKg(user.weight_kg);

      // Fetch persistent master profile for returning patient
      hospitalApi.getMyPatientProfile().then((profile) => {
        if (profile) {
          setIsReturningPatient(true);
          if (profile.patient_id) setPatientId(profile.patient_id);
          if (profile.name) setPatientName(profile.name);
          if (profile.phone) setPatientPhone(profile.phone);
          if (profile.email) setPatientEmail(profile.email);
          if (profile.age) setAge(profile.age);
          if (profile.gender) setGender(profile.gender);
          if (profile.city) setCity(profile.city);
          if (profile.height_cm) setHeightCm(profile.height_cm);
          if (profile.weight_kg) setWeightKg(profile.weight_kg);
        }
      }).catch(() => {});
    }
  }, [user, authLoading]);

  // Dates: Today, Tomorrow, Day After Tomorrow (Max 2 Days Advance Booking)
  const today = new Date();
  const dateOptions = [0, 1, 2].map((offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const iso = d.toISOString().split('T')[0];
    let label = offset === 0 ? t('today', 'Today') : offset === 1 ? t('tomorrow', 'Tomorrow') : t('plus_2_days', '+2 Days');
    return {
      iso,
      label,
      dateStr: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    };
  });

  /**
   * Determines whether a slot is time-closed based on the CURRENT browser time.
   * Only applies when the selected date is TODAY — future dates are always open.
   *
   * Rules:
   *   Morning Slot  (09:00 AM – 01:00 PM): closed if today's time >= 13:00
   *   Evening Slot  (02:00 PM – 09:00 PM): closed if today's time >= 14:00
   *
   * @param {string} slotId - 'morning' | 'evening'
   * @param {string} selectedDate - YYYY-MM-DD
   * @returns {{ isClosed: boolean, reason: string }}
   */
  const getSlotTimeStatus = (slotId, selectedDate) => {
    const todayIso = new Date().toISOString().split('T')[0];
    if (selectedDate !== todayIso) {
      // Future date — never time-closed
      return { isClosed: false, reason: '' };
    }
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    // Morning slot: cutoff at 13:00 (1:00 PM)
    if (slotId === 'morning') {
      const cutoff = 13 * 60; // 780 minutes
      if (currentTotalMinutes >= cutoff) {
        return { isClosed: true, reason: 'Slot closed for today — Morning OPD ended at 1:00 PM' };
      }
    }
    // Evening slot: cutoff at 14:00 (2:00 PM)
    if (slotId === 'evening') {
      const cutoff = 14 * 60; // 840 minutes
      if (currentTotalMinutes >= cutoff) {
        return { isClosed: true, reason: 'Slot closed for today — Afternoon OPD starts at 2:00 PM, walk-ins only' };
      }
    }
    return { isClosed: false, reason: '' };
  };

  // Auto-deselect the active slot if it becomes time-closed (e.g. tab was open past cutoff)
  useEffect(() => {
    if (selectedSlot) {
      const { isClosed } = getSlotTimeStatus(selectedSlot, consultationDate);
      if (isClosed) {
        setSelectedSlot(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationDate]);

  const [searchParams] = useSearchParams();
  const urlDoctorId = searchParams.get('doctorId');
  const urlDept = searchParams.get('dept');

  useEffect(() => {
    hospitalApi
      .getDoctors()
      .then((docs) => {
        setDoctors(docs || []);
        if (docs && docs.length > 0) {
          if (urlDoctorId) {
            const matched = docs.find((d) => d.doctor_id === urlDoctorId);
            if (matched) {
              setSelectedDoctorId(matched.doctor_id);
              setSelectedDept(matched.department);
              return;
            }
          }
          if (urlDept) {
            const matchedDeptDoc = docs.find(
              (d) => d.department.toLowerCase() === urlDept.toLowerCase()
            );
            if (matchedDeptDoc) {
              setSelectedDoctorId(matchedDeptDoc.doctor_id);
              setSelectedDept(matchedDeptDoc.department);
              return;
            }
          }
          setSelectedDoctorId(docs[0].doctor_id);
          setSelectedDept(docs[0].department);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingDoctors(false));
  }, [urlDoctorId, urlDept]);

  const handleDoctorChange = (docId) => {
    setSelectedDoctorId(docId);
    const found = doctors.find((d) => d.doctor_id === docId);
    if (found) {
      setSelectedDept(found.department);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedDoctorId) {
      setError('Please select a consulting specialist for your consultation.');
      return;
    }
    if (!selectedSlot) {
      setError('Please select a consultation slot (Morning or Afternoon/Evening).');
      return;
    }
    // Frontend time-closed guard — matches backend rule
    const { isClosed, reason } = getSlotTimeStatus(selectedSlot, consultationDate);
    if (isClosed) {
      setError(`Cannot book: ${reason}. Please select an available slot or choose a future date.`);
      return;
    }
    if (selectedSymptoms.length === 0 && !customSymptoms.trim()) {
      setError('Please select at least one primary symptom or describe your symptoms.');
      return;
    }
    if (!patientName.trim()) {
      setError('Please enter patient full name.');
      return;
    }
    if (!patientPhone.trim()) {
      setError('Please enter contact phone number.');
      return;
    }
    if (!age || Number(age) < 1) {
      setError('Please enter a valid age in years.');
      return;
    }
    if (!heightCm || Number(heightCm) < 40) {
      setError('Please enter patient height in cm for clinical vitals.');
      return;
    }

    setIsReviewing(true);
  };

  const executeBooking = async () => {
    setBookingLoading(true);
    setError(null);

    try {
      const payload = {
        patient_id: patientId,
        patient_name: patientName,
        name: patientName,
        phone: patientPhone,
        patient_phone: patientPhone,
        email: patientEmail,
        patient_email: patientEmail,
        age: age ? Number(age) : null,
        gender: gender,
        duration_days: durationDays ? Number(durationDays) : 1,
        height_cm: heightCm ? Number(heightCm) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
        city: city || 'Tumakuru',
        patient_address: locationAddress || city || 'Tumakuru',
        origin_latitude: originLatitude,
        origin_longitude: originLongitude,
        latitude: originLatitude,
        longitude: originLongitude,
        is_approximate_location: isApproximateLocation,
        is_approximate: isApproximateLocation,
        location_source: locationSource,
        location_address: locationAddress || city || 'Tumakuru',
        display_address: locationAddress || city || 'Tumakuru',
        booking_for: bookingFor,
        relation: relation,
        pdo: pdo,
        doctor_id: selectedDoctorId,
        department: selectedDept,
        consultation_date: consultationDate,
        consultation_slot: selectedSlot,
        priority: priority,
        symptoms: selectedSymptoms,
        custom_symptoms: customSymptoms
      };

      const res = await hospitalApi.bookAppointment(payload);
      setBookingResult(res);
      setIsReviewing(false);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        setError(formatErrorMessage(err, 'Authentication required. Please log in with your patient account before booking.'));
      } else if (err.response?.status === 403) {
        setError(formatErrorMessage(err, 'Access forbidden (403). Only registered patient accounts are authorized to schedule outpatient consultations.'));
      } else {
        setError(formatErrorMessage(err, 'Failed to book appointment. Please verify backend status.'));
      }
    } finally {
      setBookingLoading(false);
    }
  };

  const handleTrackConsultation = () => {
    const qId = bookingResult?.queue_id || bookingResult?.booking_id;
    if (qId) {
      navigate(`/tracking?queue_id=${qId}`);
    } else {
      navigate('/patient');
    }
  };

  const selectedDoctor = doctors.find((d) => d.doctor_id === selectedDoctorId);

  return (
    <div className="min-h-screen bg-slate-50/70 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Page Header */}
        <div className="text-center max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
            <Stethoscope className="w-3.5 h-3.5 text-sky-600" />
            <span>{t('opd_live', 'Outpatient Department (OPD)')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            {t('schedule_consultation', 'Schedule Clinical Consultation')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {t('booking_subtitle', 'Book up to 2 days in advance with automatic queue token allocation, Random Forest AI wait-time estimation, and SIMSRH departure guidance.')}
          </p>
        </div>

        {!bookingResult ? (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm space-y-8"
          >
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <span className="font-extrabold block">Booking Encountered An Issue</span>
                  <span>{formatErrorMessage(error)}</span>
                </div>
              </div>
            )}

            {/* STEP 1: DATE PICKER */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>{t('select_consultation_date', 'Select Consultation Date (Max 2 Days Ahead)')}</span>
                </label>
                <span className="text-[11px] text-slate-400 font-semibold">{t('active_opd_window', 'Active OPD Window')}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {dateOptions.map((opt) => {
                  const isSelected = consultationDate === opt.iso;
                  return (
                    <button
                      key={opt.iso}
                      type="button"
                      onClick={() => setConsultationDate(opt.iso)}
                      className={`p-4 rounded-2xl border text-center transition cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-r from-sky-600 to-teal-600 text-white border-sky-600 shadow-md ring-4 ring-sky-100'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-extrabold">{opt.label}</div>
                      <div className={`text-[11px] font-semibold mt-0.5 ${isSelected ? 'text-sky-100' : 'text-slate-500'}`}>
                        {opt.dateStr}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: DOCTOR SELECTION */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>{t('choose_doctor', 'Choose Medical Specialist & Clinic')}</span>
                </label>
                <Link to="/doctors" className="text-[11px] font-bold text-sky-600 hover:underline">
                  {t('browse_specialists', 'Browse All Specialists')}
                </Link>
              </div>

              {loadingDoctors ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-600" />
                  <span>{t('loading', 'Loading specialist registry...')}</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1 pr-2">
                  {doctors.map((doc) => {
                    const isSelected = selectedDoctorId === doc.doctor_id;
                    return (
                      <button
                        key={doc.doctor_id}
                        type="button"
                        onClick={() => handleDoctorChange(doc.doctor_id)}
                        className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-sky-50/70 border-sky-500 ring-2 ring-sky-300 shadow-xs'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-slate-900">{doc.name}</span>
                            <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md ${
                              doc.available
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}>
                              {doc.available ? `● ${t('available', 'Available')}` : `○ ${t('off_duty', 'Off-Duty')}`}
                            </span>
                          </div>
                          <div className="text-xs text-sky-700 font-bold">{doc.department}</div>
                          <div className="text-[11px] text-slate-500 truncate">{doc.specialization}</div>
                        </div>

                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200/60 text-[11px]">
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <DoorOpen className="w-3.5 h-3.5" />
                            <span>{doc.consultation_room || doc.room_number || 'Room 204'}</span>
                          </span>
                          <span className="text-purple-700 font-bold flex items-center gap-1">
                            <Cpu className="w-3 h-3" />
                            <span>~{doc.avg_consultation_duration || 12}m {t('avg', 'avg')}</span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* STEP 3: CONSULTATION SLOT SELECTION */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">3</span>
                  <span>{t('choose_slot', 'Select Consultation Slot')}</span>
                </label>
                <span className="text-[11px] text-slate-500 font-semibold">
                  {loadingSlots ? t('loading', 'Updating capacity...') : `${slotData?.total_active_queue || 0} ${t('in_queue', 'currently in queue')}`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Morning Slot Card */}
                {(() => {
                  const mSlot = slotData?.slots?.morning;
                  const isSelected = selectedSlot === 'morning';
                  const remaining = mSlot ? mSlot.remaining_capacity : 40;
                  const isFull = mSlot ? mSlot.is_full : false;
                  const { isClosed: isTimeClosed, reason: closedReason } = getSlotTimeStatus('morning', consultationDate);
                  const isDisabled = isFull || isTimeClosed;
                  return (
                    <button
                      key="slot-morning"
                      type="button"
                      disabled={isDisabled}
                      onClick={() => !isDisabled && setSelectedSlot('morning')}
                      className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
                        isSelected && !isTimeClosed
                          ? 'bg-gradient-to-br from-amber-500/10 via-sky-500/10 to-teal-500/10 border-sky-500 ring-2 ring-sky-300 shadow-sm cursor-pointer'
                          : isTimeClosed
                          ? 'bg-slate-100 border-slate-300 opacity-70 cursor-not-allowed'
                          : isFull
                          ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sun className={`w-4 h-4 ${isSelected && !isTimeClosed ? 'text-amber-500' : 'text-amber-600'}`} />
                            <span className="font-extrabold text-xs text-slate-900">{t('morning_slot_title', 'Morning Slot')}</span>
                          </div>
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md ${
                            isTimeClosed
                              ? 'bg-slate-200 text-slate-600'
                              : isFull
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isTimeClosed
                              ? '⏱ Slot Closed'
                              : isFull
                              ? `● ${t('slot_full', 'Full')}`
                              : `● ${t('spots_left', { count: remaining }, `${remaining} spots left`)}`}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-sky-700 mt-1">09:00 AM – 01:00 PM</div>
                        {isTimeClosed ? (
                          <p className="text-[11px] text-rose-600 font-semibold mt-1">
                            🔒 {closedReason}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 mt-1">
                            {t('morning_slot_desc', 'Ideal for morning outpatient checkups, early diagnostic blood work, and standard consultations.')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2.5 mt-3 border-t border-slate-200/60 text-[11px]">
                        <span className="text-slate-500 font-medium">
                          {t('booked_ratio', { booked: mSlot ? mSlot.booked_count : 0, max: mSlot ? mSlot.max_capacity : 40 }, `Booked: ${mSlot ? mSlot.booked_count : 0} / ${mSlot ? mSlot.max_capacity : 40}`)}
                        </span>
                        <span className="text-sky-700 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>4 Hours</span>
                        </span>
                      </div>
                    </button>
                  );
                })()}

                {/* Afternoon/Evening Slot Card */}
                {(() => {
                  const eSlot = slotData?.slots?.evening;
                  const isSelected = selectedSlot === 'evening';
                  const remaining = eSlot ? eSlot.remaining_capacity : 50;
                  const isFull = eSlot ? eSlot.is_full : false;
                  const { isClosed: isTimeClosed, reason: closedReason } = getSlotTimeStatus('evening', consultationDate);
                  const isDisabled = isFull || isTimeClosed;
                  return (
                    <button
                      key="slot-evening"
                      type="button"
                      disabled={isDisabled}
                      onClick={() => !isDisabled && setSelectedSlot('evening')}
                      className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
                        isSelected && !isTimeClosed
                          ? 'bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-sky-500/10 border-indigo-500 ring-2 ring-indigo-300 shadow-sm cursor-pointer'
                          : isTimeClosed
                          ? 'bg-slate-100 border-slate-300 opacity-70 cursor-not-allowed'
                          : isFull
                          ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Moon className={`w-4 h-4 ${isSelected && !isTimeClosed ? 'text-indigo-600' : 'text-indigo-500'}`} />
                            <span className="font-extrabold text-xs text-slate-900">{t('evening_slot_title', 'Afternoon / Evening Slot')}</span>
                          </div>
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md ${
                            isTimeClosed
                              ? 'bg-slate-200 text-slate-600'
                              : isFull
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isTimeClosed
                              ? '⏱ Slot Closed'
                              : isFull
                              ? `● ${t('slot_full', 'Full')}`
                              : `● ${t('spots_left', { count: remaining }, `${remaining} spots left`)}`}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-indigo-700 mt-1">02:00 PM – 09:00 PM</div>
                        {isTimeClosed ? (
                          <p className="text-[11px] text-rose-600 font-semibold mt-1">
                            🔒 {closedReason}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 mt-1">
                            {t('evening_slot_desc', 'Extended hours for after-work visits, follow-up evaluations, and post-workday clinical appointments.')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2.5 mt-3 border-t border-slate-200/60 text-[11px]">
                        <span className="text-slate-500 font-medium">
                          {t('booked_ratio', { booked: eSlot ? eSlot.booked_count : 0, max: eSlot ? eSlot.max_capacity : 50 }, `Booked: ${eSlot ? eSlot.booked_count : 0} / ${eSlot ? eSlot.max_capacity : 50}`)}
                        </span>
                        <span className="text-indigo-700 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>7 Hours</span>
                        </span>
                      </div>
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* STEP 4: SYMPTOM SELECTOR */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  {t('report_symptoms', 'Report Presenting Symptoms')}
                </span>
              </div>
              <SymptomSelector
                selectedSymptoms={selectedSymptoms}
                onChangeSymptoms={setSelectedSymptoms}
                customSymptoms={customSymptoms}
                onChangeCustomSymptoms={setCustomSymptoms}
              />
            </div>

            {/* STEP 5: CLINICAL CONSULTATION DETAILS (Doctor Handover Information) */}
            <div className="border-t border-slate-100 pt-6 space-y-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold">5</span>
                  <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    {t('clinical_details', 'Clinical Consultation Details')}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">{t('provided_to_doctor', 'Provided to Doctor at Consultation')}</span>
              </div>

              {isReturningPatient && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>{t('pre_fill_notice')}</span>
                </div>
              )}

              {/* STEP 5.1: WHO IS THIS APPOINTMENT FOR? */}
              <div className="space-y-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-sky-600" />
                    <span>{t('who_is_appointment_for', 'Who is this appointment for?')}</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {bookingFor === 'myself' ? 'Self Consultation' : 'Family Member / Dependent'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleBookingForChange('myself')}
                    className={`p-3.5 rounded-xl border text-center transition cursor-pointer flex items-center justify-center gap-2 ${
                      bookingFor === 'myself'
                        ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-200 font-black shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <User className="w-4 h-4 text-sky-600" />
                    <span>{t('myself', 'Myself')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBookingForChange('family_member')}
                    className={`p-3.5 rounded-xl border text-center transition cursor-pointer flex items-center justify-center gap-2 ${
                      bookingFor === 'family_member'
                        ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-200 font-black shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-4 h-4 text-sky-600" />
                    <span>{t('family_member_dependent', 'Family member / dependent')}</span>
                  </button>
                </div>

                {bookingFor === 'family_member' && (
                  <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                    <div className="text-xs text-slate-600 font-semibold">
                      <span>{t('patient_relation', 'Relationship to Patient')}:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {['Mother', 'Father', 'Spouse', 'Child', 'Other'].map((relOption) => (
                        <button
                          key={relOption}
                          type="button"
                          onClick={() => setRelation(relOption)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            relation === relOption
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {relOption === 'Mother' ? t('relation_mother', 'Mother')
                            : relOption === 'Father' ? t('relation_father', 'Father')
                            : relOption === 'Spouse' ? t('relation_spouse', 'Spouse')
                            : relOption === 'Child' ? t('relation_child', 'Child')
                            : t('relation_other', 'Other')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Priority Toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPriority('normal')}
                  className={`p-3.5 rounded-2xl border text-center transition cursor-pointer ${
                    priority === 'normal'
                      ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-200 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-extrabold">{t('standard_opd', 'Standard OPD Consultation')}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{t('regular_order', 'Regular waiting order')}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPriority('emergency')}
                  className={`p-3.5 rounded-2xl border text-center transition cursor-pointer ${
                    priority === 'emergency'
                      ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-200 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-extrabold flex items-center justify-center gap-1 text-rose-700">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{t('emergency_priority', 'Emergency Priority')}</span>
                  </div>
                  <div className="text-[10px] text-rose-600/80 mt-0.5">{t('immediate_triage', 'Immediate triage attention')}</div>
                </button>
              </div>

              {/* Row 1: Name, Phone, Age, Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    {bookingFor === 'family_member' ? `${relation || 'Patient'} Full Name *` : `${t('full_name', 'Patient Full Name')} *`}
                  </label>
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{t('age_years', 'Age (Years)')} *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 42"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{t('gender', 'Gender')} *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  >
                    <option value="Male">{t('male', 'Male')}</option>
                    <option value="Female">{t('female', 'Female')}</option>
                    <option value="Other">{t('other', 'Other')}</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Duration, Height, Weight, Calculated BMI */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{t('days_suffering_label', 'Days Suffering Problem *')}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="365"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    placeholder="e.g. 3 days"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{t('height_label', 'Height (cm) *')}</label>
                  <input
                    type="number"
                    required
                    min="40"
                    max="250"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="e.g. 168"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{t('weight_label', 'Weight (kg, optional)')}</label>
                  <input
                    type="number"
                    min="2"
                    max="300"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="e.g. 70"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-teal-600" />
                    <span>{t('calculated_bmi', 'Calculated BMI')}</span>
                  </label>
                  <div className="w-full px-3.5 py-2.5 bg-teal-50/70 border border-teal-200 rounded-xl text-xs font-bold text-teal-900 flex items-center justify-between">
                    <span>{calculatedBmi ? `${calculatedBmi} kg/m²` : 'Enter Ht & Wt'}</span>
                    {calculatedBmi && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-200 text-teal-900">
                        {Number(calculatedBmi) < 18.5 ? 'Underweight' : Number(calculatedBmi) < 25 ? 'Normal' : 'Overweight'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Contact Phone, Email, Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{t('contact_phone_label', 'Contact Phone')} *</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="tel"
                      required
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{t('email_address_label', 'Email Address')}</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="email"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      placeholder="patient@example.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">PDO / Reference</label>
                  <input
                    type="text"
                    value={pdo}
                    onChange={(e) => setPdo(e.target.value)}
                    placeholder="Optional health center ref"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* STEP 5.2: PATIENT LOCATION SELECTION */}
              <PatientLocationSelector
                value={{
                  location_source: locationSource,
                  origin_latitude: originLatitude,
                  origin_longitude: originLongitude,
                  patient_address: locationAddress || city,
                  location_address: locationAddress || city,
                  city: city,
                  is_approximate_location: isApproximateLocation
                }}
                onChange={(locData) => {
                  setLocationSource(locData.location_source);
                  setOriginLatitude(locData.origin_latitude);
                  setOriginLongitude(locData.origin_longitude);
                  setIsApproximateLocation(locData.is_approximate_location);
                  setLocationAddress(locData.location_address || locData.patient_address || '');
                  setCity(locData.city || 'Tumakuru');
                  if (locData.location_source === 'device_gps') {
                    setGpsStatus('granted');
                    setGpsMessage(`Precise GPS captured: ${locData.origin_latitude?.toFixed(4)}° N, ${locData.origin_longitude?.toFixed(4)}° E`);
                  } else {
                    setGpsStatus('idle');
                    setGpsMessage('');
                  }
                }}
                bookingFor={bookingFor}
                relation={relation}
              />
            </div>

            {/* STEP 5: REVIEW DETAILS BEFORE CONFIRMATION */}
            {isReviewing ? (
              <div className="border-t-2 border-teal-300 pt-6 space-y-6 bg-teal-50/30 p-6 rounded-3xl border border-teal-200 animate-fadeIn">
                <div className="flex items-center justify-between pb-3 border-b border-teal-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs font-bold">5</span>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {t('review_details_title', 'Review Details Before Confirmation')}
                    </h3>
                  </div>
                  <span className="px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-bold">
                    {t('ready_to_confirm', 'Ready to Confirm')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Summary 1: Patient Information */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-sky-600" /> {t('patient_info', 'Patient Information')}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-sky-100 text-sky-800">
                        {bookingFor === 'myself' ? 'Self' : `${relation || 'Family'}`}
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-900">{patientName}</div>
                    <div className="space-y-1 text-slate-600 text-[11px]">
                      <div>Demographics: <strong className="text-slate-800">{age} yrs • {gender}</strong></div>
                      <div>Phone: <strong className="text-slate-800 font-mono">{patientPhone}</strong></div>
                      <div>
                        Origin: <strong className="text-slate-800">📍 {locationAddress || city}</strong>
                        {locationSource === 'map_selected' && originLatitude && originLongitude ? (
                          <div className="mt-0.5 text-[10px] text-sky-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-sky-600 shrink-0" />
                            <span>Map Selected: {originLatitude.toFixed(4)}° N, {originLongitude.toFixed(4)}° E</span>
                          </div>
                        ) : locationSource === 'device_gps' && originLatitude && originLongitude ? (
                          <div className="mt-0.5 text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Device GPS: {originLatitude.toFixed(4)}° N, {originLongitude.toFixed(4)}° E</span>
                          </div>
                        ) : (
                          <div className="mt-0.5 text-[10px] text-amber-700 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Approximate location — travel time may vary</span>
                          </div>
                        )}
                      </div>
                      <div className="pt-1 border-t border-slate-100 text-teal-800 font-semibold">
                        Vitals: {heightCm} cm • {weightKg ? `${weightKg} kg` : 'Weight not logged'}
                        {calculatedBmi && ` (BMI: ${calculatedBmi})`}
                      </div>
                    </div>
                  </div>

                  {/* Summary 2: Clinical Details */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                      <HeartPulse className="w-3.5 h-3.5 text-teal-600" /> {t('clinical_complaints', 'Clinical Complaints')}
                    </span>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Symptoms Reported:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedSymptoms.length > 0 ? (
                          selectedSymptoms.map((s, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-sky-50 text-sky-900 border border-sky-200 rounded text-[11px] font-semibold">
                              • {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 italic">General OPD checkup</span>
                        )}
                      </div>
                    </div>
                    {customSymptoms && (
                      <div className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100">
                        "{customSymptoms}"
                      </div>
                    )}
                    <div className="text-[11px] text-slate-600 pt-1">
                      Duration: <strong className="text-slate-800">{durationDays} day(s)</strong> • Priority: <strong className={priority === 'emergency' ? 'text-rose-700' : 'text-slate-800'}>{priority.toUpperCase()}</strong>
                    </div>
                  </div>

                  {/* Summary 3: Appointment & Allocation */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5 text-purple-600" /> {t('specialist_and_opd', 'Specialist & OPD')}
                    </span>
                    <div className="text-sm font-black text-slate-900">
                      {selectedDoctor?.name || 'Selected Specialist'}
                    </div>
                    <div className="text-xs font-bold text-sky-700">{selectedDept}</div>
                    <div className="space-y-1 text-slate-600 text-[11px] pt-1 border-t border-slate-100">
                      <div>Consultation Date: <strong className="text-slate-800">{consultationDate}</strong></div>
                      <div>Consultation Slot: <strong className="text-sky-700">{selectedSlot === 'morning' ? 'Morning (09:00 AM – 01:00 PM)' : 'Afternoon/Evening (02:00 PM – 09:00 PM)'}</strong></div>
                      <div>Room: <strong className="text-emerald-700">{selectedDoctor?.room_number || 'Room 204'}</strong></div>
                      <div className="text-purple-700 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> AI Wait Time Model Active
                      </div>
                    </div>
                  </div>
                </div>

                {/* Final Review Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsReviewing(false)}
                    className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{t('edit_details', 'Edit Details')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={executeBooking}
                    disabled={bookingLoading}
                    className="flex-1 w-full py-4 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 cursor-pointer disabled:opacity-60"
                  >
                    {bookingLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t('confirming_slot', 'Confirming OPD Consultation Slot & Allocating Token...')}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('confirm_booking_btn', 'Confirm Booking & Receive Token + Arrival Code')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* PROCEED TO REVIEW DETAILS BUTTON */
              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 cursor-pointer"
              >
                <span>{t('proceed_to_review', 'Proceed to Review Details')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </form>
        ) : (
          /* ========================================================================= */
          /* BOOKING CONFIRMATION & SMART ARRIVAL CARD                                  */
          /* ========================================================================= */
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm text-center space-y-6">
              
              <div>
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-extrabold uppercase tracking-wider mb-2">
                  {t('booking_confirmed', 'Consultation Confirmed')}
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {t('booking_reference', 'Booking Reference')}: <span className="font-mono text-sky-700">{bookingResult.booking_id}</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Confirmed for {bookingResult.consultation_date} at {t('hospital_name', 'Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH)')}, Tumakuru.
                </p>
              </div>

              {/* 2 SPOTLIGHT BOXES: TOKEN NUMBER & ARRIVAL OTP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                <div className="bg-gradient-to-br from-sky-50 to-teal-50 border-2 border-sky-300 rounded-2xl p-5 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-800 block mb-1">
                    {t('queue_token_number', 'Your Queue Token Number')}
                  </span>
                  <div className="text-3xl sm:text-4xl font-black text-sky-900 font-mono">
                    {bookingResult.queue_id || bookingResult.booking_id || '—'}
                  </div>
                  <div className="text-xs font-bold text-sky-700 mt-1">
                    {t('queue_pos', 'Queue Position')}: #{bookingResult.queue_position || 1}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Live OPD waiting line. Position dynamically updates.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-emerald-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block mb-1">
                    {t('arrival_code_title', '6-Digit Hospital Arrival Code')}
                  </span>
                  <div className="text-3xl sm:text-4xl font-black text-emerald-700 font-mono tracking-widest">
                    {bookingResult.arrival_otp || '123456'}
                  </div>
                  <div className="text-xs font-bold text-amber-800 mt-1">
                    {t('verify_at_reception', 'Verify at Reception Desk')}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    🔒 {t('present_code_reception', 'Present this code to reception upon arriving at SIMSRH to verify arrival.')}
                  </p>
                </div>
              </div>

              {/* CLINICAL SUMMARY BADGES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-left bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">{t('doctor', 'Specialist Doctor')}</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {selectedDoctor ? selectedDoctor.name : 'Assigned Specialist'}
                  </span>
                  <div className="text-sky-700 font-semibold text-[11px]">{selectedDept}</div>
                </div>

                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">{t('chamber_room', 'Clinic & Room')}</span>
                  <span className="font-extrabold text-emerald-700 text-sm flex items-center gap-1 mt-0.5">
                    <DoorOpen className="w-4 h-4" />
                    <span>{bookingResult.room_number || 'Room 204'}</span>
                  </span>
                  <div className="text-slate-500 text-[11px]">OPD Wing B</div>
                </div>

                <div>
                  <span className="text-sky-700 block font-bold text-[10px] uppercase flex items-center gap-1">
                    <Clock className="w-3 h-3 text-sky-600" />
                    <span>{t('consultation_slot', 'Slot Allocated')}</span>
                  </span>
                  <span className="font-extrabold text-sky-900 text-sm mt-0.5 block">
                    {bookingResult.consultation_slot?.slot_name || (selectedSlot === 'morning' ? t('morning_slot_title', 'Morning Slot') : t('evening_slot_title', 'Afternoon/Evening'))}
                  </span>
                  <div className="text-sky-600 text-[11px]">
                    {bookingResult.consultation_slot?.display_time || (selectedSlot === 'morning' ? '09:00 AM – 01:00 PM' : '02:00 PM – 09:00 PM')}
                  </div>
                </div>

                <div>
                  <span className="text-purple-600 block font-bold text-[10px] uppercase flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-purple-600" />
                    <span>{t('estimated_wait_time', 'Estimated Wait Time')}</span>
                  </span>
                  <span className="font-extrabold text-purple-900 text-sm mt-0.5 block">
                    ~{bookingResult.predicted_wait_time || 15} mins
                  </span>
                  <div className="text-purple-600 text-[11px]">Random Forest ML Model</div>
                </div>

                <div>
                  <span className="text-teal-700 block font-bold text-[10px] uppercase flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-teal-600" />
                    <span>{t('recommended_departure', 'Recommended Departure')}</span>
                  </span>
                  <span className="font-extrabold text-teal-900 text-sm mt-0.5 block">
                    {bookingResult.travel_info?.recommended_departure_time || 'Leave Soon'}
                  </span>
                  <div className="text-teal-700 text-[11px] flex items-center justify-center sm:justify-start gap-1">
                    <span>From {bookingResult.city || city}</span>
                    {bookingResult.origin_latitude ? (
                      <span className="px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded font-semibold text-[10px]">Exact GPS</span>
                    ) : (
                      <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">Approximate</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleTrackConsultation}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-2xl text-xs font-bold transition shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{t('track_consultation', 'Track Live Queue Status & Map')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <Link
                  to="/patient"
                  className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition text-center"
                >
                  {t('my_dashboard', 'Go to Patient Dashboard')}
                </Link>
              </div>
            </div>

            {/* INTEGRATED TUMKUR DEPARTURE CALCULATOR */}
            <DepartureCard travelInfo={bookingResult.travel_info} />
          </div>
        )}

      </div>
    </div>
  );
}