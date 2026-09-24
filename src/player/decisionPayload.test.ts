import { describe, expect, it } from "vitest";

import { parseDecisionPayload } from "./decisionPayload";

const validPayload = {
  playerCards: [
    { rank: "10", suit: "spades" },
    { rank: "6", suit: "hearts" },
  ],
  dealerUpcard: { rank: "9", suit: "clubs" },
  userAction: "hit",
};

describe("parseDecisionPayload", () => {
  it("accepts a well-formed payload", () => {
    const result = parseDecisionPayload(validPayload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(validPayload);
    }
  });

  it.each([null, undefined, "a string", 42, []])(
    "rejects a non-object payload (%s)",
    (raw) => {
      const result = parseDecisionPayload(raw);
      expect(result.ok).toBe(false);
    },
  );

  it("rejects a payload missing playerCards", () => {
    const rest = {
      dealerUpcard: validPayload.dealerUpcard,
      userAction: validPayload.userAction,
    };
    const result = parseDecisionPayload(rest);
    expect(result.ok).toBe(false);
  });

  it("rejects playerCards with fewer than two cards", () => {
    const result = parseDecisionPayload({
      ...validPayload,
      playerCards: [{ rank: "10", suit: "spades" }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a playerCards entry with an unknown rank", () => {
    const result = parseDecisionPayload({
      ...validPayload,
      playerCards: [
        { rank: "11", suit: "spades" },
        { rank: "6", suit: "hearts" },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a playerCards entry with an unknown suit", () => {
    const result = parseDecisionPayload({
      ...validPayload,
      playerCards: [
        { rank: "10", suit: "stars" },
        { rank: "6", suit: "hearts" },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed dealerUpcard", () => {
    const result = parseDecisionPayload({
      ...validPayload,
      dealerUpcard: { rank: "10" },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown userAction", () => {
    const result = parseDecisionPayload({
      ...validPayload,
      userAction: "surrender",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-string userAction", () => {
    const result = parseDecisionPayload({ ...validPayload, userAction: 1 });
    expect(result.ok).toBe(false);
  });

  it.each(["hit", "stand", "double", "split"] as const)(
    "accepts %s as a known action",
    (userAction) => {
      const result = parseDecisionPayload({ ...validPayload, userAction });
      expect(result.ok).toBe(true);
    },
  );
});
