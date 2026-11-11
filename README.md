# LifeLink — Organ & Blood Donation Platform

A full-stack platform connecting blood and organ donors with recipients, coordinated with hospitals — automated compatibility matching, real-time messaging, AI-assisted intake, and a full admin/hospital-staff console.

Built in 12 milestones on top of an initial backend + static-HTML prototype. See `docs/ARCHITECTURE.md` for how the pieces fit together and `docs/API.md` for the full endpoint reference.

## Stack

- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS v4, TanStack Query, Zustand, React Hook Form + Zod, Recharts, React-Leaflet, Socket.io-client, i18next
- **Backend:** Node.js + Express, PostgreSQL, Socket.io, node-cron, JWT (access/refresh split with rotation), TOTP 2FA (hand-implemented, RFC 6238-verified)
- **External services** (all optional in development — see below): Cloudinary (file uploads), SMTP (email), Twilio (SMS), Anthropic API (AI features), Google reCAPTCHA

## Quick start

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in DB credentials at minimum; everything else is optional
npm run db:setup       # creates all tables from database/schema.sql
npm run db:seed        # seeds the 4 demo accounts referenced below
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`. The Vite dev server proxies `/api` and `/socket.io` to the backend on port 5000 — no CORS setup needed locally.

### Demo accounts

Created by `npm run db:seed`:

| Role | Email | Password |
|---|---|---|
| Donor | donor@lifelink.org | donor123 |
| Recipient | patient@lifelink.org | recip123 |
| Hospital staff | hospital@lifelink.org | hosp123 |
| Admin | admin@lifelink.org | admin123 |

## Optional external services

Every external integration in this project degrades gracefully without credentials — the feature stays fully wired and testable, it just logs a mock action instead of calling the real service. None of these are required to run the app locally:

| Service | Used for | Env vars |
|---|---|---|
| Cloudinary | Medical report/document uploads | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| SMTP (Gmail or any provider) | Email notifications | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` |
| Twilio | SMS notifications | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE` |
| Anthropic API | Match explanations, triage assistant | `ANTHROPIC_API_KEY` |
| Google reCAPTCHA v2 | Registration bot protection | `RECAPTCHA_SECRET_KEY` (backend), `VITE_RECAPTCHA_SITE_KEY` (frontend) |

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the complete guide — architecture, hosting recommendations, exact step-by-step commands, environment variables, and a pre-launch checklist, all specific to this project's actual code.

## Testing

```bash
cd backend && npm test    # Jest + Supertest
cd frontend && npm test   # Vitest + Testing Library
```

See `docs/TESTING.md` for what's covered and — importantly — what was verified through other means during development versus what these formal suites cover.

## Project structure

```
lifelink/
├── backend/
│   ├── src/
│   │   ├── config/       # env validation, DB pool
│   │   ├── middleware/   # auth, error handling, uploads
│   │   ├── routes/       # one file per resource
│   │   ├── services/     # business logic (matching, tokens, 2FA, AI, notifications...)
│   │   ├── sockets/      # Socket.io real-time messaging
│   │   ├── jobs/         # scheduled cron jobs
│   │   └── server.js
│   └── tests/
├── frontend/
│   └── src/
│       ├── api/           # typed API client functions, one file per resource
│       ├── hooks/         # React Query hooks
│       ├── components/
│       │   ├── ui/         # design system primitives
│       │   ├── layout/     # AppShell (dashboard chrome)
│       │   └── features/   # feature-specific components
│       ├── pages/
│       │   └── dashboard/  # one dashboard per role
│       ├── store/          # Zustand auth store
│       ├── i18n/           # translations (en, hi)
│       └── types/
├── database/
│   └── schema.sql
└── docs/
```

## Known limitations / honest scope notes

- **Multi-language coverage** is real infrastructure (i18next, verified key-parity between locales) but covers core flows (landing page, auth, dashboard nav) — not every micro-copy string in every feature panel.
- **Frontend build was never run end-to-end in the environment this was built in** (no network access for `npm install`). Every file was verified via real syntax parsing (esbuild), import/export resolution checks, and — for business logic — direct execution against fake/mocked data. Treat your first real `npm install && npm run dev` on both frontend and backend as part of finishing this project, not a formality.
- **Maps deliberately never plot individual donor/recipient locations** — only hospital-aggregated data. See the note in `docs/ARCHITECTURE.md`.
- **Redis was planned during initial architecture discussion but never implemented** — analytics/dashboard queries hit Postgres directly. Fine at this scale; would be a real addition if traffic grew.
