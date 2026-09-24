import { describe, expect, it, vi } from "vitest";

import { DAILY_COACH_LIMIT, getCoachUsage, releaseCoachCall, reserveCoachCall } from "./rateLimit";

describe("reserveCoachCall", () => {
  it("uses one conditional SQLite UPSERT and observes its affected-row count", async () => {
    const run = vi.fn().mockResolvedValueOnce({ meta: { changes: 1 } }).mockResolvedValueOnce({ meta: { changes: 0 } });
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn((query: string) => {
      expect(query).toContain("coach_usage");
      return { bind };
    });
    const db = { prepare } as unknown as Parameters<typeof reserveCoachCall>[0];

    expect(await reserveCoachCall(db, "player", "2026-09-24", 20)).toBe(true);
    expect(await reserveCoachCall(db, "player", "2026-09-24", 20)).toBe(false);
    expect(prepare.mock.calls[0][0]).toContain("WHERE count < ?3");
    expect(bind).toHaveBeenCalledWith("player", "2026-09-24", 20);
  });
});

describe("releaseCoachCall", () => {
  it("uses one conditional UPDATE that never decrements below zero", async () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn((query: string) => {
      expect(query).toContain("coach_usage");
      expect(query).toContain("count > 0");
      return { bind };
    });
    const db = { prepare } as unknown as Parameters<typeof releaseCoachCall>[0];

    await releaseCoachCall(db, "player", "2026-09-24");

    expect(bind).toHaveBeenCalledWith("player", "2026-09-24");
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("getCoachUsage", () => {
  it("returns limit/used/remaining derived from the stored count", async () => {
    const first = vi.fn().mockResolvedValue({ count: 12 });
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn((query: string) => {
      expect(query).toContain("coach_usage");
      return { bind };
    });
    const db = { prepare } as unknown as Parameters<typeof getCoachUsage>[0];

    const result = await getCoachUsage(db, "player", "2026-09-24", 20);

    expect(bind).toHaveBeenCalledWith("player", "2026-09-24");
    expect(result).toEqual({ limit: 20, used: 12, remaining: 8 });
  });

  it("defaults used to 0 and remaining to the limit when there is no row", async () => {
    const first = vi.fn().mockResolvedValue(null);
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as Parameters<typeof getCoachUsage>[0];

    const result = await getCoachUsage(db, "player", "2026-09-24");

    expect(result).toEqual({ limit: DAILY_COACH_LIMIT, used: 0, remaining: DAILY_COACH_LIMIT });
  });

  it("never returns a negative remaining when used exceeds the limit", async () => {
    const first = vi.fn().mockResolvedValue({ count: 25 });
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as Parameters<typeof getCoachUsage>[0];

    const result = await getCoachUsage(db, "player", "2026-09-24", 20);

    expect(result).toEqual({ limit: 20, used: 25, remaining: 0 });
  });
});
