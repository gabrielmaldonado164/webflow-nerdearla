/**
 * Generates a single training scenario: a random player hand, a dealer
 * upcard, and the derived strategy metadata for it.
 */

import type { Action } from "./actions";
import { availableActions } from "./actions";
import type { Card } from "./cards";
import { drawCard } from "./cards";
import type { ScenarioCategory } from "./category";
import { classifyScenario } from "./category";
import { isBlackjack } from "./hand";
import type { GameRules } from "./rules";
import { optimalAction } from "./strategy";

export interface CategoryWeights {
  hard?: number;
  soft?: number;
  pair?: number;
}

export interface GenerateScenarioOptions {
  /** Restrict generation to a single category. */
  category?: ScenarioCategory;
  /** Relative weights used to pick a category when none is forced. */
  weights?: CategoryWeights;
}

export interface Scenario {
  playerCards: Card[];
  dealerUpcard: Card;
  availableActions: Action[];
  optimalAction: Action;
  category: ScenarioCategory;
  label: string;
}

const DEFAULT_WEIGHTS: Required<CategoryWeights> = { hard: 1, soft: 1, pair: 1 };

/** Maximum attempts before giving up on matching the requested category. */
const MAX_ATTEMPTS = 1000;

function pickWeightedCategory(
  rng: () => number,
  weights: CategoryWeights,
): ScenarioCategory {
  const resolved = { ...DEFAULT_WEIGHTS, ...weights };
  const total = resolved.hard + resolved.soft + resolved.pair;
  const roll = rng() * total;
  if (roll < resolved.hard) return "hard";
  if (roll < resolved.hard + resolved.soft) return "soft";
  return "pair";
}

function dealTwoPlayerCards(rng: () => number): Card[] {
  return [drawCard(rng), drawCard(rng)];
}

/**
 * Generates a random, playable scenario. Player blackjacks are skipped
 * (there is no decision to make on a natural 21). When a category is
 * requested (explicitly, or picked via weights), hands are re-drawn until
 * one matches, up to a generous attempt limit; if that limit is somehow
 * reached, the last drawn hand is returned rather than looping forever.
 */
export function generateScenario(
  rng: () => number,
  rules: GameRules,
  options: GenerateScenarioOptions = {},
): Scenario {
  const targetCategory = options.category ?? pickWeightedCategory(rng, options.weights ?? {});

  let playerCards = dealTwoPlayerCards(rng);
  let dealerUpcard = drawCard(rng);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const skip = isBlackjack(playerCards);
    const classification = classifyScenario(playerCards);
    if (!skip && classification.category === targetCategory) {
      break;
    }
    playerCards = dealTwoPlayerCards(rng);
    dealerUpcard = drawCard(rng);
  }

  const classification = classifyScenario(playerCards);
  return {
    playerCards,
    dealerUpcard,
    availableActions: availableActions(playerCards, rules),
    optimalAction: optimalAction(playerCards, dealerUpcard, rules),
    category: classification.category,
    label: classification.label,
  };
}
