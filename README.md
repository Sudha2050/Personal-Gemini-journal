# Personal Gemini Journal (Gemini Vault)

[![Google Cloud Run](https://img.shields.io/badge/Google_Cloud_Run-Ready-4285F4?logo=google-cloud&logoColor=white)](https://cloud.google.com/run)
[![Google Gemini API](https://img.shields.io/badge/Gemini_API-3.8_Flash_|_3.6_Flash-blue?logo=google&logoColor=white)](https://ai.google.dev/)
[![Firebase Firestore](https://img.shields.io/badge/Firebase-Auth_&_Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage_Build-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Security](https://img.shields.io/badge/OWASP-Zero_Trust_Architecture-success)](#enterprise-security--threat-modeling)
[![Challenge Label](https://img.shields.io/badge/Ideathon_Label-dev--tutorial%3Dcloud--run--ai--challenge-orange)](#competition-label-verification)

An enterprise-grade, privacy-first AI journaling platform and personal cognitive companion built for the **Google Cloud Run AI Challenge (Ideathon)**. Engineered with full-stack TypeScript, Google Cloud Secret Manager, Cloud Firestore multi-tenant isolation, Discord real-time webhooks, and modern Google Gemini models.

---

## Architecture Overview

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
│                        Google Cloud Run Service: gemini-vault                          │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                      Node.js / Express Security Gateway                        │   │
│   │   - Strict Schema Validation & Sanitization                                    │   │
│   │   - In-Memory Rate Limiting & Token Caps                                       │   │
│   │   - Structured Audit Logging (Zero PII / Credentials)                          │   │
│   │   - Resilient Exponential Backoff Cascade (Gemini 3.8 / 3.6 / 3.1)             │   │
│   │   - Intelligent Cognitive Fallback Engine                                      │   │
│   └───────────────┬────────────────────────────┬─────────────────────────────┬─────┘   │
│                   │                            │                             │         │
└───────────────────┼────────────────────────────┼─────────────────────────────┼─────────┘
                    ▼                            ▼                             ▼
   ┌─────────────────────────────┐ ┌───────────────────────────┐ ┌─────────────────────────┐
   │ Google Cloud Secret Manager │ │ Google Cloud Firestore    │ │ Discord Webhook Gateway │
   │ - GEMINI_API_KEY            │ │ - Multi-Tenant RLS        │ │ - Milestone Bulletins   │
   │ - DISCORD_WEBHOOK_URL       │ │ - /users/{userId}/entries │ │ - Streak Retention Pings│
   └─────────────────────────────┘ └───────────────────────────┘ └─────────────────────────┘
```

---

## Key Capabilities

1. **Multi-Mode Cognitive Companion**:
   - **Open Reflection**: Stream-of-consciousness journaling with instant empathetic insights.
   - **Problem Solving**: Deconstructs complex bottlenecks into immediate, low-risk micro-actions.
   - **Clarity & Decision-Making**: Surfacing underlying trade-offs and second-order consequences.
   - **Gratitude & Grounding**: Daily anchoring for resilience and perspective.
2. **Year in Review / Temporal Rewind**:
   - Generates personalized milestone retrospects and sentiment evolution maps across custom time intervals.
3. **Wellbeing & Mood Trend Analytics**:
   - Algorithmic mood scoring, emotional intensity tracking, and cognitive theme clustering.
4. **Resilient AI Pipeline**:
   - Automated exponential backoff retry cascade across `gemini-3.8-flash`, `gemini-3.6-flash`, and `gemini-3.1-flash-lite`.
   - Circuit-breaker detection for API quota and credit exhaustion, seamlessly falling back to a structured cognitive engine without user-facing interruptions.
5. **Real-Time Discord Webhook Dispatcher**:
   - Dispatches structured milestone notifications and retention pings directly into a secure Discord channel without exposing the webhook URL to the client.
6. **Zero-Knowledge Privacy Vault**:
   - Client-side PIN lock shield for confidential entries.
   - Client-side PII detector that flags phone numbers, credit card patterns, and emails before ingestion.
   - 1-click Markdown / JSON data export and irreversible GDPR Right to Erasure data purge.

---

## Competition Label Verification

This application satisfies the **Google Cloud Run AI Challenge** submission criteria and bears the official Ideathon deployment label:

```bash
gcloud run services describe gemini-vault \
  --region us-central1 \
  --format="value(labels)"
```

**Expected verification output:**
```text
dev-tutorial=cloud-run-ai-challenge
```

---

## Enterprise Security & Threat Modeling (STRIDE & OWASP Top 10)

| Threat Category | Mitigation Implemented |
| :--- | :--- |
| **Spoofing** | Firebase Auth token validation. Requests strictly bound to verified UID. |
| **Tampering** | Inbound API payloads validated against strict type, length, and content constraints. |
| **Repudiation** | Structured audit logging tracks security-critical operations with PII redacted. |
| **Information Disclosure** | Absolute ban on client-side secrets. Secrets retrieved exclusively at container runtime via Secret Manager. |
| **Denial of Service** | Prompt ceiling limits, in-memory IP rate limiting, and circuit breakers. |
| **Elevation of Privilege** | Path-based Cloud Firestore rules (`/users/{userId}/**`) enforce that users can never read, query, or mutate another tenant's records. |

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

### 1. Prerequisites
- Google Cloud Project with Cloud Run, Cloud Build, and Secret Manager APIs enabled:
  ```bash
  gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com
  ```

### 2. Configure Google Cloud Secret Manager

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

Grant Cloud Run runtime service account access to read the secrets:
```bash
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUM=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding DISCORD_WEBHOOK_URL \
  --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Build Container Image with Cloud Build
From the root directory containing the `Dockerfile`:

```bash
gcloud builds submit --tag gcr.io/${PROJECT_ID}/gemini-vault
```

### 4. Deploy to Google Cloud Run
Deploy with the required competition label and secret bindings:

```bash
gcloud run deploy gemini-vault \
  --image gcr.io/${PROJECT_ID}/gemini-vault \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --labels=dev-tutorial=cloud-run-ai-challenge \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest,DISCORD_WEBHOOK_URL=DISCORD_WEBHOOK_URL:latest" \
  --min-instances 0 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1
```

### 5. Verify Health Check Endpoint
Once deployed, verify your service:
```bash
SERVICE_URL=$(gcloud run services describe gemini-vault --region us-central1 --format="value(status.url)")
curl -s "${SERVICE_URL}/api/health"
```

---

## Local Development Setup

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd gemini-vault
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your `GEMINI_API_KEY` and optional `DISCORD_WEBHOOK_URL`.

### 3. Run Development Server
```bash
npm run dev
```
The application will launch at `http://localhost:3000`.

### 4. Build & Production Test Locally
```bash
npm run build
npm start
```

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React, Framer Motion, Canvas Confetti
- **Backend**: Express, TypeScript (`tsx` in dev, `esbuild` bundled CJS for production)
- **AI Engine**: `@google/genai` (Gemini 3.8 Flash, 3.6 Flash, 3.1 Flash-Lite)
- **Database & Auth**: Firebase Authentication & Cloud Firestore
- **Secrets**: Google Cloud Secret Manager
- **Hosting & Ingress**: Google Cloud Run (Containerized via multi-stage Dockerfile)

---

## License

Distributed under the Apache 2.0 License. Built for the Google Cloud Run AI Challenge.
