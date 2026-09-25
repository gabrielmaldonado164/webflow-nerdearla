/**
 * Pure keyboard-to-command mapping for the pixel casino screen. Mirrors the
 * screen's key legend (H/S/D/P for actions, Enter to advance or restart),
 * case-insensitively. DOM-specific concerns (modifier keys, repeats,
 * focused form elements) stay in the screen's key listener; this module
 * only decides what a bare key means given the current session state.
 */

import type { Action } from "@/blackjack";

export type KeyCommand =
  | { type: "choose"; action: Action }
  | { type: "next" }
  | { type: "restart" };

export interface KeyToCommandOptions {
  /** Whether feedback for the current hand is being shown. */
  hasFeedback: boolean;
  /** Actions legal for the current hand. */
  availableActions: readonly Action[];
  /** Whether the run has ended (out of lives). */
  isGameOver: boolean;
}

const KEY_TO_ACTION: Record<string, Action> = {
  h: "hit",
  s: "stand",
  d: "double",
  p: "split",
};

/**
 * Maps a raw key (as in `KeyboardEvent.key`) to a session command, or
 * `null` if the key does nothing in the current state:
 * - Game over: Enter or R restarts; everything else is a no-op.
 * - Feedback pending (and not game over): Enter advances to the next hand;
 *   action keys are ignored (no choosing while a decision is pending).
 * - Otherwise: H/S/D/P choose the matching action, rejected if it isn't in
 *   `availableActions`; Enter does nothing (no feedback to advance from).
 */
export function keyToCommand(key: string, options: KeyToCommandOptions): KeyCommand | null {
  const normalized = key.toLowerCase();

  if (options.isGameOver) {
    return normalized === "enter" || normalized === "r" ? { type: "restart" } : null;
  }

  if (options.hasFeedback) {
    return normalized === "enter" ? { type: "next" } : null;
  }

  const action = KEY_TO_ACTION[normalized];
  if (!action || !options.availableActions.includes(action)) return null;
  return { type: "choose", action };
}
