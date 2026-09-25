import { describe, expect, it } from "vitest";

import type { Action } from "./actions";
import type { Card, Rank } from "./cards";
import { explainDecision } from "./explain";
import { DEFAULT_RULES } from "./rules";
import { optimalAction } from "./strategy";

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

  describe("miss messages never assume a specific wrong action", () => {
    it("pair of tens vs 8, user hit: does not mention splitting", () => {
      const result = explainDecision({
        playerCards: [card("10"), card("10")],
        dealerUpcard: card("8"),
        userAction: "hit",
        optimalAction: "stand",
      });
      expect(result.isCorrect).toBe(false);
      expect(result.message.toLowerCase()).not.toContain("split");
      expect(result.message.toLowerCase()).toContain("stand");
    });

    it("pair of tens vs 8, user split: does not claim the user hit", () => {
      const result = explainDecision({
        playerCards: [card("10"), card("10")],
        dealerUpcard: card("8"),
        userAction: "split",
        optimalAction: "stand",
      });
      expect(result.isCorrect).toBe(false);
      expect(result.message.toLowerCase()).not.toMatch(/\bhit(s|ting)?\b/);
      expect(result.message.toLowerCase()).toContain("stand");
    });

    it("5-5 vs 6 (optimal double), user split: does not mention splitting", () => {
      const result = explainDecision({
        playerCards: [card("5"), card("5")],
        dealerUpcard: card("6"),
        userAction: "split",
        optimalAction: "double",
      });
      expect(result.isCorrect).toBe(false);
      expect(result.message.toLowerCase()).not.toContain("split");
      expect(result.message.toLowerCase()).toContain("doubl");
    });

    it("5-5 vs 6 (optimal double), user hit: recommends doubling, not splitting", () => {
      const result = explainDecision({
        playerCards: [card("5"), card("5")],
        dealerUpcard: card("6"),
        userAction: "hit",
        optimalAction: "double",
      });
      expect(result.isCorrect).toBe(false);
      expect(result.message.toLowerCase()).not.toContain("split");
      expect(result.message.toLowerCase()).toContain("doubl");
    });

    it("5-5 vs 10 (optimal hit), user split: does not mention splitting or doubling", () => {
      const result = explainDecision({
        playerCards: [card("5"), card("5")],
        dealerUpcard: card("10"),
        userAction: "split",
        optimalAction: "hit",
      });
      expect(result.isCorrect).toBe(false);
      expect(result.message.toLowerCase()).not.toContain("split");
      expect(result.message.toLowerCase()).not.toContain("doubl");
      expect(result.message.toLowerCase()).toContain("hit");
    });

    it("5-5 vs 10 (optimal hit) played correctly does not mention doubling", () => {
      const result = explainDecision({
        playerCards: [card("5"), card("5")],
        dealerUpcard: card("10"),
        userAction: "hit",
        optimalAction: "hit",
      });
      expect(result.isCorrect).toBe(true);
      expect(result.message.toLowerCase()).not.toContain("doubl");
    });
  });

  describe("situation family matches optimalAction", () => {
    // action -> a keyword the templates for that action consistently use.
    const ACTION_KEYWORD: Record<Action, RegExp> = {
      hit: /hit/i,
      stand: /stand/i,
      double: /doubl/i,
      split: /split/i,
    };

    const OPPOSITE_KEYWORD: Record<Action, RegExp | null> = {
      hit: /\bstand(s|ing)?\b/i,
      stand: /\bhit(s|ting)?\b/i,
      double: null,
      split: null,
    };

    const cases: Array<{
      name: string;
      playerCards: [Rank, Rank];
      dealerUpcard: Rank;
      optimalAction: Action;
    }> = [
      { name: "hard 16 vs 10 (hit)", playerCards: ["10", "6"], dealerUpcard: "10", optimalAction: "hit" },
      { name: "hard 13 vs 2 (stand)", playerCards: ["10", "3"], dealerUpcard: "2", optimalAction: "stand" },
      { name: "hard 12 vs 3 (hit)", playerCards: ["10", "2"], dealerUpcard: "3", optimalAction: "hit" },
      { name: "6-6 vs 4 (split)", playerCards: ["6", "6"], dealerUpcard: "4", optimalAction: "split" },
      { name: "7-7 vs 5 (split)", playerCards: ["7", "7"], dealerUpcard: "5", optimalAction: "split" },
      { name: "8-8 vs 10 (split)", playerCards: ["8", "8"], dealerUpcard: "10", optimalAction: "split" },
      { name: "hard 15 vs 6 (stand)", playerCards: ["10", "5"], dealerUpcard: "6", optimalAction: "stand" },
    ];

    it.each(cases)("$name explains the optimal action correctly", ({ playerCards, dealerUpcard, optimalAction }) => {
      const result = explainDecision({
        playerCards: [card(playerCards[0]), card(playerCards[1])],
        dealerUpcard: card(dealerUpcard),
        userAction: optimalAction,
        optimalAction,
      });
      expect(result.message).toMatch(ACTION_KEYWORD[optimalAction]);
    });

    // A "wrong" action to feed as userAction so the result is a miss. Split
    // hands can also legally be hit, so "hit" always works as the miss.
    const WRONG_ACTION: Record<Action, Action> = {
      hit: "stand",
      stand: "hit",
      double: "hit",
      split: "hit",
    };

    it.each(cases)("$name explains a miss by naming the optimal action", ({ playerCards, dealerUpcard, optimalAction }) => {
      const result = explainDecision({
        playerCards: [card(playerCards[0]), card(playerCards[1])],
        dealerUpcard: card(dealerUpcard),
        userAction: WRONG_ACTION[optimalAction],
        optimalAction,
      });
      expect(result.isCorrect).toBe(false);
      expect(result.message).toMatch(ACTION_KEYWORD[optimalAction]);
      const opposite = OPPOSITE_KEYWORD[optimalAction];
      if (opposite) {
        expect(result.message).not.toMatch(opposite);
      }
    });

    it("explains missing a hit on hard 16 vs 10 by recommending hitting, not standing", () => {
      const result = explainDecision({
        playerCards: [card("10"), card("6")],
        dealerUpcard: card("10"),
        userAction: "stand",
        optimalAction: "hit",
      });
      expect(result.isCorrect).toBe(false);
      expect(result.message.toLowerCase()).toContain("hit");
      expect(result.message).not.toMatch(/\bstand(s|ing)?\b/i);
    });

    it("explains missing a split on 6-6 vs 4 by recommending splitting, not standing", () => {
      const result = explainDecision({
        playerCards: [card("6"), card("6")],
        dealerUpcard: card("4"),
        userAction: "hit",
        optimalAction: "split",
      });
      expect(result.isCorrect).toBe(false);
      expect(result.message.toLowerCase()).toContain("split");
      expect(result.message).not.toMatch(/\bstand(s|ing)?\b/i);
    });

    it("stiff hand vs a strong dealer card explains hitting, not standing", () => {
      const result = explainDecision({
        playerCards: [card("10"), card("6")],
        dealerUpcard: card("10"),
        userAction: "hit",
        optimalAction: "hit",
      });
      expect(result.message).not.toMatch(/\bstand(s|ing)?\b/i);
    });

    it("does not describe a pair that should split as standing", () => {
      const result = explainDecision({
        playerCards: [card("8"), card("8")],
        dealerUpcard: card("10"),
        userAction: "split",
        optimalAction: "split",
      });
      expect(result.message.toLowerCase()).toContain("split");
      expect(result.message).not.toMatch(/\bstand(s|ing)?\b/i);
    });

    it("generic guard: message never recommends the opposite of optimalAction", () => {
      const upcards: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];
      const hardHands: Array<[Rank, Rank]> = [
        ["10", "2"],
        ["10", "3"],
        ["10", "4"],
        ["10", "5"],
        ["10", "6"],
      ];

      for (const hand of hardHands) {
        for (const upcard of upcards) {
          const playerCards = [card(hand[0]), card(hand[1])];
          const dealerUpcard = card(upcard);
          const optimal = optimalAction(playerCards, dealerUpcard, DEFAULT_RULES);
          const result = explainDecision({
            playerCards,
            dealerUpcard,
            userAction: optimal,
            optimalAction: optimal,
          });
          const opposite = OPPOSITE_KEYWORD[optimal];
          if (opposite) {
            expect(result.message).not.toMatch(opposite);
          }
        }
      }
    });

    it("full sweep: every 2-card starting hand vs every dealer upcard has a specific explanation whose family matches optimalAction, never the generic fallback", () => {
      const GENERIC_PERFECT = "That is exactly the play basic strategy recommends for this situation.";
      const GENERIC_MISS =
        "Basic strategy calls for a different move here, keep practicing this spot and it will click.";

      const ranks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];
      const upcards: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];
      // A rank representative for each 10-value card, so K/Q/J combinations
      // (which are all equivalent to "10" for strategy purposes) don't need
      // to be swept separately.

      const failures: string[] = [];

      for (const rankA of ranks) {
        for (const rankB of ranks) {
          const playerCards = [card(rankA), card(rankB)];
          for (const upcard of upcards) {
            const dealerUpcard = card(upcard);
            const optimal = optimalAction(playerCards, dealerUpcard, DEFAULT_RULES);

            const correctResult = explainDecision({
              playerCards,
              dealerUpcard,
              userAction: optimal,
              optimalAction: optimal,
            });
            if (correctResult.message === GENERIC_PERFECT) {
              failures.push(
                `${rankA}-${rankB} vs ${upcard}: correct-answer message for "${optimal}" fell back to the generic message`,
              );
            }
            // The family used for a correct answer must actually be the
            // family for the action that was taken (e.g. the "standing is
            // the play" family is only ever reachable when optimalAction
            // is "stand"), not just any non-generic template.
            if (!ACTION_KEYWORD[optimal].test(correctResult.message)) {
              failures.push(
                `${rankA}-${rankB} vs ${upcard}: correct-answer message for "${optimal}" does not name "${optimal}" ("${correctResult.message}")`,
              );
            }

            for (const wrongAction of ["hit", "stand", "double", "split"] as Action[]) {
              if (wrongAction === optimal) continue;
              const missResult = explainDecision({
                playerCards,
                dealerUpcard,
                userAction: wrongAction,
                optimalAction: optimal,
              });
              if (missResult.message === GENERIC_MISS) {
                failures.push(
                  `${rankA}-${rankB} vs ${upcard}, user ${wrongAction} (optimal ${optimal}): miss message fell back to the generic message`,
                );
              }
              // Same guard for a miss: the family must recommend the actual
              // optimalAction, and never the opposite of it.
              if (!ACTION_KEYWORD[optimal].test(missResult.message)) {
                failures.push(
                  `${rankA}-${rankB} vs ${upcard}, user ${wrongAction} (optimal ${optimal}): miss message does not name the optimal action "${optimal}" ("${missResult.message}")`,
                );
              }
              const opposite = OPPOSITE_KEYWORD[optimal];
              if (opposite && opposite.test(missResult.message)) {
                failures.push(
                  `${rankA}-${rankB} vs ${upcard}, user ${wrongAction} (optimal ${optimal}): miss message wrongly recommends the opposite of "${optimal}" ("${missResult.message}")`,
                );
              }
            }
          }
        }
      }

      expect(failures).toEqual([]);
    });
  });
});
