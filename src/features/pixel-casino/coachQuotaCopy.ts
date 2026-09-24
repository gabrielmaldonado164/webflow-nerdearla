/**
 * Pure copy/derivation for the coach panel's daily-quota counter and
 * notes. `limit` comes from `GET /api/coach/usage` (once, on open);
 * `remaining` starts from that same fetch and is refreshed after each
 * `streamCoachReply` outcome; `outcomeKind` is the last stream outcome's
 * kind, or `null` before any stream has completed.
 */

export interface CoachQuotaState {
  limit: number | null;
  remaining: number | null;
  outcomeKind: "ok" | "limit" | "unavailable" | null;
}

export interface CoachQuotaCopy {
  /** e.g. "12/20 AI questions left today"; `null` until both limit and remaining are known. */
  counter: string | null;
  /** Distinct note shown only right after a `limit` outcome. */
  limitMessage: string | null;
  /** Reassurance shown only after an `unavailable` outcome whose remaining count is known (refunded). */
  refundMessage: string | null;
}

const LIMIT_MESSAGE = "Daily AI limit reached. It resets at 00:00 UTC; the built-in explanations still work.";
const REFUND_MESSAGE = "This didn't use one of your questions.";

export function coachQuotaCopy({ limit, remaining, outcomeKind }: CoachQuotaState): CoachQuotaCopy {
  const counter = limit !== null && remaining !== null ? `${remaining}/${limit} AI questions left today` : null;

  return {
    counter,
    limitMessage: outcomeKind === "limit" ? LIMIT_MESSAGE : null,
    refundMessage: outcomeKind === "unavailable" && remaining !== null ? REFUND_MESSAGE : null,
  };
}
