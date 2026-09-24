import React from 'react';
import { LayoutDashboard, ListOrdered, Stethoscope, BarChart3, HeartPulse, RefreshCw, Shield, Sparkles } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, onRefresh, loading }) {
  const menuItems = [
    { id: 'overview', label: 'OPD Overview', icon: LayoutDashboard, badge: 'Live' },
    { id: 'queue', label: 'Live Queue Console', icon: ListOrdered, badge: null },
    { id: 'doctors', label: 'Medical Specialists', icon: Stethoscope, badge: null },
    { id: 'analytics', label: 'Queue Analytics', icon: BarChart3, badge: 'AI' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-screen p-5 sm:p-6 flex flex-col justify-between shrink-0 border-r border-slate-800/80 select-none">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 bg-gradient-to-tr from-sky-600 to-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-sm text-white tracking-wider">SMARTHOSPITAL</h1>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-sky-400 font-semibold uppercase tracking-widest">OPD Staff Console</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider px-3 mb-2">
          Clinical Operations
        </div>
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-600 to-teal-600 text-white shadow-md shadow-sky-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide ${
                    item.badge === 'Live'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Refresh Action & Security Badge */}
      <div className="border-t border-slate-800 pt-5 space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-800 text-[11px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>RBAC Staff Authenticated</span>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-700/60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          <span>Refresh Queue Data</span>
        </button>
      </div>
    </aside>
  );
}
