import { describe, expect, it } from "vitest";

import type { ScenarioCategory } from "@/blackjack";

import type { PlayerStatsDecision } from "./playerStats";
import { computePlayerStats, MIN_ATTEMPTS_FOR_RANKING } from "./playerStats";

function d(category: ScenarioCategory, isCorrect: boolean): PlayerStatsDecision {
  return { category, isCorrect };
}

describe("computePlayerStats", () => {
  it("returns all-zero/null stats for an empty history", () => {
    const stats = computePlayerStats([]);

    expect(stats).toEqual({
      totalDecisions: 0,
      correctDecisions: 0,
      accuracy: null,
      currentStreak: 0,
      bestStreak: 0,
      categoryStats: {
        hard: { category: "hard", attempts: 0, correct: 0, accuracy: null },
        soft: { category: "soft", attempts: 0, correct: 0, accuracy: null },
        pair: { category: "pair", attempts: 0, correct: 0, accuracy: null },
      },
      strongestCategory: null,
      weakestCategory: null,
    });
  });

  it("computes totals and overall accuracy", () => {
    const stats = computePlayerStats([
      d("hard", true),
      d("hard", false),
      d("soft", true),
      d("pair", true),
    ]);

    expect(stats.totalDecisions).toBe(4);
    expect(stats.correctDecisions).toBe(3);
    expect(stats.accuracy).toBe(75);
  });

  it("tracks per-category attempts, correct, and accuracy", () => {
    const stats = computePlayerStats([
      d("hard", true),
      d("hard", true),
      d("hard", false),
      d("soft", false),
    ]);

    expect(stats.categoryStats.hard).toEqual({
      category: "hard",
      attempts: 3,
      correct: 2,
      accuracy: 67,
    });
    expect(stats.categoryStats.soft).toEqual({
      category: "soft",
      attempts: 1,
      correct: 0,
      accuracy: 0,
    });
    expect(stats.categoryStats.pair).toEqual({
      category: "pair",
      attempts: 0,
      correct: 0,
      accuracy: null,
    });
  });

  it("computes current streak as the trailing run of correct decisions", () => {
    const stats = computePlayerStats([
      d("hard", true),
      d("hard", false),
      d("soft", true),
      d("soft", true),
      d("pair", true),
    ]);

    expect(stats.currentStreak).toBe(3);
  });

  it("resets current streak to zero on the most recent miss", () => {
    const stats = computePlayerStats([d("hard", true), d("hard", true), d("hard", false)]);

    expect(stats.currentStreak).toBe(0);
  });

  it("tracks best streak across the whole history, not just the trailing run", () => {
    const stats = computePlayerStats([
      d("hard", true),
      d("hard", true),
      d("hard", true),
      d("hard", true), // best streak of 4 here
      d("hard", false),
      d("soft", true),
      d("soft", true), // trailing/current streak of 2
    ]);

    expect(stats.bestStreak).toBe(4);
    expect(stats.currentStreak).toBe(2);
  });

  it("does not report a strongest/weakest category below the minimum sample", () => {
    const decisions: PlayerStatsDecision[] = [];
    for (let i = 0; i < MIN_ATTEMPTS_FOR_RANKING - 1; i++) {
      decisions.push(d("hard", true));
    }
    for (let i = 0; i < MIN_ATTEMPTS_FOR_RANKING - 1; i++) {
      decisions.push(d("soft", false));
    }

    const stats = computePlayerStats(decisions);

    expect(stats.strongestCategory).toBeNull();
    expect(stats.weakestCategory).toBeNull();
  });

  it("reports strongest/weakest once a category reaches exactly the minimum sample", () => {
    const decisions: PlayerStatsDecision[] = [];
    for (let i = 0; i < MIN_ATTEMPTS_FOR_RANKING; i++) {
      decisions.push(d("hard", true)); // 100% accuracy, exactly at the bar
    }
    for (let i = 0; i < MIN_ATTEMPTS_FOR_RANKING; i++) {
      decisions.push(d("soft", i === 0)); // 1/5 = 20% accuracy, exactly at the bar
    }

    const stats = computePlayerStats(decisions);

    expect(stats.strongestCategory).toBe("hard");
    expect(stats.weakestCategory).toBe("soft");
  });

  it("never reports a perfect (zero-miss) category as the weakest spot", () => {
    const decisions: PlayerStatsDecision[] = [];
    for (let i = 0; i < MIN_ATTEMPTS_FOR_RANKING; i++) {
      decisions.push(d("hard", true)); // perfect, well above the sample bar
    }
    for (let i = 0; i < MIN_ATTEMPTS_FOR_RANKING; i++) {
      decisions.push(d("soft", i < 4)); // 4/5 = 80%, still has a miss
    }

    const stats = computePlayerStats(decisions);

    // hard (100%) is strictly better than soft (80%), so hard is strongest.
    expect(stats.strongestCategory).toBe("hard");
    // hard is perfect (zero misses) so it's ineligible to be weakest, even
    // though nothing else outranks it on raw accuracy.
    expect(stats.weakestCategory).toBe("soft");
  });

  it("breaks strongest/weakest accuracy ties using fixed category order (hard, soft, pair)", () => {
    const decisions: PlayerStatsDecision[] = [];
    for (let i = 0; i < MIN_ATTEMPTS_FOR_RANKING; i++) {
      decisions.push(d("pair", i < 4)); // 80%
    }
    for (let i = 0; i < MIN_ATTEMPTS_FOR_RANKING; i++) {
      decisions.push(d("hard", i < 4)); // 80%, tied with pair
    }

    const stats = computePlayerStats(decisions);

    expect(stats.strongestCategory).toBe("hard");
    expect(stats.weakestCategory).toBe("hard");
  });
});
