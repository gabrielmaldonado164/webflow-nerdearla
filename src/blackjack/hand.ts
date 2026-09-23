/**
 * Hand value and classification for the blackjack domain.
 */

import type { Card } from "./cards";
import { rankValue } from "./cards";

export interface HandValue {
  total: number;
  /** True while at least one Ace is still counted as 11. */
  isSoft: boolean;
}

/**
 * Computes a blackjack total from raw card values (Aces counted high, as 11).
 * Reduces Aces from 11 to 1 one at a time until the total is 21 or below,
 * or there are no more Aces left to reduce.
 */
export function totalFromValues(values: readonly number[]): HandValue {
  let total = values.reduce((sum, value) => sum + value, 0);
  let softAces = values.filter((value) => value === 11).length;

  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }

  return { total, isSoft: softAces > 0 };
}

export function handValue(cards: readonly Card[]): HandValue {
  return totalFromValues(cards.map((card) => rankValue(card.rank)));
}

export function isBlackjack(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function isBust(cards: readonly Card[]): boolean {
  return handValue(cards).total > 21;
}

/**
 * A pair is defined by blackjack value, not rank: a King and a Queen
 * are a pair of 10s.
 */
export function isPair(cards: readonly Card[]): boolean {
  return (
    cards.length === 2 && rankValue(cards[0].rank) === rankValue(cards[1].rank)
  );
}
