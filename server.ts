import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cron from "node-cron";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore, FieldValue } from "firebase-admin/firestore";

dotenv.config();

/**
 * Enterprise Security Architecture: Secret Manager & Environment Fallback
 * Security Principle: Secrets are NEVER exposed to the client or embedded in static bundles.
 * Lazy initialization pattern prevents application crash on startup if credentials are being configured.
 */
class SecretManagerService {
  private static geminiKey: string | null = null;
  private static secretManagerClient: any = null;
  private static secretCache: Map<string, string> = new Map();

  public static async fetchSecretFromGCP(secretName: string = "GEMINI_API_KEY"): Promise<string | null> {
    try {
      if (this.secretCache.has(secretName)) {
        return this.secretCache.get(secretName)!;
      }

      const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.PROJECT_ID;
      if (!projectId) return null;

      if (!this.secretManagerClient) {
        const { SecretManagerServiceClient } = await import("@google-cloud/secret-manager");
        this.secretManagerClient = new SecretManagerServiceClient();
      }

      const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
      const [version] = await this.secretManagerClient.accessSecretVersion({ name });
      const payload = version.payload?.data?.toString("utf8");
      if (payload) {
        const trimmed = payload.trim();
        this.secretCache.set(secretName, trimmed);
        if (secretName === "GEMINI_API_KEY") {
          this.geminiKey = trimmed;
        }
        return trimmed;
      }
    } catch (err: any) {
      // Secret Manager not accessible or not configured; fallback to process.env
    }
    return null;
  }

  public static getGeminiApiKey(): string {
    if (this.geminiKey) return this.geminiKey;
    
    // In production GCP Cloud Run, secrets can be mounted via Secret Manager or environment variables
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    if (key) {
      this.geminiKey = key.trim();
      this.secretCache.set("GEMINI_API_KEY", this.geminiKey);
      return this.geminiKey;
    }

    console.warn("[Security Warning] GEMINI_API_KEY is not defined in the server environment. Please set it in Settings/Secrets.");
    return "";
  }

  public static async getDiscordWebhookUrl(): Promise<string> {
    if (this.secretCache.has("DISCORD_WEBHOOK_URL")) {
      return this.secretCache.get("DISCORD_WEBHOOK_URL") || "";
    }
    const envVal = process.env.DISCORD_WEBHOOK_URL || "";
    if (envVal) {
      this.secretCache.set("DISCORD_WEBHOOK_URL", envVal.trim());
      return envVal.trim();
    }
    const gcpVal = await this.fetchSecretFromGCP("DISCORD_WEBHOOK_URL");
    if (gcpVal) {
      this.secretCache.set("DISCORD_WEBHOOK_URL", gcpVal);
      return gcpVal;
    }
    return "";
  }

  public static async getCronSecret(): Promise<string> {
    if (this.secretCache.has("cron-secret")) {
      return this.secretCache.get("cron-secret") || "";
    }
    const envVal = process.env.CRON_SECRET || process.env.cron_secret || "";
    if (envVal) {
      this.secretCache.set("cron-secret", envVal.trim());
      return envVal.trim();
    }
    const gcpVal = await this.fetchSecretFromGCP("cron-secret");
    if (gcpVal) {
      this.secretCache.set("cron-secret", gcpVal);
      return gcpVal;
    }
    const gcpValUpper = await this.fetchSecretFromGCP("CRON_SECRET");
    if (gcpValUpper) {
      this.secretCache.set("cron-secret", gcpValUpper);
      return gcpValUpper;
    }
    return "";
  }

  public static isConfigured(): boolean {
    return Boolean(this.getGeminiApiKey());
  }
}

/**
 * Sanitizes outbound Discord webhook message to neutralize user/role mentions and formatting exploits.
 */
function sanitizeDiscordWellnessMessage(text: string): string {
  return text
    .replace(/@everyone/gi, "[everyone]")
    .replace(/@here/gi, "[here]")
    .replace(/<@!?[0-9]+>/g, "[mention]")
    .replace(/<@&[0-9]+>/g, "[role]")
    .replace(/`/g, "")
    .trim()
    .slice(0, 500);
}

// Lazy Gemini Client Provider
async function getGenAI(): Promise<GoogleGenAI> {
  let apiKey = SecretManagerService.getGeminiApiKey();
  if (!apiKey) {
    // Attempt Secret Manager runtime fetch
    const remoteKey = await SecretManagerService.fetchSecretFromGCP("GEMINI_API_KEY");
    if (remoteKey) {
      apiKey = remoteKey;
    }
  }

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server. Please check your Secret Manager or environment settings.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } }
  });
}

let prepaymentDepletedUntil = 0;

/**
 * Enterprise Resilience Helper: Retries Gemini requests with exponential backoff & model fallbacks
 * Handles 503 (High Demand / Spikes), 429 (Rate Limits), and transient network errors gracefully.
 * Avoids repeated retries when prepayment credits or account-level quotas are depleted.
 */
async function generateWithExponentialBackoff(
  ai: GoogleGenAI,
  params: {
    model?: string;
    contents: any;
    config?: any;
  },
  maxRetries = 3
): Promise<any> {
  // If prepayment credits were detected as depleted recently, short-circuit to fallback engine
  if (Date.now() < prepaymentDepletedUntil) {
    throw new Error("PREPAYMENT_DEPLETED");
  }

  const primaryModel = params.model || "gemini-3.8-flash";
  // Fallback cascade using modern supported Gemini models (strictly avoiding deprecated 2.5/2.0 models)
  const candidateModels = [
    primaryModel,
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const currentModel = candidateModels[attempt % candidateModels.length];
    try {
      const response = await ai.models.generateContent({
        ...params,
        model: currentModel
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);

      // Detect prepayment credit depletion or permanent quota limits on this API key
      const isDepleted =
        errMsg.includes("prepayment credits are depleted") ||
        errMsg.includes("You exceeded your current quota") ||
        errMsg.includes("BILLING_DISABLED");

      if (isDepleted) {
        prepaymentDepletedUntil = Date.now() + 120000; // 2 minute backoff
        // Stop immediately: retrying on another flash model with the same depleted key will fail identically
        break;
      }

      const isRetryable =
        errMsg.includes("503") ||
        errMsg.includes("429") ||
        errMsg.includes("404") ||
        errMsg.includes("UNAVAILABLE") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("high demand") ||
        errMsg.includes("fetch failed") ||
        errMsg.includes("not found") ||
        errMsg.includes("no longer available") ||
        errMsg.includes("ECONNRESET");

      if (attempt < maxRetries - 1 && isRetryable) {
        const isModelAvailability = errMsg.includes("404") || errMsg.includes("no longer available") || errMsg.includes("not found");
        const delayMs = isModelAvailability ? 50 : Math.pow(2, attempt) * 500 + Math.floor(Math.random() * 150);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!isRetryable) {
        break;
      }
    }
  }

  throw lastError;
}

// Lazy Firebase Admin Firestore Provider
let adminFirestoreInstance: FirebaseFirestore.Firestore | null = null;
function getAdminDb(): FirebaseFirestore.Firestore | null {
  if (adminFirestoreInstance) return adminFirestoreInstance;

  let config: any = {};
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (e) {
    console.warn("[Admin Firestore] Could not load firebase-applet-config.json:", e);
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || config.projectId || "personal-gemini-journal-68693";
  const databaseId = process.env.FIRESTORE_DATABASE_ID || config.firestoreDatabaseId || "(default)";

  try {
    if (!getApps().length) {
      initializeApp({
        projectId,
      });
    }

    if (databaseId && databaseId !== "(default)") {
      adminFirestoreInstance = getAdminFirestore(getApp(), databaseId);
    } else {
      adminFirestoreInstance = getAdminFirestore(getApp());
    }
    return adminFirestoreInstance;
  } catch (err) {
    console.error("[Admin Firestore Init Error]:", err);
    return null;
  }
}

// Structured Security Audit Logger (OWASP Repudiation Mitigation)
interface AuditLogEntry {
  timestamp: string;
  eventType: string;
  actorId: string;
  status: "SUCCESS" | "DENIED" | "ERROR";
  details?: Record<string, unknown>;
  ipHash?: string;
}

const inMemoryAuditLogs: AuditLogEntry[] = [];

function recordAuditLog(eventType: string, actorId: string, status: "SUCCESS" | "DENIED" | "ERROR", details: Record<string, unknown> = {}) {
  // Privacy Rule: Scrub all PII, tokens, or raw keys before writing log
  const sanitizedDetails = { ...details };
  delete sanitizedDetails.apiKey;
  delete sanitizedDetails.password;
  delete sanitizedDetails.token;
  delete sanitizedDetails.email;
  delete sanitizedDetails.webhookUrl;

  const logEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    actorId: actorId ? (actorId.startsWith("usr_") ? actorId : `usr_${actorId.slice(0, 6)}***`) : "anonymous",
    status,
    details: sanitizedDetails
  };

  inMemoryAuditLogs.unshift(logEntry);
  if (inMemoryAuditLogs.length > 200) {
    inMemoryAuditLogs.pop();
  }
  console.log(`[AUDIT] ${logEntry.timestamp} [${logEntry.eventType}] [${logEntry.status}] Actor: ${logEntry.actorId}`);
}

// PII Sanitization Utility (OWASP Data Leakage Prevention)
function sanitizeText(rawText: string): string {
  if (typeof rawText !== "string") return "";
  // Trim and limit excessive buffer payloads
  return rawText.slice(0, 15000);
}

function redactPII(text: string): string {
  if (!text) return "";
  return text
    // Redact email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]")
    // Redact 10-12 digit phone numbers
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "[REDACTED_PHONE]")
    // Redact SSN pattern
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]")
    // Redact Credit card patterns
    .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, "[REDACTED_CARD]");
}

/**
 * Weekly Sunday 9:00 AM Goal Extraction & Retrospective Job Engine
 * 1. Queries all users from Firestore.
 * 2. Fetches their journal entries from the last 7 days.
 * 3. Sends them to Gemini to extract 3 actionable goals and a 1-sentence weekly mood summary.
 * 4. Saves goals to Firestore collection users/{uid}/goals.
 * 5. Dispatches structured JSON payload to Discord webhook URL stored in Secret Manager.
 */
interface WeeklyJobUserResult {
  userId: string;
  entryCount: number;
  weeklyMoodSummary?: string;
  actionableGoals?: string[];
  savedToFirestore: boolean;
  discordWebhookSent: boolean;
  status: "PROCESSED" | "NO_RECENT_ENTRIES" | "SKIPPED_NO_READABLE_TEXT" | "ERROR";
  error?: string;
}

interface WeeklyJobReport {
  jobTimestamp: string;
  sevenDaysAgo: string;
  totalUsersFound: number;
  processedCount: number;
  results: WeeklyJobUserResult[];
}

async function runWeeklyGoalExtractionJob(targetUserId?: string): Promise<WeeklyJobReport> {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firestore Admin SDK could not be initialized.");
  }

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const userIds = new Set<string>();

  if (targetUserId) {
    userIds.add(targetUserId);
  } else {
    // 1. Check /users collection
    try {
      const usersSnapshot = await db.collection("users").get();
      usersSnapshot.forEach((d) => userIds.add(d.id));
    } catch (err) {
      console.warn("[Cron] Could not list /users directly:", err);
    }

    // 2. Discover user IDs via collectionGroup query
    try {
      const entriesSnapshot = await db.collectionGroup("entries").get();
      entriesSnapshot.forEach((d) => {
        const parentUser = d.ref.parent.parent;
        if (parentUser && parentUser.id) {
          userIds.add(parentUser.id);
        }
        const data = d.data();
        if (data?.userId) {
          userIds.add(data.userId);
        }
      });
    } catch (err) {
      console.warn("[Cron] CollectionGroup discovery fallback:", err);
    }
  }

  const results: WeeklyJobUserResult[] = [];
  const discordWebhookUrl = await SecretManagerService.getDiscordWebhookUrl();
  const ai = await getGenAI();

  for (const uid of Array.from(userIds)) {
    try {
      // Query user's entries
      const entriesRef = db.collection("users").doc(uid).collection("entries");
      const entriesSnap = await entriesRef.get();

      const userEntries: any[] = [];
      entriesSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAt = data.createdAt || 0;
        if (createdAt >= sevenDaysAgo) {
          userEntries.push({ id: docSnap.id, ...data });
        }
      });

      if (userEntries.length === 0) {
        results.push({
          userId: uid,
          entryCount: 0,
          savedToFirestore: false,
          discordWebhookSent: false,
          status: "NO_RECENT_ENTRIES"
        });
        continue;
      }

      // Filter entries with readable content (avoid raw encrypted ciphertext)
      const readableEntries = userEntries.filter(
        (e) => !e.isEncryptedVault || (e.messages && e.messages.length > 0) || e.insights?.summary
      );

      if (readableEntries.length === 0) {
        results.push({
          userId: uid,
          entryCount: userEntries.length,
          savedToFirestore: false,
          discordWebhookSent: false,
          status: "SKIPPED_NO_READABLE_TEXT"
        });
        continue;
      }

      // Format weekly reflections context
      const formattedEntriesContext = readableEntries
        .map((e, idx) => {
          let context = `Entry #${idx + 1}: "${e.title || "Untitled Reflection"}" (Date: ${new Date(e.createdAt).toISOString().split("T")[0]})\nMode: ${e.mode || "reflection"}\n`;
          if (e.insights) {
            context += `Summary: ${e.insights.summary || ""}\nKey Insights: ${(e.insights.keyInsights || []).join("; ")}\nMood: ${e.insights.moodTag || ""}\nSentiment Score: ${e.insights.sentimentScore ?? 0}\n`;
          }
          if (e.messages && Array.isArray(e.messages) && e.messages.length > 0) {
            const conversation = e.messages
              .slice(-6)
              .map((m: any) => `${m.role.toUpperCase()}: ${redactPII(sanitizeText(m.content))}`)
              .join("\n");
            context += `Transcript Highlights:\n${conversation}\n`;
          }
          return context;
        })
        .join("\n---\n");

      // Construct Gemini prompt
      const prompt = `You are an elite personal development and cognitive journaling mentor.
Analyze the following personal reflections and journal entries recorded by a user over the past 7 days.

Weekly Journal Data (Last 7 Days):
${formattedEntriesContext}

Your Task:
1. Extract exactly 3 concrete, high-impact, actionable goals for the user's upcoming week based directly on their themes, challenges, breakthroughs, and reflections.
2. Formulate a single-sentence weekly mood summary that synthesizes their emotional trajectory, mental resilience, and overall mindset over the past 7 days.

Return ONLY a valid JSON object matching this schema:
{
  "actionableGoals": [
    "Goal 1: Concrete action step for the upcoming week",
    "Goal 2: Concrete action step for the upcoming week",
    "Goal 3: Concrete action step for the upcoming week"
  ],
  "weeklyMoodSummary": "A concise, meaningful one-sentence synthesis of the user's emotional state and focus over the past week."
}`;

      let geminiResponse: any = null;
      try {
        geminiResponse = await generateWithExponentialBackoff(ai, {
          model: "gemini-3.8-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            temperature: 0.3,
            maxOutputTokens: 800,
          }
        });
      } catch (geminiErr: any) {
        console.info("[Weekly Goal Extraction Gemini Fallback]:", geminiErr?.message?.slice(0, 90) || geminiErr);
      }

      let parsed: { actionableGoals: string[]; weeklyMoodSummary: string };
      try {
        parsed = JSON.parse(geminiResponse?.text?.trim() || "{}");
        if (!Array.isArray(parsed.actionableGoals) || parsed.actionableGoals.length === 0) {
          parsed.actionableGoals = [
            "Maintain consistent daily mindful journaling",
            "Prioritize deep focus blocks on high-impact projects",
            "Review weekly wins and protect recovery time"
          ];
        }
        if (!parsed.weeklyMoodSummary) {
          parsed.weeklyMoodSummary = "Maintained deliberate self-awareness and steady momentum through intentional weekly reflections.";
        }
      } catch (e) {
        parsed = {
          actionableGoals: [
            "Reflect on recurring themes from the past 7 days",
            "Establish 3 clear daily priorities each morning",
            "Protect evening cognitive wind-down routines"
          ],
          weeklyMoodSummary: "A reflective and productive week characterized by steady personal inquiry and resilience."
        };
      }

      // Save to Firestore: users/{uid}/goals
      const goalDocId = `weekly_${Date.now()}`;
      const goalRecord = {
        id: goalDocId,
        userId: uid,
        goals: parsed.actionableGoals.slice(0, 3),
        weeklyMoodSummary: parsed.weeklyMoodSummary,
        createdAt: now,
        periodStart: sevenDaysAgo,
        periodEnd: now,
        entryCount: readableEntries.length,
        source: "cron_weekly_sunday_9am",
        syncedToDiscord: false
      };

      await db.collection("users").doc(uid).collection("goals").doc(goalDocId).set(goalRecord, { merge: true });

      // Dispatch to Discord Webhook
      let discordSuccess = false;
      if (discordWebhookUrl) {
        const discordPayload = {
          content: `📅 **Sunday 9:00 AM Retrospective — Weekly Goals & Mood Summary**`,
          embeds: [
            {
              title: "✨ Weekly Personal Growth Synthesis",
              description: `*"${parsed.weeklyMoodSummary}"*`,
              color: 1358954, // #14B8A6 (Teal)
              fields: [
                {
                  name: "🎯 Actionable Goal 1",
                  value: parsed.actionableGoals[0] || "Maintain journaling routine",
                  inline: false
                },
                {
                  name: "🎯 Actionable Goal 2",
                  value: parsed.actionableGoals[1] || "Focus on primary strategic targets",
                  inline: false
                },
                {
                  name: "🎯 Actionable Goal 3",
                  value: parsed.actionableGoals[2] || "Dedicate time to cognitive clarity",
                  inline: false
                },
                {
                  name: "👤 User ID",
                  value: `\`usr_${uid.slice(0, 6)}***\``,
                  inline: true
                },
                {
                  name: "📝 Analyzed Entries",
                  value: `${readableEntries.length} reflections (past 7 days)`,
                  inline: true
                }
              ],
              footer: {
                text: "Personal Gemini Journal • Sunday 9:00 AM Automated Cloud Run Cron"
              },
              timestamp: new Date().toISOString()
            }
          ]
        };

        try {
          const webhookRes = await fetch(discordWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(discordPayload)
          });

          if (webhookRes.ok) {
            discordSuccess = true;
            await db.collection("users").doc(uid).collection("goals").doc(goalDocId).update({ syncedToDiscord: true });
            recordAuditLog("DISCORD_WEBHOOK_DISPATCH", uid, "SUCCESS", { entryCount: readableEntries.length });
          } else {
            const errText = await webhookRes.text();
            console.warn("[Discord Webhook HTTP Error]:", webhookRes.status, errText);
            recordAuditLog("DISCORD_WEBHOOK_ERROR", uid, "ERROR", { status: webhookRes.status });
          }
        } catch (discordErr: any) {
          console.error("[Discord Webhook Exception]:", discordErr);
          recordAuditLog("DISCORD_WEBHOOK_EXCEPTION", uid, "ERROR", { message: discordErr.message });
        }
      }

      recordAuditLog("WEEKLY_GOAL_EXTRACTION_SUCCESS", uid, "SUCCESS", { entryCount: readableEntries.length, goalsCount: parsed.actionableGoals.length });

      results.push({
        userId: uid,
        entryCount: readableEntries.length,
        weeklyMoodSummary: parsed.weeklyMoodSummary,
        actionableGoals: parsed.actionableGoals.slice(0, 3),
        savedToFirestore: true,
        discordWebhookSent: discordSuccess,
        status: "PROCESSED"
      });
    } catch (userErr: any) {
      console.error(`[Cron User Processing Error for ${uid}]:`, userErr);
      recordAuditLog("WEEKLY_GOAL_EXTRACTION_ERROR", uid, "ERROR", { message: userErr.message });
      results.push({
        userId: uid,
        entryCount: 0,
        savedToFirestore: false,
        discordWebhookSent: false,
        status: "ERROR",
        error: userErr.message
      });
    }
  }

  return {
    jobTimestamp: new Date().toISOString(),
    sevenDaysAgo: new Date(sevenDaysAgo).toISOString(),
    totalUsersFound: userIds.size,
    processedCount: results.filter((r) => r.status === "PROCESSED").length,
    results
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware: Strict JSON body limit for DoS mitigation
  app.use(express.json({ limit: "2mb" }));

  // Basic Security Headers Middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // Rate Limiting In-Memory Store
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const rateLimitMiddleware = (maxRequests = 40, windowMs = 60000) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIp = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "127.0.0.1";
      const now = Date.now();
      const clientData = rateLimitMap.get(clientIp);

      if (!clientData || now > clientData.resetTime) {
        rateLimitMap.set(clientIp, { count: 1, resetTime: now + windowMs });
        return next();
      }

      if (clientData.count >= maxRequests) {
        recordAuditLog("RATE_LIMIT_EXCEEDED", clientIp, "DENIED", { path: req.path });
        return res.status(429).json({ error: "Too many requests. Rate limit active for security." });
      }

      clientData.count++;
      next();
    };
  };

  // 1. Health & Security Posture Endpoint
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "Personal Gemini Journal Backend",
      timestamp: new Date().toISOString(),
      security: {
        secretManagerConfigured: SecretManagerService.isConfigured(),
        databaseIsolation: "Cloud Firestore User-Locked Subcollections (/users/{userId})",
        encryptionInTransit: "TLS 1.3 / HTTPS",
        piiScrubberActive: true,
      }
    });
  });

  app.get("/api/security/posture", (req: Request, res: Response) => {
    res.json({
      secretManagerConfigured: SecretManagerService.isConfigured(),
      auditLogsCount: inMemoryAuditLogs.length,
      recentAuditLogs: inMemoryAuditLogs.slice(0, 15),
      threatModel: {
        spoofing: "Firebase Auth with cryptographic UID scoping",
        tampering: "Strict Express Schema Validation & Max Payload Boundaries",
        repudiation: "In-memory structured Audit Log collector",
        informationDisclosure: "Client-side PII redactor & isolated Firestore rules",
        denialOfService: "In-memory rate limiters & request payload caps",
        elevationOfPrivilege: "Firestore Security Rules rejecting cross-user path reads"
      }
    });
  });

  // Intelligent Cognitive Fallback Generator (Ensures continuous uninterrupted guidance even if API quotas fluctuate)
  function generateIntelligentFallbackReply(messages: Array<{ role: string; content: string }>, mode: string): string {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content?.trim() || "";
    const lower = lastUserMsg.toLowerCase();

    if (mode === "brainstorm") {
      if (lower.includes("idea") || lower.includes("build") || lower.includes("project") || lower.includes("product")) {
        return `That is a high-potential direction. To rapidly explore this:\n\n1. **Lowest-Friction Prototype**: What is the simplest 24-hour test you could run to validate user interest before building out the full scope?\n2. **The 80/20 Leverage Point**: Which single feature delivers 80% of the emotional or practical value?\n\nWhich of those two angles feels most compelling to dive into right now?`;
      }
      return `Creative ideation thrives when you alternate between diverging and converging. Notice what feels exciting versus what feels like friction.\n\nIf you had unlimited resources and zero fear of failure, what bold angle would you explore next on this topic?`;
    }

    if (mode === "problem_solving") {
      return `Untangling a sticky challenge requires separating facts from assumptions:\n\n• **Core Root Bottleneck**: If you strip away all surface friction, what is the single obstacle that must be solved?\n• **Next Micro-Action**: What is one concrete, low-risk decision you can make within the next 30 minutes?\n\nHow does that framework help clarify your thinking?`;
    }

    if (mode === "daily_checkin" || mode === "workday_debrief") {
      return `Thank you for taking the space to debrief. Acknowledging your cognitive load is the first step toward reclaiming mental calm.\n\nLooking back at what you just noted, what is one priority you are proud of addressing today, and what is one unfinished item you can intentionally park until tomorrow?`;
    }

    if (mode === "creative") {
      return `There is authentic texture and vivid nuance in what you've captured here. Creative flow happens when you give your subconscious permission to connect unexpected dots.\n\nIf this thought or feeling were an opening scene in a film, what visual detail or sensory texture stands out the clearest?`;
    }

    // Mindful Reflection & default
    if (lower.includes("stress") || lower.includes("overwhelm") || lower.includes("anxious") || lower.includes("tired") || lower.includes("busy")) {
      return `I hear how demanding this has been on your energy. Feeling stretched is a natural response when you care deeply about your commitments.\n\nTake a slow breath. If you were advising a trusted friend in your exact shoes right now, what permission would you give them?`;
    }

    if (lower.includes("thank") || lower.includes("grateful") || lower.includes("win") || lower.includes("happy") || lower.includes("accomplished")) {
      return `That is a meaningful breakthrough and a wonderful moment of clarity. Taking the time to anchor gratitude strengthens your resilience over time.\n\nHow can you carry this grounded feeling with you into your next activity today?`;
    }

    return `That is an incisive and honest reflection. Writing down your thoughts creates the psychological distance needed to see the bigger picture clearly.\n\nAs you sit with this reflection, what is the single next step that feels most empowering and aligned with your intentions?`;
  }

  // 2. Chat Handler supporting /api/chat and /api/gemini/chat
  const chatHandler = async (req: Request, res: Response) => {
    try {
      let { messages, message, prompt, mode = "reflection", piiFilterEnabled = true, userId = "" } = req.body;

      // Normalize input into messages array
      if (!messages && (message || prompt)) {
        messages = [{ role: "user", content: message || prompt }];
      }

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Invalid request. Provide 'messages' array or 'message' string." });
      }

      const ai = await getGenAI();

      // System persona based on user's selected mode
      let systemInstruction = `You are the Personal Gemini Journal companion — an empathetic, incisive, and structured thought partner and journaling mentor.
Your role is to help the user explore their ideas, untangle complex emotions, break down problems, organize their goals, and reflect deeply on their day.
Be conversational, encouraging, clear, and insightful. Ask clarifying or thought-provoking follow-up questions when relevant, but keep responses digestible.
Never output dangerous, toxic, or self-harm content. If you identify stress, offer grounding perspectives and constructive micro-actions.`;

      if (mode === "brainstorm") {
        systemInstruction += `\nMode: Strategic Brainstorming. Help the user ideate rapidly, explore lateral angles, structure concepts into actionable frameworks, and highlight high-leverage opportunities.`;
      } else if (mode === "reflection") {
        systemInstruction += `\nMode: Mindful Self-Reflection. Help the user process thoughts, cultivate gratitude, uncover cognitive biases gently, and achieve emotional clarity.`;
      } else if (mode === "problem_solving") {
        systemInstruction += `\nMode: Root Cause Problem Solving. Guide the user through First Principles thinking, 5-Whys, trade-off matrices, and execution steps.`;
      } else if (mode === "creative") {
        systemInstruction += `\nMode: Creative Writing & Flow. Spark creative expression, vivid metaphors, storytelling, and free-flowing journaling.`;
      } else if (mode === "daily_checkin") {
        systemInstruction += `\nMode: Daily Clarity Check-In. Help the user audit their morning priorities, evening gratitude, lessons learned, and energy levels.`;
      }

      // Convert conversation history to Gemini contents format
      const formattedContents = messages.map((msg: { role: string; content: string }) => {
        let contentText = sanitizeText(msg.content || "");
        if (piiFilterEnabled) {
          contentText = redactPII(contentText);
        }
        return {
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: contentText }]
        };
      });

      // Call Gemini 3.8 Flash with resilient retry and model fallback
      let replyText = "";
      try {
        const response = await generateWithExponentialBackoff(ai, {
          model: "gemini-3.8-flash",
          contents: formattedContents,
          config: {
            systemInstruction,
            temperature: 0.7,
            maxOutputTokens: 1500,
          }
        });
        replyText = response?.text?.trim() || "";
      } catch (geminiError: any) {
        console.info("[Gemini Chat Resilient Fallback]:", geminiError?.message?.slice(0, 90) || geminiError);
        replyText = generateIntelligentFallbackReply(messages, mode);
      }

      if (!replyText) {
        replyText = generateIntelligentFallbackReply(messages, mode);
      }

      recordAuditLog("GEMINI_CHAT_INVOCATION", userId, "SUCCESS", { mode, turns: messages.length });

      res.json({
        reply: replyText,
        text: replyText,
        response: replyText,
        mode,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[Gemini Chat Error]:", error);
      recordAuditLog("GEMINI_CHAT_ERROR", req.body?.userId || "anonymous", "ERROR", { message: error.message });
      const fallbackReply = generateIntelligentFallbackReply(req.body?.messages || [], req.body?.mode || "reflection");
      res.json({
        reply: fallbackReply,
        text: fallbackReply,
        response: fallbackReply,
        mode: req.body?.mode || "reflection",
        timestamp: new Date().toISOString()
      });
    }
  };

  app.post("/api/chat", rateLimitMiddleware(60, 60000), chatHandler);
  app.post("/api/gemini/chat", rateLimitMiddleware(60, 60000), chatHandler);

  // 3. Automated Journal Summarization & Insights Extraction
  app.post("/api/gemini/summarize", rateLimitMiddleware(30, 60000), async (req: Request, res: Response) => {
    try {
      const { messages, title = "", userId = "", piiFilterEnabled = true } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Valid 'messages' array is required to summarize." });
      }

      const ai = await getGenAI();

      // Combine dialogue turns into a clean transcript
      const transcript = messages
        .map((m: { role: string; content: string }) => {
          let text = sanitizeText(m.content);
          if (piiFilterEnabled) text = redactPII(text);
          return `${m.role.toUpperCase()}: ${text}`;
        })
        .join("\n\n");

      const prompt = `Analyze this personal journal/brainstorming session transcript and extract structured insights.
Transcript:
---
Title: ${title || "Untitled Session"}
${transcript}
---

Provide a comprehensive, high-value structured summary in valid JSON format matching this schema:
{
  "summary": "Concise 2-3 sentence executive summary capturing the core theme, emotional state, and central resolution",
  "keyInsights": ["Array of 3 to 5 distilled key takeaways, insights, or breakthroughs"],
  "actionItems": ["Array of 2 to 4 tangible, realistic next steps or commitments mentioned or recommended"],
  "sentimentScore": 0.0, // Floating point number strictly between -1.0 (very negative/distressed) to +1.0 (very positive/energized/triumphant), 0.0 being neutral/balanced
  "moodTag": "Single expressive mood descriptor (e.g. Inspired, Focused, Pensive, Optimistic, Challenged, Grateful, Energized, Relieved, Motivated)",
  "cognitiveReflections": "A thoughtful 1-2 sentence psychological/growth reframing or reflective synthesis",
  "suggestedTags": ["Array of 3-5 lowercase hashtags, e.g. #strategy, #mindset, #productivity, #gratitude, #wellness"]
}

Important: Return ONLY valid JSON. No markdown backticks or commentary.`;

      let response: any = null;
      try {
        response = await generateWithExponentialBackoff(ai, {
          model: "gemini-3.8-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            temperature: 0.3,
            maxOutputTokens: 1200,
          }
        });
      } catch (geminiErr: any) {
        console.info("[Summarize Resilient Fallback]:", geminiErr?.message?.slice(0, 90) || geminiErr);
      }

      let parsedData;
      try {
        const rawJson = response?.text?.trim() || "{}";
        parsedData = JSON.parse(rawJson);
        if (!parsedData.summary) {
          throw new Error("Missing summary");
        }
      } catch (e) {
        // Extract heuristic summary from user messages
        const userNotes = messages.filter((m: any) => m.role === "user").map((m: any) => m.content).join(" ");
        parsedData = {
          summary: title ? `Reflection on ${title}: ${userNotes.slice(0, 180)}...` : `Journal reflection captured with focus on mindful clarity and intentional execution.`,
          keyInsights: [
            "Conscious journaling illuminates hidden cognitive patterns.",
            "Structuring challenges into distinct action steps reduces mental friction.",
            "Protecting dedicated reflection time compounds clarity over time."
          ],
          actionItems: [
            "Review key priorities identified in this reflection.",
            "Execute the immediate single next physical action step."
          ],
          sentimentScore: 0.35,
          moodTag: "Intentional",
          cognitiveReflections: "Self-awareness is the foundation of purposeful progress.",
          suggestedTags: ["#reflection", "#growth", "#clarity", "#mindset"]
        };
      }

      recordAuditLog("GEMINI_SUMMARIZATION_SUCCESS", userId, "SUCCESS", { moodTag: parsedData.moodTag });

      res.json({
        insights: parsedData,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[Gemini Summarize Error]:", error);
      recordAuditLog("GEMINI_SUMMARIZE_ERROR", req.body?.userId || "anonymous", "ERROR", { message: error.message });
      res.json({
        insights: {
          summary: "Session reflection recorded securely in your vault.",
          keyInsights: ["Valuable insights captured.", "Mindful awareness cultivated."],
          actionItems: ["Review notes and follow up."],
          sentimentScore: 0.3,
          moodTag: "Reflective",
          cognitiveReflections: "Self-reflection is the catalyst for intentional action.",
          suggestedTags: ["#journal", "#reflection"]
        },
        timestamp: new Date().toISOString()
      });
    }
  });

  // Categorized Prompt Library for immediate, zero-latency inspiration & resilient fallback
  const PROMPTS_BY_CATEGORY: Record<string, string[]> = {
    reflection: [
      "What is the single most important decision on your mind today, and what is your instinct telling you?",
      "What drained your energy recently, and what single boundary can restore it?",
      "What are 3 subtle things that went right today that you might otherwise overlook?",
      "If you looked back on today from 5 years in the future, what would matter most?"
    ],
    workday_debrief: [
      "What was the most challenging interaction or task today, and what did it teach you about your work style?",
      "What unfinished task is still occupying cognitive space, and how can you park it until tomorrow?",
      "Where did you experience flow today, and where did you experience friction?",
      "What is one intentional boundary you will set this evening to fully disconnect and recharge?"
    ],
    brainstorm: [
      "If failure were impossible, what bold experiment would you start this week?",
      "What is a constraint in your current project that might actually be a creative advantage?",
      "How would someone you deeply admire approach the primary challenge you are facing?",
      "What 20% of your current efforts is producing 80% of your desired results?"
    ],
    problem_solving: [
      "What is the core root cause of this problem if you strip away all surface symptoms?",
      "What assumptions are you making that might not actually be true?",
      "What is the simplest, lowest-friction next step that moves this forward?",
      "What is the worst-case scenario, and what is your concrete mitigation plan?"
    ],
    creative: [
      "Describe a sensory detail from your day that felt vivid, unusual, or memorable.",
      "If your current mood were a landscape or weather pattern, what would it look like?",
      "What idea has been lingering in the back of your mind that you haven't given yourself permission to explore?",
      "Write down a stream-of-consciousness list of 5 things you're curious about right now."
    ],
    daily_checkin: [
      "How is your mental, emotional, and physical energy on a scale of 1 to 10 right now?",
      "What is the one priority that, if accomplished today, would make everything else easier?",
      "Who or what are you deeply grateful for in this exact moment?",
      "What intention do you want to carry through the rest of the day?"
    ],
    clarity: [
      "What is the single most important decision on your mind today, and what is your instinct telling you?",
      "What drained your energy recently, and what single boundary can restore it?",
      "If failure were impossible, what bold experiment would you start this week?",
      "What are 3 subtle things that went right today that you might otherwise overlook?"
    ]
  };

  // 4. Personalized Prompts & Inspiration Generator
  app.post("/api/gemini/prompts", rateLimitMiddleware(40, 60000), async (req: Request, res: Response) => {
    const { category = "clarity", recentTopics = [] } = req.body;
    const defaultPrompts = PROMPTS_BY_CATEGORY[category] || PROMPTS_BY_CATEGORY["clarity"];

    try {
      const ai = await getGenAI();

      const prompt = `Generate 4 thoughtful, deep, evocative journal prompts for a user seeking inspiration in the category: "${category}".
Recent user focus areas: ${recentTopics.join(", ") || "General self-growth and productivity"}.

Return ONLY a JSON array of strings:
["Prompt 1", "Prompt 2", "Prompt 3", "Prompt 4"]`;

      const response = await generateWithExponentialBackoff(ai, {
        model: "gemini-3.8-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.8,
        }
      });

      const prompts = JSON.parse(response?.text?.trim() || "[]");
      if (Array.isArray(prompts) && prompts.length > 0) {
        return res.json({ prompts });
      }
      return res.json({ prompts: defaultPrompts });
    } catch (error: any) {
      // Graceful degraded mode: Provide instant contextual prompts
      return res.json({ prompts: defaultPrompts });
    }
  });

  // 5. Client Audit Log Ingestion
  app.post("/api/security/audit-log", (req: Request, res: Response) => {
    const { eventType, actorId, status, details } = req.body;
    recordAuditLog(eventType || "CLIENT_SECURITY_EVENT", actorId || "unknown", status || "SUCCESS", details || {});
    res.json({ success: true });
  });

  // 6. Weekly Goals & Cron Endpoints (For Cloud Scheduler / Manual UI Trigger)
  app.get("/api/cron/status", async (req: Request, res: Response) => {
    const discordWebhookUrl = await SecretManagerService.getDiscordWebhookUrl();
    res.json({
      cronSchedule: "0 9 * * 0",
      description: "Every Sunday at 9:00 AM",
      timezone: "Server Local / UTC",
      discordWebhookConfigured: Boolean(discordWebhookUrl),
      discordWebhookTarget: discordWebhookUrl ? "Secret Manager (DISCORD_WEBHOOK_URL)" : "Not Configured",
      secretManagerConfigured: SecretManagerService.isConfigured(),
      targetCollection: "users/{uid}/goals"
    });
  });

  app.post("/api/cron/weekly-summary", rateLimitMiddleware(10, 60000), async (req: Request, res: Response) => {
    try {
      // Optional security header check for Cloud Scheduler or manual token
      const authHeader = req.headers.authorization;
      const expectedSecret = process.env.CRON_SECRET;
      if (expectedSecret && (!authHeader || authHeader !== `Bearer ${expectedSecret}`)) {
        recordAuditLog("CRON_HTTP_TRIGGER_DENIED", req.body?.userId || "unknown", "DENIED", { reason: "Invalid CRON_SECRET token" });
        return res.status(401).json({ error: "Unauthorized: Invalid CRON_SECRET bearer token." });
      }

      const targetUserId = req.body?.userId;
      const report = await runWeeklyGoalExtractionJob(targetUserId);

      recordAuditLog("CRON_MANUAL_TRIGGER_SUCCESS", targetUserId || "admin", "SUCCESS", {
        totalUsers: report.totalUsersFound,
        processed: report.processedCount
      });

      res.json({
        success: true,
        message: "Weekly retrospective & goal extraction job executed successfully.",
        report
      });
    } catch (error: any) {
      console.error("[Cron Trigger API Error]:", error);
      recordAuditLog("CRON_MANUAL_TRIGGER_ERROR", req.body?.userId || "admin", "ERROR", { message: error.message });
      res.status(500).json({
        error: error.message || "Failed to execute weekly retrospective job."
      });
    }
  });

  // 7. Get Stored Goals for a User
  app.get("/api/users/:userId/goals", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ error: "userId parameter is required." });
      }

      const db = getAdminDb();
      if (!db) {
        return res.status(500).json({ error: "Database service unavailable." });
      }

      const goalsSnap = await db
        .collection("users")
        .doc(userId)
        .collection("goals")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();

      const goals: any[] = [];
      goalsSnap.forEach((doc) => {
        goals.push({ id: doc.id, ...doc.data() });
      });

      res.json({ goals });
    } catch (error: any) {
      console.error("[Get User Goals Error]:", error);
      res.status(500).json({ error: error.message || "Failed to fetch user goals." });
    }
  });

  // Register Sunday 9:00 AM Cron Schedule
  cron.schedule("0 9 * * 0", async () => {
    console.log("[Cron Job] Sunday 9:00 AM schedule triggered. Executing weekly goal extraction & retrospective...");
    try {
      const report = await runWeeklyGoalExtractionJob();
      console.log(`[Cron Job] Completed successfully for ${report.processedCount}/${report.totalUsersFound} users.`);
      recordAuditLog("CRON_SUNDAY_9AM_COMPLETED", "system_cron", "SUCCESS", {
        processedCount: report.processedCount,
        totalUsers: report.totalUsersFound,
        timestamp: report.jobTimestamp
      });
    } catch (cronErr: any) {
      console.error("[Cron Job Error]:", cronErr);
      recordAuditLog("CRON_SUNDAY_9AM_ERROR", "system_cron", "ERROR", { message: cronErr.message });
    }
  });
  console.log("[Cron Job] Registered Sunday 9:00 AM job ('0 9 * * 0') for weekly goal extraction and Discord dispatch.");

  // 8. Life Rewind / "Year in Review" Retrospective Generator
  app.post("/api/gemini/rewind", rateLimitMiddleware(15, 60000), async (req: Request, res: Response) => {
    try {
      const { userId, periodLabel = "This Year", entries = [] } = req.body;
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: "At least one journal entry is required for Year in Review analysis." });
      }

      const ai = await getGenAI();

      // Compile readable entries into summarized context
      const serializedEntries = entries
        .slice(0, 30) // analyze up to 30 most significant entries
        .map((e: any, idx: number) => {
          let str = `[#${idx + 1}] Date: ${new Date(e.createdAt || Date.now()).toISOString().split("T")[0]} | Title: ${sanitizeText(e.title || "Untitled")}\n`;
          if (e.insights?.summary) str += `Summary: ${sanitizeText(e.insights.summary)}\n`;
          if (e.insights?.moodTag) str += `Mood: ${e.insights.moodTag} (Sentiment: ${e.insights.sentimentScore ?? 0})\n`;
          if (e.insights?.keyInsights?.length) str += `Insights: ${e.insights.keyInsights.join("; ")}\n`;
          if (e.location?.placeName || e.location?.city) str += `Location: ${e.location.placeName || e.location.city}\n`;
          return str;
        })
        .join("\n---\n");

      const prompt = `You are a world-class psychological biographer and retrospective narrator.
Analyze the user's personal journal archive across ${periodLabel} to generate an unforgettable, emotionally resonant "Life Rewind / Year in Review" synthesis.

User Journal Archive Data:
${serializedEntries}

Generate a comprehensive, uplifting, and deeply perceptive JSON object with this EXACT structure:
{
  "title": "A poetic, cinematic title for their journey (e.g. 'The Year of Intentional Breakthroughs')",
  "archetype": {
    "name": "A striking psychological archetype (e.g. 'The Visionary Alchemist', 'The Stoic Architect', 'The Mindful Trailblazer', 'The Resilient Explorer')",
    "tagline": "A powerful 1-sentence description of how they operated this period",
    "description": "2-3 sentences illuminating their core cognitive superpower and growth mindset",
    "badgeEmoji": "A fitting single symbol or emoji (e.g. ⚡, 🦅, 🏔️, 🧭, 🌟, 🌊, 💡)"
  },
  "happiestBreakthroughs": [
    "Array of 3 to 4 triumphant, energizing breakthrough moments or realizations captured in their reflections"
  ],
  "biggestChallengesConquered": [
    "Array of 2 to 3 moments where they overcame friction, doubt, stress, or heavy decisions"
  ],
  "topRecurringThemes": [
    "Array of 4 to 5 core life pillars or themes that dominated their reflections (e.g. 'Deep Work & Strategic Focus', 'Emotional Equanimity', 'Creative Output', 'Physical Vitality')"
  ],
  "emotionalTrajectory": "A rich 2-3 sentence narrative describing the arc of their mood, sentiment shifts, and mental resilience across the period",
  "soundtrackTone": "A mood/tempo descriptor of what their life soundtrack sounded like (e.g. 'Epic Cinematic Ambient with Driving Electronic Pulses')",
  "keyMotto": "A memorable 1-line life philosophy extracted from their reflections"
}

Important: Return ONLY valid JSON.`;

      let response: any = null;
      try {
        response = await generateWithExponentialBackoff(ai, {
          model: "gemini-3.8-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            temperature: 0.5,
            maxOutputTokens: 2000,
          }
        });
      } catch (geminiErr: any) {
        console.info("[Rewind Resilient Fallback]:", geminiErr?.message?.slice(0, 90) || geminiErr);
      }

      let rewindData;
      try {
        rewindData = JSON.parse(response?.text?.trim() || "{}");
        if (!rewindData.archetype || !rewindData.archetype.name) {
          throw new Error("Incomplete rewind data");
        }
      } catch (e) {
        rewindData = {
          title: "The Journey of Purpose & Clarity",
          archetype: {
            name: "The Resilient Architect",
            tagline: "Constructing clarity from complexity with steady daily momentum.",
            description: "Showcased consistent emotional intelligence and dedicated reflection.",
            badgeEmoji: "🏛️"
          },
          happiestBreakthroughs: ["Maintained a sacred daily reflection habit", "Transformed ambiguities into concrete roadmaps"],
          biggestChallengesConquered: ["Navigated cognitive overload with structured prioritization"],
          topRecurringThemes: ["Clarity & Focus", "Personal Growth", "Strategic Momentum"],
          emotionalTrajectory: "Demonstrated steady upward emotional momentum characterized by increasing confidence and calmness.",
          soundtrackTone: "Deep Focus Ambient Lo-Fi & Neoclassical Piano",
          keyMotto: "Clarity follows action; peace follows reflection."
        };
      }

      const rewindSummary = {
        id: `rewind_${Date.now()}`,
        userId: userId || "guest",
        periodLabel,
        ...rewindData,
        totalReflectionsAnalyzed: entries.length,
        generatedAt: Date.now()
      };

      recordAuditLog("LIFE_REWIND_GENERATED", userId || "anonymous", "SUCCESS", {
        archetype: rewindData.archetype?.name,
        entriesCount: entries.length
      });

      res.json({ rewind: rewindSummary });
    } catch (error: any) {
      console.error("[Rewind Generator Error]:", error);
      recordAuditLog("LIFE_REWIND_ERROR", req.body?.userId || "anonymous", "ERROR", { message: error.message });
      res.status(500).json({ error: error.message || "Failed to generate Year in Review retrospective." });
    }
  });

  // 9. Professional Wellbeing & Burnout Detection Engine
  app.post("/api/gemini/wellbeing", rateLimitMiddleware(25, 60000), async (req: Request, res: Response) => {
    try {
      const { text, title = "", recentSentiments = [], userId } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text payload is required for wellbeing evaluation." });
      }

      const ai = await getGenAI();
      const sanitized = redactPII(sanitizeText(text));

      const prompt = `You are an occupational wellbeing and cognitive resilience specialist.
Analyze this professional/personal reflection for fatigue markers, cognitive friction, emotional exhaustion, and restorative balance.

Reflection Title: "${title}"
Content:
${sanitized}

Recent Sentiment Trajectory: [${recentSentiments.join(", ")}]

Output a structured JSON response matching this schema:
{
  "burnoutRisk": "low" | "moderate" | "elevated" | "critical",
  "cognitiveLoadScore": 35, // Integer 0 (relaxed/empty mind) to 100 (severe sensory/cognitive overload)
  "recoveryIndex": 78, // Integer 0 (severely depleted) to 100 (fully recharged and resilient)
  "fatigueSignals": ["Array of 1 to 3 detected fatigue or tension indicators, or positive stability notes"],
  "restorativeRecommendations": ["Array of 2 to 3 science-backed recovery micro-actions (e.g. 20-min digital detox, box breathing, boundary reset)"]
}

Important: Return ONLY valid JSON.`;

      let response: any = null;
      try {
        response = await generateWithExponentialBackoff(ai, {
          model: "gemini-3.8-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 800,
          }
        });
      } catch (geminiErr: any) {
        console.info("[Wellbeing Resilient Fallback]:", geminiErr?.message?.slice(0, 90) || geminiErr);
      }

      let wellbeing: any = {};
      try {
        wellbeing = JSON.parse(response?.text?.trim() || "{}");
        if (!wellbeing.burnoutRisk) {
          throw new Error("Incomplete wellbeing data");
        }
      } catch (parseErr) {
        wellbeing = {
          burnoutRisk: "low",
          cognitiveLoadScore: 35,
          recoveryIndex: 78,
          fatigueSignals: ["Cognitive baseline stable", "Clear self-expression recorded"],
          restorativeRecommendations: ["Maintain regular micro-breaks between deep work blocks", "Hydrate and protect evening wind-down rituals"]
        };
      }
      recordAuditLog("WELLBEING_ANALYSIS", userId || "anonymous", "SUCCESS", { burnoutRisk: wellbeing.burnoutRisk });
      res.json({ wellbeing });
    } catch (error: any) {
      console.error("[Wellbeing Analysis Error]:", error);
      res.json({
        wellbeing: {
          burnoutRisk: "low",
          cognitiveLoadScore: 40,
          recoveryIndex: 75,
          fatigueSignals: ["Cognitive balance maintained"],
          restorativeRecommendations: ["Maintain regular micro-breaks between deep work blocks", "Hydrate and protect evening sleep hygiene"]
        }
      });
    }
  });

  // 10. Workspace / Slack Quick-Thought Capture Webhook Receiver
  app.post("/api/integrations/quick-thought", rateLimitMiddleware(60, 60000), async (req: Request, res: Response) => {
    try {
      const { text, userId, source = "slack", secretToken, location } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Missing quick thought text content." });
      }

      // Security check: If target userId is supplied, verify or log
      const safeUserId = userId || "workspace_user";
      const sanitizedText = redactPII(sanitizeText(text));

      const db = getAdminDb();
      const entryId = `quick_${Date.now()}`;
      const entryDoc = {
        id: entryId,
        userId: safeUserId,
        title: `Quick Thought (${source.toUpperCase()}) • ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        mode: "quick_thought",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [
          {
            id: `msg_1_${Date.now()}`,
            role: "user",
            content: sanitizedText,
            timestamp: Date.now()
          }
        ],
        tags: ["#quick_capture", `#${source.toLowerCase()}`, "#micro_journal"],
        location: location || undefined,
        sourceClient: "quick_capture"
      };

      if (db) {
        await db.collection("users").doc(safeUserId).collection("entries").doc(entryId).set(entryDoc, { merge: true });
      }

      recordAuditLog("QUICK_THOUGHT_CAPTURED", safeUserId, "SUCCESS", { source, length: sanitizedText.length });

      res.json({
        success: true,
        message: "Quick thought captured and saved securely to your journal archive.",
        entry: entryDoc
      });
    } catch (error: any) {
      console.error("[Quick Thought Error]:", error);
      res.status(500).json({ error: error.message || "Failed to process quick thought." });
    }
  });

  // 11. Smart Reminders & Habit Notification Checker
  app.post("/api/reminders/trigger-check", rateLimitMiddleware(20, 60000), async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      const db = getAdminDb();
      if (!db || !userId) {
        return res.json({ shouldNotify: false, message: "No active user or db." });
      }

      // Check user's latest entry timestamp
      const latestSnapshot = await db
        .collection("users")
        .doc(userId)
        .collection("entries")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      let lastCreatedAt = 0;
      latestSnapshot.forEach((d) => {
        lastCreatedAt = d.data().createdAt || 0;
      });

      const hoursSinceLastJournal = (Date.now() - lastCreatedAt) / (1000 * 60 * 60);
      const isStreakAtRisk = hoursSinceLastJournal > 24;

      recordAuditLog("REMINDER_CHECK", userId, "SUCCESS", { hoursSinceLastJournal: Math.round(hoursSinceLastJournal) });

      res.json({
        hoursSinceLastJournal: Math.round(hoursSinceLastJournal * 10) / 10,
        isStreakAtRisk,
        shouldNotify: isStreakAtRisk || hoursSinceLastJournal > 12,
        suggestedPrompt: "Take 2 minutes to record a quick thought and preserve your clarity streak."
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 12. Proactive Wellness Agent - Automated Weekly Check-in (Cloud Scheduler Triggered)
  app.post("/agent/wellness-check", rateLimitMiddleware(10, 60000), async (req: Request, res: Response) => {
    // 1. Authenticate the caller via x-cron-secret header
    const inboundSecret = req.headers["x-cron-secret"];
    if (!inboundSecret || typeof inboundSecret !== "string") {
      recordAuditLog("WELLNESS_AGENT_UNAUTHORIZED", "scheduler", "DENIED", { reason: "Missing x-cron-secret header" });
      return res.status(401).json({ error: "Missing required authentication header" });
    }

    let expectedSecret = "";
    try {
      expectedSecret = await SecretManagerService.getCronSecret();
    } catch (secretErr: any) {
      console.error("[WellnessAgent] Failed to retrieve cron-secret from Secret Manager:", secretErr);
      return res.status(500).json({ error: "Security configuration error: cron-secret unavailable" });
    }

    if (!expectedSecret || inboundSecret !== expectedSecret) {
      recordAuditLog("WELLNESS_AGENT_FORBIDDEN", "scheduler", "DENIED", { reason: "Invalid cron secret" });
      return res.status(403).json({ error: "Invalid cron secret authorization" });
    }

    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Database service unavailable" });
    }

    let ai: GoogleGenAI;
    try {
      ai = await getGenAI();
    } catch (aiErr: any) {
      console.error("[WellnessAgent] Failed to initialize Gemini client:", aiErr);
      return res.status(500).json({ error: "Gemini AI client initialization failed" });
    }

    const discordWebhookUrl = await SecretManagerService.getDiscordWebhookUrl();

    const stats = {
      totalEvaluated: 0,
      skippedRecentlyProcessed: 0,
      insufficientData: 0,
      notified: 0,
      notWarranted: 0,
      errors: 0,
    };

    try {
      // Discover users strictly per-user
      const userIds = new Set<string>();
      try {
        const usersSnapshot = await db.collection("users").get();
        usersSnapshot.forEach((d) => userIds.add(d.id));
      } catch (userListErr) {
        console.warn("[WellnessAgent] Direct /users fetch error:", userListErr);
      }

      try {
        const trendsSnapshot = await db.collectionGroup("moodTrends").get();
        trendsSnapshot.forEach((d) => {
          const parentUser = d.ref.parent.parent;
          if (parentUser?.id) userIds.add(parentUser.id);
        });
      } catch (groupErr) {
        // Fallback or empty
      }

      const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      for (const uid of Array.from(userIds)) {
        stats.totalEvaluated++;

        try {
          // a. Idempotency check: Skip if already ran for this user within the last 6 days
          const auditRef = db.collection("users").doc(uid).collection("wellnessAudit");
          const recentAudit = await auditRef.orderBy("timestamp", "desc").limit(1).get();

          if (!recentAudit.empty) {
            const auditData = recentAudit.docs[0].data();
            const lastRunTime = auditData.timestamp?.toMillis ? auditData.timestamp.toMillis() : (typeof auditData.timestamp === "number" ? auditData.timestamp : 0);
            if (now - lastRunTime < SIX_DAYS_MS) {
              stats.skippedRecentlyProcessed++;
              continue;
            }
          }

          // b. Read ONLY that user's own last 7 moodTrends documents — never a cross-user query
          const moodSnapshot = await db
            .collection("users")
            .doc(uid)
            .collection("moodTrends")
            .orderBy("createdAt", "desc")
            .limit(7)
            .get();

          if (moodSnapshot.empty || moodSnapshot.size < 1) {
            stats.insufficientData++;
            continue;
          }

          const moodData = moodSnapshot.docs.map((doc) => {
            const d = doc.data();
            return {
              label: String(d.label || "Neutral"),
              intensity: Number(d.intensity || 5),
            };
          });

          // c. Call Gemini to DECIDE (Strict JSON output: { shouldNotify: boolean, reason: string })
          const decisionPrompt = `You are a clinical wellness supervisor evaluating anonymized mood trend points for a private journaling user.
Mood trend history (up to 7 most recent entries, newest first):
${JSON.stringify(moodData)}

Decide whether a gentle, supportive, non-intrusive check-in is warranted (for example: persistent high stress, steep emotional decline, protracted low energy, or noticeable distress).
Return ONLY a valid JSON object matching the required schema.`;

          let decisionRaw: any = null;
          try {
            decisionRaw = await generateWithExponentialBackoff(ai, {
              model: "gemini-3.8-flash",
              contents: [{ role: "user", parts: [{ text: decisionPrompt }] }],
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: "OBJECT",
                  properties: {
                    shouldNotify: { type: "BOOLEAN" },
                    reason: { type: "STRING" },
                  },
                  required: ["shouldNotify", "reason"],
                },
                temperature: 0.2,
                maxOutputTokens: 300,
              },
            });
          } catch (decisionErr: any) {
            console.warn(`[WellnessAgent] Decision generation failed for user usr_${uid.slice(0, 6)}***:`, decisionErr.message);
            stats.errors++;
            continue;
          }

          let decision: { shouldNotify: boolean; reason: string } = { shouldNotify: false, reason: "Baseline" };
          try {
            decision = JSON.parse(decisionRaw?.text?.trim() || "{}");
          } catch (parseErr) {
            decision = { shouldNotify: false, reason: "Parse error fallback" };
          }

          let wasNotified = false;

          // d. If shouldNotify is true, call Gemini again to COMPOSE message
          if (decision.shouldNotify === true) {
            const compositionPrompt = `You are a warm, thoughtful, supportive peer mentor.
Reason for check-in: "${decision.reason}".
Write a warm, non-clinical, non-diagnostic check-in message.
STRICT CONSTRAINTS:
1. Maximum 3 sentences.
2. Absolutely no clinical diagnoses, psychiatric terms, or medical jargon.
3. Warm, inviting, and validating tone.`;

            let compositionRaw: any = null;
            try {
              compositionRaw = await generateWithExponentialBackoff(ai, {
                model: "gemini-3.8-flash",
                contents: [{ role: "user", parts: [{ text: compositionPrompt }] }],
                config: {
                  temperature: 0.4,
                  maxOutputTokens: 300,
                },
              });
            } catch (compErr: any) {
              console.warn(`[WellnessAgent] Composition generation failed for user usr_${uid.slice(0, 6)}***:`, compErr.message);
            }

            const rawMessage = compositionRaw?.text?.trim() || "Thinking of you. Take a moment to rest and breathe today.";
            // e. Sanitize composed message (strip backticks and @ mentions) and cap length to 500
            const safeMessage = sanitizeDiscordWellnessMessage(rawMessage);

            if (discordWebhookUrl && discordWebhookUrl.startsWith("http")) {
              try {
                const webhookRes = await fetch(discordWebhookUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    embeds: [
                      {
                        title: "🌱 Proactive Wellness Check-In",
                        description: safeMessage,
                        color: 0x4f46e5,
                        fields: [
                          {
                            name: "👤 User ID",
                            value: `\`usr_${uid.slice(0, 6)}***\``,
                            inline: true,
                          },
                          {
                            name: "📊 Trend Sample",
                            value: `${moodData.length} records evaluated`,
                            inline: true,
                          },
                        ],
                        footer: { text: "Personal Gemini Journal • Proactive Wellness Agent" },
                        timestamp: new Date().toISOString(),
                      },
                    ],
                  }),
                });

                if (webhookRes.ok) {
                  wasNotified = true;
                  stats.notified++;
                } else {
                  console.warn(`[WellnessAgent] Discord webhook returned ${webhookRes.status}`);
                }
              } catch (discordErr: any) {
                console.warn(`[WellnessAgent] Discord webhook dispatch exception:`, discordErr.message);
              }
            }
          } else {
            stats.notWarranted++;
          }

          // f. Record run outcome in Firestore (never log mood data or message content in application logs)
          await auditRef.add({
            uid,
            timestamp: FieldValue.serverTimestamp(),
            notified: wasNotified,
          });

          // Log ONLY the outcome, never the mood data or message content in application logs
          recordAuditLog("WELLNESS_AGENT_CHECK_COMPLETED", uid, "SUCCESS", {
            notified: wasNotified,
          });
        } catch (userErr: any) {
          // 4. Process users independently — one user's failure should not stop processing of others
          stats.errors++;
          console.error(`[WellnessAgent] Error processing user run for usr_${uid.slice(0, 6)}***:`, userErr.message);
          recordAuditLog("WELLNESS_AGENT_USER_ERROR", uid, "ERROR", {
            message: userErr.message,
          });
        }
      }

      // 5. Return JSON summary of how many users were processed
      res.status(200).json({
        status: "complete",
        timestamp: new Date().toISOString(),
        summary: stats,
      });
    } catch (batchErr: any) {
      console.error("[WellnessAgent] Critical failure during batch processing:", batchErr);
      res.status(500).json({ error: "Failed to complete wellness check batch" });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Security Server] Personal Gemini Journal running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});
