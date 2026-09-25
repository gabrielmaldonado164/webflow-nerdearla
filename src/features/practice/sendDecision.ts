/**
 * Fire-and-forget sender for a decision (Phase 2b T3): persistence is an
 * enhancement, never a gate on gameplay (D7-style resilience). Every
 * failure — a rejected fetch, a non-2xx response, or `fetch` throwing
 * synchronously — is swallowed; this function never throws, and the
 * *game* never awaits it (`usePracticeSession` calls `onDecision`
 * without awaiting its result), so a slow or offline API can never
 * block or break the game.
 *
 * Returns a `Promise<void>` that always resolves, never rejects, once
 * the POST has settled — win, lose, or throw (T5, review follow-up on
 * T4: this lets a caller sequence work after persistence, e.g.
 * `PixelCasinoScreen`'s Skill Map refresh, instead of guessing with a
 * fixed timer). The promise is purely an optional convenience for that
 * kind of sequencing; nothing about `sendDecision`'s own
 * fire-and-forget contract changes, and the game itself still ignores
 * it.
 *
 * A stable, module-level function (not created per-render) so it can be
 * passed directly as `usePracticeSession({ onDecision: sendDecision })`
 * without defeating the hook's `useCallback` memoization.
 */

import { buildDecisionRequest } from "./decisionRequest";
import type { DecisionRecord } from "./types";

export function sendDecision(record: DecisionRecord): Promise<void> {
  try {
    const { url, body } = buildDecisionRequest(record);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).then(
      () => undefined,
      () => undefined, // Swallowed intentionally: see module doc.
    );
  } catch {
    // Swallowed intentionally: see module doc.
    return Promise.resolve();
  }
}
