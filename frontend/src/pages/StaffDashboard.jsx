import React, { useState, useEffect } from 'react';
import { Users, ShieldAlert, Stethoscope, CheckCircle2, RefreshCw, AlertTriangle, ArrowUpRight, Cpu, KeyRound, Play } from 'lucide-react';
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

  const handleCompleteConsultation = async (queueId) => {
    const durationStr = prompt('Enter actual consultation duration in minutes:', '14');
    if (!durationStr) return;
    const duration = parseInt(durationStr, 10) || 14;

    setActionLoadingId(queueId);
    try {
      await hospitalApi.completeConsultation(queueId, duration);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to complete consultation.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const waitingCount = queues.filter((q) => q.status === 'waiting' || q.status === 'arrived' || q.status === 'ready').length;
  const emergencyCount = queues.filter((q) => q.priority === 'emergency').length;
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
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-4">Available Medical Staff & Consultation Rooms</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {doctors.map((doc) => (
                <div key={doc.doctor_id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="font-bold text-sm text-slate-900">{doc.name}</div>
                  <div className="text-xs text-sky-700 font-medium mt-0.5">{doc.department} - {doc.consultation_room || 'Room 204'}</div>
                  <div className="text-[11px] text-slate-500 mt-2">Avg {doc.avg_consultation_duration || 12} mins / patient</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* OVERVIEW & LIVE QUEUE TABLE */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Current Hospital Queue & OTP Verification</h3>
                <p className="text-xs text-slate-500">Verify patient consultation OTP before beginning consultation</p>
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
                      <th className="px-6 py-3">Pos</th>
                      <th className="px-6 py-3">Token ID</th>
                      <th className="px-6 py-3">Patient</th>
                      <th className="px-6 py-3">Doctor / Dept / Room</th>
                      <th className="px-6 py-3">Priority</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">AI Duration</th>
                      <th className="px-6 py-3 text-right">Consultation Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {queues.map((item) => (
                      <tr
                        key={item.queue_id}
                        className={`hover:bg-slate-50/80 transition ${
                          item.priority === 'emergency' ? 'bg-rose-50/30' : ''
                        }`}
                      >
                        <td className="px-6 py-4 font-bold text-slate-900">#{item.position}</td>
                        <td className="px-6 py-4 font-mono font-bold text-sky-700">{item.queue_id}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{item.patient_id}</td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{item.doctor_id || 'Dr. Ananya Sharma'}</div>
                          <div className="text-[10px] text-sky-700 font-bold">{item.department || 'Cardiology'} • {item.room_number || 'Room 204'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={item.priority} type="priority" />
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={item.status} type="status" />
                        </td>
                        <td className="px-6 py-4 font-semibold text-emerald-700">
                          ~{item.predicted_consultation_duration || item.predicted_wait_time || 15} mins
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          
                          {/* OTP VERIFICATION ACTION BUTTON */}
                          {item.status !== 'completed' && item.status !== 'in_consultation' && (
                            <button
                              onClick={() => setSelectedPatientForOtp(item)}
                              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-[11px] transition inline-flex items-center gap-1 shadow-2xs"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Verify OTP & Start</span>
                            </button>
                          )}

                          {/* COMPLETE CONSULTATION BUTTON */}
                          {item.status === 'in_consultation' && (
                            <button
                              onClick={() => handleCompleteConsultation(item.queue_id)}
                              disabled={actionLoadingId === item.queue_id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition inline-flex items-center gap-1 shadow-2xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Complete Consult</span>
                            </button>
                          )}

                          {/* ESCALATE EMERGENCY */}
                          {item.priority !== 'emergency' && item.status === 'waiting' && (
                            <button
                              onClick={() => handleEscalateEmergency(item.queue_id)}
                              disabled={actionLoadingId === item.queue_id}
                              className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg font-bold text-[11px] transition inline-flex items-center gap-1 shadow-2xs"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Emergency</span>
                            </button>
                          )}

                        </td>
                      </tr>
                    ))}
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
