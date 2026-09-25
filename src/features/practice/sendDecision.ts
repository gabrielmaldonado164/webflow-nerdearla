/**
 * Fire-and-forget sender for a decision (Phase 2b T3): persistence is an
 * enhancement, never a gate on gameplay (D7-style resilience). Every
 * failure — a rejected fetch, a non-2xx response, or `fetch` throwing
 * synchronously — is swallowed; this function never throws and the
 * caller never awaits it, so a slow or offline API can never block or
 * break the game.
 *
 * A stable, module-level function (not created per-render) so it can be
 * passed directly as `usePracticeSession({ onDecision: sendDecision })`
 * without defeating the hook's `useCallback` memoization.
 */

import { buildDecisionRequest } from "./decisionRequest";
import type { DecisionRecord } from "./types";

export function sendDecision(record: DecisionRecord): void {
  try {
    const { url, body } = buildDecisionRequest(record);
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {
      // Swallowed intentionally: see module doc.
    });
  } catch {
    // Swallowed intentionally: see module doc.
  }
}
