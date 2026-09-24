# Phase 2b — Anonymous player + decision persistence

## Objective
Every accepted decision is stored in D1 against an anonymous player identified by a cookie, without adding friction or making the game depend on the backend.

## Problem / why
Progress is browser-session-only. Phase 3 (stats, skill map) and Phase 4 (AI coach `get_player_stats`) need a durable per-player decision history. `usePracticeSession` already exposes the `onDecision(record)` seam for this.

## Scope
- In: `players` and `decisions` tables + migration; anonymous player cookie; `POST /api/decisions`; client wiring through `onDecision`; roadmap update.
- Out: stats API and skill map (Phase 3), daily challenge tables (Phase 5), coach usage (Phase 4), auth (never, D4).

## Constraints
- D2: the server recomputes `optimal_action`, `is_correct`, `available_actions`, and `category` with the deterministic engine; the client's grading is never trusted.
- D4: anonymous UUID cookie, no auth. Cookie is `httpOnly`, `sameSite=lax`, `secure` in production, long-lived.
- D7-style resilience: the game must keep working when persistence fails (fire-and-forget, errors swallowed, no UI blocking).
- API routes: `export const runtime = "nodejs"` (not `edge`); thin adapters over pure domain code; `getCloudflareContext()` only inside functions.
- Client `fetch` uses `process.env.NEXT_PUBLIC_BASE_PATH` as prefix. Never set `basePath`/`assetPrefix`.
- Domain code in `src/player` is pure TypeScript, test-first, no new test dependencies (inject the repository).

## TDD
- Mode: Strict TDD, enabled (source: user global CLAUDE.md "Strict TDD Mode: enabled"; project CLAUDE.md "developed test-first").
- Runner: `npm test` (vitest, node environment, `src/**/*.test.ts`).

## Checks (every task)
`npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Tasks
- [x] T1 — Data + domain: Drizzle `players` (id uuid pk, created_at, display_name nullable) and `decisions` (per ROADMAP data model) tables, generated migration in `drizzle/`. Pure `src/player/`: player id validation/generation, decision payload parsing/validation, and `recordDecision(input, repo)` that re-grades with the engine and returns the row to insert (rejects invalid cards/actions).
- [x] T2 — API: `POST /api/decisions` thin route: read or mint the player cookie (insert `players` row when new), parse body, call `recordDecision` with a D1-backed repo, respond `201`/`400`. Cookie helpers tested as pure functions.
- [ ] T3 — Client: pure request builder (base path, JSON body from `DecisionRecord`); fire-and-forget sender (`keepalive`, errors swallowed); wire it into `PixelCasinoScreen` via `usePracticeSession({ onDecision })` with a stable callback. Update `docs/ROADMAP.md` (Phase 2b checkboxes, stale Phase 2c "T5 review pending" state, Progress Log).

## Acceptance criteria
- A fresh browser gets a player cookie on its first decision and one `players` row; each accepted decision creates exactly one `decisions` row with server-computed grading.
- A malformed or tampered payload returns 400 and stores nothing.
- With the API failing or offline, the game plays identically.

## Delivery
- Strategy: `ask-on-risk`; reusing the owner's standing chain choice **feature-branch-chain** (from Phase 2c). One branch per task stacked on `feat/2c-t5-game-ui`: `feat/2b-t1-persistence-domain` → `feat/2b-t2-decisions-api` → `feat/2b-t3-client-wiring`.
- Forecast: ~500–700 authored changed lines across T1–T3.
- Last reviewed boundary: 1d402e7 (Phase 2c T5-fix lineage review-9d053cdf12623359).

## Route per task
| Task | Route | Trigger evidence |
|---|---|---|
| T1–T3 | Delegated writer | 2+ non-trivial files per task |

## Progress
- 2026-09-23: Document created. Owner approved starting Phase 2b.
- 2026-09-23: T1 done on `feat/2b-t1-persistence-domain` (4c6d19a `feat(player): add players/decisions schema and decision domain`). Added `players`/`decisions` Drizzle tables and generated migration `drizzle/0001_safe_wind_dancer.sql` via `npm run db:generate` (no hand-written SQL needed). Added pure `src/player/`: `playerId.ts` (UUID validate/generate), `decisionPayload.ts` (structural parse/validation of an untrusted request body — unknown ranks/suits/actions rejected), `recordDecision.ts` (re-grades with `availableActions`/`optimalAction`/`classifyScenario` against `DEFAULT_RULES`, rejects a `userAction` not in the computed available set, inserts via an injected `DecisionRepository`, propagates repo failures). TDD: RED confirmed (3 new test files failed on missing modules), then GREEN (32/32 new tests passing; one test's expectation was corrected — a 2-card hand always allows `double` under `DEFAULT_RULES`, not just `hit`/`stand`). Checks: `npm test` 30 files/368 tests passed; `npx tsc --noEmit` clean; `npm run lint` clean (fixed one no-unused-vars warning by rewriting a test fixture instead of destructure-omit); `npm run build` clean (Next 16.3.6, Turbopack). Smoke test skipped — see below.

## Assumptions made (T1)
- `DecisionRow.playerCards`/`dealerUpcard`/`availableActions` are kept as structured data (`Card[]`/`Action[]`), not JSON strings, in the domain layer; the "store cards as JSON text" constraint is a D1-repository-layer concern for T2 (`JSON.stringify` right before `insert`), keeping `src/player/` free of DB-encoding details and easy to unit test.
- `recordDecision` takes an already-shape-validated `RecordDecisionInput` (built from `DecisionPayload` + `playerId`); the T2 route is expected to call `parseDecisionPayload` first (400 on structural failure) and only then `recordDecision` (400 on `{ ok: false }`, i.e. legal-but-unavailable action), which `recordDecision` itself does not distinguish by HTTP status — that mapping belongs to the route.
- `recordDecision` lets a repository failure reject/throw rather than swallowing it into a result variant, matching the codebase's existing `throw new Error(...)` convention for exceptional cases (`scenario.ts`, `resolve.ts`); T2's route is expected to `try/catch` around the call for the `500` response.
- Player-id UUID validation accepts any RFC-4122-shaped UUID (8-4-4-4-12 hex, case-insensitive), not just v4, since the constraint is "reject not-a-UUID", not "reject anything but our own generator's output".

- 2026-09-23: T2 done on `feat/2b-t2-decisions-api` (1e53097 `feat(api): add POST /api/decisions with anonymous player cookie`). Added pure, tested `src/player/playerCookie.ts` (`PLAYER_COOKIE_NAME = "lab_player"`, `resolvePlayerId` — reuse a valid UUID cookie or mint one, `playerCookieOptions` — httpOnly/sameSite=lax/secure-parametrized/path=`/`/~1yr maxAge). Added the thin `src/db/decisionsRepository.ts` (D1-backed `DecisionRepository` + `ensurePlayer` insert-if-missing via `onConflictDoNothing()`) and `src/app/api/decisions/route.ts` (`runtime = "nodejs"`; resolves/mints the cookie, ensures the player row, sets the cookie, parses the body, calls `recordDecision`, maps to `201`/`400`/`500`). TDD: RED confirmed for the new cookie-helper tests (module not found), GREEN after implementing (7 new tests; 39/39 in `src/player`). Checks: `npm test` 31 files/375 tests passed; `npx tsc --noEmit` clean; `npm run lint` clean; `npm run build` clean (route shows as `ƒ /api/decisions`, dynamic). Smoke test: **done**, see below.

## Assumptions made (T2)
- The cookie is set (and the `players` row ensured) unconditionally once a player id is resolved — before body parsing — matching the task's literal step order; it is *not* gated on the decision itself being valid. A malformed-JSON or game-illegal-action request (400) still gets/keeps its player cookie and player row, since establishing anonymous identity is independent of whether this particular decision was accepted. Only the `decisions` table is guaranteed empty for a rejected request.
- `secure` is derived from `process.env.NODE_ENV === "production"` (no other environment signal available in this Next.js/OpenNext setup); verified in the smoke test below that `next build` + `cf:preview` (which runs a production build) sets `Secure` on the cookie.
- Error responses use `Response.json({ error: <string> }, { status })`; the 500 case logs the real error server-side via `console.error` (for operability) but only ever returns a fixed, generic message to the client, never `error.message` or a stack.
- A repeat request with an already-valid cookie does not re-run `ensurePlayer`'s actual insert (it's `INSERT ... ON CONFLICT DO NOTHING`), so no duplicate-key error path exists to test.

## Smoke test
Ran locally: `npm run db:migrate:local` (applied both migrations to `.wrangler/state/v3/d1`), then `npm run cf:preview` (OpenNext build + `wrangler dev` on `http://localhost:8787`, a real Workers runtime against local D1 — this *is* the repo's existing dev/preview setup, no remote access or interactive login needed).
- `POST /api/decisions` with a fresh (no-cookie) request → `201`, `Set-Cookie: lab_player=<uuid>; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=lax` (secure because `cf:preview` runs a production build), one `players` row inserted (verified via `wrangler d1 execute DB --local`), one `decisions` row with server-computed `optimal_action="hit"`, `is_correct=1`, `category="hard"`, cards stored as JSON text.
- Repeat `POST` with the same cookie (a pair 8-8 vs dealer 6, `userAction: "split"`) → `201`, same `lab_player` cookie value reused, `players` count stayed at 1, a second `decisions` row inserted (`category="pair"`, `optimal_action="split"`, `is_correct=1`).
- `POST` with `playerCards` containing only one card → `400 {"error":"playerCards must be an array of at least two cards"}`, no new `decisions` row.
- `POST` with a legal-shaped but illegal `userAction: "double"` on a 3-card hand → `400 {"error":"\"double\" is not available for this hand"}`, no new `decisions` row.
- Final state: exactly 1 `players` row, exactly 2 `decisions` rows (the two accepted requests) — confirms "malformed/illegal payload returns 400 and stores nothing" and "one cookie/player, one row per accepted decision".
- Cleaned up: killed the preview server afterward; `.wrangler/` and `.open-next/` are gitignored, so the local D1 state used for this smoke test isn't part of the commit.

## Next step
T3 on `feat/2b-t3-client-wiring` (branch from this commit).
