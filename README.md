# 21 Lab

**Learn blackjack strategy by playing, not by reading.**

Live: the Webflow Cloud deployment at https://lab21.webflow.io/ is being retired. The app now targets Vercel; the public Vercel URL is pending and will be added here once the first deploy is done.

21 Lab is an educational blackjack strategy trainer. You play real hands against a dealer, and every decision is graded against a deterministic basic-strategy engine — not a model's guess. There is no real money, no betting, and no chips: it's a training tool, not a casino. An AI coach can explain *why* a move was right or wrong, backed by the same engine and by simulated expected value, and the app works fully even when the AI is unavailable.

Built for the Nerdearla 2026 Webflow App Challenge (target categories: Best Tech, Best Design, Best in Show).

## Screenshots

| Mobile table | Daily Challenge |
|---|---|
| ![21 Lab pixel-art blackjack table, mobile view](docs/images/table-mobile.png) | ![Daily Challenge result panel](docs/images/daily-challenge.png) |

## Try it in 30 seconds

1. Open the live app (URL pending, see above) — you're already at the table, no sign-up, no landing page.
2. Play a hand: pick hit, stand, double, or split. You get instant feedback ("Perfect move" / "Not quite").
3. Tap **Skill Map** to see your accuracy by hand type, streaks, and badges.
4. Tap **Daily Challenge** for a fixed ten-hand set that's the same for everyone that day.
5. After a miss, tap **Why?** for a streamed AI explanation with an EV bar chart, or open **Ask the dealer** to chat about your stats.

## Features

| Feature | What it does | Where in code |
|---|---|---|
| Practice table | Deals hands, grades every decision against basic strategy | `src/features/pixel-casino/`, `src/features/practice/usePracticeSession.ts` |
| Run mode | 3 lives, combo multiplier, mistake shake/vibration, dealer hole-card flip | `src/blackjack/resolve.ts`, `src/features/pixel-casino/` |
| Skill Map | Per-category accuracy, streaks, strongest/weakest spot, badges | `GET /api/stats`, `src/player/playerStats.ts`, `src/player/achievements.ts` |
| Adaptive weakness practice | Optional toggle that re-weights scenario generation toward weak categories | `src/training/weights.ts` |
| Daily Challenge | Ten fixed hands per UTC day, same for every player, graded server-side | `src/training/dailyChallenge.ts`, `src/app/api/daily/` |
| AI coach — "Why?" | Streamed explanation + EV bar chart after a mistake | `src/app/api/coach/evidence/route.ts`, `src/coach/stream.ts` |
| AI coach — "Ask the dealer" | Free-form chat grounded in the player's own stats and hand evidence | `src/app/api/coach/stream/route.ts` |
| Coach quota counter | Visible "N/20 AI questions left today" | `src/app/api/coach/usage/`, `src/coach/rateLimit.ts` |
| Template fallback | Short rule-based explanations when the AI is off or unavailable | `src/blackjack/explain.ts` |
| Anonymous identity | Long-lived UUID cookie, no auth, no personal data | `src/player/playerCookie.ts`, `src/player/playerId.ts` |

## Tech highlights (Best Tech)

**The LLM never decides strategy.** Every "correct move" comes from a deterministic basic-strategy engine (`src/blackjack/strategy.ts`, `optimalAction()`), and every Daily Challenge submission is re-graded server-side from the persisted hand set — the client's reported score is never trusted (`gradeDailyResult` in `src/training/dailyChallenge.ts`).

**EV by simulation, not by claim.** `simulateEV()` (`src/blackjack/simulate.ts`) runs a Monte Carlo simulation per action so the "Why?" chart shows a number the engine actually computed.

**The AI coach only calls grounded tools.** `src/coach/stream.ts` wires three tools into the Vercel AI SDK's `streamText`: `get_optimal_action`, `simulate_ev`, and `get_player_stats` — each backed directly by the engine or by the player's persisted stats. The system prompt instructs the model to use only supplied evidence and tool results, never invented numbers.

**The app works without AI.** If the Command Code key is missing or the provider fails, the UI falls back to the template explanations in `src/blackjack/explain.ts` — no feature depends on the LLM being reachable (D7).

**Coach quota is atomic and fair.** `reserveCoachCall()` (`src/coach/rateLimit.ts`) does a single conditional upsert in SQLite (`INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 WHERE count < limit`), so concurrent requests from the same player can't over-spend the daily limit. If the provider fails before any text is streamed, `releaseCoachCall()` refunds the reserved question, and `GET /api/coach/usage` powers a visible remaining-questions counter.

**Daily Challenge is deterministic and tamper-resistant.** Each of the ten hands is generated from a per-hand seed derived from `daily-v1:<date>:<index>` (`generateDailyScenarios` in `src/training/dailyChallenge.ts`), persisted once in the database as the canonical set for that day, and graded server-side against that exact set. Results are stored with `onConflictDoNothing()` — the first submitted result for a player/day wins (`src/db/dailyRepository.ts`).

**No accounts, no PII.** Players are identified only by a long-lived, `httpOnly` UUID cookie (`lab_player`); a tampered or missing cookie is treated as absent and a fresh id is minted, never trusted as-is (`src/player/playerCookie.ts`).

**The provider key never reaches the client.** `COMMAND_CODE_API_KEY` is a server-side environment variable (a Vercel project secret in production), never exposed with a `NEXT_PUBLIC_` prefix and read only inside server-side route handlers.

## Architecture

```mermaid
flowchart LR
    Browser -->|HTTPS| Worker["Next.js 16 on Vercel\n(Node.js runtime)"]
    Worker --> Routes["API routes (thin adapters)\nsrc/app/api/*"]
    Routes --> Domain["Domain\nsrc/blackjack, src/training,\nsrc/player, src/coach"]
    Domain --> DB[("Turso (libSQL) via Drizzle\nsrc/db")]
    Routes --> Coach["Coach provider client"]
    Coach -->|OpenAI-compatible, Vercel AI SDK| CommandCode["Command Code\n(server-side key)"]
```

| Path | Responsibility |
|---|---|
| `src/blackjack/` | Pure domain: cards, hands, rules, basic-strategy tables, Monte Carlo EV. No framework imports. |
| `src/training/` | Scenario generation, adaptive weighting, Daily Challenge seeding and grading. |
| `src/player/` | Anonymous identity, decision recording, stats, achievements. |
| `src/coach/` | LLM client, tool definitions, prompt, rate limiting. |
| `src/db/` | Drizzle schema and libSQL repositories. |
| `src/app/` | Routes, UI, and API route handlers — validate input, call the domain, persist, respond. |
| `src/features/` | Client-side UI: the pixel-art casino screen and the practice session hook. |

`src/blackjack` and `src/training` are pure TypeScript with no framework imports, developed test-first. The main API routes (`daily`, `decisions`, `stats`, `coach/stream`, `coach/usage`) are thin adapters over an injectable `handler.ts` — the handler takes its dependencies (a repository interface, clock, cookie reader) as arguments, so the routing logic is unit-tested without a real request or database.

## Stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.3.6 |
| Hosting | Vercel (Node.js runtime) | Git integration or `vercel` CLI |
| Database | Turso (libSQL, SQLite-compatible) | `@libsql/client` 0.18 |
| ORM | Drizzle (`drizzle-orm/libsql`) | `drizzle-orm` 0.45.3 |
| AI | Vercel AI SDK + OpenAI-compatible provider | `ai` 7.0.113, `@ai-sdk/openai-compatible` 3.0.55 |
| UI | React, Tailwind CSS, Motion, Phosphor Icons | React 19.2.8, Tailwind 4 |
| Validation | Zod | 4.6.5 |
| Tests | Vitest | 5.0.1 |
| Language | TypeScript | 5 |

## Run locally

```bash
npm install
npm test          # Vitest unit suite
```

Persistence uses libSQL. Outside production the app falls back to a local `file:local.db`, so no Turso account is needed for development. Create the local schema once, then start the dev server:

```bash
npm run db:migrate:local   # apply Drizzle migrations to file:local.db
npm run dev
```

Copy `.env.example` to `.env.local` for local values (never commit real ones).

Environment variables:

| Variable | Required | Purpose |
|---|---|---|
| `TURSO_DATABASE_URL` | In production | libSQL database URL. Locally it is optional (falls back to `file:local.db`); in production a missing value throws a clear error (`src/db/config.ts`) |
| `TURSO_AUTH_TOKEN` | For a remote Turso database | Auth token for the Turso database |
| `COMMAND_CODE_API_KEY` | For AI features | Server-side secret for the Command Code provider. Without it the coach returns 503 and the app falls back to template explanations |
| `COMMAND_CODE_MODEL` | Optional | Model id passed to the OpenAI-compatible client |

Applying migrations to a remote database:

```bash
export TURSO_DATABASE_URL=libsql://<database>.turso.io
export TURSO_AUTH_TOKEN=<token>
npm run db:migrate
```

`npm run db:migrate` reads the variables from the shell only; it does not load `.env.local`. To reuse the values stored in Vercel, run `vercel env pull .env.local` and export them from that file. `npm run db:generate` always pins a local URL, so generating a migration never touches a remote database.

## Testing

Domain code (`src/blackjack`, `src/training`) is developed test-first with strict TDD. API route handlers are unit-tested with injected dependencies rather than a live database.

```bash
npx vitest run
```

Observed: **563 tests passing** across 56 test files.

## Deploy

Hosted on Vercel (Next.js on the Node.js runtime), with persistence on Turso. Deploy through the Vercel Git integration (push to the connected branch) or with the `vercel` CLI.

1. Create a Turso database. The [Turso Vercel Marketplace integration](https://vercel.com/marketplace/tursocloud) can provision it and inject the database URL and token into the project. It may prefix the variable names, so verify them and match `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (add aliases if needed).
2. In the Vercel project, open Settings → Environment Variables and set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `COMMAND_CODE_API_KEY`, and optionally `COMMAND_CODE_MODEL` for the Production, Preview, and Development environments as needed. The API key stays server-side.
3. Apply the migrations to the remote database (see "Applying migrations to a remote database" above). Migrations are not run automatically on deploy.
4. Deploy.

## Decisions & scope

| Decision | Why |
|---|---|
| Blackjack only, no poker | Poker strategy modeling was too large for the timeline |
| Strategy decided by a deterministic engine, never the LLM | Correctness must be demonstrable |
| Coach only calls engine/stats-backed tools | "The AI never guesses, it runs the numbers" |
| Anonymous players, no auth | Zero friction — a judge can play within 30 seconds |
| Per-player daily coach rate limit | The provider key is paid by the author |
| App must work fully without the AI | The AI is an enhancement, not the core |
| Opens directly into a playable hand, no landing page | "The game is the onboarding" |
| Hands dealt as 1/3 hard, 1/3 soft, 1/3 pairs (not a real deck) | Soft hands and pairs are where players make the most mistakes but are rare in a real shoe. Every soft hand holds an Ace, so Aces show up about twice as often (~18% of player cards vs ~8%); ten-value cards match a real deck (~30%). "Focus weakness" skews the mix further toward your weakest category |

**Leaderboard intentionally deferred.** Anonymous, cookie-based identities can't enforce one entry per person, so a leaderboard would be trivially gameable; it was cut rather than shipped as something misleading.

---

Built for the Nerdearla 2026 Webflow App Challenge. Independent project — not affiliated with Webflow.
