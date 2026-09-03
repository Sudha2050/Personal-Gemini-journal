# Enterprise Security & AI Studio Directives (GEMINI Constitution)

## Core Directives for Personal Gemini Journal
1. **Threat Modeling First**: Proactively isolate tenant documents, sanitize inputs, enforce rate limiting, and output-encode user-generated content.
2. **Database Isolation**: Cloud Firestore data structure enforces `/users/{userId}/entries/{entryId}` with `firestore.rules` denying any unauthorized cross-account access.
3. **Secret Isolation**: `GEMINI_API_KEY` is strictly held on the server side (`server.ts`) and never injected into client-side build artifacts.
4. **Resilience & Production Readiness**: Exponential backoff on Gemini calls, typed JSON response validation, structured audit logging, and full offline-to-online Firebase synchronization.
