import { describe, expect, it } from "vitest";

import { DEFAULT_RULES, createRng } from "@/blackjack";
import type { Card, Scenario } from "@/blackjack";

import { dealNextHandIfAllowed, resolveActionIfAllowed } from "./sessionRng";
import { createInitialSessionState, sessionReducer, type SessionState } from "./sessionReducer";

const HOLE_CARD: Card = { rank: "7", suit: "diamonds" };

function buildScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    playerCards: [
      { rank: "10", suit: "spades" },
      { rank: "6", suit: "hearts" },
    ],
    dealerUpcard: { rank: "10", suit: "clubs" },
    availableActions: ["hit", "stand"],
    optimalAction: "hit",
    category: "hard",
    label: "Hard 16",
    ...overrides,
  };
}

describe("dealNextHandIfAllowed", () => {
  it("deals a scenario and hole card, drawing from the rng, when the run isn't over", () => {
    const rng = createRng(1);
    const dealt = dealNextHandIfAllowed(createInitialSessionState(), rng, DEFAULT_RULES);
    expect(dealt).not.toBeNull();
    expect(dealt?.scenario.playerCards.length).toBeGreaterThan(0);
    expect(dealt?.holeCard).toBeDefined();
  });

  it("returns null and draws nothing from the rng once the run is over", () => {
    let state = createInitialSessionState();
    for (let i = 0; i < 3; i++) {
      state = sessionReducer(state, { type: "deal", scenario: buildScenario(), holeCard: HOLE_CARD });
      state = sessionReducer(state, {
        type: "decide",
        action: "stand",
        resolution: {
          playerHands: [{ cards: buildScenario().playerCards, total: 16, doubled: false, busted: false, outcome: "lose" }],
          dealerCards: [buildScenario().dealerUpcard, HOLE_CARD],
          dealerTotal: 17,
          dealerBusted: false,
          steps: [],
        },
        decidedAt: `w-${i}`,
      });
    }
    expect(state.run.status).toBe("over");

    let drawCount = 0;
    const countingRng = () => {
      drawCount += 1;
      return Math.random();
    };
    const dealt = dealNextHandIfAllowed(state, countingRng, DEFAULT_RULES);

    expect(dealt).toBeNull();
    expect(drawCount).toBe(0);
  });
});

describe("resolveActionIfAllowed", () => {
  function dealtState(): SessionState {
    const rng = createRng(1);
    const dealt = dealNextHandIfAllowed(createInitialSessionState(), rng, DEFAULT_RULES)!;
    return sessionReducer(createInitialSessionState(), {
      type: "deal",
      scenario: dealt.scenario,
      holeCard: dealt.holeCard,
    });
  }

  it("resolves the action, drawing from the rng, when the decision is allowed", () => {
    const state = dealtState();
    const action = state.scenario!.availableActions[0];
    const rng = createRng(2);
    const resolution = resolveActionIfAllowed(state, action, rng, DEFAULT_RULES);
    expect(resolution).not.toBeNull();
    expect(resolution?.dealerCards.length).toBeGreaterThanOrEqual(2);
  });

  it("returns null and draws nothing from the rng with no scenario dealt", () => {
    let drawCount = 0;
    const countingRng = () => {
      drawCount += 1;
      return Math.random();
    };
    const resolution = resolveActionIfAllowed(createInitialSessionState(), "hit", countingRng, DEFAULT_RULES);
    expect(resolution).toBeNull();
    expect(drawCount).toBe(0);
  });

  it("returns null and draws nothing from the rng for an unavailable action", () => {
    const state = dealtState();
    const unavailable = (["hit", "stand", "double", "split"] as const).find(
      (action) => !state.scenario!.availableActions.includes(action),
    );
    if (!unavailable) return; // Every action happened to be available for this seed; nothing to assert.

    let drawCount = 0;
    const countingRng = () => {
      drawCount += 1;
      return Math.random();
    };
    const resolution = resolveActionIfAllowed(state, unavailable, countingRng, DEFAULT_RULES);
    expect(resolution).toBeNull();
    expect(drawCount).toBe(0);
  });

  it("returns null and draws nothing from the rng while feedback is already pending", () => {
    const state = dealtState();
    const action = state.scenario!.availableActions[0];
    const resolution = resolveActionIfAllowed(state, action, createRng(2), DEFAULT_RULES);
    const withFeedback = sessionReducer(state, {
      type: "decide",
      action,
      resolution: resolution!,
      decidedAt: "t",
    });

    let drawCount = 0;
    const countingRng = () => {
      drawCount += 1;
      return Math.random();
    };
    const second = resolveActionIfAllowed(withFeedback, action, countingRng, DEFAULT_RULES);
    expect(second).toBeNull();
    expect(drawCount).toBe(0);
  });
});

describe("seeded determinism", () => {
  const ALL_ACTIONS = ["hit", "stand", "double", "split"] as const;

  /**
   * Drives the reducer through a full session exactly the way the hook
   * does: gate on `canDeal`/`canDecide` (via the two helpers above)
   * *before* touching the rng, then feed the drawn data into
   * `sessionReducer`. Every hand plays `availableActions[0]`. When
   * `interleaveIgnored` is set, two kinds of doomed-to-be-ignored
   * attempts are made around the real decision: one with an action
   * that isn't available for the scenario, and one repeat decide while
   * feedback is already pending. Neither may draw from the rng, so the
   * resulting scenario sequence must come out identical either way.
   */
  function playSession(seed: number, interleaveIgnored: boolean): Scenario[] {
    const rng = createRng(seed);
    let state = createInitialSessionState();
    const scenarios: Scenario[] = [];

    for (let hand = 0; hand < 5 && state.run.status !== "over"; hand++) {
      const dealt = dealNextHandIfAllowed(state, rng, DEFAULT_RULES);
      if (!dealt) break;
      state = sessionReducer(state, { type: "deal", scenario: dealt.scenario, holeCard: dealt.holeCard });
      const scenario = state.scenario!;
      scenarios.push(scenario);

      if (interleaveIgnored) {
        const unavailable = ALL_ACTIONS.find((action) => !scenario.availableActions.includes(action));
        if (unavailable) {
          expect(resolveActionIfAllowed(state, unavailable, rng, DEFAULT_RULES)).toBeNull();
        }
      }

      const action = scenario.availableActions[0];
      const resolution = resolveActionIfAllowed(state, action, rng, DEFAULT_RULES);
      if (!resolution) break;
      state = sessionReducer(state, { type: "decide", action, resolution, decidedAt: `${hand}` });

      if (interleaveIgnored) {
        expect(resolveActionIfAllowed(state, action, rng, DEFAULT_RULES)).toBeNull();
      }
    }

    return scenarios;
  }

  it("produces identical scenarios for the same seed, with or without interleaved ignored decisions", () => {
    const withoutIgnored = playSession(42, false);
    const withIgnored = playSession(42, true);

    expect(withoutIgnored.length).toBeGreaterThan(0);
    expect(withIgnored).toEqual(withoutIgnored);
  });
});
