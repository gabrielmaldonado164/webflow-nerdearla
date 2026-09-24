import { createRng, DEFAULT_RULES, generateScenario, optimalAction, seedFromString } from "@/blackjack";
import type { Action, Card, Scenario, ScenarioCategory } from "@/blackjack";

export const DAILY_HAND_COUNT = 10;
export const DAILY_MISS_LIMIT = 3;
export const DAILY_VERSION = "daily-v1";

export type CanonicalDailyScenario = Scenario;

export interface PublicDailyScenario {
  playerCards: Card[];
  dealerUpcard: Card;
  availableActions: Action[];
  category: ScenarioCategory;
  label: string;
}

export type DailyScenario = PublicDailyScenario;

export interface DailyResult {
  date: string;
  score: number;
  attempts: number;
  accuracy: number;
  durationMs: number;
}

/** Each hand has its own RNG stream so actions never alter later hands. */
export function generateDailyScenarios(date: string): CanonicalDailyScenario[] {
  return Array.from({ length: DAILY_HAND_COUNT }, (_, index) =>
    generateScenario(createRng(seedFromString(`${DAILY_VERSION}:${date}:${index}`)), DEFAULT_RULES),
  );
}

export function publicDailyScenario(scenario: CanonicalDailyScenario): PublicDailyScenario {
  const { playerCards, dealerUpcard, availableActions, category, label } = scenario;
  return { playerCards, dealerUpcard, availableActions, category, label };
}

/** Shared progress calculation; the server still uses its persisted canonical set. */
export function evaluateDailyActions(scenarios: readonly PublicDailyScenario[], actions: readonly Action[]) {
  let score = 0;
  let misses = 0;
  const correctness = actions.map((action, index) => {
    const scenario = scenarios[index];
    const correct = Boolean(scenario && scenario.availableActions.includes(action) &&
      action === optimalAction(scenario.playerCards, scenario.dealerUpcard, DEFAULT_RULES));
    if (correct) score += 1;
    else misses += 1;
    return correct;
  });
  return { score, misses, correctness, attempts: actions.length, complete: actions.length >= DAILY_HAND_COUNT || misses >= DAILY_MISS_LIMIT };
}

export type GradeDailyResult =
  | { ok: true; result: DailyResult }
  | { ok: false; reason: string };

/** Regrade the complete, legal sequence; score is never accepted from the client. */
export function gradeDailyResult(
  date: string,
  scenarios: readonly CanonicalDailyScenario[],
  actions: readonly Action[],
  durationMs: number,
): GradeDailyResult {
  if (scenarios.length !== DAILY_HAND_COUNT || actions.length === 0 || actions.length > DAILY_HAND_COUNT) {
    return { ok: false, reason: "invalid challenge length" };
  }
  let score = 0;
  let misses = 0;
  for (const [index, action] of actions.entries()) {
    const scenario = scenarios[index];
    if (!scenario.availableActions.includes(action)) return { ok: false, reason: "illegal action" };
    if (action === scenario.optimalAction) score += 1;
    else misses += 1;
    if (misses >= DAILY_MISS_LIMIT && index !== actions.length - 1) {
      return { ok: false, reason: "actions after challenge ended" };
    }
  }
  if (actions.length !== DAILY_HAND_COUNT && misses < DAILY_MISS_LIMIT) {
    return { ok: false, reason: "challenge is unfinished" };
  }
  return {
    ok: true,
    result: {
      date,
      score,
      attempts: actions.length,
      accuracy: Math.round((score / actions.length) * 100),
      durationMs,
    },
  };
}

/** Today, or yesterday during the first 15 UTC minutes, can be submitted. */
export function isSubmittableDailyDate(date: string, now: Date): boolean {
  const today = now.toISOString().slice(0, 10);
  if (date === today) return true;
  if (now.getUTCHours() !== 0 || now.getUTCMinutes() >= 15) return false;
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
    .toISOString().slice(0, 10);
  return date === yesterday;
}
