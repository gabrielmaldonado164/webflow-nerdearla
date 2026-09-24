import { afterEach, describe, expect, it, vi } from "vitest";

import { DAILY_HAND_COUNT } from "@/training/dailyChallenge";
import { fetchDailyChallenge, submitDailyChallenge } from "./dailyChallengeRequest";

const scenario = {
  playerCards: [{ rank: "10", suit: "spades" }, { rank: "6", suit: "hearts" }],
  dealerUpcard: { rank: "10", suit: "clubs" },
  availableActions: ["hit", "stand", "double"],
  category: "hard",
  label: "Hard 16 vs 10",
};

afterEach(() => vi.unstubAllGlobals());

describe("daily challenge requests", () => {
  it("loads a complete fixed set with same-origin credentials", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      date: "2026-09-24", scenarios: Array.from({ length: DAILY_HAND_COUNT }, () => scenario), result: null,
    })));
    vi.stubGlobal("fetch", fetcher);
    const value = await fetchDailyChallenge(new AbortController().signal);
    expect(value?.scenarios).toHaveLength(DAILY_HAND_COUNT);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/api/daily"), expect.objectContaining({ credentials: "same-origin" }));
  });

  it("rejects malformed challenge payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      date: "2026-09-24", scenarios: [{ ...scenario, dealerUpcard: { rank: "14", suit: "clubs" } }], result: null,
    }))));
    expect(await fetchDailyChallenge(new AbortController().signal)).toBeNull();
  });

  it("sends only actions and duration, accepting only a valid server result", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      result: { date: "2026-09-24", score: 7, attempts: 10, accuracy: 70, durationMs: 12345 },
    })));
    vi.stubGlobal("fetch", fetcher);
    const result = await submitDailyChallenge("2026-09-24", ["hit"], 12345, new AbortController().signal);
    expect(result?.score).toBe(7);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/api/daily/results"), expect.objectContaining({
      credentials: "same-origin", body: JSON.stringify({ date: "2026-09-24", actions: ["hit"], durationMs: 12345 }),
    }));
  });

  it("keeps practice usable when persistence fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchDailyChallenge(new AbortController().signal)).toBeNull();
    expect(await submitDailyChallenge("2026-09-24", ["hit"], 100, new AbortController().signal)).toBeNull();
  });
});
