import { describe, expect, it } from "vitest";

import { generatePlayerId, isValidPlayerId } from "./playerId";

describe("isValidPlayerId", () => {
  it("accepts a well-formed UUID", () => {
    expect(isValidPlayerId("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  it("accepts an upper-case UUID", () => {
    expect(isValidPlayerId("F47AC10B-58CC-4372-A567-0E02B2C3D479")).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    expect(isValidPlayerId("not-a-uuid")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidPlayerId("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidPlayerId(undefined)).toBe(false);
    expect(isValidPlayerId(null)).toBe(false);
    expect(isValidPlayerId(42)).toBe(false);
    expect(isValidPlayerId({})).toBe(false);
  });

  it("rejects a UUID-shaped string with an invalid character", () => {
    expect(isValidPlayerId("f47ac10b-58cc-4372-a567-0e02b2c3d47g")).toBe(false);
  });
});

describe("generatePlayerId", () => {
  it("generates a value accepted by isValidPlayerId", () => {
    const id = generatePlayerId();
    expect(isValidPlayerId(id)).toBe(true);
  });

  it("generates distinct ids across calls", () => {
    const a = generatePlayerId();
    const b = generatePlayerId();
    expect(a).not.toBe(b);
  });
});
