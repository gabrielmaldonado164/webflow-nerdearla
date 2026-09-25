import { describe, expect, it, vi } from "vitest";

import { DAILY_COACH_LIMIT } from "@/coach/rateLimit";

import type { CoachUsageHandlerDeps, CoachUsageHandlerRepo } from "./handler";
import { handleCoachUsageRequest } from "./handler";

const VALID_PLAYER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const TODAY = "2026-09-24";

function fakeRepo(
  usage: { limit: number; used: number; remaining: number } = { limit: DAILY_COACH_LIMIT, used: 0, remaining: DAILY_COACH_LIMIT },
): CoachUsageHandlerRepo & { calls: Array<{ playerId: string; date: string }> } {
  const calls: Array<{ playerId: string; date: string }> = [];
  return {
    calls,
    async getCoachUsage(playerId, date) {
      calls.push({ playerId, date });
      return usage;
    },
  };
}

function baseDeps(overrides: Partial<CoachUsageHandlerDeps> = {}): CoachUsageHandlerDeps {
  return {
    readCookie: () => undefined,
    today: () => TODAY,
    repo: fakeRepo(),
    ...overrides,
  };
}

describe("handleCoachUsageRequest", () => {
  it("returns the full default limit and calls the repo zero times when there is no cookie", async () => {
    const repo = fakeRepo();
    const deps = baseDeps({ readCookie: () => undefined, repo });

    const result = await handleCoachUsageRequest(deps);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ limit: DAILY_COACH_LIMIT, used: 0, remaining: DAILY_COACH_LIMIT });
    expect(repo.calls).toHaveLength(0);
  });

  it("returns the full default limit and calls the repo zero times for a tampered/invalid cookie", async () => {
    const repo = fakeRepo();
    const deps = baseDeps({ readCookie: () => "not-a-uuid", repo });

    const result = await handleCoachUsageRequest(deps);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ limit: DAILY_COACH_LIMIT, used: 0, remaining: DAILY_COACH_LIMIT });
    expect(repo.calls).toHaveLength(0);
  });

  it("never sets a cookie, even implicitly, for any response", async () => {
    const deps = baseDeps({ readCookie: () => VALID_PLAYER_ID, repo: fakeRepo() });

    const result = await handleCoachUsageRequest(deps);

    expect(result).not.toHaveProperty("setCookie");
  });

  it("returns the repo's usage for a valid cookie, querying today's date for that exact player id", async () => {
    const repo = fakeRepo({ limit: 20, used: 12, remaining: 8 });
    const deps = baseDeps({ readCookie: () => VALID_PLAYER_ID, repo });

    const result = await handleCoachUsageRequest(deps);

    expect(result.status).toBe(200);
    expect(repo.calls).toEqual([{ playerId: VALID_PLAYER_ID, date: TODAY }]);
    expect(result.body).toEqual({ limit: 20, used: 12, remaining: 8 });
  });

  it("returns 503 with a generic body and logs when the repo throws", async () => {
    const repo: CoachUsageHandlerRepo = {
      getCoachUsage: vi.fn().mockRejectedValue(new Error("D1 unavailable: secret-dsn")),
    };
    const deps = baseDeps({ readCookie: () => VALID_PLAYER_ID, repo });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await handleCoachUsageRequest(deps);

    expect(result.status).toBe(503);
    expect((result.body as { error: string }).error).not.toContain("secret-dsn");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
