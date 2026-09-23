/**
 * Guarded `localStorage` access for the pixel casino's session-scoped
 * preferences: whether SFX are muted, and the best score to seed a fresh
 * run with. Every storage access is wrapped in try/catch and falls back
 * to its default — storage can throw or simply be unavailable with it
 * blocked, in private browsing, or on the server, and none of that
 * should break the game.
 *
 * `storage` is an explicit, injectable parameter (defaulting to
 * `window.localStorage` when available) so this stays test-friendly
 * without a DOM.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const MUTED_KEY = "pixel-casino:muted";
const BEST_SCORE_KEY = "pixel-casino:best-score";

/** The muted state before `loadMuted` has run (e.g. a hook's initial render, server or client). */
export const DEFAULT_MUTED = false;
const DEFAULT_BEST_SCORE = 0;

function defaultStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined; // e.g. storage access blocked entirely (some private-mode browsers).
  }
}

function isValidBestScore(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function loadMuted(storage: StorageLike | undefined = defaultStorage()): boolean {
  if (!storage) return DEFAULT_MUTED;
  try {
    return storage.getItem(MUTED_KEY) === "true";
  } catch {
    return DEFAULT_MUTED;
  }
}

export function saveMuted(muted: boolean, storage: StorageLike | undefined = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(MUTED_KEY, muted ? "true" : "false");
  } catch {
    // Storage blocked, full, or private mode: nothing we can do, and
    // nothing worth surfacing to the player.
  }
}

export function loadBestScore(storage: StorageLike | undefined = defaultStorage()): number {
  if (!storage) return DEFAULT_BEST_SCORE;
  try {
    const raw = storage.getItem(BEST_SCORE_KEY);
    if (raw === null) return DEFAULT_BEST_SCORE;
    const parsed = Number(raw);
    return isValidBestScore(parsed) ? parsed : DEFAULT_BEST_SCORE;
  } catch {
    return DEFAULT_BEST_SCORE;
  }
}

export function saveBestScore(score: number, storage: StorageLike | undefined = defaultStorage()): void {
  if (!storage || !isValidBestScore(score)) return;
  try {
    storage.setItem(BEST_SCORE_KEY, String(score));
  } catch {
    // Same as `saveMuted`: silently ignore a blocked/full store.
  }
}
