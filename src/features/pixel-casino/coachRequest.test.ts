import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCoachEvidence, fetchCoachUsage, streamCoachReply, type CoachHand } from "./coachRequest";

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

  it("accumulates streamed text and reports the remaining quota from the header", async () => {
    const encoder = new TextEncoder();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("The dealer "));
        controller.enqueue(encoder.encode("has ten."));
        controller.close();
      },
    }), { status: 200, headers: { "X-Coach-Remaining": "17" } })));
    const updates: string[] = [];
    const result = await streamCoachReply({ mode: "why", hand }, new AbortController().signal, (text) => updates.push(text));
    expect(result).toEqual({ kind: "ok", remaining: 17 });
    expect(updates.at(-1)).toBe("The dealer has ten.");
  });

  it("treats a malformed or missing remaining header as unknown", async () => {
    const encoder = new TextEncoder();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("hi"));
        controller.close();
      },
    }), { status: 200, headers: { "X-Coach-Remaining": "not-a-number" } })));
    const result = await streamCoachReply({ mode: "why", hand }, new AbortController().signal, vi.fn());
    expect(result).toEqual({ kind: "ok", remaining: null });
  });

  it("treats an empty stream on a 200 as unavailable, not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.close();
      },
    }), { status: 200, headers: { "X-Coach-Remaining": "12" } })));
    const result = await streamCoachReply({ mode: "why", hand }, new AbortController().signal, vi.fn());
    expect(result).toEqual({ kind: "unavailable", remaining: 12 });
  });

  it("reports a distinct limit outcome for a 429 with remaining 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "daily coach limit reached", remaining: 0,
    }), { status: 429 })));
    const result = await streamCoachReply({ mode: "why", hand }, new AbortController().signal, vi.fn());
    expect(result).toEqual({ kind: "limit", remaining: 0 });
  });

  it("lets the UI use its template when the provider is unavailable, keeping a refunded remaining count", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "coach unavailable", remaining: 9,
    }), { status: 503 })));
    const result = await streamCoachReply({ mode: "why", hand }, new AbortController().signal, vi.fn());
    expect(result).toEqual({ kind: "unavailable", remaining: 9 });
  });

  it("reports unavailable with a null remaining when a pre-reservation 503 omits it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "coach unavailable",
    }), { status: 503 })));
    const result = await streamCoachReply({ mode: "why", hand }, new AbortController().signal, vi.fn());
    expect(result).toEqual({ kind: "unavailable", remaining: null });
  });

  it("reports unavailable with a null remaining on a network error or abort", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await streamCoachReply({ mode: "why", hand }, new AbortController().signal, vi.fn());
    expect(result).toEqual({ kind: "unavailable", remaining: null });
  });
});

describe("fetchCoachUsage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the parsed usage on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      limit: 20, used: 8, remaining: 12,
    }), { status: 200 })));
    const result = await fetchCoachUsage(new AbortController().signal);
    expect(result).toEqual({ limit: 20, used: 8, remaining: 12 });
  });

  it("returns null on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "coach usage unavailable" }), { status: 503 })));
    expect(await fetchCoachUsage(new AbortController().signal)).toBeNull();
  });

  it("returns null on a malformed body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      limit: 20, used: "eight", remaining: 12,
    }), { status: 200 })));
    expect(await fetchCoachUsage(new AbortController().signal)).toBeNull();
  });

  it("returns null on a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await fetchCoachUsage(new AbortController().signal)).toBeNull();
  });
});
