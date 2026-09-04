import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Smile,
  ListTodo,
  Sparkles,
  CheckCircle2,
  Circle,
  Flame,
  Calendar,
  BrainCircuit,
  Award,
  Zap,
  Tag,
  Clock,
  Send,
  RefreshCw,
  Target
} from "lucide-react";
import { JournalEntry, WeeklyGoalRecord } from "../types";
import { saveUserJournalEntry, saveUserGoalRecord, subscribeToUserGoals } from "../lib/firebase";

interface InsightsDashboardProps {
  entries: JournalEntry[];
  userId: string;
}

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({ entries, userId }) => {
  const [growthSummary, setGrowthSummary] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoalRecord[]>([]);
  const [isTriggeringCron, setIsTriggeringCron] = useState(false);
  const [isTestingDiscord, setIsTestingDiscord] = useState(false);
  const [cronFeedback, setCronFeedback] = useState<string | null>(null);
  const [cronStatus, setCronStatus] = useState<{
    cronSchedule: string;
    description: string;
    discordWebhookConfigured: boolean;
  } | null>(null);

  useEffect(() => {
    if (userId) {
      const unsubscribe = subscribeToUserGoals(userId, (goals) => {
        setWeeklyGoals(goals);
      });
      fetchCronStatus();
      return () => unsubscribe();
    }
  }, [userId]);

  const fetchCronStatus = async () => {
    try {
      const res = await fetch("/api/cron/status");
      if (res.ok) {
        const data = await res.json();
        setCronStatus(data);
      }
    } catch (e) {
      console.warn("Failed to fetch cron status:", e);
    }
  };

  const handleRunWeeklyExtractionNow = async () => {
    setIsTriggeringCron(true);
    setCronFeedback(null);
    try {
      const recentEntries = entries.filter((e) => {
        const createdAt = e.createdAt || 0;
        return createdAt >= Date.now() - 7 * 24 * 60 * 60 * 1000;
      });

      const entriesToAnalyze = recentEntries.length > 0 ? recentEntries : entries;

      if (entriesToAnalyze.length === 0) {
        setCronFeedback("⚠️ No journal reflections found yet. Write a quick entry in the Workspace first to run synthesis!");
        setIsTriggeringCron(false);
        return;
      }

      const res = await fetch("/api/cron/weekly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          entries: entriesToAnalyze
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Persist goalRecord directly via client SDK to guarantee real-time Firestore persistence
        if (data.goalRecord) {
          try {
            await saveUserGoalRecord(userId, data.goalRecord);
          } catch (saveErr) {
            console.warn("Client goal save notice:", saveErr);
          }
        }
        setCronFeedback("✨ Weekly retrospective and actionable goals generated, saved to Firestore, and dispatched to Discord!");
      } else {
        setCronFeedback(`⚠️ ${data.error || "Failed to run weekly retrospective."}`);
      }
    } catch (err: any) {
      setCronFeedback(`⚠️ Network error: ${err.message}`);
    } finally {
      setIsTriggeringCron(false);
    }
  };

  const handleTestDiscord = async () => {
    setIsTestingDiscord(true);
    setCronFeedback(null);
    try {
      const res = await fetch("/api/discord/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCronFeedback("🚀 Verified! A test notification was successfully sent to your Discord channel.");
      } else {
        setCronFeedback(`⚠️ Discord test error: ${data.error || "Unable to send message to Discord."}`);
      }
    } catch (err: any) {
      setCronFeedback(`⚠️ Network error communicating with Discord: ${err.message}`);
    } finally {
      setIsTestingDiscord(false);
    }
  };

  // 1. Calculate Aggregate Metrics
  const totalEntries = entries.length;

  const entriesWithSentiment = entries.filter((e) => typeof e.insights?.sentimentScore === "number");
  const averageSentiment =
    entriesWithSentiment.length > 0
      ? entriesWithSentiment.reduce((acc, e) => acc + (e.insights?.sentimentScore || 0), 0) /
        entriesWithSentiment.length
      : 0;

  // Aggregate all action items
  const allActionItems: { entryId: string; entryTitle: string; item: string; index: number; isDone: boolean }[] = [];
  entries.forEach((e) => {
    if (e.insights?.actionItems) {
      e.insights.actionItems.forEach((item, idx) => {
        allActionItems.push({
          entryId: e.id,
          entryTitle: e.title,
          item,
          index: idx,
          isDone: Boolean(e.completedActionItems?.includes(idx))
        });
      });
    }
  });

  const totalActions = allActionItems.length;
  const completedActions = allActionItems.filter((a) => a.isDone).length;
  const actionCompletionRate = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

  // Mood Counts
  const moodCounts: Record<string, number> = {};
  entries.forEach((e) => {
    const mood = e.insights?.moodTag;
    if (mood) {
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    }
  });

  const sortedMoods = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);

  // Mode Distribution
  const modeCounts: Record<string, number> = {};
  entries.forEach((e) => {
    const m = e.mode || "reflection";
    modeCounts[m] = (modeCounts[m] || 0) + 1;
  });

  // Calculate Streak
  const uniqueDates = Array.from(
    new Set(
      entries.map((e) => new Date(e.createdAt).toISOString().split("T")[0])
    )
  ).sort();

  const currentStreak = uniqueDates.length;

  const handleToggleActionItem = async (entryId: string, actionIdx: number) => {
    const targetEntry = entries.find((e) => e.id === entryId);
    if (!targetEntry) return;

    try {
      const currentCompleted = targetEntry.completedActionItems || [];
      const updatedCompleted = currentCompleted.includes(actionIdx)
        ? currentCompleted.filter((i) => i !== actionIdx)
        : [...currentCompleted, actionIdx];

      const updated = { ...targetEntry, completedActionItems: updatedCompleted };
      await saveUserJournalEntry(userId, updated);
    } catch (err) {
      console.error("Failed to update action item:", err);
    }
  };

  const handleSynthesizeGrowth = async () => {
    if (entries.length < 2) {
      alert("Please log at least 2 journal entries to synthesize growth trajectories.");
      return;
    }

    setIsSynthesizing(true);
    try {
      const summariesList = entries
        .slice(0, 8)
        .map((e, idx) => `${idx + 1}. [${e.mode}] ${e.title}: ${e.insights?.summary || ""}`)
        .join("\n");

      const prompt = `Analyze these recent user journal summaries and provide a deep, encouraging, 3-paragraph synthesized retrospective:
1. Recurring themes and cognitive patterns
2. Core strengths and mindset shifts observed
3. High-leverage focus areas for continued momentum.

Summaries:
${summariesList}`;

      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          mode: "reflection",
          userId
        })
      });

      const data = await res.json();
      setGrowthSummary(data.reply);
    } catch (err: any) {
      console.error("Growth Synthesis Error:", err);
      alert("Failed to synthesize growth insights.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Dashboard Title */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-light font-serif italic text-white sm:text-3xl flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-teal-400" />
            <span>Cognitive Insights & Mood Trends</span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Algorithmic analysis of your mental clarity, sentiment trajectories, and habit momentum.
          </p>
        </div>

        {/* AI Growth Retrospective Button */}
        <button
          onClick={handleSynthesizeGrowth}
          disabled={isSynthesizing || entries.length < 2}
          className="flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-xs font-medium text-white shadow-[0_0_10px_rgba(20,184,166,0.3)] transition hover:bg-teal-500 disabled:opacity-40"
        >
          <Sparkles className={`h-4 w-4 ${isSynthesizing ? "animate-spin" : ""}`} />
          <span>{isSynthesizing ? "Analyzing Patterns..." : "Synthesize Growth Report"}</span>
        </button>
      </div>

      {/* Top Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        {/* Metric 1: Total Sessions */}
        <div className="rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Reflections Logged</span>
            <BrainCircuit className="h-4 w-4 text-teal-400" />
          </div>
          <div className="mt-2 text-2xl font-light font-serif text-white sm:text-3xl">{totalEntries}</div>
          <div className="mt-1 text-[10px] font-mono text-slate-500">Across all journaling modes</div>
        </div>

        {/* Metric 2: Average Sentiment */}
        <div className="rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Avg Sentiment</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono sm:text-3xl ${
                averageSentiment > 0.2
                  ? "text-emerald-400"
                  : averageSentiment < -0.2
                  ? "text-rose-400"
                  : "text-amber-400"
              }`}
            >
              {averageSentiment > 0 ? "+" : ""}
              {averageSentiment.toFixed(2)}
            </span>
            <span className="text-[11px] text-slate-400">
              {averageSentiment > 0.3 ? "Optimistic" : averageSentiment > 0 ? "Balanced" : "Challenged"}
            </span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-slate-500">Scale (-1.0 to +1.0)</div>
        </div>

        {/* Metric 3: Action Commitments */}
        <div className="rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Commitments Met</span>
            <ListTodo className="h-4 w-4 text-teal-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1 text-2xl font-bold font-mono text-white sm:text-3xl">
            <span>{actionCompletionRate}%</span>
            <span className="text-xs font-normal font-sans text-slate-500">
              ({completedActions}/{totalActions})
            </span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-slate-500">Action items completed</div>
        </div>

        {/* Metric 4: Consistency Streak */}
        <div className="rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Active Days</span>
            <Flame className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-300 sm:text-3xl flex items-center gap-1">
            <span>{currentStreak}</span>
            <span className="text-xs font-normal font-sans text-slate-500">days</span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-slate-500">Reflections recorded</div>
        </div>
      </div>

      {/* Weekly Retrospective & Actionable Goals Card (Automated Sunday 9 AM Cron) */}
      <div className="mb-6 rounded-xl border border-teal-500/20 bg-[#080808] p-5 shadow-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif italic text-base sm:text-lg text-white">
                  Sunday 9:00 AM Weekly Goals & Mood Synthesis
                </h3>
                <span className="rounded-full bg-teal-950/60 border border-teal-500/30 px-2 py-0.5 text-[10px] font-mono text-teal-300">
                  Cron: 0 9 * * 0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated weekly retrospective querying your last 7 days of reflections into 3 actionable goals and a mood summary.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {cronStatus?.discordWebhookConfigured ? (
              <button
                onClick={handleTestDiscord}
                disabled={isTestingDiscord}
                title="Send a live test message to your Discord channel to verify connectivity"
                className="flex items-center gap-1.5 rounded bg-indigo-950/60 border border-indigo-500/40 px-2.5 py-1.5 text-[11px] font-mono text-indigo-300 hover:bg-indigo-900/50 transition active:scale-95 disabled:opacity-50"
              >
                <Send className={`h-3 w-3 text-indigo-400 ${isTestingDiscord ? "animate-pulse" : ""}`} />
                {isTestingDiscord ? "Dispatching..." : "Test Discord Dispatch"}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 rounded bg-amber-950/40 border border-amber-500/30 px-2 py-1 text-[11px] font-mono text-amber-300">
                Discord Not Set
              </span>
            )}
            <button
              onClick={handleRunWeeklyExtractionNow}
              disabled={isTriggeringCron}
              className="flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-300 transition hover:bg-teal-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isTriggeringCron ? "animate-spin" : ""}`} />
              {isTriggeringCron ? "Extracting Goals..." : "Run Weekly Synthesis Now"}
            </button>
          </div>
        </div>

        {cronFeedback && (
          <div className="mt-3 rounded-lg border border-teal-500/30 bg-teal-950/20 px-3.5 py-2 text-xs text-teal-200">
            {cronFeedback}
          </div>
        )}

        {weeklyGoals.length === 0 ? (
          <div className="mt-4 rounded-lg border border-white/5 bg-[#111] p-4 text-center">
            <Clock className="mx-auto h-6 w-6 text-slate-500 mb-2" />
            <p className="text-xs text-slate-300 font-medium">No weekly goals generated yet.</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
              The automated cron job runs every Sunday at 9:00 AM, or click "Run Weekly Synthesis Now" to analyze your last 7 days immediately.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {weeklyGoals.slice(0, 3).map((goalRecord) => (
              <div
                key={goalRecord.id}
                className="rounded-lg border border-white/10 bg-[#111] p-4 text-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/5 pb-2">
                  <span className="font-mono text-[11px] text-teal-400 font-medium flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-teal-400" />
                    Generated: {new Date(goalRecord.createdAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {goalRecord.entryCount || 0} reflections analyzed
                    </span>
                    {goalRecord.syncedToDiscord && (
                      <span className="rounded bg-indigo-950 border border-indigo-500/30 px-1.5 py-0.5 text-[9px] font-mono text-indigo-300">
                        Dispatched to Discord
                      </span>
                    )}
                  </div>
                </div>

                {/* Mood Summary */}
                <div className="rounded border border-teal-500/20 bg-teal-950/20 p-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block mb-0.5">
                    Weekly Mood & Emotional Summary
                  </span>
                  <p className="text-xs text-slate-200 italic font-serif">
                    "{goalRecord.weeklyMoodSummary}"
                  </p>
                </div>

                {/* 3 Actionable Goals */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    3 Actionable Weekly Goals
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(goalRecord.goals || []).map((goal, gIdx) => (
                      <div
                        key={gIdx}
                        className="flex items-start gap-2 rounded-lg border border-white/5 bg-[#161616] p-2.5"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-[10px] font-bold font-mono text-teal-300">
                          {gIdx + 1}
                        </span>
                        <span className="text-[11px] text-slate-200 leading-snug">
                          {goal}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Growth Report Card (if synthesized) */}
      {growthSummary && (
        <div className="mb-6 rounded-xl border border-teal-500/30 bg-[#080808] p-6 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Sparkles className="h-5 w-5 text-teal-400" />
            <h3 className="font-serif italic text-lg text-white">
              Gemini Longitudinal Growth Retrospective
            </h3>
          </div>
          <div className="mt-4 whitespace-pre-wrap text-xs leading-relaxed text-slate-300 sm:text-sm font-sans">
            {growthSummary}
          </div>
        </div>
      )}

      {/* Main Charts & Breakdowns Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Sentiment History & Timeline (7 Cols) */}
        <div className="rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl lg:col-span-7">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="font-serif italic text-base">Sentiment Trajectory Timeline</span>
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Chronological progression of emotional valence extracted from your entries.
          </p>

          {entriesWithSentiment.length === 0 ? (
            <div className="mt-6 flex h-48 items-center justify-center text-xs text-slate-500">
              No sentiment data available. Summarize sessions in the Workspace to track sentiment.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {entriesWithSentiment.slice(0, 6).map((entry) => {
                const score = entry.insights?.sentimentScore || 0;
                const percentage = Math.round(((score + 1) / 2) * 100);
                return (
                  <div key={entry.id} className="rounded-lg border border-white/5 bg-white/5 p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200 line-clamp-1 max-w-[60%]">
                        {entry.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#111] border border-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                          {entry.insights?.moodTag || "Reflective"}
                        </span>
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            score > 0.2
                              ? "text-emerald-400"
                              : score < -0.2
                              ? "text-rose-400"
                              : "text-amber-400"
                          }`}
                        >
                          {score > 0 ? "+" : ""}
                          {score.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar representation */}
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#111]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          score > 0.2
                            ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                            : score < -0.2
                            ? "bg-gradient-to-r from-rose-500 to-orange-400"
                            : "bg-gradient-to-r from-amber-500 to-yellow-400"
                        }`}
                        style={{ width: `${Math.max(5, Math.min(100, percentage))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Mood Distribution & Mode Mix (5 Cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Mood Frequency Matrix */}
          <div className="rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smile className="h-4 w-4 text-teal-400" />
              <span className="font-serif italic text-base">Mood Frequency Matrix</span>
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Distribution of psychological descriptors synthesized by Gemini.
            </p>

            {sortedMoods.length === 0 ? (
              <div className="mt-4 text-xs text-slate-500">No moods recorded yet.</div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {sortedMoods.map(([mood, count]) => (
                  <div
                    key={mood}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-3 py-1 text-xs text-slate-300"
                  >
                    <span className="font-medium text-teal-300">{mood}</span>
                    <span className="rounded-full bg-teal-950/80 border border-teal-500/30 px-1.5 py-0.2 text-[10px] font-bold font-mono text-teal-400">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mode Breakdown */}
          <div className="rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <span className="font-serif italic text-base">Journaling Modality Mix</span>
            </h3>
            <div className="mt-4 space-y-2 text-xs">
              {Object.entries(modeCounts).map(([m, count]) => (
                <div key={m} className="flex items-center justify-between text-slate-300 border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                  <span className="capitalize">{m.replace("_", " ")}</span>
                  <span className="font-mono text-slate-500">{count} sessions</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Items Central Hub */}
      <div className="mt-6 rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-teal-400" />
            <h3 className="font-serif italic text-lg text-white">
              Unified Commitments Hub
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {completedActions} of {totalActions} completed
          </span>
        </div>

        {allActionItems.length === 0 ? (
          <div className="mt-4 text-center text-xs text-slate-500 py-6">
            No action items generated yet. Summarize your sessions to extract actionable steps.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {allActionItems.slice(0, 10).map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleToggleActionItem(action.entryId, action.index)}
                className={`flex items-start gap-2.5 rounded-lg border p-3 text-left text-xs transition ${
                  action.isDone
                    ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300 line-through"
                    : "border-white/5 bg-[#111] text-slate-300 hover:border-white/15"
                }`}
              >
                {action.isDone ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                )}
                <div>
                  <span className="leading-snug">{action.item}</span>
                  <span className="block mt-1 text-[10px] text-slate-500 not-italic no-underline">
                    From: {action.entryTitle}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
