import { describe, expect, it } from "vitest";
import { getArcadeProgress } from "./progress";

describe("getArcadeProgress", () => {
  it("starts at level one with no XP", () => {
    expect(getArcadeProgress([])).toEqual({
      xp: 0,
      level: 1,
      levelXp: 0,
      xpToNextLevel: 100,
    });
  });

  it("awards more session XP for correct decisions", () => {
    expect(getArcadeProgress([{ isCorrect: true }, { isCorrect: false }])).toEqual({
      xp: 30,
      level: 1,
      levelXp: 30,
      xpToNextLevel: 70,
    });
  });

  it("levels up at the exact XP boundary", () => {
    expect(getArcadeProgress(Array.from({ length: 4 }, () => ({ isCorrect: true })))).toEqual({
      xp: 100,
      level: 2,
      levelXp: 0,
      xpToNextLevel: 100,
    });
  });
});
