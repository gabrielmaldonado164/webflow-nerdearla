/**
 * The RNG-touching half of dealing/deciding a practice session: gates on
 * `sessionReducer`'s pure predicates (`canDeal`/`canDecide`) *before*
 * drawing anything, then does the actual random work (`generateScenario`,
 * `dealHoleCard`, `resolveHand`) that `sessionReducer` itself can't do,
 * since it only ever sees pre-computed event data.
 *
 * Centralizing the gate-then-draw order here (instead of duplicating it
 * in `usePracticeSession`) guarantees an ignored attempt never consumes
 * the rng, which is what keeps a seeded session deterministic even when
 * ignored decisions are interleaved with accepted ones.
 *
 * `dealNextHandIfAllowed` accepts optional `CategoryWeights` (Phase 3
 * T3), forwarded as-is to `generateScenario`: `undefined` behaves
 * exactly like omitting the argument (the engine's own default,
 * uniform weights), so existing callers and seeded-determinism tests
 * are unaffected unless they opt in.
 */

import type { Action, Card, CategoryWeights, GameRules, ResolveHandResult, Scenario } from "@/blackjack";
import { dealHoleCard, drawCard, generateScenario, resolveHand } from "@/blackjack";

import { canDeal, canDecide, type SessionState } from "./sessionReducer";

export interface DealtHand {
  scenario: Scenario;
  holeCard: Card;
}

/**
 * Deals a fresh scenario + dealer hole card from `rng`, but only when
 * `canDeal(state)` is true. Returns `null`, without drawing anything,
 * when dealing isn't allowed (the run is over). `weights`, when given,
 * biases which category the scenario is drawn from (Phase 3 T3
 * adaptive practice); omitted or `undefined` falls back to the
 * engine's default uniform weighting.
 */
export function dealNextHandIfAllowed(
  state: SessionState,
  rng: () => number,
  rules: GameRules,
  weights?: CategoryWeights,
): DealtHand | null {
  if (!canDeal(state)) return null;
  const scenario = generateScenario(rng, rules, { weights });
  const holeCard = dealHoleCard(scenario.dealerUpcard, () => drawCard(rng));
  return { scenario, holeCard };
}

/**
 * Plays `action` out from `rng` against `state`'s current scenario and
 * hole card, but only when `canDecide(state, action)` is true. Returns
 * `null`, without drawing anything, when the decision isn't allowed (no
 * scenario dealt, feedback already pending, the run is over, or the
 * action isn't available for the scenario).
 */
export function resolveActionIfAllowed(
  state: SessionState,
  action: Action,
  rng: () => number,
  rules: GameRules,
): ResolveHandResult | null {
  if (!canDecide(state, action)) return null;
  const { scenario, holeCard } = state;
  if (!scenario || !holeCard) return null; // Unreachable when canDecide is true; narrows the types.

  return resolveHand({
    playerCards: scenario.playerCards,
    dealerUpcard: scenario.dealerUpcard,
    holeCard,
    action,
    draw: () => drawCard(rng),
    rules,
  });
}
