import { sqliteTable, int, integer, text } from "drizzle-orm/sqlite-core";

export const healthChecks = sqliteTable("health_checks", {
  id: int().primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull(),
});

/** Anonymous player identity (D4): a UUID cookie, no auth. */
export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  displayName: text("display_name"),
});

/**
 * One row per accepted decision. Cards and available actions are stored
 * as JSON text; grading (`optimalAction`, `isCorrect`, `category`) is
 * always server-computed by `recordDecision` (D2), never trusted from
 * the client.
 */
export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  playerId: text("player_id")
    .notNull()
    .references(() => players.id),
  playerCards: text("player_cards").notNull(),
  dealerUpcard: text("dealer_upcard").notNull(),
  availableActions: text("available_actions").notNull(),
  userAction: text("user_action").notNull(),
  optimalAction: text("optimal_action").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
  category: text("category").notNull(),
  createdAt: text("created_at").notNull(),
});
