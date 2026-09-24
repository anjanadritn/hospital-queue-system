import React from 'react';
import { BarChart3, PieChart, Users, ShieldAlert, Clock, Cpu } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function Analytics({ queueData = [] }) {
  const totalEntries = queueData.length;
  const emergencyCount = queueData.filter((q) => q.priority === 'emergency').length;
  const normalCount = totalEntries - emergencyCount;

  const departmentCounts = queueData.reduce((acc, q) => {
    const dept = q.department || 'Cardiology';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {});

  const avgWait = totalEntries > 0
    ? Math.round(queueData.reduce((sum, q) => sum + (q.predicted_wait_time || 15), 0) / totalEntries)
    : 0;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Hospital Queue Analytics</h2>
        <p className="text-xs text-slate-500">Live operational metrics aggregated from active MongoDB queue records</p>
      </div>

      {/* TOP ANALYTICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Active Patients</span>
            <div className="w-9 h-9 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mb-1">{totalEntries}</div>
          <p className="text-xs text-slate-500 font-medium">Patients in consultation or waiting</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Emergency Priority Ratio</span>
            <div className="w-9 h-9 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-rose-600 mb-1">
            {totalEntries > 0 ? Math.round((emergencyCount / totalEntries) * 100) : 0}%
          </div>
          <p className="text-xs text-rose-700 font-medium">{emergencyCount} Emergency / {normalCount} Normal</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg AI Predicted Wait</span>
            <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-700 mb-1">~{avgWait} mins</div>
          <p className="text-xs text-emerald-800 font-medium">Calculated by Random Forest ML API</p>
        </div>
      </div>

      {/* DEPARTMENT BREAKDOWN */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-sky-600" /> Queue Distribution by Department
        </h3>

        {Object.keys(departmentCounts).length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No queue data available for department distribution.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(departmentCounts).map(([dept, count]) => {
              const pct = totalEntries > 0 ? Math.round((count / totalEntries) * 100) : 0;
              return (
                <div key={dept}>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>{dept}</span>
                    <span>{count} Patients ({pct}%)</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
