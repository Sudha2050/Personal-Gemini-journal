import React from "react";
import {
  ShieldCheck,
  Sparkles,
  BookOpen,
  BarChart3,
  Globe,
  Briefcase,
  Bell,
  Users,
  LogOut,
  KeyRound,
  Copy,
  Check,
  Repeat
} from "lucide-react";
import { UserProfile } from "../types";

export type NavTabType = "workspace" | "archive" | "map" | "rewind" | "wellbeing" | "insights" | "security";

interface HeaderProps {
  user: UserProfile | null;
  activeTab: NavTabType;
  setActiveTab: (tab: NavTabType) => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
  entriesCount: number;
  onOpenRemindersModal: () => void;
  onOpenRbacModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  setActiveTab,
  onOpenAuth,
  onSignOut,
  entriesCount,
  onOpenRemindersModal,
  onOpenRbacModal
}) => {
  const [copiedUid, setCopiedUid] = React.useState(false);

  const copyUid = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#050505]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-6">
        {/* Brand & Security Emblem */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-gradient-to-tr from-emerald-500 to-teal-700 rotate-45 shadow-[0_0_12px_rgba(20,184,166,0.3)]">
            <div className="h-3 w-3 rounded-full bg-[#050505] -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-light uppercase tracking-[0.2em] text-white sm:text-base">
                Gemini Vault
              </span>
              <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 lg:flex">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span className="text-[9px] font-medium uppercase tracking-widest text-emerald-400">
                  Tenant Isolation
                </span>
              </div>
            </div>
            <p className="hidden text-[9px] tracking-wide text-slate-500 uppercase sm:block">
              Cloud Firestore RLS • Gemini 3.7 Flash
            </p>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-[#0d0d0d] p-1 scrollbar-none">
          <button
            id="nav-workspace-btn"
            onClick={() => setActiveTab("workspace")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-all shrink-0 ${
              activeTab === "workspace"
                ? "bg-teal-600 text-white shadow-[0_0_10px_rgba(13,148,136,0.4)] font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Journal</span>
          </button>

          <button
            id="nav-archive-btn"
            onClick={() => setActiveTab("archive")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-all shrink-0 ${
              activeTab === "archive"
                ? "bg-teal-600 text-white shadow-[0_0_10px_rgba(13,148,136,0.4)] font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Archive</span>
            {entriesCount > 0 && (
              <span className="rounded-full bg-black/40 px-1.5 py-0.2 text-[10px] text-teal-200 font-mono">
                {entriesCount}
              </span>
            )}
          </button>

          <button
            id="nav-map-btn"
            onClick={() => setActiveTab("map")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-all shrink-0 ${
              activeTab === "map"
                ? "bg-teal-600 text-white shadow-[0_0_10px_rgba(13,148,136,0.4)] font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Life Map</span>
          </button>

          <button
            id="nav-rewind-btn"
            onClick={() => setActiveTab("rewind")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-all shrink-0 ${
              activeTab === "rewind"
                ? "bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-[0_0_10px_rgba(99,102,241,0.4)] font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Repeat className="h-3.5 w-3.5 text-teal-300" />
            <span>Rewind</span>
          </button>

          <button
            id="nav-wellbeing-btn"
            onClick={() => setActiveTab("wellbeing")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-all shrink-0 ${
              activeTab === "wellbeing"
                ? "bg-teal-600 text-white shadow-[0_0_10px_rgba(13,148,136,0.4)] font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Wellbeing</span>
            <span className="sm:hidden">Work</span>
          </button>

          <button
            id="nav-insights-btn"
            onClick={() => setActiveTab("insights")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-all shrink-0 ${
              activeTab === "insights"
                ? "bg-teal-600 text-white shadow-[0_0_10px_rgba(13,148,136,0.4)] font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Insights</span>
            <span className="md:hidden">Trends</span>
          </button>

          <button
            id="nav-security-btn"
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-all shrink-0 ${
              activeTab === "security"
                ? "bg-emerald-600 text-white shadow-[0_0_10px_rgba(5,150,105,0.4)] font-semibold"
                : "text-emerald-400/90 hover:text-emerald-300"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Security</span>
            <span className="md:hidden">Audit</span>
          </button>
        </nav>

        {/* Action Tools & User Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Trigger: Smart Habit Reminders */}
          <button
            onClick={onOpenRemindersModal}
            title="Configure Automated Reminders & Habit Guard"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#111] text-slate-400 transition hover:border-teal-500/40 hover:bg-teal-950/30 hover:text-teal-300"
          >
            <Bell className="h-3.5 w-3.5" />
          </button>

          {/* Quick Trigger: RBAC Sharing */}
          <button
            onClick={onOpenRbacModal}
            title="Manage Role-Based Sharing & Mentor Delegation"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#111] text-slate-400 transition hover:border-teal-500/40 hover:bg-teal-950/30 hover:text-teal-300"
          >
            <Users className="h-3.5 w-3.5" />
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden flex-col items-end text-right xl:flex">
                <span className="text-xs font-semibold text-white">
                  {user.displayName || (user.email ? user.email.split("@")[0] : "Authorized User")}
                </span>
                <button
                  onClick={copyUid}
                  title="Click to copy isolated User ID"
                  className="flex items-center gap-1 font-mono text-[9px] text-slate-500 transition hover:text-teal-400"
                >
                  <span>uid: {user.uid.slice(0, 6)}...</span>
                  {copiedUid ? (
                    <Check className="h-2.5 w-2.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-2.5 w-2.5" />
                  )}
                </button>
              </div>

              {user.isAnonymous ? (
                <span className="hidden sm:inline-block rounded-full border border-teal-500/20 bg-teal-950/40 px-2 py-0.5 text-[9px] font-medium text-teal-300">
                  Guest
                </span>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111] border border-white/10 font-serif italic text-sm text-white">
                  {user.email ? user.email.charAt(0).toUpperCase() : "A"}
                </div>
              )}

              <button
                id="sign-out-btn"
                onClick={onSignOut}
                title="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#111] text-slate-400 transition hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="auth-modal-trigger-btn"
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 rounded-full bg-teal-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-[0_0_12px_rgba(13,148,136,0.3)] transition hover:bg-teal-500"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
