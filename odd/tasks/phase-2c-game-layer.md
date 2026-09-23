# Phase 2c — Game layer

## Objective
Make 21 Lab feel like a web game, not a polished page: real hands that play out, a dealer hole-card flip, run mode with lives, combo scoring, sound, and mistake feedback.

## Problem / why
The owner accepted the Pixel Arcade visuals (2026-09-23) but the experience is still a decision quiz: the dealer's hidden card is decorative, hands never resolve, and there is no tension, goal, or audio. Judges must feel a game within 30 seconds.

## Scope
- In: engine hand resolution (dealer hole card + S17 dealer play + outcome), run mode (lives, score, combo, best score), Web Audio SFX + mute, screen shake/vibration, UI wiring, and the Phase 2a review follow-ups.
- Out: persistence (Phase 2b), achievements (Phase 3), money/bets/chips (never).

## Constraints
- Grading judges the decision against `optimalAction`, never the hand outcome.
- `src/blackjack` and `src/training` stay pure TypeScript, developed test-first.
- No new test dependencies: extract pure logic (reducers, key mapping) instead of rendering hooks/components in tests.
- No audio files; no sound before the first user interaction; respect `prefers-reduced-motion`.
- Do not fork strategy rules in the UI.

## TDD
- Mode: Strict TDD, enabled (source: user global CLAUDE.md "Strict TDD Mode: enabled"; project CLAUDE.md "developed test-first").
- Runner: `npm test` (vitest, node environment, `src/**/*.test.ts`).

## Checks (every task)
`npm test`, `npx tsc --noEmit`, `npm run lint`; `npm run build` on UI tasks.

## Tasks
- [x] T1 — Engine: hand resolution in `src/blackjack/resolve.ts`. Deal a real hole card from a seeded RNG; play out the player's chosen action (hit/stand/double; split plays each hand by basic strategy); dealer draws to 17 and stands on soft 17 per `GameRules`; outcome per hand: win / lose / push / blackjack. Plus review follow-up: explain sweep test asserts the message family matches `optimalAction`.
- [x] T2 — Training: run mode in `src/training/run.ts`. Pure reducer: 3 lives, a wrong decision costs one, score with combo multiplier (x1, x2 at streak 3, x3 at streak 6…), game over, restart, best score. Plus review follow-up: export XP award constants from `progress.ts` and use them in the screen.
- [x] T3 — Session: extract a pure practice-session reducer from `usePracticeSession` (single decision while feedback is pending, one `onDecision` per decision, next clears feedback) with tests; wire the hole card, resolution, and run state through it. Pure `keyToCommand` mapping with tests (review follow-up).
- [x] T4 — Sound: `src/features/pixel-casino/sound.ts` Web Audio synth (deal, flip, correct, mistake, combo, game over), lazy AudioContext on first interaction, mute persisted with guarded `localStorage`; pure parts tested.
- [x] T5 — UI: hole-card flip, dealer draws, outcome banner, lives/score/combo HUD, game over + restart screen, shake + `navigator.vibrate` on mistakes, mute toggle, sound calls. Mobile and desktop QA via screenshots.

## Delivery
- Strategy: `ask-on-risk` → owner chose **feature-branch-chain** (2026-09-23). One branch per task, stacked: `feat/phase-2a-pixel-arcade` → `feat/2c-t1-hand-resolution` → `feat/2c-t2-run-mode` → `feat/2c-t3-session-reducer` → `feat/2c-t4-sound` → `feat/2c-t5-game-ui`. Each PR targets the previous branch; merge in order.
- Forecast: ~1200–1600 authored changed lines across T1–T5.
- Last reviewed boundary: 449275d (T3-fix + T4 lineage review-df3adeb3034bd8b1 approved + acknowledged; earlier: review-5fdae880c51aa8be, review-d032dc5df892a740, review-7659ea5ddda7d84c).

## Route per task
| Task | Route | Trigger evidence |
|---|---|---|
| T1–T5 | Delegated writer | 2+ non-trivial files per task |

## Progress
- 2026-09-23: Document created. Owner accepted Pixel Arcade visuals. Chain strategy: feature-branch-chain.
- 2026-09-23: T1 done (delegated writer): 266bf82 `resolveHand`/`dealHoleCard` (peek-safe hole card, first action exact then basic-strategy auto-play, split aces one card each per rules, S17 dealer, steps for animation); 842d140 stronger explain sweep test exposed and fixed the never-split-tens perfect message not naming stand. RED/GREEN observed; 162 tests, tsc, lint clean. Assess: medium, review due (slice_budget_reached, 681 lines from 05da0b7).
- 2026-09-23: T1 review approved (reliability lens). Non-blocking follow-ups: playToCompletion treats any non-stand/double action as hit (throw on unexpected action; test a split hand receiving a matching card); untested H17 dealer and non-restricted split-aces branches; unbounded dealHoleCard redraw (bound and throw).
- 2026-09-23: T1 follow-ups done on `feat/2c-t1-hand-resolution` (16eb4d8): explicit action switch that throws on unexpected actions (optimalAction never returns split after a split, pinned by test), H17 and unrestricted split-aces tests, bounded hole-card redraw (RED observed as a hang). Pinned-branch tests passed on first run (no RED, existing behavior).
- 2026-09-23: T2 done on `feat/2c-t2-run-mode`: 580eb5a `src/training/run.ts` (3 lives, BASE_POINTS 100, multiplier x2/x3/x4 at streak 3/6/9, game over, restart keeps bestScore; bestScore updates on game over), ab5f307 shared XP constants. RED/GREEN observed; 179 tests, tsc, lint clean. Assess from 6df07eb: medium, review due (434 lines).
- 2026-09-23: T1-fix + T2 review approved. Follow-ups: restart mid-run dropped the live score from bestScore — decided (parent, owner may override) that an abandoned run still counts, so restart folds `max(bestScore, score)`; add a test that game over keeps a higher stored best. Both folded into T3.
- 2026-09-23: T2 follow-up on `feat/2c-t2-run-mode` (f002e36): restart keeps max(best, score); game-over keeps a higher stored best. RED/GREEN observed.
- 2026-09-23: T3 done on `feat/2c-t3-session-reducer`: 0feb21d pure `sessionReducer` + `applyDecision` (deal/decide/restart; decide ignored when pending, over, or unavailable; one record per accepted decision); b254869 `keyToCommand`; 0950a79 `usePracticeSession` on `useReducer` with a synced ref so `onDecision` fires once per accepted decision, exposes holeCard, run, feedback.resolution, restart. RED/GREEN observed; 217 tests, tsc, lint, build clean.

- 2026-09-23: T3 review approved. Follow-ups (fold into T4 start): `choose`/`next` consume the seeded RNG before the accept/ignore gate, breaking seeded determinism — gate on pending/over/available before drawing and add a seeded-determinism test; hook-level once-semantics stay unproved without a DOM test harness (accepted: logic lives in the tested pure `applyDecision`; keep `choose` using one sync path).
- 2026-09-23: T3 follow-up on `feat/2c-t3-session-reducer` (0e87c89): pure `canDecide`/`canDeal`, `sessionRng.ts` gates RNG draws before accept/ignore, seeded-determinism test with interleaved ignored events, single sync path in `choose`. RED/GREEN observed.
- 2026-09-23: T4 done on `feat/2c-t4-sound`: 764ee21 `sound.ts` (cueNotes pure data, lazy AudioContext player, no-op on server/unsupported), f914045 `preferences.ts` (guarded localStorage for muted + best score), ba510fd `useSound` hook (not wired yet). RED/GREEN observed; 269 tests, tsc, lint, build clean.
- 2026-09-23: T3-fix + T4 review approved. Follow-ups folded into T5 start: guard the sound player fully (AudioContext constructor throw, resume() rejection, scheduling on a closed context) so play() never throws; clamp non-finite combo multipliers; load `muted` after mount to avoid a hydration mismatch; fire `onDecision` from `applyDecision`'s explicit record instead of the last decisions element; make the unavailable-action RNG tests use a hand-built scenario so they never pass vacuously.
- 2026-09-23: T4 follow-ups on `feat/2c-t4-sound` (637971d, 2befcb9, fd23f41, abae8ba): failure-safe sound player with injected fakes, NaN/Infinity combo clamp, `useSound` on `useSyncExternalStore` (lint forbids setState in effects), `onDecision` from the applied record, non-vacuous unavailable-action tests. RED/GREEN observed.
- 2026-09-23: T5 done on `feat/2c-t5-game-ui` (ffdd4ac, 8a52026, 8a4a1cd): pure `revealSchedule`, `outcomeCopy`, `runSummary` (tested); `setBestScore` for hydration-safe best load; animated resolution (player draws, 3D hole-card flip, dealer draws, per-hand banners incl. right-call-bad-luck copy), HUD (hearts, score, combo, best, mute), game over overlay with New best, vibration + shake respecting reduced motion, full sound wiring. Session XP meter removed from the top HUD (still in feedback). 309 tests, tsc, lint, build clean; screenshots in scratchpad. No component-level tests (no DOM harness by design).
- 2026-09-23: Owner asked to fix the split banner placement and hand counter, and to make the coach casino-themed. Done on `feat/2c-t5-game-ui`: db80600 banners anchored to each player hand; a3fe03f `currentHandNumber` (counts hands in the current run, resets on restart; tested); 9f99125 pixel-art croupier drawn as SVG from `croupierSprite.ts` data (26x28, idle/blink/celebrate/teach/gameOver poses, reduced-motion safe; sprite data tested), `web-builder-coach.png` removed. 320 tests, tsc, lint, build clean. Note: intermediate commit db80600 renders the old coach oversized in isolation; HEAD is correct.

## Next step
Owner visual acceptance of the croupier and fixes, then T5 review, then Phase 2b. Known interim gap: after 3 mistakes the run is over and choices are ignored, but the game-over screen only arrives in T5 (keyboard Enter/R restarts meanwhile).
