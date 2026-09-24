# Phase 3 — Stats, Skill Map, adaptive practice, achievements

## Objective
Turn persisted decisions into visible progress: per-player stats, a per-category Skill Map, a "Practice weakness" mode that biases scenarios toward the weakest category, and achievements — all inside the game.

## Problem / why
Phase 2b stores every decision, but the player never sees long-term progress. The demo script needs "personalized stats" within 60 s, and Phase 4's coach tool `get_player_stats` needs a stats function.

## Scope
- In: pure stats + achievements derivation, `GET /api/stats`, adaptive scenario weighting + "Practice weakness", Skill Map panel opened from the HUD (pixel-art overlay over the table) with a short summary on the game-over overlay.
- Out: AI coach (Phase 4), daily challenge/leaderboard (Phase 5), separate `/stats` route (owner chose the HUD panel, 2026-09-23).

## Constraints
- Strategy and categories come from the engine (`src/blackjack`); never fork rules in the UI.
- Stats/achievements/weights are pure TypeScript, test-first, no new test deps; routes are thin adapters (handler pattern from `src/app/api/decisions/handler.ts`).
- `GET /api/stats` never mints a cookie; no/invalid cookie → empty stats `200`.
- The app must work when the API fails: the panel falls back to in-session stats (`src/features/practice/sessionStats.ts`).
- `runtime = "nodejs"`; client fetch prefixed with `NEXT_PUBLIC_BASE_PATH`.
- Mobile-first; respect `prefers-reduced-motion`; keyboard accessible panel (Esc closes, focus management).

## TDD
- Mode: Strict TDD, enabled (source: user global CLAUDE.md "Strict TDD Mode: enabled"; project CLAUDE.md "developed test-first").
- Runner: `npm test` (vitest, node environment, `src/**/*.test.ts`).

## Checks (every task)
`npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`; UI task adds mobile + desktop screenshots.

## Tasks
- [ ] T1 — Stats: pure `computePlayerStats(decisions)` (totals, accuracy, current and best streak, per-category totals/accuracy, strongest/weakest with a minimum sample), D1 query of a player's decisions, `GET /api/stats` via a pure tested handler.
- [ ] T2 — Achievements: pure `deriveAchievements(decisions)` with a small fixed badge catalog (e.g. first perfect decision, 10 correct in a row, 10 soft hands in a row correct, never stood on 12 vs 2 across N such hands, every category attempted, 100 decisions); included in the `/api/stats` response.
- [ ] T3 — Adaptive weighting: pure `weightsFromStats(stats)` (`weight = base + weaknessFactor`, bounded) feeding the existing scenario generator; `usePracticeSession` accepts weights and a "practice weakness" focus without breaking seeded determinism.
- [ ] T4 — UI: HUD "Skill Map" button → pixel-art panel overlay (per-category bars, accuracy, streaks, badges, "Practice weakness" toggle), fetched from `/api/stats` and refreshed after decisions, falling back to session stats offline; short summary on the game-over overlay. Mobile/desktop screenshots.

## Acceptance criteria
- A player with persisted decisions opens the Skill Map and sees accurate per-category progress and earned badges.
- "Practice weakness" measurably shifts scenarios toward the weakest category (tested on the pure weighting).
- With `/api/stats` failing, the panel still shows session stats and the game plays identically.

## Delivery
- Strategy: `ask-on-risk`; reusing the owner's standing **feature-branch-chain**. Stacked on `feat/2b-t3-client-wiring`: `feat/3-t1-stats` → `feat/3-t2-achievements` → `feat/3-t3-adaptive-weighting` → `feat/3-t4-skill-map-ui`.
- Forecast: ~900–1300 authored changed lines.
- Last reviewed boundary: 5ca76cf (Phase 2b T5 commits 60d70eb..2f65905 pending in the slice, under budget).

## Route per task
| Task | Route | Trigger evidence |
|---|---|---|
| T1–T3 | Delegated writer | 2+ non-trivial files per task |
| T4 | Delegated writer | 2+ non-trivial files |

## Progress
- 2026-09-23: Document created. Owner approved Phase 3 and chose the HUD panel for the Skill Map.

## Next step
T1 on `feat/3-t1-stats`.
