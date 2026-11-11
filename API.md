# API Reference

Base URL: `/api`. All authenticated routes expect `Authorization: Bearer <access_token>`.

## Auth (`/auth`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/register` | — | CAPTCHA-verified if `RECAPTCHA_SECRET_KEY` set |
| POST | `/login` | — | Returns `{token, user}`, or `{requires2FA: true, tempToken}` if 2FA is enabled |
| POST | `/2fa/login-verify` | — | `{tempToken, code}` → completes login |
| POST | `/2fa/setup` | admin, hospital_admin | Returns secret + QR code, saves nothing yet |
| POST | `/2fa/confirm` | admin, hospital_admin | `{secret, code}` → persists and enables 2FA |
| POST | `/2fa/disable` | any | Requires current password |
| POST | `/refresh` | — (httpOnly cookie) | Rotates the refresh token |
| POST | `/logout` | — (httpOnly cookie) | Revokes the refresh token server-side |
| GET | `/me` | any | |
| POST | `/change-password` | any | |

## Donors (`/donors`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | admin, hospital_admin | Filterable donor list (blood type, organ, city, status) |
| GET | `/my-donations` | donor | Paginated, includes joined match info |
| GET | `/:id` | any | |
| POST | `/register` | donor, admin | Register a donation |
| PATCH | `/:donationId/verify` | admin, hospital_admin | `{status, notes}` |
| GET | `/eligibility/:userId` | any | 90-day blood eligibility + history |
| POST | `/:donationId/documents` | donor (own), admin | Multipart, field name `document` |

## Recipients (`/recipients`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | admin, hospital_admin | Filterable request list |
| POST | `/request` | recipient, admin, hospital_admin | Critical urgency triggers immediate SOS matching |
| GET | `/my-requests` | any | Includes joined match info |
| PATCH | `/request/:id` | own or admin | |
| POST | `/request/:id/documents` | recipient (own), admin | Multipart, field name `document` |

## Hospitals (`/hospitals`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | any | Optional `lat`/`lng`/`radius` geo filter |
| GET | `/:id` | any | |
| POST | `/` | admin | |
| PATCH | `/:id/verify` | admin | |

## Matches (`/matches`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/run` | admin, hospital_admin | Manual trigger, single-best-match per request |
| GET | `/` | admin, hospital_admin | |
| GET | `/:id/timeline` | match participant | Status history |
| PATCH | `/:id/start-review` | admin, hospital_admin | Organ matches only |
| PATCH | `/:id/confirm` | admin, hospital_admin | Blocked for organ matches until `medical_review` |
| GET | `/compatible/:requestId` | any | |
| GET | `/:id/messages` | match participant | Message history |
| POST | `/:id/messages` | match participant | REST fallback — primary path is the socket `send_message` event |

## Notifications (`/notifications`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | any | Paginated, `?unread_only=true` |
| PATCH | `/:id/read` | any | |
| GET | `/preferences` | any | Returns defaults if never customized |
| PUT | `/preferences` | any | `{email_enabled, sms_enabled}` |

## Analytics (`/analytics`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/public-impact` | — | Aggregate counts only, safe for the public landing page |
| GET | `/dashboard` | admin, hospital_admin | Monthly trends, urgency/organ breakdowns |
| GET | `/hospital-map` | any | Hospital-aggregated, never per-user location |

## AI (`/ai`)

Rate-limited separately (20/15min — real API cost per call). Falls back to a clearly-labeled mock response without `ANTHROPIC_API_KEY`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/explain-match/:matchId` | match participant | Plain-English compatibility explanation |
| POST | `/triage-assist` | any | Emergency-keyword check runs before any AI call |

## Events (`/events`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | — | Upcoming events, public |
| POST | `/` | admin, hospital_admin | |
| POST | `/:id/register` | any | Idempotent |
| DELETE | `/:id/register` | any | |
| GET | `/mine` | any | Event IDs the current user registered for |

## Admin (`/admin`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/stats` | admin, hospital_admin | |
| GET | `/users` | admin | `?role=` filter |
| PATCH | `/users/:id/toggle` | admin | Suspend/reactivate |
| GET | `/audit-logs` | admin | |

## WebSocket events (Socket.io, same JWT auth)

| Event | Direction | Payload |
|---|---|---|
| `join_match` | client → server | `matchId`, ack `{ok}` or `{error}` |
| `send_message` | client → server | `{matchId, body}`, ack `{ok, message}` or `{error}` |
| `new_message` | server → room | Broadcast to everyone in `match:<id>` |
| `leave_match` | client → server | `matchId` |
