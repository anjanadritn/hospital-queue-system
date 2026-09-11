import React, { useState, useEffect } from 'react';

import { Bell, Check, CheckCheck, X, AlertCircle } from 'lucide-react';

import { hospitalApi } from '../api/hospitalApi';

export default function NotificationPanel({ patientId }) {

  const [notifications, setNotifications] = useState([]);

  const [isOpen, setIsOpen] = useState(false);

  const loadNotifications = async () => {

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

  return (

    <div className="relative">

      {/* Bell Trigger Button */}

      <button

        onClick={() => setIsOpen(!isOpen)}

        className="relative p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"

        title="Notifications"

      >

        <Bell className="w-5 h-5" />

        {unreadCount > 0 && (

          <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-extrabold flex items-center justify-center animate-pulse">

            {unreadCount}

          </span>

        )}

      </button>

      {/* Popover Panel */}

      {isOpen && (

        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">

          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">

            <div className="flex items-center gap-2">

              <Bell className="w-4 h-4 text-sky-400" />

              <span className="font-bold text-xs">Notification Center</span>

            </div>

            <button

              onClick={() => setIsOpen(false)}

              className="text-slate-400 hover:text-white text-xs"

            >

              <X className="w-4 h-4" />

            </button>

          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-2">

            {notifications.length === 0 ? (

              <div className="p-6 text-center text-xs text-slate-400">

                No notifications yet

              </div>

            ) : (

              notifications.map((n) => (

                <div

                  key={n.notification_id}

                  className={`p-3 rounded-xl transition ${

                    n.read ? 'bg-white opacity-70' : 'bg-sky-50/60 border border-sky-100'

                  }`}

                >

                  <div className="flex items-start justify-between gap-2 mb-1">

                    <span className="font-bold text-xs text-slate-900">{n.title}</span>

                    {!n.read && (

                      <button

                        onClick={() => handleMarkRead(n.notification_id)}

                        className="text-[10px] font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1"

                      >

                        <Check className="w-3 h-3" /> Read

                      </button>

                    )}

                  </div>

                  <p className="text-xs text-slate-600 leading-snug">{n.message}</p>

                </div>

              ))

            )}

          </div>

        </div>

      )}

    </div>

  );

}