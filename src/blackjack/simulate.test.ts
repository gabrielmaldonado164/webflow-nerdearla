import { describe, expect, it } from "vitest";

import type { Card, Rank } from "./cards";
import { createRng } from "./rng";
import { DEFAULT_RULES } from "./rules";
import { simulateAllActions, simulateEV } from "./simulate";

function card(rank: Rank, suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

describe("simulateEV", () => {
  it("is deterministic for a given seed", () => {
    const hand = [card("K"), card("9")];
    const dealerUpcard = card("6");
    const a = simulateEV(hand, dealerUpcard, "stand", {
      rng: createRng(1),
      rules: DEFAULT_RULES,
      iterations: 2000,
    });
    const b = simulateEV(hand, dealerUpcard, "stand", {
      rng: createRng(1),
      rules: DEFAULT_RULES,
      iterations: 2000,
    });
    expect(a).toEqual(b);
  });

  it("standing on hard 20 vs a dealer 6 has clearly positive EV", () => {
    const result = simulateEV([card("K"), card("Q")], card("6"), "stand", {
      rng: createRng(42),
      rules: DEFAULT_RULES,
      iterations: 50_000,
    });
    expect(result.ev).toBeGreaterThan(0.5);
  });

  it("hard 16 vs 10: stand and hit EVs are both negative and close to each other", () => {
    const hand = [card("10"), card("6")];
    const dealerUpcard = card("10");
    const standResult = simulateEV(hand, dealerUpcard, "stand", {
      rng: createRng(7),
      rules: DEFAULT_RULES,
      iterations: 50_000,
    });
    const hitResult = simulateEV(hand, dealerUpcard, "hit", {
      rng: createRng(8),
      rules: DEFAULT_RULES,
      iterations: 50_000,
    });
    expect(standResult.ev).toBeLessThan(0);
    expect(hitResult.ev).toBeLessThan(0);
    expect(Math.abs(standResult.ev - hitResult.ev)).toBeLessThan(0.15);
  });

  it("11 vs 6: double EV is greater than hit EV", () => {
    const hand = [card("6"), card("5")];
    const dealerUpcard = card("6");
    const doubleResult = simulateEV(hand, dealerUpcard, "double", {
      rng: createRng(3),
      rules: DEFAULT_RULES,
      iterations: 50_000,
    });
    const hitResult = simulateEV(hand, dealerUpcard, "hit", {
      rng: createRng(4),
      rules: DEFAULT_RULES,
      iterations: 50_000,
    });
    expect(doubleResult.ev).toBeGreaterThan(hitResult.ev);
  });

  it("8-8 vs 10: split EV is greater than stand EV", () => {
    const hand = [card("8"), card("8")];
    const dealerUpcard = card("10");
    const splitResult = simulateEV(hand, dealerUpcard, "split", {
      rng: createRng(9),
      rules: DEFAULT_RULES,
      iterations: 50_000,
    });
    const standResult = simulateEV(hand, dealerUpcard, "stand", {
      rng: createRng(10),
      rules: DEFAULT_RULES,
      iterations: 50_000,
    });
    expect(splitResult.ev).toBeGreaterThan(standResult.ev);
  });

  it("runs 20k iterations well within a loose time budget", () => {
    const hand = [card("K"), card("6")];
    const dealerUpcard = card("10");
    const start = performance.now();
    simulateEV(hand, dealerUpcard, "hit", {
      rng: createRng(123),
      rules: DEFAULT_RULES,
      iterations: 20_000,
    });
    const elapsedMs = performance.now() - start;
    // Generous bound to avoid flakiness on slower CI machines; the target
    // is well under 200ms locally (typically a few ms).
    expect(elapsedMs).toBeLessThan(2000);
  });
});

describe("simulateAllActions", () => {
  it("returns an EV result for each available action", () => {
    const hand = [card("8"), card("8")];
    const dealerUpcard = card("10");
    const results = simulateAllActions(hand, dealerUpcard, {
      rng: createRng(5),
      rules: DEFAULT_RULES,
      iterations: 5000,
    });
    const actionNames = results.map((r) => r.action);
    expect(actionNames).toEqual(expect.arrayContaining(["hit", "stand", "split"]));
  });

  it("never simulates an action unavailable on the hand", () => {
    // A hard, non-pair, 3-card hand: only hit/stand are available.
    const hand = [card("2"), card("3"), card("4")];
    const dealerUpcard = card("6");
    const results = simulateAllActions(hand, dealerUpcard, {
      rng: createRng(5),
      rules: DEFAULT_RULES,
      iterations: 100,
    });
    const actionNames = results.map((r) => r.action);
    expect(actionNames.sort()).toEqual(["hit", "stand"]);
  });
});

describe("simulateEV input validation", () => {
  it("throws a RangeError for zero iterations", () => {
    expect(() =>
      simulateEV([card("K"), card("9")], card("6"), "stand", {
        rng: createRng(1),
        rules: DEFAULT_RULES,
        iterations: 0,
      }),
    ).toThrow(RangeError);
  });

  it("throws a RangeError for negative iterations", () => {
    expect(() =>
      simulateEV([card("K"), card("9")], card("6"), "stand", {
        rng: createRng(1),
        rules: DEFAULT_RULES,
        iterations: -5,
      }),
    ).toThrow(RangeError);
  });

  it("throws a RangeError for non-integer iterations", () => {
    expect(() =>
      simulateEV([card("K"), card("9")], card("6"), "stand", {
        rng: createRng(1),
        rules: DEFAULT_RULES,
        iterations: 2.5,
      }),
    ).toThrow(RangeError);
  });

  it("throws when splitting a non-pair hand", () => {
    expect(() =>
      simulateEV([card("K"), card("9")], card("6"), "split", {
        rng: createRng(1),
        rules: DEFAULT_RULES,
        iterations: 100,
      }),
    ).toThrow(/split/i);
  });

  it("throws when splitting a hand with more than two cards", () => {
    expect(() =>
      simulateEV([card("6"), card("6"), card("2")], card("6"), "split", {
        rng: createRng(1),
        rules: DEFAULT_RULES,
        iterations: 100,
      }),
    ).toThrow(/split/i);
  });

  it("throws when doubling a hand with more than two cards", () => {
    expect(() =>
      simulateEV([card("2"), card("3"), card("4")], card("6"), "double", {
        rng: createRng(1),
        rules: DEFAULT_RULES,
        iterations: 100,
      }),
    ).toThrow(/double/i);
  });
});
