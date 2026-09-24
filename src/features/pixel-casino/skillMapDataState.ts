/**
 * Pure state transition for the Skill Map's fetched server data (Phase
 * 3 T5, a review follow-up on T4): a failed refetch must never discard
 * previously fetched, validated data. `nextSkillMapData` is the single
 * place that decides how a new fetch result (success, or `null` for
 * any failure — see `fetchSkillMapStats.ts`) combines with whatever
 * was already known.
 *
 * - A successful fetch (`result` non-null) always replaces `data` and
 *   clears `stale`.
 * - A failed fetch (`result === null`) keeps the previous `data`
 *   untouched (same reference, so consumers memoized on it don't
 *   recompute for nothing) and sets `stale`.
 * - The offline session fallback (`buildSkillMapViewModel`'s `session`
 *   branch) only kicks in while `data` is still `null` — i.e. no fetch
 *   has ever succeeded — never merely because the most recent one
 *   failed.
 */

import type { StatsResponseBody } from "./skillMapStatsResponse";

export interface SkillMapDataState {
  /** The last successfully fetched, validated stats — `null` until (unless) a fetch first succeeds. */
  data: StatsResponseBody | null;
  /** True when the most recent fetch attempt failed (network error, non-2xx, or a malformed body). */
  stale: boolean;
}

export const INITIAL_SKILL_MAP_DATA_STATE: SkillMapDataState = { data: null, stale: false };

export function nextSkillMapData(prev: SkillMapDataState, result: StatsResponseBody | null): SkillMapDataState {
  if (result) return { data: result, stale: false };
  return { data: prev.data, stale: true };
}
