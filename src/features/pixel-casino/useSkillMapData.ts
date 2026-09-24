"use client";

/**
 * Client-side data source for the Skill Map panel and the game-over
 * summary (Phase 3 T4): fetches `GET /api/stats` while `active`
 * (the panel is open, or the run just ended), and again — debounced —
 * after each new decision while still active. Not unit-tested directly
 * (timers + fetch, no DOM/hook-testing harness in this repo — see
 * `usePracticeSession.ts`'s own note on the same constraint); its pure
 * building blocks (`fetchSkillMapStats`, `parseStatsResponse`,
 * `buildStatsRequestUrl`, `nextSkillMapData`) are.
 *
 * Every fetch result — success or failure — flows through the pure
 * `nextSkillMapData` reducer (`skillMapDataState.ts`, T5 review
 * follow-up): a failed refetch never discards previously fetched,
 * validated data. `data` only ever reads `null` (the "never fetched" /
 * offline-fallback state) before the very first successful fetch;
 * after that, a failing refetch just marks `stale` and leaves `data`
 * as the last good result. Deliberately never clears `data` when
 * `active` turns false, either: reopening the panel doesn't flash back
 * to a loading/empty state before the next fetch resolves.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";

import { fetchSkillMapStats } from "./fetchSkillMapStats";
import { INITIAL_SKILL_MAP_DATA_STATE, nextSkillMapData } from "./skillMapDataState";
import type { StatsResponseBody } from "./skillMapStatsResponse";

export interface UseSkillMapDataOptions {
  /** Whether fetching should run right now. */
  active: boolean;
  /** Changes whenever a new decision is recorded; triggers a debounced refetch while active. */
  decisionsCount: number;
  /** Debounce delay (ms) for decision-triggered refetches. */
  debounceMs?: number;
}

export interface UseSkillMapData {
  /** The last successful, validated fetch result, or `null` (no fetch has ever succeeded yet). */
  data: StatsResponseBody | null;
  /** True when the most recent refetch attempt failed; `data` still holds the last good result. */
  stale: boolean;
}

export function useSkillMapData({ active, decisionsCount, debounceMs = 500 }: UseSkillMapDataOptions): UseSkillMapData {
  const [state, dispatch] = useReducer(nextSkillMapData, INITIAL_SKILL_MAP_DATA_STATE);
  const requestIdRef = useRef(0);

  const refresh = useCallback(() => {
    const requestId = ++requestIdRef.current;
    void fetchSkillMapStats().then((result) => {
      if (requestIdRef.current !== requestId) return; // Superseded by a newer request.
      dispatch(result);
    });
  }, []);

  // Fetches immediately whenever this becomes active (panel opens, or the run ends).
  useEffect(() => {
    if (!active) return;
    refresh();
  }, [active, refresh]);

  // Debounced refetch after a new decision, but only while active, and
  // only for an actual change (not just `active` itself flipping, which
  // the effect above already handles) — avoids a redundant second fetch
  // on open, and keeps tracking decisions made while inactive without
  // firing anything for them until the next activation.
  const prevDecisionsCountRef = useRef(decisionsCount);
  useEffect(() => {
    const changed = prevDecisionsCountRef.current !== decisionsCount;
    prevDecisionsCountRef.current = decisionsCount;
    if (!active || !changed) return;

    const timer = window.setTimeout(refresh, debounceMs);
    return () => window.clearTimeout(timer);
  }, [decisionsCount, active, debounceMs, refresh]);

  return { data: state.data, stale: state.stale };
}
