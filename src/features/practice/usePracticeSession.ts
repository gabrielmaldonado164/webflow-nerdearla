"use client";

/**
 * Client-side practice session state: a thin React adapter around the pure
 * `sessionReducer`. Owns the RNG and the impure bits the reducer can't do
 * itself (dealing the hole card, resolving the played-out hand), then hands
 * the reducer pre-computed events. Persistence (Phase 2b) plugs in through
 * the optional `onDecision` callback: every accepted decision gets handed
 * to it once, in addition to being kept in local session state for
 * `sessionStats`.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import type { Action, Card, Scenario } from "@/blackjack";
import { DEFAULT_RULES, createRng, dealHoleCard, drawCard, generateScenario } from "@/blackjack";
import type { RunState } from "@/training/run";

import {
  createInitialSessionState,
  sessionReducer,
  type SessionEvent,
  type SessionFeedback,
  type SessionState,
} from "./sessionReducer";
import { dealNextHandIfAllowed, resolveActionIfAllowed } from "./sessionRng";
import { computeSessionStats, type SessionStats } from "./sessionStats";
import type { DecisionRecord } from "./types";

export type { SessionFeedback as PracticeFeedback } from "./sessionReducer";

export interface UsePracticeSessionOptions {
  onDecision?: (record: DecisionRecord) => void;
  /** Overrides the RNG seed; defaults to a random one per session. */
  seed?: number;
  /** Initial best score (e.g. loaded from storage in a later phase). */
  bestScore?: number;
}

export interface UsePracticeSession {
  /**
   * `null` until the first client-only scenario has been generated (see
   * the `isReady` note below). Never populated during server rendering, so
   * the server and the first client render always agree.
   */
  scenario: Scenario | null;
  /** The dealer's hidden card, dealt alongside the scenario. */
  holeCard: Card | null;
  feedback: SessionFeedback | null;
  decisions: DecisionRecord[];
  stats: SessionStats;
  run: RunState;
  hasPlayedFirstHand: boolean;
  /** True once a scenario has been generated on the client and is safe to render. */
  isReady: boolean;
  choose: (action: Action) => void;
  next: () => void;
  /** Starts a fresh run (lives/score/streak), dealing a new hand. */
  restart: () => void;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

export function usePracticeSession(
  options: UsePracticeSessionOptions = {},
): UsePracticeSession {
  const { onDecision, seed, bestScore } = options;
  // `createRng` returns a stateful closure (mulberry32): calling it mutates
  // its own internal state, not React state, so a plain ref is enough to
  // keep the same generator identity across renders once it exists.
  const rngRef = useRef<(() => number) | null>(null);

  const [state, dispatch] = useReducer(
    sessionReducer,
    undefined,
    (): SessionState => createInitialSessionState(bestScore),
  );
  // Mirrors `state`, updated synchronously on every dispatch below. `state`
  // itself only reflects reality after the next render, so two `choose`
  // calls in the same tick (e.g. a duplicated key/click event firing twice
  // before React re-renders) would otherwise both read the same stale
  // `feedback` from their shared closure and could both record a decision
  // and fire `onDecision`. Reading this ref instead of `state` closes that
  // gap: the very next call sees the real post-dispatch state immediately.
  const stateRef = useRef<SessionState>(state);

  // Returns the freshly synced state so callers that need to know what
  // changed (e.g. `choose`, to read back the decision it just recorded)
  // don't have to duplicate the sync themselves.
  const dispatchAndSync = useCallback((event: SessionEvent): SessionState => {
    const nextState = sessionReducer(stateRef.current, event);
    stateRef.current = nextState;
    dispatch(event);
    return nextState;
  }, []);

  useEffect(() => {
    if (rngRef.current) return; // Already initialized (e.g. StrictMode double-invoke).
    // The scenario (and hole card) are randomly generated, so they must
    // never be produced during the render that runs on the server (or
    // React's first client render, which has to match it): both would need
    // the exact same random draw to avoid a hydration mismatch, which
    // isn't possible with real randomness. Instead we start with `null` on
    // both the server and the client, then create the RNG and deal the
    // first hand from an effect, which only ever runs in the browser after
    // hydration is done.
    const rng = createRng(seed ?? randomSeed());
    rngRef.current = rng;
    const dealt = dealNextHandIfAllowed(stateRef.current, rng, DEFAULT_RULES);
    if (!dealt) return; // Unreachable on a fresh session; canDeal is always true here.
    dispatchAndSync({ type: "deal", scenario: dealt.scenario, holeCard: dealt.holeCard });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = useCallback(
    (action: Action) => {
      const rng = rngRef.current;
      if (!rng) return; // Not ready yet.

      // Gated on `canDecide` (via `resolveActionIfAllowed`) *before* any
      // rng draw: an ignored decision (feedback pending, run over, no
      // scenario, or an unavailable action) must never consume the rng,
      // or seeded sessions stop being reproducible.
      const resolution = resolveActionIfAllowed(stateRef.current, action, rng, DEFAULT_RULES);
      if (!resolution) return; // Ignored.

      const event = {
        type: "decide" as const,
        action,
        resolution,
        decidedAt: new Date().toISOString(),
      };

      const nextState = dispatchAndSync(event);
      onDecision?.(nextState.decisions[nextState.decisions.length - 1]);
    },
    [onDecision, dispatchAndSync],
  );

  const next = useCallback(() => {
    const rng = rngRef.current;
    if (!rng) return;

    // Gated on `canDeal` (via `dealNextHandIfAllowed`) before drawing: a
    // `next()` call once the run is over must not consume the rng either,
    // since the reducer would drop the dealt hand anyway.
    const dealt = dealNextHandIfAllowed(stateRef.current, rng, DEFAULT_RULES);
    if (!dealt) return; // Ignored: the run is over.
    dispatchAndSync({ type: "deal", scenario: dealt.scenario, holeCard: dealt.holeCard });
  }, [dispatchAndSync]);

  const restart = useCallback(() => {
    const rng = rngRef.current;
    if (!rng) return;
    const scenario = generateScenario(rng, DEFAULT_RULES);
    const holeCard = dealHoleCard(scenario.dealerUpcard, () => drawCard(rng));
    dispatchAndSync({ type: "restart", scenario, holeCard });
  }, [dispatchAndSync]);

  const stats = useMemo(() => computeSessionStats(state.decisions), [state.decisions]);

  return {
    scenario: state.scenario,
    holeCard: state.holeCard,
    feedback: state.feedback,
    decisions: state.decisions,
    stats,
    run: state.run,
    hasPlayedFirstHand: state.decisions.length > 0,
    isReady: state.scenario !== null,
    choose,
    next,
    restart,
  };
}
