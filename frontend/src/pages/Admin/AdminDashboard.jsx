import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { 
  Users, Stethoscope, Building2, Calendar, Clock, CheckCircle2, XCircle, Plus, Search, Settings, Edit, ToggleLeft, ToggleRight 
} from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, departments, doctors, patients, settings

  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Department Modal State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', description: '' });
  const [editingDeptId, setEditingDeptId] = useState(null);

  // Doctor Modal State
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    name: '', email: '', phone: '', password: 'doctor123', department_id: '', specialization: '', qualification: '', experience: 5, consultation_fee: 100
  });

  // Settings State
  const [consultDuration, setConsultDuration] = useState(15);
  const [settingsMsg, setSettingsMsg] = useState('');

  const fetchAdminData = async () => {
    try {
      const [statsRes, deptsRes, docsRes, patientsRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/departments'),
        api.get('/doctors'),
        api.get('/admin/patients')
      ]);

      setStats(statsRes.data);
      setDepartments(deptsRes.data);
      setDoctors(docsRes.data);
      setPatients(patientsRes.data);
    } catch (e) {
      console.error('Failed to load admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleSaveDept = async (e) => {
    e.preventDefault();
    try {
      if (editingDeptId) {
        await api.put(`/departments/${editingDeptId}`, deptForm);
      } else {
        await api.post('/departments', deptForm);
      }
      setIsDeptModalOpen(false);
      setDeptForm({ name: '', description: '' });
      setEditingDeptId(null);
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save department');
    }
  };

  const handleToggleDept = async (id) => {
    try {
      await api.delete(`/departments/${id}`);
      fetchAdminData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveDoc = async (e) => {
    e.preventDefault();
    try {
      await api.post('/doctors', {
        ...docForm,
        department_id: parseInt(docForm.department_id)
      });
      setIsDocModalOpen(false);
      setDocForm({
        name: '', email: '', phone: '', password: 'doctor123', department_id: '', specialization: '', qualification: '', experience: 5, consultation_fee: 100
      });
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add doctor');
    }
  };

  const handleToggleDoc = async (id) => {
    try {
      await api.delete(`/doctors/${id}`);
      fetchAdminData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/settings?default_consultation_minutes=${consultDuration}`);
      setSettingsMsg('System consultation settings updated successfully!');
      setTimeout(() => setSettingsMsg(''), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Hospital Operations & Admin Control
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
          Overview of departments, doctors, patient queue metrics, and system configurations.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('overview')} 
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-outline'}`}
        >
          <Calendar size={18} /> System Analytics
        </button>
        <button 
          onClick={() => setActiveTab('departments')} 
          className={`btn ${activeTab === 'departments' ? 'btn-primary' : 'btn-outline'}`}
        >
          <Building2 size={18} /> Departments ({departments.length})
        </button>
        <button 
          onClick={() => setActiveTab('doctors')} 
          className={`btn ${activeTab === 'doctors' ? 'btn-primary' : 'btn-outline'}`}
        >
          <Stethoscope size={18} /> Doctors ({doctors.length})
        </button>
        <button 
          onClick={() => setActiveTab('patients')} 
          className={`btn ${activeTab === 'patients' ? 'btn-primary' : 'btn-outline'}`}
        >
          <Users size={18} /> Patients Directory ({patients.length})
        </button>
        <button 
          onClick={() => setActiveTab('settings')} 
          className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-outline'}`}
        >
          <Settings size={18} /> Settings
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Users size={24} />
              </div>
              <div>
                <div className="stat-val">{stats?.total_patients || 0}</div>
                <div className="stat-lbl">Registered Patients</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                <Stethoscope size={24} />
              </div>
              <div>
                <div className="stat-val">{stats?.total_doctors || 0}</div>
                <div className="stat-lbl">Active Doctors</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                <Calendar size={24} />
              </div>
              <div>
                <div className="stat-val">{stats?.today_appointments || 0}</div>
                <div className="stat-lbl">Today's Appointments</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                <Clock size={24} />
              </div>
              <div>
                <div className="stat-val">{stats?.today_waiting || 0}</div>
                <div className="stat-lbl">Waiting Queue</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div className="stat-val">{stats?.today_completed || 0}</div>
                <div className="stat-lbl">Completed Today</div>
              </div>
            </div>
          </div>

          {/* Department breakdown card */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1.25rem' }}>
              Department-wise Appointment Volume
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {stats?.appointments_by_department && Object.entries(stats.appointments_by_department).map(([dept, count]) => (
                <div key={dept} style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{dept}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>{count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEPARTMENTS */}
      {activeTab === 'departments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontWeight: 800 }}>Hospital Departments</h3>
            <button 
              onClick={() => { setEditingDeptId(null); setDeptForm({ name: '', description: '' }); setIsDeptModalOpen(true); }} 
              className="btn btn-primary"
            >
              <Plus size={18} /> Add Department
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Department Name</th>
                  <th>Description</th>
                  <th>Doctors Count</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id}>
                    <td>#{dept.id}</td>
                    <td><strong>{dept.name}</strong></td>
                    <td>{dept.description || 'N/A'}</td>
                    <td><span className="badge badge-WAITING">{dept.doctor_count} Active</span></td>
                    <td><Badge status={dept.status} /></td>
                    <td>
                      <button 
                        onClick={() => handleToggleDept(dept.id)} 
                        className="btn btn-secondary btn-sm"
                      >
                        {dept.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DOCTORS */}
      {activeTab === 'doctors' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontWeight: 800 }}>Doctor Roster & Schedules</h3>
            <button 
              onClick={() => { setIsDocModalOpen(true); }} 
              className="btn btn-primary"
            >
              <Plus size={18} /> Add New Doctor
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Department</th>
                  <th>Specialization</th>
                  <th>Qualification</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <strong>Dr. {doc.name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{doc.email}</div>
                    </td>
                    <td>{doc.department_name}</td>
                    <td>{doc.specialization}</td>
                    <td>{doc.qualification}</td>
                    <td>${doc.consultation_fee}</td>
                    <td><Badge status={doc.status} /></td>
                    <td>
                      <button 
                        onClick={() => handleToggleDoc(doc.id)} 
                        className="btn btn-secondary btn-sm"
                      >
                        {doc.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PATIENTS */}
      {activeTab === 'patients' && (
        <div>
          <h3 style={{ marginBottom: '1rem', fontWeight: 800 }}>Registered Patients Directory</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>DOB</th>
                  <th>Gender</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.email}</td>
                    <td>{p.phone || 'N/A'}</td>
                    <td>{p.date_of_birth || 'N/A'}</td>
                    <td><span style={{ textTransform: 'capitalize' }}>{p.gender || 'N/A'}</span></td>
                    <td>{p.address || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="card" style={{ maxWidth: 600 }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem' }}>
            Hospital Queue & System Settings
          </h3>

          {settingsMsg && (
            <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontWeight: 600 }}>
              {settingsMsg}
            </div>
          )}

          <form onSubmit={handleSaveSettings}>
            <div className="form-group">
              <label className="form-label">Default Consultation Duration (Minutes)</label>
              <input 
                type="number" 
                className="form-input" 
                value={consultDuration} 
                onChange={(e) => setConsultDuration(parseInt(e.target.value))}
                min={5}
                max={60}
                required
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Used to dynamically compute estimated wait times for patients in queue.
              </span>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              Save System Settings
            </button>
          </form>
        </div>
      )}

      {/* Add Department Modal */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title="Add Hospital Department"
      >
        <form onSubmit={handleSaveDept}>
          <div className="form-group">
            <label className="form-label">Department Name *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Ophthalmology"
              value={deptForm.name} 
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea 
              className="form-textarea" 
              rows={3} 
              placeholder="Short details about services..."
              value={deptForm.description} 
              onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Save Department
          </button>
        </form>
      </Modal>

      {/* Add Doctor Modal */}
      <Modal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        title="Add New Doctor"
      >
        <form onSubmit={handleSaveDoc}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Dr. Gregory House"
              value={docForm.name} 
              onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
              required 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="house@hospital.com"
                value={docForm.email} 
                onChange={(e) => setDocForm({ ...docForm, email: e.target.value })}
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="+1 555-9090"
                value={docForm.phone} 
                onChange={(e) => setDocForm({ ...docForm, phone: e.target.value })}
                required 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Department *</label>
              <select 
                className="form-select" 
                value={docForm.department_id}
                onChange={(e) => setDocForm({ ...docForm, department_id: e.target.value })}
                required
              >
                <option value="">Select Dept</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Specialization *</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Diagnostics"
                value={docForm.specialization} 
                onChange={(e) => setDocForm({ ...docForm, specialization: e.target.value })}
                required 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Qualification</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="MD, PhD"
                value={docForm.qualification} 
                onChange={(e) => setDocForm({ ...docForm, qualification: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Consultation Fee ($)</label>
              <input 
                type="number" 
                className="form-input" 
                value={docForm.consultation_fee} 
                onChange={(e) => setDocForm({ ...docForm, consultation_fee: parseFloat(e.target.value) })}
                required 
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
            Register & Add Doctor
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
