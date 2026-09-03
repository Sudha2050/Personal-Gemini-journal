/**
 * Security & Cryptographic Utilities
 * Principle: Privacy by Design, Client-Side Encryption, and PII Sanitization
 */

import { JournalEntry } from "../types";

// 1. PII Detection and Redaction
export interface PiiDetectionResult {
  hasPii: boolean;
  detectedTypes: string[];
  sanitizedText: string;
}

export function detectAndSanitizePii(text: string): PiiDetectionResult {
  if (!text) return { hasPii: false, detectedTypes: [], sanitizedText: "" };

  const detectedTypes: string[] = [];
  let sanitized = text;

  // Email pattern
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  if (emailRegex.test(text)) {
    detectedTypes.push("Email Address");
    sanitized = sanitized.replace(emailRegex, "[REDACTED_EMAIL]");
  }

  // Phone pattern
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  if (phoneRegex.test(text)) {
    detectedTypes.push("Phone Number");
    sanitized = sanitized.replace(phoneRegex, "[REDACTED_PHONE]");
  }

  // SSN pattern
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  if (ssnRegex.test(text)) {
    detectedTypes.push("Social Security Number");
    sanitized = sanitized.replace(ssnRegex, "[REDACTED_SSN]");
  }

  // Credit Card pattern
  const ccRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
  if (ccRegex.test(text)) {
    detectedTypes.push("Credit Card Number");
    sanitized = sanitized.replace(ccRegex, "[REDACTED_CARD]");
  }

  return {
    hasPii: detectedTypes.length > 0,
    detectedTypes,
    sanitizedText: sanitized
  };
}

// 2. Client-Side WebCrypto AES-GCM Encryption for Zero-Knowledge Vault
const SALT = new TextEncoder().encode("gemini-journal-secure-salt-v1");

async function getKeyFromPasscode(passcode: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: SALT,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJournalPayload(payload: object, passcode: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await getKeyFromPasscode(passcode);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(JSON.stringify(payload));

  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedData
  );

  // Convert buffer to base64
  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));
  const ivStr = btoa(String.fromCharCode(...iv));

  return { ciphertext, iv: ivStr };
}

export async function decryptJournalPayload<T = any>(ciphertext: string, ivStr: string, passcode: string): Promise<T> {
  const key = await getKeyFromPasscode(passcode);
  const iv = new Uint8Array(atob(ivStr).split("").map((c) => c.charCodeAt(0)));
  const cipherBuffer = new Uint8Array(atob(ciphertext).split("").map((c) => c.charCodeAt(0)));

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherBuffer
  );

  const decodedStr = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(decodedStr);
}

// 3. Security Audit Event Reporter
export async function sendAuditLog(eventType: string, actorId: string, status: "SUCCESS" | "DENIED" | "ERROR", details: Record<string, unknown> = {}) {
  try {
    await fetch("/api/security/audit-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, actorId, status, details })
    });
  } catch (err) {
    console.warn("[Audit Log Report Failed]:", err);
  }
}

// 4. Data Export Utilities (GDPR Compliance)
export function exportEntriesAsJson(entries: JournalEntry[], userEmail: string) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entries, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  const dateStr = new Date().toISOString().split("T")[0];
  downloadAnchor.setAttribute("download", `gemini-journal-backup-${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportEntriesAsMarkdown(entries: JournalEntry[]): string {
  let md = `# Personal Gemini Journal Archive\n\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;

  entries.forEach((entry, idx) => {
    md += `## ${idx + 1}. ${entry.title || "Untitled Session"}\n`;
    md += `**Date:** ${new Date(entry.createdAt).toLocaleString()} | **Mode:** ${entry.mode.toUpperCase()}\n`;
    if (entry.tags && entry.tags.length > 0) {
      md += `**Tags:** ${entry.tags.join(" ")}\n`;
    }
    if (entry.insights) {
      md += `\n### AI Summary\n${entry.insights.summary}\n\n`;
      md += `**Mood:** ${entry.insights.moodTag} (Sentiment Score: ${entry.insights.sentimentScore > 0 ? "+" : ""}${entry.insights.sentimentScore.toFixed(2)})\n\n`;
      md += `#### Key Takeaways:\n`;
      entry.insights.keyInsights.forEach((item) => {
        md += `- ${item}\n`;
      });
      if (entry.insights.actionItems?.length) {
        md += `\n#### Action Items:\n`;
        entry.insights.actionItems.forEach((item) => {
          md += `- [ ] ${item}\n`;
        });
      }
      if (entry.insights.cognitiveReflections) {
        md += `\n> *Cognitive Reflection:* ${entry.insights.cognitiveReflections}\n\n`;
      }
    }

    if (entry.messages && entry.messages.length > 0 && !entry.isEncryptedVault) {
      md += `\n### Conversation History\n`;
      entry.messages.forEach((msg) => {
        md += `**${msg.role === "user" ? "You" : "Gemini"}:** ${msg.content}\n\n`;
      });
    }

    md += `\n---\n\n`;
  });

  return md;
}

// 5. Speech Synthesis Audio Reflection
export function speakText(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel(); // Stop prior playback

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Try selecting a natural sounding English voice
  const voices = window.speechSynthesis.getVoices();
  const naturalVoice = voices.find(
    (v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Premium") || v.name.includes("Samantha"))
  ) || voices.find((v) => v.lang.startsWith("en"));

  if (naturalVoice) {
    utterance.voice = naturalVoice;
  }

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
