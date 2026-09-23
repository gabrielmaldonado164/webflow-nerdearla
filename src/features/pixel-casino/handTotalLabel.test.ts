import { describe, expect, it } from "vitest";

import type { Card } from "@/blackjack";

import { handTotalLabel } from "./handTotalLabel";

const card = (rank: Card["rank"]): Card => ({ rank, suit: "spades" });

describe("handTotalLabel", () => {
  it("shows the total of the cards currently on the table", () => {
    expect(handTotalLabel([card("10"), card("7")])).toBe("17");
  });

  it("counts a soft Ace as 11 while it fits", () => {
    expect(handTotalLabel([card("A"), card("6")])).toBe("17");
  });

  it("shows BUST once the visible cards go over 21", () => {
    expect(handTotalLabel([card("10"), card("6"), card("K")])).toBe("BUST");
  });

  it("shows 21 exactly without calling it a bust", () => {
    expect(handTotalLabel([card("10"), card("5"), card("6")])).toBe("21");
  });
});
