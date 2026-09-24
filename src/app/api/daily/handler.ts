import type { Action } from "@/blackjack";
import { isValidPlayerId } from "@/player/playerId";
import { playerCookieOptions, type PlayerCookieOptions } from "@/player/playerCookie";
import {
  gradeDailyResult, isSubmittableDailyDate, publicDailyScenario,
  type DailyResult, type CanonicalDailyScenario,
} from "@/training/dailyChallenge";

export interface DailyRepository {
  getOrCreateChallenge(date: string): Promise<CanonicalDailyScenario[]>;
  getResult(playerId: string, date: string): Promise<DailyResult | null>;
  ensurePlayer(playerId: string): Promise<void>;
  saveResult(playerId: string, result: DailyResult): Promise<DailyResult>;
}

export interface DailyHandlerDeps {
  repo: DailyRepository;
  readCookie: () => string | undefined;
  newId: () => string;
  now: () => Date;
  secure: boolean;
}

export interface DailyHandlerResult {
  status: number;
  body: Record<string, unknown>;
  setCookie?: PlayerCookieOptions;
}

const ACTIONS: readonly Action[] = ["hit", "stand", "double", "split"];
const ERROR = { error: "daily challenge unavailable" };

export async function handleGetDaily(deps: DailyHandlerDeps): Promise<DailyHandlerResult> {
  const date = deps.now().toISOString().slice(0, 10);
  try {
    const scenarios = await deps.repo.getOrCreateChallenge(date);
    const cookie = deps.readCookie();
    const result = isValidPlayerId(cookie) ? await deps.repo.getResult(cookie, date) : null;
    return { status: 200, body: { date, scenarios: scenarios.map(publicDailyScenario), result } };
  } catch (error) {
    console.error("Failed to load daily challenge:", error);
    return { status: 500, body: ERROR };
  }
}

interface Submission { date: string; actions: Action[]; durationMs: number }

function parseSubmission(rawBody: string): Submission | null {
  let value: unknown;
  try { value = JSON.parse(rawBody); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["date", "actions", "durationMs"].includes(key))) return null;
  if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return null;
  if (!Array.isArray(body.actions) || body.actions.length === 0 || body.actions.length > 10 ||
    !body.actions.every((action) => ACTIONS.includes(action))) return null;
  if (typeof body.durationMs !== "number" || !Number.isSafeInteger(body.durationMs) ||
    body.durationMs < 0 || body.durationMs > 86_400_000) return null;
  return { date: body.date, actions: body.actions as Action[], durationMs: body.durationMs };
}

export async function handlePostDaily(rawBody: string, deps: DailyHandlerDeps): Promise<DailyHandlerResult> {
  const submission = parseSubmission(rawBody);
  if (!submission) return { status: 400, body: { error: "invalid daily result" } };
  if (!isSubmittableDailyDate(submission.date, deps.now())) {
    return { status: 400, body: { error: "daily challenge has expired" } };
  }
  try {
    const scenarios = await deps.repo.getOrCreateChallenge(submission.date);
    const graded = gradeDailyResult(submission.date, scenarios, submission.actions, submission.durationMs);
    if (!graded.ok) return { status: 400, body: { error: graded.reason } };

    const cookie = deps.readCookie();
    const playerId = isValidPlayerId(cookie) ? cookie : deps.newId();
    await deps.repo.ensurePlayer(playerId);
    const setCookie = playerCookieOptions(playerId, deps.secure);
    try {
      const result = await deps.repo.saveResult(playerId, graded.result);
      return { status: 200, body: { result }, setCookie };
    } catch (error) {
      console.error("Failed to save daily result:", error);
      return { status: 500, body: ERROR, setCookie };
    }
  } catch (error) {
    console.error("Failed to grade daily result:", error);
    return { status: 500, body: ERROR };
  }
}
