# Architecture

## Overview

```
┌──────────────────┐      HTTPS/JSON       ┌──────────────────┐
│  React Frontend  │ ───────────────────►  │  Express API     │
│  (Vite build)    │ ◄───────────────────  │  + Socket.io      │
└──────────────────┘      WebSocket        └──────────────────┘
                                                    │  │  │
                                                    │  │  └──► Cloudinary (files, optional)
                                                    │  └─────► Anthropic API (AI, optional)
                                                    └────────► PostgreSQL
                                            node-cron jobs run in-process
                                            (auto-match, reminders, expiry)
```

Straightforward client-server REST + WebSocket architecture. No microservices — unnecessary operational complexity at this scale.

## The organ-matching refinement

The single most important design decision in this codebase: **a compatibility score is a candidate-shortlist signal for medical staff to review, never a matching decision.**

Real organ compatibility depends on HLA/tissue typing, a crossmatch lab test, size/organ-function compatibility, and a transplant team's judgment — none of which an algorithm scoring blood type + organ type + location can determine. Blood is the one case where ABO/Rh compatibility genuinely is close to deterministic.

This shows up throughout the codebase:
- `matches.requires_crossmatch` (`services/matchingService.js`, `requiresCrossmatch()`) — true for everything except Blood
- A `medical_review` status sits between `pending` and `confirmed` for anything requiring crossmatch — **enforced server-side** in `routes/matches.js`'s `/confirm` endpoint, not just hidden in the UI
- Notification/email copy distinguishes "Match Found!" (blood) from "Candidate Match Identified... requires full medical evaluation" (organs)
- The UI shows a visible warning banner on any organ match and labels the confirm action "Approve for medical workup," not "Confirm match"

## Privacy: what the maps do and don't show

The schema stores precise lat/lng on individual donor/recipient accounts (`users.latitude`/`longitude`). **No map in this application plots those.** Every map view (`components/features/HospitalMap.tsx`, backed by `GET /api/analytics/hospital-map`) is aggregated by hospital — an institution, whose location is already public information — never by an individual person's coordinates. Showing an admin a map of patients' exact home addresses would be a real re-identification risk on a health platform, regardless of the admin's intentions.

## Auth: access/refresh split

- Access tokens: JWT, 15-minute expiry, held in memory only on the frontend (never persisted to localStorage)
- Refresh tokens: opaque random strings (not JWTs), stored server-side as a SHA-256 hash, delivered only via an httpOnly cookie scoped to `/api/auth`
- Rotation on every refresh — the previous token is revoked the moment a new one is issued
- 2FA (TOTP, hand-implemented per RFC 6238 — see `services/twoFactorService.js`) available to admin/hospital-staff accounts. A password-correct-but-2FA-pending state issues a purpose-scoped token that `middleware/auth.js` explicitly rejects everywhere except the verification endpoint itself.

## Real-time messaging

Socket.io, authenticated with the same JWT/secret as REST. Room membership (`match:<id>`) is checked on join **and re-checked on every send** — not just trusted from the join step. A shared `services/messageService.js` enforces the identical participant rule for both the REST fallback and the socket layer.

## External services

Every third-party integration (Cloudinary, SMTP, Twilio, Anthropic, reCAPTCHA) follows the same pattern: check for credentials at startup, and if absent, log a clearly-labeled mock action instead of failing. This means the entire feature set is wired and exercisable without signing up for any external account — a real design choice, not a shortcut, since it keeps local development and demos fully functional.

## Scheduled jobs

Three cron jobs (`jobs/scheduler.js`), all sharing the same core matching logic as the manual "Run Matching" button (`services/matchingService.js`) rather than three copies of it:

- **Auto-match** (every 15 min) — catches non-critical requests and anything the SOS trigger missed
- **Donation reminders** (daily) — activates `sendDonationReminder()`, which existed since the first backend pass but was never called until this was wired up
- **Expire stale requests** (daily) — requests get an urgency-scaled `expires_at` at creation (critical: 3 days, low: 30 days)

Critical requests additionally get an **immediate** SOS match attempt at creation time, broadcasting to the top 3 compatible candidates instead of waiting for the next scheduled cycle or picking just one.
