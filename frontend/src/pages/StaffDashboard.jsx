import React, { useState, useEffect } from 'react';
import { Users, ShieldAlert, Stethoscope, CheckCircle2, RefreshCw, AlertTriangle, ArrowUpRight, Cpu, KeyRound, Play, XCircle, UserX, PhoneCall } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import Sidebar from '../components/Sidebar';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import Analytics from './Analytics';
import DoctorOtpModal from '../components/DoctorOtpModal';

export default function StaffDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [queues, setQueues] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Doctor OTP Modal state
  const [selectedPatientForOtp, setSelectedPatientForOtp] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [qData, dData] = await Promise.all([
        hospitalApi.getAllQueues(selectedDeptFilter),
        hospitalApi.getDoctors()
      ]);
      setQueues(qData || []);
      setDoctors(dData || []);
    } catch (err) {
      console.error(err);
      setError('Unable to fetch queue data from Flask backend at http://localhost:5000');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDeptFilter]);

  const handleEscalateEmergency = async (queueId) => {
    setActionLoadingId(queueId);
    try {
      await hospitalApi.escalateEmergency(queueId);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to escalate emergency priority.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCallPatient = async (queueId) => {
    setActionLoadingId(queueId);
    try {
      await hospitalApi.callPatient(queueId);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to call patient.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCompleteConsultation = async (queueId) => {
    setActionLoadingId(queueId);
    try {
      await hospitalApi.completeQueueToken(queueId);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to complete consultation.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkNoShow = async (queueId) => {
    if (!window.confirm('Mark this patient as No-Show?')) return;
    setActionLoadingId(queueId);
    try {
      await hospitalApi.markNoShow(queueId);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to mark no-show.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelQueue = async (queueId) => {
    if (!window.confirm('Cancel this queue token?')) return;
    setActionLoadingId(queueId);
    try {
      await hospitalApi.cancelQueueToken(queueId);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to cancel queue token.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const waitingCount = queues.filter((q) => q.status === 'waiting' || q.status === 'arrived' || q.status === 'ready' || q.status === 'called').length;
  const emergencyCount = queues.filter((q) => q.priority === 'emergency' && q.status !== 'completed' && q.status !== 'cancelled').length;
  const activeDoctorsCount = doctors.filter((d) => d.available).length;
  const completedCount = queues.filter((q) => q.status === 'completed').length;

  return (
    <div className="flex min-h-screen bg-slate-100">
      
      {/* SIDEBAR NAVIGATION */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onRefresh={loadData} />

      {/* MAIN DASHBOARD CONTENT */}
      <main className="flex-1 p-6 sm:p-10 overflow-y-auto">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Staff Management Portal</h1>
            <p className="text-xs text-slate-500">Live operational oversight, patient OTP verification & queue control</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs focus:outline-none"
            >
              <option value="">All Departments</option>
              <option value="Cardiology">Cardiology</option>
              <option value="General Medicine">General Medicine</option>
              <option value="Orthopedics">Orthopedics</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Dermatology">Dermatology</option>
              <option value="Neurology">Neurology</option>
            </select>

            <button
              onClick={loadData}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition shadow-xs"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* METRICS STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Patients Waiting</span>
              <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{waitingCount}</div>
            <p className="text-[11px] text-slate-500 mt-1">Active in queue line</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Emergency Priority</span>
              <div className="w-8 h-8 bg-rose-100 text-rose-700 rounded-xl flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-rose-600">{emergencyCount}</div>
            <p className="text-[11px] text-rose-700 font-medium mt-1">High priority cases</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Doctors</span>
              <div className="w-8 h-8 bg-sky-100 text-sky-700 rounded-xl flex items-center justify-center">
                <Stethoscope className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{activeDoctorsCount}</div>
            <p className="text-[11px] text-slate-500 mt-1">On shift today</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Completed Consults</span>
              <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-700">{completedCount}</div>
            <p className="text-[11px] text-emerald-800 font-medium mt-1">Finished today</p>
          </div>

        </div>

        {/* TAB SWITCH CONTENT */}
        {activeTab === 'analytics' ? (
          <Analytics queueData={queues} />
        ) : activeTab === 'doctors' ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Medical Staff Directory ({doctors.length} Doctors)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {doctors.map((doc) => (
                <div key={doc.doctor_id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{doc.name}</div>
                      <div className="text-xs text-sky-700 font-medium">{doc.department} • {doc.consultation_room || doc.room_number || 'Room 204'}</div>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${doc.available ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                      {doc.available ? 'Available' : 'Busy'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Specialization: {doc.specialization || doc.department}<br/>
                    Avg Consultation: ~{doc.avg_consultation_duration || 12} mins
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'overview' ? (
          /* OVERVIEW TAB: Summary metrics & operational insights */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Queue Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span className="text-xs text-slate-600">Waiting Patients</span>
                    <span className="text-lg font-bold text-slate-900">{waitingCount}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span className="text-xs text-slate-600">Emergency Cases</span>
                    <span className="text-lg font-bold text-rose-600">{emergencyCount}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span className="text-xs text-slate-600">Active Doctors</span>
                    <span className="text-lg font-bold text-sky-600">{activeDoctorsCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600">Completed Today</span>
                    <span className="text-lg font-bold text-emerald-600">{completedCount}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Operational Status Alerts</h3>
                <div className="space-y-3">
                  {emergencyCount > 0 && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                      <p className="text-xs font-medium text-rose-700">⚠️ {emergencyCount} emergency case(s) require priority attention</p>
                    </div>
                  )}
                  {waitingCount > 10 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-xs font-medium text-amber-700">📊 High queue volume: {waitingCount} patients waiting</p>
                    </div>
                  )}
                  {activeDoctorsCount === 0 && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-xs font-medium text-slate-700">ℹ️ No doctors currently available</p>
                    </div>
                  )}
                  {emergencyCount === 0 && waitingCount <= 10 && activeDoctorsCount > 0 && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <p className="text-xs font-medium text-emerald-700">✅ Operations running smoothly</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Department Workload Overview</h3>
              <div className="space-y-2">
                {['Cardiology', 'General Medicine', 'Orthopedics', 'Pediatrics', 'Dermatology', 'Neurology'].map((dept) => {
                  const count = queues.filter(q => q.department === dept && q.status !== 'completed' && q.status !== 'cancelled').length;
                  return count > 0 && (
                    <div key={dept} className="flex justify-between items-center pb-2">
                      <span className="text-xs text-slate-600">{dept}</span>
                      <span className="text-sm font-semibold text-slate-900">{count} {count === 1 ? 'patient' : 'patients'} waiting</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* LIVE QUEUE TAB: Detailed queue management & interactive actions */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Live Queue Management</h3>
                <p className="text-xs text-slate-500">Real-time queue controls, OTP verification & consultation state management</p>
              </div>

              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {queues.length} Total Tokens
              </span>
            </div>

            {loading ? (
              <LoadingState message="Fetching live queue records from MongoDB..." />
            ) : error ? (
              <ErrorState error={error} onRetry={loadData} />
            ) : queues.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs font-medium">
                No active queue entries currently registered.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Pos</th>
                      <th className="px-4 py-3">Token ID</th>
                      <th className="px-4 py-3">Patient Name</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Symptoms</th>
                      <th className="px-4 py-3">Doctor / Dept</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">AI Wait Time</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {queues.map((item) => {
                      const symptomsList = Array.isArray(item.symptoms) ? item.symptoms.join(', ') : '';
                      const maskedPhone = item.patient_phone 
                        ? `****${item.patient_phone.slice(-4)}`
                        : '—';

                      return (
                        <tr
                          key={item.queue_id}
                          className={`hover:bg-slate-50/80 transition ${
                            item.priority === 'emergency' ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          <td className="px-4 py-4 font-bold text-slate-900">#{item.position}</td>
                          <td className="px-4 py-4 font-mono font-bold text-sky-700">{item.queue_id}</td>
                          <td className="px-4 py-4 font-semibold text-slate-900">{item.patient_name || item.patient_id}</td>
                          <td className="px-4 py-4 text-xs text-slate-600">{maskedPhone}</td>
                          <td className="px-4 py-4 max-w-[120px]">
                            <div className="text-slate-900 font-semibold truncate" title={symptomsList}>
                              {symptomsList || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-semibold text-slate-900">{item.doctor_id || 'Dr. Ananya Sharma'}</div>
                            <div className="text-[10px] text-sky-700 font-bold">{item.department || 'Cardiology'} • {item.room_number || 'Room 204'}</div>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge status={item.priority} type="priority" />
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge status={item.status} type="status" />
                          </td>
                          <td className="px-4 py-4 font-semibold text-emerald-700">
                            ~{item.predicted_consultation_duration || item.predicted_wait_time || 15} mins
                          </td>
                          <td className="px-4 py-4 text-right space-x-1.5">

                            {/* CALL PATIENT ACTION */}
                            {item.status === 'waiting' && (
                              <button
                                onClick={() => handleCallPatient(item.queue_id)}
                                disabled={actionLoadingId === item.queue_id}
                                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-bold text-[10px] transition inline-flex items-center gap-1"
                                title="Call patient to consultation room"
                              >
                                <PhoneCall className="w-3 h-3" />
                                <span>Call</span>
                              </button>
                            )}

                            {/* VERIFY OTP & START */}
                            {item.status !== 'completed' && item.status !== 'in_consultation' && item.status !== 'cancelled' && item.status !== 'no_show' && (
                              <button
                                onClick={() => setSelectedPatientForOtp(item)}
                                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-[10px] transition inline-flex items-center gap-1"
                                title="Verify patient OTP to start consultation"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>Verify OTP</span>
                              </button>
                            )}

                            {/* COMPLETE CONSULTATION */}
                            {item.status === 'in_consultation' && (
                              <button
                                onClick={() => handleCompleteConsultation(item.queue_id)}
                                disabled={actionLoadingId === item.queue_id}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] transition inline-flex items-center gap-1"
                                title="Mark consultation completed"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Complete</span>
                              </button>
                            )}

                            {/* ESCALATE EMERGENCY */}
                            {item.priority !== 'emergency' && item.status !== 'completed' && item.status !== 'cancelled' && (
                              <button
                                onClick={() => handleEscalateEmergency(item.queue_id)}
                                disabled={actionLoadingId === item.queue_id}
                                className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg font-bold text-[10px] transition inline-flex items-center gap-1"
                                title="Promote to Emergency Priority"
                              >
                                <ShieldAlert className="w-3 h-3" />
                                <span>Emergency</span>
                              </button>
                            )}

                            {/* NO SHOW */}
                            {item.status !== 'completed' && item.status !== 'cancelled' && item.status !== 'no_show' && (
                              <button
                                onClick={() => handleMarkNoShow(item.queue_id)}
                                disabled={actionLoadingId === item.queue_id}
                                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold text-[10px] transition inline-flex items-center gap-1"
                                title="Mark patient as No-Show"
                              >
                                <UserX className="w-3 h-3" />
                                <span>No-Show</span>
                              </button>
                            )}

                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

      </main>

      {/* DOCTOR OTP VERIFICATION MODAL */}
      {selectedPatientForOtp && (
        <DoctorOtpModal
          patientData={selectedPatientForOtp}
          isOpen={!!selectedPatientForOtp}
          onClose={() => setSelectedPatientForOtp(null)}
          onSuccess={() => {
            loadData();
            setSelectedPatientForOtp(null);
          }}
        />
      )}

    </div>
  );
}