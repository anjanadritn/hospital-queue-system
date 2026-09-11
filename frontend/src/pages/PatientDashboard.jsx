import React, { useState, useEffect } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { Activity, Stethoscope, Calendar, Clock, Navigation, DoorOpen, Plus, ArrowRight, ShieldCheck } from 'lucide-react';

import { hospitalApi } from '../api/hospitalApi';

import { useAuth } from '../context/AuthContext';

import DepartureCard from '../components/DepartureCard';

export default function PatientDashboard() {

  const { user } = useAuth();

  const navigate = useNavigate();

  const [appointments, setAppointments] = useState([]);

  const [loading, setLoading] = useState(true);

  const [joining, setJoining] = useState(false);

  useEffect(() => {

    if (!user?.patient_id) return;

    hospitalApi.getPatientAppointments(user.patient_id)

      .then((apts) => setAppointments(apts || []))

      .catch(console.error)

      .finally(() => setLoading(false));

  }, [user]);

  const latestAppointment = appointments.length > 0 ? appointments[0] : null;

  const handleJoinQueue = async (appointment) => {

    setJoining(true);

    try {

      const res = await hospitalApi.joinQueue({

        patient_id: user.patient_id,

        doctor_id: appointment.doctor_id,

        department: appointment.department,

        priority: appointment.priority || 'normal',

        symptoms: appointment.symptoms || [],

        custom_symptoms: appointment.custom_symptoms || ''

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

      setJoining(false);

    }

  };

  return (

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

      {/* WELCOME BANNER */}

      <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-slate-950 rounded-3xl p-8 sm:p-10 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

        <div>

          <span className="text-xs font-extrabold uppercase tracking-widest text-sky-400 block mb-2">

            Patient Portal & Smart Departure System

          </span>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">

            Welcome, {user?.name || 'Patient'}

          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">

            Track your upcoming consultation, monitor live queue movement, and view recommended departure times.

          </p>

        </div>

        <Link

          to="/book"

          className="w-full md:w-auto px-6 py-3.5 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-2xl text-xs transition shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2"

        >

          <Plus className="w-4 h-4" /> Book New Consultation

        </Link>

      </div>

      {/* MAIN HERO CARD: YOUR NEXT CONSULTATION */}

      {latestAppointment ? (

        <div className="space-y-6">

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-sky-200/80 shadow-md">

            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">

              <span className="text-xs font-extrabold uppercase tracking-wider text-sky-600 flex items-center gap-1.5">

                <Calendar className="w-4 h-4" /> Your Next Consultation

              </span>

              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200">

                {latestAppointment.status.toUpperCase()}

              </span>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">

              <div>

                <span className="text-[11px] font-semibold text-slate-400 block">Doctor & Department</span>

                <div className="text-lg font-bold text-slate-900">{latestAppointment.doctor_id || 'Dr. Ananya Sharma'}</div>

                <div className="text-xs font-semibold text-sky-700">{latestAppointment.department || 'Cardiology'}</div>

              </div>

              <div>

                <span className="text-[11px] font-semibold text-slate-400 block">Location</span>

                <div className="text-lg font-bold text-emerald-700 flex items-center gap-1">

                  <DoorOpen className="w-5 h-5" />

                  <span>{latestAppointment.room_number || 'Room 204'}</span>

                </div>

              </div>

              <div>

                <span className="text-[11px] font-semibold text-slate-400 block">Consultation Date</span>

                <div className="text-lg font-bold text-slate-900">{latestAppointment.consultation_date}</div>

              </div>

            </div>

            {/* Symptoms summary */}

            {latestAppointment.symptoms && latestAppointment.symptoms.length > 0 && (

              <div className="bg-slate-50 p-3 rounded-xl mb-6 text-xs text-slate-600">

                <span className="font-bold text-slate-800">Presenting Symptoms: </span>

                {latestAppointment.symptoms.join(', ')}

              </div>

            )}

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">

              {latestAppointment.queue_id ? (

                <Link

                  to={`/tracking?queue_id=${latestAppointment.queue_id}`}

                  className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2"

                >

                  <span>Track Live Queue & Hospital Mode</span>

                  <ArrowRight className="w-4 h-4" />

                </Link>

              ) : (

                <button

                  onClick={() => handleJoinQueue(latestAppointment)}

                  disabled={joining}

                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 disabled:opacity-60"

                >

                  <span>{joining ? 'Joining Queue...' : 'Join Live Queue'}</span>

                  <ArrowRight className="w-4 h-4" />

                </button>

              )}

            </div>

          </div>

          <DepartureCard travelInfo={latestAppointment.travel_info} />

        </div>

      ) : (

        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 max-w-md mx-auto">

          <Stethoscope className="w-12 h-12 text-sky-500 mx-auto mb-3" />

          <h3 className="text-lg font-bold text-slate-900 mb-1">No Active Consultations</h3>

          <p className="text-xs text-slate-500 mb-6">Book an advance consultation up to 2 days ahead to receive queue departure alerts.</p>

          <Link

            to="/book"

            className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-sm"

          >

            <span>Book Consultation Now</span>

            <ArrowRight className="w-4 h-4" />

          </Link>

        </div>

      )}

    </div>

  );

}