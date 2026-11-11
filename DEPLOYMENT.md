# LifeLink — Complete Deployment Guide

Written by walking the actual codebase, not from a generic template. Every claim below was verified against the real files in this repo — where I found something wrong or missing, I fixed it in the code itself (§12 has the exact diffs), including one real gap in this guide's own first draft (see the note at the top of §9).

---

## 0. Project Analysis

| | |
|---|---|
| **Frontend** | React 19.1 + Vite 6 + TypeScript 5.7, Tailwind CSS v4 |
| **Backend** | Node.js ≥20 + Express 4.18 |
| **Database** | PostgreSQL 13+ (needs `uuid_generate_v4()`, `JSONB`, `LATERAL` joins) |
| **Real-time** | Socket.io 4.8, attached to the same HTTP server as Express |
| **Package manager** | npm on both sides |
| **Build tool** | Vite (frontend); backend ships as plain Node, no build step |
| **Docker** | **Not present.** No `Dockerfile` anywhere. This guide uses platform-native Node buildpacks instead — see §2 for why that's the right call, not a gap |
| **Process manager** | None built in — recommended hosts handle process supervision; §7 covers `pm2` if you self-host on a VM instead |
| **Lock files** | **Not present either** — see the callout in §12. This one matters for you to know about immediately, not just at the end. |

**External services** (all optional — every one degrades to a clearly-labeled mock without credentials, verified in `src/services/*.js`):

| Service | Used for | Required for core functionality? |
|---|---|---|
| Cloudinary | Document/medical-report uploads | No — mocks a URL |
| SMTP (any provider) | Email notifications | No — logs to console |
| Twilio | SMS notifications | No — logs to console |
| Anthropic API | Match explanations, triage assistant | No — returns labeled mock text |
| Google reCAPTCHA v2 | Registration bot protection | No — skips verification |

**Is it production-ready?** Mostly, after the fixes in §12. Already solid before this guide: parameterized SQL everywhere, httpOnly refresh cookies with rotation, rate limiting (general + auth + AI tiers), CORS locked to a single configurable origin, Helmet headers, bcrypt hashing, optional 2FA. Fixed while writing this guide: missing Cloudinary env docs, a stale port reference, no Node version pinning, no response compression, a demo-seed script with zero production guard, a broken CI workflow (details below), and a missing SPA rewrite rule that would 404 every deep link on Vercel.

---

## 1. Deployment Architecture

```
                        ┌─────────────────────────┐
   Browser  ───HTTPS───►│   Vercel (Frontend)      │
                        │   React SPA, static      │
                        │   build served via CDN   │
                        └───────────┬──────────────┘
                                    │
                         HTTPS + WSS (fetch + Socket.io)
                                    │
                        ┌───────────▼──────────────┐
                        │   Render (Backend)        │
                        │   Node/Express, long-      │
                        │   running process,         │
                        │   Socket.io attached       │
                        └───┬─────────┬──────────┬──┘
                            │         │          │
                     ┌──────▼───┐ ┌───▼────┐ ┌───▼──────────┐
                     │  Neon    │ │Cloudinary│ │ Anthropic /  │
                     │ Postgres │ │(uploads) │ │ SMTP/Twilio/ │
                     │          │ │          │ │ reCAPTCHA    │
                     └──────────┘ └──────────┘ └──────────────┘
```

**Why this shape, specifically for this codebase:**

- **The backend cannot be serverless.** It runs `node-cron` jobs in-process (`src/jobs/scheduler.js` — auto-matching every 15 minutes, daily reminders, daily expiry) and holds a live Socket.io server. Both need a long-running process with persistent memory between requests — Vercel/Netlify-style functions cold-start per-request and don't hold state, so cron jobs wouldn't fire reliably and WebSocket connections would drop. This is the single fact driving the platform choice in §2.
- **The frontend has zero server-side requirements** — a pure Vite SPA, no SSR, no API routes living in the frontend. A CDN/static host is strictly better than sharing a host with the backend.
- **Auth** is fully self-contained (JWT access/refresh in `src/routes/auth.js`) — no external auth provider needed.
- **Storage** (Cloudinary) is decoupled — the backend only ever stores URLs in Postgres, never files.

---

## 2. Recommended Hosting Platforms

| Platform | Frontend fit | Backend fit | Verdict |
|---|---|---|---|
| **Vercel** | Excellent — built for this | Poor — serverless-only, breaks cron + Socket.io | Frontend only |
| **Netlify** | Excellent, same tier as Vercel | Poor, same limitation | Frontend only (either works; defaulting to Vercel below) |
| **Render** | Fine, not its strength | **Excellent** — long-running processes, native WebSocket support | **Backend (recommended)** |
| **Railway** | Fine | Excellent, same category as Render | Backend (equally valid) |
| **Fly.io** | Possible | Excellent, better global edge placement | Viable, more ops knowledge required |
| **DigitalOcean** | Fine | Good, pricier at entry or you own process management | Overkill for a first deployment |
| **AWS / Azure / GCP** | Capable of anything | Capable of anything | Wrong choice for "little to no deployment experience" — IAM/VPC/security-group setup is real footgun surface for a first deploy |

### Recommendation: **Vercel (frontend) + Render (backend) + Neon (database)**

**Render over Railway:** both are genuinely comparable. Defaulting to Render because its free tier's health-check/auto-restart matches this project's existing `GET /api/health` (`src/server.js`) with zero config, and its Blueprint format (`render.yaml`, already in this repo) makes the whole service definition one reviewable file instead of dashboard clicks nobody can diff. If you prefer Railway, every command below transfers directly.

**Neon over Supabase/RDS:** Postgres-only free tier (no bundled extras you don't need), git-like branching for testing schema changes safely, SSL by default (matches this project's `DB_SSL` expectation). Supabase is equally valid if you want its table-editor UI.

**No Docker:** none of the recommended platforms need one — they all auto-detect Node from `package.json`. A Dockerfile would be complexity with no payoff on this path; worth adding only if you later move to Fly.io/Kubernetes/a bare VM.

---

## 3. Step-by-Step Deployment

### 3.1 — Local sanity check first

```bash
cd backend
npm install
cp .env.example .env
openssl rand -base64 48   # paste output as JWT_SECRET in .env
# edit .env: fill in DB_* for a local Postgres too

npm run db:setup
npm run db:seed
npm run dev               # :5000
```

```bash
# second terminal
cd frontend
npm install
npm run dev                # :5173, proxies /api and /socket.io to :5000
```

Visit `http://localhost:5173`, log in with `donor@lifelink.org` / `donor123`. **Confirm this works before deploying anything.**

**Important:** this `npm install` is also the step that generates your `package-lock.json` files for the first time (§0, §12) — commit those once they exist:
```bash
git add backend/package-lock.json frontend/package-lock.json
git commit -m "Add lock files"
```

### 3.2 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 3.3 — Database: Neon

1. Sign up at neon.tech, create a project.
2. Copy the connection string (or the separate host/port/db/user/password fields the dashboard also shows).
3. Apply the schema:
   ```bash
   psql "postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require" -f database/schema.sql
   ```
   (No local `psql`? Paste `database/schema.sql`'s contents into Neon's built-in SQL editor instead.)

### 3.4 — Backend: Render

1. Sign up at render.com, connect GitHub.
2. **New → Blueprint**, select your repo — Render detects `render.yaml` and proposes `lifelink-backend`.
3. Fill in the prompted env vars: `JWT_SECRET` (real random value), `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` (from Neon), and `CLIENT_URL` (placeholder for now — fixed in 3.6).
4. Deploy. Watch logs for `Connected to PostgreSQL` and `LifeLink API running on port 5000`.
5. Copy your service URL (`https://lifelink-backend.onrender.com`).
6. Verify: `curl https://lifelink-backend.onrender.com/api/health` → `{"status":"ok",...}`.
7. Optional — seed demo accounts (read the warning in §12 first):
   ```bash
   NODE_ENV=production ALLOW_PROD_SEED=true npm run db:seed
   ```

### 3.5 — Frontend: Vercel

1. Sign up at vercel.com, connect GitHub.
2. **Add New → Project**, select your repo, set **Root Directory** to `frontend`.
3. Confirm auto-detected: Build Command `npm run build`, Output Directory `dist`.
4. Env vars: `VITE_API_URL=https://lifelink-backend.onrender.com/api`, `VITE_SOCKET_URL=https://lifelink-backend.onrender.com`, and `VITE_RECAPTCHA_SITE_KEY` if you're using it.
5. Deploy. Copy your production URL.

### 3.6 — Close the loop: fix CORS

Back on Render → your backend → Environment: update `CLIENT_URL` to your real Vercel URL (no trailing slash). Render redeploys automatically.

**Not optional.** Until this matches exactly, login looks like it works (200 response) but the refresh cookie is silently rejected by the browser and every user gets logged out on refresh. This is the #1 thing people forget — see §10.

### 3.7 — Verify end-to-end

1. Visit your Vercel URL, log in.
2. Refresh — confirms the cross-origin cookie works.
3. Two sessions, shared match, send a chat message — confirms Socket.io works cross-origin.
4. Type a deep link directly into the address bar (e.g. `.../dashboard`) — confirms the SPA rewrite works.

---

## 4. Environment Variables

Full reference lives in `backend/.env.example` (25 vars — 2 truly required: DB credentials + `JWT_SECRET`, everything else optional/mock-fallback) and `frontend/.env.example` (3 vars, all required once frontend/backend are on different domains). Reproduced with explanations there — read the inline comments, they explain *why* each one matters for this specific codebase, not just what it is.

---

## 5. Database Deployment

**Deploying:** §3.3 — Neon (or any managed Postgres 13+), `database/schema.sql` applied once. No migration tool exists in this project — `schema.sql` is the whole schema, applied once to a fresh database. Reapplying it to a database that already has those tables will error on the `CREATE TABLE` statements.

**Connecting:** `backend/src/config/db.js` reads `DB_*` env vars via the standard `pg` pool — nothing to change in code.

**Migrations going forward:** write new changes as separate numbered `.sql` files (`database/migrations/001_x.sql`), test against a Neon branch first, then apply to production — never hand-edit and reapply the original `schema.sql` against a live database.

**Backups:**
```bash
pg_dump "postgresql://user:pass@host/dbname?sslmode=require" > backup-$(date +%Y%m%d).sql
```
Run before any manual production schema change. Neon/Supabase also do automatic point-in-time backups (retention window varies by plan).

**Production best practices specific to this project:**
- `DB_SSL=true` is mandatory against Neon/Supabase/RDS, not optional.
- Connection pool caps at `max: 20` (`db.js`) — reasonable for a free-tier DB; raise only alongside a plan upgrade.
- **Never run `npm run db:seed` against production without `ALLOW_PROD_SEED=true`** — enforced by the script itself now, see §12.

---

## 6. Frontend Deployment

**Build:** `npm run build` = `tsc -b && vite build` — a real type-check gate before the production bundle, so a type error fails the build loudly instead of shipping. Output: `frontend/dist/`, fully static.

**Hosting:** Vercel's CDN. No Node runtime needed on this side.

**Connecting to backend:** entirely via `VITE_API_URL`/`VITE_SOCKET_URL` (§4), inlined at build time — changing them needs a rebuild, not just a config reload.

**Caching:** Vercel's Vite-aware defaults are already correct — hashed asset filenames get long-lived immutable caching, `index.html` never does. Nothing to configure manually.

**PWA caching specifically:** this project precaches the app shell for offline install (`vite-plugin-pwa` in `vite.config.ts`) but deliberately excludes live data (donor status, matches, chat) — see the comment there. Don't widen that cache without thinking it through; stale medical/matching data shown as "current" would be actively misleading.

---

## 7. Backend Deployment

**Build:** none — plain Node, `npm install` is the entire build.

**Production server:** `npm start` → `node src/server.js`. The `if (require.main === module)` guard in that file is what lets it be both a real entry point and a safely-importable module for tests without double-starting anything.

**Process manager:** Render/Railway supervise and restart your process automatically — nothing to configure. Self-hosting on a raw VM instead:
```bash
npm install -g pm2
pm2 start src/server.js --name lifelink-backend
pm2 startup && pm2 save
```

**Logging:** `console.log`/`console.error` throughout — Render/Railway capture stdout/stderr into their dashboard automatically. Structured logging (`pino`/`winston`) would be a reasonable future addition, not a launch blocker.

**Error handling:** centralized in `src/middleware/errorHandler.js` — every route calls `next(err)`. Already turns Postgres unique/FK violations into proper 409/400s, and hides internal messages behind a generic response when `NODE_ENV=production`.

**CORS:** `cors({ origin: env.clientUrl, credentials: true })` — a single exact origin, required for `credentials: true` per spec. This is exactly why `CLIENT_URL` correctness (§3.6) isn't cosmetic — get it wrong and every cross-origin cookie-carrying request is silently blocked, not warned about.

---

## 8. Production Optimizations

**Performance** — TanStack Query caching and Vite code-splitting already in place. Compression was missing entirely (verified: no gzip/brotli middleware anywhere) — added `compression` in `server.js` as part of this guide (§12), a real payload-size win on list endpoints like `GET /api/matches`. Route-level lazy-loading (`React.lazy`) isn't done yet — worth it once the route count grows further.

**Security** — already strong: parameterized SQL everywhere, bcrypt (cost 12), JWT access/refresh rotation, httpOnly+secure+sameSite cookies, TOTP 2FA for privileged roles, three-tier rate limiting. Before a real public launch: generate a fresh `JWT_SECRET` (never the placeholder), confirm `DB_SSL=true`, use scoped API keys/App Passwords for any optional service you enable.

**SEO** — mostly an authenticated app; only the public landing page benefits. Currently just the default Vite `<title>`, no OG tags. Add to `frontend/index.html`:
```html
<meta name="description" content="LifeLink connects verified blood and organ donors with recipients, coordinated with hospitals." />
<meta property="og:title" content="LifeLink — Organ & Blood Donation Platform" />
<meta property="og:image" content="/icon-512.png" />
```

**Image optimization** — generated PWA icons are already reasonably sized. If user-uploaded images grow in volume, Cloudinary can auto-serve WebP via URL params — not currently configured.

**Compression** — fixed, see Performance above.

**Caching** — Redis was discussed during initial planning but never actually implemented anywhere (verified: zero `redis` references in `backend/src`). Analytics hit Postgres directly, fine at current scale.

**Rate limiting** — already tiered and real: general API 100/15min, auth 10/15min, AI 20/15min. Nothing to add for launch.

**Monitoring** — not currently wired up. Render/Railway have basic built-in metrics with zero setup. Sentry (`@sentry/node` + `@sentry/react`) is a reasonable post-launch addition for error tracking.

---

## 9. CI/CD

**A real bug in this guide's own first draft, worth surfacing rather than hiding:** the CI workflow I originally wrote used `npm ci`, which *requires* an existing `package-lock.json` to run at all. This project has never had one generated (no network access during development to run `npm install` — see §0, §12). That workflow would have failed on its very first run with a confusing error unrelated to your actual code. Fixed: it now uses `npm install`, with a comment telling you to switch back to `npm ci` once you've committed a real lock file from your own local install (§3.1) — `npm ci` is faster and fully reproducible, worth switching to once you can.

`.github/workflows/ci.yml` runs on every push/PR to `main`: the real backend Jest suite, and frontend lint + Vitest + production build, as parallel jobs. This is a **quality gate** — a broken commit shows a red X before it reaches anyone.

**It deliberately does not trigger deployment.** Vercel and Render both auto-deploy on push to `main` natively once connected (§3.4, §3.5) — a redundant Actions deploy step would just be more surface area for less benefit than what the platforms already do (including preview deployments and easy rollback).

**If you want Actions to gate deployment** (not just report on it): disable auto-deploy in Render's dashboard, then add:
```yaml
  deploy-backend:
    needs: backend
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"
```
(Deploy hook URL: Render dashboard → service → Settings → Deploy Hook. Store as a GitHub secret, never commit it.)

---

## 10. Common Deployment Issues

**1. Logged out immediately after refreshing.** `CLIENT_URL` on the backend doesn't exactly match your deployed frontend origin (protocol + domain, no trailing slash). Fix in §3.6.

**2. Login works, real-time chat never connects.** `VITE_SOCKET_URL` missing/wrong, or your host doesn't pass through WebSocket upgrade headers. Render/Railway support this by default.

**3. Server crashes on deploy: `Missing required environment variables`.** Working as intended (`src/config/env.js` fails fast instead of silently using an insecure default) — check exact var names against what you set in the dashboard.

**4. Direct navigation to `/dashboard` 404s.** Missing SPA fallback. Fixed for Vercel via `frontend/vercel.json` (§12). Netlify equivalent: a `_redirects` file with `/* /index.html 200`.

**5. Database SSL error.** `DB_SSL` not set to `true` against a managed provider — they all require it.

**6. `npm run db:seed` refuses to run, prints a warning.** Working as intended (§12) — set `ALLOW_PROD_SEED=true` if you genuinely want this in that environment.

**7. Registration/login fail on deployed site with a generic network error.** Usually `VITE_API_URL` missing the `/api` suffix or pointing at the wrong host.

**8. AI/uploads/emails silently "don't work."** Very likely correct, expected behavior — these mock themselves without credentials (§0). Check Render's env vars have real keys if you want them live.

**9. Vercel build fails on a TypeScript error `npm run dev` never showed.** `npm run dev` doesn't type-check; `npm run build` does. Run `npm run build` locally before pushing to catch this earlier.

**10. Render free tier takes 30-60s to respond after being idle.** Free-tier cold start, not a bug — a paid plan removes this.

**11. `npm ci` fails in CI with a lockfile error.** See §9 — already fixed in this repo's `ci.yml`, but worth knowing why if you ever see this pattern elsewhere: `npm ci` needs a committed `package-lock.json`; `npm install` doesn't.

---

## 11. Deployment Checklist

**Before you start**
- [ ] Local `npm run dev` (both sides) works end-to-end against local Postgres
- [ ] `package-lock.json` generated (§3.1) and committed for both `backend/` and `frontend/`
- [ ] Code pushed to GitHub

**Database**
- [ ] Neon project created, `database/schema.sql` applied
- [ ] Credentials saved somewhere safe — not in the repo

**Backend**
- [ ] Deployed on Render via `render.yaml`
- [ ] `JWT_SECRET` is a real generated value
- [ ] `DB_SSL=true`, `NODE_ENV=production`
- [ ] `GET /api/health` returns 200
- [ ] Logs show a clean `Connected to PostgreSQL`

**Frontend**
- [ ] Deployed on Vercel, root directory = `frontend`
- [ ] `VITE_API_URL` / `VITE_SOCKET_URL` point at the real backend
- [ ] `npm run build` succeeds with no TypeScript errors

**Closing the loop**
- [ ] Backend `CLIENT_URL` updated to the real frontend URL — **the one everyone forgets**
- [ ] Login survives a refresh
- [ ] Chat connects between two sessions
- [ ] A typed deep link doesn't 404

**Before calling it live**
- [ ] Decide on production seeding — if yes, change those passwords immediately after (they're public in `README.md`)
- [ ] Optional services configured with real keys, or consciously left in mock mode
- [ ] `.env` was never committed: `git log --all --full-history -- backend/.env` comes back empty

---

## 12. Project-Specific Changes Made

| File | Change | Why |
|---|---|---|
| `backend/.env.example` | Removed unused `GOOGLE_MAPS_API_KEY` (this project's maps use Leaflet/OpenStreetMap); added the entire missing Cloudinary section; fixed `CLIENT_URL`'s example port from `:3000` to `:5173`; labeled every var REQUIRED/OPTIONAL | A `.env.example` documenting the wrong port or missing real vars actively misleads whoever sets this up next |
| `backend/package.json` | Added `engines.node >=20.0.0`; added `compression` dependency | Explicit Node version avoids a hosting platform guessing wrong; compression was a genuine, verified gap |
| `backend/src/server.js` | Added `compression()` middleware after `helmet()` | Real payload-size reduction on JSON responses; this project never had it |
| `backend/src/scripts/seedDemoUsers.js` | Refuses to run when `NODE_ENV=production` unless `ALLOW_PROD_SEED=true` | **The change with real teeth.** Demo passwords are published in `README.md`. Unguarded, `npm run db:seed` would silently create a real admin account with a public password on whatever DB it's pointed at. Tested all three branches directly against the guard logic. |
| `frontend/package.json` | Added `engines.node >=20.0.0` | Same reasoning as backend |
| `frontend/vercel.json` | New — SPA rewrite (`/* → /index.html`) | Without it, Vercel 404s on any direct navigation to a client-side route |
| `render.yaml` | New — Render Blueprint | One-file, reviewable service definition instead of dashboard clicks; secrets marked `sync: false` so the file never risks holding real credentials |
| `.github/workflows/ci.yml` | New, then fixed mid-guide (see §9) — quality-gate CI on push/PR to `main` | Requested explicitly; scoped as a gate, not a redundant deploy mechanism |
| `.gitignore` | Added `frontend/dev-dist/` | `vite-plugin-pwa`'s dev-mode service worker output shouldn't be committed |

**Known limitation carried forward, not fixed:** no `package-lock.json` exists anywhere in this project (§0) — there was never network access available to run a real `npm install` during development. This is the one thing in this entire guide that isn't a "fix," just an honest gap: your first real `npm install` (§3.1) generates it for real, and you should commit what it produces.

---

## Roadmap: Local Machine → Live Production Site

1. `npm install` both sides, confirm login works locally, commit the generated lock files (§3.1)
2. Push to GitHub (§3.2)
3. Neon Postgres project, apply `database/schema.sql` (§3.3)
4. Deploy backend on Render via `render.yaml` (§3.4)
5. Deploy frontend on Vercel (§3.5)
6. Fix `CLIENT_URL` on Render to match the real Vercel URL — the step almost everyone forgets (§3.6)
7. Verify: refresh keeps you logged in, chat connects, deep links don't 404 (§3.7)
8. Walk the checklist in §11 before telling anyone it's live

Every command above is copy-pasteable as written.
