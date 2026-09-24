import { afterEach, describe, expect, it, vi } from "vitest";

import type { Card } from "@/blackjack";

import { sendDecision } from "./sendDecision";
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
  vi.unstubAllGlobals();
});

describe("sendDecision", () => {
  it("posts JSON to /api/decisions with keepalive and same-origin credentials", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    sendDecision(RECORD);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/decisions");
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      playerCards: RECORD.playerCards,
      dealerUpcard: RECORD.dealerUpcard,
      userAction: RECORD.userAction,
    });
  });

  it("does not throw and does not block when fetch rejects", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(() => sendDecision(RECORD)).not.toThrow();
  });

  it("does not throw when fetch itself throws synchronously", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("network down");
      }),
    );
    expect(() => sendDecision(RECORD)).not.toThrow();
  });

  it("swallows a rejected fetch without an unhandled rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    sendDecision(RECORD);
    // Let the rejection's .catch handler settle.
    await Promise.resolve();
    await Promise.resolve();
  });
});
