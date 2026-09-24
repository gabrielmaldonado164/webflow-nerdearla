import { describe, expect, it } from "vitest";

import type { Card, ResolveHandResult, Scenario } from "@/blackjack";
import { createInitialSessionState, sessionReducer } from "@/features/practice/sessionReducer";

import { currentHandNumber } from "./handNumber";

const PLAYER_HARD_16: Card[] = [
  { rank: "10", suit: "spades" },
  { rank: "6", suit: "hearts" },
];
const DEALER_UPCARD_10: Card = { rank: "10", suit: "clubs" };
const HOLE_CARD: Card = { rank: "7", suit: "diamonds" };

function buildScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    playerCards: PLAYER_HARD_16,
    dealerUpcard: DEALER_UPCARD_10,
    availableActions: ["hit", "stand"],
    optimalAction: "hit",
    category: "hard",
    label: "Hard 16",
    ...overrides,
  };
}

function buildResolution(overrides: Partial<ResolveHandResult> = {}): ResolveHandResult {
  return {
    playerHands: [
      { cards: PLAYER_HARD_16, total: 16, doubled: false, busted: false, outcome: "win" },
    ],
    dealerCards: [DEALER_UPCARD_10, HOLE_CARD],
    dealerTotal: 20,
    dealerBusted: false,
    steps: [],
    ...overrides,
  };
}

describe("currentHandNumber", () => {
  it("is hand 1 before any decision has been made in a fresh run", () => {
    expect(currentHandNumber(0, false)).toBe(1);
  });

  it("holds the in-progress hand's number while its feedback is pending", () => {
    expect(currentHandNumber(3, true)).toBe(3);
  });

  it("advances to the next hand once feedback clears (deal/next)", () => {
    expect(currentHandNumber(3, false)).toBe(4);
  });

  it("resets to 1 right after a real restart, driven through sessionReducer", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
    state = sessionReducer(state, {
      type: "decide",
      action: "hit",
      resolution: buildResolution(),
      decidedAt: "t1",
    });
    state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
    state = sessionReducer(state, {
      type: "decide",
      action: "hit",
      resolution: buildResolution(),
      decidedAt: "t2",
    });
    expect(state.run.decisions).toBe(2); // Sanity: two hands played before the restart.

    state = sessionReducer(state, { type: "restart", scenario: buildScenario(), holeCard: HOLE_CARD });

    expect(state.run.decisions).toBe(0);
    expect(currentHandNumber(state.run.decisions, Boolean(state.feedback))).toBe(1);
  });
});
