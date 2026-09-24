import { describe, expect, it } from "vitest";

import { parseCoachRequest } from "./request";

const hand = {
  playerCards: [{ rank: "10", suit: "spades" }, { rank: "6", suit: "hearts" }],
  dealerUpcard: { rank: "9", suit: "clubs" },
  userAction: "stand",
};

describe("parseCoachRequest", () => {
  it("requires a real hand for why mode", () => {
    expect(parseCoachRequest({ mode: "why" }).ok).toBe(false);
    expect(parseCoachRequest({ mode: "why", ...hand })).toMatchObject({ ok: true, value: { mode: "why" } });
  });

  it("allows bounded chat with or without a hand", () => {
    expect(parseCoachRequest({ mode: "chat", message: "  How am I doing?  " }))
      .toMatchObject({ ok: true, value: { mode: "chat", message: "How am I doing?", evidence: null } });
    expect(parseCoachRequest({ mode: "chat", message: "Why?", ...hand }))
      .toMatchObject({ ok: true, value: { mode: "chat" } });
    expect(parseCoachRequest({ mode: "chat", message: "x".repeat(501) }).ok).toBe(false);
  });

  it("rejects incomplete hands and unknown modes", () => {
    expect(parseCoachRequest({ mode: "chat", message: "Why?", playerCards: [] }).ok).toBe(false);
    expect(parseCoachRequest({ mode: "other" }).ok).toBe(false);
  });
});
