/**
 * Pure copy/derivation for the coach panel's daily-quota counter and
 * notes. `limit` comes from `GET /api/coach/usage` (once, on open);
 * `remaining` starts from that same fetch and is refreshed after each
 * `streamCoachReply` outcome; `outcomeKind` is the last stream outcome's
 * kind, or `null` before any stream has completed; `refunded` is that
 * outcome's server-confirmed refund flag (only meaningful when
 * `outcomeKind === "unavailable"`).
 */

export interface CoachQuotaState {
  limit: number | null;
  remaining: number | null;
  outcomeKind: "ok" | "limit" | "unavailable" | null;
  /** Server-confirmed refund for the last `unavailable` outcome; ignored otherwise. */
  refunded: boolean;
}

export interface CoachQuotaCopy {
  /** e.g. "12/20 AI questions left today"; `null` until both limit and remaining are known. */
  counter: string | null;
  /** Distinct note shown after a `limit` outcome or whenever no questions remain. */
  limitMessage: string | null;
  /** Reassurance shown only after an `unavailable` outcome the server confirmed it refunded. */
  refundMessage: string | null;
}

const LIMIT_MESSAGE = "Daily AI limit reached. It resets at 00:00 UTC; the built-in explanations still work.";
const REFUND_MESSAGE = "This didn't use one of your questions.";

export function coachQuotaCopy({ limit, remaining, outcomeKind, refunded }: CoachQuotaState): CoachQuotaCopy {
  const counter = limit !== null && remaining !== null ? `${remaining}/${limit} AI questions left today` : null;

  return {
    counter,
    limitMessage: outcomeKind === "limit" || remaining === 0 ? LIMIT_MESSAGE : null,
    refundMessage: outcomeKind === "unavailable" && refunded ? REFUND_MESSAGE : null,
  };
}

/**
 * Merges a `GET /api/coach/usage` response into the panel's quota state.
 * Resolves the usage-fetch-vs-stream-outcome race in `CoachPanel`: the
 * usage `GET` fired on open and the auto-asked "why" stream can resolve
 * in either order.
 *
 * `limit` only ever comes from this usage fetch (a stream outcome never
 * carries it), so it is always applied — dropping the whole response
 * once a stream outcome had landed used to hide the counter forever.
 * `remaining` is applied from usage only when no stream outcome has
 * already provided a non-null `remaining`; a stream outcome's non-null
 * `remaining` is always at least as recent as this usage fetch and wins.
 */
export function mergeUsageIntoQuota(
  current: CoachQuotaState,
  usage: { limit: number; remaining: number },
): CoachQuotaState {
  const hasNewerRemaining = current.outcomeKind !== null && current.remaining !== null;
  return {
    limit: usage.limit,
    remaining: hasNewerRemaining ? current.remaining : usage.remaining,
    outcomeKind: current.outcomeKind,
    refunded: current.refunded,
  };
}
