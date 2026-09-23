/**
 * Shared types for the practice feature. `DecisionRecord` is the seam for
 * Phase 2b persistence: `usePracticeSession` hands one of these to an
 * optional `onDecision` callback after every decision, so a later API call
 * can plug in without changing the hook's public shape.
 */

import type { Action, Card, ScenarioCategory } from "@/blackjack";

export interface DecisionRecord {
  playerCards: Card[];
  dealerUpcard: Card;
  availableActions: Action[];
  userAction: Action;
  optimalAction: Action;
  isCorrect: boolean;
  category: ScenarioCategory;
  label: string;
  /** ISO 8601 timestamp of when the decision was made. */
  decidedAt: string;
}
