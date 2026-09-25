"use client";

/**
 * Client-side practice session state. Owns the RNG, the current scenario,
 * and the running list of decisions this session produced. Persistence
 * (Phase 2b) plugs in through the optional `onDecision` callback: every
 * decision that resolves gets handed to it once, in addition to being kept
 * in local session state for `sessionStats`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Action, ExplainDecisionResult, Scenario } from "@/blackjack";
import {
  DEFAULT_RULES,
  createRng,
  explainDecision,
  generateScenario,
} from "@/blackjack";

import { computeSessionStats, type SessionStats } from "./sessionStats";
import type { DecisionRecord } from "./types";

export interface PracticeFeedback extends ExplainDecisionResult {
  userAction: Action;
  optimalAction: Action;
}

export interface UsePracticeSessionOptions {
  onDecision?: (record: DecisionRecord) => void;
  /** Overrides the RNG seed; defaults to a random one per session. */
  seed?: number;
}

export interface UsePracticeSession {
  /**
   * `null` until the first client-only scenario has been generated (see
   * the `isReady` note below). Never populated during server rendering, so
   * the server and the first client render always agree.
   */
  scenario: Scenario | null;
  feedback: PracticeFeedback | null;
  decisions: DecisionRecord[];
  stats: SessionStats;
  hasPlayedFirstHand: boolean;
  /** True once a scenario has been generated on the client and is safe to render. */
  isReady: boolean;
  choose: (action: Action) => void;
  next: () => void;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

export function usePracticeSession(
  options: UsePracticeSessionOptions = {},
): UsePracticeSession {
  const { onDecision, seed } = options;
  // `createRng` returns a stateful closure (mulberry32): calling it mutates
  // its own internal state, not React state, so a plain ref is enough to
  // keep the same generator identity across renders once it exists.
  const rngRef = useRef<(() => number) | null>(null);
  // The scenario is randomly generated, so it must never be produced during
  // the render that runs on the server (or React's first client render,
  // which has to match it): both would need the exact same random draw to
  // avoid a hydration mismatch, which isn't possible with real randomness.
  // Instead we start with `null` on both the server and the client, then
  // create the RNG and the first scenario from an effect, which only ever
  // runs in the browser after hydration is done.
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);

  useEffect(() => {
    if (rngRef.current) return; // Already initialized (e.g. StrictMode double-invoke).
    rngRef.current = createRng(seed ?? randomSeed());
    setScenario(generateScenario(rngRef.current, DEFAULT_RULES));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = useCallback(
    (action: Action) => {
      if (feedback || !scenario) return; // A decision is already pending review, or not ready yet.

      const result = explainDecision({
        playerCards: scenario.playerCards,
        dealerUpcard: scenario.dealerUpcard,
        userAction: action,
        optimalAction: scenario.optimalAction,
      });

      setFeedback({
        ...result,
        userAction: action,
        optimalAction: scenario.optimalAction,
      });

      const record: DecisionRecord = {
        playerCards: scenario.playerCards,
        dealerUpcard: scenario.dealerUpcard,
        availableActions: scenario.availableActions,
        userAction: action,
        optimalAction: scenario.optimalAction,
        isCorrect: result.isCorrect,
        category: scenario.category,
        label: scenario.label,
        decidedAt: new Date().toISOString(),
      };

      setDecisions((prev) => [...prev, record]);
      onDecision?.(record);
    },
    [feedback, onDecision, scenario],
  );

  const next = useCallback(() => {
    if (!rngRef.current) return;
    setFeedback(null);
    setScenario(generateScenario(rngRef.current, DEFAULT_RULES));
  }, []);

  const stats = useMemo(() => computeSessionStats(decisions), [decisions]);

  return {
    scenario,
    feedback,
    decisions,
    stats,
    hasPlayedFirstHand: decisions.length > 0,
    isReady: scenario !== null,
    choose,
    next,
  };
}
