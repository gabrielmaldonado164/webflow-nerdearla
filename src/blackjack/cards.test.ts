import { describe, expect, it } from "vitest";

import { drawCard, rankValue, RANKS, SUITS } from "./cards";

describe("rankValue", () => {
  it("returns the numeric value for number ranks", () => {
    expect(rankValue("2")).toBe(2);
    expect(rankValue("9")).toBe(9);
    expect(rankValue("10")).toBe(10);
  });

  it("returns 10 for every face card", () => {
    expect(rankValue("J")).toBe(10);
    expect(rankValue("Q")).toBe(10);
    expect(rankValue("K")).toBe(10);
  });

  it("returns 11 for the high ace value", () => {
    expect(rankValue("A")).toBe(11);
  });
});

describe("drawCard", () => {
  it("uses the RNG to pick a rank and a suit deterministically", () => {
    const rng = () => 0; // always picks index 0
    const card = drawCard(rng);
    expect(card.rank).toBe(RANKS[0]);
    expect(card.suit).toBe(SUITS[0]);
  });

  it("picks the last rank and suit when the RNG returns close to 1", () => {
    const rng = () => 0.999999;
    const card = drawCard(rng);
    expect(card.rank).toBe(RANKS[RANKS.length - 1]);
    expect(card.suit).toBe(SUITS[SUITS.length - 1]);
  });
});
