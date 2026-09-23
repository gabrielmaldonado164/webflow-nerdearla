import { describe, expect, it } from "vitest";

import { isBlackjack } from "./hand";
import { createRng } from "./rng";
import { DEFAULT_RULES } from "./rules";
import { generateScenario } from "./scenario";

describe("generateScenario", () => {
  it("is deterministic for a given seed", () => {
    const a = generateScenario(createRng(7), DEFAULT_RULES);
    const b = generateScenario(createRng(7), DEFAULT_RULES);
    expect(a).toEqual(b);
  });

  it("never returns a player blackjack", () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const scenario = generateScenario(rng, DEFAULT_RULES);
      expect(isBlackjack(scenario.playerCards)).toBe(false);
    }
  });

  it("includes consistent derived fields", () => {
    const scenario = generateScenario(createRng(99), DEFAULT_RULES);
    expect(scenario.playerCards).toHaveLength(2);
    expect(scenario.availableActions).toContain("hit");
    expect(scenario.availableActions).toContain("stand");
    expect(["hard", "soft", "pair"]).toContain(scenario.category);
    expect(scenario.label.length).toBeGreaterThan(0);
  });

  it("honors an explicit category filter", () => {
    const rng = createRng(5);
    for (let i = 0; i < 50; i++) {
      expect(generateScenario(rng, DEFAULT_RULES, { category: "pair" }).category).toBe(
        "pair",
      );
    }
  });

  it("honors each category filter independently", () => {
    const rng = createRng(11);
    for (let i = 0; i < 20; i++) {
      expect(generateScenario(rng, DEFAULT_RULES, { category: "hard" }).category).toBe(
        "hard",
      );
      expect(generateScenario(rng, DEFAULT_RULES, { category: "soft" }).category).toBe(
        "soft",
      );
    }
  });
});
