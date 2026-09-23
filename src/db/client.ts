import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

/**
 * Returns a Drizzle instance bound to the D1 database.
 * Must be called from inside a request handler (or with
 * `getCloudflareContext({ async: true })` in static contexts).
 */
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}
