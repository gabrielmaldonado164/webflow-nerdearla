import { describe, expect, it } from "vitest";

import type { Card } from "@/blackjack";
import type { DecisionRow } from "@/player/recordDecision";

import { decisionRowFromSelectValues, decisionRowToInsertValues } from "./decisionsRepository";

function card(rank: Card["rank"], suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

const ROW: DecisionRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  playerId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  playerCards: [card("10"), card("6")],
  dealerUpcard: card("9"),
  availableActions: ["hit", "stand", "double"],
  userAction: "hit",
  optimalAction: "hit",
  isCorrect: true,
  category: "hard",
  createdAt: "2026-09-23T12:00:00.000Z",
};

describe("decisionRowToInsertValues", () => {
  it("JSON-encodes playerCards, dealerUpcard, and availableActions", () => {
    const values = decisionRowToInsertValues(ROW);

    expect(values.playerCards).toBe(JSON.stringify(ROW.playerCards));
    expect(values.dealerUpcard).toBe(JSON.stringify(ROW.dealerUpcard));
    expect(values.availableActions).toBe(JSON.stringify(ROW.availableActions));
    expect(JSON.parse(values.playerCards)).toEqual(ROW.playerCards);
    expect(JSON.parse(values.dealerUpcard)).toEqual(ROW.dealerUpcard);
    expect(JSON.parse(values.availableActions)).toEqual(ROW.availableActions);
  });

  it("passes scalar fields through unchanged", () => {
    const values = decisionRowToInsertValues(ROW);

    expect(values.id).toBe(ROW.id);
    expect(values.playerId).toBe(ROW.playerId);
    expect(values.userAction).toBe(ROW.userAction);
    expect(values.optimalAction).toBe(ROW.optimalAction);
    expect(values.isCorrect).toBe(ROW.isCorrect);
    expect(values.category).toBe(ROW.category);
    expect(values.createdAt).toBe(ROW.createdAt);
  });

  it("round-trips a false isCorrect value (not just truthy passthrough)", () => {
    const values = decisionRowToInsertValues({ ...ROW, isCorrect: false });
    expect(values.isCorrect).toBe(false);
  });
});

describe("decisionRowFromSelectValues", () => {
  it("decodes the JSON text columns back into structured fields", () => {
    const selectValues = decisionRowToInsertValues(ROW);

    const row = decisionRowFromSelectValues(selectValues);

    expect(row.playerCards).toEqual(ROW.playerCards);
    expect(row.dealerUpcard).toEqual(ROW.dealerUpcard);
    expect(row.availableActions).toEqual(ROW.availableActions);
  });

  it("passes scalar fields through unchanged", () => {
    const selectValues = decisionRowToInsertValues(ROW);

    const row = decisionRowFromSelectValues(selectValues);

    expect(row.id).toBe(ROW.id);
    expect(row.playerId).toBe(ROW.playerId);
    expect(row.userAction).toBe(ROW.userAction);
    expect(row.optimalAction).toBe(ROW.optimalAction);
    expect(row.isCorrect).toBe(ROW.isCorrect);
    expect(row.category).toBe(ROW.category);
    expect(row.createdAt).toBe(ROW.createdAt);
  });

  it("round-trips a false isCorrect value", () => {
    const selectValues = decisionRowToInsertValues({ ...ROW, isCorrect: false });

    const row = decisionRowFromSelectValues(selectValues);

    expect(row.isCorrect).toBe(false);
  });

  it("is the exact inverse of decisionRowToInsertValues for a full row", () => {
    const roundTripped = decisionRowFromSelectValues(decisionRowToInsertValues(ROW));
    expect(roundTripped).toEqual(ROW);
  });
});
