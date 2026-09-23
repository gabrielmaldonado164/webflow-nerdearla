import { describe, expect, it } from "vitest";

import type { Action } from "./actions";
import type { Card, Rank } from "./cards";
import { DEFAULT_RULES } from "./rules";
import { optimalAction } from "./strategy";

function card(rank: Rank, suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

function dealer(rank: Rank): Card {
  return card(rank);
}

// Builds a two-card hard hand summing to `total` using a low kicker (avoids
// accidentally creating an Ace or a pair) plus a filler card as needed.
function hardHand(total: number): Card[] {
  if (total <= 11) {
    // Use a 2 plus the remainder (remainder must be a valid single rank 2-10).
    const kicker = total - 2;
    return [card("2"), rankForValue(kicker)];
  }
  if (total === 20) {
    // Avoid the only two-card combination (10+10), which would be a pair.
    return [card("2"), card("8"), card("10")];
  }
  const kicker = total - 10;
  return [card("K"), rankForValue(kicker)];
}

function rankForValue(value: number): Card {
  if (value === 10) return card("10");
  return card(String(value) as Rank);
}

function softHand(nonAceValue: number): Card[] {
  return [card("A"), rankForValue(nonAceValue)];
}

function pairHand(rank: Rank): Card[] {
  return [card(rank), card(rank)];
}

const UPCARDS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];

describe("optimalAction — hard totals", () => {
  it.each([5, 6, 7, 8])("hard %i always hits", (total) => {
    for (const upcard of UPCARDS) {
      expect(optimalAction(hardHand(total), dealer(upcard), DEFAULT_RULES)).toBe(
        "hit",
      );
    }
  });

  it("hard 9 doubles vs 3-6, else hits", () => {
    const expected: Record<Rank, Action> = {
      "2": "hit",
      "3": "double",
      "4": "double",
      "5": "double",
      "6": "double",
      "7": "hit",
      "8": "hit",
      "9": "hit",
      "10": "hit",
      A: "hit",
    } as Record<Rank, Action>;
    for (const upcard of UPCARDS) {
      expect(optimalAction(hardHand(9), dealer(upcard), DEFAULT_RULES)).toBe(
        expected[upcard],
      );
    }
  });

  it("hard 10 doubles vs 2-9, else hits", () => {
    for (const upcard of UPCARDS) {
      const expected: Action = upcard === "10" || upcard === "A" ? "hit" : "double";
      expect(optimalAction(hardHand(10), dealer(upcard), DEFAULT_RULES)).toBe(
        expected,
      );
    }
  });

  it("hard 11 doubles vs 2-10, hits vs Ace", () => {
    for (const upcard of UPCARDS) {
      const expected: Action = upcard === "A" ? "hit" : "double";
      expect(optimalAction(hardHand(11), dealer(upcard), DEFAULT_RULES)).toBe(
        expected,
      );
    }
  });

  it("hard 12 stands vs 4-6, else hits", () => {
    for (const upcard of UPCARDS) {
      const expected: Action = ["4", "5", "6"].includes(upcard) ? "stand" : "hit";
      expect(optimalAction(hardHand(12), dealer(upcard), DEFAULT_RULES)).toBe(
        expected,
      );
    }
  });

  it.each([13, 14, 15, 16])("hard %i stands vs 2-6, else hits", (total) => {
    for (const upcard of UPCARDS) {
      const expected: Action = ["2", "3", "4", "5", "6"].includes(upcard)
        ? "stand"
        : "hit";
      expect(optimalAction(hardHand(total), dealer(upcard), DEFAULT_RULES)).toBe(
        expected,
      );
    }
  });

  it.each([17, 18, 19, 20])("hard %i always stands", (total) => {
    for (const upcard of UPCARDS) {
      expect(optimalAction(hardHand(total), dealer(upcard), DEFAULT_RULES)).toBe(
        "stand",
      );
    }
  });

  it("falls back from double to hit on a 3-card 11 vs 6", () => {
    const hand = [card("5"), card("2"), card("4")]; // 3 cards, total 11
    expect(optimalAction(hand, dealer("6"), DEFAULT_RULES)).toBe("hit");
  });
});

describe("optimalAction — soft totals", () => {
  it.each([2, 3])("soft A%i doubles vs 5-6, else hits", (kicker) => {
    for (const upcard of UPCARDS) {
      const expected: Action = ["5", "6"].includes(upcard) ? "double" : "hit";
      expect(optimalAction(softHand(kicker), dealer(upcard), DEFAULT_RULES)).toBe(
        expected,
      );
    }
  });

  it.each([4, 5])("soft A%i doubles vs 4-6, else hits", (kicker) => {
    for (const upcard of UPCARDS) {
      const expected: Action = ["4", "5", "6"].includes(upcard) ? "double" : "hit";
      expect(optimalAction(softHand(kicker), dealer(upcard), DEFAULT_RULES)).toBe(
        expected,
      );
    }
  });

  it("soft A6 doubles vs 3-6, else hits", () => {
    for (const upcard of UPCARDS) {
      const expected: Action = ["3", "4", "5", "6"].includes(upcard)
        ? "double"
        : "hit";
      expect(optimalAction(softHand(6), dealer(upcard), DEFAULT_RULES)).toBe(
        expected,
      );
    }
  });

  it("soft A7 doubles vs 3-6, stands vs 2/7/8, hits vs 9/10/A", () => {
    const expected: Record<Rank, Action> = {
      "2": "stand",
      "3": "double",
      "4": "double",
      "5": "double",
      "6": "double",
      "7": "stand",
      "8": "stand",
      "9": "hit",
      "10": "hit",
      A: "hit",
    } as Record<Rank, Action>;
    for (const upcard of UPCARDS) {
      expect(optimalAction(softHand(7), dealer(upcard), DEFAULT_RULES)).toBe(
        expected[upcard],
      );
    }
  });

  it.each([8, 9])("soft A%i always stands", (kicker) => {
    for (const upcard of UPCARDS) {
      expect(optimalAction(softHand(kicker), dealer(upcard), DEFAULT_RULES)).toBe(
        "stand",
      );
    }
  });

  it("falls back from double to stand on a 3-card soft 18 vs 4", () => {
    const hand = [card("A"), card("3"), card("4")]; // soft 18, 3 cards
    expect(optimalAction(hand, dealer("4"), DEFAULT_RULES)).toBe("stand");
  });
});

describe("optimalAction — pairs", () => {
  it.each<Rank>(["2", "3"])("pair of %ss splits vs 2-7, else hits", (rank) => {
    for (const upcard of UPCARDS) {
      const expected: Action = ["2", "3", "4", "5", "6", "7"].includes(upcard)
        ? "split"
        : "hit";
      expect(optimalAction(pairHand(rank), dealer(upcard), DEFAULT_RULES)).toBe(
        expected,
      );
    }
  });

  it("pair of 4s splits vs 5-6, else hits", () => {
    for (const upcard of UPCARDS) {
      const expected: Action = ["5", "6"].includes(upcard) ? "split" : "hit";
      expect(optimalAction(pairHand("4"), dealer(upcard), DEFAULT_RULES)).toBe(
        expected,
      );
    }
  });

  it("pair of 5s is never split, plays as hard 10", () => {
    for (const upcard of UPCARDS) {
      const expected: Action = upcard === "10" || upcard === "A" ? "hit" : "double";
      expect(optimalAction(pairHand("5"), dealer(upcard), DEFAULT_RULES)).toBe(
        expected,
      );
    }
  });

  it("pair of 6s splits vs 2-6, else hits", () => {
    for (const upcard of UPCARDS) {
      const expected: Action = ["2", "3", "4", "5", "6"].includes(upcard)
        ? "split"
        : "hit";
      expect(optimalAction(pairHand("6"), dealer(upcard), DEFAULT_RULES)).toBe(
        expected,
      );
    }
  });

  it("pair of 7s splits vs 2-7, else hits", () => {
    for (const upcard of UPCARDS) {
      const expected: Action = ["2", "3", "4", "5", "6", "7"].includes(upcard)
        ? "split"
        : "hit";
      expect(optimalAction(pairHand("7"), dealer(upcard), DEFAULT_RULES)).toBe(
        expected,
      );
    }
  });

  it("pair of 8s always splits", () => {
    for (const upcard of UPCARDS) {
      expect(optimalAction(pairHand("8"), dealer(upcard), DEFAULT_RULES)).toBe(
        "split",
      );
    }
  });

  it("pair of 9s splits vs 2-6 and 8-9, stands vs 7/10/A", () => {
    const expected: Record<Rank, Action> = {
      "2": "split",
      "3": "split",
      "4": "split",
      "5": "split",
      "6": "split",
      "7": "stand",
      "8": "split",
      "9": "split",
      "10": "stand",
      A: "stand",
    } as Record<Rank, Action>;
    for (const upcard of UPCARDS) {
      expect(optimalAction(pairHand("9"), dealer(upcard), DEFAULT_RULES)).toBe(
        expected[upcard],
      );
    }
  });

  it("pair of 10-value cards always stands", () => {
    for (const upcard of UPCARDS) {
      expect(optimalAction(pairHand("10"), dealer(upcard), DEFAULT_RULES)).toBe(
        "stand",
      );
      expect(optimalAction([card("K"), card("Q")], dealer(upcard), DEFAULT_RULES)).toBe(
        "stand",
      );
    }
  });

  it("pair of Aces always splits", () => {
    for (const upcard of UPCARDS) {
      expect(optimalAction(pairHand("A"), dealer(upcard), DEFAULT_RULES)).toBe(
        "split",
      );
    }
  });

  it("falls back to the hard/soft table when split is not allowed (after a split)", () => {
    // Pair of 8s after a split: no resplitting, so this plays as a hard 16.
    expect(
      optimalAction(pairHand("8"), dealer("10"), DEFAULT_RULES, {
        isAfterSplit: true,
      }),
    ).toBe("hit");
    // Hard 16 vs 6 would normally stand.
    expect(
      optimalAction(pairHand("8"), dealer("6"), DEFAULT_RULES, {
        isAfterSplit: true,
      }),
    ).toBe("stand");
  });
});
