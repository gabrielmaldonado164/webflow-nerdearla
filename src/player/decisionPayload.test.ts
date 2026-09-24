import { describe, expect, it } from "vitest";

import type { Action, Card } from "@/blackjack";
import { createRng, drawCard, seedFromString } from "@/blackjack";

import { parseDecisionPayload } from "./decisionPayload";
import type { DecisionRepository } from "./recordDecision";
import { recordDecision } from "./recordDecision";

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

  it("rejects a hand that is already bust (total over 21)", () => {
    const result = parseDecisionPayload({
      ...validPayload,
      playerCards: [
        { rank: "10", suit: "spades" },
        { rank: "9", suit: "hearts" },
        { rank: "5", suit: "clubs" },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a hand already at 21 (not a decision point)", () => {
    const result = parseDecisionPayload({
      ...validPayload,
      playerCards: [
        { rank: "A", suit: "spades" },
        { rank: "K", suit: "hearts" },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a hand at 21 built from more than two cards", () => {
    const result = parseDecisionPayload({
      ...validPayload,
      playerCards: [
        { rank: "7", suit: "spades" },
        { rank: "7", suit: "hearts" },
        { rank: "7", suit: "clubs" },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a crafted hand with an unreasonable number of cards", () => {
    const playerCards: Card[] = Array.from({ length: 40 }, () => ({
      rank: "2" as const,
      suit: "spades" as const,
    }));
    const result = parseDecisionPayload({ ...validPayload, playerCards });
    expect(result.ok).toBe(false);
  });

  it("accepts a hand well under the max card count and under 21", () => {
    const result = parseDecisionPayload({
      ...validPayload,
      playerCards: [
        { rank: "2", suit: "spades" },
        { rank: "2", suit: "hearts" },
        { rank: "2", suit: "clubs" },
        { rank: "2", suit: "diamonds" },
        { rank: "2", suit: "spades" },
      ],
    });
    expect(result.ok).toBe(true);
  });

  describe("payloads the parser accepts never throw through recordDecision", () => {
    it("recordDecision resolves without throwing for 500 random parser-accepted payloads", async () => {
      const rng = createRng(seedFromString("decisionPayload-fuzz-sweep"));
      const repo: DecisionRepository = {
        async insertDecision() {
          // no-op fake repository; only used to prove recordDecision never throws
        },
      };
      const actions: readonly Action[] = ["hit", "stand", "double", "split"];
      const playerId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

      let sampled = 0;

      for (let i = 0; i < 500; i++) {
        const cardCount = 2 + Math.floor(rng() * 25);
        const playerCards = Array.from({ length: cardCount }, () => drawCard(rng));
        const dealerUpcard = drawCard(rng);
        const userAction = actions[Math.floor(rng() * actions.length)];

        const parsed = parseDecisionPayload({ playerCards, dealerUpcard, userAction });
        if (!parsed.ok) {
          continue;
        }

        sampled += 1;
        await expect(
          recordDecision({ ...parsed.value, playerId }, repo),
        ).resolves.toBeDefined();
      }

      // Sanity: the fuzz seed must actually exercise some accepted payloads,
      // otherwise this test would vacuously pass.
      expect(sampled).toBeGreaterThan(0);
    });
  });
});
