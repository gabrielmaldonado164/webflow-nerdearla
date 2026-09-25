import { describe, expect, it } from "vitest";

import type { SkillMapViewModel } from "./skillMapViewModel";
import { summarizeForGameOver } from "./skillMapSummary";

function baseViewModel(overrides: Partial<SkillMapViewModel> = {}): SkillMapViewModel {
  return {
    source: "server",
    totalAttempts: 20,
    overallAccuracy: 70,
    currentStreak: 2,
    bestStreak: 5,
    categories: [
      { category: "hard", attempts: 10, accuracy: 80 },
      { category: "soft", attempts: 6, accuracy: 50 },
      { category: "pair", attempts: 4, accuracy: 75 },
    ],
    strongestCategory: "hard",
    weakestCategory: "soft",
    achievements: [],
    ...overrides,
  };
}

describe("summarizeForGameOver", () => {
  it("names the weakest category and its accuracy when one exists", () => {
    const summary = summarizeForGameOver(baseViewModel());
    expect(summary).toContain("Soft hands");
    expect(summary).toContain("50%");
  });

  it("highlights earned badges when there is no weakest category but at least one badge is earned", () => {
    const vm = baseViewModel({
      weakestCategory: null,
      achievements: [
        { id: "first_perfect_decision", title: "First Perfect Move", description: "d", earned: true, progress: 100 },
        { id: "ten_correct_streak", title: "Hot Streak", description: "d", earned: false, progress: 40 },
      ],
    });
    const summary = summarizeForGameOver(vm);
    expect(summary).toContain("1");
    expect(summary.toLowerCase()).toContain("badge");
  });

  it("falls back to an encouraging generic line with no weakest category and no earned badges", () => {
    const summary = summarizeForGameOver(baseViewModel({ weakestCategory: null, achievements: [] }));
    expect(summary).toBeTruthy();
    expect(summary).not.toContain("null");
    expect(summary).not.toContain("undefined");
  });

  it("falls back to a generic line when achievements are unavailable offline and there's no weakest category", () => {
    const summary = summarizeForGameOver(baseViewModel({ weakestCategory: null, achievements: null }));
    expect(summary).toBeTruthy();
    expect(summary).not.toContain("null");
    expect(summary).not.toContain("undefined");
  });

  it("never returns an empty string", () => {
    expect(summarizeForGameOver(baseViewModel({ totalAttempts: 0, weakestCategory: null, achievements: [] })).length).toBeGreaterThan(0);
  });
});
