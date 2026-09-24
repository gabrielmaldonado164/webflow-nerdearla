import { describe, expect, it } from "vitest";

import type { PlayerStats } from "@/player/playerStats";
import { CATEGORY_WEIGHT_BASE, MAX_WEAKNESS_FACTOR } from "@/training/weights";

import { computeToggleWeights } from "./skillMapWeights";

const STATS: PlayerStats = {
  totalDecisions: 15,
  correctDecisions: 9,
  accuracy: 60,
  currentStreak: 0,
  bestStreak: 4,
  categoryStats: {
    hard: { category: "hard", attempts: 5, correct: 5, accuracy: 100 },
    soft: { category: "soft", attempts: 5, correct: 0, accuracy: 0 },
    pair: { category: "pair", attempts: 5, correct: 4, accuracy: 80 },
  },
  strongestCategory: "hard",
  weakestCategory: "soft",
};

describe("computeToggleWeights", () => {
  it("returns undefined (engine default uniform weighting) when there is no server data", () => {
    expect(computeToggleWeights(null, false)).toBeUndefined();
    expect(computeToggleWeights(null, true)).toBeUndefined();
  });

  it("returns adaptive weights without focus when the toggle is off and data exists", () => {
    const weights = computeToggleWeights(STATS, false);
    // The fully-missed soft category should carry the max weakness
    // factor, but not the extra focusWeakness multiplier.
    expect(weights).toEqual({
      hard: CATEGORY_WEIGHT_BASE,
      soft: CATEGORY_WEIGHT_BASE + MAX_WEAKNESS_FACTOR,
      pair: CATEGORY_WEIGHT_BASE + 0.2 * MAX_WEAKNESS_FACTOR,
    });
  });

  it("multiplies only the weakest category's weight when the toggle is on", () => {
    const off = computeToggleWeights(STATS, false)!;
    const on = computeToggleWeights(STATS, true)!;

    expect(on.hard).toBe(off.hard);
    expect(on.pair).toBe(off.pair);
    expect(on.soft).toBeGreaterThan(off.soft!);
  });
});
