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

/**
 * Refunds a previously reserved slot for a provider failure that happened
 * before any text was delivered. Conditional on `count > 0` so a refund
 * can never take the counter negative, even under concurrent calls.
 */
export async function releaseCoachCall(
  db: D1Database,
  playerId: string,
  date: string,
): Promise<void> {
  await db.prepare(
    `UPDATE coach_usage SET count = count - 1
     WHERE player_id = ?1 AND date = ?2 AND count > 0`,
  ).bind(playerId, date).run();
}

export interface CoachUsage {
  limit: number;
  used: number;
  remaining: number;
}

/** Reads today's usage for a player without mutating it. No row means unused. */
export async function getCoachUsage(
  db: D1Database,
  playerId: string,
  date: string,
  limit = DAILY_COACH_LIMIT,
): Promise<CoachUsage> {
  const row = await db.prepare(
    `SELECT count FROM coach_usage WHERE player_id = ?1 AND date = ?2`,
  ).bind(playerId, date).first<{ count: number }>();
  const used = row?.count ?? 0;
  return { limit, used, remaining: Math.max(0, limit - used) };
}
