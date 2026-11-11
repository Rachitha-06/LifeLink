# Testing

This project was built without network access in the development environment — no `npm install` was ever run there. That shaped how verification actually happened, and it's worth being precise about what was checked how, rather than implying a uniform level of confidence across everything.

## What has a real, runnable test suite

- `backend/tests/twoFactorService.test.js` — TOTP implementation checked against the **official RFC 6238 Appendix B test vectors**, not just round-tripped against its own output. All 5 vectors plus edge cases (wrong code, wrong length, clock drift tolerance) — executed for real during development via a minimal Jest-API-compatible shim and passed.
- `backend/tests/matchingService.test.js` — blood compatibility rules, scoring, the organ-matching refinement, and candidate ranking (including the SOS broadcast's topN behavior). Executed for real, passed.
- `backend/tests/tokenService.test.js` — refresh token issue/verify/rotate/revoke lifecycle, access token claims, 2FA-pending token shape. Executed for real (via Jest's mocking pattern, `jest.mock('../src/config/db')`), passed.
- `frontend/src/lib/statusColors.test.ts` — confirms every status enum value has a badge color mapping. Executed for real via `tsx`, passed. This is exactly the kind of test that would have caught the Milestone 4 gap where `MatchStatus` gained a `medical_review` value before the color map was updated.

## What's written correctly but wasn't executed in this environment

- `backend/tests/auth.test.js` — proper Supertest-based end-to-end tests (register, login, the full 2FA login flow, tempToken rejection on protected routes). The **underlying logic** was verified separately, for real, via direct route-handler invocation during Milestone 9's development (11/11 assertions passing) — but this specific file, using real HTTP requests through Supertest, needs the actual `supertest`/`express` packages to run. Building a fully HTTP-functional Express-compatible stub from scratch was outside reasonable scope for a verification shim. Run `npm test` after `npm install` to execute this for real.
- `frontend/src/components/ui/Button.test.tsx` — correctly structured Testing Library test, not executed (needs jsdom + `@testing-library/react`, not installable without network access here).

## What was verified by direct logic execution rather than a checked-in test file

Several pieces of business logic were verified during development using ad-hoc scripts (in-memory fake database, direct handler invocation) that aren't part of the checked-in suite but represent real, passing verification at the time each milestone was built:

- The organ-matching gating logic (organ matches blocked from confirmation until `medical_review`, blood matches can skip it) — 5/5 assertions
- The SOS broadcast (top-3 candidate ranking, exclusion of incompatible donors) — 7/7 assertions
- The full 2FA login flow end-to-end, including the tempToken security boundary — 11/11 assertions
- The `two_factor_secret` leak fix — confirmed the secret never appears in any auth response

## The honest bottom line

Business logic that determines who gets matched with whom, what a hospital can and can't confirm, and how auth/2FA tokens behave has real verification behind it — either as a checked-in, executable test, or as logic proven correct through direct execution during development. Full end-to-end HTTP-level testing and component rendering tests are correctly written but need a real `npm install` to actually run. **Treat that first real test run as part of finishing this project, not a formality** — it's the one verification step that genuinely could not happen here.
