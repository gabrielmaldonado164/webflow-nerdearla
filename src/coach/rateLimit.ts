import type { Client } from "@libsql/client";

export const DAILY_COACH_LIMIT = 20;

/** A single conditional UPSERT is atomic in SQLite, including competing serverless invocations. */
export async function reserveCoachCall(
  db: Client,
  playerId: string,
  date: string,
  limit = DAILY_COACH_LIMIT,
): Promise<boolean> {
  const result = await db.execute({
    sql: `INSERT INTO coach_usage (player_id, date, count) VALUES (?1, ?2, 1)
     ON CONFLICT(player_id, date) DO UPDATE SET count = count + 1
     WHERE count < ?3`,
    args: [playerId, date, limit],
  });
  return result.rowsAffected === 1;
}

/**
 * Refunds a previously reserved slot for a provider failure that happened
 * before any text was delivered. Conditional on `count > 0` so a refund
 * can never take the counter negative, even under concurrent calls.
 */
export async function releaseCoachCall(
  db: Client,
  playerId: string,
  date: string,
): Promise<void> {
  await db.execute({
    sql: `UPDATE coach_usage SET count = count - 1
     WHERE player_id = ?1 AND date = ?2 AND count > 0`,
    args: [playerId, date],
  });
}

export interface CoachUsage {
  limit: number;
  used: number;
  remaining: number;
}

/** Reads today's usage for a player without mutating it. No row means unused. */
export async function getCoachUsage(
  db: Client,
  playerId: string,
  date: string,
  limit = DAILY_COACH_LIMIT,
): Promise<CoachUsage> {
  const result = await db.execute({
    sql: `SELECT count FROM coach_usage WHERE player_id = ?1 AND date = ?2`,
    args: [playerId, date],
  });
  const used = Number(result.rows[0]?.count ?? 0);
  return { limit, used, remaining: Math.max(0, limit - used) };
}
