/**
 * Public API of the blackjack domain engine. Pure TypeScript, no
 * framework imports — safe to use from any runtime, including
 * Cloudflare Workers.
 */

export type { Card, Rank, Suit } from "./cards";
export { drawCard, rankValue, RANKS, SUITS } from "./cards";

export type { HandValue } from "./hand";
export { handValue, isBlackjack, isBust, isPair, totalFromValues } from "./hand";

export type { GameRules } from "./rules";
export { DEFAULT_RULES } from "./rules";

export type { Action, ActionContext } from "./actions";
export { availableActions } from "./actions";

export type { DealerUpcardValue, StrategyContext } from "./strategy";
export { dealerUpcardValue, optimalAction } from "./strategy";

export type { ScenarioCategory, ScenarioClassification } from "./category";
export { classifyScenario } from "./category";

export { createRng, seedFromString } from "./rng";

export type { CategoryWeights, GenerateScenarioOptions, Scenario } from "./scenario";
export { generateScenario } from "./scenario";

export type { SimulateEvOptions, SimulateEvResult } from "./simulate";
export { simulateAllActions, simulateEV } from "./simulate";

export type { ExplainDecisionInput, ExplainDecisionResult } from "./explain";
export { explainDecision } from "./explain";

export type {
  HandOutcome,
  ResolveHandInput,
  ResolveHandResult,
  ResolvedPlayerHand,
  ResolveStep,
} from "./resolve";
export { dealHoleCard, resolveHand } from "./resolve";
