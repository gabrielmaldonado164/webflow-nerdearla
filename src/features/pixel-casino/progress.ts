import type { DecisionRecord } from "@/features/practice/types";

export interface ArcadeProgress {
  xp: number;
  level: number;
  levelXp: number;
  xpToNextLevel: number;
}

/** Session-only rewards. These never alter blackjack strategy or persisted scores. */
export function getArcadeProgress(
  decisions: readonly Pick<DecisionRecord, "isCorrect">[],
): ArcadeProgress {
  const xp = decisions.reduce(
    (total, decision) => total + (decision.isCorrect ? 25 : 5),
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
