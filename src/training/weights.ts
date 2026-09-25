/**
 * Pure adaptive scenario weighting (Phase 3 T3): turns a player's
 * persisted per-category stats into `CategoryWeights` for the engine's
 * `generateScenario` (`src/blackjack/scenario.ts`). No side effects,
 * never touches the RNG — the caller (`usePracticeSession`) still owns
 * randomness and just forwards the returned weights.
 *
 * `weight = base + weaknessFactor`: every category starts at
 * `CATEGORY_WEIGHT_BASE` and gains a bounded additive factor that grows
 * with its error rate. A category without a reliable sample yet
 * (below `MIN_ATTEMPTS_FOR_RANKING`, the same bar `playerStats.ts` uses
 * for naming a strongest/weakest category) gets a mild flat exploration
 * boost instead of a weakness factor, since its accuracy isn't trustworthy
 * yet — the goal there is "see more of this category", not "hammer it".
 *
 * A weight is never allowed to reach (let alone go below) zero: the
 * engine's own `pickWeightedCategory`/`resolveWeight`
 * (src/blackjack/scenario.ts) reject a negative weight and reject every
 * weight being zero, and this module's whole point is to bias, not
 * eliminate, a category.
 */

import type { CategoryWeights } from "@/blackjack";
import type { PlayerCategoryStats, PlayerStats } from "@/player/playerStats";
import { CATEGORIES, MIN_ATTEMPTS_FOR_RANKING } from "@/player/playerStats";

/** Every category's floor weight, reliable-sample or not. */
export const CATEGORY_WEIGHT_BASE = 1;

/**
 * Upper bound on the additive weakness factor: caps a reliable-sample
 * category with a 100% error rate at `CATEGORY_WEIGHT_BASE +
 * MAX_WEAKNESS_FACTOR`, so one very-weak category can never crowd the
 * others out to a vanishing share of the total.
 */
export const MAX_WEAKNESS_FACTOR = 3;

/**
 * Flat additive boost for a category that hasn't reached a reliable
 * sample yet, so it still gets generated somewhat more than an
 * already-strong category, without reacting to noisy early accuracy.
 */
export const LOW_SAMPLE_EXPLORATION_BOOST = 0.5;

/**
 * Multiplier applied to the weakest category's weight when
 * `focusWeakness` is requested. Applied only to that one category —
 * every other category keeps its own computed weight untouched, so it
 * "never zeroes others" by construction (every weight is already
 * `>= CATEGORY_WEIGHT_BASE`).
 */
export const FOCUS_WEAKNESS_MULTIPLIER = 4;

export interface WeightsFromStatsOptions {
  /**
   * When true, strongly bias generation toward `stats.weakestCategory`
   * (a no-op when there isn't one yet — too little data to name one).
   */
  focusWeakness?: boolean;
}

function categoryWeight(bucket: PlayerCategoryStats): number {
  if (bucket.attempts < MIN_ATTEMPTS_FOR_RANKING) {
    return CATEGORY_WEIGHT_BASE + LOW_SAMPLE_EXPLORATION_BOOST;
  }
  const errorRate = (bucket.attempts - bucket.correct) / bucket.attempts;
  return CATEGORY_WEIGHT_BASE + errorRate * MAX_WEAKNESS_FACTOR;
}

/**
 * Computes generation weights for every engine category from a player's
 * persisted stats. Always returns a weight for all three categories
 * (`Required<CategoryWeights>`), each a finite number `>=
 * CATEGORY_WEIGHT_BASE`, satisfying the engine's own weight validation
 * unconditionally.
 */
export function weightsFromStats(
  stats: PlayerStats,
  options: WeightsFromStatsOptions = {},
): Required<CategoryWeights> {
  const weights = Object.fromEntries(
    CATEGORIES.map((category) => [category, categoryWeight(stats.categoryStats[category])]),
  ) as Required<CategoryWeights>;

  if (options.focusWeakness && stats.weakestCategory) {
    weights[stats.weakestCategory] *= FOCUS_WEAKNESS_MULTIPLIER;
  }

  return weights;
}
