import React, { useState } from "react";
import {
  Sparkles,
  Trophy,
  Flame,
  Heart,
  Music,
  Share2,
  Download,
  Check,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Award,
  Zap,
  ShieldAlert,
  Compass,
  Repeat
} from "lucide-react";
import confetti from "canvas-confetti";
import { JournalEntry, LifeRewindSummary } from "../types";

interface LifeRewindDeckProps {
  entries: JournalEntry[];
  userId: string;
}

export const LifeRewindDeck: React.FC<LifeRewindDeckProps> = ({ entries, userId }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("Year 2026");
  const [isGenerating, setIsGenerating] = useState(false);
  const [rewindData, setRewindData] = useState<LifeRewindSummary | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [copied, setCopied] = useState(false);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#14b8a6", "#10b981", "#3b82f6", "#f59e0b", "#ec4899"]
      });
    } catch (e) {
      // safe fallback
    }
  };

  const handleGenerateRewind = async () => {
    if (entries.length === 0) {
      alert("Please log at least one reflection first to generate your Life Rewind.");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/gemini/rewind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || "guest",
          periodLabel: selectedPeriod,
          entries: entries.map((e) => ({
            id: e.id,
            title: e.title,
            createdAt: e.createdAt,
            insights: e.insights,
            location: e.location
          }))
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate Year in Review.");
      }

      const data = await res.json();
      setRewindData(data.rewind);
      setActiveSlide(0);
      triggerConfetti();
    } catch (err: any) {
      console.error("[Rewind Generation Error]:", err);
      alert(err.message || "Could not generate retrospective. Please verify server connection.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyRecapToClipboard = () => {
    if (!rewindData) return;
    const text = `🌟 **MY LIFE REWIND (${rewindData.periodLabel})** 🌟\n` +
      `Title: ${rewindData.title}\n` +
      `Archetype: ${rewindData.archetype?.badgeEmoji} ${rewindData.archetype?.name} — "${rewindData.archetype?.tagline}"\n\n` +
      `🏆 **Happiest Breakthroughs:**\n${rewindData.happiestBreakthroughs.map((b) => `• ${b}`).join("\n")}\n\n` +
      `🛡️ **Conquered Challenges:**\n${rewindData.biggestChallengesConquered.map((c) => `• ${c}`).join("\n")}\n\n` +
      `🎶 **Soundtrack Vibe:** ${rewindData.soundtrackTone}\n` +
      `🧭 **Life Motto:** "${rewindData.keyMotto}"\n\n` +
      `Generated with Personal Gemini Journal (Enterprise AI & Firestore Isolation)`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const totalSlides = 5;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Header Controls */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="font-serif text-2xl text-white sm:text-3xl italic">
              Year in Review & Life Rewind
            </h2>
            <span className="rounded-full border border-teal-500/30 bg-teal-950/40 px-2.5 py-0.5 text-[10px] font-mono text-teal-300">
              Gemini Synthesis
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            A Spotify-style cinematic retrospective uncovering your mood arc, proudest breakthroughs, and dominant archetype.
          </p>
        </div>

        {/* Generator Trigger & Period Selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#121212] px-3 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none"
          >
            <option value="Year 2026">Year 2026</option>
            <option value="Last 6 Months">Last 6 Months</option>
            <option value="All Time Retrospective">All Time</option>
          </select>

          <button
            onClick={handleGenerateRewind}
            disabled={isGenerating || entries.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-teal-500/50 bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(13,148,136,0.3)] transition hover:bg-teal-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`} />
            <span>{isGenerating ? "Synthesizing..." : "Generate Rewind"}</span>
          </button>
        </div>
      </div>

      {/* Main Rewind Presentation Viewport */}
      {!rewindData ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#080a0f] p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-600 to-indigo-600 text-3xl shadow-xl mb-4">
            ✨
          </div>
          <h3 className="font-serif text-xl font-medium text-white">
            Ready to Unveil Your Retrospective?
          </h3>
          <p className="mt-2 max-w-md text-xs text-slate-400">
            Gemini will synthesize all <strong>{entries.length} reflections</strong> in your isolated Firestore collection to reveal your personal archetype, breakthrough moments, and psychological arc.
          </p>

          <button
            onClick={handleGenerateRewind}
            disabled={isGenerating || entries.length === 0}
            className="mt-6 flex items-center gap-2 rounded-full bg-teal-500 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-teal-400 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>Launch Life Rewind</span>
          </button>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-3xl border border-teal-500/30 bg-gradient-to-br from-[#070b14] via-[#090e18] to-[#04060a] p-6 sm:p-10 shadow-[0_0_80px_rgba(20,184,166,0.1)]">
          {/* Top Slide Navigation Bar */}
          <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-teal-400 uppercase tracking-wider">
                {rewindData.periodLabel}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400">
                {rewindData.totalReflectionsAnalyzed} reflections distilled
              </span>
            </div>

            {/* Slide Dots */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSlides }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSlide(idx)}
                  className={`h-2 rounded-full transition-all ${
                    activeSlide === idx
                      ? "w-6 bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]"
                      : "w-2 bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>

            {/* Share / Copy Button */}
            <button
              onClick={copyRecapToClipboard}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#121212] px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Share Recap</span>
                </>
              )}
            </button>
          </div>

          {/* Slide 0: The Archetype Reveal */}
          {activeSlide === 0 && (
            <div className="py-6 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="inline-flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-teal-500/20 via-emerald-500/30 to-indigo-500/20 border border-teal-500/40 text-5xl shadow-[0_0_40px_rgba(20,184,166,0.3)] mb-4">
                {rewindData.archetype?.badgeEmoji || "🌟"}
              </div>

              <span className="block text-xs font-mono font-bold uppercase tracking-[0.25em] text-teal-400 mb-1">
                Your Primary Archetype
              </span>
              <h3 className="font-serif text-3xl sm:text-5xl font-bold text-white tracking-tight">
                {rewindData.archetype?.name}
              </h3>
              <p className="mt-3 text-base sm:text-lg italic font-serif text-teal-200/90 max-w-xl mx-auto">
                "{rewindData.archetype?.tagline}"
              </p>
              <p className="mt-4 text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                {rewindData.archetype?.description}
              </p>

              <div className="mt-8 inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-serif text-sm italic text-slate-300">
                Journey Title: <span className="text-white font-semibold">"{rewindData.title}"</span>
              </div>
            </div>
          )}

          {/* Slide 1: Happiest Moments & Breakthroughs */}
          {activeSlide === 1 && (
            <div className="py-4 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5 text-amber-400" />
                <h3 className="font-serif text-2xl sm:text-3xl text-white font-medium">
                  Peak Breakthroughs & Triumphs
                </h3>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                The most energizing realizations and victorious steps documented across your reflections.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rewindData.happiestBreakthroughs.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4 transition hover:border-amber-500/40"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-xs font-mono font-bold text-amber-300">
                      0{idx + 1}
                    </span>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-serif">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Slide 2: Challenges Conquered */}
          {activeSlide === 2 && (
            <div className="py-4 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="h-5 w-5 text-rose-400" />
                <h3 className="font-serif text-2xl sm:text-3xl text-white font-medium">
                  Friction & Challenges Conquered
                </h3>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Moments of ambiguity, stress, or high stakes where your resilience broke through.
              </p>

              <div className="space-y-3">
                {rewindData.biggestChallengesConquered.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-950/10 p-4"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-xs font-mono font-bold text-rose-300">
                      🛡️
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-serif">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Slide 3: Emotional Trajectory & Themes */}
          {activeSlide === 3 && (
            <div className="py-4 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-2 mb-4">
                <Heart className="h-5 w-5 text-teal-400" />
                <h3 className="font-serif text-2xl sm:text-3xl text-white font-medium">
                  The Emotional Arc & Life Pillars
                </h3>
              </div>

              {/* Emotional Narrative */}
              <div className="rounded-2xl border border-teal-500/20 bg-teal-950/10 p-5 mb-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block mb-1">
                  Psychological Trajectory
                </span>
                <p className="text-sm text-slate-200 font-serif italic leading-relaxed">
                  "{rewindData.emotionalTrajectory}"
                </p>
              </div>

              {/* Pillars */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Top Recurring Life Pillars
                </span>
                <div className="flex flex-wrap gap-2">
                  {rewindData.topRecurringThemes.map((theme, idx) => (
                    <span
                      key={idx}
                      className="rounded-xl border border-white/10 bg-[#121620] px-3.5 py-1.5 text-xs font-medium text-teal-200"
                    >
                      ✨ {theme}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Slide 4: Life Soundtrack & Grand Motto */}
          {activeSlide === 4 && (
            <div className="py-4 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 mb-3">
                <Music className="h-6 w-6" />
              </div>

              <span className="block text-xs font-mono uppercase tracking-widest text-indigo-400 mb-1">
                Your Life Soundtrack Tone
              </span>
              <h4 className="font-serif text-xl sm:text-2xl text-white font-medium">
                {rewindData.soundtrackTone}
              </h4>

              {/* Life Motto Banner */}
              <div className="mt-6 rounded-3xl border border-teal-500/40 bg-gradient-to-r from-teal-950/40 via-emerald-950/40 to-teal-950/40 p-6 sm:p-8">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300 block mb-2">
                  The Guiding Philosophy
                </span>
                <p className="font-serif text-xl sm:text-3xl italic font-bold text-white">
                  "{rewindData.keyMotto}"
                </p>
              </div>

              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  onClick={triggerConfetti}
                  className="rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-xs font-medium text-teal-300 hover:bg-teal-500/20"
                >
                  🎉 Celebrate Reflection
                </button>
                <button
                  onClick={copyRecapToClipboard}
                  className="rounded-full bg-teal-500 px-5 py-2 text-xs font-bold text-black hover:bg-teal-400"
                >
                  {copied ? "Copied Summary!" : "Copy Full Recap"}
                </button>
              </div>
            </div>
          )}

          {/* Bottom Slide Navigation Controls */}
          <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4">
            <button
              onClick={() => setActiveSlide((prev) => Math.max(0, prev - 1))}
              disabled={activeSlide === 0}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs font-mono text-slate-500">
              Slide {activeSlide + 1} of {totalSlides}
            </span>

            <button
              onClick={() => setActiveSlide((prev) => Math.min(totalSlides - 1, prev + 1))}
              disabled={activeSlide === totalSlides - 1}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
