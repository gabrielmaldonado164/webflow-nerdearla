import { describe, expect, it, vi } from "vitest";

import { generateDailyScenarios, type DailyResult } from "@/training/dailyChallenge";

import { handleGetDaily, handlePostDaily, type DailyHandlerDeps } from "./handler";

const PLAYER = "123e4567-e89b-42d3-a456-426614174000";
const DATE = "2026-09-25";

function makeDeps(cookie?: string): DailyHandlerDeps {
  let saved: DailyResult | null = null;
  return {
    readCookie: () => cookie,
    newId: () => PLAYER,
    now: () => new Date("2026-09-25T12:00:00Z"),
    secure: true,
    repo: {
      getOrCreateChallenge: vi.fn(async () => generateDailyScenarios(DATE)),
      getResult: vi.fn(async () => saved),
      ensurePlayer: vi.fn(async () => {}),
      saveResult: vi.fn(async (_id, result) => { saved ??= result; return saved!; }),
    },
  };
}

describe("daily API handlers", () => {
  it("GET returns public hands without minting a cookie", async () => {
    const deps = makeDeps();
    const response = await handleGetDaily(deps);
    expect(response.status).toBe(200);
    expect(response.setCookie).toBeUndefined();
    expect(response.body.date).toBe(DATE);
    expect(response.body.scenarios).toHaveLength(10);
    expect((response.body.scenarios as object[])[0]).not.toHaveProperty("optimalAction");
    expect(deps.repo.getResult).not.toHaveBeenCalled();
  });

  it("POST rejects forged fields and incomplete, illegal, or future results without identity writes", async () => {
    const deps = makeDeps();
    const valid = { date: DATE, actions: generateDailyScenarios(DATE).map((s) => s.optimalAction), durationMs: 1000 };
    for (const body of [
      { ...valid, score: 10 },
      { ...valid, date: "2026-09-26" },
      { ...valid, actions: valid.actions.slice(0, 1) },
      { ...valid, durationMs: -1 },
    ]) {
      expect((await handlePostDaily(JSON.stringify(body), deps)).status).toBe(400);
    }
    expect(deps.repo.ensurePlayer).not.toHaveBeenCalled();
    expect(deps.repo.saveResult).not.toHaveBeenCalled();
  });

  it("POST regrades, sets the cookie, and returns the first saved result on retry", async () => {
    const deps = makeDeps();
    const actions = generateDailyScenarios(DATE).map((s) => s.optimalAction);
    const first = await handlePostDaily(JSON.stringify({ date: DATE, actions, durationMs: 1000 }), deps);
    const retry = await handlePostDaily(JSON.stringify({ date: DATE, actions, durationMs: 2000 }), deps);
    expect(first.status).toBe(200);
    expect(first.setCookie?.value).toBe(PLAYER);
    expect(first.body.result).toEqual({ date: DATE, score: 10, attempts: 10, accuracy: 100, durationMs: 1000 });
    expect(retry.body.result).toEqual(first.body.result);
  });

  it("reuses an existing valid player and preserves its cookie after a result-write failure", async () => {
    const deps = makeDeps(PLAYER);
    deps.repo.saveResult = vi.fn(async () => { throw new Error("D1 unavailable"); });
    const actions = generateDailyScenarios(DATE).map((s) => s.optimalAction);
    const response = await handlePostDaily(JSON.stringify({ date: DATE, actions, durationMs: 500 }), deps);
    expect(response.status).toBe(500);
    expect(response.setCookie?.value).toBe(PLAYER);
    expect(response.body).toEqual({ error: "daily challenge unavailable" });
  });

  it("allows a completed yesterday challenge only during the UTC grace window", async () => {
    const deps = makeDeps();
    deps.now = () => new Date("2026-09-26T00:14:00Z");
    const actions = generateDailyScenarios(DATE).map((s) => s.optimalAction);
    expect((await handlePostDaily(JSON.stringify({ date: DATE, actions, durationMs: 500 }), deps)).status).toBe(200);
    deps.now = () => new Date("2026-09-26T00:15:00Z");
    expect((await handlePostDaily(JSON.stringify({ date: DATE, actions, durationMs: 500 }), deps)).status).toBe(400);
  });
});
