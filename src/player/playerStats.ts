/**
 * Pure, persisted-history statistics derived from a player's full
 * `decisions` row history (Phase 3 T1). No side effects: given the same
 * decisions in the same order, this always returns the same stats.
 *
 * `decisions` must already be ordered ascending by time (oldest first) —
 * the same order `listPlayerDecisions` (src/db/decisionsRepository.ts)
 * returns them in — since current/best streak depend on sequence.
 *
 * Deliberately parallel to, but not sharing code with,
 * `src/features/practice/sessionStats.ts`: that module computes ephemeral,
 * in-browser-session stats from `DecisionRecord`; this one computes
 * cross-session stats from the persisted `DecisionRow`. The two input
 * shapes only share `category`/`isCorrect`, and the modules serve
 * different bounded contexts (session vs. player), so a shared
 * abstraction would buy little and couple two independent call sites.
 */

import type { ScenarioCategory } from "@/blackjack";

import type { DecisionRow } from "./recordDecision";

export interface PlayerCategoryStats {
  category: ScenarioCategory;
  attempts: number;
  correct: number;
  /** Percentage 0-100, or `null` when there are no attempts yet. */
  accuracy: number | null;
}

export interface PlayerStats {
  totalDecisions: number;
  correctDecisions: number;
  /** Percentage 0-100, or `null` when no decisions have been recorded yet. */
  accuracy: number | null;
  currentStreak: number;
  bestStreak: number;
  categoryStats: Record<ScenarioCategory, PlayerCategoryStats>;
  /** The category with the highest accuracy among ranking-eligible categories. */
  strongestCategory: ScenarioCategory | null;
  /** The category with the lowest accuracy among ranking-eligible categories. */
  weakestCategory: ScenarioCategory | null;
}

/** Minimal shape `computePlayerStats` actually needs from a `DecisionRow`. */
export type PlayerStatsDecision = Pick<DecisionRow, "category" | "isCorrect">;

/**
 * Fixed order used for iteration and as the tie-break for
 * strongest/weakest. Exported for reuse by achievements
 * (`src/player/achievements.ts`, Phase 3 T2), which needs the same
 * category set to check "every category attempted".
 */
export const CATEGORIES: readonly ScenarioCategory[] = ["hard", "soft", "pair"];

/**
 * Minimum attempts a category needs before it's eligible to be reported as
 * the strongest or weakest spot. Below this, a short streak of luck (or bad
 * luck) is noise, not signal. Set higher than the in-session
 * `MIN_ATTEMPTS_FOR_WEAKEST` (3) in `sessionStats.ts` on purpose: a
 * persisted skill map is read less often, drives real practice weighting
 * (Phase 3 T3), and has a whole play history to draw from, so it can
 * afford to wait for a more confident sample before naming a category.
 */
export const MIN_ATTEMPTS_FOR_RANKING = 5;

function emptyCategoryStats(category: ScenarioCategory): PlayerCategoryStats {
  return { category, attempts: 0, correct: 0, accuracy: null };
}

function toPercentage(correct: number, attempts: number): number | null {
  if (attempts === 0) return null;
  return Math.round((correct / attempts) * 100);
}

export function computePlayerStats(
  decisions: readonly PlayerStatsDecision[],
): PlayerStats {
  const categoryStats = Object.fromEntries(
    CATEGORIES.map((category) => [category, emptyCategoryStats(category)]),
  ) as Record<ScenarioCategory, PlayerCategoryStats>;

  let correctDecisions = 0;
  let currentStreak = 0;
  let bestStreak = 0;

  for (const decision of decisions) {
    const bucket = categoryStats[decision.category];
    bucket.attempts += 1;
    if (decision.isCorrect) {
      bucket.correct += 1;
      correctDecisions += 1;
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  for (const category of CATEGORIES) {
    const bucket = categoryStats[category];
    bucket.accuracy = toPercentage(bucket.correct, bucket.attempts);
  }

  let strongestCategory: ScenarioCategory | null = null;
  let strongestAccuracy = -Infinity;
  let weakestCategory: ScenarioCategory | null = null;
  let weakestAccuracy = Infinity;

  for (const category of CATEGORIES) {
    const { accuracy, attempts, correct } = categoryStats[category];
    if (accuracy === null || attempts < MIN_ATTEMPTS_FOR_RANKING) continue;

    if (accuracy > strongestAccuracy) {
      strongestAccuracy = accuracy;
      strongestCategory = category;
    }

    // A category with zero misses can never be anyone's weakest spot.
    const misses = attempts - correct;
    if (misses > 0 && accuracy < weakestAccuracy) {
      weakestAccuracy = accuracy;
      weakestCategory = category;
    }
  }

  return {
    totalDecisions: decisions.length,
    correctDecisions,
    accuracy: toPercentage(correctDecisions, decisions.length),
    currentStreak,
    bestStreak,
    categoryStats,
    strongestCategory,
    weakestCategory,
  };
}
