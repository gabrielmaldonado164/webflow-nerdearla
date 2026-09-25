/**
 * Pure "HAND NN" numbering for the table plaque, scoped to the *current
 * run* (not the whole session's history): it counts hands in this run only
 * and resets to 1 right after a restart, since `RunState.decisions` itself
 * resets to 0 on restart (see `src/training/run.ts`).
 *
 * A hand is "in progress" (no `feedback` yet) or "just decided" (feedback
 * pending for that hand, until `next()` deals the following one) —
 * `runDecisions` and `hasFeedback` change together in the same dispatch
 * (see `applyDecision` in `sessionReducer.ts`), so the plaque holds the
 * same number for a hand's whole lifetime, from deal to `next()`.
 */
export function currentHandNumber(runDecisions: number, hasFeedback: boolean): number {
  return runDecisions + (hasFeedback ? 0 : 1);
}
