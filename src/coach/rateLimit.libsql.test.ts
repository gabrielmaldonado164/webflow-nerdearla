import { createClient, type Client } from "@libsql/client";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getCoachUsage, releaseCoachCall, reserveCoachCall } from "./rateLimit";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");
const DATE = "2026-09-24";

async function applyMigrations(db: Client): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    for (const statement of readFileSync(join(MIGRATIONS_DIR, file), "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) await db.execute(statement);
    }
  }
}

describe("coach rate limiter on a real in-memory libSQL database", () => {
  let db: Client;

  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    await applyMigrations(db);
    await db.execute({ sql: "INSERT INTO players (id, created_at) VALUES (?1, ?2)", args: ["p1", DATE] });
  });

  afterEach(() => db.close());

  it("reserves up to the limit, then refuses", async () => {
    expect(await reserveCoachCall(db, "p1", DATE, 2)).toBe(true);
    expect(await reserveCoachCall(db, "p1", DATE, 2)).toBe(true);
    expect(await reserveCoachCall(db, "p1", DATE, 2)).toBe(false);
    expect(await getCoachUsage(db, "p1", DATE, 2)).toEqual({ limit: 2, used: 2, remaining: 0 });
  });

  it("release refunds a slot but never goes below zero", async () => {
    await reserveCoachCall(db, "p1", DATE, 2);
    await releaseCoachCall(db, "p1", DATE);
    await releaseCoachCall(db, "p1", DATE);
    expect(await getCoachUsage(db, "p1", DATE, 2)).toEqual({ limit: 2, used: 0, remaining: 2 });
    expect(await reserveCoachCall(db, "p1", DATE, 2)).toBe(true);
  });

  it("reports an unused player as zero and isolates dates", async () => {
    expect(await getCoachUsage(db, "p1", DATE, 5)).toEqual({ limit: 5, used: 0, remaining: 5 });
    await reserveCoachCall(db, "p1", DATE, 1);
    expect(await reserveCoachCall(db, "p1", "2026-09-25", 1)).toBe(true);
  });
});
