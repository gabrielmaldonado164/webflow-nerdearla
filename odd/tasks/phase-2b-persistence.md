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
- [ ] T2 — API: `POST /api/decisions` thin route: read or mint the player cookie (insert `players` row when new), parse body, call `recordDecision` with a D1-backed repo, respond `201`/`400`. Cookie helpers tested as pure functions.
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

## Smoke test
Skipped: T1 has no API route or client wiring yet (that's T2/T3), so there is nothing to exercise via `db:migrate:local` + a live request. Will attempt the full local D1 smoke test after T2.

## Next step
T2 on `feat/2b-t2-decisions-api` (branch from this commit).
