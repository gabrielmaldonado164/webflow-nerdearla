import { describe, expect, it } from "vitest";

import type { Card } from "@/blackjack";

import { computeSessionStats } from "./sessionStats";
import type { DecisionRecord } from "./types";

const CARD: Card = { rank: "8", suit: "spades" };
const UPCARD: Card = { rank: "6", suit: "hearts" };

function record(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    playerCards: [CARD, CARD],
    dealerUpcard: UPCARD,
    availableActions: ["hit", "stand"],
    userAction: "hit",
    optimalAction: "hit",
    isCorrect: true,
    category: "hard",
    label: "Hard 16",
    decidedAt: "2026-09-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeSessionStats", () => {
  it("returns a zeroed, gracefully-empty state for no decisions", () => {
    const stats = computeSessionStats([]);

    expect(stats.handsPlayed).toBe(0);
    expect(stats.correctCount).toBe(0);
    expect(stats.accuracy).toBeNull();
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(0);
    expect(stats.weakestCategory).toBeNull();
    expect(stats.categoryStats.hard.attempts).toBe(0);
    expect(stats.categoryStats.hard.accuracy).toBeNull();
  });

  it("tracks accuracy and a perfect streak when every decision is correct", () => {
    const decisions = [record(), record(), record()];

    const stats = computeSessionStats(decisions);

    expect(stats.handsPlayed).toBe(3);
    expect(stats.correctCount).toBe(3);
    expect(stats.accuracy).toBe(100);
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
  });

  it("resets the current streak on a miss but keeps the best streak", () => {
    const decisions = [
      record({ isCorrect: true }),
      record({ isCorrect: true }),
      record({ isCorrect: false }),
      record({ isCorrect: true }),
    ];

    const stats = computeSessionStats(decisions);

    expect(stats.currentStreak).toBe(1);
    expect(stats.bestStreak).toBe(2);
    expect(stats.correctCount).toBe(3);
    expect(stats.accuracy).toBe(75);
  });

  it("breaks down accuracy per category and finds the weakest one", () => {
    const decisions = [
      record({ category: "hard", isCorrect: true }),
      record({ category: "hard", isCorrect: true }),
      record({ category: "soft", isCorrect: false }),
      record({ category: "pair", isCorrect: true }),
      record({ category: "pair", isCorrect: false }),
    ];

    const stats = computeSessionStats(decisions);

    expect(stats.categoryStats.hard).toEqual({
      category: "hard",
      attempts: 2,
      correct: 2,
      accuracy: 100,
    });
    expect(stats.categoryStats.soft).toEqual({
      category: "soft",
      attempts: 1,
      correct: 0,
      accuracy: 0,
    });
    expect(stats.categoryStats.pair).toEqual({
      category: "pair",
      attempts: 2,
      correct: 1,
      accuracy: 50,
    });
    // No category has reached the 3-decision minimum yet, so no weakest
    // category is reported despite "soft" having the lowest accuracy.
    expect(stats.weakestCategory).toBeNull();
  });

  it("ignores categories with no attempts when picking the weakest one", () => {
    const decisions = [record({ category: "hard", isCorrect: true })];

    const stats = computeSessionStats(decisions);

    expect(stats.weakestCategory).toBeNull();
  });

  it("does not report a weakest category before it has at least 3 decisions", () => {
    const decisions = [
      record({ category: "hard", isCorrect: false }),
      record({ category: "hard", isCorrect: false }),
    ];

    const stats = computeSessionStats(decisions);

    expect(stats.weakestCategory).toBeNull();
  });

  it("does not report a weakest category without at least 1 miss", () => {
    const decisions = [
      record({ category: "hard", isCorrect: true }),
      record({ category: "hard", isCorrect: true }),
      record({ category: "hard", isCorrect: true }),
      record({ category: "soft", isCorrect: true }),
      record({ category: "soft", isCorrect: true }),
      record({ category: "soft", isCorrect: true }),
    ];

    const stats = computeSessionStats(decisions);

    expect(stats.weakestCategory).toBeNull();
  });

  it("reports a weakest category once it has 3+ decisions and at least 1 miss", () => {
    const decisions = [
      record({ category: "hard", isCorrect: true }),
      record({ category: "hard", isCorrect: true }),
      record({ category: "hard", isCorrect: false }),
    ];

    const stats = computeSessionStats(decisions);

    expect(stats.weakestCategory).toBe("hard");
  });

  it("skips a category below the decision threshold even if another qualifies", () => {
    const decisions = [
      // "soft" has 0% accuracy but only 1 attempt: not eligible yet.
      record({ category: "soft", isCorrect: false }),
      record({ category: "hard", isCorrect: true }),
      record({ category: "hard", isCorrect: true }),
      record({ category: "hard", isCorrect: false }),
    ];

    const stats = computeSessionStats(decisions);

    expect(stats.weakestCategory).toBe("hard");
  });

  it("breaks a weakest-category accuracy tie by category order (hard, soft, pair)", () => {
    const decisions = [
      record({ category: "pair", isCorrect: true }),
      record({ category: "pair", isCorrect: true }),
      record({ category: "pair", isCorrect: false }),
      record({ category: "pair", isCorrect: false }),
      record({ category: "hard", isCorrect: true }),
      record({ category: "hard", isCorrect: true }),
      record({ category: "hard", isCorrect: false }),
      record({ category: "hard", isCorrect: false }),
    ];

    const stats = computeSessionStats(decisions);

    expect(stats.categoryStats.hard.accuracy).toBe(50);
    expect(stats.categoryStats.pair.accuracy).toBe(50);
    expect(stats.weakestCategory).toBe("hard");
  });
});
