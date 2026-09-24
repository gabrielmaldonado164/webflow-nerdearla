/**
 * D1-backed adapter for the `DecisionRepository` interface `recordDecision`
 * (src/player/recordDecision.ts) is written against, plus a helper to
 * insert-if-missing the anonymous player row for `POST /api/decisions`,
 * and `listPlayerDecisions` to read a player's decision history back for
 * `GET /api/stats` (Phase 3 T1). Thin: JSON-encodes/decodes the
 * structured domain fields to/from the `decisions` table's text columns
 * and nothing else.
 */

import { asc, eq } from "drizzle-orm";

import type { DecisionRepository, DecisionRow } from "@/player/recordDecision";

import type { getDb } from "./client";
import { decisions, players } from "./schema";

type Db = ReturnType<typeof getDb>;

/** Shape of a `decisions` row as Drizzle's `.values()` expects it. */
export interface DecisionInsertValues {
  id: string;
  playerId: string;
  playerCards: string;
  dealerUpcard: string;
  availableActions: string;
  userAction: DecisionRow["userAction"];
  optimalAction: DecisionRow["optimalAction"];
  isCorrect: boolean;
  category: DecisionRow["category"];
  createdAt: string;
}

/**
 * Pure mapping from a domain `DecisionRow` to the D1 `decisions` table's
 * insert shape: JSON-encodes the structured `playerCards`/`dealerUpcard`/
 * `availableActions` fields into the table's text columns, and passes
 * everything else through unchanged.
 */
export function decisionRowToInsertValues(row: DecisionRow): DecisionInsertValues {
  return {
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
  };
}

/**
 * Shape of a `decisions` row as Drizzle's `.select()` returns it: the
 * `text()` columns without a mode/enum widen to plain `string` at the
 * type level (unlike `DecisionInsertValues`, whose narrower literal
 * types only hold going *in*). `decisionRowFromSelectValues` narrows
 * `userAction`/`optimalAction`/`category` back to their domain types,
 * trusting that every row in `decisions` was written by
 * `decisionRowToInsertValues` and therefore already holds a known value.
 */
export interface DecisionSelectValues {
  id: string;
  playerId: string;
  playerCards: string;
  dealerUpcard: string;
  availableActions: string;
  userAction: string;
  optimalAction: string;
  isCorrect: boolean;
  category: string;
  createdAt: string;
}

/**
 * Pure inverse of `decisionRowToInsertValues`: decodes a `decisions` row
 * as Drizzle's `.select()` returns it back into the structured domain
 * `DecisionRow` shape (JSON-parses `playerCards`/`dealerUpcard`/
 * `availableActions`; passes everything else through unchanged).
 */
export function decisionRowFromSelectValues(values: DecisionSelectValues): DecisionRow {
  return {
    id: values.id,
    playerId: values.playerId,
    playerCards: JSON.parse(values.playerCards),
    dealerUpcard: JSON.parse(values.dealerUpcard),
    availableActions: JSON.parse(values.availableActions),
    userAction: values.userAction as DecisionRow["userAction"],
    optimalAction: values.optimalAction as DecisionRow["optimalAction"],
    isCorrect: values.isCorrect,
    category: values.category as DecisionRow["category"],
    createdAt: values.createdAt,
  };
}

export function createD1DecisionRepository(db: Db): DecisionRepository {
  return {
    async insertDecision(row: DecisionRow) {
      await db.insert(decisions).values(decisionRowToInsertValues(row));
    },
  };
}

/**
 * Fetches every decision recorded for `playerId`, oldest first — the
 * order `computePlayerStats` (src/player/playerStats.ts) requires for
 * correct streak calculation. Returns an empty array for an unknown or
 * decision-less player id; never throws for that case.
 *
 * Ordered by `createdAt` then `id` ascending: `createdAt` alone is only
 * millisecond-precision, so two decisions recorded in the same
 * millisecond (realistic under rapid play) would otherwise come back in
 * a DB-dependent, non-deterministic order. `id` is a UUID assigned per
 * decision (see `recordDecision.ts`) with no relation to insertion
 * order, so this is a stable tie-break, not a true chronological one —
 * good enough to make the query deterministic without adding a
 * sequence column.
 */
export async function listPlayerDecisions(db: Db, playerId: string): Promise<DecisionRow[]> {
  const rows = await db
    .select()
    .from(decisions)
    .where(eq(decisions.playerId, playerId))
    .orderBy(asc(decisions.createdAt), asc(decisions.id));

  return rows.map(decisionRowFromSelectValues);
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
