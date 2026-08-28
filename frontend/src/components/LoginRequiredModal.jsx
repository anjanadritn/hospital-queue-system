import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LogIn, UserPlus, X, ShieldAlert } from 'lucide-react';

export default function LoginRequiredModal({ isOpen, onClose, title = "Login Required", message = "Please login or create a patient account before joining a hospital queue.", returnPath = "/doctors" }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleLoginClick = () => {
    onClose();
    navigate(`/login?return=${encodeURIComponent(returnPath)}`);
  };

  const handleSignupClick = () => {
    onClose();
    navigate(`/signup?return=${encodeURIComponent(returnPath)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200 text-center">
        
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-extrabold text-slate-900 mb-2">{title}</h2>
        <p className="text-xs text-slate-600 mb-6 font-medium leading-relaxed">
          {message}
        </p>

        <div className="space-y-3">
          <button
            onClick={handleLoginClick}
            className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>Login to Continue</span>
          </button>

          <button
            onClick={handleSignupClick}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4 text-sky-600" />
            <span>Create Patient Account</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
