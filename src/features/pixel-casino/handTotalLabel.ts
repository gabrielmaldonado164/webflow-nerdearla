/**
 * Label for a hand's total, computed from the cards currently shown on
 * the table (not the final resolved hand), so the number follows the
 * reveal animation card by card and flips to BUST when it goes over 21.
 */

import type { Card } from "@/blackjack";
import { handValue } from "@/blackjack";

export function handTotalLabel(cards: readonly Card[]): string {
  const { total } = handValue(cards);
  return total > 21 ? "BUST" : String(total);
}
