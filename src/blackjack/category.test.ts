import { describe, expect, it } from "vitest";

import { classifyScenario } from "./category";
import type { Card, Rank } from "./cards";

function card(rank: Rank, suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

describe("classifyScenario", () => {
  it("classifies a hard total", () => {
    expect(classifyScenario([card("K"), card("6")])).toEqual({
      category: "hard",
      label: "Hard 16",
    });
  });

  it("classifies a soft total", () => {
    expect(classifyScenario([card("A"), card("7")])).toEqual({
      category: "soft",
      label: "Soft 18",
    });
  });

  it("classifies a pair, taking precedence over hard/soft", () => {
    expect(classifyScenario([card("8"), card("8")])).toEqual({
      category: "pair",
      label: "Pair of 8s",
    });
  });

  it("labels mixed ten-value pairs as 10s", () => {
    expect(classifyScenario([card("K"), card("Q")])).toEqual({
      category: "pair",
      label: "Pair of 10s",
    });
  });

  it("labels a pair of Aces distinctly", () => {
    expect(classifyScenario([card("A"), card("A")])).toEqual({
      category: "pair",
      label: "Pair of Aces",
    });
  });

  it("does not treat a 3-card equal-value hand as a pair", () => {
    expect(classifyScenario([card("8"), card("8"), card("5")]).category).toBe(
      "hard",
    );
  });
});
