import { describe, expect, it } from "vitest";

import { isBlackjack } from "./hand";
import { createRng } from "./rng";
import { DEFAULT_RULES } from "./rules";
import { generateScenario, pickWeightedCategory } from "./scenario";

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

describe("pickWeightedCategory", () => {
  it("never produces a zero-weight category", () => {
    const rng = createRng(13);
    for (let i = 0; i < 500; i++) {
      const category = pickWeightedCategory(rng, { hard: 1, soft: 0, pair: 1 });
      expect(category).not.toBe("soft");
    }
  });

  it("lets a heavily weighted category dominate", () => {
    const rng = createRng(21);
    const counts = { hard: 0, soft: 0, pair: 0 };
    const total = 500;
    for (let i = 0; i < total; i++) {
      counts[pickWeightedCategory(rng, { hard: 100, soft: 1, pair: 1 })]++;
    }
    expect(counts.hard / total).toBeGreaterThan(0.9);
  });

  it("ignores an explicitly undefined weight instead of letting it override the default", () => {
    // Regression guard: an earlier implementation resolved weights with
    // `{ ...DEFAULT_WEIGHTS, ...weights }`, so an explicit `hard: undefined`
    // clobbered the default with `undefined`, making the total `NaN` and
    // every roll fall through to "pair". Asserting on the distribution
    // (rather than just "category is one of hard/soft/pair", which can
    // never fail) catches that regression: with the old spread-based
    // logic, "hard" would never appear here.
    const rng = createRng(3);
    const seen = { hard: false, soft: false, pair: false };
    for (let i = 0; i < 200; i++) {
      seen[pickWeightedCategory(rng, { hard: undefined, soft: 0 })] = true;
    }
    expect(seen.hard).toBe(true);
    expect(seen.soft).toBe(false);
  });

  it("throws when all weights are zero", () => {
    expect(() => pickWeightedCategory(createRng(1), { hard: 0, soft: 0, pair: 0 })).toThrow();
  });

  it("throws on a negative weight", () => {
    expect(() => pickWeightedCategory(createRng(1), { hard: -1, soft: 1, pair: 1 })).toThrow();
  });

  it("throws on a NaN weight", () => {
    expect(() =>
      pickWeightedCategory(createRng(1), { hard: Number.NaN, soft: 1, pair: 1 }),
    ).toThrow();
  });

  it("throws on a non-finite weight", () => {
    expect(() =>
      pickWeightedCategory(createRng(1), { hard: Number.POSITIVE_INFINITY, soft: 1, pair: 1 }),
    ).toThrow();
  });
});

describe("generateScenario weight validation", () => {
  it("throws a descriptive error when all category weights are zero", () => {
    expect(() =>
      generateScenario(createRng(1), DEFAULT_RULES, {
        weights: { hard: 0, soft: 0, pair: 0 },
      }),
    ).toThrow(/weights must not all be zero/i);
  });

  it("throws a descriptive error naming the invalid weight for a negative value", () => {
    expect(() =>
      generateScenario(createRng(1), DEFAULT_RULES, {
        weights: { hard: -1, soft: 1, pair: 1 },
      }),
    ).toThrow(/"hard" weight must be a finite number >= 0/);
  });

  it("throws a descriptive error naming the invalid weight for a NaN value", () => {
    expect(() =>
      generateScenario(createRng(1), DEFAULT_RULES, {
        weights: { hard: 1, soft: Number.NaN, pair: 1 },
      }),
    ).toThrow(/"soft" weight must be a finite number >= 0/);
  });
});
