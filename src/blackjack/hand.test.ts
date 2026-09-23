import { describe, expect, it } from "vitest";

import type { Card } from "./cards";
import { handValue, isBlackjack, isBust, isPair, totalFromValues } from "./hand";

function card(rank: Card["rank"], suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

describe("totalFromValues", () => {
  it("sums hard totals with no aces", () => {
    expect(totalFromValues([10, 6])).toEqual({ total: 16, isSoft: false });
  });

  it("keeps an ace soft (as 11) when it fits", () => {
    expect(totalFromValues([11, 6])).toEqual({ total: 17, isSoft: true });
  });

  it("reduces an ace to 1 once the soft total would bust", () => {
    expect(totalFromValues([11, 6, 9])).toEqual({ total: 16, isSoft: false });
  });

  it("reduces one ace at a time with two aces", () => {
    // A + A = soft 12
    expect(totalFromValues([11, 11])).toEqual({ total: 12, isSoft: true });
    // A + A + 9 -> 11 + 1 + 9 = 21, still one ace counted as 11
    expect(totalFromValues([11, 11, 9])).toEqual({ total: 21, isSoft: true });
  });
});

describe("handValue", () => {
  it("computes the total from cards", () => {
    expect(handValue([card("K"), card("6")])).toEqual({
      total: 16,
      isSoft: false,
    });
  });

  it("marks a hand with a usable ace as soft", () => {
    expect(handValue([card("A"), card("7")])).toEqual({
      total: 18,
      isSoft: true,
    });
  });
});

describe("isBlackjack", () => {
  it("is true for an Ace plus a ten-value card", () => {
    expect(isBlackjack([card("A"), card("K")])).toBe(true);
    expect(isBlackjack([card("10"), card("A")])).toBe(true);
  });

  it("is false for a 21 made with three cards", () => {
    expect(isBlackjack([card("7"), card("7"), card("7")])).toBe(false);
  });

  it("is false for a non-21 two-card hand", () => {
    expect(isBlackjack([card("K"), card("9")])).toBe(false);
  });
});

describe("isBust", () => {
  it("is true when the total exceeds 21", () => {
    expect(isBust([card("K"), card("Q"), card("5")])).toBe(true);
  });

  it("is false at or below 21", () => {
    expect(isBust([card("K"), card("Q")])).toBe(false);
  });
});

describe("isPair", () => {
  it("is true for two cards of the same rank", () => {
    expect(isPair([card("8"), card("8")])).toBe(true);
  });

  it("is true for two different ten-value ranks", () => {
    expect(isPair([card("K"), card("Q")])).toBe(true);
  });

  it("is false for two different values", () => {
    expect(isPair([card("8"), card("9")])).toBe(false);
  });

  it("is false for three cards", () => {
    expect(isPair([card("8"), card("8"), card("8")])).toBe(false);
  });
});
