import { describe, expect, it } from "vitest";

import { DAILY_HAND_COUNT, evaluateDailyActions, generateDailyScenarios, gradeDailyResult, isSubmittableDailyDate, publicDailyScenario } from "./dailyChallenge";

describe("daily challenge", () => {
  it("generates the same fixed set for a UTC date and a different set for another date", () => {
    const first = generateDailyScenarios("2026-09-25");
    expect(first).toHaveLength(DAILY_HAND_COUNT);
    expect(generateDailyScenarios("2026-09-25")).toEqual(first);
    expect(generateDailyScenarios("2026-09-26")).not.toEqual(first);
    expect(publicDailyScenario(first[0])).not.toHaveProperty("optimalAction");
  });

  it("regrades progress from public hands and accepts a complete perfect result", () => {
    const scenarios = generateDailyScenarios("2026-09-25");
    const actions = scenarios.map((scenario) => scenario.optimalAction);
    expect(evaluateDailyActions(scenarios.map(publicDailyScenario), actions)).toMatchObject({
      score: 10, attempts: 10, misses: 0, complete: true,
    });
    expect(gradeDailyResult("2026-09-25", scenarios, actions, 1234)).toEqual({
      ok: true, result: { date: "2026-09-25", score: 10, attempts: 10, accuracy: 100, durationMs: 1234 },
    });
  });

  it("requires exactly ten hands or a third miss and rejects illegal or post-finish actions", () => {
    const scenarios = generateDailyScenarios("2026-09-25");
    const wrong = scenarios.map((scenario) => scenario.availableActions.find((action) => action !== scenario.optimalAction)!);
    expect(gradeDailyResult("2026-09-25", scenarios, wrong.slice(0, 2), 1)).toEqual({
      ok: false, reason: "challenge is unfinished",
    });
    expect(gradeDailyResult("2026-09-25", scenarios, wrong.slice(0, 3), 1)).toMatchObject({
      ok: true, result: { score: 0, attempts: 3, accuracy: 0 },
    });
    expect(gradeDailyResult("2026-09-25", scenarios, wrong.slice(0, 4), 1)).toEqual({
      ok: false, reason: "actions after challenge ended",
    });
    const illegal = scenarios[0].availableActions.includes("split") ? "hit" : "split";
    expect(gradeDailyResult("2026-09-25", scenarios, [illegal], 1)).toEqual({
      ok: false, reason: "illegal action",
    });
  });

  it("allows yesterday only in the first 15 UTC minutes", () => {
    expect(isSubmittableDailyDate("2026-09-24", new Date("2026-09-25T00:14:59Z"))).toBe(true);
    expect(isSubmittableDailyDate("2026-09-24", new Date("2026-09-25T00:15:00Z"))).toBe(false);
    expect(isSubmittableDailyDate("2026-09-26", new Date("2026-09-25T00:01:00Z"))).toBe(false);
    expect(isSubmittableDailyDate("2026-09-25", new Date("2026-09-25T23:59:59Z"))).toBe(true);
  });
});
