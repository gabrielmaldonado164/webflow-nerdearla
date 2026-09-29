import { describe, expect, it } from "vitest";

import { resolveDatabaseConfig } from "./config";

describe("resolveDatabaseConfig", () => {
  it("uses the configured url and token", () => {
    expect(
      resolveDatabaseConfig({ TURSO_DATABASE_URL: "libsql://db.turso.io", TURSO_AUTH_TOKEN: "t", NODE_ENV: "production" }),
    ).toEqual({ url: "libsql://db.turso.io", authToken: "t" });
  });

  it("falls back to the local file outside production", () => {
    expect(resolveDatabaseConfig({})).toEqual({ url: "file:local.db", authToken: undefined });
    expect(resolveDatabaseConfig({ NODE_ENV: "development" }).url).toBe("file:local.db");
    expect(resolveDatabaseConfig({ NODE_ENV: "test" }).url).toBe("file:local.db");
  });

  it("treats empty strings as unset", () => {
    expect(resolveDatabaseConfig({ TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "" })).toEqual({
      url: "file:local.db",
      authToken: undefined,
    });
  });

  it("throws a descriptive error in production when the url is missing or empty", () => {
    expect(() => resolveDatabaseConfig({ NODE_ENV: "production" })).toThrow(/TURSO_DATABASE_URL/);
    expect(() => resolveDatabaseConfig({ NODE_ENV: "production", TURSO_DATABASE_URL: "" })).toThrow(/TURSO_DATABASE_URL/);
  });

  it("throws when the local fallback is disallowed and the url is missing", () => {
    expect(() => resolveDatabaseConfig({}, { allowLocalFallback: false })).toThrow(/TURSO_DATABASE_URL/);
    expect(resolveDatabaseConfig({ TURSO_DATABASE_URL: "file:x.db" }, { allowLocalFallback: false }).url).toBe("file:x.db");
  });
});
