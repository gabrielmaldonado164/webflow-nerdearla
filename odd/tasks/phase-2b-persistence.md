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
- [ ] T1 — Data + domain: Drizzle `players` (id uuid pk, created_at, display_name nullable) and `decisions` (per ROADMAP data model) tables, generated migration in `drizzle/`. Pure `src/player/`: player id validation/generation, decision payload parsing/validation, and `recordDecision(input, repo)` that re-grades with the engine and returns the row to insert (rejects invalid cards/actions).
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

## Next step
T1 on `feat/2b-t1-persistence-domain`.
