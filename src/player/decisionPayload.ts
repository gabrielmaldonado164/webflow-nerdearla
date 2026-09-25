/**
 * Structural parsing/validation for an untrusted `POST /api/decisions`
 * request body (wired in Phase 2b T2): checks shape and that every card
 * rank/suit and the user action are known values. Game-legality
 * validation (e.g. whether the action is actually available on this
 * hand) is `recordDecision`'s job, since it needs the engine.
 */

import type { Action, Card, Rank, Suit } from "@/blackjack";
import { RANKS, SUITS } from "@/blackjack";

export interface DecisionPayload {
  playerCards: Card[];
  dealerUpcard: Card;
  userAction: Action;
}

export type ParseDecisionPayloadResult =
  | { ok: true; value: DecisionPayload }
  | { ok: false; reason: string };

const KNOWN_ACTIONS: readonly Action[] = ["hit", "stand", "double", "split"];

function isKnownCard(value: unknown): value is Card {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { rank, suit } = value as Record<string, unknown>;
  return (
    typeof rank === "string" &&
    typeof suit === "string" &&
    RANKS.includes(rank as Rank) &&
    SUITS.includes(suit as Suit)
  );
}

function isKnownAction(value: unknown): value is Action {
  return typeof value === "string" && KNOWN_ACTIONS.includes(value as Action);
}

/**
 * Parses and validates a raw (`JSON.parse`d) request body. Never trusts
 * anything about `raw`'s shape: an unknown card rank/suit, a malformed
 * card, an unknown action, or fewer than two player cards is rejected.
 */
export function parseDecisionPayload(raw: unknown): ParseDecisionPayloadResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: "payload must be a JSON object" };
  }

  const { playerCards, dealerUpcard, userAction } = raw as Record<string, unknown>;

  if (!Array.isArray(playerCards) || playerCards.length < 2) {
    return { ok: false, reason: "playerCards must be an array of at least two cards" };
  }
  if (!playerCards.every(isKnownCard)) {
    return { ok: false, reason: "playerCards contains an unknown or malformed card" };
  }
  if (!isKnownCard(dealerUpcard)) {
    return { ok: false, reason: "dealerUpcard is not a known card" };
  }
  if (!isKnownAction(userAction)) {
    return { ok: false, reason: "userAction is not a known action" };
  }

  return {
    ok: true,
    value: {
      playerCards: playerCards as Card[],
      dealerUpcard: dealerUpcard as Card,
      userAction: userAction as Action,
    },
  };
}
