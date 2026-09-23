import { describe, expect, it } from "vitest";

import {
  BASE_POINTS,
  createInitialRunState,
  multiplierForStreak,
  runReducer,
  STARTING_LIVES,
  STREAK_MULTIPLIER_X2,
  STREAK_MULTIPLIER_X3,
  STREAK_MULTIPLIER_X4,
} from "./run";

describe("multiplierForStreak", () => {
  it("is x1 below the x2 threshold", () => {
    expect(multiplierForStreak(0)).toBe(1);
    expect(multiplierForStreak(STREAK_MULTIPLIER_X2 - 1)).toBe(1);
  });

  it("is x2 from the x2 threshold up to the x3 threshold", () => {
    expect(multiplierForStreak(STREAK_MULTIPLIER_X2)).toBe(2);
    expect(multiplierForStreak(STREAK_MULTIPLIER_X3 - 1)).toBe(2);
  });

  it("is x3 from the x3 threshold up to the x4 threshold", () => {
    expect(multiplierForStreak(STREAK_MULTIPLIER_X3)).toBe(3);
    expect(multiplierForStreak(STREAK_MULTIPLIER_X4 - 1)).toBe(3);
  });

  it("caps at x4 from the x4 threshold, however high the streak climbs", () => {
    expect(multiplierForStreak(STREAK_MULTIPLIER_X4)).toBe(4);
    expect(multiplierForStreak(STREAK_MULTIPLIER_X4 + 50)).toBe(4);
  });
});

describe("createInitialRunState", () => {
  it("starts with 3 lives, zero score/streak/decisions, x1 multiplier, and status playing", () => {
    expect(createInitialRunState()).toEqual({
      lives: STARTING_LIVES,
      score: 0,
      streak: 0,
      bestStreak: 0,
      multiplier: 1,
      decisions: 0,
      status: "playing",
      bestScore: 0,
    });
  });

  it("accepts an initial best score (loaded by the UI from storage)", () => {
    expect(createInitialRunState(500).bestScore).toBe(500);
  });
});

describe("runReducer", () => {
  it("a correct decision increases the streak, derives the multiplier from it, and scores accordingly", () => {
    const state = createInitialRunState();
    const next = runReducer(state, { type: "decision", isCorrect: true });

    expect(next.streak).toBe(1);
    expect(next.bestStreak).toBe(1);
    expect(next.multiplier).toBe(1);
    expect(next.score).toBe(BASE_POINTS);
    expect(next.decisions).toBe(1);
    expect(next.lives).toBe(STARTING_LIVES);
    expect(next.status).toBe("playing");
  });

  it("crosses the x2 multiplier threshold on the streak's 3rd correct decision", () => {
    let state = createInitialRunState();
    for (let i = 0; i < 3; i++) {
      state = runReducer(state, { type: "decision", isCorrect: true });
    }

    expect(state.streak).toBe(3);
    expect(state.multiplier).toBe(2);
    expect(state.score).toBe(BASE_POINTS + BASE_POINTS + BASE_POINTS * 2);
  });

  it("a wrong decision costs one life and resets streak and multiplier, but keeps bestStreak", () => {
    let state = createInitialRunState();
    state = runReducer(state, { type: "decision", isCorrect: true });
    state = runReducer(state, { type: "decision", isCorrect: true });
    const scoreBeforeMiss = state.score;

    const next = runReducer(state, { type: "decision", isCorrect: false });

    expect(next.lives).toBe(STARTING_LIVES - 1);
    expect(next.streak).toBe(0);
    expect(next.multiplier).toBe(1);
    expect(next.bestStreak).toBe(2);
    expect(next.score).toBe(scoreBeforeMiss);
    expect(next.decisions).toBe(3);
    expect(next.status).toBe("playing");
  });

  it("reaching zero lives ends the run and records the best score", () => {
    let state = createInitialRunState(10);
    state = runReducer(state, { type: "decision", isCorrect: true }); // score = BASE_POINTS
    for (let i = 0; i < STARTING_LIVES; i++) {
      state = runReducer(state, { type: "decision", isCorrect: false });
    }

    expect(state.lives).toBe(0);
    expect(state.status).toBe("over");
    expect(state.bestScore).toBe(Math.max(10, BASE_POINTS));
  });

  it("ignores decisions once the run is over", () => {
    let state = createInitialRunState();
    for (let i = 0; i < STARTING_LIVES; i++) {
      state = runReducer(state, { type: "decision", isCorrect: false });
    }
    expect(state.status).toBe("over");

    const next = runReducer(state, { type: "decision", isCorrect: true });
    expect(next).toEqual(state);
  });

  it("restart resets everything except the best score", () => {
    let state = createInitialRunState(50);
    state = runReducer(state, { type: "decision", isCorrect: true });
    state = runReducer(state, { type: "decision", isCorrect: false });

    const restarted = runReducer(state, { type: "restart" });

    expect(restarted).toEqual(createInitialRunState(50));
  });

  it("restart after game over keeps the best score recorded at game over", () => {
    let state = createInitialRunState(0);
    state = runReducer(state, { type: "decision", isCorrect: true }); // score = BASE_POINTS
    for (let i = 0; i < STARTING_LIVES; i++) {
      state = runReducer(state, { type: "decision", isCorrect: false });
    }
    expect(state.bestScore).toBe(BASE_POINTS);

    const restarted = runReducer(state, { type: "restart" });
    expect(restarted).toEqual(createInitialRunState(BASE_POINTS));
  });
});
