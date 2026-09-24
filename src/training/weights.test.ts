import { describe, expect, it } from "vitest";

import type { PlayerCategoryStats, PlayerStats } from "@/player/playerStats";
import { MIN_ATTEMPTS_FOR_RANKING } from "@/player/playerStats";

import { weightsFromStats } from "./weights";

function categoryStats(
  category: PlayerCategoryStats["category"],
  attempts: number,
  correct: number,
): PlayerCategoryStats {
  return {
    category,
    attempts,
    correct,
    accuracy: attempts === 0 ? null : Math.round((correct / attempts) * 100),
  };
}

function stats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    totalDecisions: 0,
    correctDecisions: 0,
    accuracy: null,
    currentStreak: 0,
    bestStreak: 0,
    categoryStats: {
      hard: categoryStats("hard", 0, 0),
      soft: categoryStats("soft", 0, 0),
      pair: categoryStats("pair", 0, 0),
    },
    strongestCategory: null,
    weakestCategory: null,
    ...overrides,
  };
}

describe("weightsFromStats", () => {
  it("gives every category an equal, low exploration weight for a brand-new player", () => {
    const weights = weightsFromStats(stats());

    expect(weights.hard).toBe(weights.soft);
    expect(weights.soft).toBe(weights.pair);
    expect(weights.hard).toBeGreaterThan(1);
  });

  it("gives a below-sample category the same mild exploration boost regardless of its (unreliable) accuracy", () => {
    const belowSample = stats({
      categoryStats: {
        hard: categoryStats("hard", MIN_ATTEMPTS_FOR_RANKING - 1, 0), // 0% but tiny sample
        soft: categoryStats("soft", MIN_ATTEMPTS_FOR_RANKING - 1, MIN_ATTEMPTS_FOR_RANKING - 1), // 100% but tiny sample
        pair: categoryStats("pair", 0, 0),
      },
    });

    const weights = weightsFromStats(belowSample);

    expect(weights.hard).toBe(weights.soft);
  });

  it("gives a reliable-sample, high-error category a strictly higher weight than a reliable, low-error one", () => {
    const s = stats({
      categoryStats: {
        hard: categoryStats("hard", 20, 4), // 80% error rate, reliable sample
        soft: categoryStats("soft", 20, 18), // 10% error rate, reliable sample
        pair: categoryStats("pair", 20, 20), // 0% error rate, reliable sample
      },
    });

    const weights = weightsFromStats(s);

    expect(weights.hard).toBeGreaterThan(weights.soft);
    expect(weights.soft).toBeGreaterThan(weights.pair);
  });

  it("gives a perfect, reliable-sample category the base weight (no weakness factor)", () => {
    const s = stats({
      categoryStats: {
        hard: categoryStats("hard", 20, 20),
        soft: categoryStats("soft", 0, 0),
        pair: categoryStats("pair", 0, 0),
      },
    });

    const weights = weightsFromStats(s);

    expect(weights.hard).toBe(1);
  });

  it("bounds the weakness factor: a 100% error rate never produces an unbounded weight", () => {
    const s = stats({
      categoryStats: {
        hard: categoryStats("hard", 50, 0), // 100% error rate, large reliable sample
        soft: categoryStats("soft", 20, 20),
        pair: categoryStats("pair", 20, 20),
      },
    });

    const weights = weightsFromStats(s);

    expect(weights.hard).toBeLessThanOrEqual(10);
  });

  it("returns weights that are always finite, non-negative, and satisfy the engine's own weight validation", () => {
    const s = stats({
      categoryStats: {
        hard: categoryStats("hard", 50, 0),
        soft: categoryStats("soft", 0, 0),
        pair: categoryStats("pair", 20, 20),
      },
    });

    const weights = weightsFromStats(s, { focusWeakness: true });

    // Mirrors the engine's own `resolveWeight`/`pickWeightedCategory`
    // validation in src/blackjack/scenario.ts: every weight must be a
    // finite number >= 0, and the total must be > 0.
    let total = 0;
    for (const value of Object.values(weights)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      total += value;
    }
    expect(total).toBeGreaterThan(0);
  });

  describe("focusWeakness", () => {
    it("does not change anything when there is no weakest category yet", () => {
      const s = stats(); // weakestCategory: null

      const withoutFocus = weightsFromStats(s);
      const withFocus = weightsFromStats(s, { focusWeakness: true });

      expect(withFocus).toEqual(withoutFocus);
    });

    it("strongly increases the weakest category's weight relative to the others", () => {
      const s = stats({
        categoryStats: {
          hard: categoryStats("hard", 20, 4), // weakest, 80% error rate
          soft: categoryStats("soft", 20, 18),
          pair: categoryStats("pair", 20, 20),
        },
        weakestCategory: "hard",
      });

      const withoutFocus = weightsFromStats(s);
      const withFocus = weightsFromStats(s, { focusWeakness: true });

      expect(withFocus.hard).toBeGreaterThan(withoutFocus.hard);
      // Other categories are untouched by focusWeakness.
      expect(withFocus.soft).toBe(withoutFocus.soft);
      expect(withFocus.pair).toBe(withoutFocus.pair);
    });

    it("never zeroes the non-weakest categories", () => {
      const s = stats({
        categoryStats: {
          hard: categoryStats("hard", 20, 0), // weakest, 100% error rate
          soft: categoryStats("soft", 20, 20),
          pair: categoryStats("pair", 20, 20),
        },
        weakestCategory: "hard",
      });

      const weights = weightsFromStats(s, { focusWeakness: true });

      expect(weights.soft).toBeGreaterThan(0);
      expect(weights.pair).toBeGreaterThan(0);
    });
  });
});
