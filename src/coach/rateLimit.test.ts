import { describe, expect, it, vi } from "vitest";

import { reserveCoachCall } from "./rateLimit";

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
