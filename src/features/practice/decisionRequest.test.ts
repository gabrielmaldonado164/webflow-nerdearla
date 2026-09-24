import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildDecisionRequest", () => {
  it("targets /api/decisions with no base path configured", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", undefined);
    const request = buildDecisionRequest(RECORD);
    expect(request.url).toBe("/api/decisions");
  });

  it("prefixes the URL with NEXT_PUBLIC_BASE_PATH when set", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/mount");
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

  it("restores an originally-unset NEXT_PUBLIC_BASE_PATH as truly undefined, not the string \"undefined\"", () => {
    // Regression guard for a real bug: naively restoring with
    // `process.env.X = originalValue` coerces `undefined` to the
    // string "undefined" (env vars are always strings), which then
    // leaks into every later test/module that reads this var. This
    // test runs after other tests in this file have already mutated
    // and "restored" NEXT_PUBLIC_BASE_PATH via afterEach, so it
    // exercises the actual cleanup path, not just a fresh state.
    expect(process.env.NEXT_PUBLIC_BASE_PATH).toBeUndefined();
  });
});
