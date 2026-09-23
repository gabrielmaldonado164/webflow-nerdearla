import { describe, expect, it } from "vitest";

import type { Card, ResolveHandResult, Scenario } from "@/blackjack";
import { createInitialRunState, STARTING_LIVES } from "@/training/run";

import { applyDecision, canDeal, canDecide, createInitialSessionState, sessionReducer } from "./sessionReducer";

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

describe("createInitialSessionState", () => {
  it("starts with no scenario/hole card/feedback, empty decisions, and a fresh run", () => {
    const state = createInitialSessionState();
    expect(state.scenario).toBeNull();
    expect(state.holeCard).toBeNull();
    expect(state.feedback).toBeNull();
    expect(state.decisions).toEqual([]);
    expect(state.run).toEqual(createInitialRunState());
  });

  it("accepts an initial best score", () => {
    expect(createInitialSessionState(500).run.bestScore).toBe(500);
  });
});

describe("sessionReducer deal", () => {
  it("deals a scenario and clears any pending feedback", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
    state = sessionReducer(state, {
      type: "decide",
      action: "hit",
      resolution: buildResolution(),
      decidedAt: "t",
    });
    expect(state.feedback).not.toBeNull();

    const nextScenario = buildScenario({ label: "Next hand" });
    const next = sessionReducer(state, { type: "deal", scenario: nextScenario, holeCard: HOLE_CARD });

    expect(next.scenario).toBe(nextScenario);
    expect(next.feedback).toBeNull();
  });

  it("is ignored once the run is over, returning the same state reference", () => {
    let state = createInitialSessionState();
    for (let i = 0; i < STARTING_LIVES; i++) {
      state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
      state = sessionReducer(state, {
        type: "decide",
        action: "stand",
        resolution: buildResolution(),
        decidedAt: `w-${i}`,
      });
    }
    expect(state.run.status).toBe("over");

    const next = sessionReducer(state, {
      type: "deal",
      scenario: buildScenario({ label: "Should be ignored" }),
      holeCard: HOLE_CARD,
    });
    expect(next).toBe(state);
  });
});

describe("sessionReducer decide", () => {
  it("accepts a legal action, sets feedback with the resolution, records the decision, and updates the run", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });

    const resolution = buildResolution();
    const next = sessionReducer(state, {
      type: "decide",
      action: "hit",
      resolution,
      decidedAt: "2026-09-23T00:00:00.000Z",
    });

    expect(next.feedback).not.toBeNull();
    expect(next.feedback?.isCorrect).toBe(true);
    expect(next.feedback?.userAction).toBe("hit");
    expect(next.feedback?.optimalAction).toBe("hit");
    expect(next.feedback?.resolution).toBe(resolution);
    expect(next.decisions).toHaveLength(1);
    expect(next.decisions[0]).toMatchObject({
      userAction: "hit",
      optimalAction: "hit",
      isCorrect: true,
      decidedAt: "2026-09-23T00:00:00.000Z",
    });
    expect(next.run.score).toBeGreaterThan(0);
    expect(next.run.streak).toBe(1);
  });

  it("grades against optimalAction, not the resolved hand's outcome", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, {
      type: "deal",
      scenario: buildScenario({ optimalAction: "hit" }),
      holeCard: HOLE_CARD,
    });

    // The player made the strategically correct call (hit) even though the
    // resolved hand ends up busting and losing.
    const resolution = buildResolution({
      playerHands: [{ cards: PLAYER_HARD_16, total: 26, doubled: false, busted: true, outcome: "lose" }],
    });
    const next = sessionReducer(state, { type: "decide", action: "hit", resolution, decidedAt: "t" });

    expect(next.feedback?.isCorrect).toBe(true);
    expect(next.run.lives).toBe(STARTING_LIVES);
  });

  it("ignores a decide with no scenario dealt yet", () => {
    const state = createInitialSessionState();
    const next = sessionReducer(state, {
      type: "decide",
      action: "hit",
      resolution: buildResolution(),
      decidedAt: "t",
    });
    expect(next).toBe(state);
  });

  it("ignores a second decide while feedback is already pending", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
    const afterFirst = sessionReducer(state, {
      type: "decide",
      action: "hit",
      resolution: buildResolution(),
      decidedAt: "t1",
    });

    const afterSecond = sessionReducer(afterFirst, {
      type: "decide",
      action: "stand",
      resolution: buildResolution(),
      decidedAt: "t2",
    });

    expect(afterSecond).toBe(afterFirst);
  });

  it("ignores a decide once the run is over", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
    for (let i = 0; i < STARTING_LIVES; i++) {
      state = sessionReducer(state, {
        type: "decide",
        action: "stand",
        resolution: buildResolution(),
        decidedAt: `wrong-${i}`,
      });
      state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
    }
    expect(state.run.status).toBe("over");

    const next = sessionReducer(state, {
      type: "decide",
      action: "hit",
      resolution: buildResolution(),
      decidedAt: "late",
    });
    expect(next).toBe(state);
  });

  it("ignores an action that isn't available for the scenario", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, {
      type: "deal",
      scenario: buildScenario({ availableActions: ["hit", "stand"] }),
      holeCard: HOLE_CARD,
    });

    const next = sessionReducer(state, {
      type: "decide",
      action: "double",
      resolution: buildResolution(),
      decidedAt: "t",
    });
    expect(next).toBe(state);
  });
});

describe("sessionReducer restart", () => {
  it("resets the run (folding the live score into best) and deals the new hand, keeping decisions history", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
    state = sessionReducer(state, {
      type: "decide",
      action: "hit",
      resolution: buildResolution(),
      decidedAt: "t",
    });

    const scoreBeforeRestart = state.run.score;
    const decisionsBeforeRestart = state.decisions;

    const restartScenario = buildScenario({ label: "Hard 12" });
    const next = sessionReducer(state, { type: "restart", scenario: restartScenario, holeCard: HOLE_CARD });

    expect(next.run).toEqual(createInitialRunState(scoreBeforeRestart));
    expect(next.scenario).toBe(restartScenario);
    expect(next.holeCard).toBe(HOLE_CARD);
    expect(next.feedback).toBeNull();
    expect(next.decisions).toBe(decisionsBeforeRestart);
  });

  it("applies an explicit bestScore floor on restart when higher than the folded score", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
    state = sessionReducer(state, {
      type: "decide",
      action: "hit",
      resolution: buildResolution(),
      decidedAt: "t",
    });

    const next = sessionReducer(state, {
      type: "restart",
      scenario: buildScenario(),
      holeCard: HOLE_CARD,
      bestScore: 99999,
    });

    expect(next.run.bestScore).toBe(99999);
  });
});

describe("canDecide", () => {
  it("is false with no scenario dealt yet", () => {
    expect(canDecide(createInitialSessionState(), "hit")).toBe(false);
  });

  it("is true for an available action against a freshly dealt scenario", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, {
      type: "deal",
      scenario: buildScenario({ availableActions: ["hit", "stand"] }),
      holeCard: HOLE_CARD,
    });
    expect(canDecide(state, "hit")).toBe(true);
    expect(canDecide(state, "stand")).toBe(true);
  });

  it("is false for an action that isn't in availableActions", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, {
      type: "deal",
      scenario: buildScenario({ availableActions: ["hit", "stand"] }),
      holeCard: HOLE_CARD,
    });
    expect(canDecide(state, "double")).toBe(false);
  });

  it("is false while feedback is already pending", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
    state = sessionReducer(state, {
      type: "decide",
      action: "hit",
      resolution: buildResolution(),
      decidedAt: "t",
    });
    expect(canDecide(state, "stand")).toBe(false);
  });

  it("is false once the run is over", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
    for (let i = 0; i < STARTING_LIVES; i++) {
      state = sessionReducer(state, {
        type: "decide",
        action: "stand",
        resolution: buildResolution(),
        decidedAt: `wrong-${i}`,
      });
      state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
    }
    expect(state.run.status).toBe("over");
    expect(canDecide(state, "hit")).toBe(false);
  });
});

describe("canDeal", () => {
  it("is true for a fresh session", () => {
    expect(canDeal(createInitialSessionState())).toBe(true);
  });

  it("is false once the run is over", () => {
    let state = createInitialSessionState();
    for (let i = 0; i < STARTING_LIVES; i++) {
      state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
      state = sessionReducer(state, {
        type: "decide",
        action: "stand",
        resolution: buildResolution(),
        decidedAt: `w-${i}`,
      });
    }
    expect(state.run.status).toBe("over");
    expect(canDeal(state)).toBe(false);
  });
});

describe("applyDecision", () => {
  it("returns the record for an accepted decision", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });

    const { state: nextState, record } = applyDecision(state, {
      type: "decide",
      action: "hit",
      resolution: buildResolution(),
      decidedAt: "t",
    });

    expect(record).not.toBeNull();
    expect(record?.userAction).toBe("hit");
    expect(nextState.decisions).toHaveLength(1);
  });

  it("returns record: null and the same state reference for an ignored decision", () => {
    const state = createInitialSessionState(); // no scenario dealt yet

    const { state: nextState, record } = applyDecision(state, {
      type: "decide",
      action: "hit",
      resolution: buildResolution(),
      decidedAt: "t",
    });

    expect(record).toBeNull();
    expect(nextState).toBe(state);
  });
});
