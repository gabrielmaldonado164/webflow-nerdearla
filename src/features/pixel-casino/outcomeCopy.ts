/**
 * Pure copy selection for a resolved hand's outcome banner. Grading
 * (whether the player's decision was correct) and the hand's actual
 * outcome (win/lose/push/blackjack) are independent: a correct decision
 * can still lose the hand, and a wrong one can still win it. When they
 * diverge, the banner gets an explanatory note; otherwise none.
 */

import type { HandOutcome } from "@/blackjack";

export interface OutcomeCopyInput {
  outcome: HandOutcome;
  /** Whether the *decision* (not the outcome) matched `optimalAction`. */
  isCorrectDecision: boolean;
}

export interface OutcomeCopy {
  /** Short banner text for the hand result stamp. */
  banner: string;
  /** Explanatory note, only when the decision and the outcome disagree. */
  note: string | null;
}

const BANNER_TEXT: Record<HandOutcome, string> = {
  win: "WIN",
  lose: "LOSE",
  push: "PUSH",
  blackjack: "BLACKJACK!",
};

const LOST_DESPITE_CORRECT_NOTE = "Right call. The cards just didn't fall your way.";
const WON_DESPITE_WRONG_NOTE = "That win was luck, not the right play.";

export function outcomeCopy({ outcome, isCorrectDecision }: OutcomeCopyInput): OutcomeCopy {
  const banner = BANNER_TEXT[outcome];

  if (isCorrectDecision && outcome === "lose") {
    return { banner, note: LOST_DESPITE_CORRECT_NOTE };
  }
  if (!isCorrectDecision && (outcome === "win" || outcome === "blackjack")) {
    return { banner, note: WON_DESPITE_WRONG_NOTE };
  }
  return { banner, note: null };
}
