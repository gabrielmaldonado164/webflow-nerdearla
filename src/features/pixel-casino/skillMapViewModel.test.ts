import { describe, expect, it } from "vitest";

import type { Achievement } from "@/player/achievements";
import type { PlayerStats } from "@/player/playerStats";
import type { SessionStats } from "@/features/practice/sessionStats";

import { buildSkillMapViewModel } from "./skillMapViewModel";

const SERVER_STATS: PlayerStats = {
  totalDecisions: 20,
  correctDecisions: 14,
  accuracy: 70,
  currentStreak: 3,
  bestStreak: 6,
  categoryStats: {
    hard: { category: "hard", attempts: 10, correct: 8, accuracy: 80 },
    soft: { category: "soft", attempts: 6, correct: 3, accuracy: 50 },
    pair: { category: "pair", attempts: 4, correct: 3, accuracy: 75 },
  },
  strongestCategory: "hard",
  weakestCategory: "soft",
};

const ACHIEVEMENTS: Achievement[] = [
  { id: "first_perfect_decision", title: "First Perfect Move", description: "d", earned: true, progress: 100 },
  { id: "ten_correct_streak", title: "Hot Streak", description: "d", earned: false, progress: 60 },
];

const SESSION_STATS: SessionStats = {
  handsPlayed: 5,
  correctCount: 3,
  accuracy: 60,
  currentStreak: 1,
  bestStreak: 2,
  categoryStats: {
    hard: { category: "hard", attempts: 3, correct: 2, accuracy: 67 },
    soft: { category: "soft", attempts: 2, correct: 1, accuracy: 50 },
    pair: { category: "pair", attempts: 0, correct: 0, accuracy: null },
  },
  weakestCategory: "soft",
};

describe("buildSkillMapViewModel", () => {
  it("uses the server stats/achievements when server data is available", () => {
    const vm = buildSkillMapViewModel({ server: { stats: SERVER_STATS, achievements: ACHIEVEMENTS }, session: SESSION_STATS });

    expect(vm.source).toBe("server");
    expect(vm.totalAttempts).toBe(20);
    expect(vm.overallAccuracy).toBe(70);
    expect(vm.currentStreak).toBe(3);
    expect(vm.bestStreak).toBe(6);
    expect(vm.strongestCategory).toBe("hard");
    expect(vm.weakestCategory).toBe("soft");
    expect(vm.achievements).toEqual(ACHIEVEMENTS);
    expect(vm.categories).toEqual([
      { category: "hard", attempts: 10, accuracy: 80 },
      { category: "soft", attempts: 6, accuracy: 50 },
      { category: "pair", attempts: 4, accuracy: 75 },
    ]);
  });

  it("falls back to session stats, with null achievements and no strongest category, when server data is unavailable", () => {
    const vm = buildSkillMapViewModel({ server: null, session: SESSION_STATS });

    expect(vm.source).toBe("offline");
    expect(vm.totalAttempts).toBe(5);
    expect(vm.overallAccuracy).toBe(60);
    expect(vm.currentStreak).toBe(1);
    expect(vm.bestStreak).toBe(2);
    expect(vm.strongestCategory).toBeNull();
    expect(vm.weakestCategory).toBe("soft");
    expect(vm.achievements).toBeNull();
    expect(vm.categories).toEqual([
      { category: "hard", attempts: 3, accuracy: 67 },
      { category: "soft", attempts: 2, accuracy: 50 },
      { category: "pair", attempts: 0, accuracy: null },
    ]);
  });

  it("keeps categories in fixed hard/soft/pair order regardless of source", () => {
    const vm = buildSkillMapViewModel({ server: { stats: SERVER_STATS, achievements: ACHIEVEMENTS }, session: SESSION_STATS });
    expect(vm.categories.map((c) => c.category)).toEqual(["hard", "soft", "pair"]);
  });
});
