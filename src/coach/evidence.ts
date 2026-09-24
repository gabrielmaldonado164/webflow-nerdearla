import {
  DEFAULT_RULES,
  availableActions,
  createRng,
  optimalAction,
  simulateAllActions,
  type Action,
  type SimulateEvResult,
} from "@/blackjack";
import { parseDecisionPayload } from "@/player/decisionPayload";

export interface CoachEvidence {
  optimalAction: Action;
  ev: SimulateEvResult[];
}

export type EvidenceResult =
  | { ok: true; input: NonNullable<Extract<ReturnType<typeof parseDecisionPayload>, { ok: true }>["value"]>; evidence: CoachEvidence }
  | { ok: false; reason: string };

export const EV_ITERATIONS = 1200;

/** Never trust client grading or action availability. The engine owns both. */
export function buildEvidence(raw: unknown): EvidenceResult {
  const parsed = parseDecisionPayload(raw);
  if (!parsed.ok) return parsed;

  const { playerCards, dealerUpcard, userAction } = parsed.value;
  const actions = availableActions(playerCards, DEFAULT_RULES);
  if (!actions.includes(userAction)) {
    return { ok: false, reason: "userAction is not available for this hand" };
  }
  if (typeof raw === "object" && raw !== null && "availableActions" in raw) {
    const claimed = (raw as { availableActions: unknown }).availableActions;
    if (!Array.isArray(claimed) || claimed.length !== actions.length ||
        !actions.every((action) => claimed.includes(action))) {
      return { ok: false, reason: "availableActions does not match the hand" };
    }
  }

  return {
    ok: true,
    input: parsed.value,
    evidence: {
      optimalAction: optimalAction(playerCards, dealerUpcard, DEFAULT_RULES),
      ev: simulateAllActions(playerCards, dealerUpcard, {
        rng: createRng(0x21ab), rules: DEFAULT_RULES, iterations: EV_ITERATIONS,
      }),
    },
  };
}
