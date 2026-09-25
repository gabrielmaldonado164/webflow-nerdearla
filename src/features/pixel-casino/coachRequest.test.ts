import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCoachEvidence, streamCoachReply, type CoachHand } from "./coachRequest";

const hand: CoachHand = {
  playerCards: [{ rank: "10", suit: "spades" }, { rank: "6", suit: "hearts" }],
  dealerUpcard: { rank: "10", suit: "clubs" },
  availableActions: ["hit", "stand", "double"],
  userAction: "stand",
};

afterEach(() => vi.unstubAllGlobals());

describe("coach requests", () => {
  it("fetches server-simulated EV without depending on the AI stream", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      optimalAction: "hit",
      ev: [{ action: "hit", ev: -0.5, iterations: 1000 }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const result = await fetchCoachEvidence(hand, new AbortController().signal);
    expect(result?.optimalAction).toBe("hit");
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/api/coach/evidence"), expect.objectContaining({
      credentials: "same-origin",
      body: JSON.stringify(hand),
    }));
  });

  it("rejects malformed evidence instead of drawing a misleading chart", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      optimalAction: "hit", ev: [{ action: "hit", ev: "not a number", iterations: 1000 }],
    }))));
    expect(await fetchCoachEvidence(hand, new AbortController().signal)).toBeNull();
  });

  it("accumulates streamed text and reports completion", async () => {
    const encoder = new TextEncoder();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("The dealer "));
        controller.enqueue(encoder.encode("has ten."));
        controller.close();
      },
    }))));
    const updates: string[] = [];
    const result = await streamCoachReply({ mode: "why", hand }, new AbortController().signal, (text) => updates.push(text));
    expect(result).toBe(true);
    expect(updates.at(-1)).toBe("The dealer has ten.");
  });

  it("lets the UI use its template when the provider is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    expect(await streamCoachReply({ mode: "why", hand }, new AbortController().signal, vi.fn())).toBe(false);
  });
});
