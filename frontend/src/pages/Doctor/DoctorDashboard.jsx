import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Badge from '../../components/Badge';
import { 
  Users, CheckCircle2, Clock, AlertTriangle, PhoneCall, Play, Check, SkipForward, RotateCcw, Stethoscope 
} from 'lucide-react';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [doctorId, setDoctorId] = useState(null);
  const [queueSnapshot, setQueueSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch logged in doctor profile to get doctor_id
  useEffect(() => {
    const loadDoctorProfile = async () => {
      try {
        const user = await api.get('/auth/me');
        if (user.data?.doctor_id) {
          setDoctorId(user.data.doctor_id);
        } else {
          // Fallback to first doctor
          const docs = await api.get('/doctors');
          if (docs.data?.[0]) {
            setDoctorId(docs.data[0].doctor_id);
          }
        }
      } catch (err) {
        console.error('Failed to load doctor profile:', err);
      }
    };
    
    loadDoctorProfile();
  }, []);

  const fetchQueue = async () => {
    if (!doctorId) return;
    try {
      const res = await api.get(`/queue/doctor/${doctorId}`);
      setQueueSnapshot(res.data);
    } catch (e) {
      console.error('Failed to fetch doctor queue:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (doctorId) {
      fetchQueue();
      const interval = setInterval(fetchQueue, 3000);
      return () => clearInterval(interval);
    }
  }, [doctorId]);

  const handleCallNext = async () => {
    if (!doctorId) return;
    setActionLoading(true);
    try {
      await api.post(`/queue/${doctorId}/next`);
      await fetchQueue();
    } catch (err) {
      alert(err.response?.data?.detail || 'No waiting patients in queue');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartConsultation = async (aptId) => {
    setActionLoading(true);
    try {
      await api.post(`/queue/${aptId}/start`);
      await fetchQueue();
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (aptId) => {
    setActionLoading(true);
    try {
      await api.post(`/queue/${aptId}/complete`);
      await fetchQueue();
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = async (aptId) => {
    setActionLoading(true);
    try {
      await api.post(`/queue/${aptId}/skip`);
      await fetchQueue();
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecall = async (aptId) => {
    setActionLoading(true);
    try {
      await api.post(`/queue/${aptId}/recall`);
      await fetchQueue();
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const currentPatient = queueSnapshot?.current_patient;
  const nextPatient = queueSnapshot?.next_patient;
  const queueList = queueSnapshot?.queue_list || [];

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Doctor Consultation Desk
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
          {queueSnapshot?.doctor_name ? `${queueSnapshot.doctor_name} (${queueSnapshot.department_name})` : 'Manage your live patient queue'}
        </p>
      </div>

      {/* Top Statistics Bar */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="stat-val">{queueSnapshot?.total_waiting || 0}</div>
            <div className="stat-lbl">Waiting Queue</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>
            <Users size={24} />
          </div>
          <div>
            <div className="stat-val">{currentPatient ? 1 : 0}</div>
            <div className="stat-lbl">In Desk / Called</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="stat-val">{queueSnapshot?.total_completed || 0}</div>
            <div className="stat-lbl">Completed Today</div>
          </div>
        </div>
      </div>

      {/* Hero Consultation Controls Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* Currently Serving Patient Card */}
        <div className="card" style={{ borderLeft: '6px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              CURRENT PATIENT ON DESK
            </span>
            {currentPatient && <Badge status={currentPatient.status} />}
          </div>

          {currentPatient ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{
                  width: 80,
                  height: 80,
                  borderRadius: 'var(--radius)',
                  background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  fontWeight: 900,
                  boxShadow: '0 8px 16px rgba(2, 132, 199, 0.25)'
                }}>
                  #{currentPatient.token_number}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    {currentPatient.patient_name}
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>
                    Phone: {currentPatient.patient_phone || 'N/A'} | Gender: {currentPatient.patient_gender || 'Unspecified'}
                  </p>
                  {currentPatient.notes && (
                    <p style={{ fontSize: '0.85rem', background: '#f8fafc', padding: '0.4rem 0.8rem', borderRadius: 6, marginTop: 6, border: '1px solid var(--border)' }}>
                      <strong>Notes:</strong> {currentPatient.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons for Current Patient */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {currentPatient.status === 'CALLED' && (
                  <button 
                    onClick={() => handleStartConsultation(currentPatient.id)} 
                    className="btn btn-accent" 
                    disabled={actionLoading}
                  >
                    <Play size={18} /> Start Consultation
                  </button>
                )}

                {currentPatient.status === 'IN_CONSULTATION' && (
                  <button 
                    onClick={() => handleComplete(currentPatient.id)} 
                    className="btn btn-primary" 
                    disabled={actionLoading}
                    style={{ background: 'var(--success)' }}
                  >
                    <Check size={18} /> Complete Consultation & Next
                  </button>
                )}

                <button 
                  onClick={() => handleSkip(currentPatient.id)} 
                  className="btn btn-secondary" 
                  disabled={actionLoading}
                >
                  <SkipForward size={18} /> Skip Patient
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <Stethoscope size={44} color="var(--text-light)" style={{ margin: '0 auto 0.75rem auto' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>No Active Consultation</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem', marginBottom: '1.25rem' }}>
                Click below to call the next waiting patient from the queue into your desk.
              </p>
              <button 
                onClick={handleCallNext} 
                className="btn btn-primary btn-lg" 
                style={{ padding: '0.8rem 1.75rem', fontSize: '1rem' }}
                disabled={actionLoading || queueSnapshot?.total_waiting === 0}
              >
                <PhoneCall size={20} /> CALL NEXT PATIENT
              </button>
            </div>
          )}
        </div>

        {/* Next Patient Preview Card */}
        <div className="card">
          <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
            UP NEXT IN QUEUE
          </span>

          {nextPatient ? (
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                color: 'var(--primary)',
                letterSpacing: '-1px'
              }}>
                #{nextPatient.token_number}
              </div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.3rem 0 0 0' }}>
                {nextPatient.patient_name}
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Scheduled Slot: {nextPatient.appointment_time}
              </p>
              <Badge status={nextPatient.status} />
            </div>
          ) : (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No upcoming patients waiting in line.
            </div>
          )}
        </div>
      </div>

      {/* Live Queue Table & Control Actions */}
      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
        Today's Live Queue List
      </h3>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Token #</th>
              <th>Patient Name</th>
              <th>Phone</th>
              <th>Time Slot</th>
              <th>Status</th>
              <th>Queue Action</th>
            </tr>
          </thead>
          <tbody>
            {queueList.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Queue is currently empty for today.
                </td>
              </tr>
            ) : (
              queueList.map((apt) => (
                <tr key={apt.id}>
                  <td><strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>#{apt.token_number}</strong></td>
                  <td><strong>{apt.patient_name}</strong></td>
                  <td>{apt.patient_phone || 'N/A'}</td>
                  <td>{apt.appointment_time}</td>
                  <td><Badge status={apt.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {apt.status === 'SKIPPED' ? (
                        <button 
                          onClick={() => handleRecall(apt.id)} 
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--purple)' }}
                        >
                          <RotateCcw size={14} /> Recall
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleSkip(apt.id)} 
                          className="btn btn-secondary btn-sm"
                        >
                          <SkipForward size={14} /> Skip
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DoctorDashboard;
