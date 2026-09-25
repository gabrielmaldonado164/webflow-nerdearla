import type { DecisionRecord } from "@/features/practice/types";

export interface ArcadeProgress {
  xp: number;
  level: number;
  levelXp: number;
  xpToNextLevel: number;
}

/** Session XP awarded for a correct decision. */
export const CORRECT_DECISION_XP = 25;
/** Session XP awarded for an incorrect decision. */
export const INCORRECT_DECISION_XP = 5;

/** Session-only rewards. These never alter blackjack strategy or persisted scores. */
export function getArcadeProgress(
  decisions: readonly Pick<DecisionRecord, "isCorrect">[],
): ArcadeProgress {
  const xp = decisions.reduce(
    (total, decision) =>
      total + (decision.isCorrect ? CORRECT_DECISION_XP : INCORRECT_DECISION_XP),
    0,
  );
  const levelXp = xp % 100;
  return {
    xp,
    level: Math.floor(xp / 100) + 1,
    levelXp,
    xpToNextLevel: 100 - levelXp,
  };
}
