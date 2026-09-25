import { describe, expect, it } from "vitest";

import type { PlayerStats } from "@/player/playerStats";
import { weightsFromStats } from "@/training/weights";

import { INITIAL_SKILL_MAP_DATA_STATE, nextSkillMapData } from "./skillMapDataState";
import { computeToggleWeights } from "./skillMapWeights";
import type { StatsResponseBody } from "./skillMapStatsResponse";

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
  it("returns undefined (engine default uniform weighting) whenever the toggle is off, regardless of server data", () => {
    expect(computeToggleWeights(null, false)).toBeUndefined();
    expect(computeToggleWeights(STATS, false)).toBeUndefined();
  });

  it("returns undefined when the toggle is on but there is no server data yet (matches the offline-disabled toggle)", () => {
    expect(computeToggleWeights(null, true)).toBeUndefined();
  });

  it("returns weightsFromStats with focusWeakness when the toggle is on and server data exists", () => {
    const weights = computeToggleWeights(STATS, true);
    expect(weights).toEqual(weightsFromStats(STATS, { focusWeakness: true }));
  });

  it("stays unchanged when a refetch fails after a prior success (last-good data, T5 fix 1)", () => {
    const result: StatsResponseBody = { stats: STATS, achievements: [] };
    const afterSuccess = nextSkillMapData(INITIAL_SKILL_MAP_DATA_STATE, result);
    const afterFailure = nextSkillMapData(afterSuccess, null);

    const before = computeToggleWeights(afterSuccess.data?.stats ?? null, true);
    const after = computeToggleWeights(afterFailure.data?.stats ?? null, true);
    expect(after).toEqual(before);
  });
});
