import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { 
  Calendar, Clock, UserCheck, Stethoscope, AlertCircle, PlusCircle, CheckCircle2, RefreshCw 
} from 'lucide-react';

const PatientDashboard = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Booking modal state
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDoc, setSelectedDoc] = useState('');
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState('10:00');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccessToken, setBookingSuccessToken] = useState(null);

  // Live queue status state for active appointment
  const [activeQueueSnapshot, setActiveQueueSnapshot] = useState(null);

  const fetchAppointments = async () => {
    try {
      const res = await api.get('/patients/appointments');
      setAppointments(res.data);
    } catch (e) {
      console.error('Failed to fetch patient appointments:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data.filter(d => d.status === 'ACTIVE'));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchDepartments();

    // Auto refresh queue position every 5 seconds
    const interval = setInterval(fetchAppointments, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter today's active appointment
  const todayStr = new Date().toISOString().split('T')[0];
  const activeAppointment = appointments.find(
    a => a.appointment_date === todayStr && ['WAITING', 'CALLED', 'IN_CONSULTATION'].includes(a.status)
  ) || appointments[0];

  // Fetch real-time queue snapshot for doctor of active appointment
  useEffect(() => {
    if (activeAppointment?.doctor_id) {
      api.get(`/queue/${activeAppointment.doctor_id}?target_date=${activeAppointment.appointment_date}`)
        .then(res => setActiveQueueSnapshot(res.data))
        .catch(console.error);
    }
  }, [activeAppointment]);

  useEffect(() => {
    if (selectedDept) {
      api.get(`/doctors?department_id=${selectedDept}`)
        .then(res => setDoctors(res.data.filter(d => d.status === 'ACTIVE')))
        .catch(console.error);
    } else {
      setDoctors([]);
    }
  }, [selectedDept]);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setBookingError('');
    try {
      const res = await api.post('/appointments', {
        doctor_id: parseInt(selectedDoc),
        department_id: parseInt(selectedDept),
        appointment_date: bookingDate,
        appointment_time: bookingTime,
        notes: bookingNotes
      });
      setBookingSuccessToken(res.data.token_number);
      fetchAppointments();
    } catch (err) {
      setBookingError(err.response?.data?.detail || 'Booking failed. Try selecting a different time slot.');
    }
  };

  const handleCancel = async (aptId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await api.post(`/appointments/${aptId}/cancel`);
      fetchAppointments();
    } catch (e) {
      alert('Could not cancel appointment.');
    }
  };

  const currentlyServingToken = activeQueueSnapshot?.current_patient?.token_number || (activeQueueSnapshot?.total_completed ? activeQueueSnapshot.total_completed : 'None');

  return (
    <div className="page-container">
      {/* Welcome Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Welcome back, {user?.name}!
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
            Monitor your appointment position and live queue status in real-time.
          </p>
        </div>

        <button 
          onClick={() => { setIsBookingOpen(true); setBookingSuccessToken(null); setBookingError(''); }} 
          className="btn btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem' }}
        >
          <PlusCircle size={18} /> Book New Appointment
        </button>
      </div>

      {/* Today's Active Token & Queue Tracker Hero Card */}
      {activeAppointment && ['WAITING', 'CALLED', 'IN_CONSULTATION'].includes(activeAppointment.status) ? (
        <div className="token-card" style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Clock size={16} /> Live Queue Position Tracker
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginTop: '0.5rem' }}>
                <span className="token-number">#{activeAppointment.token_number}</span>
                <div>
                  <Badge status={activeAppointment.status} />
                  <span style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginTop: 4 }}>
                    Your Allocated Token Number
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '1rem 1.25rem', borderRadius: 'var(--radius)', minWidth: 140 }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Currently Serving</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: 4 }}>
                  {currentlyServingToken !== 'None' ? `#${currentlyServingToken}` : 'None'}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '1rem 1.25rem', borderRadius: 'var(--radius)', minWidth: 140 }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Patients Ahead</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
                  {activeAppointment.queue_position}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '1rem 1.25rem', borderRadius: 'var(--radius)', minWidth: 160 }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Estimated Wait</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                  ~{activeAppointment.estimated_wait_minutes} mins
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Doctor:</span>
                <strong style={{ display: 'block', color: 'white' }}>{activeAppointment.doctor_name}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Department:</span>
                <strong style={{ display: 'block', color: 'white' }}>{activeAppointment.department_name}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Scheduled Time:</span>
                <strong style={{ display: 'block', color: 'white' }}>{activeAppointment.appointment_time}</strong>
              </div>
            </div>

            <button 
              onClick={() => handleCancel(activeAppointment.id)}
              className="btn btn-danger btn-sm"
            >
              Cancel Appointment
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '2.5rem', background: 'linear-gradient(135deg, #e0f2fe, #f0f9ff)' }}>
          <Stethoscope size={48} color="var(--primary)" style={{ margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>No Active Queue Token Today</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.3rem', maxWidth: 500, margin: '0.3rem auto 1.25rem auto' }}>
            You do not currently have a waiting appointment for today. Click below to book an appointment with our specialist doctors.
          </p>
          <button onClick={() => { setIsBookingOpen(true); setBookingSuccessToken(null); setBookingError(''); }} className="btn btn-primary">
            <PlusCircle size={18} /> Book Appointment Now
          </button>
        </div>
      )}

      {/* Appointment History & Status Table */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Appointment History & Requests
        </h3>
        <button onClick={fetchAppointments} className="btn btn-outline btn-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Token #</th>
              <th>Date & Time</th>
              <th>Doctor</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No appointments found. Book your first appointment today!
                </td>
              </tr>
            ) : (
              appointments.map((apt) => (
                <tr key={apt.id}>
                  <td><strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>#{apt.token_number}</strong></td>
                  <td>
                    <div><strong>{apt.appointment_date}</strong></div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{apt.appointment_time}</div>
                  </td>
                  <td><strong>{apt.doctor_name}</strong></td>
                  <td>{apt.department_name}</td>
                  <td><Badge status={apt.status} /></td>
                  <td>
                    {['WAITING', 'CALLED'].includes(apt.status) && (
                      <button 
                        onClick={() => handleCancel(apt.id)} 
                        className="btn btn-danger btn-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Book Appointment Multi-step Modal */}
      <Modal 
        isOpen={isBookingOpen} 
        onClose={() => setIsBookingOpen(false)}
        title="Book Doctor Appointment"
      >
        {bookingSuccessToken ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <CheckCircle2 size={56} color="var(--success)" style={{ margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Appointment Confirmed!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.4rem' }}>
              Your Token number has been generated successfully.
            </p>
            <div style={{
              background: 'var(--primary-light)',
              padding: '1.25rem',
              borderRadius: 'var(--radius)',
              margin: '1.5rem 0'
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>YOUR TOKEN NUMBER</span>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--primary)' }}>#{bookingSuccessToken}</div>
            </div>
            <button onClick={() => setIsBookingOpen(false)} className="btn btn-primary" style={{ width: '100%' }}>
              View Queue Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleBookAppointment}>
            {bookingError && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
                {bookingError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Select Department *</label>
              <select 
                className="form-select" 
                value={selectedDept} 
                onChange={(e) => { setSelectedDept(e.target.value); setSelectedDoc(''); }}
                required
              >
                <option value="">-- Choose Department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.doctor_count} doctors)</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Select Doctor *</label>
              <select 
                className="form-select" 
                value={selectedDoc} 
                onChange={(e) => setSelectedDoc(e.target.value)}
                disabled={!selectedDept}
                required
              >
                <option value="">-- Choose Doctor --</option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    Dr. {doc.name} - {doc.specialization} (${doc.consultation_fee})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input 
                  type="date" 
                  className="form-input" 
                  min={todayStr}
                  value={bookingDate} 
                  onChange={(e) => setBookingDate(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Time Slot *</label>
                <select 
                  className="form-select" 
                  value={bookingTime} 
                  onChange={(e) => setBookingTime(e.target.value)}
                  required
                >
                  <option value="09:00">09:00 AM</option>
                  <option value="09:15">09:15 AM</option>
                  <option value="09:30">09:30 AM</option>
                  <option value="09:45">09:45 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="10:15">10:15 AM</option>
                  <option value="10:30">10:30 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="14:00">02:00 PM</option>
                  <option value="14:30">02:30 PM</option>
                  <option value="15:00">03:00 PM</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reason / Symptoms Notes (Optional)</label>
              <textarea 
                className="form-textarea" 
                rows={2} 
                placeholder="Brief details about your consultation..."
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', marginTop: '0.5rem' }}>
              Confirm & Generate Token
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default PatientDashboard;
