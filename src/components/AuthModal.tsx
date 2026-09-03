import React, { useState } from "react";
import {
  X,
  Lock,
  Mail,
  KeyRound,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Fingerprint
} from "lucide-react";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signInAsGuest
} from "../lib/firebase";
import { sendAuditLog } from "../lib/securityUtils";
import { UserProfile } from "../types";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleGoogleAuth = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const user = await signInWithGoogle();
      sendAuditLog("AUTH_LOGIN_GOOGLE", user.uid, "SUCCESS", { email: user.email ? "provided" : "none" });
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setErrorMessage(err.message || "Failed to sign in with Google.");
      sendAuditLog("AUTH_LOGIN_GOOGLE_FAIL", "unknown", "ERROR", { error: err.code });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters for security.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      let user: UserProfile;
      if (isRegister) {
        user = await signUpWithEmail(email, password);
        sendAuditLog("AUTH_REGISTER_EMAIL", user.uid, "SUCCESS");
      } else {
        user = await signInWithEmail(email, password);
        sendAuditLog("AUTH_LOGIN_EMAIL", user.uid, "SUCCESS");
      }
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.error("Email Auth Error:", err);
      let msg = err.message || "Authentication failed.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        msg = "Invalid email or password. Please try again or create an account.";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "This email is already registered. Please sign in instead.";
      }
      setErrorMessage(msg);
      sendAuditLog("AUTH_EMAIL_FAIL", "unknown", "DENIED", { code: err.code });
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAuth = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const user = await signInAsGuest();
      sendAuditLog("AUTH_LOGIN_ANONYMOUS_SANDBOX", user.uid, "SUCCESS");
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.error("Guest Auth Error:", err);
      setErrorMessage(err.message || "Failed to start guest session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl ring-1 ring-white/10 sm:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            {isRegister ? "Create Secure Account" : "Access Your Journal Vault"}
          </h2>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            Zero-leakage Cloud Firestore persistence with strict per-user authorization boundaries.
          </p>
        </div>

        {/* Security Guarantee Box */}
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-950/30 p-3 text-left">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div className="text-[11px] leading-relaxed text-emerald-200/90">
            <strong className="font-semibold text-emerald-300">Database Isolation Enforced:</strong> All reflections are strictly stored under <code className="rounded bg-emerald-900/60 px-1 font-mono text-[10px] text-emerald-200">/users/{`{your_uid}`}</code> with Firestore Security Rules rejecting unauthorized access.
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Google One-Click Button */}
        <button
          id="google-signin-btn"
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800/90 py-2.5 px-4 font-semibold text-white shadow-sm transition hover:bg-slate-750 hover:border-slate-600 disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">or email</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                id="auth-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                id="auth-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50"
          >
            {loading ? (
              <span>Processing...</span>
            ) : isRegister ? (
              <>
                <span>Sign Up Securely</span>
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>Sign In to Vault</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Toggle Register / Login */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMessage("");
            }}
            className="text-xs text-indigo-400 transition hover:text-indigo-300"
          >
            {isRegister
              ? "Already have a journal vault? Sign In"
              : "New user? Create a secure account"}
          </button>
        </div>

        {/* Instant Sandbox / Guest Mode */}
        <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
          <button
            type="button"
            onClick={handleGuestAuth}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200"
          >
            <Fingerprint className="h-3.5 w-3.5 text-amber-400" />
            <span>Launch Isolated Guest Sandbox</span>
          </button>
          <p className="mt-1 text-[10px] text-slate-500">
            Assigns an isolated cryptographic UID instantly without credentials.
          </p>
        </div>
      </div>
    </div>
  );
};
