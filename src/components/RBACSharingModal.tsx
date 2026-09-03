import React, { useState } from "react";
import {
  ShieldCheck,
  UserCheck,
  Users,
  KeyRound,
  Lock,
  Copy,
  Check,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Eye,
  FileCheck,
  HeartHandshake
} from "lucide-react";
import { AccessRole, SharedAccessGrant } from "../types";

interface RBACSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const RBACSharingModal: React.FC<RBACSharingModalProps> = ({
  isOpen,
  onClose,
  userId
}) => {
  const [grants, setGrants] = useState<SharedAccessGrant[]>(() => {
    const saved = localStorage.getItem(`gemini_rbac_grants_${userId || "guest"}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      {
        id: "grant_coach_1",
        grantedEmail: "executive.coach@organization.com",
        role: "coach" as AccessRole,
        createdAt: Date.now() - 1000 * 60 * 60 * 48,
        expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
        token: `vault_grant_${Math.random().toString(36).slice(2, 10)}`,
        isActive: true,
        canViewEncrypted: false
      }
    ];
  });

  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AccessRole>("coach");
  const [newExpiresInDays, setNewExpiresInDays] = useState(30);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const saveGrants = (updated: SharedAccessGrant[]) => {
    setGrants(updated);
    localStorage.setItem(`gemini_rbac_grants_${userId || "guest"}`, JSON.stringify(updated));
  };

  const handleCreateGrant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    const grant: SharedAccessGrant = {
      id: `grant_${Date.now()}`,
      grantedEmail: newEmail.trim().toLowerCase(),
      role: newRole,
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * newExpiresInDays,
      token: `vault_grant_${Math.random().toString(36).slice(2, 12)}`,
      isActive: true,
      canViewEncrypted: false
    };

    saveGrants([grant, ...grants]);
    setNewEmail("");
  };

  const handleRevoke = (grantId: string) => {
    saveGrants(grants.filter((g) => g.id !== grantId));
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-teal-500/30 bg-[#0a0d14] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg text-white font-medium">
                Advanced Role-Based Access Control (RBAC)
              </h3>
              <p className="text-[11px] text-slate-400">
                Grant time-bound, least-privilege delegation tokens for coaches, mentors, or therapists without compromising your Zero-Knowledge vault.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Roles Permission Matrix */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#0f131d] p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-300">
              <UserCheck className="h-3.5 w-3.5" />
              <span>Coach / Mentor</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 leading-snug">
              Reads standard reflections & weekly goals to provide guided feedback. Cannot read PIN-locked vault entries.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0f131d] p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
              <HeartHandshake className="h-3.5 w-3.5" />
              <span>Therapist / Wellness</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 leading-snug">
              Accesses mood trends, burnout scores, and executive summaries with high-risk PII masked.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0f131d] p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
              <FileCheck className="h-3.5 w-3.5" />
              <span>Audit Observer</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 leading-snug">
              Inspects security verification logs and timestamps only. Zero access to entry body texts.
            </p>
          </div>
        </div>

        {/* New Grant Form */}
        <form onSubmit={handleCreateGrant} className="mt-5 rounded-xl border border-white/10 bg-[#121620] p-4">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400 block mb-3">
            Issue New Delegation Grant
          </span>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Delegate Email</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="mentor@company.com"
                className="w-full rounded-lg border border-white/10 bg-[#191e2b] px-3 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Assigned Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AccessRole)}
                className="w-full rounded-lg border border-white/10 bg-[#191e2b] px-3 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none"
              >
                <option value="coach">Executive Coach / Mentor</option>
                <option value="therapist">Therapist / Wellness Guide</option>
                <option value="observer">Security & Compliance Observer</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Validity (Days)</label>
              <select
                value={newExpiresInDays}
                onChange={(e) => setNewExpiresInDays(Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-[#191e2b] px-3 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none"
              >
                <option value={7}>7 Days (Sprint Review)</option>
                <option value={30}>30 Days (Standard)</option>
                <option value={90}>90 Days (Quarterly)</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono">
              Zero-Knowledge Vault entries remain encrypted under client-side AES-256-GCM.
            </span>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-teal-500"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Issue Grant</span>
            </button>
          </div>
        </form>

        {/* Active Delegation Grants List */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              Active Access Grants ({grants.length})
            </span>
          </div>

          {grants.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#0a0c12] p-6 text-center text-xs text-slate-500">
              No active delegation grants. Your journal is strictly isolated to your UID.
            </div>
          ) : (
            <div className="space-y-2.5">
              {grants.map((grant) => (
                <div
                  key={grant.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0d1018] p-3.5 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{grant.grantedEmail}</span>
                      <span className="rounded-full bg-teal-950 border border-teal-500/30 px-2 py-0.5 text-[10px] font-mono text-teal-300 uppercase">
                        {grant.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <span>Expires: {new Date(grant.expiresAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Token: {grant.token.slice(0, 12)}...</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleCopyToken(grant.token)}
                      className="flex items-center gap-1 rounded-md border border-white/10 bg-[#161a26] px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:text-white"
                    >
                      {copiedToken === grant.token ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy Token</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleRevoke(grant.id)}
                      className="rounded-md border border-red-500/30 bg-red-950/20 p-1 text-red-300 hover:bg-red-950/40"
                      title="Revoke Grant Immediately"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-teal-600 px-5 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
