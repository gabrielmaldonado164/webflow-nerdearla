/**
 * D1-backed adapter for the `DecisionRepository` interface `recordDecision`
 * (src/player/recordDecision.ts) is written against, plus a helper to
 * insert-if-missing the anonymous player row for `POST /api/decisions`.
 * Thin: JSON-encodes the structured domain fields into the `decisions`
 * table's text columns and nothing else.
 */

import type { DecisionRepository, DecisionRow } from "@/player/recordDecision";

import type { getDb } from "./client";
import { decisions, players } from "./schema";

type Db = ReturnType<typeof getDb>;

export function createD1DecisionRepository(db: Db): DecisionRepository {
  return {
    async insertDecision(row: DecisionRow) {
      await db.insert(decisions).values({
        id: row.id,
        playerId: row.playerId,
        playerCards: JSON.stringify(row.playerCards),
        dealerUpcard: JSON.stringify(row.dealerUpcard),
        availableActions: JSON.stringify(row.availableActions),
        userAction: row.userAction,
        optimalAction: row.optimalAction,
        isCorrect: row.isCorrect,
        category: row.category,
        createdAt: row.createdAt,
      });
    },
  };
}

/**
 * Inserts a `players` row for `playerId` if one doesn't already exist.
 * Safe to call for a brand-new id or a valid-but-unknown one (e.g. a
 * cookie that survived a DB reset) alike.
 */
export async function ensurePlayer(db: Db, playerId: string): Promise<void> {
  await db
    .insert(players)
    .values({ id: playerId, createdAt: new Date().toISOString() })
    .onConflictDoNothing();
}
