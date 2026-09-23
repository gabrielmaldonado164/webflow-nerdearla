import { describe, expect, it } from "vitest";

import type { Card, Rank } from "./cards";
import { drawCard } from "./cards";
import { createRng } from "./rng";
import { DEFAULT_RULES } from "./rules";
import { dealHoleCard, resolveHand } from "./resolve";

function card(rank: Rank, suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

/** Deterministic draw function that hands out a scripted sequence of cards. */
function scriptedDraw(cards: Card[]): () => Card {
  let index = 0;
  return () => {
    if (index >= cards.length) {
      throw new Error("scripted draw ran out of cards");
    }
    return cards[index++];
  };
}

describe("dealHoleCard", () => {
  it("deals a single card when it would not give the dealer a blackjack", () => {
    let calls = 0;
    const draw = () => {
      calls += 1;
      return card("9");
    };
    const hole = dealHoleCard(card("6"), draw);
    expect(hole).toEqual(card("9"));
    expect(calls).toBe(1);
  });

  it("redraws while the hole card would complete a dealer blackjack (Ace upcard)", () => {
    const draw = scriptedDraw([card("K"), card("5")]);
    const hole = dealHoleCard(card("A"), draw);
    expect(hole).toEqual(card("5"));
  });

  it("redraws while the hole card would complete a dealer blackjack (ten-value upcard)", () => {
    const draw = scriptedDraw([card("A"), card("4")]);
    const hole = dealHoleCard(card("10"), draw);
    expect(hole).toEqual(card("4"));
  });
});

describe("resolveHand", () => {
  it("stand: dealer draws to 17+ and totals are compared", () => {
    const draw = scriptedDraw([card("5")]);
    const result = resolveHand({
      playerCards: [card("K"), card("Q")],
      dealerUpcard: card("6"),
      holeCard: card("10"),
      action: "stand",
      draw,
      rules: DEFAULT_RULES,
    });

    expect(result.dealerCards).toEqual([card("6"), card("10"), card("5")]);
    expect(result.dealerTotal).toBe(21);
    expect(result.dealerBusted).toBe(false);
    expect(result.playerHands).toEqual([
      { cards: [card("K"), card("Q")], total: 20, doubled: false, busted: false, outcome: "lose" },
    ]);
    expect(result.steps).toEqual([{ actor: "dealer", handIndex: 0, card: card("5") }]);
  });

  it("hit that busts ends the hand immediately; the dealer only reveals when every hand busted", () => {
    const draw = scriptedDraw([card("10")]);
    const result = resolveHand({
      playerCards: [card("10"), card("6")],
      dealerUpcard: card("10"),
      holeCard: card("6"),
      action: "hit",
      draw,
      rules: DEFAULT_RULES,
    });

    expect(result.playerHands).toEqual([
      {
        cards: [card("10"), card("6"), card("10")],
        total: 26,
        doubled: false,
        busted: true,
        outcome: "lose",
      },
    ]);
    // No dealer draws: both cards are exactly the ones dealt upfront.
    expect(result.dealerCards).toEqual([card("10"), card("6")]);
    expect(result.steps).toEqual([{ actor: "player", handIndex: 0, card: card("10") }]);
  });

  it("hit that survives is auto-played by basic strategy until it stands", () => {
    const draw = scriptedDraw([card("3"), card("4"), card("6"), card("2")]);
    const result = resolveHand({
      playerCards: [card("2"), card("2")],
      dealerUpcard: card("6"),
      holeCard: card("9"),
      action: "hit",
      draw,
      rules: DEFAULT_RULES,
    });

    expect(result.playerHands).toEqual([
      {
        cards: [card("2"), card("2"), card("3"), card("4"), card("6")],
        total: 17,
        doubled: false,
        busted: false,
        outcome: "push",
      },
    ]);
    expect(result.dealerCards).toEqual([card("6"), card("9"), card("2")]);
    expect(result.dealerTotal).toBe(17);
    expect(result.steps).toEqual([
      { actor: "player", handIndex: 0, card: card("3") },
      { actor: "player", handIndex: 0, card: card("4") },
      { actor: "player", handIndex: 0, card: card("6") },
      { actor: "dealer", handIndex: 0, card: card("2") },
    ]);
  });

  it("double draws exactly one card and never auto-plays further", () => {
    const draw = scriptedDraw([card("A"), card("2")]);
    const result = resolveHand({
      playerCards: [card("6"), card("5")],
      dealerUpcard: card("6"),
      holeCard: card("9"),
      action: "double",
      draw,
      rules: DEFAULT_RULES,
    });

    expect(result.playerHands).toEqual([
      {
        cards: [card("6"), card("5"), card("A")],
        total: 12,
        doubled: true,
        busted: false,
        outcome: "lose",
      },
    ]);
    expect(result.dealerCards).toEqual([card("6"), card("9"), card("2")]);
    expect(result.dealerTotal).toBe(17);
  });

  it("split deals one card to each hand, then auto-plays each independently (honoring DAS)", () => {
    const draw = scriptedDraw([
      card("3"), // hand 0 split card -> 8,3 = 11
      card("5"), // hand 0 doubles -> 8,3,5 = 16
      card("2"), // hand 1 split card -> 8,2 = 10
      card("9"), // hand 1 hits -> 8,2,9 = 19 (then stands)
      card("K"), // dealer draws and busts
    ]);
    const result = resolveHand({
      playerCards: [card("8"), card("8")],
      dealerUpcard: card("10"),
      holeCard: card("6"),
      action: "split",
      draw,
      rules: DEFAULT_RULES,
    });

    expect(result.playerHands).toEqual([
      {
        cards: [card("8"), card("3"), card("5")],
        total: 16,
        doubled: true,
        busted: false,
        outcome: "win",
      },
      {
        cards: [card("8"), card("2"), card("9")],
        total: 19,
        doubled: false,
        busted: false,
        outcome: "win",
      },
    ]);
    expect(result.dealerBusted).toBe(true);
    expect(result.steps).toEqual([
      { actor: "player", handIndex: 0, card: card("3") },
      { actor: "player", handIndex: 0, card: card("5") },
      { actor: "player", handIndex: 1, card: card("2") },
      { actor: "player", handIndex: 1, card: card("9") },
      { actor: "dealer", handIndex: 0, card: card("K") },
    ]);
  });

  it("split Aces receive exactly one card each and stop, and a resulting 21 is not a blackjack", () => {
    const draw = scriptedDraw([card("10"), card("9"), card("3")]);
    const result = resolveHand({
      playerCards: [card("A"), card("A")],
      dealerUpcard: card("6"),
      holeCard: card("8"),
      action: "split",
      draw,
      rules: DEFAULT_RULES,
    });

    expect(result.playerHands).toEqual([
      {
        cards: [card("A"), card("10")],
        total: 21,
        doubled: false,
        busted: false,
        outcome: "win",
      },
      {
        cards: [card("A"), card("9")],
        total: 20,
        doubled: false,
        busted: false,
        outcome: "win",
      },
    ]);
    // Only the two ace-split cards and one dealer draw: no auto-play cards.
    expect(result.steps).toHaveLength(3);
  });

  it("a natural two-card blackjack beats any non-blackjack dealer total, even a dealer 21", () => {
    const draw = scriptedDraw([card("10")]);
    const result = resolveHand({
      playerCards: [card("A"), card("K")],
      dealerUpcard: card("9"),
      holeCard: card("2"),
      action: "stand",
      draw,
      rules: DEFAULT_RULES,
    });

    expect(result.dealerTotal).toBe(21);
    expect(result.dealerCards).toHaveLength(3);
    expect(result.playerHands).toEqual([
      {
        cards: [card("A"), card("K")],
        total: 21,
        doubled: false,
        busted: false,
        outcome: "blackjack",
      },
    ]);
  });

  it("pushes when the dealer also has a natural two-card blackjack", () => {
    const draw = scriptedDraw([]);
    const result = resolveHand({
      playerCards: [card("A"), card("K")],
      dealerUpcard: card("A"),
      holeCard: card("K"),
      action: "stand",
      draw,
      rules: DEFAULT_RULES,
    });

    expect(result.playerHands[0].outcome).toBe("push");
    expect(result.steps).toEqual([]);
  });

  it("throws when the action is not legal for the hand", () => {
    expect(() =>
      resolveHand({
        playerCards: [card("2"), card("3"), card("4")],
        dealerUpcard: card("6"),
        holeCard: card("9"),
        action: "double",
        draw: scriptedDraw([]),
        rules: DEFAULT_RULES,
      }),
    ).toThrow(/double/i);
  });

  it("is deterministic for a given seed, using the shared RNG helpers", () => {
    const playerCards: Card[] = [card("10"), card("6")];
    const dealerUpcard = card("9");

    const rngA = createRng(42);
    const holeA = dealHoleCard(dealerUpcard, () => drawCard(rngA));
    const resultA = resolveHand({
      playerCards,
      dealerUpcard,
      holeCard: holeA,
      action: "hit",
      draw: () => drawCard(rngA),
      rules: DEFAULT_RULES,
    });

    const rngB = createRng(42);
    const holeB = dealHoleCard(dealerUpcard, () => drawCard(rngB));
    const resultB = resolveHand({
      playerCards,
      dealerUpcard,
      holeCard: holeB,
      action: "hit",
      draw: () => drawCard(rngB),
      rules: DEFAULT_RULES,
    });

    expect(holeA).toEqual(holeB);
    expect(resultA).toEqual(resultB);
  });
});
