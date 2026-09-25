/**
 * Pure, framework-free session statistics derived from the decisions made
 * during a practice session. No persistence, no side effects: given the
 * same decisions, this always returns the same stats.
 */

import type { ScenarioCategory } from "@/blackjack";

import type { DecisionRecord } from "./types";

export interface CategoryStats {
  category: ScenarioCategory;
  attempts: number;
  correct: number;
  /** Percentage 0-100, or `null` when there are no attempts yet. */
  accuracy: number | null;
}

export interface SessionStats {
  handsPlayed: number;
  correctCount: number;
  /** Percentage 0-100, or `null` when no hands have been played yet. */
  accuracy: number | null;
  currentStreak: number;
  bestStreak: number;
  categoryStats: Record<ScenarioCategory, CategoryStats>;
  /** The category with the lowest accuracy among attempted categories. */
  weakestCategory: ScenarioCategory | null;
}

/** Fixed order used for both iteration and weakest-category tie-breaking. */
const CATEGORIES: readonly ScenarioCategory[] = ["hard", "soft", "pair"];

/**
 * A category only becomes eligible to be reported as the "weakest spot"
 * once it has a meaningful sample: enough decisions to not be noise, and at
 * least one miss (a perfect category is never anyone's weakest spot).
 */
const MIN_ATTEMPTS_FOR_WEAKEST = 3;

function emptyCategoryStats(category: ScenarioCategory): CategoryStats {
  return { category, attempts: 0, correct: 0, accuracy: null };
}

function toPercentage(correct: number, attempts: number): number | null {
  if (attempts === 0) return null;
  return Math.round((correct / attempts) * 100);
}

export function computeSessionStats(
  decisions: readonly DecisionRecord[],
): SessionStats {
  const categoryStats = Object.fromEntries(
    CATEGORIES.map((category) => [category, emptyCategoryStats(category)]),
  ) as Record<ScenarioCategory, CategoryStats>;

  let correctCount = 0;
  let currentStreak = 0;
  let bestStreak = 0;

  for (const decision of decisions) {
    const bucket = categoryStats[decision.category];
    bucket.attempts += 1;
    if (decision.isCorrect) {
      bucket.correct += 1;
      correctCount += 1;
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

  let weakestCategory: ScenarioCategory | null = null;
  let weakestAccuracy = Infinity;
  for (const category of CATEGORIES) {
    const { accuracy, attempts, correct } = categoryStats[category];
    if (accuracy === null) continue;
    const misses = attempts - correct;
    if (attempts < MIN_ATTEMPTS_FOR_WEAKEST || misses === 0) continue;
    if (accuracy < weakestAccuracy) {
      weakestAccuracy = accuracy;
      weakestCategory = category;
    }
  }

  return {
    handsPlayed: decisions.length,
    correctCount,
    accuracy: toPercentage(correctCount, decisions.length),
    currentStreak,
    bestStreak,
    categoryStats,
    weakestCategory,
  };
}
