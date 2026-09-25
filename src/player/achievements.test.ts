import { describe, expect, it } from "vitest";

import type { Action, Card, ScenarioCategory } from "@/blackjack";
import type { DecisionRow } from "@/player/recordDecision";

import { deriveAchievements } from "./achievements";

let idCounter = 0;

function card(rank: Card["rank"], suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

function row(overrides: Partial<DecisionRow> = {}): DecisionRow {
  idCounter += 1;
  return {
    id: `decision-${idCounter}`,
    playerId: "player-1",
    playerCards: [card("10"), card("6")],
    dealerUpcard: card("9"),
    availableActions: ["hit", "stand", "double"],
    userAction: "hit",
    optimalAction: "hit",
    isCorrect: true,
    category: "hard",
    createdAt: `2026-09-23T12:00:0${idCounter}.000Z`,
    ...overrides,
  };
}

/** A generic correct/incorrect decision in `category`, with no special 12-vs-2 shape. */
function decision(category: ScenarioCategory, isCorrect: boolean): DecisionRow {
  return row({
    category,
    userAction: isCorrect ? "hit" : "stand",
    optimalAction: "hit",
    isCorrect,
  });
}

/** A hard 12 vs. dealer's 2, where the engine's stored optimalAction is "hit". */
function hard12vs2(userAction: Action): DecisionRow {
  return row({
    playerCards: [card("10"), card("2")],
    dealerUpcard: card("2"),
    category: "hard",
    optimalAction: "hit",
    userAction,
    isCorrect: userAction === "hit",
  });
}

function findAchievement(achievements: ReturnType<typeof deriveAchievements>, id: string) {
  const found = achievements.find((a) => a.id === id);
  if (!found) throw new Error(`achievement "${id}" not found in catalog`);
  return found;
}

describe("deriveAchievements", () => {
  it("returns the full fixed catalog, unearned, for an empty history", () => {
    const achievements = deriveAchievements([]);

    expect(achievements).toHaveLength(6);
    expect(achievements.map((a) => a.id)).toEqual([
      "first_perfect_decision",
      "ten_correct_streak",
      "ten_soft_streak",
      "never_stood_12_vs_2",
      "every_category_attempted",
      "hundred_decisions",
    ]);
    for (const a of achievements) {
      expect(a.earned).toBe(false);
      expect(typeof a.title).toBe("string");
      expect(a.title.length).toBeGreaterThan(0);
      expect(typeof a.description).toBe("string");
      expect(a.description.length).toBeGreaterThan(0);
    }
  });

  describe("first_perfect_decision", () => {
    it("is not earned when every decision is a miss", () => {
      const achievements = deriveAchievements([decision("hard", false), decision("soft", false)]);
      const a = findAchievement(achievements, "first_perfect_decision");
      expect(a.earned).toBe(false);
      expect(a.progress).toBe(0);
    });

    it("is earned as soon as one decision is correct", () => {
      const achievements = deriveAchievements([decision("hard", false), decision("hard", true)]);
      const a = findAchievement(achievements, "first_perfect_decision");
      expect(a.earned).toBe(true);
      expect(a.progress).toBe(100);
    });
  });

  describe("ten_correct_streak", () => {
    it("is not earned at a 9-decision streak, with progress at 90", () => {
      const decisions = Array.from({ length: 9 }, () => decision("hard", true));
      const a = findAchievement(deriveAchievements(decisions), "ten_correct_streak");
      expect(a.earned).toBe(false);
      expect(a.progress).toBe(90);
    });

    it("is earned at exactly a 10-decision streak", () => {
      const decisions = Array.from({ length: 10 }, () => decision("hard", true));
      const a = findAchievement(deriveAchievements(decisions), "ten_correct_streak");
      expect(a.earned).toBe(true);
      expect(a.progress).toBe(100);
    });

    it("uses the best streak ever reached, not just the trailing one", () => {
      const decisions = [
        ...Array.from({ length: 10 }, () => decision("hard", true)),
        decision("hard", false),
        decision("soft", true),
      ];
      const a = findAchievement(deriveAchievements(decisions), "ten_correct_streak");
      expect(a.earned).toBe(true);
    });
  });

  describe("ten_soft_streak", () => {
    it("counts only consecutive correct soft-hand decisions, ignoring interleaved other categories", () => {
      const decisions = [
        ...Array.from({ length: 5 }, () => decision("soft", true)),
        decision("hard", false), // interleaved miss in a different category
        ...Array.from({ length: 5 }, () => decision("soft", true)),
      ];
      const a = findAchievement(deriveAchievements(decisions), "ten_soft_streak");
      expect(a.earned).toBe(true);
    });

    it("is not earned when the soft streak is broken by a soft-category miss", () => {
      const decisions = [
        ...Array.from({ length: 5 }, () => decision("soft", true)),
        decision("soft", false),
        ...Array.from({ length: 4 }, () => decision("soft", true)),
      ];
      const a = findAchievement(deriveAchievements(decisions), "ten_soft_streak");
      expect(a.earned).toBe(false);
      // Best streak is max(5, 4) = 5 once the interior soft miss resets it.
      expect(a.progress).toBe(50);
    });
  });

  describe("never_stood_12_vs_2", () => {
    it("is not earned below the 5-hand sample even with zero violations", () => {
      const decisions = Array.from({ length: 4 }, () => hard12vs2("hit"));
      const a = findAchievement(deriveAchievements(decisions), "never_stood_12_vs_2");
      expect(a.earned).toBe(false);
      expect(a.progress).toBe(80);
    });

    it("is earned at exactly 5 qualifying hands with zero stand violations", () => {
      const decisions = Array.from({ length: 5 }, () => hard12vs2("hit"));
      const a = findAchievement(deriveAchievements(decisions), "never_stood_12_vs_2");
      expect(a.earned).toBe(true);
      expect(a.progress).toBe(100);
    });

    it("is never earned once a single stand violation occurs, regardless of sample size", () => {
      const decisions = [...Array.from({ length: 6 }, () => hard12vs2("hit")), hard12vs2("stand")];
      const a = findAchievement(deriveAchievements(decisions), "never_stood_12_vs_2");
      expect(a.earned).toBe(false);
      expect(a.progress).toBe(0);
    });

    it("ignores hands that are not a hard 12 vs. dealer's 2", () => {
      const decisions = [
        ...Array.from({ length: 5 }, () => hard12vs2("hit")),
        decision("hard", true), // unrelated hard hand
        row({
          playerCards: [card("10"), card("2")],
          dealerUpcard: card("3"), // 12 vs 3, not vs 2
          category: "hard",
          optimalAction: "stand",
          userAction: "stand",
          isCorrect: true,
        }),
      ];
      const a = findAchievement(deriveAchievements(decisions), "never_stood_12_vs_2");
      expect(a.earned).toBe(true);
    });
  });

  describe("every_category_attempted", () => {
    it("is not earned with only two of three categories, with progress rounded to 67", () => {
      const decisions = [decision("hard", true), decision("soft", true)];
      const a = findAchievement(deriveAchievements(decisions), "every_category_attempted");
      expect(a.earned).toBe(false);
      expect(a.progress).toBe(67);
    });

    it("is earned once hard, soft, and pair have each been attempted", () => {
      const decisions = [decision("hard", true), decision("soft", true), decision("pair", true)];
      const a = findAchievement(deriveAchievements(decisions), "every_category_attempted");
      expect(a.earned).toBe(true);
      expect(a.progress).toBe(100);
    });
  });

  describe("hundred_decisions", () => {
    it("is not earned at 99 decisions, with progress at 99", () => {
      const decisions = Array.from({ length: 99 }, () => decision("hard", true));
      const a = findAchievement(deriveAchievements(decisions), "hundred_decisions");
      expect(a.earned).toBe(false);
      expect(a.progress).toBe(99);
    });

    it("is earned at exactly 100 decisions", () => {
      const decisions = Array.from({ length: 100 }, () => decision("hard", true));
      const a = findAchievement(deriveAchievements(decisions), "hundred_decisions");
      expect(a.earned).toBe(true);
      expect(a.progress).toBe(100);
    });

    it("caps progress at 100 beyond the 100th decision", () => {
      const decisions = Array.from({ length: 150 }, () => decision("hard", true));
      const a = findAchievement(deriveAchievements(decisions), "hundred_decisions");
      expect(a.earned).toBe(true);
      expect(a.progress).toBe(100);
    });
  });
});
