/**
 * The pure "decide and emit" step `usePracticeSession`'s `choose` needs:
 * applies a `decide` event to `state` and returns both the resulting state
 * and the `DecisionRecord` to hand to `onDecision` — or `record: null` when
 * the decision was ignored (feedback already pending, the run is over, or
 * the action isn't in `scenario.availableActions`; see `canDecide` in
 * `sessionReducer.ts`).
 *
 * A thin wrapper over `applyDecision`, kept as its own function so the call
 * site reads as "decide and emit" at a glance, and so this exact contract —
 * exactly one record out, equal to what actually landed in
 * `nextState.decisions`, for an accepted decision, and none for an ignored
 * one — is directly testable, without React or the RNG-gating in
 * `sessionRng.ts`.
 */

import { applyDecision, type SessionEvent, type SessionState } from "./sessionReducer";
import type { DecisionRecord } from "./types";

export interface DecideAndEmitResult {
  nextState: SessionState;
  record: DecisionRecord | null;
}

export function decideAndEmit(
  state: SessionState,
  event: Extract<SessionEvent, { type: "decide" }>,
): DecideAndEmitResult {
  const { state: nextState, record } = applyDecision(state, event);
  return { nextState, record };
}
