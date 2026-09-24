import type { Action, Card, ScenarioCategory } from "@/blackjack";
import { RANKS, SUITS } from "@/blackjack";
import { DAILY_HAND_COUNT, type DailyResult, type DailyScenario } from "@/training/dailyChallenge";

export interface DailyChallengeResponse {
  date: string;
  scenarios: DailyScenario[];
  result: DailyResult | null;
}

const ACTIONS: readonly Action[] = ["hit", "stand", "double", "split"];
const CATEGORIES: readonly ScenarioCategory[] = ["hard", "soft", "pair"];

function endpoint(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/daily${path}`;
}

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<Card>;
  return RANKS.includes(card.rank as Card["rank"]) && SUITS.includes(card.suit as Card["suit"]);
}

function isScenario(value: unknown): value is DailyScenario {
  if (!value || typeof value !== "object") return false;
  const scenario = value as Partial<DailyScenario>;
  return Array.isArray(scenario.playerCards) && scenario.playerCards.length >= 2 && scenario.playerCards.every(isCard) &&
    isCard(scenario.dealerUpcard) && Array.isArray(scenario.availableActions) &&
    scenario.availableActions.length > 0 && scenario.availableActions.every((action) => ACTIONS.includes(action)) &&
    CATEGORIES.includes(scenario.category as ScenarioCategory) && typeof scenario.label === "string";
}

function isDailyResult(value: unknown): value is DailyResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<DailyResult>;
  return typeof result.date === "string" && Number.isInteger(result.score) &&
    Number.isInteger(result.attempts) && Number.isInteger(result.accuracy) &&
    Number.isInteger(result.durationMs);
}

export async function fetchDailyChallenge(signal: AbortSignal): Promise<DailyChallengeResponse | null> {
  try {
    const response = await fetch(endpoint(""), { credentials: "same-origin", signal });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") return null;
    const value = body as Partial<DailyChallengeResponse>;
    if (typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
        !Array.isArray(value.scenarios) || value.scenarios.length !== DAILY_HAND_COUNT ||
        !value.scenarios.every(isScenario) ||
        (value.result !== null && !isDailyResult(value.result))) return null;
    return value as DailyChallengeResponse;
  } catch {
    return null;
  }
}

export async function submitDailyChallenge(
  date: string,
  actions: Action[],
  durationMs: number,
  signal: AbortSignal,
): Promise<DailyResult | null> {
  try {
    const response = await fetch(endpoint("/results"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ date, actions, durationMs }),
      signal,
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !isDailyResult((body as { result?: unknown }).result)) return null;
    return (body as { result: DailyResult }).result;
  } catch {
    return null;
  }
}
