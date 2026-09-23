import { describe, expect, it } from "vitest";

import type { Card, Rank } from "./cards";
import { explainDecision } from "./explain";

function card(rank: Rank, suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

describe("explainDecision", () => {
  it("reports a correct decision with an encouraging title", () => {
    const result = explainDecision({
      playerCards: [card("K"), card("Q")],
      dealerUpcard: card("6"),
      userAction: "stand",
      optimalAction: "stand",
    });
    expect(result.isCorrect).toBe(true);
    expect(result.title).toBe("Perfect move");
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("reports an incorrect decision without a punitive tone", () => {
    const result = explainDecision({
      playerCards: [card("10"), card("6")],
      dealerUpcard: card("6"),
      userAction: "hit",
      optimalAction: "stand",
    });
    expect(result.isCorrect).toBe(false);
    expect(result.title).toBe("Not quite");
    expect(result.message.toLowerCase()).not.toContain("wrong");
    expect(result.message.toLowerCase()).not.toContain("bad");
  });

  it("explains splitting Aces", () => {
    const result = explainDecision({
      playerCards: [card("A"), card("A")],
      dealerUpcard: card("7"),
      userAction: "hit",
      optimalAction: "split",
    });
    expect(result.message).toContain("Aces");
  });

  it("explains never splitting 10s", () => {
    const result = explainDecision({
      playerCards: [card("K"), card("Q")],
      dealerUpcard: card("7"),
      userAction: "split",
      optimalAction: "stand",
    });
    expect(result.message.toLowerCase()).toContain("ten");
  });

  it("explains doubling on 10/11", () => {
    const result = explainDecision({
      playerCards: [card("6"), card("5")],
      dealerUpcard: card("6"),
      userAction: "hit",
      optimalAction: "double",
    });
    expect(result.message.toLowerCase()).toContain("double");
  });

  it("explains a stiff hand vs a dealer bust card", () => {
    const result = explainDecision({
      playerCards: [card("10"), card("5")],
      dealerUpcard: card("6"),
      userAction: "hit",
      optimalAction: "stand",
    });
    expect(result.message.toLowerCase()).toContain("dealer");
  });
});
