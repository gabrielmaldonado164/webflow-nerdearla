/**
 * Card primitives for the blackjack domain.
 * Pure TypeScript, no framework or Node-only APIs.
 */

export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const RANKS: readonly Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

export const SUITS: readonly Suit[] = ["hearts", "diamonds", "clubs", "spades"];

/**
 * Blackjack value of a rank, using the "high" ace value (11).
 * Face cards (J, Q, K) count as 10. Callers that need soft/hard
 * hand totals should reduce aces from 11 to 1 as needed (see `hand.ts`).
 */
export function rankValue(rank: Rank): number {
  if (rank === "A") {
    return 11;
  }
  if (rank === "J" || rank === "Q" || rank === "K") {
    return 10;
  }
  return Number(rank);
}

/**
 * Draws a uniformly random card using the given RNG (a function
 * returning a float in [0, 1)). Every rank is equally likely (1/13),
 * which mirrors the composition of any number of full 52-card decks
 * (each rank always has the same proportion of the shoe), so this is
 * accurate for both a real 6-deck shoe and the infinite-deck
 * approximation used in `simulate.ts`.
 */
export function drawCard(rng: () => number): Card {
  const rank = RANKS[Math.floor(rng() * RANKS.length)];
  const suit = SUITS[Math.floor(rng() * SUITS.length)];
  return { rank, suit };
}
