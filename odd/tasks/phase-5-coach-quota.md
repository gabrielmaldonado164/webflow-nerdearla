# Phase 5: Visible Coach Quota

Players can see how many AI coach questions remain today, can tell a reached limit from a provider failure, and do not lose a question when the provider fails.

## Problem

- The coach allows 20 AI requests per anonymous player per UTC day, but the UI never shows the remaining count.
- `reserveCoachCall` increments `coach_usage` before the provider call, so provider failures consume quota.
- `streamCoachReply` collapses every non-2xx response to `false`; an app 429 and a provider 503 look the same (generic offline fallback).

## Decisions (owner, 2026-09-24)

| Concern | Decision |
| --- | --- |
| Counter | Show remaining AI questions for today in the coach panel (for example `12/20 left today`). |
| Provider failure | Refund the reserved slot when the provider fails before the first text chunk. A stream interrupted after text was delivered still counts. |
| Limit reached | Show a distinct "daily limit reached, resets at 00:00 UTC" message; the template explanation still appears. |
| Read endpoint | `GET /api/coach/usage` reads the count by cookie; it never mints a player cookie. |

## Tasks

- [x] T1 Server: `releaseCoachCall` + `getCoachUsage` (test-first), refund on provider failure, `X-Coach-Remaining` header on success, `remaining` in 429/503 bodies, `GET /api/coach/usage`.
- [ ] T2 Client: typed `streamCoachReply` outcome (`ok` / `limit` / `unavailable` with remaining), usage fetch, counter and limit message in `CoachPanel`.
- [ ] T3 Local Cloudflare preview smoke + browser check of the counter, then docs.

## Constraints

- TDD: strict, on (session config). Runner: `npx vitest run`.
- The app must work without the AI; the template fallback stays.
- No deploy without owner approval.

## Route log

- T1+T2: delegated direct (writer trigger: 2+ non-trivial files across server and client).

## Progress

- T1 done. `releaseCoachCall`/`getCoachUsage` added to `src/coach/rateLimit.ts` (test-first, RED→GREEN, 5/5 passing). Stream route refunds the reserved slot on provider failure before the first text chunk (`startCoachStream` throw or `first.done`), adds `X-Coach-Remaining` on success and `remaining` in 429/post-reservation-503 bodies; pre-reservation 503s (no runtime/no key) omit it per spec. New `GET /api/coach/usage` follows the `stats` handler/route split (handler test-first, 5/5 passing), never mints a cookie. `npx vitest run`: 528/528 passed. `npx tsc --noEmit`: clean. `npm run lint`: clean. Decision (not in spec, applied conservatively): kept `stream/route.ts` untested directly (matches existing repo convention — no route-level tests anywhere, e.g. `decisions/route.ts`), relying on the now-thorough `rateLimit.ts` unit tests for the underlying reserve/release/read logic per the task's stated alternative.
