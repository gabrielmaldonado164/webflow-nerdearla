# Phase 5: Daily Challenge

The first Phase 5 work unit gives every player the same ten strategy hands each UTC day without changing the practice session. Players get one final result per day; the server, not the browser, computes the score.

## Play path

1. Open the calendar button in the HUD.
2. Choose a legal move for each hand. Feedback uses the existing strategy engine.
3. Finish ten hands or stop after three misses. Save the result and return tomorrow for a new set.

## Decisions

| Concern | Decision |
| --- | --- |
| Reproducibility | Seed each hand independently with version, UTC date, and hand index. Persist the canonical set in D1. |
| Scoring | Submit actions and elapsed time; regrade against the stored canonical set. Never accept a client score. |
| Identity | Reuse the anonymous player cookie. GET does not mint a player; POST does. |
| Retries | The first saved result for a player/date wins, including concurrent submissions. |
| Midnight | Accept yesterday's completed run for the first 15 minutes after 00:00 UTC. |
| Leaderboard | Deferred at the roadmap cut line; a public ranking needs separate privacy and abuse decisions. |

## Verification

- `npm test -- --reporter=dot`: 518 tests passed.
- `npx tsc --noEmit` and `npm run lint`: passed.
- `npm run build`: passed with network access for the existing Geist font download.
- SQLite migration applied with prior migrations by the backend work unit.
- OpenNext bundle and local D1 migration passed. Local Cloudflare preview returned ten hands; a completed run saved and read back its engine-graded result (2/5, 40%).
- The production-mode preview marks `lab_player` Secure, so HTTP localhost clients must explicitly resend the cookie for this smoke test. The public HTTPS site is unaffected.
- 2026-09-24 browser QA (Playwright, local Cloudflare preview): 390x844 and 1280x800 play, feedback, save, reload, Esc/focus return, and the `/api/daily` failure state all work with no horizontal scroll. Found and fixed: a reloaded saved result showed `0/3 MISSES`; it now derives misses from the saved result (`dailyResultMisses`, test-first) and the footer no longer promises in-progress state after completion. 519 tests, tsc, and lint pass.

## Remaining Phase 5 work

- Polish loading/error/empty states across the existing coach and Skill Map as needed.
- Deploy and smoke the public URL only after the owner approves the production mutation.
