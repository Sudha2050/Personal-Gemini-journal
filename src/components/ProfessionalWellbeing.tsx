import React, { useState } from "react";
import {
  Briefcase,
  BatteryCharging,
  Zap,
  Activity,
  Send,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
  Smile,
  CheckCircle,
  Copy,
  Clock,
  Sparkles
} from "lucide-react";
import { JournalEntry, WellbeingSignals } from "../types";

interface ProfessionalWellbeingProps {
  entries: JournalEntry[];
  userId: string;
  onQuickThoughtSaved?: (entry: any) => void;
}

export const ProfessionalWellbeing: React.FC<ProfessionalWellbeingProps> = ({
  entries,
  userId,
  onQuickThoughtSaved
}) => {
  const [quickThoughtText, setQuickThoughtText] = useState("");
  const [quickSource, setQuickSource] = useState<"slack" | "email" | "cli" | "mobile">("slack");
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);

  // Analyze recent wellbeing metrics from entries
  const recentWellbeingScores = entries
    .filter((e) => e.insights?.wellbeing || e.insights?.sentimentScore !== undefined)
    .slice(0, 10);

  const averageSentiment = recentWellbeingScores.length
    ? recentWellbeingScores.reduce((acc, curr) => acc + (curr.insights?.sentimentScore ?? 0), 0) /
      recentWellbeingScores.length
    : 0.3;

  // Estimated Cognitive Load Index (0-100)
  const cognitiveLoadEstimate = Math.min(
    95,
    Math.max(20, Math.round((1 - (averageSentiment + 1) / 2) * 80 + (recentWellbeingScores.length > 5 ? 10 : 25)))
  );

  // Recovery Resilience Index (0-100)
  const recoveryIndexEstimate = Math.min(100, Math.max(15, 100 - cognitiveLoadEstimate + 15));

  // Burnout Risk Status
  const burnoutRiskTier: "low" | "moderate" | "elevated" | "critical" =
    cognitiveLoadEstimate > 75
      ? "elevated"
      : cognitiveLoadEstimate > 55
      ? "moderate"
      : "low";

  const handleCaptureQuickThought = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickThoughtText.trim()) return;

    setIsSubmittingQuick(true);
    setQuickFeedback(null);
    try {
      const res = await fetch("/api/integrations/quick-thought", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: quickThoughtText,
          userId: userId || "guest",
          source: quickSource
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to capture quick thought.");
      }

      const data = await res.json();
      setQuickThoughtText("");
      setQuickFeedback(`✨ Captured via ${quickSource.toUpperCase()}! Saved to your isolated Firestore collection.`);
      if (onQuickThoughtSaved && data.entry) {
        onQuickThoughtSaved(data.entry);
      }
    } catch (err: any) {
      setQuickFeedback(`⚠️ Error: ${err.message}`);
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Briefcase className="h-4 w-4" />
            </div>
            <h2 className="font-serif text-2xl text-white sm:text-3xl italic">
              Professional Wellbeing & Enterprise Integrations
            </h2>
            <span className="rounded-full border border-teal-500/30 bg-teal-950/40 px-2.5 py-0.5 text-[10px] font-mono text-teal-300">
              Cognitive Resilience
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Monitor cognitive load, detect burnout warning signals, and capture micro-reflections directly from your enterprise workflow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-3 py-1 text-xs font-mono text-emerald-300">
            <Activity className="h-3.5 w-3.5" />
            Wellbeing Radar Online
          </span>
        </div>
      </div>

      {/* Top 3 Wellbeing Vitals Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Burnout Risk Card */}
        <div className="rounded-2xl border border-white/10 bg-[#0c0e14] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Burnout Risk Indicator
            </span>
            <AlertTriangle
              className={`h-4 w-4 ${
                burnoutRiskTier === "low"
                  ? "text-emerald-400"
                  : burnoutRiskTier === "moderate"
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-serif capitalize ${
                burnoutRiskTier === "low"
                  ? "text-emerald-300"
                  : burnoutRiskTier === "moderate"
                  ? "text-amber-300"
                  : "text-rose-300"
              }`}
            >
              {burnoutRiskTier} Risk
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Based on last {recentWellbeingScores.length} reflections
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                burnoutRiskTier === "low"
                  ? "w-1/4 bg-emerald-400"
                  : burnoutRiskTier === "moderate"
                  ? "w-2/4 bg-amber-400"
                  : "w-3/4 bg-rose-400"
              }`}
            />
          </div>
        </div>

        {/* Cognitive Load Meter */}
        <div className="rounded-2xl border border-white/10 bg-[#0c0e14] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Estimated Cognitive Load
            </span>
            <Zap className="h-4 w-4 text-teal-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-serif text-white">
              {cognitiveLoadEstimate}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ 100</span>
            <span className="ml-auto text-[10px] font-mono text-teal-300">
              {cognitiveLoadEstimate < 45 ? "Optimal Balance" : "Friction Active"}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-teal-400 transition-all duration-500"
              style={{ width: `${cognitiveLoadEstimate}%` }}
            />
          </div>
        </div>

        {/* Recovery Resilience Index */}
        <div className="rounded-2xl border border-white/10 bg-[#0c0e14] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Recovery & Resilience Index
            </span>
            <BatteryCharging className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-serif text-white">
              {recoveryIndexEstimate}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ 100</span>
            <span className="ml-auto text-[10px] font-mono text-indigo-300">
              {recoveryIndexEstimate > 70 ? "High Energy" : "Rest Recommended"}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-indigo-400 transition-all duration-500"
              style={{ width: `${recoveryIndexEstimate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Quick Thought Integrator + Restorative Science Guidance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quick Thought Workspace & Slack Capture Simulator */}
        <div className="rounded-2xl border border-teal-500/20 bg-[#080a0f] p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-teal-400" />
              <h3 className="font-serif text-lg text-white font-medium">
                Quick Thought Enterprise Capture
              </h3>
            </div>
            <span className="rounded bg-teal-950/60 border border-teal-500/30 px-2 py-0.5 text-[10px] font-mono text-teal-300">
              /journal command
            </span>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            Capture immediate thoughts between meetings or after critical decisions without leaving your workflow.
          </p>

          <form onSubmit={handleCaptureQuickThought} className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">Channel Source:</span>
              <div className="flex rounded-lg border border-white/10 bg-[#121620] p-0.5 text-xs">
                {(["slack", "email", "cli", "mobile"] as const).map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setQuickSource(src)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-mono uppercase transition ${
                      quickSource === src
                        ? "bg-teal-600 text-white font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {src}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={quickThoughtText}
              onChange={(e) => setQuickThoughtText(e.target.value)}
              placeholder="e.g. Just wrapped the Q3 architecture review. Decided to decouple the event bus. Feeling relieved but exhausted..."
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-[#10131d] p-3 text-xs text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
            />

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">
                🔒 PII auto-scrubbed & encrypted in your Firestore tenant.
              </span>

              <button
                type="submit"
                disabled={isSubmittingQuick || !quickThoughtText.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-teal-500 disabled:opacity-50"
              >
                <Send className="h-3 w-3" />
                <span>{isSubmittingQuick ? "Logging..." : "Capture Thought"}</span>
              </button>
            </div>
          </form>

          {quickFeedback && (
            <div className="mt-3 rounded-lg border border-teal-500/30 bg-teal-950/20 px-3 py-2 text-xs text-teal-200">
              {quickFeedback}
            </div>
          )}

          {/* Webhook API Documentation Snippet */}
          <div className="mt-5 rounded-xl border border-white/5 bg-[#05060a] p-3 text-xs">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1">
              <span>Enterprise Ingestion Endpoint:</span>
              <span className="text-teal-400">POST /api/integrations/quick-thought</span>
            </div>
            <pre className="overflow-x-auto text-[10px] font-mono text-slate-400">
              {`curl -X POST https://your-app/api/integrations/quick-thought \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Decision logged", "userId": "${userId?.slice(0, 10) || "user_uid"}...", "source": "slack"}'`}
            </pre>
          </div>
        </div>

        {/* Workday Debriefing & Science-Backed Micro-Recovery Guidance */}
        <div className="rounded-2xl border border-white/10 bg-[#080a0f] p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-4">
            <Sparkles className="h-4 w-4 text-teal-400" />
            <h3 className="font-serif text-lg text-white font-medium">
              Workday Debrief Frameworks
            </h3>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-white/5 bg-[#10131d] p-3.5 transition hover:border-teal-500/30">
              <div className="flex items-center justify-between">
                <span className="font-serif text-sm font-medium text-white">
                  1. The End-of-Day Shutdown Ritual
                </span>
                <span className="text-[10px] font-mono text-teal-400">5 Mins</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Close open mental loops: List the 1 decision made, 1 unfinished task deferred, and 1 item of gratitude.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#10131d] p-3.5 transition hover:border-teal-500/30">
              <div className="flex items-center justify-between">
                <span className="font-serif text-sm font-medium text-white">
                  2. Friction & Stakeholder Processing
                </span>
                <span className="text-[10px] font-mono text-indigo-400">Emotional Equilibrium</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Separate what is in your control from what is outside your control using Stoic dichotomies.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#10131d] p-3.5 transition hover:border-teal-500/30">
              <div className="flex items-center justify-between">
                <span className="font-serif text-sm font-medium text-white">
                  3. Strategic Energy Recharging
                </span>
                <span className="text-[10px] font-mono text-emerald-400">Recovery</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Engage in 20 minutes of complete digital disconnection after high-load engineering or managerial sprint days.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
