import { describe, expect, it, vi } from "vitest";

import type { DecisionRow } from "@/player/recordDecision";
import { computePlayerStats } from "@/player/playerStats";
import { deriveAchievements } from "@/player/achievements";

import type { StatsHandlerDeps, StatsHandlerRepo } from "./handler";
import { handleStatsRequest } from "./handler";

const VALID_PLAYER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

const SAMPLE_DECISION: DecisionRow = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  playerId: VALID_PLAYER_ID,
  playerCards: [
    { rank: "10", suit: "spades" },
    { rank: "6", suit: "hearts" },
  ],
  dealerUpcard: { rank: "9", suit: "clubs" },
  availableActions: ["hit", "stand", "double"],
  userAction: "hit",
  optimalAction: "hit",
  isCorrect: true,
  category: "hard",
  createdAt: "2026-09-23T12:00:00.000Z",
};

function fakeRepo(decisions: DecisionRow[] = []): StatsHandlerRepo & {
  listPlayerDecisionsCalls: string[];
} {
  const listPlayerDecisionsCalls: string[] = [];
  return {
    listPlayerDecisionsCalls,
    async listPlayerDecisions(playerId) {
      listPlayerDecisionsCalls.push(playerId);
      return decisions;
    },
  };
}

function baseDeps(overrides: Partial<StatsHandlerDeps> = {}): StatsHandlerDeps {
  return {
    readCookie: () => undefined,
    repo: fakeRepo(),
    ...overrides,
  };
}

describe("handleStatsRequest", () => {
  it("returns 200 with empty stats and calls the repo zero times when there is no cookie", async () => {
    const repo = fakeRepo();
    const deps = baseDeps({ readCookie: () => undefined, repo });

    const result = await handleStatsRequest(deps);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ stats: computePlayerStats([]), achievements: deriveAchievements([]) });
    expect(repo.listPlayerDecisionsCalls).toHaveLength(0);
  });

  it("returns 200 with empty stats and calls the repo zero times for a tampered/invalid cookie", async () => {
    const repo = fakeRepo();
    const deps = baseDeps({ readCookie: () => "not-a-uuid", repo });

    const result = await handleStatsRequest(deps);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ stats: computePlayerStats([]), achievements: deriveAchievements([]) });
    expect(repo.listPlayerDecisionsCalls).toHaveLength(0);
  });

  it("never sets a cookie, even implicitly, for any response", async () => {
    const deps = baseDeps({ readCookie: () => VALID_PLAYER_ID, repo: fakeRepo([SAMPLE_DECISION]) });

    const result = await handleStatsRequest(deps);

    expect(result).not.toHaveProperty("setCookie");
  });

  it("returns computed stats and achievements for a valid cookie, querying the repo for that exact player id", async () => {
    const decisions = [SAMPLE_DECISION, { ...SAMPLE_DECISION, id: "other-id", isCorrect: false }];
    const repo = fakeRepo(decisions);
    const deps = baseDeps({ readCookie: () => VALID_PLAYER_ID, repo });

    const result = await handleStatsRequest(deps);

    expect(result.status).toBe(200);
    expect(repo.listPlayerDecisionsCalls).toEqual([VALID_PLAYER_ID]);
    expect(result.body).toEqual({
      stats: computePlayerStats(decisions),
      achievements: deriveAchievements(decisions),
    });
  });

  it("returns 200 with empty-history stats and achievements for a valid cookie with no persisted decisions", async () => {
    const deps = baseDeps({ readCookie: () => VALID_PLAYER_ID, repo: fakeRepo([]) });

    const result = await handleStatsRequest(deps);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ stats: computePlayerStats([]), achievements: deriveAchievements([]) });
  });

  it("returns 500 with a generic body, no stack, and logs when the repo throws", async () => {
    const repo: StatsHandlerRepo = {
      listPlayerDecisions: vi.fn().mockRejectedValue(new Error("D1 unavailable: secret-dsn")),
    };
    const deps = baseDeps({ readCookie: () => VALID_PLAYER_ID, repo });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await handleStatsRequest(deps);

    expect(result.status).toBe(500);
    expect((result.body as { error: string }).error).not.toContain("secret-dsn");
    expect(result.body).not.toHaveProperty("stack");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
