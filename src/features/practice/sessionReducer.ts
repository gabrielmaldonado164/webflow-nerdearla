/**
 * Pure reducer for a practice session: the current scenario, the dealer's
 * hole card, pending feedback (grading plus the resolved hand), the running
 * decision history, and the run-mode state (lives/score/combo/best score).
 *
 * Events carry pre-computed random data (a dealt scenario, a hole card, a
 * resolved hand) so this module stays pure and deterministic; all
 * randomness (RNG draws, `resolveHand`) is the caller's responsibility
 * (see `usePracticeSession`).
 *
 * Grading is always against `optimalAction`, via `explainDecision` — never
 * against the resolved hand's outcome. The resolution is display-only data
 * carried in `feedback.resolution`.
 */

import type { Action, Card, ExplainDecisionResult, ResolveHandResult, Scenario } from "@/blackjack";
import { explainDecision } from "@/blackjack";
import { createInitialRunState, runReducer, type RunState } from "@/training/run";

import type { DecisionRecord } from "./types";

export interface SessionFeedback extends ExplainDecisionResult {
  userAction: Action;
  optimalAction: Action;
  resolution: ResolveHandResult;
}

export interface SessionState {
  /**
   * `null` until a hand has been dealt (see `usePracticeSession`'s
   * client-only first deal, which avoids a hydration mismatch).
   */
  scenario: Scenario | null;
  holeCard: Card | null;
  feedback: SessionFeedback | null;
  decisions: DecisionRecord[];
  run: RunState;
}

export type SessionEvent =
  | { type: "deal"; scenario: Scenario; holeCard: Card }
  | { type: "decide"; action: Action; resolution: ResolveHandResult; decidedAt: string }
  | { type: "restart"; scenario: Scenario; holeCard: Card; bestScore?: number };

/** A fresh session: no hand dealt yet, empty decision history, a fresh run. */
export function createInitialSessionState(bestScore = 0): SessionState {
  return {
    scenario: null,
    holeCard: null,
    feedback: null,
    decisions: [],
    run: createInitialRunState(bestScore),
  };
}

export interface ApplyDecisionResult {
  state: SessionState;
  /** The recorded decision, or `null` when the decision was ignored. */
  record: DecisionRecord | null;
}

/**
 * True when `action` would be accepted as a decision against `state`:
 * there is a dealt scenario, no feedback is already pending, the run
 * isn't over, and the action is in `scenario.availableActions`.
 *
 * Pure and RNG-free, so callers that resolve a hand from a seeded RNG
 * (e.g. `usePracticeSession`) can check this *before* drawing any cards,
 * keeping ignored decisions from consuming the RNG and breaking seeded
 * determinism.
 */
export function canDecide(state: SessionState, action: Action): boolean {
  const { scenario } = state;
  return (
    scenario !== null &&
    state.feedback === null &&
    state.run.status !== "over" &&
    scenario.availableActions.includes(action)
  );
}

/**
 * True when a `deal` event would be accepted against `state`: the run
 * isn't over. Pure and RNG-free, for the same reason as `canDecide` —
 * callers that deal a scenario + hole card from a seeded RNG should
 * check this first.
 */
export function canDeal(state: SessionState): boolean {
  return state.run.status !== "over";
}

/**
 * Applies a `decide` event on its own, returning both the next state and
 * the resulting `DecisionRecord` (or `null` when the event was ignored).
 * This lets a caller tell whether the decision was accepted without
 * comparing state references, so it can fire a side effect (e.g.
 * `onDecision`) exactly once per accepted decision.
 *
 * Ignored (state returned unchanged, by reference) when `canDecide` is
 * false for this action.
 */
export function applyDecision(
  state: SessionState,
  event: Extract<SessionEvent, { type: "decide" }>,
): ApplyDecisionResult {
  const { scenario } = state;
  if (!scenario || !canDecide(state, event.action)) {
    return { state, record: null };
  }

  const explained = explainDecision({
    playerCards: scenario.playerCards,
    dealerUpcard: scenario.dealerUpcard,
    userAction: event.action,
    optimalAction: scenario.optimalAction,
  });

  const record: DecisionRecord = {
    playerCards: scenario.playerCards,
    dealerUpcard: scenario.dealerUpcard,
    availableActions: scenario.availableActions,
    userAction: event.action,
    optimalAction: scenario.optimalAction,
    isCorrect: explained.isCorrect,
    category: scenario.category,
    label: scenario.label,
    decidedAt: event.decidedAt,
  };

  const feedback: SessionFeedback = {
    ...explained,
    userAction: event.action,
    optimalAction: scenario.optimalAction,
    resolution: event.resolution,
  };

  const nextState: SessionState = {
    ...state,
    feedback,
    decisions: [...state.decisions, record],
    run: runReducer(state.run, { type: "decision", isCorrect: explained.isCorrect }),
  };

  return { state: nextState, record };
}

/** Advances a practice session's state. */
export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "deal": {
      // A fresh hand can't be dealt into a run that's already over; the UI
      // must restart first.
      if (!canDeal(state)) return state;
      return { ...state, scenario: event.scenario, holeCard: event.holeCard, feedback: null };
    }

    case "decide":
      return applyDecision(state, event).state;

    case "restart": {
      const run = runReducer(state.run, { type: "restart" });
      return {
        ...state,
        run: event.bestScore === undefined ? run : { ...run, bestScore: Math.max(run.bestScore, event.bestScore) },
        scenario: event.scenario,
        holeCard: event.holeCard,
        feedback: null,
      };
    }
  }
}
