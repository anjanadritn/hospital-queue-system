import React, { useState } from 'react';
import {
  Pill,
  FlaskConical,
  Clock,
  Sparkles,
  CheckCircle2,
  PackageCheck,
  Droplet,
  Activity,
  FileCheck2,
  Stethoscope,
  Building2,
  Calendar,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  MapPin,
  Check
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function PharmacyLabOrdersSection({
  pharmacyOrders = [],
  labOrders = [],
  loading = false,
  onRefresh = () => {}
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('pharmacy'); // 'pharmacy' | 'lab'
  const [expandedOrders, setExpandedOrders] = useState({});

  const toggleExpand = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Pharmacy Progress Stepper Definition (Waiting → Preparing → Dispensed)
  const pharmacyStages = [
    { id: 'waiting', label: 'Waiting', sub: 'Order Queued', icon: Clock },
    { id: 'preparing', label: 'Preparing', sub: 'Packing Meds', icon: Sparkles },
    { id: 'dispensed', label: 'Dispensed', sub: 'Ready for Pickup', icon: PackageCheck }
  ];

  const getPharmacyStepIndex = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'dispensed') return 2;
    if (s === 'preparing') return 1;
    return 0; // 'waiting' or fallback
  };

  // Lab Progress Stepper Definition (Waiting → Sample Collected → Processing → Report Ready)
  const labStages = [
    { id: 'waiting', label: 'Waiting', sub: 'Awaiting Sample', icon: Clock },
    { id: 'sample_collected', label: 'Sample Collected', sub: 'Specimen Received', icon: Droplet },
    { id: 'processing', label: 'Processing', sub: 'Diagnostic Analysis', icon: Activity },
    { id: 'report_ready', label: 'Report Ready', sub: 'Findings Verified', icon: FileCheck2 }
  ];

  const getLabStepIndex = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'report_ready') return 3;
    if (s === 'processing') return 2;
    if (s === 'sample_collected') return 1;
    return 0; // 'waiting' or fallback
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr);
      return (
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ' • ' +
        d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      );
    } catch {
      return dateStr;
    }
  };

  return (
    <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
      
      {/* 1. Header with Tab Switcher & Refresh Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
              Clinical Hand-off Tracking
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            Pharmacy & Lab Orders
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Track real-time fulfillment of prescriptions and laboratory investigations ordered by your attending doctors.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh order statuses"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('pharmacy')}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'pharmacy'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Pill className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pharmacy</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'pharmacy' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {pharmacyOrders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('lab')}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'lab'
                  ? 'bg-white text-indigo-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
              <span>Laboratory</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'lab' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {labOrders.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Pharmacy Orders Tab Content */}
      {activeTab === 'pharmacy' && (
        <div className="space-y-4">
          {pharmacyOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50/60 rounded-2xl border border-slate-200/70 space-y-2">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 mx-auto shadow-2xs">
                <Pill className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-xs font-extrabold text-slate-700">No Pharmacy Orders Yet</h3>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Prescriptions prescribed during your clinical consultations at SIMSRH will automatically appear here for real-time dispensing tracking.
              </p>
            </div>
          ) : (
            pharmacyOrders.map((order) => {
              const currentStepIdx = getPharmacyStepIndex(order.status);
              const isDispensed = order.status === 'dispensed';
              const isPreparing = order.status === 'preparing';
              const prescriptions = Array.isArray(order.prescriptions) ? order.prescriptions : [];
              const isExpanded = !!expandedOrders[order.order_id];

              return (
                <div
                  key={order.order_id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50/40 via-teal-50/20 to-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                          {order.order_id}
                        </span>

                        {/* Status Badge */}
                        {isDispensed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Dispensed & Ready</span>
                          </span>
                        ) : isPreparing ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-sky-100 text-sky-800 border border-sky-300">
                            <Sparkles className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                            <span>Preparing in Pharmacy</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Waiting Preparation</span>
                          </span>
                        )}

                        {order.consultation_id && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            Ref: {order.consultation_id}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-0.5">
                        <span className="font-bold flex items-center gap-1 text-slate-800">
                          <Stethoscope className="w-3.5 h-3.5 text-sky-600" />
                          {order.doctor_name || 'Attending Physician'}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {order.department || 'General Medicine'}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpand(order.order_id)}
                      className="self-end sm:self-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide Medicines' : `View Medicines (${prescriptions.length})`}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Visual Progress Stepper: Waiting → Preparing → Dispensed */}
                  <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
                    <div className="max-w-2xl mx-auto">
                      <div className="grid grid-cols-3 relative">
                        {/* Connecting Line */}
                        <div className="absolute top-4 left-1/6 right-1/6 h-1 bg-slate-200 -z-0">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{
                              width: currentStepIdx === 0 ? '0%' : currentStepIdx === 1 ? '50%' : '100%'
                            }}
                          />
                        </div>

                        {pharmacyStages.map((stage, sIdx) => {
                          const isCompleted = sIdx < currentStepIdx;
                          const isCurrent = sIdx === currentStepIdx;
                          const isDone = sIdx <= currentStepIdx;
                          const Icon = stage.icon;

                          return (
                            <div key={stage.id} className="flex flex-col items-center text-center relative z-10">
                              <div
                                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                                  isCompleted
                                    ? 'bg-emerald-600 text-white shadow-sm ring-4 ring-emerald-100'
                                    : isCurrent
                                      ? 'bg-emerald-600 text-white shadow-md ring-4 ring-emerald-200 animate-pulse'
                                      : 'bg-white text-slate-400 border-2 border-slate-300'
                                }`}
                              >
                                {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                              </div>

                              <span
                                className={`mt-2 text-xs font-extrabold ${
                                  isCurrent
                                    ? 'text-emerald-800'
                                    : isDone
                                      ? 'text-slate-800'
                                      : 'text-slate-400'
                                }`}
                              >
                                {stage.label}
                              </span>
                              <span className="text-[10px] text-slate-400 hidden sm:block">
                                {stage.sub}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Ready for Pickup Notice Banner */}
                  {isDispensed && (
                    <div className="px-4 py-3 bg-emerald-50 text-emerald-900 border-b border-emerald-100 flex items-center gap-2.5 text-xs font-bold">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Prescription dispensed! Please collect your medications at the SIMSRH Hospital Pharmacy counter (Ground Floor).
                      </span>
                    </div>
                  )}

                  {/* Expandable Prescribed Medicines Details */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-3 bg-white">
                      <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        <span>Prescribed Medicines ({prescriptions.length})</span>
                      </div>

                      <div className="space-y-2">
                        {prescriptions.map((med, mIdx) => (
                          <div
                            key={mIdx}
                            className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900">
                                  {med.medicine || med.name}
                                </span>
                                {med.rxcui && (
                                  <span className="text-[9px] font-mono bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded border border-sky-200">
                                    RxCUI: {med.rxcui}
                                  </span>
                                )}
                              </div>
                              {med.instructions && (
                                <p className="text-[11px] text-slate-500 italic">
                                  {med.instructions}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 shrink-0">
                              <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                                {med.dosage || 'Standard'}
                              </span>
                              <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-sky-700">
                                {med.frequency || 'Daily'}
                              </span>
                              <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-emerald-700">
                                {med.duration || 'Full course'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed mt-2">
                          <span className="font-bold block text-amber-800">Doctor Advice:</span>
                          {order.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. Laboratory Orders Tab Content */}
      {activeTab === 'lab' && (
        <div className="space-y-4">
          {labOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50/60 rounded-2xl border border-slate-200/70 space-y-2">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 mx-auto shadow-2xs">
                <FlaskConical className="w-6 h-6 text-indigo-500" />
              </div>
              <h3 className="text-xs font-extrabold text-slate-700">No Laboratory Investigations Found</h3>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Diagnostic lab investigations ordered during your doctor consultations will automatically appear here for real-time progress tracking.
              </p>
            </div>
          ) : (
            labOrders.map((order) => {
              const currentStepIdx = getLabStepIndex(order.status);
              const isReportReady = order.status === 'report_ready';
              const isProcessing = order.status === 'processing';
              const isSampleCollected = order.status === 'sample_collected';
              const tests = Array.isArray(order.tests) ? order.tests : [];
              const isExpanded = !!expandedOrders[order.order_id];

              return (
                <div
                  key={order.order_id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50/40 via-purple-50/20 to-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                          {order.order_id}
                        </span>

                        {/* Status Badge */}
                        {isReportReady ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Report Ready & Published</span>
                          </span>
                        ) : isProcessing ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-sky-100 text-sky-800 border border-sky-300">
                            <Activity className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                            <span>Processing in Lab</span>
                          </span>
                        ) : isSampleCollected ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300">
                            <Droplet className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Sample Collected</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Waiting for Sample</span>
                          </span>
                        )}

                        {order.consultation_id && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            Ref: {order.consultation_id}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-0.5">
                        <span className="font-bold flex items-center gap-1 text-slate-800">
                          <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                          {order.doctor_name || 'Attending Physician'}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {order.department || 'General Medicine'}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpand(order.order_id)}
                      className="self-end sm:self-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide Tests' : `View Tests (${tests.length})`}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Visual Progress Stepper: Waiting → Sample Collected → Processing → Report Ready */}
                  <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
                    <div className="max-w-3xl mx-auto">
                      <div className="grid grid-cols-4 relative">
                        {/* Connecting Line */}
                        <div className="absolute top-4 left-1/8 right-1/8 h-1 bg-slate-200 -z-0">
                          <div
                            className="h-full bg-indigo-500 transition-all duration-500"
                            style={{
                              width:
                                currentStepIdx === 0
                                  ? '0%'
                                  : currentStepIdx === 1
                                    ? '33.33%'
                                    : currentStepIdx === 2
                                      ? '66.66%'
                                      : '100%'
                            }}
                          />
                        </div>

                        {labStages.map((stage, sIdx) => {
                          const isCompleted = sIdx < currentStepIdx;
                          const isCurrent = sIdx === currentStepIdx;
                          const isDone = sIdx <= currentStepIdx;
                          const Icon = stage.icon;

                          return (
                            <div key={stage.id} className="flex flex-col items-center text-center relative z-10">
                              <div
                                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                                  isCompleted
                                    ? 'bg-indigo-600 text-white shadow-sm ring-4 ring-indigo-100'
                                    : isCurrent
                                      ? 'bg-indigo-600 text-white shadow-md ring-4 ring-indigo-200 animate-pulse'
                                      : 'bg-white text-slate-400 border-2 border-slate-300'
                                }`}
                              >
                                {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                              </div>

                              <span
                                className={`mt-2 text-xs font-extrabold ${
                                  isCurrent
                                    ? 'text-indigo-800'
                                    : isDone
                                      ? 'text-slate-800'
                                      : 'text-slate-400'
                                }`}
                              >
                                {stage.label}
                              </span>
                              <span className="text-[10px] text-slate-400 hidden sm:block">
                                {stage.sub}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Report Published Findings Banner */}
                  {isReportReady && (
                    <div className="p-4 bg-emerald-50/90 text-emerald-950 border-b border-emerald-200 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold">
                        <FileCheck2 className="w-4 h-4 text-emerald-600" />
                        <span>Pathology Findings & Verification Summary:</span>
                      </div>
                      <p className="text-[11px] text-emerald-900 leading-relaxed font-medium pl-5">
                        {order.report_data?.summary ||
                          (typeof order.report_data === 'string' ? order.report_data : 'All diagnostic parameters clinically verified and recorded in your electronic health record.')}
                      </p>
                      {order.report_data?.verified_by && (
                        <div className="text-[10px] text-emerald-700 pl-5 pt-0.5">
                          Verified by: <strong>{order.report_data.verified_by}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expandable Requested Tests Details */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-3 bg-white">
                      <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        <span>Requested Investigations ({tests.length})</span>
                      </div>

                      <div className="space-y-2">
                        {tests.map((test, tIdx) => (
                          <div
                            key={tIdx}
                            className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900">
                                  {test.test_name || test}
                                </span>
                                {test.test_code && (
                                  <span className="text-[9px] font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded border border-indigo-200">
                                    {test.test_code}
                                  </span>
                                )}
                              </div>
                              {test.instructions && (
                                <p className="text-[11px] text-slate-500 italic">
                                  {test.instructions}
                                </p>
                              )}
                            </div>

                            <span className="text-[10px] font-semibold bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200 self-start sm:self-center">
                              {test.category || 'Diagnostic Pathology'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed mt-2">
                          <span className="font-bold block text-amber-800">Technician / Clinical Notes:</span>
                          {order.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
