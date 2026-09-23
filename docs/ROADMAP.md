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
- **Live URL:** https://webflow-nerdearla.webflow.io/ (site `6ab3f86d73c9861e8c44d38b`, environment `main`, mount `/`). IDs are in `webflow.json`.
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
  2. Phase 2c: implemented; finish owner visual acceptance + T5 review (see the Phase 2c section).
  3. Phase 2b: anonymous player cookie + persist decisions to D1 via the `onDecision` seam.
  4. Preserve the shared decision engine; do not fork strategy rules in the UI.
- Competitive landscape (researched): Veintiuno, Blackjack 21 Strategy Trainer, Blackjack Trainer 101, Blackjack Ace, basicstrategy.app, learn-blackjack.com, plus casino-affiliate simulators. Our differentiators: AI coach grounded in the deterministic engine + Monte Carlo EV, gamification, adaptive training, zero-friction web, product-grade design.
- [ ] Anonymous player cookie + `players` row
- [x] Practice screen: dealer at the top, player hand, large action buttons, mobile-first (Pixel Arcade 2.5D; owner accepted 2026-09-23)
- [x] Decision flow: evaluate → feedback ("Perfect move" / "Not quite") → next hand (committed, reviewed)
- [ ] Persist every decision in `decisions`
- [x] Card deal animations and feedback microinteractions (staggered deal, action response, split separation, outcome burst and coach reaction; owner accepted 2026-09-23)

### Phase 2c — Game layer (after the Phase 2a commit, before 2b persistence)
Goal: make 21 Lab feel like a web game, not a pretty page. Strategy grading stays in the deterministic engine. Detailed tasks, commits, and review history: `odd/tasks/phase-2c-game-layer.md`.
**Current state (2026-09-23):** T1–T5 implemented and committed on a stacked branch chain (not pushed): `feat/phase-2a-pixel-arcade` → `feat/2c-t1-hand-resolution` → `feat/2c-t2-run-mode` → `feat/2c-t3-session-reducer` → `feat/2c-t4-sound` → `feat/2c-t5-game-ui` (HEAD). T1–T4 reviewed and acknowledged; **T5 review pending** (base `10410bb`). 320 tests, tsc, lint, build clean.
- [x] 8-bit sound effects synthesized with the Web Audio API, mute toggle remembered per browser, no sound before the first interaction
- [x] Run mode: 3 lives, game over screen with score, best score, accuracy, restart
- [x] Combo multiplier (x2/x3/x4 at streak 3/6/9)
- [x] Mistake juice: screen shake and `navigator.vibrate`, respecting `prefers-reduced-motion`
- [x] Dealer hole card: real hidden card (peek-safe) revealed with a flip animation
- [x] Hand resolution: player action + basic-strategy auto-play, S17 dealer, win/lose/push/blackjack; grading still judges the decision
- [x] Coach: pixel-art croupier drawn as SVG (replaces the web-builder coach, owner request)
- [ ] Owner visual acceptance of the croupier + fixes (open nits: the Ace in the croupier's hand is not legible at small size; show a "BUST" label when the dealer busts)
- [ ] T5 native review (run `gentle-ai review assess --base-ref 10410bb --committed-only` on `feat/2c-t5-game-ui`)

### Phase 3 — Stats & Skill Map (Thu 24 PM)
- [ ] Stats API: totals, accuracy, current and best streak, strongest and weakest category
- [ ] Skill Map UI (per-category progress)
- [ ] Adaptive scenario weighting (`weight = base + weaknessFactor`) + a "Practice weakness" button
- [ ] Achievements/badges derived from persisted decisions (e.g. "10 soft hands in a row", "Never stood on 12 vs 2"), shown next to the Skill Map

### Phase 4 — AI Coach (Thu 24 PM) — the differentiator
- [ ] Command Code client (OpenAI-compatible) using a secret env var
- [ ] Tools: `get_optimal_action`, `simulate_ev`, `get_player_stats`
- [ ] "Why?" after a mistake: a streamed explanation + an EV bar chart per action
- [ ] "Ask the dealer" chat grounded in the player's stats and simulations
- [ ] Rate limit via `coach_usage`; fall back gracefully to the template explanations

### Phase 5 — Daily challenge & polish (Fri 25 AM)
- [ ] Deterministic daily scenario set (date-seeded), results, and a simple leaderboard
- [ ] Visual polish pass: selected 2.5D pixel-art casino language across game and surrounding UI
- [ ] Mobile QA, loading and error states, empty states
- [ ] Final production deploy + smoke test on the public URL

### Phase 6 — Submit (Fri 25, before 15:00 ART; buffer until 18:00)
- [ ] Submit the form: GitHub user, app URL, description
- [ ] README with a pitch, architecture, and tech highlights
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
