import { describe, expect, it, vi } from "vitest";

import { DAILY_COACH_LIMIT, getCoachUsage, releaseCoachCall, reserveCoachCall } from "./rateLimit";

type Db = Parameters<typeof reserveCoachCall>[0];

function fakeClient(execute: ReturnType<typeof vi.fn>): Db {
  return { execute } as unknown as Db;
}

describe("reserveCoachCall", () => {
  it("uses one conditional SQLite UPSERT and observes its affected-row count", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rowsAffected: 1, rows: [] }).mockResolvedValueOnce({ rowsAffected: 0, rows: [] });
    const db = fakeClient(execute);

    expect(await reserveCoachCall(db, "player", "2026-09-24", 20)).toBe(true);
    expect(await reserveCoachCall(db, "player", "2026-09-24", 20)).toBe(false);
    const stmt = execute.mock.calls[0][0];
    expect(stmt.sql).toContain("coach_usage");
    expect(stmt.sql).toContain("WHERE count < ?3");
    expect(stmt.args).toEqual(["player", "2026-09-24", 20]);
  });
});

describe("releaseCoachCall", () => {
  it("uses one conditional UPDATE that never decrements below zero", async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1, rows: [] });
    const db = fakeClient(execute);

    await releaseCoachCall(db, "player", "2026-09-24");

    expect(execute).toHaveBeenCalledTimes(1);
    const stmt = execute.mock.calls[0][0];
    expect(stmt.sql).toContain("coach_usage");
    expect(stmt.sql).toContain("count > 0");
    expect(stmt.args).toEqual(["player", "2026-09-24"]);
  });
});

describe("getCoachUsage", () => {
  it("returns limit/used/remaining derived from the stored count", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ count: 12 }], rowsAffected: 0 });
    const db = fakeClient(execute);

    const result = await getCoachUsage(db, "player", "2026-09-24", 20);

    const stmt = execute.mock.calls[0][0];
    expect(stmt.sql).toContain("coach_usage");
    expect(stmt.args).toEqual(["player", "2026-09-24"]);
    expect(result).toEqual({ limit: 20, used: 12, remaining: 8 });
  });

  it("defaults used to 0 and remaining to the limit when there is no row", async () => {
    const db = fakeClient(vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }));

    const result = await getCoachUsage(db, "player", "2026-09-24");

    expect(result).toEqual({ limit: DAILY_COACH_LIMIT, used: 0, remaining: DAILY_COACH_LIMIT });
  });

  it("never returns a negative remaining when used exceeds the limit", async () => {
    const db = fakeClient(vi.fn().mockResolvedValue({ rows: [{ count: 25 }], rowsAffected: 0 }));

    const result = await getCoachUsage(db, "player", "2026-09-24", 20);

    expect(result).toEqual({ limit: 20, used: 25, remaining: 0 });
  });
});
