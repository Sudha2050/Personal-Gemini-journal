import React, { useState } from "react";
import {
  BookOpen,
  Search,
  Filter,
  Pin,
  Lock,
  Unlock,
  Trash2,
  Download,
  Calendar,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Circle,
  X,
  Copy,
  Check,
  Tag,
  Smile,
  AlertCircle
} from "lucide-react";
import { JournalEntry, JournalMode } from "../types";
import { decryptJournalPayload, exportEntriesAsMarkdown } from "../lib/securityUtils";
import { deleteUserJournalEntry, saveUserJournalEntry } from "../lib/firebase";

interface JournalArchiveProps {
  entries: JournalEntry[];
  userId: string;
  onSelectEntryToEdit?: (entry: JournalEntry) => void;
}

export const JournalArchive: React.FC<JournalArchiveProps> = ({
  entries,
  userId,
  onSelectEntryToEdit
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMode, setSelectedMode] = useState<string>("all");
  const [selectedMood, setSelectedMood] = useState<string>("all");
  const [activeEntryModal, setActiveEntryModal] = useState<JournalEntry | null>(null);

  // Decryption state for locked entries
  const [decryptPin, setDecryptPin] = useState("");
  const [decryptError, setDecryptError] = useState("");
  const [decryptedCache, setDecryptedCache] = useState<Record<string, any>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Collect unique moods across entries
  const uniqueMoods = Array.from(
    new Set(
      entries
        .map((e) => e.insights?.moodTag)
        .filter((m): m is string => Boolean(m))
    )
  );

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.insights?.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesMode = selectedMode === "all" || entry.mode === selectedMode;
    const matchesMood = selectedMood === "all" || entry.insights?.moodTag === selectedMood;

    return matchesSearch && matchesMode && matchesMood;
  });

  const handleTogglePin = async (entry: JournalEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = { ...entry, isPinned: !entry.isPinned };
      await saveUserJournalEntry(userId, updated);
    } catch (err) {
      console.error("Pin toggle error:", err);
    }
  };

  const handleDeleteEntry = async (entryId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to permanently delete this journal entry?")) {
      try {
        await deleteUserJournalEntry(userId, entryId);
        if (activeEntryModal?.id === entryId) {
          setActiveEntryModal(null);
        }
      } catch (err) {
        console.error("Delete error:", err);
        alert("Failed to delete entry.");
      }
    }
  };

  const handleToggleActionItem = async (entry: JournalEntry, actionIdx: number) => {
    try {
      const currentCompleted = entry.completedActionItems || [];
      const updatedCompleted = currentCompleted.includes(actionIdx)
        ? currentCompleted.filter((i) => i !== actionIdx)
        : [...currentCompleted, actionIdx];

      const updated = { ...entry, completedActionItems: updatedCompleted };
      await saveUserJournalEntry(userId, updated);
      if (activeEntryModal?.id === entry.id) {
        setActiveEntryModal(updated);
      }
    } catch (err) {
      console.error("Action toggle error:", err);
    }
  };

  const handleDecryptVaultEntry = async (entry: JournalEntry) => {
    if (!decryptPin) {
      setDecryptError("Please enter your PIN passcode.");
      return;
    }
    setDecryptError("");

    try {
      if (!entry.encryptedPayload || !entry.iv) {
        throw new Error("No encrypted payload found.");
      }

      const decrypted = await decryptJournalPayload(entry.encryptedPayload, entry.iv, decryptPin);
      setDecryptedCache((prev) => ({
        ...prev,
        [entry.id]: decrypted
      }));
      setDecryptPin("");
    } catch (err) {
      setDecryptError("Invalid passcode or corrupted ciphertext.");
    }
  };

  const handleExportEntryMarkdown = (entry: JournalEntry) => {
    const md = exportEntriesAsMarkdown([entry]);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entry.title.replace(/\s+/g, "-").toLowerCase() || "journal-entry"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Archive Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-light font-serif italic text-white sm:text-3xl flex items-center gap-2.5">
            <BookOpen className="h-6 w-6 text-teal-400" />
            <span>Isolated Journal Vault</span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {entries.length} persistent reflections strictly isolated to your user ID.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            id="archive-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries, tags, takeaways..."
            className="w-full rounded-full border border-white/10 bg-[#111] py-2 pl-9 pr-4 text-xs text-white placeholder-slate-600 focus:border-teal-500/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Filter Tabs & Mood Badges */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
        <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-2">
          <Filter className="h-3.5 w-3.5" />
          <span>Filter:</span>
        </div>

        {/* Mode Filter Pills */}
        {["all", "reflection", "brainstorm", "problem_solving", "creative", "daily_checkin"].map((m) => (
          <button
            key={m}
            onClick={() => setSelectedMode(m)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
              selectedMode === m
                ? "bg-teal-600 text-white shadow-[0_0_10px_rgba(20,184,166,0.3)]"
                : "border border-white/10 bg-[#111] text-slate-400 hover:text-slate-200"
            }`}
          >
            {m === "all" ? "All Modes" : m.replace("_", " ")}
          </button>
        ))}

        {/* Mood filter if available */}
        {uniqueMoods.length > 0 && (
          <select
            value={selectedMood}
            onChange={(e) => setSelectedMood(e.target.value)}
            className="rounded-full border border-white/10 bg-[#111] px-3 py-1 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Moods</option>
            {uniqueMoods.map((mood) => (
              <option key={mood} value={mood}>
                {mood}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Entries Grid */}
      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#080808] p-12 text-center">
          <BookOpen className="h-10 w-10 text-slate-700 mb-3" />
          <h3 className="text-base font-serif italic text-slate-300">
            {entries.length === 0 ? "No Journal Entries Yet" : "No Matching Reflections"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {entries.length === 0
              ? "Head over to the Journal Workspace to converse with Gemini and save your first insight."
              : "Try adjusting your search query or filter settings."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEntries.map((entry) => {
            const isEncrypted = entry.isEncryptedVault;
            const decrypted = decryptedCache[entry.id];
            const effectiveInsights = decrypted ? decrypted.insights : entry.insights;
            const effectiveTitle = decrypted ? decrypted.title : entry.title;

            return (
              <div
                key={entry.id}
                onClick={() => setActiveEntryModal(entry)}
                className="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl transition-all hover:border-teal-500/40 hover:bg-[#0c0c0c] hover:shadow-[0_0_15px_rgba(20,184,166,0.1)] cursor-pointer"
              >
                <div>
                  {/* Card Header: Mode & Pin */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-white/5 border border-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {entry.mode?.replace("_", " ")}
                      </span>
                      {isEncrypted && (
                        <span className="flex items-center gap-1 rounded border border-teal-500/30 bg-teal-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-teal-300">
                          <Lock className="h-2.5 w-2.5" />
                          <span>Vault Locked</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleTogglePin(entry, e)}
                        title={entry.isPinned ? "Unpin" : "Pin to top"}
                        className={`rounded-lg p-1 text-xs transition ${
                          entry.isPinned
                            ? "text-amber-400 bg-amber-950/40"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Date */}
                  <h3 className="mt-3 font-serif italic text-lg font-light text-white line-clamp-1 group-hover:text-teal-300 transition">
                    {effectiveTitle}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>

                  {/* Summary / Snippet */}
                  {isEncrypted && !decrypted ? (
                    <div className="mt-3 rounded-lg border border-teal-500/20 bg-teal-950/20 p-2.5 text-xs text-teal-300/80 italic flex items-center gap-2 font-serif">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span>Encrypted with AES-GCM. Passcode required to view.</span>
                    </div>
                  ) : effectiveInsights?.summary ? (
                    <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-slate-400">
                      {effectiveInsights.summary}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500 italic">
                      Conversational reflection session ({entry.messages?.length || 0} messages).
                    </p>
                  )}
                </div>

                {/* Footer Badges & Progress */}
                <div className="mt-4 border-t border-white/5 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    {effectiveInsights?.moodTag ? (
                      <span className="rounded-full border border-teal-500/30 bg-teal-950/40 px-2 py-0.5 text-[10px] font-semibold text-teal-300">
                        {effectiveInsights.moodTag}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">No mood tag</span>
                    )}

                    {effectiveInsights?.actionItems?.length ? (
                      <span className="text-[10px] font-mono text-slate-500">
                        {entry.completedActionItems?.length || 0}/{effectiveInsights.actionItems.length} actions done
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Entry Detail & Read Modal */}
      {activeEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-white/10 bg-[#080808] p-6 shadow-2xl sm:p-8">
            {/* Modal Close Button */}
            <button
              onClick={() => setActiveEntryModal(null)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Header */}
            <div className="border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded bg-teal-950 border border-teal-500/30 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-300">
                  {activeEntryModal.mode?.replace("_", " ")}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {new Date(activeEntryModal.createdAt).toLocaleString()}
                </span>
              </div>

              <h2 className="mt-2 text-2xl font-light font-serif italic text-white sm:text-3xl">
                {decryptedCache[activeEntryModal.id]
                  ? decryptedCache[activeEntryModal.id].title
                  : activeEntryModal.title}
              </h2>
            </div>

            {/* If Encrypted and not decrypted */}
            {activeEntryModal.isEncryptedVault && !decryptedCache[activeEntryModal.id] ? (
              <div className="my-8 rounded-xl border border-teal-500/30 bg-teal-950/30 p-6 text-center">
                <Lock className="mx-auto h-10 w-10 text-teal-400 mb-2" />
                <h3 className="font-serif italic text-lg text-white">Client-Side Zero-Knowledge Encryption</h3>
                <p className="mt-1 text-xs text-teal-200/80 max-w-md mx-auto">
                  This reflection was sealed with AES-256-GCM. Please enter your secret passcode to decrypt in browser RAM.
                </p>

                {decryptError && (
                  <div className="mt-3 text-xs text-rose-400">{decryptError}</div>
                )}

                <div className="mt-4 flex items-center justify-center gap-2 max-w-xs mx-auto">
                  <input
                    type="password"
                    value={decryptPin}
                    onChange={(e) => setDecryptPin(e.target.value)}
                    placeholder="Enter PIN passcode"
                    className="w-full rounded-full border border-white/10 bg-[#111] px-3.5 py-2 text-xs text-white focus:outline-none focus:border-teal-500/50"
                  />
                  <button
                    onClick={() => handleDecryptVaultEntry(activeEntryModal)}
                    className="rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.3)]"
                  >
                    Unlock
                  </button>
                </div>
              </div>
            ) : (
              /* Decrypted or Normal Content */
              <div className="my-6 space-y-6">
                {/* Insights Box */}
                {(decryptedCache[activeEntryModal.id]?.insights || activeEntryModal.insights) && (
                  <div className="rounded-lg border border-white/5 bg-white/5 p-5 space-y-4">
                    {/* Mood & Sentiment */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Mood:</span>
                        <span className="rounded-full bg-teal-950 border border-teal-500/40 px-3 py-0.5 text-xs font-bold text-teal-300">
                          {(decryptedCache[activeEntryModal.id]?.insights || activeEntryModal.insights)?.moodTag}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-emerald-400">
                        Score:{" "}
                        {(decryptedCache[activeEntryModal.id]?.insights || activeEntryModal.insights)?.sentimentScore?.toFixed(2)}
                      </div>
                    </div>

                    {/* Summary */}
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Executive Summary
                      </h4>
                      <p className="mt-1 text-sm leading-relaxed text-slate-300">
                        {(decryptedCache[activeEntryModal.id]?.insights || activeEntryModal.insights)?.summary}
                      </p>
                    </div>

                    {/* Takeaways */}
                    {(decryptedCache[activeEntryModal.id]?.insights || activeEntryModal.insights)?.keyInsights?.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Key Takeaways
                        </h4>
                        <ul className="mt-1.5 space-y-1">
                          {(decryptedCache[activeEntryModal.id]?.insights || activeEntryModal.insights)?.keyInsights.map((item: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-400 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Interactive Action Items Checklist */}
                    {(decryptedCache[activeEntryModal.id]?.insights || activeEntryModal.insights)?.actionItems?.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Action Items Checklist
                        </h4>
                        <div className="mt-2 space-y-1.5">
                          {(decryptedCache[activeEntryModal.id]?.insights || activeEntryModal.insights)?.actionItems.map((action: string, i: number) => {
                            const isDone = activeEntryModal.completedActionItems?.includes(i);
                            return (
                              <button
                                key={i}
                                onClick={() => handleToggleActionItem(activeEntryModal, i)}
                                className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left text-xs transition ${
                                  isDone
                                    ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300 line-through"
                                    : "border-white/5 bg-[#111] text-slate-300 hover:border-white/15"
                                }`}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <Circle className="mt-0.5 h-3.5 w-3.5 text-slate-500 shrink-0" />
                                )}
                                <span>{action}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Cognitive Reframing */}
                    {(decryptedCache[activeEntryModal.id]?.insights || activeEntryModal.insights)?.cognitiveReflections && (
                      <div className="rounded border border-teal-500/20 bg-teal-950/30 p-3 italic text-xs text-teal-200 leading-relaxed font-serif">
                        "{(decryptedCache[activeEntryModal.id]?.insights || activeEntryModal.insights)?.cognitiveReflections}"
                      </div>
                    )}
                  </div>
                )}

                {/* Conversation History */}
                {((decryptedCache[activeEntryModal.id]?.messages || activeEntryModal.messages) || []).length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                      Dialogue Transcript
                    </h4>
                    <div className="space-y-3">
                      {((decryptedCache[activeEntryModal.id]?.messages || activeEntryModal.messages) || []).map((msg: any) => (
                        <div
                          key={msg.id}
                          className={`rounded-lg p-3.5 text-xs leading-relaxed ${
                            msg.role === "user"
                              ? "bg-teal-900/20 border border-teal-500/20 text-white"
                              : "bg-[#0c0c0c] border border-white/5 text-slate-300"
                          }`}
                        >
                          <div className="font-bold text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                            {msg.role === "user" ? "You" : "Gemini"}:
                          </div>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer Actions */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportEntryMarkdown(activeEntryModal)}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#111] px-3.5 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                >
                  <Download className="h-3.5 w-3.5 text-teal-400" />
                  <span>Export Markdown</span>
                </button>
              </div>

              <button
                onClick={() => handleDeleteEntry(activeEntryModal.id)}
                className="flex items-center gap-1.5 rounded-full border border-red-800/40 bg-red-950/30 px-3.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Entry</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
