# Vercel Migration

## Objective
Move 21 Lab hosting from Webflow Cloud (Cloudflare Workers via OpenNext + D1) to Vercel, replacing D1 with Turso (libSQL) through `drizzle-orm/libsql`.

## Problem / Why
The owner wants the web published on Vercel. Vercel has no D1, so persistence must move to a Vercel Marketplace provider. Turso is SQLite-compatible, which keeps the Drizzle schema and the existing `drizzle/` migrations unchanged.

## Scope
- In: DB client, raw-SQL rate limiter, coach routes env access, Cloudflare/Webflow Cloud tooling removal, deploy docs.
- Out: the parked `feat/webflow-code-components` branch; `NEXT_PUBLIC_BASE_PATH` helpers (harmless, kept); UI changes.

## Constraints
- Strategy stays in `src/blackjack`; the Command Code API key stays server-side; the app works without the AI.
- Local dev works without Turso via `file:` libSQL URL.
- Remote work (Turso provisioning, Vercel project, remote migrations, deploy) needs explicit owner authorization.

## TDD
- Mode: strict (on), source: global CLAUDE.md "Strict TDD Mode: enabled".
- Runner: `npm test` (vitest run).

## Delivery
- Strategy: ask-on-risk. Forecast ~350 authored changed lines.
- Branch: `feat/vercel-migration` (from `main` 83bdfcf).

## Tasks
- [x] T1 — DB layer on libSQL: `src/db/client.ts` uses `@libsql/client` + `drizzle-orm/libsql` with `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` (cached client); port `src/coach/rateLimit.ts` to libSQL (`execute` + `rowsAffected`) test-first; coach routes read `process.env` instead of `getCloudflareContext`. Route: delegated (writer trigger, 4+ non-trivial files).
- [x] T2 — Remove Cloudflare/Webflow Cloud tooling: `open-next.config.ts`, `wrangler.json`, `cloudflare-env.d.ts`, `webflow.json`, `cf:*` scripts, `@opennextjs/cloudflare`, `wrangler`, `@cloudflare/workers-types`; `drizzle.config.ts` dialect `turso` + `db:migrate` via drizzle-kit; `.env.example`. Route: delegated with T1 context.
- [ ] T3 — Docs: README, CLAUDE.md, docs/ROADMAP.md deploy sections point to Vercel + Turso. Route: delegated.
- [ ] T4 — Provision and deploy (owner-authorized remote work): Turso DB via Vercel Marketplace, env vars, remote migration, first Vercel deploy, smoke test. Route: inline with owner.

## Acceptance Criteria
- No imports of `@opennextjs/cloudflare`, `@cloudflare/workers-types`, or `D1Database` remain.
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` pass.
- Coach still degrades gracefully (503) when `COMMAND_CODE_API_KEY` is missing.

## Progress
- 2026-09-29: branch created; coupling mapped; Turso confirmed on Vercel Marketplace (https://vercel.com/marketplace/tursocloud).
- T1 done (delegated writer) — 1ebcad4 `refactor(db): move persistence from d1 to libsql`. RED: rateLimit.test.ts 5/5 failing before port. GREEN: npm test 568/568, tsc clean, eslint src clean.
- T2 done (delegated writer) — ea22faa `chore(deploy): drop cloudflare and webflow cloud tooling`. `TURSO_DATABASE_URL=file:local.db npm run db:migrate` applied all migrations; rate-limit UPSERT checked on real libSQL (rowsAffected 1,1,0 at limit 2); npm test 568/568, tsc, lint, build clean; no Cloudflare imports remain. Parent spot check: vitest 568/568.
- Engram mirror pending: mem_save refused (multiple active sessions for the project).

## Next Step
T3 (docs), then T4 with owner authorization.
