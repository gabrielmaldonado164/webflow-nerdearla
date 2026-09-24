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
- [x] T1 — Stats: pure `computePlayerStats(decisions)` (totals, accuracy, current and best streak, per-category totals/accuracy, strongest/weakest with a minimum sample), D1 query of a player's decisions, `GET /api/stats` via a pure tested handler.
- [x] T2 — Achievements: pure `deriveAchievements(decisions)` with a small fixed badge catalog (e.g. first perfect decision, 10 correct in a row, 10 soft hands in a row correct, never stood on 12 vs 2 across N such hands, every category attempted, 100 decisions); included in the `/api/stats` response.
- [x] T3 — Adaptive weighting: pure `weightsFromStats(stats)` (`weight = base + weaknessFactor`, bounded) feeding the existing scenario generator; `usePracticeSession` accepts weights and a "practice weakness" focus without breaking seeded determinism.
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
- 2026-09-23: T1 done on `feat/3-t1-stats` (commit c010c43). Strict TDD observed for all three new units (RED confirmed by temporarily removing the just-written implementation and re-running vitest before restoring it, then GREEN): `src/player/playerStats.ts` (`computePlayerStats`, 10 tests), `src/db/decisionsRepository.ts` additions (`decisionRowFromSelectValues` + `listPlayerDecisions`, 4 new tests), `src/app/api/stats/{handler,route}.ts` (`handleStatsRequest`, 6 tests). Checks: `npm test` 426/426 passed, `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build` clean (`/api/stats` registered as a dynamic route). Local smoke test run: `npm run db:migrate:local` (no-op, already applied), `npm run cf:build` + `npx opennextjs-cloudflare preview -- --port 8799` (isolated from the pre-existing dev server on :3000, PID 51367, never touched), `GET /api/stats` with no cookie → 200 empty stats, `POST /api/decisions` x3 → cookie minted, `GET /api/stats` with that cookie → correct totals/per-category stats; preview processes killed afterward, `git status` clean of build artifacts. Assumptions: `MIN_ATTEMPTS_FOR_RANKING = 5` per the task's suggested constant, documented in `playerStats.ts`; a perfect (zero-miss) category is never reported as weakest (mirrors `sessionStats.ts`'s existing convention); strongest/weakest ties break on fixed category order (hard, soft, pair); GET /api/stats response body is `{ stats: PlayerStats }` (T2 will add a sibling `achievements` key, not nest under `stats`).

- 2026-09-23: T2 done on `feat/3-t2-achievements` (commit 913b609). Strict TDD observed throughout (RED confirmed for `deriveAchievements`, RED confirmed again for the `/api/stats` handler's `achievements` field wiring). On the first run against the real implementation, 16/17 `deriveAchievements` tests passed but one (`ten_soft_streak`, interior-miss case) failed on a wrong expected value in the test itself (expected progress 90, correct answer 50 per best-streak semantics); fixed the test assertion, re-ran, 17/17 green — reported honestly rather than as a first-try pass. `src/player/achievements.ts` (`deriveAchievements`, 17 tests) adds a fixed 6-badge catalog: `first_perfect_decision`, `ten_correct_streak`, `ten_soft_streak`, `never_stood_12_vs_2`, `every_category_attempted`, `hundred_decisions`. `GET /api/stats` now returns `{ stats, achievements }`. Checks: `npm test` 443/443 passed, `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build` clean. Local smoke: `npm run cf:build` + preview on an isolated port (8799, pre-existing dev server on :3000/PID 51367 untouched); `GET /api/stats` confirmed to return the full achievements array alongside stats; preview processes killed afterward, `git status` clean. Assumptions: reused `computePlayerStats(...).bestStreak` directly for both the overall and the soft-filtered streak badges (no separate streak helper needed); `never_stood_12_vs_2` uses the row's stored `optimalAction === "hit"` (engine-decided at record time) plus `handValue(playerCards).total === 12` and `dealerUpcard.rank === "2"`, never assuming or re-deriving the strategy table; a single stand violation permanently zeroes that badge's progress for the given history (no partial credit); `every_category_attempted` reuses the newly-exported `CATEGORIES` constant from `playerStats.ts`; progress is always an integer 0-100, capped, with no `null` case. Unresolved: none for T2's stated scope.

- 2026-09-23: T3 done on `feat/3-t3-adaptive-weighting` (commit 7445ba7). Strict TDD observed for both testable units (RED confirmed for `weightsFromStats`, RED confirmed for the `dealNextHandIfAllowed` weighting/distribution-shift test). `src/training/weights.ts` (`weightsFromStats`, 9 tests): `weight = CATEGORY_WEIGHT_BASE(1) + weaknessFactor` (bounded by `MAX_WEAKNESS_FACTOR = 3`) once a category reaches `MIN_ATTEMPTS_FOR_RANKING` (reused from `playerStats.ts`), else a flat `LOW_SAMPLE_EXPLORATION_BOOST = 0.5`; `focusWeakness` multiplies only the weakest category's weight by `FOCUS_WEAKNESS_MULTIPLIER = 4`, leaving the others untouched (so never zeroed — every weight stays `>= 1`). `dealNextHandIfAllowed` (`sessionRng.ts`) takes optional `CategoryWeights`, forwarded to `generateScenario`; a seeded test (`sessionRng.test.ts`) shows a heavily pair-weighted draw shifting the category distribution well above the unweighted baseline (>80% pair share over 60 draws vs. the unweighted baseline), and a second test proves `undefined` weights are byte-for-byte identical to omitting the argument. `usePracticeSession` now takes an optional `weights` option (read once at mount into a ref) and returns `setWeights` for imperative changes — the exact seam T4 needs for a "Practice weakness" toggle; no UI built. Checks: `npm test` 454/454 passed (all 9 pre-existing seeded-determinism/practice tests still green, confirming backward compatibility), `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build` clean. No local smoke test for T3 (task scoped smoke to T1/T2 only; T3 touches no persistence or API surface — verified instead by the seeded unit tests above). Assumptions: `MAX_WEAKNESS_FACTOR = 3`, `LOW_SAMPLE_EXPLORATION_BOOST = 0.5`, `FOCUS_WEAKNESS_MULTIPLIER = 4` are this task's own constants (not specified numerically in the brief), chosen so a 100%-error reliable category tops out at weight 4 (4x baseline) and `focusWeakness` pushes a weak category further (up to 16x baseline combined) while every other category always stays `>= 1`; `usePracticeSession` has no existing unit-test harness in this repo (no `@testing-library/react`/renderHook dependency, and adding one would violate "no new test deps"), so the hook-level wiring itself is verified by type-checking, the existing pixel-casino consumer continuing to build/lint clean, and full coverage at the pure-function layer below it (`weightsFromStats`, `dealNextHandIfAllowed`) — same convention this repo already uses for `route.ts` thin adapters. Unresolved: none for T3's stated scope; T4 will need to decide how "Practice weakness" turns on/off (e.g. call `setWeights(weightsFromStats(stats, { focusWeakness: true }))` vs `setWeights(undefined)`).

## Next step
T4 (`feat/3-t4-skill-map-ui`) — UI task, not in this session's scope.
