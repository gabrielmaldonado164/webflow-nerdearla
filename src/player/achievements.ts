/**
 * Pure, fixed-catalog achievements derived from a player's full
 * `decisions` row history (Phase 3 T2). No side effects: given the same
 * decisions in the same order, this always returns the same catalog with
 * the same `earned`/`progress` values.
 *
 * Strategy is never re-implemented here (D2, non-negotiable): every
 * badge that depends on "is this move correct" reads the engine-computed
 * `category`/`optimalAction` fields already stored on each `DecisionRow`
 * (written by `recordDecision` via the real engine), or reuses
 * `computePlayerStats`'s streak math directly. The only engine call made
 * here is `handValue`, to find a hand's total — a hand-arithmetic
 * primitive, not a strategy decision.
 */

import type { Card } from "@/blackjack";
import { handValue } from "@/blackjack";

import { CATEGORIES, computePlayerStats } from "./playerStats";
import type { DecisionRow } from "./recordDecision";

export type AchievementId =
  | "first_perfect_decision"
  | "ten_correct_streak"
  | "ten_soft_streak"
  | "never_stood_12_vs_2"
  | "every_category_attempted"
  | "hundred_decisions";

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  earned: boolean;
  /** Percent 0-100 progress toward earning (capped at 100 once earned). */
  progress: number;
}

interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  evaluate: (decisions: readonly DecisionRow[]) => { earned: boolean; progress: number };
}

/** Consecutive-correct target for both the overall and soft-hand streak badges. */
const STREAK_TARGET = 10;

/** Total decisions target for the "Century Club" badge. */
const DECISIONS_TARGET = 100;

/**
 * Minimum sample of qualifying hard-12-vs-2 hands required before "never
 * stood" becomes earnable — mirrors the spirit of
 * `MIN_ATTEMPTS_FOR_RANKING` in `playerStats.ts`: a couple of lucky hands
 * shouldn't award a badge about a habit.
 */
const NEVER_STOOD_SAMPLE = 5;

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function progressToward(count: number, target: number): number {
  return clampProgress((count / target) * 100);
}

/**
 * True when `decision` is a hard, two-or-more-card 12 against a dealer's
 * 2, where the engine's own stored `optimalAction` for that hand was
 * "hit" — the exact scenario the classic "always hit stiff hands"
 * mistake gets wrong. Reads `optimalAction` from the row (engine-decided
 * at record time) rather than assuming basic strategy here.
 */
function isHard12vs2WhereEngineSaysHit(decision: DecisionRow): boolean {
  const cards: readonly Card[] = decision.playerCards;
  return (
    decision.category === "hard" &&
    decision.optimalAction === "hit" &&
    handValue(cards).total === 12 &&
    decision.dealerUpcard.rank === "2"
  );
}

const CATALOG: readonly AchievementDefinition[] = [
  {
    id: "first_perfect_decision",
    title: "First Perfect Move",
    description: "Make your first optimal decision.",
    evaluate(decisions) {
      const earned = decisions.some((d) => d.isCorrect);
      return { earned, progress: earned ? 100 : 0 };
    },
  },
  {
    id: "ten_correct_streak",
    title: "Hot Streak",
    description: `String together ${STREAK_TARGET} correct decisions in a row.`,
    evaluate(decisions) {
      const bestStreak = computePlayerStats(decisions).bestStreak;
      return {
        earned: bestStreak >= STREAK_TARGET,
        progress: progressToward(bestStreak, STREAK_TARGET),
      };
    },
  },
  {
    id: "ten_soft_streak",
    title: "Soft Touch",
    description: `Get ${STREAK_TARGET} soft-hand decisions correct in a row.`,
    evaluate(decisions) {
      const softDecisions = decisions.filter((d) => d.category === "soft");
      const bestSoftStreak = computePlayerStats(softDecisions).bestStreak;
      return {
        earned: bestSoftStreak >= STREAK_TARGET,
        progress: progressToward(bestSoftStreak, STREAK_TARGET),
      };
    },
  },
  {
    id: "never_stood_12_vs_2",
    title: "Never Chicken Out",
    description: `Play a hard 12 vs. the dealer's 2 correctly (hit) at least ${NEVER_STOOD_SAMPLE} times, without ever standing on it.`,
    evaluate(decisions) {
      const qualifying = decisions.filter(isHard12vs2WhereEngineSaysHit);
      const violated = qualifying.some((d) => d.userAction === "stand");
      if (violated) {
        return { earned: false, progress: 0 };
      }
      return {
        earned: qualifying.length >= NEVER_STOOD_SAMPLE,
        progress: progressToward(qualifying.length, NEVER_STOOD_SAMPLE),
      };
    },
  },
  {
    id: "every_category_attempted",
    title: "Well Rounded",
    description: "Face a hard hand, a soft hand, and a pair at least once each.",
    evaluate(decisions) {
      const attempted = new Set(decisions.map((d) => d.category));
      return {
        earned: attempted.size === CATEGORIES.length,
        progress: progressToward(attempted.size, CATEGORIES.length),
      };
    },
  },
  {
    id: "hundred_decisions",
    title: "Century Club",
    description: `Make ${DECISIONS_TARGET} decisions.`,
    evaluate(decisions) {
      return {
        earned: decisions.length >= DECISIONS_TARGET,
        progress: progressToward(decisions.length, DECISIONS_TARGET),
      };
    },
  },
];

/**
 * Evaluates the full, fixed achievement catalog against `decisions`
 * (order does not matter for any current badge, but pass the same
 * ascending-by-time history `computePlayerStats` expects). Always
 * returns every catalog entry, in catalog order, whether earned or not.
 */
export function deriveAchievements(decisions: readonly DecisionRow[]): Achievement[] {
  return CATALOG.map(({ id, title, description, evaluate }) => {
    const { earned, progress } = evaluate(decisions);
    return { id, title, description, earned, progress };
  });
}
