import { describe, expect, it } from "vitest";

import { isEngineReady } from "./placeholder";

describe("blackjack engine placeholder", () => {
  it("reports ready so the Vitest setup is exercised", () => {
    expect(isEngineReady()).toBe(true);
  });
});
