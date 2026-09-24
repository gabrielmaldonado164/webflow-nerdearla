import { afterEach, describe, expect, it } from "vitest";

import type { Card } from "@/blackjack";

import { buildDecisionRequest } from "./decisionRequest";
import type { DecisionRecord } from "./types";

function card(rank: Card["rank"], suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

const RECORD: DecisionRecord = {
  playerCards: [card("10"), card("6")],
  dealerUpcard: card("10"),
  availableActions: ["hit", "stand", "double"],
  userAction: "hit",
  optimalAction: "hit",
  isCorrect: true,
  category: "hard",
  label: "Hard 16",
  decidedAt: "2026-09-23T12:00:00.000Z",
};

const ORIGINAL_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH;

afterEach(() => {
  process.env.NEXT_PUBLIC_BASE_PATH = ORIGINAL_BASE_PATH;
});

describe("buildDecisionRequest", () => {
  it("targets /api/decisions with no base path configured", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    const request = buildDecisionRequest(RECORD);
    expect(request.url).toBe("/api/decisions");
  });

  it("prefixes the URL with NEXT_PUBLIC_BASE_PATH when set", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/mount";
    const request = buildDecisionRequest(RECORD);
    expect(request.url).toBe("/mount/api/decisions");
  });

  it("sends only the fields the server re-grades from", () => {
    const request = buildDecisionRequest(RECORD);
    expect(JSON.parse(request.body)).toEqual({
      playerCards: RECORD.playerCards,
      dealerUpcard: RECORD.dealerUpcard,
      userAction: RECORD.userAction,
    });
  });

  it("never includes client-computed grading fields in the body", () => {
    const request = buildDecisionRequest(RECORD);
    const parsed = JSON.parse(request.body) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty("availableActions");
    expect(parsed).not.toHaveProperty("optimalAction");
    expect(parsed).not.toHaveProperty("isCorrect");
    expect(parsed).not.toHaveProperty("category");
    expect(parsed).not.toHaveProperty("label");
    expect(parsed).not.toHaveProperty("decidedAt");
  });
});
