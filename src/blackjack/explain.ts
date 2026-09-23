/**
 * Short, encouraging explanations for a decision, grouped by situation
 * family. No LLM involved: these are fixed templates driven by the
 * deterministic strategy engine.
 */

import type { Action } from "./actions";
import type { Card } from "./cards";
import { rankValue } from "./cards";
import { handValue, isPair } from "./hand";

export interface ExplainDecisionInput {
  playerCards: readonly Card[];
  dealerUpcard: Card;
  userAction: Action;
  optimalAction: Action;
}

export interface ExplainDecisionResult {
  isCorrect: boolean;
  title: "Perfect move" | "Not quite";
  message: string;
}

type SituationFamily =
  | "split-aces"
  | "split-eights"
  | "never-split-tens"
  | "never-split-fives"
  | "soft-double"
  | "double-10-11"
  | "stiff-hand"
  | "general";

const TEMPLATES: Record<SituationFamily, { perfect: string; miss: string }> = {
  "split-aces": {
    perfect: "Splitting Aces is always right here, two chances at a strong hand beat one.",
    miss: "Aces are always split, two shots at a strong hand beat one shaky total.",
  },
  "split-eights": {
    perfect: "Splitting 8s turns a rough 16 into two hands with real potential.",
    miss: "A pair of 8s is a weak 16 in disguise, splitting gives you two better hands instead.",
  },
  "never-split-tens": {
    perfect: "Two ten-value cards already make 20, no need to break up a great hand.",
    miss: "A pair of tens is already a strong 20, splitting would only weaken it.",
  },
  "never-split-fives": {
    perfect: "5-5 plays best as a hard 10, a great total to double on.",
    miss: "A pair of 5s plays as a hard 10, a strong doubling total, not a splitting hand.",
  },
  "soft-double": {
    perfect: "With an Ace as a safety net, doubling here adds value without extra bust risk.",
    miss: "The Ace acts as a safety net here, so doubling adds value with little extra risk.",
  },
  "double-10-11": {
    perfect: "Doubling on a strong total like this squeezes out extra value before the dealer plays.",
    miss: "Totals of 10 or 11 are prime spots to double, one more card is likely to make a great hand.",
  },
  "stiff-hand": {
    perfect: "Against a dealer bust card, standing lets the dealer take the risk instead of you.",
    miss: "Stiff hands like this do best against low dealer cards, let the dealer risk busting first.",
  },
  general: {
    perfect: "That is exactly the play basic strategy recommends for this situation.",
    miss: "Basic strategy calls for a different move here, keep practicing this spot and it will click.",
  },
};

function situationFamily(
  playerCards: readonly Card[],
  optimalAction: Action,
): SituationFamily {
  if (isPair(playerCards)) {
    const value = rankValue(playerCards[0].rank);
    if (value === 11) return "split-aces";
    if (value === 8) return "split-eights";
    if (value === 10) return "never-split-tens";
    if (value === 5) return "never-split-fives";
  }

  const { total, isSoft } = handValue(playerCards);
  if (isSoft && optimalAction === "double") return "soft-double";
  if (!isSoft && (total === 10 || total === 11) && optimalAction === "double") {
    return "double-10-11";
  }
  if (!isSoft && total >= 12 && total <= 16) return "stiff-hand";

  return "general";
}

export function explainDecision(input: ExplainDecisionInput): ExplainDecisionResult {
  const isCorrect = input.userAction === input.optimalAction;
  const family = situationFamily(input.playerCards, input.optimalAction);
  const template = TEMPLATES[family];

  return {
    isCorrect,
    title: isCorrect ? "Perfect move" : "Not quite",
    message: isCorrect ? template.perfect : template.miss,
  };
}
