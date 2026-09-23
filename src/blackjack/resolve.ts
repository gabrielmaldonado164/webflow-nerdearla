/**
 * Plays a hand out to a real outcome: deals the dealer's hole card,
 * applies the player's chosen (graded) first action, auto-plays any
 * remaining decisions with basic strategy, plays the dealer's hand per
 * `GameRules`, and reports win/lose/push per player hand.
 *
 * Grading still happens against `optimalAction` on the *first* decision
 * (see `explain.ts` / `strategy.ts`); this module only decides what the
 * hand looks like once it is actually played out, purely for display.
 */

import type { Action } from "./actions";
import { availableActions } from "./actions";
import type { Card } from "./cards";
import { rankValue } from "./cards";
import { handValue, isBlackjack, isBust } from "./hand";
import type { GameRules } from "./rules";
import { DEFAULT_RULES } from "./rules";
import { optimalAction } from "./strategy";

export type HandOutcome = "win" | "lose" | "push" | "blackjack";

/** Maximum redraws before giving up on a non-blackjack hole card. */
const MAX_HOLE_CARD_ATTEMPTS = 1000;

export interface ResolvedPlayerHand {
  cards: Card[];
  total: number;
  doubled: boolean;
  busted: boolean;
  outcome: HandOutcome;
}

export interface ResolveStep {
  actor: "player" | "dealer";
  /** Which player hand the card belongs to (0 for a single, unsplit hand). */
  handIndex: number;
  card: Card;
}

export interface ResolveHandInput {
  playerCards: readonly Card[];
  dealerUpcard: Card;
  holeCard: Card;
  action: Action;
  draw: () => Card;
  rules?: GameRules;
}

export interface ResolveHandResult {
  playerHands: ResolvedPlayerHand[];
  dealerCards: Card[];
  dealerTotal: number;
  dealerBusted: boolean;
  steps: ResolveStep[];
}

/**
 * Deals the dealer's hole card, redrawing while it would complete a
 * dealer blackjack. Basic strategy assumes the US peek rule, so a hand
 * the player actually gets to act on never faces a dealer natural.
 *
 * Bounded at `MAX_HOLE_CARD_ATTEMPTS` redraws: a real shoe always yields
 * a non-blackjack hole card well before that, so hitting the bound means
 * `draw` itself is degenerate (e.g. always returning a ten-value card
 * for an Ace upcard), and continuing to loop would hang the caller.
 */
export function dealHoleCard(upcard: Card, draw: () => Card): Card {
  for (let attempt = 0; attempt < MAX_HOLE_CARD_ATTEMPTS; attempt++) {
    const hole = draw();
    if (!isBlackjack([upcard, hole])) {
      return hole;
    }
  }
  throw new Error(
    `dealHoleCard could not find a non-blackjack hole card for a ${upcard.rank} upcard ` +
      `after ${MAX_HOLE_CARD_ATTEMPTS} attempts; the draw function is likely degenerate`,
  );
}

interface PlayedHand {
  cards: Card[];
  doubled: boolean;
}

/**
 * Auto-plays a live hand to completion by repeatedly following
 * `optimalAction`, recording every drawn card as a step. Used both to
 * continue a hand after the player's graded "hit", and to play out each
 * hand created by a "split" from scratch.
 */
function playToCompletion(
  cards: Card[],
  dealerUpcard: Card,
  draw: () => Card,
  rules: GameRules,
  isAfterSplit: boolean,
  handIndex: number,
  steps: ResolveStep[],
): PlayedHand {
  let current = cards;
  for (;;) {
    const action = optimalAction(current, dealerUpcard, rules, { isAfterSplit });
    switch (action) {
      case "stand":
        return { cards: current, doubled: false };
      case "double": {
        const drawn = draw();
        steps.push({ actor: "player", handIndex, card: drawn });
        return { cards: [...current, drawn], doubled: true };
      }
      case "hit": {
        const drawn = draw();
        steps.push({ actor: "player", handIndex, card: drawn });
        current = [...current, drawn];
        if (isBust(current)) {
          return { cards: current, doubled: false };
        }
        break;
      }
      default:
        // "split" can never actually come back from optimalAction here:
        // isAfterSplit blocks it in the pair check (no resplitting in
        // v1), regardless of whether the hand drew a matching card. This
        // branch only guards against a future strategy change silently
        // being treated as a "hit".
        throw new Error(
          `playToCompletion received an unexpected auto-play action "${action}" for a ` +
            `${current.length}-card hand (isAfterSplit=${isAfterSplit}); only "hit", ` +
            `"stand", and "double" are supported here.`,
        );
    }
  }
}

/** Applies the player's graded first action, then auto-plays if the hand survives. */
function playFirstAction(
  playerCards: readonly Card[],
  dealerUpcard: Card,
  draw: () => Card,
  rules: GameRules,
  action: Action,
  steps: ResolveStep[],
): PlayedHand[] {
  if (action === "stand") {
    return [{ cards: [...playerCards], doubled: false }];
  }

  if (action === "double") {
    const drawn = draw();
    steps.push({ actor: "player", handIndex: 0, card: drawn });
    return [{ cards: [...playerCards, drawn], doubled: true }];
  }

  if (action === "split") {
    const isAceSplit = rankValue(playerCards[0].rank) === 11;
    return playerCards.map((startCard, handIndex) => {
      const drawn = draw();
      steps.push({ actor: "player", handIndex, card: drawn });
      const initial = [startCard, drawn];
      if (isAceSplit && rules.splitAcesReceiveOneCardEach) {
        // Split Aces get exactly one card each and stop, even if that
        // card would otherwise invite another decision.
        return { cards: initial, doubled: false };
      }
      return playToCompletion(initial, dealerUpcard, draw, rules, true, handIndex, steps);
    });
  }

  // action === "hit"
  const drawn = draw();
  steps.push({ actor: "player", handIndex: 0, card: drawn });
  const hitCards = [...playerCards, drawn];
  if (isBust(hitCards)) {
    return [{ cards: hitCards, doubled: false }];
  }
  return [playToCompletion(hitCards, dealerUpcard, draw, rules, false, 0, steps)];
}

/** Plays the dealer's hand from the upcard and hole card, per `GameRules`. */
function playDealerHand(
  dealerUpcard: Card,
  holeCard: Card,
  draw: () => Card,
  rules: GameRules,
  steps: ResolveStep[],
): Card[] {
  let cards = [dealerUpcard, holeCard];
  let { total, isSoft } = handValue(cards);
  while (total < 17 || (total === 17 && isSoft && !rules.dealerStandsOnSoft17)) {
    const drawn = draw();
    steps.push({ actor: "dealer", handIndex: 0, card: drawn });
    cards = [...cards, drawn];
    ({ total, isSoft } = handValue(cards));
  }
  return cards;
}

function outcomeFor(
  hand: PlayedHand,
  isSplitAction: boolean,
  dealerTotal: number,
  dealerBusted: boolean,
  dealerHasBlackjack: boolean,
): HandOutcome {
  const { total } = handValue(hand.cards);
  if (total > 21) {
    return "lose";
  }

  // A "natural" blackjack only ever comes from the original, unsplit
  // two-card hand: a 21 reached after a split (e.g. split Aces plus a
  // ten) plays as a plain 21, not a blackjack.
  const isNaturalBlackjack = !isSplitAction && hand.cards.length === 2 && total === 21;
  if (isNaturalBlackjack) {
    return dealerHasBlackjack ? "push" : "blackjack";
  }

  if (dealerHasBlackjack) {
    return "lose";
  }
  if (dealerBusted) {
    return "win";
  }
  if (total > dealerTotal) {
    return "win";
  }
  if (total < dealerTotal) {
    return "lose";
  }
  return "push";
}

/**
 * Validates that `action` is actually legal for `playerCards` under
 * `rules`, delegating legality to `availableActions` so the rules stay
 * defined in one place.
 */
function validateResolveHandInputs(
  playerCards: readonly Card[],
  action: Action,
  rules: GameRules,
): void {
  const legalActions = availableActions(playerCards, rules);
  if (!legalActions.includes(action)) {
    throw new Error(
      `"${action}" is not a legal action for this hand (${playerCards.length} card(s)); ` +
        `available actions are: ${legalActions.join(", ")}`,
    );
  }
}

/**
 * Plays a hand out to a real result: applies the player's graded first
 * action (auto-playing any remaining decisions with basic strategy),
 * plays the dealer's hand, and reports each player hand's outcome.
 */
export function resolveHand(input: ResolveHandInput): ResolveHandResult {
  const { playerCards, dealerUpcard, holeCard, action, draw, rules = DEFAULT_RULES } = input;
  validateResolveHandInputs(playerCards, action, rules);

  const steps: ResolveStep[] = [];
  const playedHands = playFirstAction(playerCards, dealerUpcard, draw, rules, action, steps);

  const anyHandLive = playedHands.some((hand) => !isBust(hand.cards));
  const dealerCards = anyHandLive
    ? playDealerHand(dealerUpcard, holeCard, draw, rules, steps)
    : [dealerUpcard, holeCard];

  const dealerValue = handValue(dealerCards);
  const dealerBusted = dealerValue.total > 21;
  const dealerHasBlackjack = dealerCards.length === 2 && dealerValue.total === 21;
  const isSplitAction = action === "split";

  const playerHands: ResolvedPlayerHand[] = playedHands.map((hand) => {
    const { total } = handValue(hand.cards);
    return {
      cards: hand.cards,
      total,
      doubled: hand.doubled,
      busted: total > 21,
      outcome: outcomeFor(hand, isSplitAction, dealerValue.total, dealerBusted, dealerHasBlackjack),
    };
  });

  return {
    playerHands,
    dealerCards,
    dealerTotal: dealerValue.total,
    dealerBusted,
    steps,
  };
}
