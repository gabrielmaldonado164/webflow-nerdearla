import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import { resolveDatabaseConfig } from "./config";
import * as schema from "./schema";

let client: Client | undefined;
let db: LibSQLDatabase<typeof schema> | undefined;

/**
 * Returns the raw libSQL client (cached per server instance), for the
 * few callers that need hand-written SQL such as the coach rate limiter.
 */
export function getLibsqlClient(): Client {
  client ??= createClient(resolveDatabaseConfig(process.env));
  return client;
}

/** Returns the cached Drizzle instance bound to the libSQL database. */
export function getDb(): LibSQLDatabase<typeof schema> {
  db ??= drizzle(getLibsqlClient(), { schema });
  return db;
}
