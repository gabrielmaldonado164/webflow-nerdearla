import { describe, expect, it, vi } from "vitest";

import type { CoachStreamHandlerDeps, CoachUsageSnapshot } from "./handler";
import { handleCoachStreamRequest } from "./handler";

const HAND = {
  playerCards: [{ rank: "10", suit: "spades" }, { rank: "6", suit: "hearts" }],
  dealerUpcard: { rank: "10", suit: "clubs" },
  availableActions: ["hit", "stand", "double"],
  userAction: "stand",
};

const WHY_BODY = JSON.stringify({ mode: "why", ...HAND });
const PROVIDER = { apiKey: "key", model: "model" };

function usage(remaining: number): CoachUsageSnapshot {
  return { limit: 20, used: 20 - remaining, remaining };
}

/** Async iterable yielding the given chunks, one per `next()` call. */
function textStream(...chunks: string[]): AsyncIterable<string> {
  let i = 0;
  return {
    [Symbol.asyncIterator]() {
      return {
        next: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined }),
      };
    },
  };
}

function baseDeps(overrides: Partial<CoachStreamHandlerDeps> = {}): CoachStreamHandlerDeps {
  return {
    readCookie: () => undefined,
    resolvePlayerId: () => ({ playerId: "player-1" }),
    today: () => "2026-09-24",
    secure: false,
    getProviderConfig: () => PROVIDER,
    repo: {
      ensurePlayer: vi.fn().mockResolvedValue(undefined),
      reserveCoachCall: vi.fn().mockResolvedValue(true),
      releaseCoachCall: vi.fn().mockResolvedValue(undefined),
      getCoachUsage: vi.fn().mockResolvedValue(usage(17)),
    },
    startCoachStream: vi.fn().mockResolvedValue(textStream("hello", " there")),
    ...overrides,
  };
}

describe("handleCoachStreamRequest", () => {
  it("rejects invalid JSON with 400 and makes no reservation", async () => {
    const deps = baseDeps();
    const result = await handleCoachStreamRequest("not json", deps);
    expect(result).toEqual({ kind: "error", status: 400, body: { error: "invalid JSON body" } });
    expect(deps.repo.reserveCoachCall).not.toHaveBeenCalled();
  });

  it("rejects a structurally invalid body with 400", async () => {
    const deps = baseDeps();
    const result = await handleCoachStreamRequest(JSON.stringify({ mode: "nonsense" }), deps);
    expect(result.kind).toBe("error");
    expect((result as { status: number }).status).toBe(400);
    expect(deps.repo.reserveCoachCall).not.toHaveBeenCalled();
  });

  it("returns 503 with no reservation when the provider/runtime is unavailable", async () => {
    const deps = baseDeps({ getProviderConfig: () => null });
    const result = await handleCoachStreamRequest(WHY_BODY, deps);
    expect(result).toEqual({ kind: "error", status: 503, body: { error: "coach unavailable" } });
    expect(deps.repo.reserveCoachCall).not.toHaveBeenCalled();
  });

  it("returns 429 with remaining 0 and no refund when the daily limit is reached", async () => {
    const deps = baseDeps({
      repo: {
        ensurePlayer: vi.fn().mockResolvedValue(undefined),
        reserveCoachCall: vi.fn().mockResolvedValue(false),
        releaseCoachCall: vi.fn().mockResolvedValue(undefined),
        getCoachUsage: vi.fn().mockResolvedValue(usage(0)),
      },
    });
    const result = await handleCoachStreamRequest(WHY_BODY, deps);
    expect(result).toEqual({ kind: "error", status: 429, body: { error: "daily coach limit reached", remaining: 0 } });
    expect(deps.repo.releaseCoachCall).not.toHaveBeenCalled();
    expect(deps.startCoachStream).not.toHaveBeenCalled();
  });

  it("returns 503 with no reservation-related cookie when reserving throws", async () => {
    const deps = baseDeps({
      repo: {
        ensurePlayer: vi.fn().mockResolvedValue(undefined),
        reserveCoachCall: vi.fn().mockRejectedValue(new Error("db down")),
        releaseCoachCall: vi.fn().mockResolvedValue(undefined),
        getCoachUsage: vi.fn().mockResolvedValue(usage(17)),
      },
    });
    const result = await handleCoachStreamRequest(WHY_BODY, deps);
    expect(result).toEqual({ kind: "error", status: 503, body: { error: "coach unavailable" } });
  });

  it("sets X-Coach-Remaining-equivalent data and a cookie on a successful stream", async () => {
    const deps = baseDeps();
    const result = await handleCoachStreamRequest(WHY_BODY, deps);
    expect(result.kind).toBe("stream");
    if (result.kind !== "stream") throw new Error("expected a stream result");
    expect(result.remaining).toBe(17);
    expect(result.first).toBe("hello");
    expect(result.setCookie).toMatchObject({ name: "lab_player", value: "player-1" });
    const next = await result.iterator.next();
    expect(next).toEqual({ done: false, value: " there" });
  });

  it("refunds and returns the post-refund remaining on a provider throw before any text", async () => {
    const releaseCoachCall = vi.fn().mockResolvedValue(undefined);
    const getCoachUsage = vi.fn()
      .mockResolvedValueOnce(usage(17)) // post-reservation read
      .mockResolvedValueOnce(usage(18)); // post-refund read
    const deps = baseDeps({
      repo: {
        ensurePlayer: vi.fn().mockResolvedValue(undefined),
        reserveCoachCall: vi.fn().mockResolvedValue(true),
        releaseCoachCall,
        getCoachUsage,
      },
      startCoachStream: vi.fn().mockRejectedValue(new Error("provider down")),
    });
    const result = await handleCoachStreamRequest(WHY_BODY, deps);
    expect(result).toEqual({
      kind: "error",
      status: 503,
      body: { error: "coach unavailable", remaining: 18 },
      setCookie: expect.objectContaining({ name: "lab_player", value: "player-1" }),
    });
    expect(releaseCoachCall).toHaveBeenCalledWith("player-1", "2026-09-24");
  });

  it("refunds and returns 503 when the stream yields no text at all", async () => {
    const getCoachUsage = vi.fn()
      .mockResolvedValueOnce(usage(17))
      .mockResolvedValueOnce(usage(18));
    const deps = baseDeps({
      repo: {
        ensurePlayer: vi.fn().mockResolvedValue(undefined),
        reserveCoachCall: vi.fn().mockResolvedValue(true),
        releaseCoachCall: vi.fn().mockResolvedValue(undefined),
        getCoachUsage,
      },
      startCoachStream: vi.fn().mockResolvedValue(textStream()),
    });
    const result = await handleCoachStreamRequest(WHY_BODY, deps);
    expect(result).toEqual({
      kind: "error",
      status: 503,
      body: { error: "coach unavailable", remaining: 18 },
      setCookie: expect.objectContaining({ name: "lab_player", value: "player-1" }),
    });
  });

  it("does not refund a stream interrupted after the first chunk was delivered", async () => {
    const releaseCoachCall = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      repo: {
        ensurePlayer: vi.fn().mockResolvedValue(undefined),
        reserveCoachCall: vi.fn().mockResolvedValue(true),
        releaseCoachCall,
        getCoachUsage: vi.fn().mockResolvedValue(usage(17)),
      },
      startCoachStream: vi.fn().mockResolvedValue(textStream("first chunk")),
    });
    const result = await handleCoachStreamRequest(WHY_BODY, deps);
    expect(result.kind).toBe("stream");
    if (result.kind !== "stream") throw new Error("expected a stream result");
    // Simulate the route draining the rest of the stream and hitting an
    // error mid-way: the handler already committed to "stream" and must
    // not be involved in refunding at that point.
    expect(releaseCoachCall).not.toHaveBeenCalled();
  });

  it("does not leak the reserved slot or 503 when the post-reserve usage read fails", async () => {
    const deps = baseDeps({
      repo: {
        ensurePlayer: vi.fn().mockResolvedValue(undefined),
        reserveCoachCall: vi.fn().mockResolvedValue(true),
        releaseCoachCall: vi.fn().mockResolvedValue(undefined),
        getCoachUsage: vi.fn().mockRejectedValue(new Error("read failed")),
      },
    });
    const result = await handleCoachStreamRequest(WHY_BODY, deps);
    expect(result.kind).toBe("stream");
    if (result.kind !== "stream") throw new Error("expected a stream result");
    expect(result.remaining).toBeNull();
    expect(deps.repo.releaseCoachCall).not.toHaveBeenCalled();
  });

  it("sets the cookie after reservation succeeds even when the stream later fails", async () => {
    const deps = baseDeps({
      startCoachStream: vi.fn().mockRejectedValue(new Error("boom")),
    });
    const result = await handleCoachStreamRequest(WHY_BODY, deps);
    expect(result.setCookie).toMatchObject({ name: "lab_player", value: "player-1" });
  });
});
