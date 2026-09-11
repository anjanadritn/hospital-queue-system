import React, { useState, useEffect } from 'react';

import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Activity, Stethoscope, Search, LayoutDashboard, HeartPulse, Calendar, LogIn, LogOut, UserCheck } from 'lucide-react';

import { hospitalApi } from '../api/hospitalApi';

import { useAuth } from '../context/AuthContext';

import NotificationPanel from './NotificationPanel';

import Tooltip from './Tooltip';

export default function Navbar() {

  const location = useLocation();

  const navigate = useNavigate();

  const { user, isAuthenticated, logout } = useAuth();

  const [dbHealthy, setDbHealthy] = useState(null);

  useEffect(() => {

    hospitalApi.getHealth()

      .then(res => setDbHealthy(res.database_connected !== false))

      .catch(() => setDbHealthy(false));

  }, []);

  const handleLogout = () => {

    logout();

    navigate('/login');

  };

  const isPatient = user?.role === 'patient';

  const isStaff = user?.role === 'doctor' || user?.role === 'admin';

  return (

    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        {/* Brand Logo */}

        <Link to="/" className="flex items-center gap-2.5 group">

          <div className="w-10 h-10 bg-gradient-to-tr from-sky-600 to-teal-500 rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition">

            <HeartPulse className="w-6 h-6" />

          </div>

          <div>

            <span className="font-extrabold text-lg text-slate-900 tracking-tight block leading-tight">

              SMART<span className="text-sky-600">HOSPITAL</span>

            </span>

            <span className="text-[10px] font-medium text-slate-500 block -mt-0.5">

              Queue & Care Platform

            </span>

          </div>

        </Link>

        {/* Dynamic Navigation */}

        <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60">

          {/* Find Doctor (Public) */}

          <Tooltip text="Find doctors by department and specialty." position="bottom">

            <Link

              to="/doctors"

              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${

                location.pathname === '/doctors' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'

              }`}

            >

              <Stethoscope className="w-4 h-4" /> Find Doctor

            </Link>

          </Tooltip>

          {/* Book Consultation */}

          <Tooltip text="Schedule a consultation with a doctor." position="bottom">

            <Link

              to="/book"

              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${

                location.pathname === '/book' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'

              }`}

            >

              <Calendar className="w-4 h-4" /> Book Consultation

            </Link>

          </Tooltip>

          {/* Logged in Patient Links */}

          {isAuthenticated && isPatient && (

            <>

              <Tooltip text="View your appointments, queue and consultation information." position="bottom">

                <Link

                  to="/patient"

                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${

                    location.pathname === '/patient' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'

                  }`}

                >

                  <Activity className="w-4 h-4" /> My Appointments

                </Link>

              </Tooltip>

              <Tooltip text="See your queue position and estimated waiting time." position="bottom">

                <Link

                  to="/tracking"

                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${

                    location.pathname === '/tracking' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'

                  }`}

                >

                  <Search className="w-4 h-4" /> Track My Queue

                </Link>

              </Tooltip>

            </>

          )}

          {/* Logged in Staff Links (Doctor / Admin) */}

          {isAuthenticated && isStaff && (

            <Tooltip text="Manage live queues, patients and consultations." position="bottom">

              <Link

                to="/staff"

                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${

                  location.pathname === '/staff' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'

                }`}

              >

                <LayoutDashboard className="w-4 h-4" /> Staff Dashboard

              </Link>

            </Tooltip>

          )}

        </nav>

        {/* Right Action Bar */}

        <div className="flex items-center gap-3">

          {isAuthenticated && isPatient && (

            <Tooltip text="View appointment, queue, departure and hospital alerts." position="bottom">

              <NotificationPanel patientId={user?.patient_id} />

            </Tooltip>

          )}

          {isAuthenticated && user ? (

            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">

              <div className="text-right hidden sm:block">

                <span className="font-extrabold text-xs text-slate-900 block leading-tight">{user.name}</span>

                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md">

                  {user.role}

                </span>

              </div>

              <Tooltip text="Sign out of your Smart Hospital account." position="bottom">

                <button

                  onClick={handleLogout}

                  className="p-2 text-slate-500 hover:text-rose-600 rounded-xl hover:bg-slate-100 transition"

                  aria-label="Logout"

                >

                  <LogOut className="w-4 h-4" />

                </button>

              </Tooltip>

            </div>

          ) : (

            <div className="flex items-center gap-2">

              <Link

                to="/login"

                className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs"

              >

                <LogIn className="w-4 h-4" />

                <span>Login</span>

              </Link>

              <Link

                to="/signup"

                className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"

              >

                <span>Create Account</span>

              </Link>

            </div>

          )}

        </div>

      </div>

    </header>

  );

}