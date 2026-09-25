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
- [ ] T3 — Session: extract a pure practice-session reducer from `usePracticeSession` (single decision while feedback is pending, one `onDecision` per decision, next clears feedback) with tests; wire the hole card, resolution, and run state through it. Pure `keyToCommand` mapping with tests (review follow-up).
- [ ] T4 — Sound: `src/features/pixel-casino/sound.ts` Web Audio synth (deal, flip, correct, mistake, combo, game over), lazy AudioContext on first interaction, mute persisted with guarded `localStorage`; pure parts tested.
- [ ] T5 — UI: hole-card flip, dealer draws, outcome banner, lives/score/combo HUD, game over + restart screen, shake + `navigator.vibrate` on mistakes, mute toggle, sound calls. Mobile and desktop QA via screenshots.

## Delivery
- Strategy: `ask-on-risk` → owner chose **feature-branch-chain** (2026-09-23). One branch per task, stacked: `feat/phase-2a-pixel-arcade` → `feat/2c-t1-hand-resolution` → `feat/2c-t2-run-mode` → `feat/2c-t3-session-reducer` → `feat/2c-t4-sound` → `feat/2c-t5-game-ui`. Each PR targets the previous branch; merge in order.
- Forecast: ~1200–1600 authored changed lines across T1–T5.
- Last reviewed boundary: 785ce19 (T1-fix + T2 review lineage review-d032dc5df892a740 approved + acknowledged; earlier T1 lineage review-7659ea5ddda7d84c).

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

## Next step
T3 on `feat/2c-t3-session-reducer` (after the T1-fix + T2 review).
