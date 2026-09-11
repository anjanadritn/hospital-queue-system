import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, User, Stethoscope, Clock, CheckCircle2, AlertCircle, Loader2, DoorOpen, Navigation, ArrowRight } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import SymptomSelector from '../components/SymptomSelector';
import DepartureCard from '../components/DepartureCard';

export default function BookAppointment() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  // Form State - Use authenticated user's data
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [selectedDept, setSelectedDept] = useState('General Medicine');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [consultationDate, setConsultationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [customSymptoms, setCustomSymptoms] = useState('');
  const [priority, setPriority] = useState('normal');

  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bookingResult, setBookingResult] = useState(null);

  const [joiningQueue, setJoiningQueue] = useState(false);

  // Initialize patient info from authenticated user
  useEffect(() => {
    if (!authLoading && user) {
      setPatientId(user.patient_id || user.user_id || '');
      setPatientName(user.name || user.full_name || 'Patient');
    }
  }, [user, authLoading]);

  // Dates: Today, Tomorrow, Day After Tomorrow (Max 2 Days Advance Booking)
  const today = new Date();
  const dateOptions = [0, 1, 2].map((offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const iso = d.toISOString().split('T')[0];
    let label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : 'Day After Tomorrow';
    return { iso, label, dateStr: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) };
  });

  useEffect(() => {
    hospitalApi.getDoctors()
      .then((docs) => {
        setDoctors(docs || []);
        if (docs && docs.length > 0) {
          setSelectedDoctorId(docs[0].doctor_id);
          setSelectedDept(docs[0].department);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingDoctors(false));
  }, []);

  const handleDoctorChange = (docId) => {
    setSelectedDoctorId(docId);
    const found = doctors.find((d) => d.doctor_id === docId);
    if (found) {
      setSelectedDept(found.department);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBookingLoading(true);
    setError(null);

    try {
      const payload = {
        patient_id: patientId,
        name: patientName,
        doctor_id: selectedDoctorId,
        department: selectedDept,
        consultation_date: consultationDate,
        priority: priority,
        symptoms: selectedSymptoms,
        custom_symptoms: customSymptoms
      };

      const res = await hospitalApi.bookAppointment(payload);
      setBookingResult(res);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to book appointment. Please verify backend status.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleTrackConsultation = async () => {
    if (!bookingResult) return;
    setJoiningQueue(true);
    try {
      const res = await hospitalApi.joinQueue({
        patient_id: bookingResult.patient_id || patientId,
        doctor_id: bookingResult.doctor_id || selectedDoctorId,
        department: bookingResult.department || selectedDept,
        priority: bookingResult.priority || priority,
        symptoms: bookingResult.symptoms || selectedSymptoms,
        custom_symptoms: bookingResult.custom_symptoms || customSymptoms
      });

      const queueId = res.queue_id || res.data?.queue_id;

      if (queueId) {
        navigate(`/tracking?queue_id=${queueId}`);
      } else {
        console.error('No queue_id returned from join queue response', res);
      }
    } catch (err) {
      console.error('Failed to join queue', err);
    } finally {
      setJoiningQueue(false);
    }
  };

  const selectedDoctor = doctors.find((d) => d.doctor_id === selectedDoctorId);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">Book Advance Consultation</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Book up to 2 days in advance and receive Random Forest wait-time predictions & departure alerts
        </p>
      </div>

      {!bookingResult ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: DATE PICKER (STRICT 2-DAY LIMIT) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              1. Select Consultation Date (Max 2 Days in Advance)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {dateOptions.map((opt) => (
                <button
                  key={opt.iso}
                  type="button"
                  onClick={() => setConsultationDate(opt.iso)}
                  className={`p-3 rounded-2xl border text-center transition ${
                    consultationDate === opt.iso
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-extrabold">{opt.label}</div>
                  <div className="text-[11px] font-semibold opacity-90">{opt.dateStr}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              * Note: To optimize live queue flow, consultations can be booked today, tomorrow, or day after tomorrow only.
            </p>
          </div>

          {/* STEP 2: DOCTOR SELECTION */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              2. Select Specialist Doctor & Department
            </label>
            
            {loadingDoctors ? (
              <p className="text-xs text-slate-500 py-2">Loading hospital specialists...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto p-1">
                {doctors.map((doc) => (
                  <button
                    key={doc.doctor_id}
                    type="button"
                    onClick={() => handleDoctorChange(doc.doctor_id)}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                      selectedDoctorId === doc.doctor_id
                        ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-200'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{doc.name}</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                          {doc.consultation_room || 'Room 204'}
                        </span>
                      </div>
                      <p className="text-[11px] text-sky-700 font-semibold">{doc.department}</p>
                      <p className="text-[10px] text-slate-500">{doc.specialization}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* STEP 3: SYMPTOM SELECTOR */}
          <SymptomSelector
            selectedSymptoms={selectedSymptoms}
            onChangeSymptoms={setSelectedSymptoms}
            customSymptoms={customSymptoms}
            onChangeCustomSymptoms={setCustomSymptoms}
          />

          {/* STEP 4: PATIENT DETAILS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Patient ID</label>
              <input
                type="text"
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Patient Name</label>
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
              />
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={bookingLoading}
            className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md"
          >
            {bookingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Generate Consultation Ticket'}
          </button>

        </form>
      ) : (
        /* BOOKING SUCCESS VIEW */
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-200 shadow-md text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Consultation Booked!</h2>
            <p className="text-xs text-slate-500 mb-6">Booking Reference ID: <span className="font-mono font-bold text-sky-700">{bookingResult.booking_id}</span></p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-left bg-slate-50 p-4 rounded-2xl border border-slate-200/80 mb-6 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Doctor</span>
                <span className="font-bold text-slate-900">{selectedDoctor ? selectedDoctor.name : 'Dr. Ananya Sharma'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Consultation Location</span>
                <span className="font-bold text-emerald-700">{bookingResult.room_number || 'Room 204'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">AI Estimated Duration</span>
                <span className="font-bold text-sky-700">~{bookingResult.predicted_consultation_duration || 15} mins</span>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={handleTrackConsultation}
                disabled={joiningQueue}
                className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 disabled:opacity-60"
              >
                <span>{joiningQueue ? 'Joining Queue...' : 'Join Queue & Track Consultation'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <DepartureCard travelInfo={bookingResult.travel_info} />
        </div>
      )}

    </div>
  );
}