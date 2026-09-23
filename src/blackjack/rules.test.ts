import { describe, expect, it } from "vitest";

import { DEFAULT_RULES } from "./rules";

describe("DEFAULT_RULES", () => {
  it("matches the v1 ruleset", () => {
    expect(DEFAULT_RULES).toEqual({
      numberOfDecks: 6,
      dealerStandsOnSoft17: true,
      doubleOnAnyFirstTwo: true,
      doubleAfterSplit: true,
      surrenderAllowed: false,
      dealerPeeksForBlackjack: true,
      blackjackPayout: 1.5,
      splitAcesReceiveOneCardEach: true,
      resplittingAllowed: false,
    });
  });
});
