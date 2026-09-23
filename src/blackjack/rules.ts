/**
 * Ruleset for a blackjack game/table. Modeled as data so that
 * variants (e.g. H17, resplitting) can be added later without
 * changing the engine's shape.
 */
export interface GameRules {
  /** Number of 52-card decks in the shoe. */
  numberOfDecks: number;
  /** True for S17 (dealer stands on soft 17); false would be H17. */
  dealerStandsOnSoft17: boolean;
  /** Doubling is allowed on any first two cards. */
  doubleOnAnyFirstTwo: boolean;
  /** Doubling is allowed after splitting (DAS). */
  doubleAfterSplit: boolean;
  /** Surrender is not offered in v1. */
  surrenderAllowed: boolean;
  /** Dealer checks for blackjack before the player acts. */
  dealerPeeksForBlackjack: boolean;
  /** Blackjack payout multiplier on the original bet (3:2 = 1.5). */
  blackjackPayout: number;
  /** Split Aces receive exactly one extra card each, then stand. */
  splitAcesReceiveOneCardEach: boolean;
  /**
   * Resplitting is not supported in v1: once a pair has been split,
   * neither resulting hand can be split again, even if it draws
   * another pair.
   */
  resplittingAllowed: boolean;
}

export const DEFAULT_RULES: GameRules = {
  numberOfDecks: 6,
  dealerStandsOnSoft17: true,
  doubleOnAnyFirstTwo: true,
  doubleAfterSplit: true,
  surrenderAllowed: false,
  dealerPeeksForBlackjack: true,
  blackjackPayout: 1.5,
  splitAcesReceiveOneCardEach: true,
  resplittingAllowed: false,
};
