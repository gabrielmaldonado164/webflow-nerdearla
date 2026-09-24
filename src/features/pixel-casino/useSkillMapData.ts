"use client";

/**
 * Client-side data source for the Skill Map panel and the game-over
 * summary (Phase 3 T4; refetch semantics fixed and refetch trigger
 * sequenced properly in T5). Fetches `GET /api/stats` while `active`
 * (the panel is open, or the run just ended), and again — debounced —
 * whenever the caller reports a decision's persistence POST has
 * settled via `notifyDecisionSettled` (see `sendDecision.ts`'s
 * resolve-never-reject contract and `PixelCasinoScreen.tsx`'s
 * `handleDecision`), while still active. Not unit-tested directly
 * (timers + fetch, no DOM/hook-testing harness in this repo — see
 * `usePracticeSession.ts`'s own note on the same constraint); its pure
 * building blocks (`fetchSkillMapStats`, `parseStatsResponse`,
 * `buildStatsRequestUrl`, `nextSkillMapData`) are.
 *
 * Every fetch result — success or failure — flows through the pure
 * `nextSkillMapData` reducer (`skillMapDataState.ts`, T5): a failed
 * refetch never discards previously fetched, validated data. `data`
 * only ever reads `null` (the "never fetched" / offline-fallback
 * state) before the very first successful fetch; after that, a failing
 * refetch just marks `stale` and leaves `data` as the last good result.
 * Deliberately never clears `data` when `active` turns false, either:
 * reopening the panel doesn't flash back to a loading/empty state
 * before the next fetch resolves.
 *
 * Previously (T4) this refetched on a blind 500 ms timer keyed off a
 * `decisionsCount` prop change, so stats could lag one decision behind
 * whatever the actual `POST /api/decisions` timing was. `sendDecision`
 * now resolves once its request has genuinely settled, so the caller
 * can call `notifyDecisionSettled()` right then instead — this hook
 * still applies a short debounce internally to coalesce a burst of
 * near-simultaneous notifications into a single refetch.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";

import { fetchSkillMapStats } from "./fetchSkillMapStats";
import { INITIAL_SKILL_MAP_DATA_STATE, nextSkillMapData } from "./skillMapDataState";
import type { StatsResponseBody } from "./skillMapStatsResponse";

export interface UseSkillMapDataOptions {
  /** Whether fetching should run right now. */
  active: boolean;
  /** Debounce delay (ms) for coalescing consecutive `notifyDecisionSettled` calls. */
  debounceMs?: number;
}

export interface UseSkillMapData {
  /** The last successful, validated fetch result, or `null` (no fetch has ever succeeded yet). */
  data: StatsResponseBody | null;
  /** True when the most recent refetch attempt failed; `data` still holds the last good result. */
  stale: boolean;
  /**
   * Call once a decision's persistence POST has settled (success or
   * failure) to trigger a (debounced) refetch while active. A no-op
   * while inactive.
   */
  notifyDecisionSettled: () => void;
}

export function useSkillMapData({ active, debounceMs = 500 }: UseSkillMapDataOptions): UseSkillMapData {
  const [state, dispatch] = useReducer(nextSkillMapData, INITIAL_SKILL_MAP_DATA_STATE);
  const requestIdRef = useRef(0);

  // `notifyDecisionSettled` fires from an async callback that may run
  // after `active` has changed since the call was made (e.g. the panel
  // closed while a decision's POST was still in flight); a ref keeps
  // the check current without making the callback's identity depend on
  // it, matching this file's own `active`-driven-effect pattern above.
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

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

  // Debounced refetch triggered by the caller right after a decision's
  // POST settles, coalescing a burst of near-simultaneous notifications
  // (e.g. two decisions resolving close together) into one refetch.
  const debounceTimerRef = useRef<number | null>(null);
  const notifyDecisionSettled = useCallback(() => {
    if (!activeRef.current) return;
    if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      refresh();
    }, debounceMs);
  }, [debounceMs, refresh]);

  useEffect(
    () => () => {
      if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current);
    },
    [],
  );

  return { data: state.data, stale: state.stale, notifyDecisionSettled };
}
