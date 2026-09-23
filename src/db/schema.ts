import { sqliteTable, int, text } from "drizzle-orm/sqlite-core";

export const healthChecks = sqliteTable("health_checks", {
  id: int().primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull(),
});
