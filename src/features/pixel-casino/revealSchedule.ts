/**
 * Pure timing/sequencing for animating a resolved hand: when each
 * `ResolveStep` (an extra player or dealer card) becomes visible, when the
 * dealer's hole card flips face up, and when the per-hand outcome banners
 * should appear. Kept separate from the screen so the sequencing logic is
 * unit-testable without React or real timers.
 *
 * `resolveHand` already orders `steps` chronologically (every player step
 * before any dealer step — see `src/blackjack/resolve.ts`), so this only
 * has to insert the hole-card flip in the right place: right before the
 * first dealer step, or after every step when the player never forced a
 * dealer draw at all (e.g. they stood and busted isn't possible, but they
 * could still bust or double without dealer needing to draw... in every
 * real case there IS at least one dealer entry unless every player hand
 * busted, in which case the hole card still flips for reveal).
 */

import type { Card, ResolveStep } from "@/blackjack";

export interface RevealTiming {
  /** Milliseconds each dealt-card animation (player or dealer draw) takes. */
  cardMs: number;
  /** Milliseconds the hole-card 3D flip takes. */
  flipMs: number;
  /** Milliseconds to linger on the fully revealed board before showing the outcome banner(s). */
  outcomeDelayMs: number;
}

/** A relaxed, legible pace for the full reveal sequence. */
export const DEFAULT_REVEAL_TIMING: RevealTiming = {
  cardMs: 420,
  flipMs: 550,
  outcomeDelayMs: 300,
};

/** Every offset collapses to 0 — used under `prefers-reduced-motion`. */
export const INSTANT_REVEAL_TIMING: RevealTiming = {
  cardMs: 0,
  flipMs: 0,
  outcomeDelayMs: 0,
};

export interface RevealSchedule {
  /** Millisecond offset at which each entry of `steps` (same index) becomes visible. */
  stepRevealAt: number[];
  /** Millisecond offset at which the dealer's hole card flips face up. */
  holeCardFlipAt: number;
  /** Millisecond offset at which the outcome banner(s) should appear. */
  outcomeAt: number;
  /** Total duration of the whole sequence (equal to `outcomeAt`). */
  totalMs: number;
}

/**
 * Builds the reveal timeline for `steps`. The hole card flips right
 * before the first dealer step in the (already player-then-dealer
 * ordered) sequence, or after every step when there are no dealer steps
 * at all (every player hand busted, so the dealer never had to draw —
 * the hole card still needs to be shown for the outcome to make sense).
 */
export function buildRevealSchedule(
  steps: readonly ResolveStep[],
  timing: RevealTiming = DEFAULT_REVEAL_TIMING,
): RevealSchedule {
  const stepRevealAt: number[] = [];
  let t = 0;
  let holeCardFlipAt: number | null = null;

  for (const step of steps) {
    if (step.actor === "dealer" && holeCardFlipAt === null) {
      holeCardFlipAt = t;
      t += timing.flipMs;
    }
    stepRevealAt.push(t);
    t += timing.cardMs;
  }

  if (holeCardFlipAt === null) {
    holeCardFlipAt = t;
    t += timing.flipMs;
  }

  const outcomeAt = t + timing.outcomeDelayMs;
  return { stepRevealAt, holeCardFlipAt, outcomeAt, totalMs: outcomeAt };
}

export function isStepRevealed(schedule: RevealSchedule, index: number, elapsedMs: number): boolean {
  return elapsedMs >= schedule.stepRevealAt[index];
}

export function isHoleCardRevealed(schedule: RevealSchedule, elapsedMs: number): boolean {
  return elapsedMs >= schedule.holeCardFlipAt;
}

export function isOutcomeRevealed(schedule: RevealSchedule, elapsedMs: number): boolean {
  return elapsedMs >= schedule.outcomeAt;
}

/**
 * The cards of one player hand that should currently be shown: its
 * `initialCount` starting cards (2 dealt before the decision, or 1 for a
 * split hand), plus one more per revealed step that belongs to this hand
 * (`steps[i].actor === "player" && steps[i].handIndex === handIndex`,
 * among the first `revealedStepCount` steps).
 */
export function revealedHandCards(
  finalCards: readonly Card[],
  initialCount: number,
  handIndex: number,
  steps: readonly ResolveStep[],
  revealedStepCount: number,
): Card[] {
  let revealedExtra = 0;
  for (let i = 0; i < steps.length && i < revealedStepCount; i++) {
    if (steps[i].actor === "player" && steps[i].handIndex === handIndex) revealedExtra++;
  }
  return finalCards.slice(0, initialCount + revealedExtra);
}

/**
 * The dealer's currently-visible cards: the upcard always, the hole card
 * once `holeRevealed`, then one more draw per revealed dealer step among
 * the first `revealedStepCount` steps. `finalCards` is
 * `resolution.dealerCards` (`[upcard, holeCard, ...draws]`).
 */
export function revealedDealerCards(
  finalCards: readonly Card[],
  steps: readonly ResolveStep[],
  revealedStepCount: number,
  holeRevealed: boolean,
): Card[] {
  const cards: Card[] = [finalCards[0]];
  if (holeRevealed) cards.push(finalCards[1]);

  let revealedDraws = 0;
  for (let i = 0; i < steps.length && i < revealedStepCount; i++) {
    if (steps[i].actor === "dealer") revealedDraws++;
  }
  for (let k = 0; k < revealedDraws; k++) {
    cards.push(finalCards[2 + k]);
  }
  return cards;
}
