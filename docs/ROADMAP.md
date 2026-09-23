# 21 Lab — Roadmap

> Single source of truth for the Nerdearla 2026 Webflow App Challenge entry.
> Every session: read this file first, continue from the first unchecked task, and update the checkboxes and the Progress Log before ending.

## 1. Goal

Ship **21 Lab**, an educational blackjack trainer ("Learn blackjack by playing, not by reading"), as a full-stack app deployed on Webflow Cloud, and submit it before the deadline.

- **Deadline:** Fri 2026-09-25, 18:00 ART (hard). Winners announced Sat 2026-09-26, 12:00 ART.
- **Submit at:** https://nerdearla-app-showcase.webflow.io/#submit (GitHub user + public app URL + short description).
- **Target categories:** Best Tech (primary), Best Design, Best in Show.
- **Positioning:** educational strategy trainer. No real money, no betting, no casino aesthetic.

## 2. Verified Constraints (checked 2026-09-23)

### Challenge rules
- One entry per GitHub account. Participant must be 18+.
- App must be functional and reachable at a public URL.
- Original work; third-party libraries allowed with proper rights.
- Judged by Webflow engineers. No rubric is published.
- Prize eligibility requires attending the event in person or being in Buenos Aires during the challenge.

### Webflow Cloud platform
- Runtime: **Cloudflare Workers** (V8 isolates, not full Node.js).
- Next.js **>= 15**, built through OpenNext (`@opennextjs/cloudflare`).
- **Do not set `basePath` or `assetPrefix`.** Webflow Cloud injects the mount path at build time. Use `process.env.NEXT_PUBLIC_BASE_PATH` for plain `<img>` tags and manual `fetch` calls. `Link` and `next/image` handle it automatically.
- API routes: `export const runtime = 'edge'` (per the Webflow docs).
- SQLite = **Cloudflare D1**, declared in `wrangler.json` under `d1_databases` (`binding`, `database_name`, `database_id`, `migrations_dir`). Migrations are applied automatically on deploy.
- Access bindings via `getCloudflareContext()`, always called inside a function.
- ORM: **Drizzle**.
- Limits: 20 s request timeout, 30 s CPU, 128 MB memory, 10 MB worker bundle, 100 MB SQLite on the free plan.
- CLI: `npx @webflow/webflow-cli` (v2.8.0). Commands: `webflow auth login`, `webflow cloud deploy`.
- Docs: https://developers.webflow.com/webflow-cloud/llms.txt

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
- [ ] Scaffold Next.js 15 + TypeScript + Tailwind + Vitest
- [ ] Add `@opennextjs/cloudflare`, `wrangler.json` with the D1 binding, and Drizzle
- [ ] Create a health API route that writes and reads a row in D1
- [ ] `webflow auth login` and the first `webflow cloud deploy`
- [ ] Confirm the public URL works, D1 persists, and migrations auto-apply
- [ ] First commit and push to GitHub

### Phase 1 — Blackjack engine (Wed 23) — TDD
- [ ] Card, Hand, and hand value (hard/soft), blackjack, and pair detection
- [ ] `availableActions(hand, rules)`
- [ ] Basic-strategy tables (hard, soft, pairs) for the v1 ruleset + `optimalAction()`
- [ ] Category classification for each scenario
- [ ] Monte Carlo `simulateEV(hand, dealerUpcard, action, n)` within the CPU budget (~10–20k hands)
- [ ] Short explanation templates per category (work without AI)

### Phase 2 — Playable core (Thu 24 AM)
- [ ] Anonymous player cookie + `players` row
- [ ] Practice screen: dealer at the top, player hand, large action buttons, mobile-first
- [ ] Decision flow: evaluate → feedback ("Perfect move" / "Not quite") → next hand
- [ ] Persist every decision in `decisions`
- [ ] Card deal animations and feedback microinteractions

### Phase 3 — Stats & Skill Map (Thu 24 PM)
- [ ] Stats API: totals, accuracy, current and best streak, strongest and weakest category
- [ ] Skill Map UI (per-category progress)
- [ ] Adaptive scenario weighting (`weight = base + weaknessFactor`) + a "Practice weakness" button

### Phase 4 — AI Coach (Thu 24 PM) — the differentiator
- [ ] Command Code client (OpenAI-compatible) using a secret env var
- [ ] Tools: `get_optimal_action`, `simulate_ev`, `get_player_stats`
- [ ] "Why?" after a mistake: a streamed explanation + an EV bar chart per action
- [ ] "Ask the dealer" chat grounded in the player's stats and simulations
- [ ] Rate limit via `coach_usage`; fall back gracefully to the template explanations

### Phase 5 — Daily challenge & polish (Fri 25 AM)
- [ ] Deterministic daily scenario set (date-seeded), results, and a simple leaderboard
- [ ] Visual polish pass: dark, elegant, subtle green table, glass UI, strong typography
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
