import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import BookAppointment from './pages/BookAppointment';
import PatientDashboard from './pages/PatientDashboard';
import Doctors from './pages/Doctors';
import DoctorProfile from './pages/DoctorProfile';
import Departments from './pages/Departments';
import QueueTracking from './pages/QueueTracking';
import MLPrediction from './pages/MLPrediction';
import AnalyticsPage from './pages/AnalyticsPage';
import AboutHospital from './pages/AboutHospital';
import StaffDashboard from './pages/StaffDashboard';
import DoctorQueuePrediction from './pages/DoctorQueuePrediction';
import AdminDashboard from './pages/Admin/AdminDashboard';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
        <div className="min-h-screen bg-slate-50 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
          <Navbar />
          <div className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/about" element={<AboutHospital />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/doctors" element={<Doctors />} />
              <Route path="/doctors/:doctorId" element={<DoctorProfile />} />
              <Route path="/departments" element={<Departments />} />
              <Route path="/predict" element={<MLPrediction />} />
              <Route path="/analytics" element={<AnalyticsPage />} />

              {/* Protected Patient Routes */}
              <Route
                path="/book"
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <BookAppointment />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/patient"
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <PatientDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tracking"
                element={
                  <ProtectedRoute allowedRoles={['patient', 'doctor', 'admin']}>
                    <QueueTracking />
                  </ProtectedRoute>
                }
              />

              {/* Protected Doctor & Staff Routes */}
              <Route
                path="/doctor"
                element={
                  <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                    <StaffDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/staff"
                element={
                  <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                    <StaffDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor/predictions"
                element={
                  <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                    <DoctorQueuePrediction />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor-prediction"
                element={
                  <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                    <DoctorQueuePrediction />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor/queue-prediction"
                element={
                  <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                    <DoctorQueuePrediction />
                  </ProtectedRoute>
                }
              />

              {/* Protected Admin Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
    </LanguageProvider>
  );
}
