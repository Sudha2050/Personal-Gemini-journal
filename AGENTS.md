# AI Studio Engineering & Security Constitution

This document defines the mandatory, enterprise-grade engineering and security directives governing every application build, refactor, and enhancement.

---

## 1. Threat Modeling First (STRIDE & OWASP Top 10)
Before any code is drafted or modified:
- **Spoofing & Authentication**: Every user-facing action requiring identity must be guarded by cryptographic token validation (e.g. Firebase Auth ID tokens or session state).
- **Tampering & Integrity**: All inbound payloads to backend endpoints (`/api/*`) must be strictly validated against schema boundaries (type, length, structure, allowed characters).
- **Repudiation & Auditability**: Security-critical operations (login, logout, record deletion, secret access, PII sanitization) must be recorded in structured audit logs containing timestamp, event name, actor UID, and outcome — with strict scrubbing of PII or credentials.
- **Information Disclosure & Zero Leakage**: Client bundles must never contain server secrets or cross-tenant records. Backend responses must omit internal stack traces and internal identifiers.
- **Denial of Service**: AI endpoints and resource-heavy routes must enforce token caps, prompt length ceilings, rate limiting, and request timeouts.
- **Elevation of Privilege**: Multi-tenant database rules must mathematically guarantee that no user can query, read, update, or delete another user's documents.

---

## 2. Secure Coding Standards (OWASP Compliance)
- **Zero Hardcoded Secrets**: Absolute ban on embedding API keys, database credentials, or private certificates in code, commit history, or client bundles.
- **Strict Separation of Client and Server**: All third-party SDK calls requiring secret keys (e.g., Gemini API, Cloud Secret Manager) must execute exclusively within server-side Express handlers (`/api/*`).
- **Input Sanitization & Output Encoding**: All user inputs must be stripped of dangerous control characters. Rendered dynamic text must be safely escaped to eliminate Cross-Site Scripting (XSS).
- **Defensive Error Handling**: Catch all asynchronous exceptions gracefully. Return sanitized, actionable error structures to the frontend (`{ error: string, code?: string }`).

---

## 3. Database Isolation Rules (Cloud Firestore RLS)
- **Path-Based Tenant Isolation**: In Firestore, all user data must reside in sub-paths anchored by the authenticated user's ID: `/users/{userId}/...`.
- **Enforced Security Rules (`firestore.rules`)**:
  ```firestore-rules
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /{document=**} {
        allow read, write: if false; // Default deny
      }
    }
  }
  ```
- **Zero Cross-User Leakage**: Firestore queries on the client must always target the user's isolated subcollection (`users/${user.uid}/entries`), completely preventing cross-tenant data collisions.

---

## 4. Secret Management Architecture
- **Secret Retrieval**: Secrets must be loaded via runtime environment variables (`process.env.GEMINI_API_KEY`) or Google Cloud Secret Manager at container runtime.
- **Lazy Initialization**: Initialize API SDKs (like `@google/genai`) only when the corresponding endpoint is called, with clear error messaging if credentials are missing or revoked.
- **No Client Exposure**: Ensure variables prefixed with `VITE_` contain strictly public identifiers (e.g., Firebase Client App ID, Public Project ID).

---

## 5. Privacy by Design & PII Protection
- **Client-Side Sanitization**: Detect and redact high-risk Personally Identifiable Information (PII) like phone numbers, Social Security numbers, credit card numbers, and raw email addresses prior to AI ingestion when privacy filters are engaged.
- **Client-Side Cryptographic Lock / Vault**: Support client-side PIN/passcode shielding for sensitive reflections so plain-text thoughts remain protected on shared devices.
- **Data Sovereignty & GDPR Right to Erasure**: Empower users with full 1-click JSON/Markdown data export and an irreversible "Purge All My Data" operation.
