/**
 * Actions available to the player at a given decision point.
 */

import type { Card } from "./cards";
import { isPair } from "./hand";
import type { GameRules } from "./rules";

export type Action = "hit" | "stand" | "double" | "split";

export interface ActionContext {
  /** True when this hand is the result of a split. */
  isAfterSplit?: boolean;
}

/**
 * Returns the actions the player may take on the given hand.
 * - "double" requires exactly two cards, and is gated by
 *   `doubleOnAnyFirstTwo` (first hand) or `doubleAfterSplit` (split hand).
 * - "split" requires exactly two cards of the same value, and is never
 *   available after a split (no resplitting in v1).
 */
export function availableActions(
  cards: readonly Card[],
  rules: GameRules,
  context: ActionContext = {},
): Action[] {
  const isAfterSplit = context.isAfterSplit ?? false;
  const actions: Action[] = ["hit", "stand"];

  const canDouble =
    cards.length === 2 &&
    (isAfterSplit ? rules.doubleAfterSplit : rules.doubleOnAnyFirstTwo);
  if (canDouble) {
    actions.push("double");
  }

  const canSplit = cards.length === 2 && !isAfterSplit && isPair(cards);
  if (canSplit) {
    actions.push("split");
  }

  return actions;
}
