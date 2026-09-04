import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  RotateCcw,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  BookmarkCheck,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  BrainCircuit,
  Lightbulb,
  Copy,
  Check,
  ChevronRight,
  Flame,
  MessageSquare,
  Compass,
  Smile,
  Zap,
  Info,
  MapPin,
  Briefcase,
  Navigation,
  AlertTriangle
} from "lucide-react";
import confetti from "canvas-confetti";
import Markdown from "react-markdown";
import {
  ChatMessage,
  JournalEntry,
  JournalInsights,
  JournalMode,
  UserProfile,
  GeoLocationTag
} from "../types";
import { PRESET_LOCATIONS } from "./LifeMapExplorer";
import {
  detectAndSanitizePii,
  encryptJournalPayload,
  sendAuditLog,
  speakText,
  stopSpeaking
} from "../lib/securityUtils";
import { saveUserJournalEntry } from "../lib/firebase";

interface JournalWorkspaceProps {
  user: UserProfile | null;
  onOpenAuth: () => void;
  onEntrySaved: (entry: JournalEntry) => void;
  initialEntry?: JournalEntry | null;
}

const MODES: { id: JournalMode; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  {
    id: "reflection",
    label: "Mindful Reflection",
    icon: <Sparkles className="h-4 w-4" />,
    desc: "Unpack emotions, process daily events, and find mental clarity.",
    color: "from-teal-500/20 to-emerald-500/20 border-teal-500/30 text-teal-300"
  },
  {
    id: "workday_debrief",
    label: "Workday Debrief",
    icon: <Briefcase className="h-4 w-4" />,
    desc: "Process workplace stress, decouple cognitive load, and track burnout resilience.",
    color: "from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-300"
  },
  {
    id: "brainstorm",
    label: "Strategic Brainstorm",
    icon: <Lightbulb className="h-4 w-4" />,
    desc: "Ideate on projects, explore lateral solutions, and structure strategies.",
    color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-300"
  },
  {
    id: "problem_solving",
    label: "Problem Solving",
    icon: <Compass className="h-4 w-4" />,
    desc: "Break down roadblocks with 1st principles & 5-Whys root-cause inquiry.",
    color: "from-cyan-500/20 to-teal-500/20 border-cyan-500/30 text-cyan-300"
  },
  {
    id: "creative",
    label: "Creative Flow",
    icon: <Zap className="h-4 w-4" />,
    desc: "Unblock writing, brainstorm stories, and engage in free-form expression.",
    color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300"
  },
  {
    id: "daily_checkin",
    label: "Daily Check-In",
    icon: <Smile className="h-4 w-4" />,
    desc: "Quick audit of morning intentions, evening gratitude, and energy levels.",
    color: "from-teal-500/20 to-slate-500/20 border-teal-500/30 text-teal-300"
  }
];

export const JournalWorkspace: React.FC<JournalWorkspaceProps> = ({
  user,
  onOpenAuth,
  onEntrySaved,
  initialEntry
}) => {
  const draftKey = `gemini_journal_draft_${user?.uid || "guest"}`;

  const [sessionTitle, setSessionTitle] = useState(() => {
    try {
      const saved = localStorage.getItem(`gemini_journal_draft_${user?.uid || "guest"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sessionTitle) return parsed.sessionTitle;
      }
    } catch (e) {}
    return "Midnight Reflection";
  });

  const [mode, setMode] = useState<JournalMode>(() => {
    try {
      const saved = localStorage.getItem(`gemini_journal_draft_${user?.uid || "guest"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.mode) return parsed.mode;
      }
    } catch (e) {}
    return "reflection";
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(`gemini_journal_draft_${user?.uid || "guest"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          return parsed.messages;
        }
      }
    } catch (e) {}
    return [
      {
        id: "initial-1",
        role: "assistant",
        content:
          "Hello! I am your **Personal Gemini Journal** companion. Whether you're untangling a complex dilemma, reflecting on a milestone, or planning your next sprint — what is top of mind for you today?",
        timestamp: Date.now()
      }
    ];
  });

  const [inputPrompt, setInputPrompt] = useState(() => {
    try {
      const saved = localStorage.getItem(`gemini_journal_draft_${user?.uid || "guest"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.inputPrompt === "string") return parsed.inputPrompt;
      }
    } catch (e) {}
    return "";
  });

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [insights, setInsights] = useState<JournalInsights | null>(() => {
    try {
      const saved = localStorage.getItem(`gemini_journal_draft_${user?.uid || "guest"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.insights) return parsed.insights;
      }
    } catch (e) {}
    return null;
  });

  // Automatically save in-progress session to localStorage so changing tabs or refreshes never lose work
  useEffect(() => {
    try {
      const hasMeaningfulContent =
        messages.some((m) => m.role === "user") ||
        inputPrompt.trim().length > 0 ||
        insights !== null;

      if (hasMeaningfulContent) {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            messages,
            sessionTitle,
            mode,
            inputPrompt,
            insights
          })
        );
      }
    } catch (e) {}
  }, [messages, sessionTitle, mode, inputPrompt, insights, draftKey]);

  // Security and Privacy Toggles
  const [piiFilterEnabled, setPiiFilterEnabled] = useState(true);
  const [detectedPiiTypes, setDetectedPiiTypes] = useState<string[]>([]);
  const [isVaultLocked, setIsVaultLocked] = useState(false);
  const [vaultPasscode, setVaultPasscode] = useState("");
  const [showPasscodePrompt, setShowPasscodePrompt] = useState(false);

  // Audio & Speech
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Inspiration Prompts
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isQuotaNoticeVisible, setIsQuotaNoticeVisible] = useState(false);

  // Geolocation Tagging State
  const [locationTag, setLocationTag] = useState<GeoLocationTag | null>(() => {
    return initialEntry?.location || null;
  });
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocationTag({
          latitude,
          longitude,
          city: "Detected Location",
          placeName: `GPS (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`
        });
        setShowLocationPicker(false);
      },
      (err) => {
        alert("GPS access was not granted or timed out. You can select a city from the global preset options.");
      }
    );
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiLoading]);

  // Load contextual prompts when mode shifts
  useEffect(() => {
    fetchPromptIdeas(mode);
  }, [mode]);

  // Check PII in real-time as user types
  useEffect(() => {
    if (piiFilterEnabled && inputPrompt.trim()) {
      const piiCheck = detectAndSanitizePii(inputPrompt);
      setDetectedPiiTypes(piiCheck.detectedTypes);
    } else {
      setDetectedPiiTypes([]);
    }
  }, [inputPrompt, piiFilterEnabled]);

  const fetchPromptIdeas = async (targetMode: JournalMode) => {
    setIsLoadingPrompts(true);
    try {
      const res = await fetch("/api/gemini/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: targetMode })
      });
      const data = await res.json();
      if (data.prompts && Array.isArray(data.prompts)) {
        setSuggestedPrompts(data.prompts);
      }
    } catch (err) {
      console.warn("Failed to fetch prompts:", err);
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  // Web Speech Recognition for Voice Journaling
  const toggleVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in this browser. Please type your reflection.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputPrompt((prev) => (prev ? prev + " " + transcript : transcript));
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputPrompt;
    if (!textToSend.trim() || isAiLoading) return;

    // Optional PII scrubbing
    let sanitizedText = textToSend;
    if (piiFilterEnabled) {
      const piiCheck = detectAndSanitizePii(textToSend);
      if (piiCheck.hasPii) {
        sanitizedText = piiCheck.sanitizedText;
      }
    }

    const userMessage: ChatMessage = {
      id: "msg-" + Date.now(),
      role: "user",
      content: sanitizedText,
      timestamp: Date.now()
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputPrompt("");
    setIsAiLoading(true);

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          mode,
          piiFilterEnabled,
          userId: user?.uid || "guest"
        })
      });

      const data = await response.json();

      if (data.isQuotaDepleted) {
        setIsQuotaNoticeVisible(true);
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate Gemini response.");
      }

      const assistantMessage: ChatMessage = {
        id: "msg-" + Date.now() + 1,
        role: "assistant",
        content: data.reply,
        timestamp: Date.now()
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Gemini Chat Error:", err);
      const errorMessage: ChatMessage = {
        id: "msg-err-" + Date.now(),
        role: "assistant",
        content: `⚠️ **Security & Network Notice:** ${err.message || "Unable to reach Gemini API. Please check server secrets."}`,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (messages.length < 2) {
      alert("Please converse a bit more with Gemini before generating a summary.");
      return;
    }

    setIsSummarizing(true);
    try {
      const res = await fetch("/api/gemini/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          title: sessionTitle,
          userId: user?.uid || "guest",
          piiFilterEnabled
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to extract journal insights.");
      }

      setInsights(data.insights);

      // Trigger soft celebration
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ["#6366f1", "#a855f7", "#10b981"]
      });
    } catch (err: any) {
      console.error("Summarization Error:", err);
      alert(err.message || "Failed to generate insights.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSaveToFirestore = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }

    setIsSaving(true);
    try {
      const entryId = "entry-" + Date.now();
      let payloadToSave: Partial<JournalEntry> = {
        id: entryId,
        userId: user.uid,
        title: sessionTitle || "Untitled Reflection",
        mode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: insights?.suggestedTags || ["#journal", `#${mode}`],
        isPinned: false,
        isEncryptedVault: isVaultLocked
      };

      if (insights) {
        payloadToSave.insights = insights;
      }
      if (locationTag) {
        payloadToSave.location = locationTag;
      }

      if (isVaultLocked) {
        if (!vaultPasscode || vaultPasscode.length < 4) {
          alert("Please enter a PIN passcode of at least 4 digits to encrypt this entry.");
          setShowPasscodePrompt(true);
          setIsSaving(false);
          return;
        }

        // Encrypt messages and insights payload using WebCrypto AES-GCM
        const encrypted = await encryptJournalPayload(
          { messages, insights, title: sessionTitle },
          vaultPasscode
        );

        payloadToSave.encryptedPayload = encrypted.ciphertext;
        payloadToSave.iv = encrypted.iv;
        payloadToSave.messages = []; // Erase plain text from Firestore document!
      } else {
        payloadToSave.messages = messages;
      }

      await saveUserJournalEntry(user.uid, payloadToSave as JournalEntry);
      try {
        localStorage.removeItem(draftKey);
      } catch (e) {}
      sendAuditLog("JOURNAL_ENTRY_SAVED", user.uid, "SUCCESS", {
        isVaultLocked,
        mode,
        hasSummary: Boolean(insights)
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onEntrySaved(payloadToSave as JournalEntry);

      // Trigger festive confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (err: any) {
      console.error("Save Error:", err);
      alert("Failed to save entry: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSpeechToggle = (msgId: string, text: string) => {
    if (speakingMessageId === msgId) {
      stopSpeaking();
      setSpeakingMessageId(null);
    } else {
      setSpeakingMessageId(msgId);
      speakText(text, () => setSpeakingMessageId(null));
    }
  };

  const copySummaryText = () => {
    if (!insights) return;
    const text = `**Summary:** ${insights.summary}\n\n**Mood:** ${insights.moodTag}\n\n**Takeaways:**\n${insights.keyInsights.join("\n")}\n\n**Actions:**\n${insights.actionItems.join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleResetSession = () => {
    if (confirm("Reset current journaling session and start fresh?")) {
      try {
        localStorage.removeItem(draftKey);
      } catch (e) {}
      setMessages([
        {
          id: "initial-reset",
          role: "assistant",
          content: "Fresh canvas ready. What would you like to explore or document next?",
          timestamp: Date.now()
        }
      ]);
      setInsights(null);
      setSessionTitle("New Journal Session");
      setInputPrompt("");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Top Session Config Bar */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-white/10 bg-[#080808] p-5 shadow-xl md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
            Current Reflection
          </label>
          <input
            id="session-title-input"
            type="text"
            value={sessionTitle}
            onChange={(e) => setSessionTitle(e.target.value)}
            className="w-full bg-transparent text-2xl font-light text-white font-serif italic tracking-tight placeholder-slate-700 focus:outline-none focus:ring-0 sm:text-3xl"
            placeholder="Midnight Reflection..."
          />
        </div>

        {/* Security Controls & Mode Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* PII Scrubber Toggle */}
          <button
            onClick={() => setPiiFilterEnabled(!piiFilterEnabled)}
            title="Automatically scrub emails, phone numbers, and SSNs before sending to Gemini"
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              piiFilterEnabled
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-white/10 bg-[#111] text-slate-500 hover:text-slate-300"
            }`}
          >
            {piiFilterEnabled ? (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5 text-slate-500" />
            )}
            <span>PII Redactor {piiFilterEnabled ? "ON" : "OFF"}</span>
          </button>

          {/* Client-Side Vault Encryption Toggle */}
          <button
            onClick={() => {
              if (!isVaultLocked) {
                setShowPasscodePrompt(true);
              } else {
                setIsVaultLocked(false);
                setVaultPasscode("");
              }
            }}
            title="Encrypt reflection with client-side AES-GCM before saving to Firestore"
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              isVaultLocked
                ? "border-teal-500/30 bg-teal-950/40 text-teal-300"
                : "border-white/10 bg-[#111] text-slate-500 hover:text-slate-300"
            }`}
          >
            {isVaultLocked ? (
              <Lock className="h-3.5 w-3.5 text-teal-400" />
            ) : (
              <Unlock className="h-3.5 w-3.5 text-slate-500" />
            )}
            <span>Zero-Knowledge Vault {isVaultLocked ? "LOCKED" : "UNLOCKED"}</span>
          </button>

          {/* Geolocation Tagging Button & Modal Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowLocationPicker(!showLocationPicker)}
              title="Tag this reflection with physical geolocation"
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                locationTag
                  ? "border-teal-500/40 bg-teal-950/40 text-teal-300"
                  : "border-white/10 bg-[#111] text-slate-500 hover:text-slate-300"
              }`}
            >
              <MapPin className="h-3.5 w-3.5 text-teal-400" />
              <span>{locationTag ? (locationTag.city || locationTag.placeName || "Pinned") : "Tag Location"}</span>
            </button>

            {showLocationPicker && (
              <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-teal-500/30 bg-[#0d1017] p-3 shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                  <span className="text-xs font-mono font-semibold text-white">Geotag Memory</span>
                  <button
                    onClick={() => setShowLocationPicker(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    ×
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDetectGPS}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500 transition mb-2.5"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Auto-Detect Current GPS</span>
                </button>

                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                  Preset Global Hubs:
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {PRESET_LOCATIONS.map((loc) => (
                    <button
                      key={loc.name}
                      type="button"
                      onClick={() => {
                        setLocationTag({
                          latitude: loc.lat,
                          longitude: loc.lng,
                          city: loc.city,
                          country: loc.country,
                          placeName: loc.name
                        });
                        setShowLocationPicker(false);
                      }}
                      className="w-full text-left flex items-center justify-between rounded-md p-1.5 text-[11px] text-slate-300 hover:bg-white/10 transition"
                    >
                      <span className="truncate">{loc.city}, {loc.country}</span>
                      <span className="text-[9px] font-mono text-teal-400">Select</span>
                    </button>
                  ))}
                </div>

                {locationTag && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocationTag(null);
                      setShowLocationPicker(false);
                    }}
                    className="mt-2 w-full text-center text-[10px] font-mono text-rose-400 hover:underline"
                  >
                    Remove Location Tag
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Reset Action */}
          <button
            onClick={handleResetSession}
            title="Clear and start new session"
            className="flex items-center gap-1 rounded-full border border-white/10 bg-[#111] px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Mode Selector Horizontal Scroll */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {MODES.map((m) => {
          const isSelected = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex flex-col items-start rounded-lg border p-3.5 text-left transition-all ${
                isSelected
                  ? `bg-teal-900/20 border-teal-500/40 text-teal-200 shadow-[0_0_12px_rgba(20,184,166,0.2)]`
                  : "border-white/5 bg-[#0a0a0a] text-slate-400 hover:border-white/15 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={isSelected ? "text-teal-300" : "text-slate-500"}>
                  {m.icon}
                </span>
                <span className={`text-xs font-semibold ${isSelected ? "text-white" : "text-slate-300"}`}>
                  {m.label}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">
                {m.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Passcode Modal for Vault Lock */}
      {showPasscodePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-teal-500/30 bg-[#0c0c0c] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-950/60 text-teal-300 border border-teal-500/20">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Client-Side Vault Passcode</h3>
                <p className="text-xs text-slate-400">WebCrypto AES-256-GCM Encryption</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-300">
              Your passcode derives a private AES key in browser RAM. Firestore will only store encrypted ciphertext.
            </p>
            <input
              type="password"
              value={vaultPasscode}
              onChange={(e) => setVaultPasscode(e.target.value)}
              placeholder="Enter 4+ digit PIN or passphrase"
              className="mt-4 w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:border-teal-500/50 focus:outline-none"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowPasscodePrompt(false);
                  setIsVaultLocked(false);
                  setVaultPasscode("");
                }}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (vaultPasscode.length >= 4) {
                    setIsVaultLocked(true);
                    setShowPasscodePrompt(false);
                  } else {
                    alert("Passcode must be at least 4 characters.");
                  }
                }}
                className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
              >
                Lock Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Grid (Chat on Left, Live Summary on Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Multi-turn Chat Conversation (7 Cols on LG) */}
        <div className="flex flex-col rounded-xl border border-white/10 bg-[#080808] shadow-2xl lg:col-span-7">
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-teal-400" />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">
                Gemini Thought Partner
              </span>
              {isQuotaNoticeVisible ? (
                <span className="rounded-full bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  Offline Cognitive Mode
                </span>
              ) : (
                <span className="rounded-full bg-teal-950/60 border border-teal-500/30 px-2 py-0.5 text-[10px] font-semibold text-teal-300">
                  gemini-3.8-flash
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-500 font-mono">
              {messages.length} {messages.length === 1 ? "turn" : "turns"}
            </div>
          </div>

          {/* Quota & Prepayment Notice Banner */}
          {isQuotaNoticeVisible && (
            <div className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-200 animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  <strong>API Notice:</strong> Gemini prepayment credits are depleted for this project. Running in <strong>Offline Cognitive Reflection</strong> mode. Top up credits in AI Studio to re-enable live streaming.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsQuotaNoticeVisible(false)}
                className="ml-2 text-amber-400 hover:text-white text-base leading-none"
              >
                ×
              </button>
            </div>
          )}

          {/* Chat Messages Scrollable Area */}
          <div className="h-[460px] space-y-4 overflow-y-auto p-4 sm:p-6 bg-gradient-to-b from-[#0a0a0a] to-[#050505]">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-[10px] font-semibold ${
                      isUser
                        ? "bg-teal-600 text-white"
                        : "bg-slate-800 text-slate-400 border border-white/10"
                    }`}
                  >
                    {isUser ? "AC" : "G"}
                  </div>

                  <div
                    className={`group relative max-w-[85%] rounded-lg p-4 text-sm leading-relaxed ${
                      isUser
                        ? "rounded-tr-none bg-teal-900/20 border border-teal-500/20 text-white"
                        : "rounded-tl-none bg-white/5 border border-white/5 text-slate-300"
                    }`}
                  >
                    {!isUser ? (
                      <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-teal-200">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Audio Listen Button for Gemini messages */}
                    {!isUser && (
                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/5 pt-2 opacity-75 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleSpeechToggle(msg.id, msg.content)}
                          title={speakingMessageId === msg.id ? "Stop voice reflection" : "Listen to reflection"}
                          className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 hover:text-teal-300"
                        >
                          {speakingMessageId === msg.id ? (
                            <>
                              <VolumeX className="h-3 w-3 text-amber-400" />
                              <span className="text-amber-300">Stop Voice</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3 w-3" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isAiLoading && (
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-800 text-teal-400 border border-white/10">
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                </div>
                <div className="rounded-lg rounded-tl-none border border-white/5 bg-white/5 px-4 py-3 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-teal-400" />
                    <span>Gemini is reflecting...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Contextual Prompts Bar */}
          {suggestedPrompts.length > 0 && (
            <div className="border-t border-white/10 bg-[#050505] px-4 py-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Lightbulb className="h-3 w-3 text-amber-400" />
                <span>Prompt Inquiries:</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
                {suggestedPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p)}
                    className="shrink-0 rounded border border-white/5 bg-white/5 px-2.5 py-1 text-left text-slate-300 transition hover:border-teal-500/40 hover:bg-white/10 hover:text-white"
                  >
                    "{p.slice(0, 50)}..."
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PII Detection Warning Badge */}
          {detectedPiiTypes.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-950/30 border-t border-amber-500/20 px-4 py-1.5 text-xs text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>
                <strong>PII Detected:</strong> {detectedPiiTypes.join(", ")}. Redactor will replace with safe tokens before transmission.
              </span>
            </div>
          )}

          {/* Input Box & Actions */}
          <div className="border-t border-white/10 p-4 bg-[#080808]">
            <div className="relative flex items-center">
              <textarea
                id="journal-chat-input"
                rows={2}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Write to Personal Gemini Journal (Shift+Enter for new line)..."
                className="w-full resize-none rounded-2xl border border-white/10 bg-[#111] py-3 pl-4 pr-24 text-sm text-white placeholder-slate-600 focus:border-teal-500/50 focus:outline-none transition-colors"
              />

              <div className="absolute right-3 flex items-center gap-2">
                {/* Voice Dictation Button */}
                <button
                  onClick={toggleVoiceInput}
                  title={isListening ? "Stop listening" : "Voice dictation"}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                    isListening
                      ? "border-red-500/60 bg-red-950/80 text-red-400 animate-pulse"
                      : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>

                {/* Send Button */}
                <button
                  id="send-chat-btn"
                  onClick={() => handleSendMessage()}
                  disabled={!inputPrompt.trim() || isAiLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white shadow-[0_0_10px_rgba(20,184,166,0.3)] transition hover:bg-teal-500 disabled:opacity-30"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Auto-Summarizer & Structured Insights (5 Cols on LG) */}
        <div className="flex flex-col space-y-4 lg:col-span-5">
          {/* Summarize Action Card */}
          <div className="rounded-xl border border-white/10 bg-[#080808] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-teal-400" />
                <h3 className="font-serif italic text-lg font-light tracking-tight text-white">
                  Cognitive Synthesis
                </h3>
              </div>

              <button
                id="summarize-btn"
                onClick={handleGenerateSummary}
                disabled={isSummarizing || messages.length < 2}
                className="flex items-center gap-1.5 rounded-full bg-teal-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-[0_0_10px_rgba(20,184,166,0.3)] transition hover:bg-teal-500 disabled:opacity-30"
              >
                <Sparkles className={`h-3.5 w-3.5 ${isSummarizing ? "animate-spin" : ""}`} />
                <span>{isSummarizing ? "Synthesizing..." : "Extract Insights"}</span>
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Gemini distills your dialogue into an executive summary, sentiment score, mood tag, key breakthroughs, and actionable commitments.
            </p>

            {/* Structured Insights Display */}
            {insights ? (
              <div className="mt-4 space-y-4 rounded-lg border border-white/5 bg-white/5 p-4 text-xs">
                {/* Mood & Sentiment Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Mood State:</span>
                    <span className="rounded-full border border-teal-500/30 bg-teal-950/60 px-2.5 py-0.5 font-bold text-teal-300">
                      {insights.moodTag}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Sentiment:</span>
                    <span
                      className={`font-mono font-bold ${
                        insights.sentimentScore > 0.2
                          ? "text-emerald-400"
                          : insights.sentimentScore < -0.2
                          ? "text-rose-400"
                          : "text-amber-400"
                      }`}
                    >
                      {insights.sentimentScore > 0 ? "+" : ""}
                      {insights.sentimentScore.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Executive Summary */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Executive Summary
                  </span>
                  <p className="mt-1 leading-relaxed text-slate-300">
                    {insights.summary}
                  </p>
                </div>

                {/* Key Insights / Breakthroughs */}
                {insights.keyInsights?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Key Breakthroughs
                    </span>
                    <ul className="mt-1.5 space-y-1">
                      {insights.keyInsights.map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-slate-300">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Items */}
                {insights.actionItems?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Action Commitments
                    </span>
                    <ul className="mt-1.5 space-y-1">
                      {insights.actionItems.map((action, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-slate-300">
                          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" />
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Growth Reframing Quote */}
                {insights.cognitiveReflections && (
                  <div className="rounded border border-teal-500/20 bg-teal-900/10 p-3 italic text-teal-200/90 leading-relaxed font-serif">
                    "{insights.cognitiveReflections}"
                  </div>
                )}

                {/* Tags */}
                {insights.suggestedTags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {insights.suggestedTags.map((tag, i) => (
                      <span
                        key={i}
                        className="rounded bg-[#111] border border-white/5 px-2 py-0.5 text-[10px] text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Copy Summary Action */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={copySummaryText}
                    className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 hover:text-teal-300"
                  >
                    {copiedSummary ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Summary</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/5 p-6 text-center">
                <BrainCircuit className="h-8 w-8 text-slate-600 mb-2" />
                <p className="text-xs text-slate-400">
                  No insights synthesized yet.
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Reflect with Gemini, then click "Extract Insights" to distill.
                </p>
              </div>
            )}

            {/* Cloud Firestore Save Button */}
            <div className="mt-5 border-t border-white/10 pt-4">
              <button
                id="save-firestore-btn"
                onClick={handleSaveToFirestore}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 font-medium text-white shadow-[0_0_15px_rgba(20,184,166,0.3)] transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40"
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-white" />
                    <span>Saved to Cloud Firestore!</span>
                  </>
                ) : isSaving ? (
                  <span>Syncing with Cloud Firestore...</span>
                ) : (
                  <>
                    <BookmarkCheck className="h-4 w-4" />
                    <span>Save to Isolated Firestore</span>
                  </>
                )}
              </button>
              <p className="mt-2 text-center text-[10px] text-slate-500">
                Data persists exclusively in your protected subcollection under{" "}
                <code className="font-mono text-slate-400">/users/{user?.uid ? user.uid.slice(0, 6) + "..." : "{uid}"}</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
