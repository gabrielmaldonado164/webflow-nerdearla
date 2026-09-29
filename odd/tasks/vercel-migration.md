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
- [x] T2b — Review follow-ups (owner-accepted): fail fast in production when `TURSO_DATABASE_URL` is missing (local file fallback only outside production); share one env resolver between runtime and `drizzle.config.ts` so empty strings behave the same and `db:migrate` never silently targets the local file when a remote is intended; add a real in-memory libSQL test for the rate limiter. Route: delegated (writer trigger).
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
- Review (RDD, medium, consent granted) review-003888c4a5042907 over 83bdfcf..3ad8c35: approved + acknowledged (authority burned). Advisory findings: silent `file:local.db` fallback in production (src/db/client.ts:17-20); drizzle.config `??` vs runtime `||` disagree on empty URL and db:migrate silently targets local file (drizzle.config.ts:8-9); rateLimit tests use a fake, no real libSQL SQL test. Reviewed boundary: 3ad8c35.
- T2b done (delegated writer) — 9130be2 `fix(db): fail fast without a database url in production`. New `src/db/config.ts` resolver shared by runtime and drizzle.config (no local fallback for migrations); `db:migrate:local` added; `db:generate` pins a local URL. RED: config.test.ts missing module; GREEN: npm test 576/576, tsc, lint clean; build clean without TURSO vars; `env -u TURSO_DATABASE_URL npm run db:migrate` exits 1 with a clear message. Real in-memory libSQL rate-limit test added. Parent spot check: vitest 576/576. RDD assess (base 3ad8c35): medium, under_budget — pending in slice.
- Engram mirror pending: mem_save refused (multiple active sessions for the project).

## Next Step
T3 (docs; mention db:migrate:local and that db:migrate needs exported TURSO vars), then T4 with owner authorization.
