import { describe, expect, it } from "vitest";

import { buildEvidence, EV_ITERATIONS } from "./evidence";

const hand = {
  playerCards: [{ rank: "10", suit: "spades" }, { rank: "6", suit: "hearts" }],
  dealerUpcard: { rank: "9", suit: "clubs" },
  availableActions: ["hit", "stand", "double"],
  userAction: "stand",
};

describe("buildEvidence", () => {
  it("re-grades the hand and simulates every legal action deterministically", () => {
    const first = buildEvidence(hand);
    const second = buildEvidence(hand);
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.evidence.optimalAction).toBe("hit");
    expect(first.evidence.ev.map(({ action }) => action)).toEqual(hand.availableActions);
    expect(first.evidence.ev.every(({ ev, iterations }) => Number.isFinite(ev) && iterations === EV_ITERATIONS)).toBe(true);
  });

  it("rejects actions unavailable on the hand", () => {
    expect(buildEvidence({ ...hand, playerCards: [...hand.playerCards, { rank: "2", suit: "hearts" }], userAction: "double" }))
      .toMatchObject({ ok: false, reason: "userAction is not available for this hand" });
  });

  it("rejects forged client action lists", () => {
    expect(buildEvidence({ ...hand, availableActions: ["hit", "stand"] }))
      .toMatchObject({ ok: false, reason: "availableActions does not match the hand" });
  });

  it("rejects malformed cards before calling the engine", () => {
    expect(buildEvidence({ ...hand, dealerUpcard: { rank: "14", suit: "clubs" } }).ok).toBe(false);
  });
});
