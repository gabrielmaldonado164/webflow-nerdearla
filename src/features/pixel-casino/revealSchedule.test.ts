import { describe, expect, it } from "vitest";

import type { Card, ResolveStep } from "@/blackjack";

import {
  buildRevealSchedule,
  INSTANT_REVEAL_TIMING,
  isHoleCardRevealed,
  isOutcomeRevealed,
  isStepRevealed,
  type RevealTiming,
} from "./revealSchedule";

const CARD: Card = { rank: "7", suit: "diamonds" };

const TIMING: RevealTiming = { cardMs: 100, flipMs: 200, outcomeDelayMs: 50 };

function playerStep(handIndex = 0): ResolveStep {
  return { actor: "player", handIndex, card: CARD };
}

function dealerStep(): ResolveStep {
  return { actor: "dealer", handIndex: 0, card: CARD };
}

describe("buildRevealSchedule", () => {
  it("flips the hole card immediately and shows the outcome after the flip, with no steps at all", () => {
    const schedule = buildRevealSchedule([], TIMING);
    expect(schedule.stepRevealAt).toEqual([]);
    expect(schedule.holeCardFlipAt).toBe(0);
    expect(schedule.outcomeAt).toBe(TIMING.flipMs + TIMING.outcomeDelayMs);
    expect(schedule.totalMs).toBe(schedule.outcomeAt);
  });

  it("reveals player-only steps in order, then flips the hole card after them", () => {
    const steps = [playerStep(), playerStep()];
    const schedule = buildRevealSchedule(steps, TIMING);

    expect(schedule.stepRevealAt).toEqual([0, TIMING.cardMs]);
    expect(schedule.holeCardFlipAt).toBe(TIMING.cardMs * 2);
    expect(schedule.outcomeAt).toBe(TIMING.cardMs * 2 + TIMING.flipMs + TIMING.outcomeDelayMs);
  });

  it("flips the hole card before the first dealer step when both player and dealer steps exist", () => {
    const steps = [playerStep(), dealerStep(), dealerStep()];
    const schedule = buildRevealSchedule(steps, TIMING);

    // Player step at t=0.
    expect(schedule.stepRevealAt[0]).toBe(0);
    // Hole card flips right after the player step, before any dealer step.
    expect(schedule.holeCardFlipAt).toBe(TIMING.cardMs);
    // Dealer steps land after the flip.
    expect(schedule.stepRevealAt[1]).toBe(TIMING.cardMs + TIMING.flipMs);
    expect(schedule.stepRevealAt[2]).toBe(TIMING.cardMs + TIMING.flipMs + TIMING.cardMs);
    expect(schedule.outcomeAt).toBe(schedule.stepRevealAt[2] + TIMING.cardMs + TIMING.outcomeDelayMs);
  });

  it("flips the hole card before dealer-only steps (e.g. the player stood)", () => {
    const steps = [dealerStep(), dealerStep()];
    const schedule = buildRevealSchedule(steps, TIMING);

    expect(schedule.holeCardFlipAt).toBe(0);
    expect(schedule.stepRevealAt).toEqual([TIMING.flipMs, TIMING.flipMs + TIMING.cardMs]);
  });

  it("collapses every offset to zero under INSTANT_REVEAL_TIMING (reduced motion)", () => {
    const steps = [playerStep(), dealerStep(), dealerStep()];
    const schedule = buildRevealSchedule(steps, INSTANT_REVEAL_TIMING);

    expect(schedule.stepRevealAt.every((at) => at === 0)).toBe(true);
    expect(schedule.holeCardFlipAt).toBe(0);
    expect(schedule.outcomeAt).toBe(0);
  });

  it("uses the default timing when none is given", () => {
    expect(() => buildRevealSchedule([playerStep()])).not.toThrow();
  });
});

describe("reveal predicates", () => {
  const steps = [playerStep(), dealerStep()];
  const schedule = buildRevealSchedule(steps, TIMING);

  it("isStepRevealed is true exactly once elapsed reaches that step's offset", () => {
    expect(isStepRevealed(schedule, 0, 0)).toBe(true);
    expect(isStepRevealed(schedule, 1, schedule.stepRevealAt[1] - 1)).toBe(false);
    expect(isStepRevealed(schedule, 1, schedule.stepRevealAt[1])).toBe(true);
  });

  it("isHoleCardRevealed follows holeCardFlipAt", () => {
    expect(isHoleCardRevealed(schedule, schedule.holeCardFlipAt - 1)).toBe(false);
    expect(isHoleCardRevealed(schedule, schedule.holeCardFlipAt)).toBe(true);
  });

  it("isOutcomeRevealed follows outcomeAt", () => {
    expect(isOutcomeRevealed(schedule, schedule.outcomeAt - 1)).toBe(false);
    expect(isOutcomeRevealed(schedule, schedule.outcomeAt)).toBe(true);
  });
});
