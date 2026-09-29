import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

/** Local development falls back to a file-backed libSQL database. */
const LOCAL_DATABASE_URL = "file:local.db";

let client: Client | undefined;
let db: LibSQLDatabase<typeof schema> | undefined;

/**
 * Returns the raw libSQL client (cached per server instance), for the
 * few callers that need hand-written SQL such as the coach rate limiter.
 */
export function getLibsqlClient(): Client {
  client ??= createClient({
    url: process.env.TURSO_DATABASE_URL || LOCAL_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
  return client;
}

/** Returns the cached Drizzle instance bound to the libSQL database. */
export function getDb(): LibSQLDatabase<typeof schema> {
  db ??= drizzle(getLibsqlClient(), { schema });
  return db;
}
