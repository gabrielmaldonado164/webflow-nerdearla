/**
 * Monte Carlo expected-value (EV) simulation for a player decision.
 *
 * Deck model: this uses an infinite-deck approximation for every draw
 * made during simulation (dealer cards, player hit/split cards): each
 * draw independently has probability 1/13 for each rank 2-9, 4/13 for
 * a ten-value card, and 1/13 for an Ace. This ignores shoe depletion,
 * which is a standard and accurate simplification for basic-strategy
 * EV estimates with a 6-deck shoe (removing a handful of cards barely
 * shifts a 312-card shoe's composition).
 *
 * After the requested first action, the player continues optimally
 * (via `optimalAction`): a "hit" keeps hitting/standing/doubling per
 * strategy, split hands are played out individually with DAS, and
 * split Aces receive exactly one card each and stop. The dealer draws
 * to 17 and stands on soft 17. Because a real dealer peeks for
 * blackjack, whenever the upcard is an Ace or a ten-value card the
 * hole card is resampled until the dealer does NOT have blackjack
 * (this mirrors "the round never happens" for those cases, matching
 * `scenario.ts` skipping player blackjacks: the whole 3:2 payout case
 * is out of scope for this per-decision EV, which is normalized to
 * profit per unit of the original bet).
 */

import type { Action } from "./actions";
import { availableActions } from "./actions";
import type { Card, Rank } from "./cards";
import { rankValue } from "./cards";
import { handValue, isBust, totalFromValues } from "./hand";
import type { GameRules } from "./rules";
import { optimalAction } from "./strategy";

export interface SimulateEvOptions {
  rng: () => number;
  rules: GameRules;
  iterations: number;
}

export interface SimulateEvResult {
  action: Action;
  ev: number;
  iterations: number;
}

/** Draws a raw blackjack value (2-10, or 11 for an Ace) from an infinite deck. */
function drawRawValue(rng: () => number): number {
  const roll = rng() * 13;
  if (roll < 8) return 2 + Math.floor(roll); // 2..9, 8 outcomes
  if (roll < 12) return 10; // ten-value, 4 outcomes
  return 11; // Ace
}

function rawValueToRank(value: number): Rank {
  if (value === 11) return "A";
  if (value === 10) return "10";
  return String(value) as Rank;
}

function drawSyntheticCard(rng: () => number): Card {
  return { rank: rawValueToRank(drawRawValue(rng)), suit: "spades" };
}

/** Plays out the dealer's hand from its upcard, respecting the peek rule. */
function playDealerHand(rng: () => number, upcardValue: number, rules: GameRules): number {
  let holeValue = drawRawValue(rng);
  if (rules.dealerPeeksForBlackjack && (upcardValue === 10 || upcardValue === 11)) {
    while (
      (upcardValue === 11 && holeValue === 10) ||
      (upcardValue === 10 && holeValue === 11)
    ) {
      holeValue = drawRawValue(rng);
    }
  }

  let values = [upcardValue, holeValue];
  let { total, isSoft } = totalFromValues(values);
  while (total < 17 || (total === 17 && isSoft && !rules.dealerStandsOnSoft17)) {
    values = [...values, drawRawValue(rng)];
    ({ total, isSoft } = totalFromValues(values));
  }
  return total;
}

/** Plays a hand to completion by repeatedly following `optimalAction`. */
function playHandOptimally(
  cards: Card[],
  dealerUpcard: Card,
  rng: () => number,
  rules: GameRules,
  isAfterSplit: boolean,
): { cards: Card[]; multiplier: number } {
  let current = cards;
  for (;;) {
    const action = optimalAction(current, dealerUpcard, rules, { isAfterSplit });
    if (action === "stand") {
      return { cards: current, multiplier: 1 };
    }
    if (action === "double") {
      return { cards: [...current, drawSyntheticCard(rng)], multiplier: 2 };
    }
    // "hit" (and defensively "split", which optimalAction never returns here
    // since isAfterSplit blocks it, or the hand already has more than 2 cards)
    current = [...current, drawSyntheticCard(rng)];
    if (isBust(current)) {
      return { cards: current, multiplier: 1 };
    }
  }
}

/** Applies the player's chosen first action, then continues optimally if needed. */
function applyFirstAction(
  cards: Card[],
  dealerUpcard: Card,
  rng: () => number,
  rules: GameRules,
  action: Action,
): { cards: Card[]; multiplier: number } {
  if (action === "stand") {
    return { cards, multiplier: 1 };
  }
  if (action === "double") {
    return { cards: [...cards, drawSyntheticCard(rng)], multiplier: 2 };
  }
  // action === "hit"
  const hitCards = [...cards, drawSyntheticCard(rng)];
  if (isBust(hitCards)) {
    return { cards: hitCards, multiplier: 1 };
  }
  return playHandOptimally(hitCards, dealerUpcard, rng, rules, false);
}

function outcomeVsDealer(playerTotal: number, dealerTotal: number): number {
  if (playerTotal > 21) return -1;
  if (dealerTotal > 21) return 1;
  if (playerTotal > dealerTotal) return 1;
  if (playerTotal < dealerTotal) return -1;
  return 0;
}

function playSplitHands(
  playerCards: readonly Card[],
  dealerUpcard: Card,
  rng: () => number,
  rules: GameRules,
): Array<{ cards: Card[]; multiplier: number }> {
  const value = rankValue(playerCards[0].rank);
  const isAceSplit = value === 11;

  return playerCards.map((startCard) => {
    const secondCard = drawSyntheticCard(rng);
    const initial = [startCard, secondCard];
    if (isAceSplit && rules.splitAcesReceiveOneCardEach) {
      return { cards: initial, multiplier: 1 };
    }
    return playHandOptimally(initial, dealerUpcard, rng, rules, true);
  });
}

/**
 * Runs a Monte Carlo simulation of the given first action's EV, expressed
 * as profit per unit of the original bet (a double counts 2x, a split
 * sums the profit of both resulting hands).
 */
export function simulateEV(
  playerCards: readonly Card[],
  dealerUpcard: Card,
  action: Action,
  options: SimulateEvOptions,
): SimulateEvResult {
  const { rng, rules, iterations } = options;
  const dealerUpValue = rankValue(dealerUpcard.rank);

  let totalProfit = 0;
  for (let i = 0; i < iterations; i++) {
    const dealerTotal = playDealerHand(rng, dealerUpValue, rules);

    if (action === "split") {
      const hands = playSplitHands(playerCards, dealerUpcard, rng, rules);
      for (const hand of hands) {
        const total = handValue(hand.cards).total;
        totalProfit += outcomeVsDealer(total, dealerTotal) * hand.multiplier;
      }
    } else {
      const result = applyFirstAction(
        [...playerCards],
        dealerUpcard,
        rng,
        rules,
        action,
      );
      const total = handValue(result.cards).total;
      totalProfit += outcomeVsDealer(total, dealerTotal) * result.multiplier;
    }
  }

  return { action, ev: totalProfit / iterations, iterations };
}

/**
 * Runs `simulateEV` for every action currently available on the hand,
 * consuming the same RNG stream across actions (fully deterministic
 * given a seeded RNG).
 */
export function simulateAllActions(
  playerCards: readonly Card[],
  dealerUpcard: Card,
  options: SimulateEvOptions,
): SimulateEvResult[] {
  const actions = availableActions(playerCards, options.rules);
  return actions.map((action) => simulateEV(playerCards, dealerUpcard, action, options));
}
