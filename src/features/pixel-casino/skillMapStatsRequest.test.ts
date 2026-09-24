import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

import { buildStatsRequestUrl } from "./skillMapStatsRequest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildStatsRequestUrl", () => {
  it("targets /api/stats with no base path configured", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", undefined);
    expect(buildStatsRequestUrl()).toBe("/api/stats");
  });

  it("prefixes the URL with NEXT_PUBLIC_BASE_PATH when set", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/mount");
    expect(buildStatsRequestUrl()).toBe("/mount/api/stats");
  });
});
