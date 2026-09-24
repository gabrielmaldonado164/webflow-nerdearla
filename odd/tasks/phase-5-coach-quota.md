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
- [x] T2 Client: typed `streamCoachReply` outcome (`ok` / `limit` / `unavailable` with remaining), usage fetch, counter and limit message in `CoachPanel`.
- [x] T2b Review follow-ups (review-e2b2b3091aaef17b approved + acknowledged, advisory findings accepted as in-scope fixes): refund note only for server-confirmed refunds (not merged stale remaining, not empty 200); post-reserve usage read must not leak a slot; usage fetch must not overwrite a newer stream outcome; extract the stream route into a tested handler that proves refund on provider failure.
- [ ] T3 Local Cloudflare preview smoke + browser check of the counter, then docs.

## Constraints

- TDD: strict, on (session config). Runner: `npx vitest run`.
- The app must work without the AI; the template fallback stays.
- No deploy without owner approval.

## Route log

- T2b: delegated direct (writer trigger: route, handler, client, panel).
- T1+T2: delegated direct (writer trigger: 2+ non-trivial files across server and client).

## Progress

- T1 done. `releaseCoachCall`/`getCoachUsage` added to `src/coach/rateLimit.ts` (test-first, RED→GREEN, 5/5 passing). Stream route refunds the reserved slot on provider failure before the first text chunk (`startCoachStream` throw or `first.done`), adds `X-Coach-Remaining` on success and `remaining` in 429/post-reservation-503 bodies; pre-reservation 503s (no runtime/no key) omit it per spec. New `GET /api/coach/usage` follows the `stats` handler/route split (handler test-first, 5/5 passing), never mints a cookie. `npx vitest run`: 528/528 passed. `npx tsc --noEmit`: clean. `npm run lint`: clean. Decision (not in spec, applied conservatively): kept `stream/route.ts` untested directly (matches existing repo convention — no route-level tests anywhere, e.g. `decisions/route.ts`), relying on the now-thorough `rateLimit.ts` unit tests for the underlying reserve/release/read logic per the task's stated alternative.
- T2 done (test-first, RED→GREEN throughout). `streamCoachReply` in `src/features/pixel-casino/coachRequest.ts` now returns a typed `CoachStreamOutcome` (`{kind:"ok",remaining}` / `{kind:"limit",remaining:0}` / `{kind:"unavailable",remaining}`) instead of a boolean: 429 → `limit`; non-2xx/no-body → `unavailable` with `remaining` parsed defensively from the JSON body (`null` when absent/malformed, matching the pre-reservation 503 case); a 200 with a non-empty stream → `ok` with `remaining` parsed defensively from `X-Coach-Remaining` (`null` if missing/non-integer); a 200 that streams empty text still counts as `unavailable` (existing behavior, now carrying the parsed `remaining`); network errors/aborts → `unavailable` with `remaining: null`. Added `fetchCoachUsage(signal)` calling `GET /api/coach/usage`, defensively validating `{limit, used, remaining}` are non-negative integers, `null` on any non-2xx/malformed/network failure. `coachRequest.test.ts`: 8 new/rewritten stream cases + 4 new usage cases, 13/13 passing (was 4/4).
  Added a small pure `coachQuotaCopy(state)` in the new `src/features/pixel-casino/coachQuotaCopy.ts` (test-first, 7/7 passing) deriving the counter string (`"N/limit AI questions left today"`, hidden until both `limit` and `remaining` are known), the distinct limit note (shown only on a `limit` outcome — "Daily AI limit reached. It resets at 00:00 UTC; the built-in explanations still work."), and the refund reassurance ("This didn't use one of your questions.", shown only on an `unavailable` outcome whose `remaining` is non-null, i.e. an actually-refunded provider failure — never for a pre-reservation 503 where `remaining` is unknown).
  `CoachPanel.tsx`: fetches usage once when the panel opens (aborts on close/unmount; `null`/failure leaves the counter hidden, no error shown); tracks `{limit, remaining, outcomeKind}` in one `quota` state, updated from the usage fetch and from each `ask()` call's stream outcome (`remaining` only overwritten when non-null, so a `null` from a failed body-parse doesn't blank out a previously known count). `ask()` now sets `source: "template"` for both `limit` and `unavailable` outcomes (previously any falsy result did this identically, so behavior for `unavailable` is unchanged; `limit` is new and intentionally also shows the template fallback per spec — "the template explanation still appears"). Rendered a new `.quota` block directly under the header (visible in both "why" and "chat" modes, since both consume a question) showing the counter plus the limit/refund note when applicable; new CSS in `CoachPanel.module.css` reuses the panel's existing monospace/border/color tokens, single-column and no fixed widths so it fits at 390px. Keyboard/focus effects untouched.
  Other caller: none besides `CoachPanel.tsx` and its test (`coachRequest.test.ts`) — checked via `rg -l streamCoachReply`.
  Verification: `npx vitest run`: 544/544 passed (was 528; +16 new tests: 11 coachRequest.test.ts net additions + 5 net additions from replacing 2 old stream assertions with richer typed-outcome ones, + 7 new coachQuotaCopy.test.ts). `npx tsc --noEmit`: clean. `npm run lint`: clean.
  Product-decision gap (not specified, applied conservatively): the spec says the counter/message sit "near the Ask the Dealer input/actions" but also implies the limit/refund notes are relevant to both "why" (auto-asked on open) and "chat" modes, since both spend a question. Placed the whole quota block once, directly below the header and above the mode-specific content, rather than duplicating it inside the chat-only `<form>` — flag for owner review if a stricter "only near the chat input" placement was intended.
- T2b done (test-first throughout, RED observed before each GREEN). Fixed the four review-confirmed defects:
  1. **False refund note.** `CoachStreamOutcome`'s `unavailable` variant now carries `refunded: boolean` (`src/features/pixel-casino/coachRequest.ts`), true only when the server returned a 503 JSON body with a numeric `remaining` (the confirmed post-refund read) — false for a network error, a pre-reservation 503 (no numeric `remaining`), a non-503 error status, and an empty 200 stream. `coachQuotaCopy` (`coachQuotaCopy.ts`) now gates `refundMessage` on `outcomeKind === "unavailable" && refunded` instead of `remaining !== null`. `CoachQuotaState` gained a `refunded` field. The counter still updates from any non-null `remaining` per spec (unchanged in `CoachPanel.tsx`).
  2. **Slot leak on post-reserve read failure.** In the new `handleCoachStreamRequest` (`src/app/api/coach/stream/handler.ts`), a failed `getCoachUsage` read right after a successful `reserveCoachCall` no longer throws out to a 503 (which would have kept the reservation but told the client "unavailable" while quietly leaking the slot's visibility): it's caught, `remaining` becomes `null`, and the request proceeds to the provider. `route.ts` omits `X-Coach-Remaining` when `remaining` is `null`. Refund paths (`refund()`) already had a `getCoachUsage`-failure fallback (kept, now falling back to the last known `remaining` instead of failing).
  3. **Usage-fetch race.** New pure `shouldApplyUsageFetch(state)` in `coachQuotaCopy.ts` returns `false` once any stream outcome has updated quota (`outcomeKind !== null`); `CoachPanel`'s usage-`GET` `.then` callback now checks it inside the `setQuota` updater before applying a resolved usage response, so a usage fetch that resolves after the auto-asked "why" stream already landed a newer `remaining` is discarded instead of overwriting it.
  4. **Extracted handler.** `POST /api/coach/stream` logic moved to `src/app/api/coach/stream/handler.ts` (`handleCoachStreamRequest`, injected `repo`/`startCoachStream`/`getProviderConfig`/cookie deps), test-first in `handler.test.ts` (11/11 passing: 400 on bad JSON and invalid body with no reservation attempted, 503 with no reservation when the provider config is unavailable, 429 with `remaining: 0` and no refund, 503 with no cookie when `reserveCoachCall` throws, a successful stream reports `remaining` and sets the cookie, refund + post-refund `remaining` on a provider throw, refund + 503 on an empty stream, no refund when the stream is interrupted after the first chunk, no leak/no 503 when the post-reserve usage read fails, cookie still set when the stream later fails). `route.ts` is now a thin adapter (mirrors `usage/route.ts`'s split): resolves the Cloudflare env once, wires deps, and turns the handler's plain result into either `Response.json` (error) or a `ReadableStream` response (success), preserving every existing behavior (400 invalid JSON, 503 no runtime/key with no reservation, cookie set after reservation, first-chunk preflight, `console.error` logging on each failure path, `Cache-Control: no-store`, `text/plain` streaming).
  RED confirmed for `handler.test.ts` (handler.ts moved aside — "Cannot find module") before restoring the implementation to GREEN; RED confirmed for the four affected `coachRequest.test.ts` assertions and the three new `coachQuotaCopy.test.ts`/`shouldApplyUsageFetch` assertions before implementing.
  Verification: `npx vitest run`: 559/559 passed (was 544; +15: 11 new `handler.test.ts` + 1 new `coachRequest.test.ts` (`refunded` on non-503) + 3 new `coachQuotaCopy.test.ts` (`shouldApplyUsageFetch`), net of edits to 4 existing assertions). `npx tsc --noEmit`: clean. `npm run lint`: clean.
  No new product-decision gaps.
