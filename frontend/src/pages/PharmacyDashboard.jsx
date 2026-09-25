import React, { useState, useEffect } from 'react';
import {
  Pill,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  User,
  Stethoscope,
  Building2,
  Calendar,
  Sparkles,
  ArrowRight,
  Check,
  Loader2,
  ShieldCheck,
  PackageCheck
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function PharmacyDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'waiting' | 'preparing' | 'dispensed'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hospitalApi.getPharmacyOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[PharmacyDashboard] Failed to fetch orders:', err);
      setError(err.response?.data?.error || 'Failed to load pharmacy orders. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    setActionLoadingId(orderId);
    setActionSuccessMsg(null);
    try {
      const staffName = user?.name || user?.user_id || 'Pharmacist';
      await hospitalApi.updatePharmacyOrderStatus(orderId, newStatus, '', staffName);
      
      // Update local state smoothly
      setOrders((prev) =>
        prev.map((o) =>
          o.order_id === orderId
            ? {
                ...o,
                status: newStatus,
                ...(newStatus === 'preparing' ? { preparing_at: new Date().toISOString() } : {}),
                ...(newStatus === 'dispensed' ? { dispensed_at: new Date().toISOString() } : {})
              }
            : o
        )
      );

      const actionText = newStatus === 'preparing' ? 'is now being prepared' : 'has been dispensed';
      setActionSuccessMsg(`Order ${orderId} ${actionText}!`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err) {
      console.error(`[PharmacyDashboard] Failed to update order ${orderId}:`, err);
      alert(err.response?.data?.error || `Failed to update order status to ${newStatus}.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter orders based on status & search
  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const patientMatch = (o.patient_name || '').toLowerCase().includes(q) || (o.patient_id || '').toLowerCase().includes(q);
      const doctorMatch = (o.doctor_name || '').toLowerCase().includes(q);
      const orderMatch = (o.order_id || '').toLowerCase().includes(q);
      const medMatch = Array.isArray(o.prescriptions) && o.prescriptions.some((p) => (p.medicine || '').toLowerCase().includes(q));
      return patientMatch || doctorMatch || orderMatch || medMatch;
    }
    return true;
  });

  // Calculate counts for KPI summary
  const waitingCount = orders.filter((o) => o.status === 'waiting').length;
  const preparingCount = orders.filter((o) => o.status === 'preparing').length;
  const dispensedCount = orders.filter((o) => o.status === 'dispensed').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* 1. TOP HEADER BANNER */}
      <section className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 text-white border-b border-white/10 pt-8 pb-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30 mb-2">
                <Pill className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pharmacy & Dispensing Console</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                Outpatient Pharmacy Orders
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl font-medium">
                Real-time prescription orders directly dispatched from completed doctor consultations at SIMSRH.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchOrders}
                disabled={loading}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 border border-white/15 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Orders</span>
              </button>
            </div>
          </div>

          {/* 2. KPI METRICS CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
            {/* Total */}
            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Orders
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white mt-0.5 block">
                  {orders.length}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-slate-300">
                <Pill className="w-5 h-5" />
              </div>
            </div>

            {/* Waiting */}
            <div className="bg-amber-500/10 border border-amber-400/20 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block">
                  Waiting Orders
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-200 mt-0.5 block">
                  {waitingCount}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-300">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            {/* Preparing */}
            <div className="bg-sky-500/10 border border-sky-400/20 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider block">
                  In Preparation
                </span>
                <span className="text-2xl sm:text-3xl font-black text-sky-200 mt-0.5 block">
                  {preparingCount}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-300">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>

            {/* Dispensed */}
            <div className="bg-emerald-500/10 border border-emerald-400/20 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">
                  Dispensed
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-200 mt-0.5 block">
                  {dispensedCount}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                <PackageCheck className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. MAIN WORKSTATION CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* Success Alert Toast */}
        {actionSuccessMsg && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-sm animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 mb-6 flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {[
              { id: 'all', label: 'All Orders', count: orders.length },
              { id: 'waiting', label: 'Waiting', count: waitingCount },
              { id: 'preparing', label: 'Preparing', count: preparingCount },
              { id: 'dispensed', label: 'Dispensed', count: dispensedCount }
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient, doctor, drug..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>
        </div>

        {/* 4. ORDERS LISTING */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-700">Loading pharmacy orders...</p>
            <p className="text-xs text-slate-400 mt-1">Retrieving prescriptions from clinical consultations</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-rose-200 shadow-sm max-w-lg mx-auto">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2.5" />
            <h3 className="text-sm font-bold text-slate-900">Failed to Load Orders</h3>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              onClick={fetchOrders}
              className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 shadow-sm p-8 max-w-md mx-auto">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Pill className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Pharmacy Orders Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              {statusFilter !== 'all'
                ? `There are currently no orders in '${statusFilter}' status.`
                : 'Completed consultations with prescribed medicines will automatically appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const isLoadingAction = actionLoadingId === order.order_id;
              const prescriptions = Array.isArray(order.prescriptions) ? order.prescriptions : [];

              return (
                <div
                  key={order.order_id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Order Card Top Bar */}
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-slate-50/50 to-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                        {order.order_id}
                      </span>

                      {/* Status Badge */}
                      {order.status === 'waiting' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Waiting Preparation</span>
                        </span>
                      )}
                      {order.status === 'preparing' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                          <Sparkles className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                          <span>Preparing in Pharmacy</span>
                        </span>
                      )}
                      {order.status === 'dispensed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Dispensed & Completed</span>
                        </span>
                      )}

                      {order.consultation_id && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Ref: {order.consultation_id}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {order.created_at
                          ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
                            ' • ' +
                            new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                          : 'Just now'}
                      </span>
                    </div>
                  </div>

                  {/* Order Body Details */}
                  <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
                    
                    {/* Left: Patient & Clinical Meta */}
                    <div className="lg:col-span-4 space-y-3 lg:border-r lg:border-slate-100 lg:pr-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Patient Details
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center border border-emerald-200">
                            {(order.patient_name || 'P')[0]}
                          </div>
                          <div>
                            <span className="text-sm font-bold text-slate-900 block leading-tight">
                              {order.patient_name || 'Patient'}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              ID: {order.patient_id || '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Prescribed By
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 mt-1">
                          <Stethoscope className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span className="font-semibold">{order.doctor_name || 'Attending Physician'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{order.department || 'General Medicine'}</span>
                        </div>
                      </div>

                      {order.notes && (
                        <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/60 text-[11px] text-amber-900 leading-relaxed">
                          <span className="font-bold block text-amber-800">Doctor Advice / Note:</span>
                          {order.notes}
                        </div>
                      )}
                    </div>

                    {/* Right: Prescriptions Table & Action Buttons */}
                    <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Pill className="w-3.5 h-3.5 text-emerald-500" />
                            Prescribed Medicines ({prescriptions.length})
                          </span>
                        </div>

                        {/* Medicines List */}
                        <div className="space-y-2">
                          {prescriptions.map((med, mIdx) => (
                            <div
                              key={mIdx}
                              className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900">
                                    {med.medicine || med.name}
                                  </span>
                                  {med.rxcui && (
                                    <span className="text-[9px] font-mono bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded border border-sky-200">
                                      RxCUI: {med.rxcui}
                                    </span>
                                  )}
                                  {med.term_type && (
                                    <span className="text-[9px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded uppercase">
                                      {med.term_type}
                                    </span>
                                  )}
                                </div>

                                {med.instructions && (
                                  <span className="text-[11px] text-slate-500 italic block">
                                    {med.instructions}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-xs font-semibold text-slate-700 shrink-0">
                                <span className="bg-white px-2 py-1 rounded-lg border border-slate-200">
                                  {med.dosage || 'Standard'}
                                </span>
                                <span className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-sky-700">
                                  {med.frequency || 'As directed'}
                                </span>
                                <span className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-emerald-700">
                                  {med.duration || 'Full course'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Button Bar */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-[11px] text-slate-400">
                          {order.status === 'preparing' && order.preparing_at && (
                            <span>Preparing started: {new Date(order.preparing_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                          {order.status === 'dispensed' && order.dispensed_at && (
                            <span>Dispensed at: {new Date(order.dispensed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Waiting -> Start Preparing */}
                          {order.status === 'waiting' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(order.order_id, 'preparing')}
                              disabled={isLoadingAction}
                              className="px-4 py-2 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-sky-600/20 cursor-pointer disabled:opacity-50"
                            >
                              {isLoadingAction ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                              <span>Start Preparing</span>
                            </button>
                          )}

                          {/* Preparing -> Mark Dispensed */}
                          {order.status === 'preparing' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(order.order_id, 'dispensed')}
                              disabled={isLoadingAction}
                              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                            >
                              {isLoadingAction ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <PackageCheck className="w-3.5 h-3.5" />
                              )}
                              <span>Mark Dispensed</span>
                            </button>
                          )}

                          {/* Dispensed */}
                          {order.status === 'dispensed' && (
                            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Completed & Handed Over</span>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

    </div>
  );
}
