import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Tv,
  Users,
  Clock,
  Stethoscope,
  DoorOpen,
  Activity,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';

export default function TvDisplay() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlDoctorId = searchParams.get('doctor') || '';
  const urlDept = searchParams.get('department') || '';

  // Data state
  const [queueData, setQueueData] = useState({
    doctor_queues: {},
    currently_consulting: [],
    next_patient: null,
    next_patients: [],
    upcoming_patients: [],
    total_active_queue: 0,
    last_updated: ''
  });
  const [doctorsList, setDoctorsList] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(urlDoctorId);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // TV Display Controls
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Audio announcement tracking
  const lastAnnouncedTokenRef = useRef(null);
  const initialLoadRef = useRef(true);
  const audioEnabledRef = useRef(audioEnabled);
  const activeUtteranceRef = useRef(null);

  // Keep audioEnabledRef synchronized with state
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  // Digital Clock timer (1-second tick)
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Fetch doctors list for doctor selector
  useEffect(() => {
    hospitalApi.getDoctors()
      .then((docs) => {
        const list = Array.isArray(docs) ? docs : (docs?.doctors || []);
        setDoctorsList(list);
        // If no doctor selected in URL, default to first doctor with an active queue or first doctor in list
        if (!selectedDoctorId && list.length > 0) {
          setSelectedDoctorId(list[0].doctor_id);
        }
      })
      .catch((err) => {
        console.error('Failed to load doctors list:', err);
      });
  }, []);

  // Voice Announcement Helper via Browser Web Speech API
  const announceToken = (tokenNumber, doctorName, roomNumber) => {
    if (!audioEnabledRef.current || !('speechSynthesis' in window)) return;
    if (!tokenNumber) return;

    try {
      // Chrome/Edge audio resume
      window.speechSynthesis.resume();
      window.speechSynthesis.cancel(); // Cancel any lingering speech

      const cleanToken = String(tokenNumber).replace(/^#/, '').trim();
      const cleanRoom = roomNumber || 'the consultation room';
      const cleanDoctor = doctorName ? ` for ${doctorName}` : '';
      const text = `Attention please. Token ${cleanToken}, please proceed to ${cleanRoom}${cleanDoctor}.`;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9; // Clear, measured waiting room cadence
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Select an English voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const enVoice = voices.find((v) => v.lang && v.lang.startsWith('en')) || voices[0];
        if (enVoice) utterance.voice = enVoice;
      }

      // Maintain reference in ref to prevent Chrome garbage collection bug
      activeUtteranceRef.current = utterance;
      utterance.onend = () => {
        if (activeUtteranceRef.current === utterance) {
          activeUtteranceRef.current = null;
        }
      };
      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        if (activeUtteranceRef.current === utterance) {
          activeUtteranceRef.current = null;
        }
      };

      window.speechSynthesis.speak(utterance);
      console.log('[TV Display Speech Announcement]:', text);
    } catch (e) {
      console.warn('Speech synthesis announcement error:', e);
    }
  };

  // Live Queue Fetcher
  const fetchLiveQueue = async () => {
    try {
      const data = await hospitalApi.getPublicQueue(urlDept, '', selectedDoctorId, '');
      if (data) {
        setQueueData(data);
        setLastRefreshed(new Date());

        // 1. Resolve current active doctor queue
        const dq = (selectedDoctorId && data.doctor_queues?.[selectedDoctorId])
          ? data.doctor_queues[selectedDoctorId]
          : Object.values(data.doctor_queues || {})[0] || null;

        // 2. Identify the active called or in_consultation token
        let calledEntry = null;
        if (dq?.entries) {
          calledEntry = dq.entries.find((e) => e.status === 'called' || e.status === 'in_consultation');
        }
        if (!calledEntry && dq?.currently_consulting?.length > 0) {
          calledEntry = dq.currently_consulting[0];
        }
        if (!calledEntry && data.queue_entries) {
          calledEntry = data.queue_entries.find((e) => {
            const matchesDoc = selectedDoctorId ? e.doctor_id === selectedDoctorId : true;
            return matchesDoc && (e.status === 'called' || e.status === 'in_consultation');
          });
        }
        if (!calledEntry && data.currently_consulting?.length > 0) {
          calledEntry = data.currently_consulting[0];
        }

        const currentCallingToken = calledEntry ? (calledEntry.token || calledEntry.queue_id) : null;
        const activeDoctorName = calledEntry?.doctor || dq?.doctor_name || selectedDoctorObj?.name || '';
        const activeRoom = calledEntry?.room_number || dq?.room_number || selectedDoctorObj?.consultation_room || 'Room 204';

        // 3. Speech Announcement Trigger Logic:
        // - Initial load: Record token without speaking (do not announce on page load)
        // - Subsequent polls: Announce exactly once per newly called token
        if (initialLoadRef.current) {
          lastAnnouncedTokenRef.current = currentCallingToken;
          initialLoadRef.current = false;
        } else {
          if (currentCallingToken) {
            if (currentCallingToken !== lastAnnouncedTokenRef.current) {
              announceToken(currentCallingToken, activeDoctorName, activeRoom);
              lastAnnouncedTokenRef.current = currentCallingToken;
            }
          } else {
            // Chamber is clear/ready; reset ref so next called patient triggers announcement
            lastAnnouncedTokenRef.current = null;
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch public queue for TV display:', err);
    } finally {
      setLoading(false);
    }
  };

  // Polling every 4 seconds (strict 3-5 seconds requirement)
  useEffect(() => {
    fetchLiveQueue();
    const interval = setInterval(fetchLiveQueue, 4000);
    return () => clearInterval(interval);
  }, [selectedDoctorId, urlDept]);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Sync fullscreen change state from escape key or browser action
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Compute Active Doctor & Queue Context
  const activeDoctorQueue = useMemo(() => {
    if (selectedDoctorId && queueData.doctor_queues?.[selectedDoctorId]) {
      return queueData.doctor_queues[selectedDoctorId];
    }
    // Fallback: pick first doctor queue in dictionary if available
    const keys = Object.keys(queueData.doctor_queues || {});
    if (keys.length > 0) {
      return queueData.doctor_queues[keys[0]];
    }
    return null;
  }, [selectedDoctorId, queueData]);

  // Doctor Details
  const selectedDoctorObj = useMemo(() => {
    return doctorsList.find((d) => d.doctor_id === selectedDoctorId) || null;
  }, [selectedDoctorId, doctorsList]);

  const doctorDisplayName =
    activeDoctorQueue?.doctor_name ||
    selectedDoctorObj?.name ||
    'Dr. Ananya Sharma';

  const departmentName =
    activeDoctorQueue?.department ||
    selectedDoctorObj?.department ||
    'Cardiology';

  const roomNumber =
    activeDoctorQueue?.room_number ||
    selectedDoctorObj?.consultation_room ||
    'Room 204';

  // Now Calling Token (Currently in consultation or called)
  const nowCallingPatient = useMemo(() => {
    if (activeDoctorQueue?.entries) {
      const match = activeDoctorQueue.entries.find(
        (e) => e.status === 'called' || e.status === 'in_consultation'
      );
      if (match) return match;
    }
    if (activeDoctorQueue?.currently_consulting?.length > 0) {
      return activeDoctorQueue.currently_consulting[0];
    }
    if (queueData.queue_entries) {
      const match = queueData.queue_entries.find((e) => {
        const matchesDoc = selectedDoctorId ? e.doctor_id === selectedDoctorId : true;
        return matchesDoc && (e.status === 'called' || e.status === 'in_consultation');
      });
      if (match) return match;
    }
    if (!selectedDoctorId && queueData.currently_consulting?.length > 0) {
      return queueData.currently_consulting[0];
    }
    return null;
  }, [activeDoctorQueue, selectedDoctorId, queueData]);

  // Up Next 3 Patients in Queue
  const nextThreePatients = useMemo(() => {
    const list = [];
    const callingToken = nowCallingPatient?.token || nowCallingPatient?.queue_id;

    if (activeDoctorQueue) {
      if (activeDoctorQueue.next_patient) {
        const t = activeDoctorQueue.next_patient.token || activeDoctorQueue.next_patient.queue_id;
        if (t !== callingToken) list.push(activeDoctorQueue.next_patient);
      }
      if (Array.isArray(activeDoctorQueue.upcoming_patients)) {
        for (const p of activeDoctorQueue.upcoming_patients) {
          if (list.length >= 3) break;
          const t = p.token || p.queue_id;
          if (t !== callingToken && !list.some((existing) => (existing.token || existing.queue_id) === t)) {
            list.push(p);
          }
        }
      }
      if (list.length < 3 && Array.isArray(activeDoctorQueue.entries)) {
        for (const p of activeDoctorQueue.entries) {
          if (list.length >= 3) break;
          const t = p.token || p.queue_id;
          if (
            p.status !== 'called' &&
            p.status !== 'in_consultation' &&
            p.status !== 'completed' &&
            t !== callingToken &&
            !list.some((existing) => (existing.token || existing.queue_id) === t)
          ) {
            list.push(p);
          }
        }
      }
    } else {
      if (queueData.next_patient) {
        const t = queueData.next_patient.token || queueData.next_patient.queue_id;
        if (t !== callingToken) list.push(queueData.next_patient);
      }
      if (Array.isArray(queueData.next_patients)) {
        for (const p of queueData.next_patients) {
          if (list.length >= 3) break;
          const t = p.token || p.queue_id;
          if (t !== callingToken && !list.some((existing) => (existing.token || existing.queue_id) === t)) {
            list.push(p);
          }
        }
      }
      if (list.length < 3 && Array.isArray(queueData.upcoming_patients)) {
        for (const p of queueData.upcoming_patients) {
          if (list.length >= 3) break;
          const t = p.token || p.queue_id;
          if (t !== callingToken && !list.some((existing) => (existing.token || existing.queue_id) === t)) {
            list.push(p);
          }
        }
      }
    }

    return list.slice(0, 3);
  }, [activeDoctorQueue, queueData, nowCallingPatient]);

  // List of all doctor queues for the bottom multi-counter ticker
  const allDoctorQueues = useMemo(() => {
    return Object.values(queueData.doctor_queues || {});
  }, [queueData]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden select-none font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. TOP HEADER BAR */}
      <header className="px-6 py-4 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between shadow-2xl shrink-0">
        {/* Hospital Branding */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-tr from-sky-500 to-teal-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sky-500/25">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-white">
                SIMSRH
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold uppercase tracking-widest">
                OPD Display
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Shridevi Institute of Medical Sciences &amp; Research Hospital, Tumakuru
            </p>
          </div>
        </div>

        {/* Doctor Selector & Controls */}
        <div className="flex items-center gap-4">
          {/* Doctor Selector Dropdown */}
          {doctorsList.length > 0 && (
            <div className="relative flex items-center">
              <select
                aria-label="Select Doctor"
                value={selectedDoctorId}
                onChange={(e) => {
                  setSelectedDoctorId(e.target.value);
                  setSearchParams({ doctor: e.target.value });
                }}
                className="bg-slate-800 text-slate-200 text-xs font-bold py-2 px-3 pr-8 rounded-xl border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer appearance-none"
              >
                {doctorsList.map((d) => (
                  <option key={d.doctor_id} value={d.doctor_id}>
                    {d.name} ({d.department || 'OPD'})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none" />
            </div>
          )}

          {/* Sound Announcement Toggle */}
          <button
            onClick={() => {
              const nextState = !audioEnabled;
              setAudioEnabled(nextState);
              audioEnabledRef.current = nextState;
              if (nextState) {
                if ('speechSynthesis' in window) {
                  window.speechSynthesis.resume();
                }
                const activeToken = nowCallingPatient?.token || nowCallingPatient?.queue_id;
                if (activeToken) {
                  announceToken(
                    activeToken,
                    doctorDisplayName,
                    nowCallingPatient.room_number || roomNumber
                  );
                } else {
                  const unlockUtterance = new SpeechSynthesisUtterance('Voice announcements active.');
                  unlockUtterance.rate = 1.0;
                  unlockUtterance.volume = 0.8;
                  window.speechSynthesis.speak(unlockUtterance);
                }
              } else {
                if ('speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
              }
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
              audioEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
            title={audioEnabled ? 'Audio Announcements Active (Click to mute)' : 'Click to enable English Voice Announcements'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span className="hidden sm:inline">{audioEnabled ? 'Voice Active' : 'Enable Voice'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter TV Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Real-time Clock */}
          <div className="text-right pl-3 border-l border-slate-800 hidden sm:block">
            <div className="text-xl font-black text-white font-mono tracking-wider">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN TV CONTENT GRID */}
      <main className="flex-1 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-stretch overflow-hidden">
        
        {/* LEFT / CENTER: HERO CARD (NOW CALLING / IN CONSULTATION) - 7 Columns */}
        <section className="lg:col-span-7 flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-sky-500/40 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          {/* Background Ambient Glow */}
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Active Doctor Info Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800/80 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-sky-500/15 border border-sky-500/30 rounded-2xl flex items-center justify-center text-sky-400 shadow-md">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-sky-400 block">
                  {departmentName} OPD
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                  {doctorDisplayName}
                </h2>
              </div>
            </div>

            {/* Room Number Badge */}
            <div className="flex items-center gap-2.5 px-4 py-2 bg-emerald-500/15 border-2 border-emerald-400/40 text-emerald-300 rounded-2xl shadow-lg">
              <DoorOpen className="w-5 h-5 text-emerald-400" />
              <div className="text-left">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-300 block">
                  Consultation Chamber
                </span>
                <span className="text-lg md:text-xl font-black text-white font-mono">
                  {roomNumber}
                </span>
              </div>
            </div>
          </div>

          {/* HERO CALLOUT: LARGE NOW CALLING TOKEN */}
          <div className="my-auto py-8 text-center relative z-10">
            {nowCallingPatient ? (
              <div className="space-y-4">
                {/* Live Pulse Indicator */}
                <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-black uppercase tracking-widest animate-pulse">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400"></span>
                  <span>NOW CALLING / IN CONSULTATION</span>
                </div>

                {/* Giant Glowing Token Display */}
                <div className="relative py-2">
                  <div className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tight font-mono text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 drop-shadow-[0_10px_35px_rgba(16,185,129,0.35)]">
                    {nowCallingPatient.token || nowCallingPatient.queue_id}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 text-slate-300 text-base md:text-lg font-semibold">
                  <span>Please proceed to</span>
                  <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-xl font-bold font-mono">
                    {nowCallingPatient.room_number || roomNumber}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-12 space-y-4">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
                  <DoorOpen className="w-10 h-10 text-sky-400" />
                </div>
                <h3 className="text-3xl font-black text-white">Chamber Ready</h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  Doctor is ready. Calling next waiting patient momentarily.
                </p>
              </div>
            )}
          </div>

          {/* Left Hero Bottom Status Bar */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-semibold relative z-10">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Live Synced with Hospital OPD Server
            </span>
            <span className="font-mono text-slate-400">
              Refreshed: {lastRefreshed.toLocaleTimeString()}
            </span>
          </div>
        </section>

        {/* RIGHT: UP NEXT IN LINE (NEXT 3 PATIENTS) - 5 Columns */}
        <section className="lg:col-span-5 flex flex-col justify-between bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-black uppercase tracking-wider text-white">
                  Next In Line
                </h3>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20">
                Upcoming (Next 3)
              </span>
            </div>

            {/* List of Next 3 Tokens */}
            <div className="space-y-4 mt-5">
              {nextThreePatients.length > 0 ? (
                nextThreePatients.map((patient, index) => {
                  const token = patient.token || patient.queue_id;
                  const isFirst = index === 0;

                  return (
                    <div
                      key={token || index}
                      className={`p-4 md:p-5 rounded-2xl border transition-all duration-300 flex items-center justify-between ${
                        isFirst
                          ? 'bg-amber-500/10 border-amber-400/40 shadow-lg shadow-amber-500/5'
                          : 'bg-slate-800/50 border-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-xl font-mono text-base font-black flex items-center justify-center shrink-0 ${
                            isFirst
                              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                              : 'bg-slate-700 text-slate-200'
                          }`}
                        >
                          #{index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl md:text-3xl font-black font-mono tracking-tight text-white">
                              {token}
                            </span>
                            {isFirst && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider border border-amber-400/30">
                                Be Ready
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-semibold block mt-0.5">
                            {patient.department || departmentName} • {patient.room_number || roomNumber}
                          </span>
                        </div>
                      </div>

                      {/* Wait Time Indicator */}
                      <div className="text-right">
                        <span className="text-xs text-slate-400 font-semibold block">
                          Est. Wait
                        </span>
                        <span className="text-sm font-bold text-amber-300 font-mono">
                          ~{patient.estimated_wait_time || (index + 1) * 12} mins
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-sm font-bold">No further waiting patients in queue.</p>
                  <p className="text-xs text-slate-500">New arrivals will show here automatically.</p>
                </div>
              )}
            </div>
          </div>

          {/* Privacy Notice Card */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-3 mt-4">
            <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-400 leading-relaxed">
              <span className="font-bold text-slate-300 block">SIMSRH Privacy Notice</span>
              This display strictly protects patient confidentiality by displaying queue tokens only. Please have your printed token slip ready when your token is called.
            </div>
          </div>
        </section>
      </main>

      {/* 3. BOTTOM DOCTOR TICKER BAR */}
      <footer className="px-6 py-3 bg-slate-900 border-t border-slate-800 text-xs flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 text-slate-400 font-semibold">
          <Tv className="w-4 h-4 text-sky-400" />
          <span>Active OPD Counters:</span>
        </div>

        {/* Horizontal Mini Badges for Other Counters */}
        <div className="flex items-center gap-3 overflow-x-auto py-1 max-w-4xl">
          {allDoctorQueues.length > 0 ? (
            allDoctorQueues.map((dq) => {
              const currentTkn = dq.currently_consulting?.[0]?.token || dq.currently_consulting?.[0]?.queue_id;
              const isSelected = dq.doctor_id === selectedDoctorId;

              return (
                <button
                  key={dq.doctor_id}
                  onClick={() => {
                    setSelectedDoctorId(dq.doctor_id);
                    setSearchParams({ doctor: dq.doctor_id });
                  }}
                  className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400 shadow-xs'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  <span className="text-slate-400 font-mono">{dq.room_number || 'Room 204'}:</span>
                  <span className="text-white">{dq.doctor_name?.split(' ')?.[1] || dq.doctor_name || 'Dr.'}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${currentTkn ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                    {currentTkn ? `Serving #${currentTkn}` : 'Open'}
                  </span>
                </button>
              );
            })
          ) : (
            <span className="text-slate-500 text-xs">Loading active OPD chambers...</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
          <span>Auto-refresh: 4s</span>
        </div>
      </footer>
    </div>
  );
}
