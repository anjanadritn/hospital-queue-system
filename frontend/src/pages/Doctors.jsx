import React, { useState, useEffect } from 'react';
import { Search, Filter, Stethoscope } from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import DoctorCard from '../components/DoctorCard';
import QueueJoinModal from '../components/QueueJoinModal';
import LoginRequiredModal from '../components/LoginRequiredModal';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function Doctors() {
  const { user, isAuthenticated } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedDoctorForModal, setSelectedDoctorForModal] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const loadDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hospitalApi.getDoctors();
      setDoctors(data || []);
    } catch (err) {
      console.error(err);
      setError('Unable to fetch doctors list from Flask backend. Please ensure Flask server is running at localhost:5000');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const handleJoinQueueClick = (doctor) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (user?.role !== 'patient') {
      alert('Doctor and Admin accounts cannot join patient queues. Please login as a Patient.');
      return;
    }
    setSelectedDoctorForModal(doctor);
  };

  const departments = ['All', ...new Set(doctors.map((d) => d.department))];

  const filteredDoctors = doctors.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'All' || doc.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">Find a Specialist</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Browse available hospital doctors and request an instant queue token
        </p>
      </div>

      {/* Filter Controls */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs mb-8 flex flex-col md:flex-row gap-4 justify-between items-center">
        
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by doctor name or specialty..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
          />
        </div>

        {/* Department Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition ${
                selectedDept === dept
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

      </div>

      {/* Content States */}
      {loading ? (
        <LoadingState message="Loading hospital specialists..." />
      ) : error ? (
        <ErrorState error={error} onRetry={loadDoctors} />
      ) : filteredDoctors.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-md mx-auto my-8">
          <Stethoscope className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Doctors Found</h3>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or department filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doctor) => (
            <DoctorCard
              key={doctor.doctor_id}
              doctor={doctor}
              onJoinQueue={handleJoinQueueClick}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      )}

      {/* Queue Join Modal (Only opened after successful login) */}
      {selectedDoctorForModal && (
        <QueueJoinModal
          doctor={selectedDoctorForModal}
          isOpen={!!selectedDoctorForModal}
          onClose={() => setSelectedDoctorForModal(null)}
        />
      )}

      {/* Login Required Modal */}
      <LoginRequiredModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Login Required"
        message="Please login or create a patient account before joining a hospital queue."
        returnPath="/doctors"
      />

    </div>
  );
}
