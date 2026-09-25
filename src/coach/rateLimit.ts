import type { D1Database } from "@cloudflare/workers-types";

export const DAILY_COACH_LIMIT = 20;

/** A single conditional UPSERT is atomic in SQLite, including competing Workers. */
export async function reserveCoachCall(
  db: D1Database,
  playerId: string,
  date: string,
  limit = DAILY_COACH_LIMIT,
): Promise<boolean> {
  const result = await db.prepare(
    `INSERT INTO coach_usage (player_id, date, count) VALUES (?1, ?2, 1)
     ON CONFLICT(player_id, date) DO UPDATE SET count = count + 1
     WHERE count < ?3`,
  ).bind(playerId, date, limit).run();
  return (result.meta.changes ?? 0) === 1;
}
