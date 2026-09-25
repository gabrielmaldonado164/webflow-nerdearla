# 21 Lab — Roadmap

> Single source of truth for the Nerdearla 2026 Webflow App Challenge entry.
> Every session: read this file first, continue from the first unchecked task, and update the checkboxes and the Progress Log before ending.

## 1. Goal

Ship **21 Lab**, an educational blackjack trainer ("Learn blackjack by playing, not by reading"), as a full-stack app deployed on Webflow Cloud, and submit it before the deadline.

- **Deadline:** Fri 2026-09-25, 18:00 ART (hard). Winners announced Sat 2026-09-26, 12:00 ART.
- **Submit at:** https://nerdearla-app-showcase.webflow.io/#submit (GitHub user + public app URL + short description).
- **Target categories:** Best Tech (primary), Best Design, Best in Show.
- **Positioning:** educational strategy trainer. No real money, no betting, no chips. Visually it should feel like sitting at a real casino blackjack table (owner decision, 2026-09-23).

## 2. Verified Constraints (checked 2026-09-23)

### Challenge rules
- One entry per GitHub account. Participant must be 18+.
- App must be functional and reachable at a public URL.
- Original work; third-party libraries allowed with proper rights.
- Judged by Webflow engineers. No rubric is published.
- Prize eligibility requires attending the event in person or being in Buenos Aires during the challenge.

### Webflow Cloud platform
- Runtime: **Cloudflare Workers** (V8 isolates, not full Node.js).
- Next.js **>= 15** (project uses 16.3), built through OpenNext (`@opennextjs/cloudflare`).
- **Do not set `basePath` or `assetPrefix`.** Webflow Cloud injects the mount path at build time. Use `process.env.NEXT_PUBLIC_BASE_PATH` for plain `<img>` tags and manual `fetch` calls. `Link` and `next/image` handle it automatically.
- API routes: use `export const runtime = "nodejs"`. **Not `edge`**: the Webflow docs say `edge`, but on Next 16.3 + `@opennextjs/cloudflare` 1.20 it builds and then returns 500 at runtime (verified 2026-09-23).
- SQLite = **Cloudflare D1**, declared in `wrangler.json` under `d1_databases` (`binding`, `database_name`, `database_id`, `migrations_dir`). Migrations are applied automatically on deploy.
- Access bindings via `getCloudflareContext()`, always called inside a function.
- ORM: **Drizzle**.
- Limits: 20 s request timeout, 30 s CPU, 128 MB memory, 10 MB worker bundle, 100 MB SQLite on the free plan.
- CLI: `npx @webflow/webflow-cli` (v2.8.0). Commands: `webflow auth login`, `webflow cloud deploy`.
- Docs: https://developers.webflow.com/webflow-cloud/llms.txt
- **Live URL:** https://lab21.webflow.io/ (renamed from `webflow-nerdearla.webflow.io` on 2026-09-24, which now returns 404; site `6ab3f86d73c9861e8c44d38b`, environment `main`, mount `/`). IDs are in `webflow.json`.
- **Deploy command** (non-interactive; commit first so the version tag is clean):
  `npx @webflow/webflow-cli apps deploy --no-input --site-id 6ab3f86d73c9861e8c44d38b --mount / --environment main --skip-mount-path-check --skip-update-check`
- CLI deploy gotcha: it deletes `open-next.config.ts` and leaves `next.config.webflow.ts` behind. After each deploy, run `git restore open-next.config.ts` (the helper file is gitignored).

### LLM provider: Command Code (GOAT plan, API access confirmed)
- Base URL: `https://api.commandcode.ai/provider/v1`, with OpenAI (`/chat/completions`, `/responses`) and Anthropic (`/messages`) formats.
- Auth: `Authorization: Bearer <key>`.
- Supports function tools (executed by our code) and streaming (`stream: true`).
- Model list: `GET /provider/v1/models`. Check `supported_endpoints` per model.
- Docs: https://commandcode.ai/docs/provider

## 3. Key Decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | Blackjack only; poker is out of scope | Poker strategy modeling is too large for the timeline |
| D2 | Strategy is decided by a deterministic engine, never by the LLM | Correctness must be demonstrable |
| D3 | The AI coach only calls tools backed by the engine (`get_optimal_action`, `simulate_ev`, `get_player_stats`) | "The AI never guesses, it runs the numbers" (Best Tech story) |
| D4 | Anonymous players (UUID in a cookie); no auth | Zero friction: the judge plays within 30 s |
| D5 | The LLM key stays server-side only (Webflow Cloud secret env var) | Prevents key abuse |
| D6 | Per-player rate limit on coach calls, stored in D1 | The key is paid by the author |
| D7 | The app must work fully if the AI is unavailable | AI is an enhancement, not the core |
| D8 | Open directly into a playable hand; no marketing landing page | "The game is the onboarding" |
| D10 | Mobile-first Pixel Arcade: a 2.5D pixel-art casino room and dimensional felt table, still no money or chips | Owner selected the playable Pixel Arcade direction after rejecting flat and earlier mockups |
| D9 | Vercel AI SDK with an OpenAI-compatible provider pointed at Command Code | Handles streaming and the tool loop; edge-compatible |

## 4. Architecture

```
Webflow Cloud (Cloudflare Workers)
└── Next.js 15 (App Router, TypeScript, Tailwind)
    ├── src/blackjack/   # Pure domain: cards, hands, rules, strategy, Monte Carlo EV. No framework imports.
    ├── src/training/    # Scenario generation, adaptive weighting, daily challenge seed
    ├── src/player/      # Anonymous identity, stats, skill map
    ├── src/coach/       # LLM client, tool definitions, prompts, rate limit
    ├── src/db/          # Drizzle schema + D1 access
    └── src/app/         # Routes, UI, API route handlers (thin adapters)
D1 (SQLite): players, decisions, daily_challenges, daily_results, coach_usage
```

Rules:
- `src/blackjack` and `src/training` are pure TypeScript and fully unit-tested (Strict TDD).
- API routes are thin: validate input, call the domain, persist, respond.

### Data model (initial)
- `players`: id (uuid), created_at, display_name (nullable)
- `decisions`: id, player_id, player_cards, dealer_upcard, available_actions, user_action, optimal_action, is_correct, category, created_at
- `daily_challenges`: date (pk), seed, scenarios (json)
- `daily_results`: id, player_id, date, score, accuracy, duration_ms
- `coach_usage`: player_id, date, count

Strategy categories: `hard`, `soft`, `pair`, and the action dimensions `double` and `split`.

### Ruleset (v1)
6 decks, dealer stands on soft 17 (S17), double on any two cards, double after split allowed, no surrender. Design `GameRules` so that variants can be added later.

## 5. Phases & Tasks

Deliver in order. The app must stay deployable after every phase.

### Phase 0 — Platform spike (Wed 23) — de-risk first
- [x] Scaffold Next.js 15 + TypeScript + Tailwind + Vitest
- [x] Add `@opennextjs/cloudflare`, `wrangler.json` with the D1 binding, and Drizzle
- [x] Create a health API route that writes and reads a row in D1
- [x] `webflow auth login`
- [x] First deploy (interactive, project app). Live: https://webflow-nerdearla.webflow.io/
- [x] Confirm the public URL works, D1 persists, and migrations auto-apply
- [x] First commit and push to GitHub (repo: https://github.com/gabrielmaldonado164/webflow-nerdearla)

### Phase 1 — Blackjack engine (Wed 23) — TDD
- [x] Card, Hand, and hand value (hard/soft), blackjack, and pair detection
- [x] `availableActions(hand, rules)`
- [x] Basic-strategy tables (hard, soft, pairs) for the v1 ruleset + `optimalAction()`
- [x] Category classification for each scenario
- [x] Monte Carlo `simulateEV(hand, dealerUpcard, action, n)` within the CPU budget (~10–20k hands)
- [x] Short explanation templates per category (work without AI)
- [x] Fix review findings: stiff-hand explanations contradict hit/split, simulateEV input validation, scenario weight validation
- [x] (Low priority) Test hardening: undefined-weight test should assert distribution; add miss-path explain tests (hard 16 vs 10, 6-6 vs 4); stiff-hand-hit miss text should say "hit"; surface weight errors through generateScenario

### Phase 2 — Playable core (Thu 24 AM)

**Current state (2026-09-23). Read this first.**
- Phase 2a is **committed and reviewed** on branch `feat/phase-2a-pixel-arcade` (not pushed, not merged, not deployed): 26adc88, 5cb7add, 0894b1a, 4af9ae5, 05da0b7. 149 tests, lint/tsc/build clean. Native review (reliability lens) approved and acknowledged (lineage review-f68efe8b37b30c3c).
  - `/` renders `src/features/pixel-casino/PixelCasinoScreen` (mobile-first 2.5D pixel-art casino), driven by `src/features/practice/usePracticeSession` (the `onDecision` seam for Phase 2b) and `sessionStats`. Progress is browser-session-only.
  - `CLAUDE.md`: Next.js 16 agent-rules block (auto-added by `next dev`; keep it).
  - Rejected design work (mockups A-D, three-concept selector, first flat practice UI) was deleted; `docs/design/mockup-briefs.md` keeps the history.
- Non-blocking review follow-ups (fold into Phase 2c): renderHook tests for `usePracticeSession` (single decision while feedback is pending, one `onDecision` call per decision); tests for the screen's decision timer and keyboard gating; export the XP award constants from `progress.ts` instead of repeating them in the screen; make the explain sweep test assert that the message family matches `optimalAction`.
- Next steps, in order:
  1. Owner accepted Pixel Arcade visuals (2026-09-23). Phase 2c is tracked in `odd/tasks/phase-2c-game-layer.md`.
  2. Phase 2c: implemented; T5 and T5-fix reviewed and acknowledged (see the Phase 2c section).
  3. Phase 2b: implemented (anonymous player cookie, `POST /api/decisions`, client wiring via the `onDecision` seam); tracked in `odd/tasks/phase-2b-persistence.md`.
  4. Next: Phase 3 (stats API + Skill Map UI).
  5. Preserve the shared decision engine; do not fork strategy rules in the UI.
- Competitive landscape (researched): Veintiuno, Blackjack 21 Strategy Trainer, Blackjack Trainer 101, Blackjack Ace, basicstrategy.app, learn-blackjack.com, plus casino-affiliate simulators. Our differentiators: AI coach grounded in the deterministic engine + Monte Carlo EV, gamification, adaptive training, zero-friction web, product-grade design.
- [x] Anonymous player cookie + `players` row
- [x] Practice screen: dealer at the top, player hand, large action buttons, mobile-first (Pixel Arcade 2.5D; owner accepted 2026-09-23)
- [x] Decision flow: evaluate → feedback ("Perfect move" / "Not quite") → next hand (committed, reviewed)
- [x] Persist every decision in `decisions`
- [x] Card deal animations and feedback microinteractions (staggered deal, action response, split separation, outcome burst and coach reaction; owner accepted 2026-09-23)

### Phase 2c — Game layer (after the Phase 2a commit, before 2b persistence)
Goal: make 21 Lab feel like a web game, not a pretty page. Strategy grading stays in the deterministic engine. Detailed tasks, commits, and review history: `odd/tasks/phase-2c-game-layer.md`.
**Current state (2026-09-23):** T1–T5 and T5-fix implemented and committed on a stacked branch chain (not pushed): `feat/phase-2a-pixel-arcade` → `feat/2c-t1-hand-resolution` → `feat/2c-t2-run-mode` → `feat/2c-t3-session-reducer` → `feat/2c-t4-sound` → `feat/2c-t5-game-ui`. All reviewed and acknowledged, including T5 (lineage review-2e9a2e46ccb53347, base `10410bb`..`d45a2e3`) and T5-fix (lineage review-9d053cdf12623359, `d45a2e3`..`1d402e7`). 336 tests, tsc, lint, build clean. Phase 2b (`feat/2b-t1-persistence-domain` → `feat/2b-t2-decisions-api` → `feat/2b-t3-client-wiring`) is stacked on top; see the Phase 2b line above and `odd/tasks/phase-2b-persistence.md`.
- [x] 8-bit sound effects synthesized with the Web Audio API, mute toggle remembered per browser, no sound before the first interaction
- [x] Run mode: 3 lives, game over screen with score, best score, accuracy, restart
- [x] Combo multiplier (x2/x3/x4 at streak 3/6/9)
- [x] Mistake juice: screen shake and `navigator.vibrate`, respecting `prefers-reduced-motion`
- [x] Dealer hole card: real hidden card (peek-safe) revealed with a flip animation
- [x] Hand resolution: player action + basic-strategy auto-play, S17 dealer, win/lose/push/blackjack; grading still judges the decision
- [x] Coach: pixel-art dealer (`public/characters/dealer.webp`, optimized to 272px WebP) with a speech-bubble phrase reacting to the decision (owner rejected an earlier hand-drawn SVG croupier — not raster-quality enough — and supplied this PNG instead; placement/dialogue restored in d45a2e3). The open nits from the SVG attempt (illegible Ace, missing BUST label) no longer apply: there's no in-hand Ace glyph on the PNG coach, and a BUST label was separately added to the running hand-total display (0c4381d).
- [x] T5 native review (T5: lineage review-2e9a2e46ccb53347 approved + acknowledged; T5-fix: lineage review-9d053cdf12623359 approved + acknowledged)

### Phase 3 — Stats & Skill Map (Thu 24 PM)
**Current state (2026-09-23):** Phase 3 complete (T1-T4), committed on a stacked branch chain (not pushed), on top of Phase 2b: `feat/2b-t3-client-wiring` → `feat/3-t1-stats` (c010c43) → `feat/3-t2-achievements` (913b609) → `feat/3-t3-adaptive-weighting` (7445ba7) → `feat/3-t4-skill-map-ui` (7112745, plus 3 review-follow-up commits). Tracked in `odd/tasks/phase-3-stats-skill-map.md`. 483 tests, tsc, lint, build clean.
- [x] Stats API: totals, accuracy, current and best streak, strongest and weakest category (`GET /api/stats`, T1)
- [x] Skill Map UI: HUD "Skill Map" button opens a pixel-art overlay panel (per-category bars, accuracy, streaks, strongest/weakest, badge grid), falls back to in-session stats when `/api/stats` fails, short summary on the game-over overlay (T4)
- [x] Adaptive scenario weighting (`weight = base + weaknessFactor`) logic and wiring, applied ONLY while the "Practice weakness" toggle is explicitly on — off always uses the engine's default uniform weighting (owner decision, 2026-09-24; `weightsFromStats`, `computeToggleWeights`, `usePracticeSession.setWeights`, T3/T4/T5)
- [x] Achievements/badges derived from persisted decisions (`deriveAchievements`, included in `GET /api/stats`, T2), shown in the Skill Map panel's badge grid, hidden with an "unavailable offline" note when falling back to session stats (T4)

### Phase 4 — AI Coach (Thu 24 PM) — the differentiator
**Current state (2026-09-24):** Phase 4 code deployed to Webflow Cloud main with the owner's approval (deployment `6bf2ff66-7e4b-483c-b98c-754f8bd4af76`, commit `61e1259`). 505 tests, TypeScript, lint, Next, and OpenNext builds pass. Public smoke: evidence 200 with engine action/EV; Command Code chat and Why both 200 with grounded responses. Browser UI QA was unavailable and moves to Phase 5 polish; the 429 limit was exercised locally, not by consuming 20 paid live calls.
- [x] Command Code client (OpenAI-compatible) using a secret env var — live provider calls verified
- [x] Tools: `get_optimal_action`, `simulate_ev`, `get_player_stats` (engine/stats-backed)
- [x] "Why?" after a mistake: a streamed explanation + an EV bar chart per action — live API response verified; browser UI QA remains
- [x] "Ask the dealer" chat grounded in the player's stats and simulations — live response with persisted stats verified; browser UI QA remains
- [x] Rate limit via `coach_usage`; fall back gracefully to the template explanations

### Phase 5 — Daily challenge & polish (Fri 25 AM)
**Current state (2026-09-24):** Daily Challenge is implemented on `feat/5-daily-challenge` but not yet deployed. It uses ten fixed hands per UTC day, ends after three misses, persists one engine-graded result per player/day, and includes loading/error/result states. Local Cloudflare D1 API smoke passed. The leaderboard is intentionally deferred at the roadmap cut line. Visual/mobile QA and final production smoke remain open. See `odd/tasks/phase-5-daily-challenge.md`.
- [ ] Deterministic daily scenario set (date-seeded), results, and a simple leaderboard
- [ ] Visual polish pass: selected 2.5D pixel-art casino language across game and surrounding UI
- [x] Mobile QA, loading and error states, empty states
- [x] Final production deploy + smoke test on the public URL

### Phase 6 — Submit (Fri 25, before 15:00 ART; buffer until 18:00)
- [ ] Submit the form: GitHub user, app URL, description
- [x] README with a pitch, architecture, and tech highlights
- [ ] **Feature freeze at 12:00 ART Friday.** After that, only fixes.

## 6. Cut Line (if time runs short)

Cut in this order: daily-challenge leaderboard → "Ask the dealer" chat → adaptive weighting.
Never cut: the playable core, correct strategy, persistence, the "Why?" EV explanation (template fallback), or the deploy.

## 7. Demo Script (for judges)

- 10 s: understand what it is ("Can you beat the dealer?").
- 30 s: already played a hand and got feedback.
- 60 s: see personalized stats plus an AI explanation backed by simulated EV.

## 8. Progress Log

Append one line per session: date, what was done, and what comes next.

- 2026-09-23: Idea validated, facts verified, roadmap created. Next: Phase 0.
- 2026-09-23: Phase 0 scaffold done (Next 16.3 + OpenNext + D1/Drizzle + /api/health, verified locally with wrangler dev). Webflow auth OK, no sites yet → project app. Next: interactive first deploy, then Phase 1.
- 2026-09-23: Phase 0 done. Deployed to https://webflow-nerdearla.webflow.io/ and verified that /api/health persists in D1. Next: Phase 1 (blackjack engine, TDD).
- 2026-09-23: Phase 1 engine committed (74cde93, 93 tests, review approved). Follow-up fixes for 3 non-blocking findings in progress. Next: Phase 2 (playable core).
- 2026-09-23: Engine fixes committed (4a311bf, 117 tests, review approved). Phase 1 complete. Next: Phase 2 (playable core).
- 2026-09-23: Test hardening + lint/vitest config fixed (129 tests, lint clean, review approved). Next: Phase 2 (playable core).
- 2026-09-23: Phase 2a first UI pass reviewed via screenshots. Owner redirected visuals to a real casino-table feel (D10). Redesign + 3 bug fixes (hydration mismatch, miss explanation assuming the wrong action, premature weakest spot) in progress.
- 2026-09-23: Session 1 end. Phase 2a UI built + explanation fixes (uncommitted, unreviewed). Mockups A-D done; owner picked E (A+B) and requested F (pixel art), both pending. See Phase 2 "Current state" and docs/design/mockup-briefs.md.
- 2026-09-23: Owner rejected prior visual directions. Built three interactive design candidates at `/` around the same scenario, decisions, feedback, and stats engine; final visual selection and persistence remain pending.
- 2026-09-23: Owner selected Pixel Arcade. Replaced the selector at `/` with a mobile-first 2.5D pixel-art casino game, reusing the existing strategy and decision flow. Added room art, dimensional table, animated cards and reward feedback, session XP tests. Visual acceptance, commit, and D1 persistence remain pending.
- 2026-09-23: Owner chose to keep the current decision-training roadmap; full hand resolution remains outside this phase. Refined Pixel Arcade with a legible S17 rule plaque, an original web-builder coach, physical arcade controls, and strategy-focused result motion. No blackjack rules or persistence behavior changed. Next: owner visual acceptance, Phase 2a review/commit, then Phase 2b persistence.
- 2026-09-23: Replaced the unclear wooden card shoe with a compact stack of matching card backs and moved the obscured 21 Lab felt print onto a readable front-rail badge. Verified mobile/desktop layout and the existing decision flow; strategy remains unchanged. Next: owner visual acceptance and Phase 2a review/commit.
- 2026-09-23: Owner wants a web game, not just a polished page. Added Phase 2c (Web Audio SFX, run mode with lives, combo multiplier, mistake shake/vibration, dealer hole-card flip and full hand resolution) before 2b persistence; achievements added to Phase 3. Supersedes the earlier deferral of hand resolution.
- 2026-09-23: Phase 2a committed on `feat/phase-2a-pixel-arcade` (5 commits, 149 tests, lint/tsc/build clean); native review approved with 4 non-blocking coverage findings recorded as Phase 2c follow-ups. Deleted rejected mockups and dead UI. Next: owner visual acceptance, then Phase 2c.
- 2026-09-23: Owner accepted Pixel Arcade visuals. Phase 2c started (feature document `odd/tasks/phase-2c-game-layer.md`, feature-branch PR chain on top of `feat/phase-2a-pixel-arcade`).
- 2026-09-23: Session end. Phase 2c T1–T5 implemented on the stacked branch chain ending at `feat/2c-t5-game-ui` (320 tests, tsc/lint/build clean). T1–T4 reviewed; T5 review and owner acceptance of the new pixel-art croupier pending. Next: croupier/BUST nits if the owner wants them, T5 review, push + PRs in chain order (owner decision), then Phase 2b persistence.
- 2026-09-23: Session end. Removed the rejected hand-drawn croupier (owner will supply a Codex-generated PNG matching the old robot), added running hand totals with a BUST label, and froze the table flow on game over (317 tests, tsc/lint/build clean). Next: T5 native review from base 10410bb (owner consent pending), integrate the croupier PNG when provided, then Phase 2b persistence.
- 2026-09-23: Integrated the owner-supplied pixel-art dealer PNG as the coach (with a speech-bubble phrase), then T5 and T5-fix native review both approved and acknowledged. Phase 2b (anonymous player cookie, `POST /api/decisions`, client wiring) implemented on a stacked chain (`feat/2b-t1-persistence-domain` → `feat/2b-t2-decisions-api` → `feat/2b-t3-client-wiring`): `players`/`decisions` Drizzle schema + generated migration; pure `src/player/` domain (player id, decision-payload validation, `recordDecision` re-grading with the engine); `POST /api/decisions` (cookie mint/reuse, insert-if-missing player row, 201/400/500); fire-and-forget `sendDecision` wired into `PixelCasinoScreen` via `onDecision`. End-to-end local smoke test (D1 migrate + `cf:preview` + real requests, then a live browser click) confirmed: cookie set/reused, exactly one `players` row, one `decisions` row per accepted decision, 400 + nothing stored for malformed/illegal input, and the game unaffected when persistence isn't exercised. 383 tests, tsc/lint/build clean. Updated this file's stale Phase 2c state (T5/T5-fix now reviewed; croupier is the PNG, not the earlier SVG). Next: Phase 3 (stats API + Skill Map UI).
- 2026-09-23: Phase 3 T1-T3 (backend/logic) implemented on a stacked chain (`feat/3-t1-stats` → `feat/3-t2-achievements` → `feat/3-t3-adaptive-weighting`), tracked in `odd/tasks/phase-3-stats-skill-map.md`. T1: `computePlayerStats` (totals, accuracy, current/best streak, per-category, strongest/weakest with a minimum sample), a D1 query for a player's decision history, `GET /api/stats` (empty stats with no cookie minted for no/invalid cookie, generic 500 on repo failure). T2: `deriveAchievements`, a fixed 6-badge catalog reading engine-stored `category`/`optimalAction` rather than re-implementing strategy, added to the same response. T3: `weightsFromStats` (bounded weakness factor + low-sample exploration boost + an optional strong-but-never-zeroing "focus weakest" bias) and `usePracticeSession`/`dealNextHandIfAllowed` wiring so scenario generation can be weighted, with a seeded test proving both the distribution shift and unchanged behavior when no weights are given. 454 tests, tsc/lint/build clean; T1/T2 smoke-tested end to end against a local D1 preview (isolated port, killed after). Next: Phase 3 T4 (Skill Map panel UI + "Practice weakness" toggle, HUD-opened per the owner's 2026-09-23 decision), not started this session.
- 2026-09-23: Phase 3 T4 (Skill Map UI) done on `feat/3-t4-skill-map-ui`, plus three review follow-ups from the prior review, one commit each: `16e6665` (fixed an order-dependent engine-throw test in `handler.test.ts` — `vi.resetModules()` now runs before `vi.doMock`, not just in `afterEach`; confirmed RED standalone via `npx vitest run -t`, GREEN after), `3afd138` (`listPlayerDecisions` now orders by `createdAt` then `id` for deterministic same-millisecond tie-breaking; no cheap unit test possible — no fake/in-memory D1 in this repo and adding one would be a new test dependency), `9b13cd9` (de-tautologized the `sessionRng` undefined-weights test to compare against `generateScenario` called with no options object). T4 itself: `7112745`, HUD "Skill Map" button opens a pixel-art overlay panel (per-category bars, overall accuracy, current/best streak, strongest/weakest callout, badge grid, "Practice weakness" toggle wired to `setWeights(weightsFromStats(stats, { focusWeakness }))`); fetches `GET /api/stats` on open and (debounced) after each decision while open, falling back to `sessionStats.ts` on any failure with an "unavailable offline" note and badges hidden; short summary line added to the game-over overlay from the same data. Esc + close button both close it, focus moves in on open and returns to the HUD button on close, table keyboard shortcuts gated off while open (verified live: pressing H while the panel is open records no new decision), respects `prefers-reduced-motion`, fits 390px width with no horizontal scroll. New pure/tested modules: `skillMapStatsResponse`, `skillMapStatsRequest`, `fetchSkillMapStats`, `skillMapViewModel`, `skillMapWeights`, `skillMapSummary`; `useSkillMapData` is a thin fetch/debounce hook, not unit-tested (same no-DOM-harness constraint as `usePracticeSession`). 483 tests, tsc/lint/build clean. Verified live against a local D1 preview (isolated port 8798, pre-existing dev server on :3000/PID 51367 untouched): played ~25-90 real decisions across sessions to populate server stats/badges, confirmed the toggle, Esc/focus-return, keyboard gating, the game-over summary line, and the offline fallback (monkey-patched `fetch` in-page to reject `/api/stats`, confirmed the panel switches to session stats with the offline note and hidden badges while the game keeps playing). Screenshots (desktop 1280x800, mobile 390x844 via Playwright viewport emulation, game-over, offline fallback) saved under the session scratchpad's `phase3/` directory. Phase 3 (T1-T4) complete. Next: Phase 4 (AI coach).
- 2026-09-24: Session end. Phase 3 T5 (T4 review follow-ups) done: last good stats kept on failed refetch, adaptive weights only while Practice weakness is on (owner decision), shared category labels, refresh sequenced after persistence (493 tests; review-2538c9f9c813d191 approved + acknowledged, suggestions only, deferred to Phase 5 polish). Phases 2b and 3 are complete on the stacked chain ending at `feat/3-t4-skill-map-ui` (not pushed). Next: Phase 4 (AI coach) on a new branch stacked on `feat/3-t4-skill-map-ui`; push + PRs in chain order only when the owner asks.
- 2026-09-24: Phase 4 code implemented on stacked branch `feat/4-ai-coach` (backend `2a0438e`, UI `71bff33`). Engine-backed `/api/coach/evidence`, Command Code AI SDK stream with three engine/stats tools, atomic D1 20/day quota, Why + EV chart and Ask the dealer UI with template fallback. 505 tests, tsc/lint/Next/OpenNext builds pass. Cloudflare preview confirmed evidence 200 and no-key stream 503. No browser was available for UI smoke; no Command Code key/model was configured, so live AI streaming remains unverified. Next: set `COMMAND_CODE_API_KEY` and `COMMAND_CODE_MODEL`, test real streaming and desktop/mobile UI before closing Phase 4.
- 2026-09-24: Set non-secret `COMMAND_CODE_MODEL=deepseek/deepseek-v4-flash` in the Webflow Cloud main environment via the CLI; verified the variable exists. `COMMAND_CODE_API_KEY` is still absent and must be provided securely before provider smoke or deployment.
- 2026-09-24: Owner reported that `COMMAND_CODE_API_KEY` was added; Webflow CLI confirms the key exists with `isSecret: true` (value masked). The main environment is mounted at `/`; deploy dry run passed. A production deploy of this feature branch was blocked pending explicit owner approval, so no live stream was exercised and the deployed app was not changed.
- 2026-09-24: Owner explicitly approved production deploy. Deployed `feat/4-ai-coach` commit `61e1259` to Webflow Cloud main (`6bf2ff66-7e4b-483c-b98c-754f8bd4af76`, success); restored `open-next.config.ts` after the CLI removed it. Public smoke: `/` 200, `/api/coach/evidence` 200 with hit as optimal for hard 16 vs dealer 10 and three EV rows; `/api/coach/stream` chat 200 with correct zero-decision stats for a new anonymous player; Why 200 with text/plain explanation and EV matching the engine. No browser was available for visual UI QA; live 429 edge not tested to avoid 18 additional paid requests. Phase 4 backend/provider operational. Next: Phase 5 daily challenge and mobile/visual QA; push + PR chain still owner-controlled.
- 2026-09-24: Started Phase 5 on `feat/5-daily-challenge`. Built a date-seeded ten-hand challenge, canonical D1 sets, engine-graded per-player results, a HUD-opened pixel panel, and client loading/error handling. The leaderboard remains deferred, and no production deploy has been attempted. Next: mobile/visual QA, runtime D1 smoke, polish, and owner-approved final deploy.
- 2026-09-24: Browser QA of the Daily Challenge (mobile 390px + desktop) on the local Cloudflare preview: play, save, reload, Esc/focus, and offline state verified. Fixed saved-result misses after reload (`ce6a4b2`, 519 tests). Next: coach quota visibility (owner decision), then owner-approved production deploy + smoke.
- 2026-09-24: Coach quota visibility shipped on `feat/5-daily-challenge` (owner decision): provider failures refund the question, `GET /api/coach/usage`, a visible `N/20 AI questions left today` counter, and a distinct daily-limit note. Native review approved; advisory findings fixed. 560 tests. Next: owner-approved production deploy + public smoke.
- 2026-09-24: Owner approved production deploy. Deployed `feat/5-daily-challenge` commit `d7e8a78` to Webflow Cloud main (`af5b4a96-4738-4c5e-a96a-89a655ff7832`, success); restored `open-next.config.ts` after the CLI removed it. Public smoke: `/` 200; `/api/coach/usage` 200 `20/20` with no player cookie minted; `/api/daily` 200 with ten hands (migration 0003 live); a nine-hand run saved and read back engine-graded (6/9, 67%); malformed coach body 400; browser shows the coach counter and the Daily Challenge panel with no horizontal scroll. No paid provider calls. Next: Phase 6 (README, submission) and the pending review of `d7e8a78` in the next slice; push + PR remain owner-controlled.
- 2026-09-24: Owner renamed the staging subdomain to `lab21`; redeployed `db6484b` with `--auto-publish` (`4a0d1d25-4846-4eb8-a8bd-00e7904c1348`, success). https://lab21.webflow.io/ serves the app (home, `/api/coach/usage`, `/api/daily`, `/api/stats` all 200; coach counter visible). The old URL returns 404. Use the new URL in the submission form.
- 2026-09-24: README written (pitch, 30-second judge path, features, tech highlights, architecture diagram, stack, run/test/deploy, decisions) with two screenshots under docs/images; claims checked against code (`e84b876`). Next: push the branch chain + PRs (owner decision), then the submission form with https://lab21.webflow.io/.
- 2026-09-24: Final perf audit (Lighthouse mobile 66 / desktop 88; LCP 17.2s mobile caused by 2.6 MB of unoptimized PNGs; animations 120 fps at 4x CPU throttle, no infinite loops under reduced motion). Converted room art to WebP (1.6 MB → 112 KB) and resized the dealer to 272px WebP (1 MB → 24 KB). Tests 563/563, tsc, lint, build green.
- 2026-09-24: Review `review-c88c391c15c51582` (4 lenses, range `2adbfd8..93eeb33`) approved and acknowledged; advisory only (stale coach usage after a null refund outcome, hardcoded README test count). Deployed `93eeb33` to Webflow Cloud main with `--auto-publish` (`ce6c5aa4-1004-4146-af4d-4fed5676e846`); live serves the WebP art. Lighthouse after: mobile 84 (LCP 3.8s, 430 KiB total), desktop 96 (LCP 1.2s).
