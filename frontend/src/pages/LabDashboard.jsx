import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  Building2,
  Calendar,
  Sparkles,
  Activity,
  FileCheck2,
  Loader2,
  TestTube2,
  Droplet,
  ClipboardList,
  FileText
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatErrorMessage } from '../utils/errorUtils';

export default function LabDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'waiting' | 'sample_collected' | 'processing' | 'report_ready'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  // Modal state for entering report findings on "Report Ready"
  const [reportModalOrder, setReportModalOrder] = useState(null);
  const [reportNotes, setReportNotes] = useState('');
  const [reportResultSummary, setReportResultSummary] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hospitalApi.getLabOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[LabDashboard] Failed to fetch lab orders:', err);
      setError(formatErrorMessage(err, 'Failed to load laboratory orders. Please check your connection.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus, extraData = null) => {
    setActionLoadingId(orderId);
    setActionSuccessMsg(null);
    try {
      const staffName = user?.name || user?.user_id || 'Lab Technician';
      const notes = extraData?.notes || '';
      const reportData = extraData?.report_data || null;

      await hospitalApi.updateLabOrderStatus(orderId, newStatus, notes, reportData, staffName);

      setOrders((prev) =>
        prev.map((o) =>
          o.order_id === orderId
            ? {
                ...o,
                status: newStatus,
                ...(newStatus === 'sample_collected' ? { sample_collected_at: new Date().toISOString() } : {}),
                ...(newStatus === 'processing' ? { processing_at: new Date().toISOString() } : {}),
                ...(newStatus === 'report_ready' ? { report_ready_at: new Date().toISOString(), report_data: reportData } : {})
              }
            : o
        )
      );

      const statusLabels = {
        sample_collected: 'Sample marked as collected',
        processing: 'Investigation moved to processing',
        report_ready: 'Report verified and marked ready'
      };

      setActionSuccessMsg(`Order ${orderId}: ${statusLabels[newStatus] || 'Status updated'}!`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
      setReportModalOrder(null);
      setReportNotes('');
      setReportResultSummary('');
    } catch (err) {
      console.error(`[LabDashboard] Failed to update order ${orderId}:`, err);
      alert(err.response?.data?.error || `Failed to update status to ${newStatus}.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenReportModal = (order) => {
    setReportModalOrder(order);
    setReportNotes('');
    setReportResultSummary('All parameters within standard physiological range. Clinically correlated.');
  };

  const handleSubmitReport = (e) => {
    e.preventDefault();
    if (!reportModalOrder) return;
    const reportData = {
      summary: reportResultSummary.trim() || 'Verified clinical diagnostic report',
      verified_by: user?.name || 'Pathology Division',
      verified_at: new Date().toISOString()
    };
    handleUpdateStatus(reportModalOrder.order_id, 'report_ready', {
      notes: reportNotes.trim(),
      report_data: reportData
    });
  };

  // Filter orders by status & search query
  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const patientMatch = (o.patient_name || '').toLowerCase().includes(q) || (o.patient_id || '').toLowerCase().includes(q);
      const doctorMatch = (o.doctor_name || '').toLowerCase().includes(q);
      const orderMatch = (o.order_id || '').toLowerCase().includes(q);
      const testMatch = Array.isArray(o.tests) && o.tests.some((t) => (t.test_name || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q));
      return patientMatch || doctorMatch || orderMatch || testMatch;
    }
    return true;
  });

  // KPI Metrics
  const waitingCount = orders.filter((o) => o.status === 'waiting').length;
  const sampleCount = orders.filter((o) => o.status === 'sample_collected').length;
  const processingCount = orders.filter((o) => o.status === 'processing').length;
  const readyCount = orders.filter((o) => o.status === 'report_ready').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* 1. TOP HEADER BANNER */}
      <section className="bg-gradient-to-r from-indigo-950 via-slate-950 to-sky-950 text-white border-b border-white/10 pt-8 pb-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-10 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-400/30 mb-2">
                <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />
                <span>Laboratory & Diagnostics Console</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                Clinical Pathology Requisitions
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl font-medium">
                Live investigation orders, specimen workflow & diagnostic report authorization for SIMSRH.
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
                <ClipboardList className="w-5 h-5" />
              </div>
            </div>

            {/* Waiting Specimen */}
            <div className="bg-amber-500/10 border border-amber-400/20 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block">
                  Pending Specimen
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-200 mt-0.5 block">
                  {waitingCount}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-300">
                <Droplet className="w-5 h-5" />
              </div>
            </div>

            {/* In Processing */}
            <div className="bg-sky-500/10 border border-sky-400/20 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider block">
                  Processing in Lab
                </span>
                <span className="text-2xl sm:text-3xl font-black text-sky-200 mt-0.5 block">
                  {sampleCount + processingCount}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-300">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            {/* Reports Ready */}
            <div className="bg-emerald-500/10 border border-emerald-400/20 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">
                  Reports Ready
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-200 mt-0.5 block">
                  {readyCount}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                <FileCheck2 className="w-5 h-5" />
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
              { id: 'waiting', label: 'Pending Specimen', count: waitingCount },
              { id: 'sample_collected', label: 'Sample Collected', count: sampleCount },
              { id: 'processing', label: 'Processing', count: processingCount },
              { id: 'report_ready', label: 'Report Ready', count: readyCount }
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
              placeholder="Search patient, doctor, test..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>
        </div>

        {/* 4. ORDERS LISTING */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-700">Loading laboratory orders...</p>
            <p className="text-xs text-slate-400 mt-1">Retrieving pathology test requisitions from clinical consultations</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-rose-200 shadow-sm max-w-lg mx-auto">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2.5" />
            <h3 className="text-sm font-bold text-slate-900">Failed to Load Orders</h3>
            <p className="text-xs text-slate-500 mt-1">{formatErrorMessage(error)}</p>
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
              <FlaskConical className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Laboratory Orders Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              {statusFilter !== 'all'
                ? `There are currently no orders in '${statusFilter}' status.`
                : 'Doctor-ordered lab investigations will automatically appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const isLoadingAction = actionLoadingId === order.order_id;
              const tests = Array.isArray(order.tests) ? order.tests : [];

              return (
                <div
                  key={order.order_id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Card Top Bar */}
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-slate-50/50 to-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                        {order.order_id}
                      </span>

                      {/* Status Badges */}
                      {order.status === 'waiting' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Droplet className="w-3.5 h-3.5 text-amber-600" />
                          <span>Pending Specimen Collection</span>
                        </span>
                      )}
                      {order.status === 'sample_collected' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          <TestTube2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Specimen Collected</span>
                        </span>
                      )}
                      {order.status === 'processing' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                          <Activity className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                          <span>In Analyzer / Processing</span>
                        </span>
                      )}
                      {order.status === 'report_ready' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Report Ready & Verified</span>
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

                  {/* Card Body */}
                  <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
                    
                    {/* Left: Patient & Clinical Meta */}
                    <div className="lg:col-span-4 space-y-3 lg:border-r lg:border-slate-100 lg:pr-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Patient Details
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
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
                          Requisition By
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

                      {order.clinical_indication && (
                        <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-200/60 text-[11px] text-indigo-950 leading-relaxed">
                          <span className="font-bold block text-indigo-900">Clinical Indication / Diagnosis:</span>
                          {order.clinical_indication}
                        </div>
                      )}
                    </div>

                    {/* Right: Requested Tests & Lifecycle Actions */}
                    <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <FlaskConical className="w-3.5 h-3.5 text-indigo-500" />
                            Requested Laboratory Investigations ({tests.length})
                          </span>
                        </div>

                        {/* Tests List */}
                        <div className="space-y-2">
                          {tests.map((test, tIdx) => (
                            <div
                              key={tIdx}
                              className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900">
                                    {test.test_name || test}
                                  </span>
                                  {test.test_code && (
                                    <span className="text-[9px] font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded border border-indigo-200">
                                      {test.test_code}
                                    </span>
                                  )}
                                </div>
                                {test.instructions && (
                                  <span className="text-[11px] text-slate-500 italic block">
                                    {test.instructions}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-semibold bg-white text-slate-700 px-2 py-1 rounded-lg border border-slate-200">
                                  {test.category || 'Clinical Pathology'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Report Data / Findings Showcase */}
                        {order.status === 'report_ready' && order.report_data && (
                          <div className="mt-3 p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
                            <span className="font-bold flex items-center gap-1.5 text-emerald-800 text-[11px]">
                              <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                              Pathologist Findings & Summary:
                            </span>
                            <p className="text-[11px] text-emerald-900 leading-relaxed font-medium">
                              {typeof order.report_data === 'object'
                                ? order.report_data.summary || JSON.stringify(order.report_data)
                                : String(order.report_data)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-[11px] text-slate-400">
                          {order.status === 'sample_collected' && order.sample_collected_at && (
                            <span>Sample: {new Date(order.sample_collected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                          {order.status === 'processing' && order.processing_at && (
                            <span>Processing: {new Date(order.processing_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                          {order.status === 'report_ready' && order.report_ready_at && (
                            <span>Ready: {new Date(order.report_ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Step 1: Waiting -> Sample Collected */}
                          {order.status === 'waiting' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(order.order_id, 'sample_collected')}
                              disabled={isLoadingAction}
                              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-amber-600/20 cursor-pointer disabled:opacity-50"
                            >
                              {isLoadingAction ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Droplet className="w-3.5 h-3.5" />
                              )}
                              <span>Sample Collected</span>
                            </button>
                          )}

                          {/* Step 2: Sample Collected -> Start Processing */}
                          {order.status === 'sample_collected' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(order.order_id, 'processing')}
                              disabled={isLoadingAction}
                              className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-sky-600/20 cursor-pointer disabled:opacity-50"
                            >
                              {isLoadingAction ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Activity className="w-3.5 h-3.5" />
                              )}
                              <span>Start Processing</span>
                            </button>
                          )}

                          {/* Step 3: Processing -> Report Ready */}
                          {order.status === 'processing' && (
                            <button
                              type="button"
                              onClick={() => handleOpenReportModal(order)}
                              disabled={isLoadingAction}
                              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              <span>Report Ready</span>
                            </button>
                          )}

                          {/* Completed */}
                          {order.status === 'report_ready' && (
                            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Diagnostic Report Published</span>
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

      {/* 5. MODAL FOR REPORT SUMMARY ON REPORT READY */}
      {reportModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <FileCheck2 className="w-4 h-4" />
                <span>Verify & Publish Diagnostic Report</span>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOrder(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Order: <span className="font-mono font-bold text-slate-800">{reportModalOrder.order_id}</span> • Patient:{' '}
              <span className="font-bold text-slate-800">{reportModalOrder.patient_name}</span>
            </p>

            <form onSubmit={handleSubmitReport} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Pathologist Findings / Diagnostic Summary
                </label>
                <textarea
                  rows={3}
                  value={reportResultSummary}
                  onChange={(e) => setReportResultSummary(e.target.value)}
                  placeholder="Enter diagnostic summary or test findings..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Internal Laboratory Note (Optional)
                </label>
                <input
                  type="text"
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Specimen quality, analyzer lot number, etc."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReportModalOrder(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === reportModalOrder.order_id}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoadingId === reportModalOrder.order_id && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Publish Report</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
