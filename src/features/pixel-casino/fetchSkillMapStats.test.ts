import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlayerStats } from "@/player/playerStats";

import { fetchSkillMapStats } from "./fetchSkillMapStats";

const VALID_STATS: PlayerStats = {
  totalDecisions: 3,
  correctDecisions: 2,
  accuracy: 67,
  currentStreak: 1,
  bestStreak: 2,
  categoryStats: {
    hard: { category: "hard", attempts: 3, correct: 2, accuracy: 67 },
    soft: { category: "soft", attempts: 0, correct: 0, accuracy: null },
    pair: { category: "pair", attempts: 0, correct: 0, accuracy: null },
  },
  strongestCategory: null,
  weakestCategory: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fetchSkillMapStats", () => {
  it("GETs /api/stats with same-origin credentials and returns the parsed body on success", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", undefined);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ stats: VALID_STATS, achievements: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSkillMapStats();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/stats");
    expect(init.credentials).toBe("same-origin");
    expect(result).toEqual({ stats: VALID_STATS, achievements: [] });
  });

  it("returns null on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "boom" }), { status: 500 })));
    expect(await fetchSkillMapStats()).toBeNull();
  });

  it("returns null when the response body doesn't match the expected shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ nope: true }), { status: 200 })));
    expect(await fetchSkillMapStats()).toBeNull();
  });

  it("returns null when the response body isn't valid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 200 })));
    expect(await fetchSkillMapStats()).toBeNull();
  });

  it("returns null when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchSkillMapStats()).toBeNull();
  });

  it("returns null when fetch throws synchronously", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("network down");
      }),
    );
    expect(await fetchSkillMapStats()).toBeNull();
  });
});
