import { describe, expect, it } from "vitest";

import type { Card, ResolveStep } from "@/blackjack";
import type { SessionFeedback } from "@/features/practice/sessionReducer";

import { planImmediateCue, planTimedReveal } from "./revealPlan";
import { buildRevealSchedule, type RevealTiming } from "./revealSchedule";

const CARD: Card = { rank: "7", suit: "diamonds" };
const TIMING: RevealTiming = { cardMs: 100, flipMs: 200, outcomeDelayMs: 50 };

function playerStep(handIndex = 0): ResolveStep {
  return { actor: "player", handIndex, card: CARD };
}

function dealerStep(): ResolveStep {
  return { actor: "dealer", handIndex: 0, card: CARD };
}

function buildFeedback(overrides: Partial<SessionFeedback> = {}): SessionFeedback {
  return {
    isCorrect: true,
    title: "Perfect move",
    message: "Nice!",
    userAction: "hit",
    optimalAction: "hit",
    resolution: {
      playerHands: [{ cards: [CARD], total: 17, doubled: false, busted: false, outcome: "win" }],
      dealerCards: [CARD, CARD],
      dealerTotal: 22,
      dealerBusted: true,
      steps: [playerStep(), dealerStep()],
    },
    ...overrides,
  } as SessionFeedback;
}

describe("planTimedReveal", () => {
  it("returns no steps when there is no feedback yet", () => {
    expect(planTimedReveal(null, false, TIMING)).toEqual([]);
  });

  it("returns no steps once the run is over (game-over freeze: no reveals, banners, or sounds)", () => {
    const feedback = buildFeedback();
    expect(planTimedReveal(feedback, true, TIMING)).toEqual([]);
  });

  it("matches buildRevealSchedule's timings for each step, the hole-card flip, and the outcome, with the current sound cues", () => {
    const feedback = buildFeedback({
      resolution: {
        ...buildFeedback().resolution,
        steps: [playerStep(), dealerStep()],
        playerHands: [{ cards: [CARD], total: 20, doubled: false, busted: false, outcome: "win" }],
      },
    });
    const schedule = buildRevealSchedule(feedback.resolution.steps, TIMING);

    const plan = planTimedReveal(feedback, false, TIMING);

    expect(plan).toEqual([
      { kind: "step", index: 0, atMs: schedule.stepRevealAt[0], sound: "deal" },
      { kind: "step", index: 1, atMs: schedule.stepRevealAt[1], sound: "deal" },
      { kind: "hole", atMs: schedule.holeCardFlipAt, sound: "flip" },
      { kind: "outcome", atMs: schedule.outcomeAt, sound: "win" },
    ]);
  });

  it("plays the push cue when every hand pushes", () => {
    const feedback = buildFeedback({
      resolution: {
        ...buildFeedback().resolution,
        steps: [],
        playerHands: [{ cards: [CARD], total: 20, doubled: false, busted: false, outcome: "push" }],
      },
    });
    const plan = planTimedReveal(feedback, false, TIMING);
    expect(plan.at(-1)).toMatchObject({ kind: "outcome", sound: "push" });
  });

  it("plays the lose cue when no hand wins or pushes", () => {
    const feedback = buildFeedback({
      resolution: {
        ...buildFeedback().resolution,
        steps: [],
        playerHands: [{ cards: [CARD], total: 24, doubled: false, busted: true, outcome: "lose" }],
      },
    });
    const plan = planTimedReveal(feedback, false, TIMING);
    expect(plan.at(-1)).toMatchObject({ kind: "outcome", sound: "lose" });
  });

  it("plays the win cue when any hand wins even if another pushes (split)", () => {
    const feedback = buildFeedback({
      resolution: {
        ...buildFeedback().resolution,
        steps: [],
        playerHands: [
          { cards: [CARD], total: 20, doubled: false, busted: false, outcome: "push" },
          { cards: [CARD], total: 21, doubled: false, busted: false, outcome: "win" },
        ],
      },
    });
    const plan = planTimedReveal(feedback, false, TIMING);
    expect(plan.at(-1)).toMatchObject({ kind: "outcome", sound: "win" });
  });
});

describe("planImmediateCue", () => {
  it("plays nothing with no feedback", () => {
    expect(planImmediateCue(null, false)).toEqual({ sound: null, vibrate: false });
  });

  it("plays the correct cue and never vibrates on a correct decision", () => {
    const feedback = buildFeedback({ isCorrect: true });
    expect(planImmediateCue(feedback, false)).toEqual({ sound: "correct", vibrate: false });
  });

  it("plays the mistake cue and vibrates on a wrong decision that doesn't end the run", () => {
    const feedback = buildFeedback({ isCorrect: false });
    expect(planImmediateCue(feedback, false)).toEqual({ sound: "mistake", vibrate: true });
  });

  it("swaps the mistake cue for silence once the run is over, but still vibrates (game over replaces the mistake cue)", () => {
    const feedback = buildFeedback({ isCorrect: false });
    expect(planImmediateCue(feedback, true)).toEqual({ sound: null, vibrate: true });
  });
});
