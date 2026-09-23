/**
 * Basic strategy for the v1 ruleset (6 decks, S17, double any two,
 * DAS, no surrender). Encoded as data tables, looked up by dealer
 * upcard, instead of nested conditionals.
 */

import type { Action } from "./actions";
import type { Card } from "./cards";
import { rankValue } from "./cards";
import { handValue, isPair } from "./hand";
import type { GameRules } from "./rules";

/** Dealer upcard value, 2-10 or Ace. */
export type DealerUpcardValue = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | "A";

/** Raw strategy codes before double/split availability is applied. */
type StrategyCode = "H" | "S" | "D" | "Ds" | "P";

export interface StrategyContext {
  /** True when this hand is the result of a split. */
  isAfterSplit?: boolean;
}

export function dealerUpcardValue(card: Card): DealerUpcardValue {
  return card.rank === "A" ? "A" : (rankValue(card.rank) as DealerUpcardValue);
}

function isIn(value: DealerUpcardValue, group: readonly number[]): boolean {
  return typeof value === "number" && group.includes(value);
}

/** Hard-total strategy: totals 4-21 (2-8 all hit, 9-16 as tabulated, 17+ stand). */
function hardAction(total: number, upcard: DealerUpcardValue): StrategyCode {
  if (total <= 8) return "H";
  if (total === 9) return isIn(upcard, [3, 4, 5, 6]) ? "D" : "H";
  if (total === 10) return isIn(upcard, [2, 3, 4, 5, 6, 7, 8, 9]) ? "D" : "H";
  if (total === 11) return upcard === "A" ? "H" : "D";
  if (total === 12) return isIn(upcard, [4, 5, 6]) ? "S" : "H";
  if (total >= 13 && total <= 16) return isIn(upcard, [2, 3, 4, 5, 6]) ? "S" : "H";
  return "S"; // 17+
}

/** Soft-total strategy: keyed by total (A2=13 ... A9=20). */
function softAction(total: number, upcard: DealerUpcardValue): StrategyCode {
  if (total === 13 || total === 14) return isIn(upcard, [5, 6]) ? "D" : "H";
  if (total === 15 || total === 16) return isIn(upcard, [4, 5, 6]) ? "D" : "H";
  if (total === 17) return isIn(upcard, [3, 4, 5, 6]) ? "D" : "H";
  if (total === 18) {
    if (isIn(upcard, [3, 4, 5, 6])) return "Ds";
    if (isIn(upcard, [2, 7, 8])) return "S";
    return "H"; // 9, 10, A
  }
  if (total >= 19) return "S"; // 19, 20 (and 21 defensively)
  return "H"; // soft totals below 13 (e.g. A-A before it is treated as a pair)
}

/** Pair value, 2-10 (10-value ranks collapse to 10) or 11 for a pair of Aces. */
function pairValue(cards: readonly Card[]): number {
  return rankValue(cards[0].rank);
}

/**
 * Pair strategy (assumes splitting is available). 5-5 is deliberately not
 * handled here: it is never split, and the caller falls back to the hard-10
 * table instead.
 */
function pairAction(value: number, upcard: DealerUpcardValue): StrategyCode {
  if (value === 2 || value === 3) return isIn(upcard, [2, 3, 4, 5, 6, 7]) ? "P" : "H";
  if (value === 4) return isIn(upcard, [5, 6]) ? "P" : "H";
  if (value === 6) return isIn(upcard, [2, 3, 4, 5, 6]) ? "P" : "H";
  if (value === 7) return isIn(upcard, [2, 3, 4, 5, 6, 7]) ? "P" : "H";
  if (value === 8) return "P";
  if (value === 9) return isIn(upcard, [2, 3, 4, 5, 6, 8, 9]) ? "P" : "S";
  if (value === 10) return "S";
  return "P"; // value === 11, pair of Aces
}

function codeToAction(code: StrategyCode, canDouble: boolean): Action {
  switch (code) {
    case "H":
      return "hit";
    case "S":
      return "stand";
    case "D":
      return canDouble ? "double" : "hit";
    case "Ds":
      return canDouble ? "double" : "stand";
    case "P":
      return "split";
  }
}

/**
 * Returns the basic-strategy action for the given hand, using EXACTLY the
 * v1 strategy table. Falls back from split/double to the underlying
 * hard/soft table whenever those actions are not actually available
 * (e.g. a 3-card 11 falls back from "double" to "hit").
 */
export function optimalAction(
  playerCards: readonly Card[],
  dealerUpcard: Card,
  rules: GameRules,
  context: StrategyContext = {},
): Action {
  const isAfterSplit = context.isAfterSplit ?? false;
  const canDouble =
    playerCards.length === 2 &&
    (isAfterSplit ? rules.doubleAfterSplit : rules.doubleOnAnyFirstTwo);
  const canSplit = playerCards.length === 2 && !isAfterSplit && isPair(playerCards);
  const upcard = dealerUpcardValue(dealerUpcard);

  if (canSplit) {
    const value = pairValue(playerCards);
    if (value === 5) {
      // 5-5 is never split: play it as a hard 10.
      return codeToAction(hardAction(10, upcard), canDouble);
    }
    const code = pairAction(value, upcard);
    if (code === "P") {
      return "split";
    }
    return codeToAction(code, canDouble);
  }

  const { total, isSoft } = handValue(playerCards);
  const code = isSoft ? softAction(total, upcard) : hardAction(total, upcard);
  return codeToAction(code, canDouble);
}
