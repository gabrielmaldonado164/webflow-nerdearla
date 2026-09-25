/**
 * Pure summary math for a finished (or in-progress) run: this run's
 * accuracy, and whether its final score beat the best score it started
 * with. Kept separate from the screen so this logic is unit-testable.
 *
 * The session's `decisions` array accumulates across restarts (it's the
 * whole session's history), while `RunState.decisions` counts only the
 * current run. Since every accepted decision appends exactly one entry to
 * `decisions` and increments `run.decisions` together (see
 * `usePracticeSession`/`sessionReducer`), the last `runDecisionCount`
 * entries of `decisions` are exactly this run's decisions.
 */

export function computeRunAccuracy(
  decisions: readonly { isCorrect: boolean }[],
  runDecisionCount: number,
): number | null {
  if (runDecisionCount <= 0) return null;
  const count = Math.min(runDecisionCount, decisions.length);
  const runDecisions = decisions.slice(decisions.length - count);
  const correct = runDecisions.filter((decision) => decision.isCorrect).length;
  return Math.round((correct / runDecisions.length) * 100);
}

/** True when `finalScore` beats the best score the run started with. */
export function isNewBestScore(enteringBestScore: number, finalScore: number): boolean {
  return finalScore > enteringBestScore;
}
