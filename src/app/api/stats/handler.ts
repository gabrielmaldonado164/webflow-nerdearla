/**
 * Pure handler for `GET /api/stats` (Phase 3 T1, achievements added T2).
 * Everything the route actually does — validating the cookie, fetching
 * the player's decision history, and computing stats/achievements —
 * lives here behind injected dependencies (`StatsHandlerDeps`),
 * unit-testable with fakes instead of a real Next.js
 * `Request`/`cookies()`/D1 binding. `route.ts` is a thin adapter wiring
 * these deps to the real runtime.
 *
 * Never mints or sets a cookie (unlike `POST /api/decisions`): an
 * absent or invalid cookie means there is no known player, so the
 * response is always empty stats/achievements, and the repository is
 * never queried.
 *
 * Never returns `error.message` or a stack for a repository failure
 * (500): only a fixed, generic message. The real error is expected to
 * be logged by the caller for operability.
 */

import type { Achievement } from "@/player/achievements";
import { deriveAchievements } from "@/player/achievements";
import type { PlayerStats } from "@/player/playerStats";
import { computePlayerStats } from "@/player/playerStats";
import { isValidPlayerId } from "@/player/playerId";
import type { DecisionRow } from "@/player/recordDecision";

export interface StatsHandlerRepo {
  listPlayerDecisions(playerId: string): Promise<DecisionRow[]>;
}

export interface StatsHandlerDeps {
  /** Reads the incoming player cookie value, if any. */
  readCookie: () => string | undefined;
  repo: StatsHandlerRepo;
}

export interface StatsHandlerResult {
  status: number;
  body: { stats: PlayerStats; achievements: Achievement[] } | { error: string };
}

const GENERIC_SERVER_ERROR = "failed to load stats";

/**
 * Handles one `GET /api/stats` request. Structurally invalid or absent
 * cookies are treated identically to a brand-new player: `200` with
 * empty stats, no repository call.
 */
export async function handleStatsRequest(deps: StatsHandlerDeps): Promise<StatsHandlerResult> {
  const cookieValue = deps.readCookie();
  if (!isValidPlayerId(cookieValue)) {
    return { status: 200, body: { stats: computePlayerStats([]), achievements: deriveAchievements([]) } };
  }

  try {
    const decisions = await deps.repo.listPlayerDecisions(cookieValue);
    return {
      status: 200,
      body: { stats: computePlayerStats(decisions), achievements: deriveAchievements(decisions) },
    };
  } catch (error) {
    console.error("Failed to load player stats:", error);
    return { status: 500, body: { error: GENERIC_SERVER_ERROR } };
  }
}
