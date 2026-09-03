import React, { useState, useEffect } from "react";
import {
  Bell,
  Clock,
  Flame,
  CheckCircle,
  AlertCircle,
  Send,
  Zap,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  X
} from "lucide-react";
import { SmartReminderConfig } from "../types";

interface SmartHabitRemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  lastJournaledTimestamp?: number;
}

export const SmartHabitRemindersModal: React.FC<SmartHabitRemindersModalProps> = ({
  isOpen,
  onClose,
  userId,
  lastJournaledTimestamp = Date.now() - 1000 * 60 * 60 * 6
}) => {
  const [config, setConfig] = useState<SmartReminderConfig>(() => {
    const saved = localStorage.getItem(`gemini_reminder_config_${userId || "guest"}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      enabled: true,
      morningTime: "08:30",
      eveningTime: "20:45",
      enableBrowserNotifications: false,
      missedStreakWebhookUrl: ""
    };
  });

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [testNotificationSent, setTestNotificationSent] = useState(false);
  const [streakStatus, setStreakStatus] = useState<{
    hoursSinceLastJournal: number;
    isStreakAtRisk: boolean;
    shouldNotify: boolean;
  } | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      fetch("/api/reminders/trigger-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      })
        .then((res) => res.json())
        .then((data) => setStreakStatus(data))
        .catch(() => {});
    }
  }, [isOpen, userId]);

  const handleRequestNotificationPermission = async () => {
    if (typeof Notification !== "undefined") {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === "granted") {
        setConfig((prev) => ({ ...prev, enableBrowserNotifications: true }));
        new Notification("Gemini Vault • Habit Engine", {
          body: "Smart notifications enabled! You will be reminded at your scheduled times.",
          icon: "/favicon.ico"
        });
      }
    }
  };

  const handleSendTestNotification = () => {
    setTestNotificationSent(true);
    if (notificationPermission === "granted") {
      new Notification("Gemini Vault • Daily Reflection Reminder", {
        body: "Take 2 minutes to record a quick thought and preserve your clarity streak.",
        icon: "/favicon.ico"
      });
    }
    setTimeout(() => setTestNotificationSent(false), 3000);
  };

  const handleSaveConfig = () => {
    localStorage.setItem(`gemini_reminder_config_${userId || "guest"}`, JSON.stringify(config));
    onClose();
  };

  if (!isOpen) return null;

  const hoursSince = streakStatus?.hoursSinceLastJournal ??
    Math.round((Date.now() - lastJournaledTimestamp) / (1000 * 60 * 60) * 10) / 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-teal-500/30 bg-[#0a0d14] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-serif text-lg text-white font-medium">
                Automated Smart Reminders & Habit Guard
              </h3>
              <p className="text-[11px] text-slate-400">
                Gentle reminders and streak-at-risk safeguards to sustain your daily clarity.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Streak Health Card */}
        <div className="mt-4 rounded-xl border border-white/10 bg-[#121620] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className={`h-5 w-5 ${hoursSince < 24 ? "text-amber-400" : "text-rose-400"}`} />
              <span className="text-xs font-semibold text-white">Cadence Health Monitor</span>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
              hoursSince < 24 ? "bg-emerald-950 border border-emerald-500/30 text-emerald-300" : "bg-rose-950 border border-rose-500/30 text-rose-300"
            }`}>
              {hoursSince < 24 ? "Streak Safe" : "Streak at Risk"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-300">
            It has been <strong className="text-teal-300 font-mono">{hoursSince} hours</strong> since your last reflection.
          </p>
        </div>

        {/* Configuration Options */}
        <div className="mt-4 space-y-4">
          {/* Master Enable */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-white block">Enable Habit Engine</span>
              <span className="text-[10px] text-slate-400">Schedule automatic daily reflection prompts</span>
            </div>
            <button
              onClick={() => setConfig((p) => ({ ...p, enabled: !p.enabled }))}
              className="text-teal-400"
            >
              {config.enabled ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7 text-slate-600" />}
            </button>
          </div>

          {/* Morning & Evening Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-[#0e111a] p-3">
              <span className="text-[10px] font-mono text-slate-400 block mb-1">Morning Intentions</span>
              <input
                type="time"
                value={config.morningTime}
                onChange={(e) => setConfig((p) => ({ ...p, morningTime: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-[#161a26] px-2.5 py-1 text-xs text-white focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0e111a] p-3">
              <span className="text-[10px] font-mono text-slate-400 block mb-1">Evening Wind-Down</span>
              <input
                type="time"
                value={config.eveningTime}
                onChange={(e) => setConfig((p) => ({ ...p, eveningTime: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-[#161a26] px-2.5 py-1 text-xs text-white focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Browser Notifications Toggle */}
          <div className="rounded-xl border border-white/10 bg-[#0e111a] p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-white block">Browser Desktop Notifications</span>
                <span className="text-[10px] text-slate-400">Receive native push alerts on your workstation</span>
              </div>

              {notificationPermission === "granted" ? (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                  <CheckCircle className="h-3 w-3" /> Enabled
                </span>
              ) : (
                <button
                  onClick={handleRequestNotificationPermission}
                  className="rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-500"
                >
                  Grant Permission
                </button>
              )}
            </div>

            {/* Test notification button */}
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
              <button
                type="button"
                onClick={handleSendTestNotification}
                className="text-[10px] font-mono text-teal-400 underline hover:text-teal-300"
              >
                {testNotificationSent ? "✨ Test Prompt Dispatched!" : "Dispatch Test Prompt"}
              </button>
              <span className="text-[10px] font-mono text-slate-500">Local notification test</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-1.5 text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveConfig}
            className="rounded-lg bg-teal-600 px-5 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 shadow-md"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
