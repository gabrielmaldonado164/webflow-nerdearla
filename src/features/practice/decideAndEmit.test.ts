import { describe, expect, it } from "vitest";

import type { Card, ResolveHandResult, Scenario } from "@/blackjack";
import { createInitialRunState, STARTING_LIVES } from "@/training/run";

import { decideAndEmit } from "./decideAndEmit";
import { createInitialSessionState, sessionReducer, type SessionState } from "./sessionReducer";

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
      { cards: PLAYER_HARD_16, total: 16, doubled: false, busted: false, outcome: "lose" },
    ],
    dealerCards: [DEALER_UPCARD_10, HOLE_CARD],
    dealerTotal: 17,
    dealerBusted: false,
    steps: [],
    ...overrides,
  };
}

function decideEvent(overrides: Partial<{ action: Scenario["optimalAction"] }> = {}) {
  return {
    type: "decide" as const,
    action: overrides.action ?? "hit",
    resolution: buildResolution(),
    decidedAt: "t",
  };
}

describe("decideAndEmit", () => {
  it("emits exactly one record, equal to the one appended to nextState.decisions, for an accepted decision", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });

    const { nextState, record } = decideAndEmit(state, decideEvent({ action: "hit" }));

    expect(record).not.toBeNull();
    expect(nextState.decisions).toHaveLength(1);
    expect(record).toEqual(nextState.decisions[0]);
  });

  it("emits no record when feedback is already pending", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
    // Optimal decision: keeps the run playing (no lives lost) but sets feedback.
    state = sessionReducer(state, decideEvent({ action: "hit" }));
    expect(state.feedback).not.toBeNull();

    const { nextState, record } = decideAndEmit(state, decideEvent({ action: "stand" }));

    expect(record).toBeNull();
    expect(nextState).toBe(state); // Ignored: unchanged, by reference.
  });

  it("emits no record once the run is over", () => {
    const state: SessionState = {
      scenario: buildScenario(),
      holeCard: HOLE_CARD,
      feedback: null,
      decisions: [],
      run: { ...createInitialRunState(), status: "over" },
    };

    const { nextState, record } = decideAndEmit(state, decideEvent({ action: "hit" }));

    expect(record).toBeNull();
    expect(nextState).toBe(state);
  });

  it("emits no record for an action that isn't available for this scenario", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, {
      type: "deal",
      scenario: buildScenario({ availableActions: ["hit", "stand"] }),
      holeCard: HOLE_CARD,
    });

    const { nextState, record } = decideAndEmit(state, decideEvent({ action: "double" }));

    expect(record).toBeNull();
    expect(nextState).toBe(state);
  });

  it("emits no record once every life is lost mid-session (run over via wrong decisions)", () => {
    let state = createInitialSessionState();
    for (let i = 0; i < STARTING_LIVES; i++) {
      state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
      state = sessionReducer(state, decideEvent({ action: "stand" })); // Wrong: optimal is "hit".
    }
    expect(state.run.status).toBe("over");

    const { nextState, record } = decideAndEmit(state, decideEvent({ action: "hit" }));

    expect(record).toBeNull();
    expect(nextState).toBe(state);
  });
});
