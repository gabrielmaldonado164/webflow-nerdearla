import { describe, expect, it } from "vitest";

import { loadBestScore, loadMuted, saveBestScore, saveMuted, type StorageLike } from "./preferences";

function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function throwingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
}

describe("loadMuted / saveMuted", () => {
  it("defaults to unmuted with no storage", () => {
    expect(loadMuted(undefined)).toBe(false);
  });

  it("defaults to unmuted when nothing has been saved yet", () => {
    expect(loadMuted(fakeStorage())).toBe(false);
  });

  it("round-trips a saved value", () => {
    const storage = fakeStorage();
    saveMuted(true, storage);
    expect(loadMuted(storage)).toBe(true);

    saveMuted(false, storage);
    expect(loadMuted(storage)).toBe(false);
  });

  it("falls back to the default when storage throws on read", () => {
    expect(loadMuted(throwingStorage())).toBe(false);
  });

  it("never throws when storage throws on write", () => {
    expect(() => saveMuted(true, throwingStorage())).not.toThrow();
  });
});

describe("loadBestScore / saveBestScore", () => {
  it("defaults to 0 with no storage", () => {
    expect(loadBestScore(undefined)).toBe(0);
  });

  it("defaults to 0 when nothing has been saved yet", () => {
    expect(loadBestScore(fakeStorage())).toBe(0);
  });

  it("round-trips a saved value", () => {
    const storage = fakeStorage();
    saveBestScore(1500, storage);
    expect(loadBestScore(storage)).toBe(1500);
  });

  it("falls back to the default for a corrupted (non-numeric) stored value", () => {
    expect(loadBestScore(fakeStorage({ "pixel-casino:best-score": "not-a-number" }))).toBe(0);
  });

  it("falls back to the default for a negative stored value", () => {
    expect(loadBestScore(fakeStorage({ "pixel-casino:best-score": "-5" }))).toBe(0);
  });

  it("falls back to the default for a non-integer stored value", () => {
    expect(loadBestScore(fakeStorage({ "pixel-casino:best-score": "12.5" }))).toBe(0);
  });

  it("falls back to the default for a non-finite stored value", () => {
    expect(loadBestScore(fakeStorage({ "pixel-casino:best-score": "Infinity" }))).toBe(0);
  });

  it("falls back to the default when storage throws on read", () => {
    expect(loadBestScore(throwingStorage())).toBe(0);
  });

  it("never throws when storage throws on write", () => {
    expect(() => saveBestScore(100, throwingStorage())).not.toThrow();
  });

  it("ignores a negative score on save (leaves prior stored value untouched)", () => {
    const storage = fakeStorage({ "pixel-casino:best-score": "50" });
    saveBestScore(-10, storage);
    expect(loadBestScore(storage)).toBe(50);
  });

  it("ignores a non-integer score on save", () => {
    const storage = fakeStorage({ "pixel-casino:best-score": "50" });
    saveBestScore(50.5, storage);
    expect(loadBestScore(storage)).toBe(50);
  });
});
