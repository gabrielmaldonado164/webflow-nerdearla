import { describe, expect, it } from "vitest";

import { createRng, seedFromString } from "./rng";

describe("createRng", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a()).not.toBe(b());
  });

  it("always returns values in [0, 1)", () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("seedFromString", () => {
  it("is deterministic for the same string", () => {
    expect(seedFromString("2026-09-25")).toBe(seedFromString("2026-09-25"));
  });

  it("produces different seeds for different strings", () => {
    expect(seedFromString("2026-09-25")).not.toBe(seedFromString("2026-09-26"));
  });

  it("returns a non-negative 32-bit integer", () => {
    const seed = seedFromString("hello world");
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });
});
