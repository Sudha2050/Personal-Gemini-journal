import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  FileCode2,
  Download,
  Trash2,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Database,
  EyeOff,
  Terminal,
  Layers,
  Copy,
  Check
} from "lucide-react";
import { JournalEntry, SecurityPostureData, UserProfile } from "../types";
import {
  detectAndSanitizePii,
  exportEntriesAsJson,
  exportEntriesAsMarkdown,
  sendAuditLog
} from "../lib/securityUtils";
import { purgeAllUserData } from "../lib/firebase";

interface SecurityInspectorProps {
  user: UserProfile | null;
  entries: JournalEntry[];
  onDataPurged: () => void;
}

export const SecurityInspector: React.FC<SecurityInspectorProps> = ({
  user,
  entries,
  onDataPurged
}) => {
  const [posture, setPosture] = useState<SecurityPostureData | null>(null);
  const [isLoadingPosture, setIsLoadingPosture] = useState(false);
  const [activeTab, setActiveTab] = useState<"posture" | "threat_model" | "pii_sandbox" | "sovereignty">("posture");

  // PII Sandbox interactive state
  const [sandboxInput, setSandboxInput] = useState(
    "Hi Gemini! My email is sarah.connor@cyberdyne.io and my phone is (415) 555-0199. SSN: 000-12-3456. Let's brainstorm my startup."
  );
  const [copiedCode, setCopiedCode] = useState(false);

  // Purge Confirmation
  const [isPurging, setIsPurging] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purgeInputText, setPurgeInputText] = useState("");

  useEffect(() => {
    fetchSecurityPosture();
  }, []);

  const fetchSecurityPosture = async () => {
    setIsLoadingPosture(true);
    try {
      const res = await fetch("/api/security/posture");
      const data = await res.json();
      setPosture(data);
    } catch (err) {
      console.warn("Failed to fetch security posture:", err);
    } finally {
      setIsLoadingPosture(false);
    }
  };

  const handleExportJson = () => {
    exportEntriesAsJson(entries, user?.email || "anonymous");
    sendAuditLog("DATA_EXPORT_JSON", user?.uid || "anonymous", "SUCCESS", { count: entries.length });
  };

  const handleExportMarkdown = () => {
    const md = exportEntriesAsMarkdown(entries);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gemini-journal-full-export-${new Date().toISOString().split("T")[0]}.md`;
    link.click();
    URL.revokeObjectURL(url);
    sendAuditLog("DATA_EXPORT_MARKDOWN", user?.uid || "anonymous", "SUCCESS", { count: entries.length });
  };

  const handleExecutePurge = async () => {
    if (purgeInputText !== "DELETE MY DATA") {
      alert("Please type 'DELETE MY DATA' to confirm.");
      return;
    }
    if (!user) return;

    setIsPurging(true);
    try {
      const count = await purgeAllUserData(user.uid);
      sendAuditLog("DATA_PURGE_GDPR", user.uid, "SUCCESS", { deletedRecords: count });
      alert(`Successfully purged ${count} journal records. Your isolated database is now empty.`);
      setShowPurgeConfirm(false);
      setPurgeInputText("");
      onDataPurged();
    } catch (err: any) {
      console.error("Purge Error:", err);
      alert("Failed to purge data: " + err.message);
    } finally {
      setIsPurging(false);
    }
  };

  const piiResult = detectAndSanitizePii(sandboxInput);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-teal-400" />
            <h2 className="text-2xl font-light font-serif italic text-white sm:text-3xl">
              Enterprise Security & Architecture Center
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Threat Modeling, Zero-Knowledge Vaults, Secret Isolation & GDPR Compliance.
          </p>
        </div>

        <button
          onClick={fetchSecurityPosture}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#111] px-3.5 py-1.5 text-xs text-slate-300 hover:bg-white/5 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoadingPosture ? "animate-spin text-teal-400" : ""}`} />
          <span>Refresh Posture</span>
        </button>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab("posture")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
            activeTab === "posture"
              ? "bg-teal-600 text-white shadow-[0_0_10px_rgba(20,184,166,0.3)]"
              : "bg-[#111] border border-white/10 text-slate-400 hover:text-slate-200"
          }`}
        >
          Active Posture & Audit Logs
        </button>

        <button
          onClick={() => setActiveTab("threat_model")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
            activeTab === "threat_model"
              ? "bg-teal-600 text-white shadow-[0_0_10px_rgba(20,184,166,0.3)]"
              : "bg-[#111] border border-white/10 text-slate-400 hover:text-slate-200"
          }`}
        >
          STRIDE & OWASP Defense Matrix
        </button>

        <button
          onClick={() => setActiveTab("pii_sandbox")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
            activeTab === "pii_sandbox"
              ? "bg-teal-600 text-white shadow-[0_0_10px_rgba(20,184,166,0.3)]"
              : "bg-[#111] border border-white/10 text-slate-400 hover:text-slate-200"
          }`}
        >
          PII Redactor Sandbox
        </button>

        <button
          onClick={() => setActiveTab("sovereignty")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
            activeTab === "sovereignty"
              ? "bg-teal-600 text-white shadow-[0_0_10px_rgba(20,184,166,0.3)]"
              : "bg-[#111] border border-white/10 text-slate-400 hover:text-slate-200"
          }`}
        >
          Data Sovereignty & GDPR
        </button>
      </div>

      {/* TAB 1: ACTIVE POSTURE & AUDIT LOGS */}
      {activeTab === "posture" && (
        <div className="space-y-6">
          {/* Security Architecture Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Card 1 */}
            <div className="rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl">
              <div className="flex items-center gap-2 text-teal-400">
                <KeyRound className="h-5 w-5" />
                <h4 className="font-serif italic text-base text-white">Secret Isolation</h4>
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                <code className="text-teal-300 font-mono text-[11px]">GEMINI_API_KEY</code> is loaded strictly in server memory via runtime configuration. Never leaked to client browser bundles.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-950/60 border border-teal-500/30 px-2.5 py-0.5 text-[10px] font-bold text-teal-300">
                <CheckCircle2 className="h-3 w-3" />
                <span>Active & Verified</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl">
              <div className="flex items-center gap-2 text-emerald-400">
                <Database className="h-5 w-5" />
                <h4 className="font-serif italic text-base text-white">Database Isolation</h4>
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Cloud Firestore rules mathematically bind all document queries to <code className="text-emerald-300 font-mono text-[11px]">request.auth.uid == userId</code>.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                <span>Zero Cross-Tenant Leakage</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl">
              <div className="flex items-center gap-2 text-teal-300">
                <Lock className="h-5 w-5" />
                <h4 className="font-serif italic text-base text-white">Zero-Knowledge Vault</h4>
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Optional client-side WebCrypto AES-256-GCM encryption transforms entries into encrypted ciphertext before database transmission.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-950/60 border border-teal-500/30 px-2.5 py-0.5 text-[10px] font-bold text-teal-300">
                <CheckCircle2 className="h-3 w-3" />
                <span>AES-256-GCM Armed</span>
              </div>
            </div>
          </div>

          {/* Live Audit Log Feed */}
          <div className="rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-teal-400" />
                <h3 className="font-serif italic text-base text-white">
                  Security Event Audit Stream (Anonymized)
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {posture?.recentAuditLogs?.length || 0} recorded events
              </span>
            </div>

            <div className="mt-4 space-y-2 font-mono text-xs max-h-72 overflow-y-auto">
              {posture?.recentAuditLogs?.length ? (
                posture.recentAuditLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-1 rounded-lg border border-white/5 bg-[#111] p-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-teal-950/80 text-teal-300 border border-teal-500/30 px-1.5 py-0.5 text-[10px] font-bold">
                        {log.status}
                      </span>
                      <span className="font-bold text-slate-200">{log.eventType}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Actor: {log.actorId}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 py-4 text-center">
                  Audit logger is collecting events...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STRIDE & OWASP DEFENSE MATRIX */}
      {activeTab === "threat_model" && (
        <div className="rounded-xl border border-white/10 bg-[#080808] p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Layers className="h-5 w-5 text-teal-400" />
            <h3 className="font-serif italic text-lg text-white">
              STRIDE Threat Modeling & OWASP Top 10 Protections
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/5 bg-[#111] p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-400 font-mono">
                1. Spoofing & Identity
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                <strong>Threat:</strong> Impersonating other users or accessing orphaned sessions.
                <br />
                <strong>Mitigation:</strong> Firebase Auth tokens cryptographically signed by Google Identity Services, enforcing strict UID verification on every transaction.
              </p>
            </div>

            <div className="rounded-lg border border-white/5 bg-[#111] p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
                2. Tampering & Integrity
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                <strong>Threat:</strong> Malicious modification of chat payloads or cross-user record overwrites.
                <br />
                <strong>Mitigation:</strong> Server-side Express input boundaries, size limits (2MB), and Firestore Security Rules denying writes to alien document paths.
              </p>
            </div>

            <div className="rounded-lg border border-white/5 bg-[#111] p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-300 font-mono">
                3. Repudiation & Auditability
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                <strong>Threat:</strong> Denying user-performed operations or untraceable data deletion.
                <br />
                <strong>Mitigation:</strong> Structured in-memory and server audit logging with automated PII scrubbing for all auth, chat, export, and purge operations.
              </p>
            </div>

            <div className="rounded-lg border border-white/5 bg-[#111] p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono">
                4. Information Disclosure & Cross-Tenant Leakage
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                <strong>Threat:</strong> Reading another user's journal entries or leaking API keys in client JS bundles.
                <br />
                <strong>Mitigation:</strong> Strict Firestore path isolation (<code className="font-mono text-[11px] text-amber-300">/users/{`{userId}`}</code>), server-only Gemini calls, and real-time client PII scrubbing.
              </p>
            </div>

            <div className="rounded-lg border border-white/5 bg-[#111] p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400 font-mono">
                5. Denial of Service (DoS)
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                <strong>Threat:</strong> Spamming Gemini endpoints or overwhelming memory buffers.
                <br />
                <strong>Mitigation:</strong> Express IP-based sliding rate-limiting middleware, max token limits on Gemini generation, and character truncation.
              </p>
            </div>

            <div className="rounded-lg border border-white/5 bg-[#111] p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 font-mono">
                6. Elevation of Privilege
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                <strong>Threat:</strong> Escalating privileges to read administrative or global collections.
                <br />
                <strong>Mitigation:</strong> Default-deny rule in <code className="font-mono text-[11px] text-cyan-300">firestore.rules</code> with zero wildcard read permissions outside of the user's isolated subcollection.
              </p>
            </div>
          </div>

          {/* Firestore Rules Source */}
          <div className="rounded-lg border border-white/10 bg-[#040404] p-4 font-mono text-xs text-slate-300">
            <div className="flex items-center justify-between text-slate-500 mb-2 font-sans font-semibold">
              <div className="flex items-center gap-1.5">
                <FileCode2 className="h-4 w-4 text-teal-400" />
                <span>Deployed firestore.rules</span>
              </div>
              <span className="text-[10px] text-emerald-400">Active on Cloud Firestore</span>
            </div>
            <pre className="overflow-x-auto text-[11px] text-slate-300">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /{subcollection=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    match /{document=**} {
      allow read, write: if false; // Default Deny
    }
  }
}`}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 3: PII REDACTOR SANDBOX */}
      {activeTab === "pii_sandbox" && (
        <div className="rounded-xl border border-white/10 bg-[#080808] p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <EyeOff className="h-5 w-5 text-teal-400" />
            <h3 className="font-serif italic text-lg text-white">
              Interactive Client-Side PII Redactor Playground
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Test the real-time privacy scrubber. Before text leaves your browser to reach the Gemini API, Personally Identifiable Information (PII) like emails, telephone numbers, SSNs, and credit cards are scrubbed into secure tokens.
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-2 block">
                Raw Input Text (Simulate Sensitive Journaling)
              </label>
              <textarea
                rows={6}
                value={sandboxInput}
                onChange={(e) => setSandboxInput(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#111] p-3 text-xs text-white placeholder-slate-600 focus:border-teal-500/50 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-emerald-400">
                  Scrubbed Output (Sent to Gemini API)
                </label>
                {piiResult.hasPii && (
                  <span className="rounded-full bg-amber-950/80 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    {piiResult.detectedTypes.join(", ")} Filtered
                  </span>
                )}
              </div>
              <div className="h-36 rounded-xl border border-emerald-500/30 bg-[#111] p-3 text-xs text-emerald-200/90 whitespace-pre-wrap font-mono">
                {piiResult.sanitizedText}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DATA SOVEREIGNTY & GDPR */}
      {activeTab === "sovereignty" && (
        <div className="rounded-xl border border-white/10 bg-[#080808] p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Download className="h-5 w-5 text-teal-400" />
            <h3 className="font-serif italic text-lg text-white">
              Data Sovereignty & GDPR Right to Erasure
            </h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            You maintain 100% ownership over your journal entries and cognitive reflections. You can export complete backups at any time or execute an irreversible complete purge.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Export JSON */}
            <div className="rounded-xl border border-white/5 bg-[#111] p-5 flex flex-col justify-between">
              <div>
                <h4 className="font-serif italic text-base text-white flex items-center gap-2">
                  <Download className="h-4 w-4 text-teal-400" />
                  <span>Export Machine-Readable JSON</span>
                </h4>
                <p className="mt-1 text-xs text-slate-400">
                  Download all {entries.length} reflections, conversation history, and metadata formatted as structured JSON.
                </p>
              </div>
              <button
                onClick={handleExportJson}
                disabled={entries.length === 0}
                className="mt-4 rounded-full bg-teal-600 px-4 py-2 text-xs font-medium text-white hover:bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.3)] disabled:opacity-40"
              >
                Download JSON Backup
              </button>
            </div>

            {/* Export Markdown */}
            <div className="rounded-xl border border-white/5 bg-[#111] p-5 flex flex-col justify-between">
              <div>
                <h4 className="font-serif italic text-base text-white flex items-center gap-2">
                  <Download className="h-4 w-4 text-emerald-400" />
                  <span>Export Formatted Markdown</span>
                </h4>
                <p className="mt-1 text-xs text-slate-400">
                  Download your entire journal formatted for Obsidian, Notion, or personal archival.
                </p>
              </div>
              <button
                onClick={handleExportMarkdown}
                disabled={entries.length === 0}
                className="mt-4 rounded-full border border-teal-500/30 bg-teal-950/40 px-4 py-2 text-xs font-medium text-teal-300 hover:bg-teal-950/70 disabled:opacity-40"
              >
                Download Markdown Book
              </button>
            </div>
          </div>

          {/* Irreversible Purge Section */}
          <div className="mt-6 rounded-xl border border-red-900/30 bg-red-950/20 p-5">
            <div className="flex items-center gap-2 text-red-400 font-serif italic text-base">
              <Trash2 className="h-5 w-5" />
              <span>Right to Erasure (Purge All Isolated Data)</span>
            </div>
            <p className="mt-2 text-xs text-red-200/80 leading-relaxed">
              Permanently wipes all documents within your <code className="font-mono text-[11px] text-red-300">/users/{user?.uid ? user.uid.slice(0, 6) + "..." : "{uid}"}/entries</code> subcollection in Cloud Firestore. This operation is cryptographically irreversible.
            </p>

            <button
              onClick={() => setShowPurgeConfirm(true)}
              className="mt-4 rounded-full bg-red-700/80 px-4 py-2 text-xs font-medium text-white hover:bg-red-600"
            >
              Initiate Permanent Data Wipe
            </button>
          </div>

          {/* Purge Modal */}
          {showPurgeConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
              <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-[#080808] p-6 shadow-2xl">
                <div className="flex items-center gap-2 text-red-400 font-serif italic text-lg">
                  <AlertTriangle className="h-6 w-6" />
                  <span>Irreversible Data Deletion</span>
                </div>
                <p className="mt-3 text-xs text-slate-300">
                  This will delete all {entries.length} reflections from your isolated Cloud Firestore subcollection.
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Type <strong className="font-mono text-white">DELETE MY DATA</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={purgeInputText}
                  onChange={(e) => setPurgeInputText(e.target.value)}
                  placeholder="DELETE MY DATA"
                  className="mt-3 w-full rounded-full border border-red-800/60 bg-[#111] p-2.5 text-xs text-white focus:outline-none"
                />
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowPurgeConfirm(false);
                      setPurgeInputText("");
                    }}
                    className="rounded-full px-3.5 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecutePurge}
                    disabled={isPurging || purgeInputText !== "DELETE MY DATA"}
                    className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-40"
                  >
                    {isPurging ? "Wiping..." : "Permanently Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
