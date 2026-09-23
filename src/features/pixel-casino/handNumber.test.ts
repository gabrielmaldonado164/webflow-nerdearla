import { describe, expect, it } from "vitest";

import { currentHandNumber } from "./handNumber";

describe("currentHandNumber", () => {
  it("is hand 1 before any decision has been made in a fresh run", () => {
    expect(currentHandNumber(0, false)).toBe(1);
  });

  it("holds the in-progress hand's number while its feedback is pending", () => {
    expect(currentHandNumber(3, true)).toBe(3);
  });

  it("advances to the next hand once feedback clears (deal/next)", () => {
    expect(currentHandNumber(3, false)).toBe(4);
  });

  it("resets to 1 right after a restart, since run decisions reset to 0", () => {
    expect(currentHandNumber(0, false)).toBe(1);
  });
});
