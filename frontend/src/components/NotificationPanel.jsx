import React, { useState, useEffect } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  AlertCircle,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Cpu,
  Info,
  Sparkles,
  Pill,
  FlaskConical
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { useLanguage } from '../context/LanguageContext';

export default function NotificationPanel({ patientId }) {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    if (!patientId) return;
    try {
      const data = await hospitalApi.getNotifications(patientId);
      setNotifications(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.notifications)
            ? data.notifications
            : []
      );
    } catch (err) {
      console.warn('Could not load notifications:', err);
    }
  };

  useEffect(() => {
    if (!patientId) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, [patientId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = async (notifId) => {
    try {
      await hospitalApi.markNotificationRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === notifId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await hospitalApi.markAllNotificationsRead(patientId);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  // Helper to categorize notification visual styling strictly according to color system
  const getNotificationStyle = (n) => {
    const text = `${n.title || ''} ${n.message || ''} ${n.type || ''}`.toLowerCase();

    if (text.includes('emergency') || text.includes('critical') || text.includes('urgent')) {
      return {
        borderClass: 'border-l-4 border-rose-500 bg-rose-50/70',
        badgeClass: 'bg-rose-100 text-rose-800',
        icon: <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />,
        typeLabel: 'Emergency'
      };
    }
    if (text.includes('call') || text.includes('turn') || text.includes('waiting') || text.includes('room') || text.includes('depart')) {
      return {
        borderClass: 'border-l-4 border-amber-500 bg-amber-50/70',
        badgeClass: 'bg-amber-100 text-amber-800',
        icon: <Clock className="w-4 h-4 text-amber-600 shrink-0" />,
        typeLabel: 'Queue Action'
      };
    }
    if (text.includes('complete') || text.includes('finished') || text.includes('confirmed') || text.includes('success')) {
      return {
        borderClass: 'border-l-4 border-emerald-500 bg-emerald-50/70',
        badgeClass: 'bg-emerald-100 text-emerald-800',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
        typeLabel: 'Completed'
      };
    }
    if (text.includes('pharmacy') || text.includes('prescription') || text.includes('dispensed')) {
      return {
        borderClass: 'border-l-4 border-emerald-500 bg-emerald-50/70',
        badgeClass: 'bg-emerald-100 text-emerald-800',
        icon: <Pill className="w-4 h-4 text-emerald-600 shrink-0" />,
        typeLabel: 'Pharmacy'
      };
    }
    if (text.includes('lab') || text.includes('report_ready') || text.includes('investigation') || text.includes('pathology')) {
      return {
        borderClass: 'border-l-4 border-indigo-500 bg-indigo-50/70',
        badgeClass: 'bg-indigo-100 text-indigo-800',
        icon: <FlaskConical className="w-4 h-4 text-indigo-600 shrink-0" />,
        typeLabel: 'Laboratory'
      };
    }
    if (text.includes('ai') || text.includes('prediction') || text.includes('duration') || text.includes('ml')) {
      return {
        borderClass: 'border-l-4 border-purple-500 bg-purple-50/70',
        badgeClass: 'bg-purple-100 text-purple-800',
        icon: <Cpu className="w-4 h-4 text-purple-600 shrink-0" />,
        typeLabel: 'AI Update'
      };
    }
    return {
      borderClass: 'border-l-4 border-sky-500 bg-sky-50/70',
      badgeClass: 'bg-sky-100 text-sky-800',
      icon: <Info className="w-4 h-4 text-sky-600 shrink-0" />,
      typeLabel: 'Clinical Notice'
    };
  };

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-slate-600 hover:text-sky-700 rounded-2xl hover:bg-slate-100 transition cursor-pointer"
        title={t('notifications', 'Notifications')}
        aria-label="View notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-extrabold flex items-center justify-center animate-pulse shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <>
          {/* Overlay to close when clicking outside */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-400" />
                <span className="font-extrabold text-xs tracking-wide">{t('notification_center', 'Notification Center')}</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-extrabold">
                    {t('new_notifications', { count: unreadCount }, `${unreadCount} new`)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-sky-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer transition"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3 h-3" />
                    <span>{t('mark_all_read', 'Read all')}</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1.5">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-slate-200 mx-auto" />
                  <p className="text-xs font-semibold text-slate-500">{t('all_caught_up', 'All caught up!')}</p>
                  <p className="text-[11px] text-slate-400">{t('no_notifications_desc', 'No active alerts for this account.')}</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const style = getNotificationStyle(n);
                  return (
                    <div
                      key={n.notification_id || Math.random()}
                      className={`p-3.5 rounded-2xl transition space-y-1.5 ${
                        n.read ? 'bg-white opacity-70 hover:opacity-100' : style.borderClass
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {style.icon}
                          <span className="font-extrabold text-xs text-slate-900">{n.title}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${style.badgeClass}`}>
                            {style.typeLabel}
                          </span>
                        </div>

                        {!n.read && (
                          <button
                            onClick={() => handleMarkRead(n.notification_id)}
                            className="text-[10px] font-extrabold text-sky-600 hover:text-sky-800 flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                            <span>{t('read', 'Read')}</span>
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-snug pl-6">{n.message}</p>

                      {n.created_at && (
                        <div className="text-[10px] text-slate-400 pl-6">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}