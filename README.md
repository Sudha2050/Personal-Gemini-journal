# Personal Gemini Journal

[![Google Cloud Run](https://img.shields.io/badge/Google_Cloud_Run-Ready-4285F4?logo=google-cloud&logoColor=white)](https://cloud.google.com/run)
[![Google Gemini API](https://img.shields.io/badge/Gemini_API-3.8_Flash_|_3.1_Flash--Lite-blue?logo=google&logoColor=white)](https://ai.google.dev/)
[![Firebase Firestore](https://img.shields.io/badge/Firebase-Auth_&_Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Discord Webhook](https://img.shields.io/badge/Discord-Webhook_Alerts-5865F2?logo=discord&logoColor=white)](https://discord.com/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage_Build-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Security](https://img.shields.io/badge/OWASP-Zero_Trust_Architecture-success)](#enterprise-security--threat-modeling)
[![Challenge Label](https://img.shields.io/badge/Ideathon_Label-dev--tutorial%3Dcloud--run--ai--challenge-orange)](#competition-label-verification)

An enterprise-grade, privacy-first AI journaling platform and personal cognitive companion built for the **Google Cloud Run AI Challenge (Ideathon)**. Engineered with full-stack TypeScript, Google Cloud Secret Manager, Cloud Firestore multi-tenant isolation, Discord real-time webhooks, automated proactive wellness agents, and modern Google Gemini models (`gemini-3.8-flash`, `gemini-3.1-flash-lite`).

---

## System Architecture

```text
                               ┌────────────────────────────────────────┐
                               │       Client (React 19 + Vite)         │
                               │  - Client-Side AES PIN Vault Shield    │
                               │  - PII Detection & Pre-Scrubbing       │
                               │  - Offline / Online Firebase Sync      │
                               └──────────────────┬─────────────────────┘
                                                  │ HTTPS / TLS 1.3
                                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   Google Cloud Run Service: personal-gemini-journal                    │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                      Node.js / Express Security Gateway                        │   │
│   │   - Strict Schema Validation & Sanitization                                    │   │
│   │   - In-Memory Rate Limiting & Token Caps                                       │   │
│   │   - Structured Audit Logging (Zero PII / Credentials)                          │   │
│   │   - Resilient Exponential Backoff Cascade (gemini-3.8-flash / 3.1-flash-lite)  │   │
│   │   - Intelligent Offline Cognitive Reflection Engine                            │   │
│   │   - Autonomous Proactive Wellness Agent (node-cron & Cloud Scheduler)         │   │
│   └───────────────┬────────────────────────────┬─────────────────────────────┬─────┘   │
│                   │                            │                             │         │
└───────────────────┼────────────────────────────┼─────────────────────────────┼─────────┘
                    ▼                            ▼                             ▼
   ┌─────────────────────────────┐ ┌───────────────────────────┐ ┌─────────────────────────┐
   │ Google Cloud Secret Manager │ │ Google Cloud Firestore    │ │ Discord Webhook Gateway │
   │ - GEMINI_API_KEY            │ │ - Multi-Tenant RLS        │ │ - Proactive Check-Ins   │
   │ - DISCORD_WEBHOOK_URL       │ │ - /users/{userId}/entries │ │ - Weekly Retrospectives │
   │ - cron-secret               │ │ - /users/{userId}/goals   │ │ - Goal Bulletins        │
   └─────────────────────────────┘ └───────────────────────────┘ └─────────────────────────┘
```

---

## Core Capabilities

1. **Multi-Mode Cognitive Companion**:
   - **Mindful Self-Reflection**: Explores thoughts, untangles emotional nuances, and gently surfaces blind spots.
   - **Strategic Brainstorming**: Rapidly explores lateral ideas, 80/20 leverage points, and low-friction prototypes.
   - **Root-Cause Problem Solving**: Guides users through First Principles thinking and structured micro-actions.
   - **Creative Flow**: Vivid metaphors, sensory storytelling, and free-flowing expressive journaling.
   - **Daily Clarity Check-In**: Morning priorities, evening gratitude, and cognitive energy auditing.

2. **Autonomous Proactive Wellness Agent**:
   - Evaluates recent anonymized mood trend points per user without leaking cross-tenant data.
   - Decides whether gentle, non-clinical supportive check-ins are warranted.
   - Dispatches warm, non-diagnostic check-in messages directly to Discord via secure webhook.

3. **Weekly Goal Retrospective & Habit Bulletins**:
   - Automatically synthesizes active goals and mood trajectories.
   - Can be triggered on a schedule (e.g. Sunday 9:00 AM) or via protected webhook.

4. **Resilient AI Pipeline with Offline Cognitive Fallback**:
   - Automated exponential backoff cascade across modern Gemini models (`gemini-3.8-flash`, `gemini-3.1-flash-lite`, `gemini-flash-latest`).
   - Intelligent circuit breaker that detects HTTP 429 quota/prepayment depletion and transitions to the built-in **Offline Cognitive Reflection Engine** (with empathy for burnout, sleep deficits, skipped workouts, and boundary-setting) so the user is never stranded with an error screen.

5. **Discord Webhook Gateway**:
   - Dispatches rich embedded cards for wellness check-ins, goal updates, and integration tests.
   - Secrets are managed server-side and never exposed to client-side bundles.

6. **Zero-Knowledge Privacy Vault**:
   - Client-side PIN lock shield for confidential entries.
   - Client-side PII detector that flags phone numbers, credit card patterns, and emails before AI ingestion.
   - 1-click Markdown / JSON data export and irreversible GDPR Right to Erasure data purge.

---

## Competition Label Verification

This application satisfies the **Google Cloud Run AI Challenge** submission criteria and bears the official Ideathon deployment label:

```bash
gcloud run services describe personal-gemini-journal \
  --region us-central1 \
  --format="value(labels)"
```

**Expected verification output:**
```text
dev-tutorial=cloud-run-ai-challenge
```

---

## API Endpoints Reference

| Route | Method | Description | Security / Auth |
| :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | Health check & system status | Public |
| `/api/gemini/chat` | `POST` | Multi-turn conversational companion | Rate Limited, Schema Validated |
| `/api/gemini/summarize` | `POST` | Synthesizes chat dialogue into structured reflection | Rate Limited |
| `/api/gemini/rewind` | `POST` | Generates temporal retrospective / life rewind | Rate Limited |
| `/api/gemini/prompts` | `GET` | Context-aware journaling prompts | Public |
| `/api/agent/proactive-check` | `POST` | Batch agent for proactive mood evaluation | Protected via `X-Cron-Secret` header |
| `/api/cron/weekly-summary` | `POST` | Triggers weekly goal extraction & Discord dispatch | Protected via `X-Cron-Secret` header |
| `/api/cron/status` | `GET` | Cron scheduler health & next run timestamp | Public |
| `/api/integrations/quick-thought` | `POST` | Ingestion webhook for quick thoughts from external apps | Rate Limited, Schema Validated |
| `/api/security/posture` | `GET` | Threat model compliance & recent audit events | Redacted Audit Viewer |

---

## Enterprise Security & Threat Modeling (STRIDE & OWASP Top 10)

| Threat Category | Mitigation Implemented |
| :--- | :--- |
| **Spoofing** | Firebase Auth token validation. Requests strictly bound to verified user UID. |
| **Tampering** | Inbound API payloads validated against strict type, length, and content constraints. |
| **Repudiation** | Structured in-memory and Firestore audit logging with zero PII or credentials recorded. |
| **Information Disclosure** | Absolute ban on client-side secrets. Secrets retrieved exclusively at container runtime via Secret Manager. |
| **Denial of Service** | Prompt token ceilings, in-memory IP rate limiting, and exponential backoff circuit breakers. |
| **Elevation of Privilege** | Path-based Cloud Firestore rules (`/users/{userId}/**`) mathematically guarantee tenant isolation. |

### Firestore Security Rules (`firestore.rules`)
```firestore-rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /{document=**} {
      allow read, write: if false; // Default Deny
    }
  }
}
```

---

## Google Cloud Run Deployment Guide

### 1. Enable Required Cloud APIs
```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com
```

### 2. Set Up Secrets in Google Cloud Secret Manager

Store your Gemini API key:
```bash
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY \
  --data-file=- \
  --replication-policy="automatic" 2>/dev/null || \
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
```

Store your Discord webhook URL:
```bash
echo -n "YOUR_DISCORD_WEBHOOK_URL" | gcloud secrets create DISCORD_WEBHOOK_URL \
  --data-file=- \
  --replication-policy="automatic" 2>/dev/null || \
echo -n "YOUR_DISCORD_WEBHOOK_URL" | gcloud secrets versions add DISCORD_WEBHOOK_URL --data-file=-
```

Store a random cron authorization secret:
```bash
echo -n "cron-secret-$(openssl rand -hex 16)" | gcloud secrets create cron-secret \
  --data-file=- \
  --replication-policy="automatic" 2>/dev/null || true
```

### 3. Grant Secret Manager Access to Cloud Run Service Account
```bash
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUM=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 4. Deploy to Google Cloud Run
Deploy directly from source with your environment variables, labels, and secret bindings:

```bash
gcloud run deploy personal-gemini-journal \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --labels=dev-tutorial=cloud-run-ai-challenge \
  --set-env-vars="NODE_ENV=production,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},FIRESTORE_DATABASE_ID=ai-studio-77e21641-e2d5-4b2a-9ed4-edfc59e70d9d" \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest,CRON_SECRET=cron-secret:latest,DISCORD_WEBHOOK_URL=DISCORD_WEBHOOK_URL:latest"
```

### 5. Verify Health Check Endpoint
Once deployed, verify your service:
```bash
SERVICE_URL=$(gcloud run services describe personal-gemini-journal --region us-central1 --format="value(status.url)")
curl -s "${SERVICE_URL}/api/health"
```

---

## Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate `.env` with:
```env
GEMINI_API_KEY=your_api_key_here
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 3. Start Development Server
```bash
npm run dev
```
The application will be live at `http://localhost:3000`.

### 4. Build & Production Test Locally
```bash
npm run build
npm start
```

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React, Framer Motion, Canvas Confetti
- **Backend**: Express, Node.js (`tsx` in development, `esbuild` bundled CJS for production container)
- **AI Engine**: `@google/genai` (Gemini 3.8 Flash, Gemini 3.1 Flash-Lite)
- **Database & Auth**: Firebase Authentication & Cloud Firestore (Database ID: `ai-studio-77e21641-e2d5-4b2a-9ed4-edfc59e70d9d`)
- **Secrets Management**: Google Cloud Secret Manager
- **Hosting & Containerization**: Google Cloud Run via multi-stage Dockerfile
- **Background Tasks**: node-cron & Cloud Scheduler webhook triggers

---

## License

Distributed under the Apache 2.0 License. Built for the Google Cloud Run AI Challenge (Ideathon).
