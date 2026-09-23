/**
 * Run mode: a pure reducer over a session of graded decisions. Lives are
 * lost on wrong decisions; correct decisions build a streak that raises a
 * capped score multiplier. An abandoned run still counts toward the best
 * score: both game over and restart fold the live score into `bestScore`
 * via `max(bestScore, score)`. Persistence (e.g. `bestScore` in storage)
 * is the caller's responsibility; this module only computes the next
 * state.
 */

/** Lives a run starts with. */
export const STARTING_LIVES = 3;

/** Base score awarded per correct decision, before the streak multiplier. */
export const BASE_POINTS = 100;

/** Streak length at which the multiplier becomes x2. */
export const STREAK_MULTIPLIER_X2 = 3;
/** Streak length at which the multiplier becomes x3. */
export const STREAK_MULTIPLIER_X3 = 6;
/** Streak length at which the multiplier becomes x4, its cap. */
export const STREAK_MULTIPLIER_X4 = 9;
/** The multiplier never rises past this value. */
export const MAX_MULTIPLIER = 4;

export type RunStatus = "playing" | "over";

export interface RunState {
  lives: number;
  score: number;
  streak: number;
  bestStreak: number;
  multiplier: number;
  decisions: number;
  status: RunStatus;
  bestScore: number;
}

export type RunEvent = { type: "decision"; isCorrect: boolean } | { type: "restart" };

/**
 * The combo multiplier for a given streak length: x1 below
 * `STREAK_MULTIPLIER_X2`, x2 from there, x3 from `STREAK_MULTIPLIER_X3`,
 * capped at `MAX_MULTIPLIER` from `STREAK_MULTIPLIER_X4` onward.
 */
export function multiplierForStreak(streak: number): number {
  if (streak >= STREAK_MULTIPLIER_X4) return MAX_MULTIPLIER;
  if (streak >= STREAK_MULTIPLIER_X3) return 3;
  if (streak >= STREAK_MULTIPLIER_X2) return 2;
  return 1;
}

/** A fresh run: full lives, zero score/streak, x1 multiplier, still playing. */
export function createInitialRunState(bestScore = 0): RunState {
  return {
    lives: STARTING_LIVES,
    score: 0,
    streak: 0,
    bestStreak: 0,
    multiplier: 1,
    decisions: 0,
    status: "playing",
    bestScore,
  };
}

function applyCorrectDecision(state: RunState): RunState {
  const streak = state.streak + 1;
  const multiplier = multiplierForStreak(streak);
  return {
    ...state,
    score: state.score + BASE_POINTS * multiplier,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    multiplier,
    decisions: state.decisions + 1,
  };
}

function applyWrongDecision(state: RunState): RunState {
  const lives = state.lives - 1;
  const isOver = lives <= 0;
  return {
    ...state,
    lives,
    streak: 0,
    multiplier: 1,
    decisions: state.decisions + 1,
    status: isOver ? "over" : "playing",
    bestScore: isOver ? Math.max(state.bestScore, state.score) : state.bestScore,
  };
}

/**
 * Advances a run's state. Decisions are ignored once the run is over
 * (the same state is returned); `restart` always starts a fresh run,
 * folding the live score into `bestScore` first (`max(bestScore, score)`)
 * so an abandoned run still counts toward the best.
 */
export function runReducer(state: RunState, event: RunEvent): RunState {
  if (event.type === "restart") {
    return createInitialRunState(Math.max(state.bestScore, state.score));
  }

  if (state.status === "over") {
    return state;
  }

  return event.isCorrect ? applyCorrectDecision(state) : applyWrongDecision(state);
}
