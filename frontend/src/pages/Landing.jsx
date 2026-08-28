import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Clock, Cpu, Users, Stethoscope, ArrowRight, CheckCircle2, HeartPulse, Sparkles, Activity } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-900 via-slate-900 to-slate-950 text-white py-24 lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-500/20 via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-300 text-xs font-semibold mb-6 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>Next-Gen Healthcare Technology Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6">
              Smarter Queues. Less Waiting. <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-teal-300">Better Care.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 font-normal mb-10 max-w-2xl mx-auto leading-relaxed">
              Transforming hospital queue management through real-time queue tracking, priority emergency escalation, and Random Forest ML wait-time prediction.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/doctors"
                className="w-full sm:w-auto px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-2xl text-sm transition shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 group"
              >
                <span>Find a Doctor & Join Queue</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </Link>
              <Link
                to="/tracking"
                className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-2xl text-sm transition backdrop-blur-md border border-white/10 flex items-center justify-center gap-2"
              >
                <Activity className="w-4 h-4 text-sky-400" />
                <span>Track Live Queue Token</span>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* STATS BANNER */}
      <section className="bg-white border-y border-slate-200 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-1">70%</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Wait Time Reduction</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-sky-600 mb-1">Instant</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Emergency Priority</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-1">AI-Powered</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Random Forest Predictions</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600 mb-1">Live</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Staff Queue Control</div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-sky-600 mb-2">Simple 4-Step Process</h2>
            <p className="text-3xl font-bold text-slate-900">How Smart Hospital Works</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { num: '01', title: 'Find Doctor', desc: 'Browse available specialists and check consultation schedules.', icon: Stethoscope },
              { num: '02', title: 'Join Queue', desc: 'Get a digital queue token for normal or emergency consultation.', icon: Users },
              { num: '03', title: 'Track Live Status', desc: 'Monitor your position and AI-calculated wait time on your phone.', icon: Clock },
              { num: '04', title: 'Receive Care', desc: 'Walk in right when called by doctor without sitting in waiting rooms.', icon: CheckCircle2 },
            ].map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative">
                  <div className="text-4xl font-extrabold text-slate-200 mb-4">{step.num}</div>
                  <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-600 mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* KEY FEATURES */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-sky-600 mb-2">Core Features</h2>
            <p className="text-3xl font-bold text-slate-900">Designed for Patients & Healthcare Providers</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200/80">
              <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 mb-6">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Emergency Escalation</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Critical condition patients can be immediately promoted to Emergency Priority, automatically adjusting position rankings.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200/80">
              <div className="w-12 h-12 bg-sky-100 rounded-2xl flex items-center justify-center text-sky-600 mb-6">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">AI Wait-Time Predictions</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Random Forest ML model computes accurate waiting times based on queue size, department, and consultation pace.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200/80">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
                <HeartPulse className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Staff Dashboard Control</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hospital staff monitor all live department queues, doctor shift schedules, and patient status flow seamlessly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto bg-slate-950 text-slate-400 py-12 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs">
          <p className="text-slate-300 font-bold text-sm mb-2">SMART HOSPITAL QUEUE MANAGEMENT SYSTEM</p>
          <p className="text-slate-500 mb-4">Powered by Python Flask, PyMongo, MongoDB, and Random Forest Machine Learning Model.</p>
          <p className="text-slate-600">© 2026 Smart Hospital Technology. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
