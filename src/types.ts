export type JournalMode =
  | "reflection"
  | "brainstorm"
  | "problem_solving"
  | "creative"
  | "daily_checkin"
  | "workday_debrief"
  | "quick_thought";

export interface GeoLocationTag {
  latitude: number;
  longitude: number;
  placeName?: string;
  city?: string;
  country?: string;
  accuracy?: number;
}

export interface WellbeingSignals {
  burnoutRisk: "low" | "moderate" | "elevated" | "critical";
  cognitiveLoadScore: number; // 0 to 100
  recoveryIndex: number; // 0 to 100
  fatigueSignals: string[];
  restorativeRecommendations: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface JournalInsights {
  summary: string;
  keyInsights: string[];
  actionItems: string[];
  sentimentScore: number; // -1.0 to 1.0
  moodTag: string;
  cognitiveReflections: string;
  suggestedTags: string[];
  wellbeing?: WellbeingSignals;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  mode: JournalMode;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  insights?: JournalInsights;
  tags: string[];
  location?: GeoLocationTag;
  isPinned?: boolean;
  isEncryptedVault?: boolean;
  encryptedPayload?: string; // Client-side encrypted ciphertext if vault lock is enabled
  iv?: string; // Initialization vector for AES-GCM
  completedActionItems?: number[]; // Index of completed action items
  sourceClient?: "web" | "quick_capture" | "slack_simulation" | "mobile";
}

export interface LifeRewindSummary {
  id: string;
  userId: string;
  periodLabel: string;
  title: string;
  archetype: {
    name: string;
    tagline: string;
    description: string;
    badgeEmoji: string;
  };
  totalReflectionsAnalyzed: number;
  happiestBreakthroughs: string[];
  biggestChallengesConquered: string[];
  topRecurringThemes: string[];
  emotionalTrajectory: string;
  soundtrackTone: string;
  keyMotto: string;
  generatedAt: number;
}

export type AccessRole = "owner" | "coach" | "therapist" | "observer";

export interface SharedAccessGrant {
  id: string;
  grantedEmail: string;
  role: AccessRole;
  createdAt: number;
  expiresAt: number;
  token: string;
  isActive: boolean;
  canViewEncrypted: boolean;
}

export interface SmartReminderConfig {
  enabled: boolean;
  morningTime: string; // e.g. "08:30"
  eveningTime: string; // e.g. "20:30"
  enableBrowserNotifications: boolean;
  missedStreakWebhookUrl?: string;
  lastNotified?: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  role?: AccessRole;
}

export interface SecurityEvent {
  timestamp: string;
  eventType: string;
  actorId: string;
  status: "SUCCESS" | "DENIED" | "ERROR";
  details?: Record<string, unknown>;
}

export interface WeeklyGoalRecord {
  id: string;
  userId: string;
  goals: string[];
  weeklyMoodSummary: string;
  createdAt: number;
  periodStart?: number;
  periodEnd?: number;
  entryCount?: number;
  source?: string;
  syncedToDiscord?: boolean;
}

export interface SecurityPostureData {
  secretManagerConfigured: boolean;
  auditLogsCount: number;
  recentAuditLogs: SecurityEvent[];
  threatModel: {
    spoofing: string;
    tampering: string;
    repudiation: string;
    informationDisclosure: string;
    denialOfService: string;
    elevationOfPrivilege: string;
  };
}
