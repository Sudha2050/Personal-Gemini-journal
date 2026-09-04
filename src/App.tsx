import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, mapUser, signOutUser, subscribeToUserEntries, signInAsGuest } from "./lib/firebase";
import { UserProfile, JournalEntry } from "./types";
import { Header, NavTabType } from "./components/Header";
import { JournalWorkspace } from "./components/JournalWorkspace";
import { JournalArchive } from "./components/JournalArchive";
import { LifeMapExplorer } from "./components/LifeMapExplorer";
import { LifeRewindDeck } from "./components/LifeRewindDeck";
import { ProfessionalWellbeing } from "./components/ProfessionalWellbeing";
import { InsightsDashboard } from "./components/InsightsDashboard";
import { SecurityInspector } from "./components/SecurityInspector";
import { SmartHabitRemindersModal } from "./components/SmartHabitRemindersModal";
import { RBACSharingModal } from "./components/RBACSharingModal";
import { AuthModal } from "./components/AuthModal";
import { sendAuditLog } from "./lib/securityUtils";
import { ShieldCheck, Sparkles, KeyRound, Lock, Bell, Users, Globe, Briefcase } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRemindersModalOpen, setIsRemindersModalOpen] = useState(false);
  const [isRbacModalOpen, setIsRbacModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTabType>("workspace");
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  // 1. Subscribe to Firebase Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = mapUser(firebaseUser);
        setUser(profile);
      } else {
        // If not logged in, automatically start an isolated anonymous session so users can immediately test Firestore
        try {
          const guestProfile = await signInAsGuest();
          setUser(guestProfile);
        } catch (e) {
          console.warn("Guest sign-in fallback:", e);
          setUser(null);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Subscribe to Firestore Isolated Subcollection for Authenticated User
  useEffect(() => {
    if (!user?.uid) {
      setEntries([]);
      return;
    }

    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (fetchedEntries) => {
        setEntries(fetchedEntries);
      },
      (error) => {
        console.error("Firestore Subscription Error:", error);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleSignOut = async () => {
    if (user?.uid) {
      sendAuditLog("AUTH_LOGOUT", user.uid, "SUCCESS");
    }
    await signOutUser();
    setUser(null);
    setEntries([]);
    setIsAuthModalOpen(true);
  };

  const handleEntrySaved = (newEntry: JournalEntry) => {
    // Firestore listener will automatically update state
  };

  const handleDataPurged = () => {
    setEntries([]);
  };

  const handleQuickThoughtSaved = (entry: any) => {
    // Switch to workspace or archive to view
  };

  return (
    <div className="min-h-screen bg-[#050505] font-sans text-[#d1d5db] flex flex-col justify-between selection:bg-teal-900 selection:text-teal-200">
      <div>
        {/* Navigation & Header */}
        <Header
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onSignOut={handleSignOut}
          entriesCount={entries.length}
          onOpenRemindersModal={() => setIsRemindersModalOpen(true)}
          onOpenRbacModal={() => setIsRbacModalOpen(true)}
        />

        {/* Global Security Banner on Guest Mode */}
        {user?.isAnonymous && (
          <div className="bg-gradient-to-r from-teal-950/30 via-emerald-950/20 to-[#050505] border-b border-teal-500/20 px-4 py-2 text-center text-xs text-teal-200/90 flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>
              Operating in <strong>Isolated Vault</strong> (UID: <code className="font-mono text-emerald-300">{user.uid.slice(0, 8)}...</code>). Data strictly isolated.
            </span>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="ml-2 underline font-medium text-white hover:text-teal-300"
            >
              Sign In to sync across devices
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="pb-16 bg-gradient-to-b from-[#0a0a0a] to-[#050505]">
          {authLoading ? (
            <div className="flex h-96 flex-col items-center justify-center space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
              <p className="text-xs text-slate-500 font-mono">Verifying security boundaries...</p>
            </div>
          ) : (
            <>
              {activeTab === "workspace" && (
                <JournalWorkspace
                  user={user}
                  onOpenAuth={() => setIsAuthModalOpen(true)}
                  onEntrySaved={handleEntrySaved}
                />
              )}

              {activeTab === "archive" && (
                <JournalArchive
                  entries={entries}
                  userId={user?.uid || ""}
                />
              )}

              {activeTab === "map" && (
                <LifeMapExplorer
                  entries={entries}
                  onSelectEntry={(e) => {
                    setActiveTab("archive");
                  }}
                />
              )}

              {activeTab === "rewind" && (
                <LifeRewindDeck
                  entries={entries}
                  userId={user?.uid || ""}
                />
              )}

              {activeTab === "wellbeing" && (
                <ProfessionalWellbeing
                  entries={entries}
                  userId={user?.uid || ""}
                  onQuickThoughtSaved={handleQuickThoughtSaved}
                />
              )}

              {activeTab === "insights" && (
                <InsightsDashboard
                  entries={entries}
                  userId={user?.uid || ""}
                />
              )}

              {activeTab === "security" && (
                <SecurityInspector
                  user={user}
                  entries={entries}
                  onDataPurged={handleDataPurged}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => setIsAuthModalOpen(false)}
      />

      <SmartHabitRemindersModal
        isOpen={isRemindersModalOpen}
        onClose={() => setIsRemindersModalOpen(false)}
        userId={user?.uid || ""}
        lastJournaledTimestamp={entries[0]?.createdAt}
      />

      <RBACSharingModal
        isOpen={isRbacModalOpen}
        onClose={() => setIsRbacModalOpen(false)}
        userId={user?.uid || ""}
      />

      {/* Global Footer */}
      <footer className="border-t border-white/10 bg-[#080808] py-6 px-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-medium tracking-wider uppercase text-[11px] text-slate-400">Personal Gemini Journal</span>
            <span>•</span>
            <span className="text-teal-400">Google AI Studio Ideathon</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="text-emerald-400">Cloud Firestore RLS Enforced</span>
            <span>•</span>
            <span className="text-teal-300">Gemini 3.7 Flash</span>
            <span>•</span>
            <span className="text-slate-400">Zero-Knowledge AES-256</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
