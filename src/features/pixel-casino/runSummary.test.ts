import { describe, expect, it } from "vitest";

import { computeRunAccuracy, isNewBestScore } from "./runSummary";

function decisions(...isCorrect: boolean[]) {
  return isCorrect.map((correct) => ({ isCorrect: correct }));
}

describe("computeRunAccuracy", () => {
  it("returns null when the run made no decisions", () => {
    expect(computeRunAccuracy(decisions(true, false), 0)).toBeNull();
  });

  it("computes the percentage correct over the last runDecisionCount decisions", () => {
    // 5 decisions total in the session, but only the last 2 belong to
    // this run (runDecisionCount = 2): one correct, one wrong -> 50%.
    expect(computeRunAccuracy(decisions(true, true, true, false, true), 2)).toBe(50);
  });

  it("rounds to the nearest whole percent", () => {
    // 2 of 3 correct = 66.6...% -> rounds to 67.
    expect(computeRunAccuracy(decisions(true, true, false), 3)).toBe(67);
  });

  it("is 100 when every run decision was correct", () => {
    expect(computeRunAccuracy(decisions(true, true), 2)).toBe(100);
  });

  it("is 0 when every run decision was wrong", () => {
    expect(computeRunAccuracy(decisions(false, false), 2)).toBe(0);
  });

  it("clamps runDecisionCount to the available decisions (never reads before the start)", () => {
    expect(computeRunAccuracy(decisions(true), 5)).toBe(100);
  });
});

describe("isNewBestScore", () => {
  it("is true when the final score beats the score the run started with", () => {
    expect(isNewBestScore(500, 900)).toBe(true);
  });

  it("is false when the final score ties the entering best", () => {
    expect(isNewBestScore(900, 900)).toBe(false);
  });

  it("is false when the final score is lower than the entering best", () => {
    expect(isNewBestScore(900, 300)).toBe(false);
  });
});
