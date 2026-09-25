import { describe, expect, it } from "vitest";

import type { Achievement } from "@/player/achievements";
import type { PlayerStats } from "@/player/playerStats";

import { parseStatsResponse } from "./skillMapStatsResponse";

function emptyCategoryStats() {
  return {
    hard: { category: "hard", attempts: 0, correct: 0, accuracy: null },
    soft: { category: "soft", attempts: 0, correct: 0, accuracy: null },
    pair: { category: "pair", attempts: 0, correct: 0, accuracy: null },
  } as const;
}

const VALID_STATS: PlayerStats = {
  totalDecisions: 12,
  correctDecisions: 9,
  accuracy: 75,
  currentStreak: 2,
  bestStreak: 5,
  categoryStats: {
    hard: { category: "hard", attempts: 6, correct: 5, accuracy: 83 },
    soft: { category: "soft", attempts: 4, correct: 2, accuracy: 50 },
    pair: { category: "pair", attempts: 2, correct: 2, accuracy: 100 },
  },
  strongestCategory: "pair",
  weakestCategory: "soft",
};

const VALID_ACHIEVEMENT: Achievement = {
  id: "first_perfect_decision",
  title: "First Perfect Move",
  description: "Make your first optimal decision.",
  earned: true,
  progress: 100,
};

describe("parseStatsResponse", () => {
  it("accepts a well-formed { stats, achievements } body", () => {
    const result = parseStatsResponse({ stats: VALID_STATS, achievements: [VALID_ACHIEVEMENT] });
    expect(result).toEqual({ stats: VALID_STATS, achievements: [VALID_ACHIEVEMENT] });
  });

  it("accepts an empty (brand-new player) body with null accuracies and no achievements earned yet", () => {
    const emptyStats: PlayerStats = {
      totalDecisions: 0,
      correctDecisions: 0,
      accuracy: null,
      currentStreak: 0,
      bestStreak: 0,
      categoryStats: emptyCategoryStats(),
      strongestCategory: null,
      weakestCategory: null,
    };
    const result = parseStatsResponse({ stats: emptyStats, achievements: [] });
    expect(result).toEqual({ stats: emptyStats, achievements: [] });
  });

  it("rejects null", () => {
    expect(parseStatsResponse(null)).toBeNull();
  });

  it("rejects a non-object", () => {
    expect(parseStatsResponse("not an object")).toBeNull();
    expect(parseStatsResponse(42)).toBeNull();
  });

  it("rejects an error-shaped body (e.g. the handler's 500 response)", () => {
    expect(parseStatsResponse({ error: "failed to load stats" })).toBeNull();
  });

  it("rejects a body missing achievements", () => {
    expect(parseStatsResponse({ stats: VALID_STATS })).toBeNull();
  });

  it("rejects a body whose stats.categoryStats is missing a category", () => {
    const incompleteCategoryStats = {
      hard: VALID_STATS.categoryStats.hard,
      soft: VALID_STATS.categoryStats.soft,
    };
    const body = { stats: { ...VALID_STATS, categoryStats: incompleteCategoryStats }, achievements: [] };
    expect(parseStatsResponse(body)).toBeNull();
  });

  it("rejects a body whose stats.weakestCategory is an invalid category string", () => {
    const body = { stats: { ...VALID_STATS, weakestCategory: "blackjack" }, achievements: [] };
    expect(parseStatsResponse(body)).toBeNull();
  });

  it("rejects a body whose achievements array contains a malformed entry", () => {
    const body = { stats: VALID_STATS, achievements: [{ id: "x" }] };
    expect(parseStatsResponse(body)).toBeNull();
  });

  it("rejects a body whose stats.accuracy is a string instead of number|null", () => {
    const body = { stats: { ...VALID_STATS, accuracy: "75%" }, achievements: [] };
    expect(parseStatsResponse(body)).toBeNull();
  });
});
