/**
 * Records one accepted decision against an anonymous player (D2): always
 * re-grades server-side with the deterministic engine — a client-supplied
 * `availableActions`/`optimalAction`/`isCorrect`/`category` is never
 * trusted, only `playerCards` + `dealerUpcard` + `userAction` are.
 *
 * Rejects (without inserting) a `userAction` that isn't actually available
 * for the hand. Structural validation of cards/actions (unknown ranks,
 * suits, or action strings) happens one layer up, in
 * `parseDecisionPayload` — by the time `recordDecision` runs, `input` is
 * already known to be well-formed, just not necessarily *legal*.
 */

import type { Action, Card, ScenarioCategory } from "@/blackjack";
import { availableActions, classifyScenario, DEFAULT_RULES, optimalAction } from "@/blackjack";

import type { DecisionPayload } from "./decisionPayload";

export interface RecordDecisionInput extends DecisionPayload {
  playerId: string;
}

export interface DecisionRow {
  id: string;
  playerId: string;
  playerCards: Card[];
  dealerUpcard: Card;
  availableActions: Action[];
  userAction: Action;
  optimalAction: Action;
  isCorrect: boolean;
  category: ScenarioCategory;
  createdAt: string;
}

export interface DecisionRepository {
  insertDecision(row: DecisionRow): Promise<void>;
}

export type RecordDecisionResult =
  | { ok: true; row: DecisionRow }
  | { ok: false; reason: string };

/**
 * Re-grades `input` with the engine and, when the user's action was
 * actually available on that hand, inserts the resulting row via `repo`.
 *
 * An engine call throwing on unexpected input (a domain error — e.g. a
 * shape `parseDecisionPayload` didn't catch) is caught and returned as
 * `{ ok: false }`, same as a legal-but-unavailable action, so the route
 * can map it to a `400` instead of it bubbling up as a `500`. A
 * repository failure is NOT caught here: it still propagates (rejects)
 * so the caller (the API route) maps it to `500`.
 */
export async function recordDecision(
  input: RecordDecisionInput,
  repo: DecisionRepository,
): Promise<RecordDecisionResult> {
  let actions: Action[];
  let optimal: Action;
  let category: ScenarioCategory;
  try {
    actions = availableActions(input.playerCards, DEFAULT_RULES);
    if (!actions.includes(input.userAction)) {
      return {
        ok: false,
        reason: `"${input.userAction}" is not available for this hand`,
      };
    }

    optimal = optimalAction(input.playerCards, input.dealerUpcard, DEFAULT_RULES);
    ({ category } = classifyScenario(input.playerCards));
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "invalid decision input",
    };
  }

  const row: DecisionRow = {
    id: crypto.randomUUID(),
    playerId: input.playerId,
    playerCards: input.playerCards,
    dealerUpcard: input.dealerUpcard,
    availableActions: actions,
    userAction: input.userAction,
    optimalAction: optimal,
    isCorrect: input.userAction === optimal,
    category,
    createdAt: new Date().toISOString(),
  };

  await repo.insertDecision(row);

  return { ok: true, row };
}
