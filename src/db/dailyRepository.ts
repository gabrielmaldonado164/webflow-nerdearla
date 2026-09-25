import { and, eq } from "drizzle-orm";

import { generateDailyScenarios, type DailyResult, type CanonicalDailyScenario } from "@/training/dailyChallenge";
import { seedFromString } from "@/blackjack";

import type { getDb } from "./client";
import { dailyChallenges, dailyResults, players } from "./schema";

type Db = ReturnType<typeof getDb>;

/** Insert-once/read-back ensures concurrent callers see the same canonical set. */
export async function getOrCreateDailyChallenge(db: Db, date: string): Promise<CanonicalDailyScenario[]> {
  const scenarios = generateDailyScenarios(date);
  await db.insert(dailyChallenges).values({
    date,
    seed: seedFromString(`daily-v1:${date}`),
    scenarios: JSON.stringify(scenarios),
  }).onConflictDoNothing();
  const row = await db.select().from(dailyChallenges).where(eq(dailyChallenges.date, date)).get();
  if (!row) throw new Error("daily challenge unavailable after insert");
  return JSON.parse(row.scenarios) as CanonicalDailyScenario[];
}

export async function getDailyResult(db: Db, playerId: string, date: string): Promise<DailyResult | null> {
  const row = await db.select().from(dailyResults).where(and(
    eq(dailyResults.playerId, playerId), eq(dailyResults.date, date),
  )).get();
  if (!row) return null;
  return { date: row.date, score: row.score, attempts: row.attempts, accuracy: row.accuracy, durationMs: row.durationMs };
}

export async function ensureDailyPlayer(db: Db, playerId: string): Promise<void> {
  await db.insert(players).values({ id: playerId, createdAt: new Date().toISOString() }).onConflictDoNothing();
}

/** The first completed attempt is final even under concurrent submissions. */
export async function saveDailyResult(db: Db, playerId: string, result: DailyResult): Promise<DailyResult> {
  await db.insert(dailyResults).values({ ...result, playerId, createdAt: new Date().toISOString() }).onConflictDoNothing();
  const persisted = await getDailyResult(db, playerId, result.date);
  if (!persisted) throw new Error("daily result unavailable after insert");
  return persisted;
}
