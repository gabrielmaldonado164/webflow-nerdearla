/**
 * Pure planner for `PixelCasinoScreen`'s reveal timing and sound cues: given
 * a resolved hand's feedback and whether the run just ended, decides what
 * to reveal, when (via `buildRevealSchedule`), and which sound cue goes
 * with each step, plus the instant correct/mistake cue and whether to
 * vibrate. The component only turns `planTimedReveal`'s steps into
 * `setTimeout`s (clearing them on cleanup) and plays `planImmediateCue`'s
 * cue directly — none of that decision logic lives in the component
 * itself anymore.
 *
 * Game over freezes the table: once the run is over, `planTimedReveal`
 * returns no steps at all (no further cards land, no hole-card flip, no
 * outcome banner, no reveal sounds behind the overlay), and
 * `planImmediateCue` swaps the mistake cue for silence — the separate
 * `gameOver` cue (fired elsewhere, once, on the `run.status` transition)
 * replaces it instead. Vibration is unaffected by game over, matching the
 * pre-extraction behavior: a losing final decision still vibrates.
 */

import type { SessionFeedback } from "@/features/practice/sessionReducer";

import { buildRevealSchedule, type RevealTiming } from "./revealSchedule";
import type { SoundCue } from "./sound";

export type RevealStep =
  | { kind: "step"; index: number; atMs: number; sound: "deal" }
  | { kind: "hole"; atMs: number; sound: "flip" }
  | { kind: "outcome"; atMs: number; sound: "win" | "lose" | "push" };

/**
 * The timed reveal sequence: each extra card landing, the hole-card flip,
 * then the outcome banner — each paired with the sound cue to play when it
 * fires, in the same order and offsets `buildRevealSchedule` computes.
 * Empty with no feedback yet, or once the run is over.
 */
export function planTimedReveal(
  feedback: SessionFeedback | null,
  runOver: boolean,
  timing: RevealTiming,
): RevealStep[] {
  if (!feedback || runOver) return [];

  const steps = feedback.resolution.steps;
  const schedule = buildRevealSchedule(steps, timing);

  const stepReveals: RevealStep[] = steps.map((_, index) => ({
    kind: "step",
    index,
    atMs: schedule.stepRevealAt[index],
    sound: "deal",
  }));

  const hands = feedback.resolution.playerHands;
  const anyWin = hands.some((hand) => hand.outcome === "win" || hand.outcome === "blackjack");
  const allPush = hands.every((hand) => hand.outcome === "push");
  const outcomeSound: RevealStep["sound"] = anyWin ? "win" : allPush ? "push" : "lose";

  return [
    ...stepReveals,
    { kind: "hole", atMs: schedule.holeCardFlipAt, sound: "flip" },
    { kind: "outcome", atMs: schedule.outcomeAt, sound: outcomeSound },
  ];
}

export interface ImmediateCue {
  sound: Extract<SoundCue, "correct" | "mistake"> | null;
  vibrate: boolean;
}

/**
 * The cue to play the instant feedback lands, and whether to vibrate.
 * `sound` is `null` with no feedback, or once the run is over on a wrong
 * decision (the separate `gameOver` cue takes over instead of overlapping
 * with `mistake`).
 */
export function planImmediateCue(feedback: SessionFeedback | null, runOver: boolean): ImmediateCue {
  if (!feedback) return { sound: null, vibrate: false };
  return {
    sound: runOver ? null : feedback.isCorrect ? "correct" : "mistake",
    vibrate: !feedback.isCorrect,
  };
}
