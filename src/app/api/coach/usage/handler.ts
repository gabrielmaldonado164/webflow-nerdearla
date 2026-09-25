/**
 * Pure handler for `GET /api/coach/usage` (Phase 5 T1). Mirrors
 * `src/app/api/stats/handler.ts`: all the actual logic — validating the
 * cookie and reading today's coach usage — lives here behind injected
 * dependencies (`CoachUsageHandlerDeps`), unit-testable with fakes
 * instead of a real Next.js `Request`/`cookies()`/D1 binding. `route.ts`
 * is a thin adapter wiring these deps to the real runtime.
 *
 * Never mints or sets a cookie: an absent or invalid cookie means there
 * is no known player, so the response is always the full default limit,
 * and the repository is never queried.
 *
 * Never returns `error.message` or a stack for a repository/runtime
 * failure (503): only a fixed, generic message. The real error is
 * expected to be logged by the caller for operability.
 */

import { DAILY_COACH_LIMIT } from "@/coach/rateLimit";
import { isValidPlayerId } from "@/player/playerId";

export interface CoachUsageHandlerRepo {
  getCoachUsage(playerId: string, date: string): Promise<{ limit: number; used: number; remaining: number }>;
}

export interface CoachUsageHandlerDeps {
  /** Reads the incoming player cookie value, if any. */
  readCookie: () => string | undefined;
  /** Today's UTC date as `YYYY-MM-DD`. */
  today: () => string;
  repo: CoachUsageHandlerRepo;
}

export interface CoachUsageHandlerResult {
  status: number;
  body: { limit: number; used: number; remaining: number } | { error: string };
}

const GENERIC_SERVER_ERROR = "coach usage unavailable";

/**
 * Handles one `GET /api/coach/usage` request. Structurally invalid or
 * absent cookies are treated identically to a brand-new player: `200`
 * with the full default limit, no repository call.
 */
export async function handleCoachUsageRequest(deps: CoachUsageHandlerDeps): Promise<CoachUsageHandlerResult> {
  const cookieValue = deps.readCookie();
  if (!isValidPlayerId(cookieValue)) {
    return { status: 200, body: { limit: DAILY_COACH_LIMIT, used: 0, remaining: DAILY_COACH_LIMIT } };
  }

  try {
    const usage = await deps.repo.getCoachUsage(cookieValue, deps.today());
    return { status: 200, body: usage };
  } catch (error) {
    console.error("Failed to load coach usage:", error);
    return { status: 503, body: { error: GENERIC_SERVER_ERROR } };
  }
}
