import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

import { getDb } from "@/db/client";
import { healthChecks } from "@/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();

  await db.insert(healthChecks).values({ createdAt: new Date().toISOString() });

  const rows = await db.select().from(healthChecks).orderBy(desc(healthChecks.id));

  return NextResponse.json({
    ok: true,
    count: rows.length,
    latest: rows[0] ?? null,
  });
}
