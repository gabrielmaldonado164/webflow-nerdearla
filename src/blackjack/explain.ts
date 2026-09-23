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
  | "split-pair"
  | "never-split-tens"
  | "pair-fives-double"
  | "pair-fives-hit"
  | "pair-hit"
  | "pair-stand"
  | "soft-double"
  | "soft-hit"
  | "soft-18-hit"
  | "soft-18-stand"
  | "soft-19-plus-stand"
  | "double-9-11"
  | "hard-low-hit"
  | "hard-9-11-hit"
  | "stiff-hand-stand"
  | "stiff-hand-hit"
  | "hard-high-stand"
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
  "split-pair": {
    perfect: "Splitting this pair turns one so-so hand into two hands with a better shot each.",
    miss: "This pair plays better split into two separate hands than kept as one, give it a try next time.",
  },
  "never-split-tens": {
    perfect: "Two ten-value cards already make 20, so standing keeps that great hand intact.",
    miss: "A pair of tens is already a strong 20, so standing is the best call here.",
  },
  "pair-fives-double": {
    perfect: "5-5 plays best as a hard 10, a great total to double on.",
    miss: "5-5 is really a hard 10, one of the best totals to double, so doubling down is the strongest play here.",
  },
  "pair-fives-hit": {
    perfect: "5-5 is a hard 10 here, and hitting keeps working toward a stronger total against this dealer card.",
    miss: "5-5 plays as a hard 10, and against this dealer card hitting is the play that keeps you in the hand.",
  },
  "pair-hit": {
    perfect: "This pair plays best as a hand you keep building, so hitting is the strongest move here.",
    miss: "This pair still needs work against this dealer card, hitting is the play that keeps building toward a better total.",
  },
  "pair-stand": {
    perfect: "This pair already adds up to a solid total, so standing locks it in.",
    miss: "This pair already adds up to a solid total, so standing is the play here instead of drawing again.",
  },
  "soft-double": {
    perfect: "With an Ace as a safety net, doubling here adds value without extra bust risk.",
    miss: "The Ace acts as a safety net here, so doubling adds value with little extra risk.",
  },
  "soft-hit": {
    perfect: "A soft total can't bust with one card, so taking a hit is free improvement here.",
    miss: "This soft total can't bust on one more card, so hitting is free improvement against this dealer card.",
  },
  "soft-18-hit": {
    perfect: "Soft 18 is not enough against this strong dealer card, so hitting gives it room to grow.",
    miss: "Soft 18 is not enough against this strong dealer card, hitting is how you improve it safely.",
  },
  "soft-18-stand": {
    perfect: "Soft 18 is a solid total against this dealer card, so standing locks in the value.",
    miss: "Soft 18 already holds up well against this dealer card, so standing is the stronger play here.",
  },
  "soft-19-plus-stand": {
    perfect: "A soft total this high is already strong, so standing keeps that value locked in.",
    miss: "This soft total is already strong enough on its own, so standing is the play here.",
  },
  "double-9-11": {
    perfect: "Doubling on a strong total like this squeezes out extra value before the dealer plays.",
    miss: "Totals of 9, 10, or 11 are prime spots to double, one more card is likely to make a great hand.",
  },
  "hard-low-hit": {
    perfect: "This total is far too low to hold, so hitting is the only real option.",
    miss: "This total is too low to hold here, hitting is the play that keeps the hand alive.",
  },
  "hard-9-11-hit": {
    perfect: "Doubling is not the strongest choice against this dealer card, so hitting keeps building the total.",
    miss: "Doubling is not the best fit against this dealer card, so hitting is the play that keeps improving the hand.",
  },
  "stiff-hand-stand": {
    perfect: "Against a dealer bust card, standing lets the dealer take the risk instead of you.",
    miss: "Stiff hands like this do best when you stand against low dealer cards, letting the dealer risk busting first.",
  },
  "stiff-hand-hit": {
    perfect: "The dealer will likely make 17 or more here, so hitting gives this weak total a better chance.",
    miss: "Against a strong dealer card the dealer will likely make 17+, so this 12-16 needs a hit more often than not.",
  },
  "hard-high-stand": {
    perfect: "This total is already strong enough to beat the dealer, so standing is the smart move.",
    miss: "This total is already strong on its own, so standing is the play instead of risking a bust.",
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
    if (value === 5) {
      // 5-5 is never split: it plays as a hard 10, which is either a
      // double or a hit depending on the dealer's upcard. The family must
      // follow the engine's actual recommendation so the message never
      // mentions doubling when the optimal play was hitting (or vice
      // versa), and never implies the user's mistake was splitting when
      // they may have hit, stood, or doubled instead.
      return optimalAction === "double" ? "pair-fives-double" : "pair-fives-hit";
    }
    // Any other pair that the strategy engine says to split (e.g. 6-6, 7-7)
    // must be explained as a split, checked before the hit/stand branches
    // below so a splittable pair isn't misexplained as a plain hit/stand.
    if (optimalAction === "split") return "split-pair";
    // Pairs that are not split (e.g. 6-6 vs a strong dealer card, or 9-9
    // vs 7/10/A) still need a pair-aware, non-generic explanation rather
    // than falling through to the hard-total logic below.
    if (optimalAction === "hit") return "pair-hit";
    if (optimalAction === "stand") return "pair-stand";
  }

  const { total, isSoft } = handValue(playerCards);

  if (isSoft) {
    if (optimalAction === "double") return "soft-double";
    if (total === 18) {
      return optimalAction === "hit" ? "soft-18-hit" : "soft-18-stand";
    }
    if (total >= 19) return "soft-19-plus-stand";
    // Soft 13-17 that isn't a double is always a hit.
    return "soft-hit";
  }

  if (total >= 9 && total <= 11) {
    if (optimalAction === "double") return "double-9-11";
    return "hard-9-11-hit";
  }
  if (total <= 8) return "hard-low-hit";
  if (total >= 12 && total <= 16) {
    // The family follows the strategy engine's actual recommendation
    // rather than assuming standing is always correct: hard 12-16 vs a
    // strong dealer card (or hard 12 vs 2-3) is a hit, not a stand.
    return optimalAction === "hit" ? "stiff-hand-hit" : "stiff-hand-stand";
  }

  return "hard-high-stand";
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
