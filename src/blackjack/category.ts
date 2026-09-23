/**
 * Classifies a two-or-more card player hand into the strategy-relevant
 * scenario category used for training and stats.
 */

import type { Card } from "./cards";
import { rankValue } from "./cards";
import { handValue, isPair } from "./hand";

export type ScenarioCategory = "hard" | "soft" | "pair";

export interface ScenarioClassification {
  category: ScenarioCategory;
  /** Human-readable label, e.g. "Hard 16", "Soft 18", "Pair of 8s". */
  label: string;
}

function pairLabel(value: number): string {
  if (value === 11) return "Pair of Aces";
  if (value === 10) return "Pair of 10s";
  return `Pair of ${value}s`;
}

/**
 * A pair takes precedence over hard/soft whenever splitting is actually
 * available for the hand (exactly two cards of equal value).
 */
export function classifyScenario(playerCards: readonly Card[]): ScenarioClassification {
  if (isPair(playerCards)) {
    const value = rankValue(playerCards[0].rank);
    return { category: "pair", label: pairLabel(value) };
  }

  const { total, isSoft } = handValue(playerCards);
  if (isSoft) {
    return { category: "soft", label: `Soft ${total}` };
  }
  return { category: "hard", label: `Hard ${total}` };
}
