import { describe, expect, it } from "vitest";

import type { PlayerStats } from "@/player/playerStats";

import { INITIAL_SKILL_MAP_DATA_STATE, nextSkillMapData } from "./skillMapDataState";
import type { StatsResponseBody } from "./skillMapStatsResponse";

const STATS_A: PlayerStats = {
  totalDecisions: 10,
  correctDecisions: 7,
  accuracy: 70,
  currentStreak: 1,
  bestStreak: 3,
  categoryStats: {
    hard: { category: "hard", attempts: 4, correct: 3, accuracy: 75 },
    soft: { category: "soft", attempts: 3, correct: 2, accuracy: 67 },
    pair: { category: "pair", attempts: 3, correct: 2, accuracy: 67 },
  },
  strongestCategory: "hard",
  weakestCategory: "soft",
};

const RESULT_A: StatsResponseBody = { stats: STATS_A, achievements: [] };

const STATS_B: PlayerStats = { ...STATS_A, totalDecisions: 20, correctDecisions: 14 };
const RESULT_B: StatsResponseBody = { stats: STATS_B, achievements: [] };

describe("nextSkillMapData", () => {
  it("starts with no data and not stale", () => {
    expect(INITIAL_SKILL_MAP_DATA_STATE).toEqual({ data: null, stale: false });
  });

  it("a successful fetch replaces data and clears stale", () => {
    const next = nextSkillMapData(INITIAL_SKILL_MAP_DATA_STATE, RESULT_A);
    expect(next).toEqual({ data: RESULT_A, stale: false });
  });

  it("a failed fetch with no prior success keeps data null and marks stale", () => {
    const next = nextSkillMapData(INITIAL_SKILL_MAP_DATA_STATE, null);
    expect(next).toEqual({ data: null, stale: true });
  });

  it("a failed fetch after a prior success keeps the last good data and marks stale", () => {
    const afterSuccess = nextSkillMapData(INITIAL_SKILL_MAP_DATA_STATE, RESULT_A);
    const afterFailure = nextSkillMapData(afterSuccess, null);
    expect(afterFailure).toEqual({ data: RESULT_A, stale: true });
  });

  it("success -> failure -> success replaces with the newest data and clears stale again", () => {
    let state = nextSkillMapData(INITIAL_SKILL_MAP_DATA_STATE, RESULT_A);
    state = nextSkillMapData(state, null);
    state = nextSkillMapData(state, RESULT_B);
    expect(state).toEqual({ data: RESULT_B, stale: false });
  });

  it("keeps the same data reference across a failure (no unnecessary downstream recompute)", () => {
    const afterSuccess = nextSkillMapData(INITIAL_SKILL_MAP_DATA_STATE, RESULT_A);
    const afterFailure = nextSkillMapData(afterSuccess, null);
    expect(afterFailure.data).toBe(afterSuccess.data);
  });
});
