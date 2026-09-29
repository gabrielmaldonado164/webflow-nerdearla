/** Local development falls back to a file-backed libSQL database. */
export const LOCAL_DATABASE_URL = "file:local.db";

export interface DatabaseConfig {
  url: string;
  authToken: string | undefined;
}

export interface ResolveOptions {
  /** Defaults to `NODE_ENV !== "production"`. */
  allowLocalFallback?: boolean;
}

/**
 * Pure env resolver shared by the runtime client and drizzle-kit. Empty
 * strings count as unset. Without a URL it only falls back to the local
 * file when allowed, so production never silently writes to a local file.
 */
export function resolveDatabaseConfig(
  env: Record<string, string | undefined>,
  options: ResolveOptions = {},
): DatabaseConfig {
  const allowLocalFallback = options.allowLocalFallback ?? env.NODE_ENV !== "production";
  const authToken = env.TURSO_AUTH_TOKEN || undefined;
  const configured = env.TURSO_DATABASE_URL || undefined;
  if (configured) return { url: configured, authToken };
  if (!allowLocalFallback) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Set it to your Turso database URL (libsql://...); " +
        "the local file:local.db fallback is only available outside production.",
    );
  }
  return { url: LOCAL_DATABASE_URL, authToken };
}
